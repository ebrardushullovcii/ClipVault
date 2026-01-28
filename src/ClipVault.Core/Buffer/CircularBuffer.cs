namespace ClipVault.Core.Buffer;

/// <summary>
/// Thread-safe circular buffer for storing timestamped data.
/// Used as base for VideoFrameBuffer and AudioSampleBuffer.
/// </summary>
/// <typeparam name="T">Type of items to store</typeparam>
public sealed class CircularBuffer<T> where T : class
{
    private readonly T?[] _buffer;
    private readonly object _lock = new();
    private int _writePosition;
    private int _count;

    public CircularBuffer(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        _buffer = new T?[capacity];
    }

    public int Capacity => _buffer.Length;
    public int Count { get { lock (_lock) return _count; } }

    /// <summary>
    /// Add an item to the buffer. Overwrites oldest if full.
    /// </summary>
    public void Add(T item)
    {
        lock (_lock)
        {
            _buffer[_writePosition] = item;
            _writePosition = (_writePosition + 1) % _buffer.Length;
            if (_count < _buffer.Length)
                _count++;
        }
    }

    /// <summary>
    /// Get all items in chronological order (oldest first).
    /// </summary>
    public T[] GetAll()
    {
        lock (_lock)
        {
            var result = new T[_count];
            if (_count == 0) return result;

            var startPos = _count < _buffer.Length
                ? 0
                : _writePosition;

            for (var i = 0; i < _count; i++)
            {
                var pos = (startPos + i) % _buffer.Length;
                result[i] = _buffer[pos]!;
            }

            return result;
        }
    }

    /// <summary>
    /// Clear the buffer.
    /// </summary>
    public void Clear()
    {
        lock (_lock)
        {
            Array.Clear(_buffer);
            _writePosition = 0;
            _count = 0;
        }
    }
}
