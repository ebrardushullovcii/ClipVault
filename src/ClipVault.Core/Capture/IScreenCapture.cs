namespace ClipVault.Core.Capture;

/// <summary>
/// Interface for screen capture implementations.
/// Implementation: GdiScreenCapture (full screen GDI capture)
/// </summary>
public interface IScreenCapture : IDisposable
{
    /// <summary>
    /// Fired when a new frame is captured.
    /// </summary>
    event EventHandler<FrameCapturedEventArgs>? FrameCaptured;

    /// <summary>
    /// Whether capture is currently active.
    /// </summary>
    bool IsCapturing { get; }

    /// <summary>
    /// Start capturing frames.
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Stop capturing frames.
    /// </summary>
    Task StopAsync();
}

/// <summary>
/// Event args for captured frames.
/// </summary>
public sealed class FrameCapturedEventArgs : EventArgs
{
    public required nint TexturePointer { get; init; }
    public required long TimestampTicks { get; init; }
    public required int Width { get; init; }
    public required int Height { get; init; }
}
