using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace ClipVault.Core.Buffer;

/// <summary>
/// Hybrid rolling buffer that keeps recent frames in RAM and older frames in memory-mapped disk file.
/// Target: ~500MB RAM for 30s recent + ~2GB disk file for 3min total at 1080p60.
/// </summary>
public sealed class HybridFrameBuffer : IDisposable
{
    // Configuration
    private readonly int _width;
    private readonly int _height;
    private readonly int _fps;
    private readonly int _ramBufferSeconds;
    private readonly int _totalBufferSeconds;
    private readonly string _tempFilePath;

    // Frame size calculations
    private readonly int _frameSize;
    private readonly int _metadataSize;
    private readonly int _totalFrameSize;

    // RAM buffer (recent frames)
    private readonly FrameMetadata[] _ramMetadata;
    private readonly byte[]?[] _ramFrames;
    private int _ramWriteIndex;
    private int _ramCount;

    // Disk buffer (older frames via memory-mapped file)
    private readonly MemoryMappedFile? _diskFile;
    private readonly MemoryMappedViewAccessor? _diskAccessor;
    private readonly int _diskCapacity;
    private long _diskWritePosition;
    private long _diskFrameCount;

    // Frame pool for efficient reuse
    private readonly FramePool _framePool;

    // Threading
    private readonly object _lock = new();
    private readonly SemaphoreSlim _diskSemaphore = new(1, 1);
    private bool _disposed;

    private record struct FrameMetadata(long TimestampTicks, int FrameIndex, bool IsValid);

    public int Width => _width;
    public int Height => _height;
    public int FrameSize => _frameSize;
    public int Count => (int)(_ramCount + _diskFrameCount);
    public int RamCount => _ramCount;
    public long DiskCount => _diskFrameCount;

