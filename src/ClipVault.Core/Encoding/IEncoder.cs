namespace ClipVault.Core.Encoding;

/// <summary>
/// Interface for video/audio encoding.
/// Implementation: FFmpegEncoder with NVENC
/// </summary>
public interface IEncoder : IDisposable
{
    /// <summary>
    /// Encode buffered frames and audio to a video file.
    /// </summary>
    /// <param name="outputPath">Path to output MP4 file</param>
    /// <param name="videoFrames">Video frames with timestamps</param>
    /// <param name="systemAudio">System audio samples</param>
    /// <param name="micAudio">Microphone audio samples (optional)</param>
    /// <param name="settings">Encoding settings</param>
    /// <param name="progress">Progress callback (0.0 - 1.0)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task EncodeAsync(
        string outputPath,
        IReadOnlyList<TimestampedFrame> videoFrames,
        IReadOnlyList<TimestampedAudio> systemAudio,
        IReadOnlyList<TimestampedAudio>? micAudio,
        EncoderSettings settings,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// A video frame with capture timestamp.
/// Stores actual frame data (not just a pointer) so it survives buffer reuse.
/// </summary>
public sealed record TimestampedFrame(
    byte[] FrameData,
    long TimestampTicks,
    int Width,
    int Height);

/// <summary>
/// Audio samples with capture timestamp.
/// </summary>
public sealed record TimestampedAudio(
    byte[] Samples,
    long TimestampTicks,
    int SampleCount);

/// <summary>
/// Encoding settings.
/// </summary>
public sealed record EncoderSettings
{
    public required int Width { get; init; }
    public required int Height { get; init; }
    public required int Fps { get; init; }
    public required string NvencPreset { get; init; } // p1-p7 (p1=fastest, p7=slowest/best)
    public required string RateControl { get; init; } // cqp, cbr, vbr
    public required int CqLevel { get; init; } // 0-51 for CQP, lower = better quality
    public required int Bitrate { get; init; } // kbps for CBR/VBR (e.g., 8000 = 8Mbps)
    public required int AudioSampleRate { get; init; }
}
