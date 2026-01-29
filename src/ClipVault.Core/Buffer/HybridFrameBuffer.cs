using System.Drawing;
using System.Drawing.Imaging;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace ClipVault.Core.Buffer;

/// <summary>
/// Hybrid rolling buffer that keeps recent frames in RAM and older frames in memory-mapped disk file.
/// Uses JPEG compression to reduce memory usage (~100KB per 1080p frame vs 8.3MB raw).
/// Target: ~300MB RAM for 30s recent + ~1GB disk file for 3min total at 1080p60.
/// </summary>
public sealed class HybridFrameBuffer : IDisposable
{
    private readonly int _width;
    private readonly int _height;
    private readonly int _fps;
    private readonly int _ramBufferSeconds;
    private readonly int _totalBufferSeconds;
    private readonly string _tempFilePath;
    private readonly int _compressionQuality;
    private readonly ImageCodecInfo _jpegCodec;
    private readonly EncoderParameters _encoderParams;

    private readonly int _rawFrameSize;
    private readonly int _metadataSize;
    private readonly int _maxCompressedSize;

    private readonly FrameMetadata[] _ramMetadata;
    private readonly byte[]?[] _ramFrames;
    private readonly bool[] _ramFrameValid;
    private int _ramWriteIndex;
    private int _ramCount;

    private readonly MemoryMappedFile? _diskFile;
    private readonly MemoryMappedViewAccessor? _diskAccessor;
    private readonly int _diskCapacity;
    private long _diskWritePosition;
    private long _diskFrameCount;

    private readonly object _lock = new();
    private readonly SemaphoreSlim _diskSemaphore = new(1, 1);
    private bool _disposed;

    private record struct FrameMetadata(long TimestampTicks, int FrameIndex, bool IsValid);

    public int Width => _width;
    public int Height => _height;
    public int RawFrameSize => _rawFrameSize;
    public int Count => (int)(_ramCount + _diskFrameCount);
    public int RamCount => _ramCount;
    public long DiskCount => _diskFrameCount;

    public double BufferedDurationSeconds
    {
        get
        {
            lock (_lock)
            {
                return (double)(_ramCount + _diskFrameCount) / _fps;
            }
        }
    }

    public HybridFrameBuffer(
        int width,
        int height,
        int fps,
        int ramBufferSeconds = 30,
        int totalBufferSeconds = 180,
        int compressionQuality = 90,
        string? tempFilePath = null)
    {
        _width = width;
        _height = height;
        _fps = fps;
        _ramBufferSeconds = ramBufferSeconds;
        _totalBufferSeconds = totalBufferSeconds;
        _compressionQuality = compressionQuality;
        _tempFilePath = tempFilePath ?? Path.Combine(Path.GetTempPath(), $"ClipVault_Buffer_{Guid.NewGuid()}.tmp");

        _rawFrameSize = width * height * 4;
        _metadataSize = Marshal.SizeOf<FrameMetadata>();
        _maxCompressedSize = width * height * 3 / 2;

        _jpegCodec = GetJpegCodec();
        _encoderParams = new EncoderParameters(1)
        {
            Param = { [0] = new EncoderParameter(Encoder.Quality, compressionQuality) }
        };

        var ramFrameCount = fps * ramBufferSeconds;
        _ramMetadata = new FrameMetadata[ramFrameCount];
        _ramFrames = new byte[ramFrameCount][];
        _ramFrameValid = new bool[ramFrameCount];

        var diskBufferSeconds = totalBufferSeconds - ramBufferSeconds;

        if (diskBufferSeconds > 0)
        {
            _diskCapacity = fps * diskBufferSeconds;
            var maxDiskFileSize = (long)_diskCapacity * (_metadataSize + _maxCompressedSize);

            try
            {
                _diskFile = MemoryMappedFile.CreateFromFile(
                    _tempFilePath,
                    FileMode.Create,
                    null,
                    maxDiskFileSize,
                    MemoryMappedFileAccess.ReadWrite);

                _diskAccessor = _diskFile.CreateViewAccessor();
                Logger.Info($"  Disk buffer: {_diskCapacity} frames ({diskBufferSeconds}s");
            }
            catch (Exception ex)
            {
                Logger.Error($"Failed to create memory-mapped file: {ex.Message}");
                _diskCapacity = 0;
            }
        }
        else
        {
            _diskCapacity = 0;
            Logger.Info("  Disk buffer: disabled (RAM-only mode)");
        }

        Logger.Info($"HybridFrameBuffer initialized: {width}x{height}@{fps}fps, JPEG quality {compressionQuality}");
        Logger.Info($"  RAM buffer: {ramFrameCount} frames ({ramBufferSeconds}s");
    }

