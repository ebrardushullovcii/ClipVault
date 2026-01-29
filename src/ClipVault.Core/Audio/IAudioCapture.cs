namespace ClipVault.Core.Audio;

/// <summary>
/// Interface for audio capture implementations.
/// Implementations: SystemAudioCapture (loopback), MicrophoneCapture
/// </summary>
public interface IAudioCapture : IDisposable
{
    /// <summary>
    /// Fired when audio data is available.
    /// </summary>
    event EventHandler<AudioDataEventArgs>? DataAvailable;

    /// <summary>
    /// The audio format (sample rate, channels, bits per sample).
    /// </summary>
    AudioFormat Format { get; }

    /// <summary>
    /// Whether capture is currently active.
    /// </summary>
    bool IsCapturing { get; }

    /// <summary>
    /// Start capturing audio.
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Stop capturing audio.
    /// </summary>
    Task StopAsync();
}

/// <summary>
/// Event args for audio data.
/// </summary>
public sealed class AudioDataEventArgs : EventArgs
{
    /// <summary>
    /// Audio samples in float32 format.
    /// IMPORTANT: Copy this data immediately - the buffer may be reused!
    /// </summary>
    public required byte[] Buffer { get; init; }

    public required long TimestampTicks { get; init; }
    public required int BytesRecorded { get; init; }
}

/// <summary>
/// Audio format specification.
/// </summary>
public sealed record AudioFormat(int SampleRate, int Channels, int BitsPerSample);
