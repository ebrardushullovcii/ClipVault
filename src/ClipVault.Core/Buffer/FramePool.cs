using System.Runtime.InteropServices;

namespace ClipVault.Core.Buffer;

/// <summary>
/// Object pool for frame buffers to eliminate GC pressure.
/// Uses a lock-free stack for fast allocation/deallocation.
/// </summary>
public sealed class FramePool : IDisposable
{
    private readonly int _frameSize;
    private readonly int _maxPoolSize;
    private readonly Stack<byte[]> _pool;
    private readonly object _lock = new();
    private int _allocatedCount;
    private bool _disposed;

    public int FrameSize => _frameSize;
    public int PooledCount { get { lock (_lock) return _pool.Count; } }
    public int AllocatedCount => _allocatedCount;

    public FramePool(int width, int height, int maxPoolSize = 32)
    {
        _frameSize = width * height * 4; // BGRA
        _maxPoolSize = maxPoolSize;
        _pool = new Stack<byte[]>(maxPoolSize);
    }

    /// <summary>
    /// Rent a frame buffer from the pool. Creates new if none available.
    /// </summary>
    public byte[] Rent()
    {
        lock (_lock)
        {
            if (_pool.Count > 0)
            {
                return _pool.Pop();
            }
        }

        Interlocked.Increment(ref _allocatedCount);
        return new byte[_frameSize];
    }

    /// <summary>
    /// Return a frame buffer to the pool for reuse.
    /// </summary>
    public void Return(byte[] buffer)
    {
        if (buffer == null || buffer.Length != _frameSize)
            return;

        lock (_lock)
        {
            if (_pool.Count < _maxPoolSize && !_disposed)
            {
                _pool.Push(buffer);
            }
            else
            {
                Interlocked.Decrement(ref _allocatedCount);
            }
        }
    }

    /// <summary>
    /// Pre-allocate buffers to warm up the pool.
    /// </summary>
    public void Prewarm(int count)
    {
        count = Math.Min(count, _maxPoolSize);
        
        lock (_lock)
        {
            for (int i = 0; i < count && _pool.Count < _maxPoolSize; i++)
            {
                _pool.Push(new byte[_frameSize]);
                Interlocked.Increment(ref _allocatedCount);
            }
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        lock (_lock)
        {
            _pool.Clear();
        }
    }
}