    private static ImageCodecInfo GetJpegCodec()
    {
        var codecs = ImageCodecInfo.GetImageEncoders();
        return codecs.FirstOrDefault(c => c.FormatID == ImageFormat.Jpeg.Guid) ?? codecs[0];
    }

    private byte[] CompressFrame(byte[] rawData)
    {
        using var ms = new MemoryStream(_maxCompressedSize);
        using var bitmap = new Bitmap(_width, _height, PixelFormat.Format32bppRgb);
        var rect = new Rectangle(0, 0, _width, _height);
        var bitmapData = bitmap.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppRgb);
        try
        {
            Marshal.Copy(rawData, 0, bitmapData.Scan0, rawData.Length);
        }
        finally
        {
            bitmap.UnlockBits(bitmapData);
        }
        bitmap.Save(ms, _jpegCodec, _encoderParams);
        return ms.ToArray();
    }

    private byte[] DecompressFrame(byte[] compressedData)
    {
        using var ms = new MemoryStream(compressedData);
        using var bitmap = new Bitmap(ms);
        var result = new byte[_rawFrameSize];
        var rect = new Rectangle(0, 0, _width, _height);
        var bitmapData = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
        try
        {
            Marshal.Copy(bitmapData.Scan0, result, 0, _rawFrameSize);
        }
        finally
        {
            bitmap.UnlockBits(bitmapData);
        }
        return result;
    }

    public void Add(nint texturePointer, long timestampTicks)
    {
        if (_disposed) return;

        var rawBuffer = new byte[_rawFrameSize];
        Marshal.Copy(texturePointer, rawBuffer, 0, _rawFrameSize);

        var compressed = CompressFrame(rawBuffer);

        lock (_lock)
        {
            var oldFrame = _ramFrames[_ramWriteIndex];
            _ramFrames[_ramWriteIndex] = compressed;
            _ramFrameValid[_ramWriteIndex] = true;
            _ramMetadata[_ramWriteIndex] = new FrameMetadata(timestampTicks, _ramWriteIndex, true);

            if (oldFrame != null && _ramFrameValid[_ramWriteIndex])
            {
                if (_diskCapacity > 0 && _ramCount >= _ramFrames.Length)
                {
                    _ = Task.Run(() => WriteToDiskAsync(oldFrame, _ramMetadata[_ramWriteIndex]));
                }
            }

            _ramWriteIndex = (_ramWriteIndex + 1) % _ramFrames.Length;
            if (_ramCount < _ramFrames.Length)
                _ramCount++;
        }
    }

    private async Task WriteToDiskAsync(byte[] compressedData, FrameMetadata metadata)
    {
        if (_diskAccessor == null || _disposed) return;

        await _diskSemaphore.WaitAsync();
        try
        {
            var position = (int)(Interlocked.Increment(ref _diskWritePosition) % _diskCapacity);
            var byteOffset = (long)position * (_metadataSize + _maxCompressedSize);

            _diskAccessor.Write(byteOffset, ref metadata);
            _diskAccessor.WriteArray(byteOffset + _metadataSize, compressedData, 0, compressedData.Length);

            Interlocked.Increment(ref _diskFrameCount);
            if (_diskFrameCount > _diskCapacity)
                Interlocked.Exchange(ref _diskFrameCount, _diskCapacity);
        }
        finally
        {
            _diskSemaphore.Release();
        }
    }

    public (string FilePath, long StartTimestamp, long EndTimestamp, int FrameCount) WriteRawFramesToFile(string outputPath, long targetStartTicks)
    {
        if (_disposed) return (outputPath, 0, 0, 0);

        lock (_lock)
        {
            var totalFrames = _ramCount + (int)Math.Min(_diskFrameCount, _diskCapacity);
            if (totalFrames == 0)
                return (outputPath, 0, 0, 0);

            long startTimestamp = 0;
            long endTimestamp = 0;
            var frameCount = 0;

            var decompressBuffer = new byte[_rawFrameSize];
            var compressedBuffer = new byte[_maxCompressedSize];

            using var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.None, _rawFrameSize * 2, FileOptions.SequentialScan);
            using var bufferedStream = new BufferedStream(fs, _rawFrameSize * 4);

            if (_diskAccessor != null && _diskFrameCount > 0)
            {
                var diskFramesToRead = (int)Math.Min(_diskFrameCount, _diskCapacity);

                for (int i = 0; i < diskFramesToRead; i++)
                {
                    var position = (int)((_diskWritePosition - diskFramesToRead + i + _diskCapacity) % _diskCapacity);
                    var byteOffset = (long)position * (_metadataSize + _maxCompressedSize);

                    _diskAccessor.Read(byteOffset, out FrameMetadata metadata);
                    if (metadata.IsValid && metadata.TimestampTicks >= targetStartTicks)
                    {
                        var dataLength = GetCompressedDataLength(byteOffset + _metadataSize);
                        _diskAccessor.ReadArray(byteOffset + _metadataSize, compressedBuffer, 0, dataLength);

                        DecompressFrameToBuffer(compressedBuffer, 0, dataLength, decompressBuffer);

                        if (frameCount == 0)
                            startTimestamp = metadata.TimestampTicks;
                        endTimestamp = metadata.TimestampTicks;

                        bufferedStream.Write(decompressBuffer, 0, _rawFrameSize);
                        frameCount++;
                    }
                }
            }

            int readIndex = _ramCount < _ramFrames.Length ? 0 : _ramWriteIndex;
            for (int i = 0; i < _ramCount; i++)
            {
                var idx = (readIndex + i) % _ramFrames.Length;
                var meta = _ramMetadata[idx];

                if (meta.IsValid && _ramFrameValid[idx] && meta.TimestampTicks >= targetStartTicks && _ramFrames[idx] != null)
                {
                    DecompressFrameToBuffer(_ramFrames[idx]!, 0, _ramFrames[idx]!.Length, decompressBuffer);

                    if (frameCount == 0)
                        startTimestamp = meta.TimestampTicks;
                    endTimestamp = meta.TimestampTicks;

                    bufferedStream.Write(decompressBuffer, 0, _rawFrameSize);
                    frameCount++;
                }
            }

            bufferedStream.Flush();
            fs.Flush(true);

            return (outputPath, startTimestamp, endTimestamp, frameCount);
        }
    }

    private void DecompressFrameToBuffer(byte[] compressedData, int compressedOffset, int compressedLength, byte[] resultBuffer)
    {
        using var ms = new MemoryStream(compressedData, compressedOffset, compressedLength);
        using var bitmap = new Bitmap(ms);
        var rect = new Rectangle(0, 0, _width, _height);
        var bitmapData = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
        try
        {
            Marshal.Copy(bitmapData.Scan0, resultBuffer, 0, _rawFrameSize);
        }
        finally
        {
            bitmap.UnlockBits(bitmapData);
        }
    }

    private int GetCompressedDataLength(long position)
    {
        if (_diskAccessor == null) return 0;

        for (int i = 0; i < _maxCompressedSize - 4; i++)
        {
            var offset = position + i;
            if (offset + 4 <= _diskAccessor.Capacity &&
                _diskAccessor.ReadByte(offset) == 0xFF &&
                _diskAccessor.ReadByte(offset + 1) == 0xD9)
            {
                return i + 2;
            }
        }
        return _maxCompressedSize;
    }

    public Encoding.TimestampedFrame[] GetAll()
    {
        return Array.Empty<Encoding.TimestampedFrame>();
    }

    public void Clear()
    {
        lock (_lock)
        {
            for (int i = 0; i < _ramFrames.Length; i++)
            {
                _ramFrames[i] = null;
                _ramFrameValid[i] = false;
                _ramMetadata[i] = default;
            }
            _ramWriteIndex = 0;
            _ramCount = 0;
            _diskWritePosition = 0;
            Interlocked.Exchange(ref _diskFrameCount, 0);
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        Clear();
        _diskAccessor?.Dispose();
        _diskFile?.Dispose();
        _diskSemaphore.Dispose();

        try
        {
            if (File.Exists(_tempFilePath))
                File.Delete(_tempFilePath);
        }
        catch { }
    }
}