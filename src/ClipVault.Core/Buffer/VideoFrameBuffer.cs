using System.Runtime.InteropServices;

namespace ClipVault.Core.Buffer;

/// <summary>
/// Rolling buffer for video frames using pre-allocated memory to avoid GC pressure.
/// Uses a circular array of pre-allocated byte arrays.
/// </summary>
public sealed class VideoFrameBuffer : IDisposable
{
    private readonly int _maxFrameCount;
    private readonly byte[][] _framePool;
    private readonly FrameMetadata[] _metadata;
    private readonly object _lock = new();

    private int _writeIndex;
    private int _count;
    private int _frameSize;
    private bool _disposed;

    public int Capacity => _maxFrameCount;
    public int Count { get { lock (_lock) return _count; } }

    private record struct FrameMetadata(long TimestampTicks, int Width, int Height, bool Valid);

    public VideoFrameBuffer(int fps, int maxDurationSeconds)
    {
        _maxFrameCount = fps * maxDurationSeconds;
        _framePool = new byte[_maxFrameCount][];
        _metadata = new FrameMetadata[_maxFrameCount];
        _writeIndex = 0;
        _count = 0;
    }

    public void Add(nint texturePointer, long timestampTicks, int width, int height)
    {
        var frameSize = width * height * 4; // BGRA = 4 bytes per pixel

        lock (_lock)
        {
            // Lazy allocate frame buffers as needed (only once per slot)
            if (_framePool[_writeIndex] == null || _framePool[_writeIndex].Length != frameSize)
            {
                _framePool[_writeIndex] = new byte[frameSize];
                _frameSize = frameSize;
            }

            // Copy frame data into pre-allocated buffer
            Marshal.Copy(texturePointer, _framePool[_writeIndex], 0, frameSize);

            // Store metadata
            _metadata[_writeIndex] = new FrameMetadata(timestampTicks, width, height, true);

            // Advance write position
            _writeIndex = (_writeIndex + 1) % _maxFrameCount;

            // Track count (max out at capacity)
            if (_count < _maxFrameCount)
                _count++;
        }
    }

    public Encoding.TimestampedFrame[] GetAll()
    {
        lock (_lock)
        {
            if (_count == 0)
                return Array.Empty<Encoding.TimestampedFrame>();

            var result = new List<Encoding.TimestampedFrame>(_count);

            // Calculate read start position
            int readIndex = _count < _maxFrameCount
                ? 0
                : _writeIndex; // If full, oldest is at write position

            for (int i = 0; i < _count; i++)
            {
                var idx = (readIndex + i) % _maxFrameCount;
                var meta = _metadata[idx];

                if (meta.Valid && _framePool[idx] != null && _framePool[idx].Length > 0)
                {
                    // Create a copy of the frame data for encoding
                    var frameCopy = new byte[_framePool[idx].Length];
                    System.Buffer.BlockCopy(_framePool[idx], 0, frameCopy, 0, frameCopy.Length);

                    result.Add(new Encoding.TimestampedFrame(frameCopy, meta.TimestampTicks, meta.Width, meta.Height));
                }
            }

            return result.ToArray();
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            // Just reset indices, keep allocated buffers for reuse
            _writeIndex = 0;
            _count = 0;

            // Mark all as invalid
            for (int i = 0; i < _maxFrameCount; i++)
            {
                _metadata[i] = default;
            }
        }
    }

    public TimeSpan GetBufferedDuration(int fps)
    {
        var frameCount = Count;
        var seconds = (double)frameCount / fps;
        return TimeSpan.FromSeconds(seconds);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        // Clear references to allow GC
        lock (_lock)
        {
            for (int i = 0; i < _maxFrameCount; i++)
            {
                _framePool[i] = null!;
            }
        }
    }
}
