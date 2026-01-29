using ClipVault.Core.Audio;

namespace ClipVault.Core.Buffer;

public sealed class AudioSampleBuffer : IDisposable
{
    private readonly CircularBuffer<Encoding.TimestampedAudio> _buffer;
    private readonly int _sampleRate;
    private readonly int _channels;
    private readonly int _bytesPerSample;
    private readonly int _maxDurationSeconds;
    private bool _disposed;

    public int Capacity => _buffer.Capacity;
    public int Count => _buffer.Count;

    public AudioSampleBuffer(int sampleRate, int channels, int maxDurationSeconds)
    {
        _sampleRate = sampleRate;
        _channels = channels;
        _bytesPerSample = sizeof(float);
        _maxDurationSeconds = maxDurationSeconds;

        var samplesPerSecond = sampleRate * channels;
        var bytesPerSecond = samplesPerSecond * _bytesPerSample;
        var totalBytes = bytesPerSecond * maxDurationSeconds;
        var sampleCount = totalBytes / _bytesPerSample;

        _buffer = new CircularBuffer<Encoding.TimestampedAudio>(sampleCount);
    }

    public void Add(byte[] data, long timestampTicks)
    {
        var audio = new Encoding.TimestampedAudio(data, timestampTicks, data.Length / sizeof(float));
        _buffer.Add(audio);
    }

    public Encoding.TimestampedAudio[] GetAll()
    {
        return _buffer.GetAll();
    }

    public void Clear()
    {
        _buffer.Clear();
    }

    public TimeSpan GetBufferedDuration()
    {
        var totalSamples = 0;
        foreach (var audio in _buffer.GetAll())
        {
            totalSamples += audio.SampleCount;
        }

        var totalSeconds = (double)totalSamples / (_sampleRate * _channels);
        return TimeSpan.FromSeconds(totalSeconds);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _buffer.Clear();
    }
}