    /// <summary>
    /// Total buffered duration in seconds (RAM + disk)
    /// </summary>
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
        string? tempFilePath = null)
    {
        _width = width;
        _height = height;
        _fps = fps;
        _ramBufferSeconds = ramBufferSeconds;
        _totalBufferSeconds = totalBufferSeconds;
        _tempFilePath = tempFilePath ?? Path.Combine(Path.GetTempPath(), $"ClipVault_Buffer_{Guid.NewGuid()}.tmp");

        _frameSize = width * height * 4; // BGRA
        _metadataSize = Marshal.SizeOf<FrameMetadata>();
        _totalFrameSize = _frameSize + _metadataSize;

        // Initialize RAM buffer
        var ramFrameCount = fps * ramBufferSeconds;
        _ramMetadata = new FrameMetadata[ramFrameCount];
        _ramFrames = new byte[ramFrameCount][];

        // Initialize frame pool (2x RAM capacity for double-buffering during save)
        _framePool = new FramePool(width, height, ramFrameCount * 2);
        _framePool.Prewarm(ramFrameCount);

        // Initialize disk buffer (only if we need more than RAM can hold)
        var diskBufferSeconds = totalBufferSeconds - ramBufferSeconds;

        // Only create disk buffer if we actually need it
        if (diskBufferSeconds > 0)
        {
            _diskCapacity = fps * diskBufferSeconds;
            var diskFileSize = (long)_diskCapacity * _totalFrameSize;

            try
            {
                _diskFile = MemoryMappedFile.CreateFromFile(
                    _tempFilePath,
                    FileMode.Create,
                    null,
                    diskFileSize,
                    MemoryMappedFileAccess.ReadWrite);

                _diskAccessor = _diskFile.CreateViewAccessor();
                Logger.Info($"  Disk buffer: {_diskCapacity} frames ({diskBufferSeconds}s, ~{diskFileSize / 1024 / 1024}MB)");
            }
            catch (Exception ex)
            {
                Logger.Error($"Failed to create memory-mapped file: {ex.Message}");
                // Fall back to RAM-only mode
                _diskCapacity = 0;
            }
        }
        else
        {
            _diskCapacity = 0;
            Logger.Info("  Disk buffer: disabled (RAM-only mode)");
        }

        // Use long to avoid integer overflow for large buffers
        var ramSizeMB = ((long)ramFrameCount * _frameSize) / (1024 * 1024);
        Logger.Info($"HybridFrameBuffer initialized: {width}x{height}@{fps}fps");
        Logger.Info($"  RAM buffer: {ramFrameCount} frames ({ramBufferSeconds}s, ~{ramSizeMB}MB)");
    }

    /// <summary>
    /// Add a frame to the buffer. Older frames are moved to disk automatically.
    /// </summary>
    public void Add(nint texturePointer, long timestampTicks)
    {
        if (_disposed) return;

        // Get a buffer from the pool
        var frameBuffer = _framePool.Rent();

        // Copy frame data
        Marshal.Copy(texturePointer, frameBuffer, 0, _frameSize);

        lock (_lock)
        {
            // Store in RAM buffer
            var oldBuffer = _ramFrames[_ramWriteIndex];
            _ramFrames[_ramWriteIndex] = frameBuffer;
            _ramMetadata[_ramWriteIndex] = new FrameMetadata(timestampTicks, _ramWriteIndex, true);

            // Return old buffer to pool
            if (oldBuffer != null)
            {
                _framePool.Return(oldBuffer);

                // Move the evicted frame to disk if we have disk buffer
                if (_diskCapacity > 0 && _ramCount >= _ramFrames.Length)
                {
                    _ = Task.Run(() => WriteToDiskAsync(oldBuffer, _ramMetadata[_ramWriteIndex]));
                }
            }

            _ramWriteIndex = (_ramWriteIndex + 1) % _ramFrames.Length;
            if (_ramCount < _ramFrames.Length)
                _ramCount++;
        }
    }

    private async Task WriteToDiskAsync(byte[] frameData, FrameMetadata metadata)
    {
        if (_diskAccessor == null || _disposed) return;

        await _diskSemaphore.WaitAsync();
        try
        {
            var position = Interlocked.Increment(ref _diskWritePosition) % _diskCapacity;
            var byteOffset = position * _totalFrameSize;

            // Write metadata
            _diskAccessor.Write(byteOffset, ref metadata);

            // Write frame data
            _diskAccessor.WriteArray(byteOffset + _metadataSize, frameData, 0, _frameSize);

            Interlocked.Increment(ref _diskFrameCount);
            if (_diskFrameCount > _diskCapacity)
                _diskFrameCount = _diskCapacity;
        }
        finally
        {
            _diskSemaphore.Release();
        }
    }

    /// <summary>
    /// Get all frames from both RAM and disk buffers.
    /// Returns frames in chronological order.
    /// </summary>
    public Encoding.TimestampedFrame[] GetAll()
    {
        if (_disposed) return Array.Empty<Encoding.TimestampedFrame>();

        lock (_lock)
        {
            var result = new List<Encoding.TimestampedFrame>();

            // Calculate total frames
            var totalFrames = _ramCount + (int)Math.Min(_diskFrameCount, _diskCapacity);

            if (totalFrames == 0)
                return Array.Empty<Encoding.TimestampedFrame>();

            // Read disk frames first (older)
            if (_diskAccessor != null && _diskFrameCount > 0)
            {
                var diskFramesToRead = (int)Math.Min(_diskFrameCount, _diskCapacity);
                for (int i = 0; i < diskFramesToRead; i++)
                {
                    var position = (_diskWritePosition - diskFramesToRead + i + _diskCapacity) % _diskCapacity;
                    var byteOffset = position * _totalFrameSize;

                    _diskAccessor.Read(byteOffset, out FrameMetadata metadata);
                    if (metadata.IsValid)
                    {
                        var frameData = new byte[_frameSize];
                        _diskAccessor.ReadArray(byteOffset + _metadataSize, frameData, 0, _frameSize);

                        result.Add(new Encoding.TimestampedFrame(
                            frameData,
                            metadata.TimestampTicks,
                            _width,
                            _height));
                    }
                }
            }

            // Add RAM frames (newer)
            int readIndex = _ramCount < _ramFrames.Length
                ? 0
                : _ramWriteIndex;

            for (int i = 0; i < _ramCount; i++)
            {
                var idx = (readIndex + i) % _ramFrames.Length;
                var meta = _ramMetadata[idx];

                if (meta.IsValid && _ramFrames[idx] != null)
                {
                    // Create a copy for the caller (encoding)
                    var frameCopy = new byte[_frameSize];
                    System.Buffer.BlockCopy(_ramFrames[idx]!, 0, frameCopy, 0, _frameSize);

                    result.Add(new Encoding.TimestampedFrame(
                        frameCopy,
                        meta.TimestampTicks,
                        _width,
                        _height));
                }
            }

            return result.ToArray();
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            // Return all RAM buffers to pool
            for (int i = 0; i < _ramFrames.Length; i++)
            {
                if (_ramFrames[i] != null)
                {
                    _framePool.Return(_ramFrames[i]!);
                    _ramFrames[i] = null;
                }
                _ramMetadata[i] = default;
            }

            _ramWriteIndex = 0;
            _ramCount = 0;
            _diskWritePosition = 0;
            _diskFrameCount = 0;
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        Clear();
        _framePool.Dispose();
        _diskAccessor?.Dispose();
        _diskFile?.Dispose();
        _diskSemaphore.Dispose();

        // Clean up temp file
        try
        {
            if (File.Exists(_tempFilePath))
            {
                File.Delete(_tempFilePath);
            }
        }
        catch { }
    }
}