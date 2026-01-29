namespace ClipVault.Core.Capture;

/// <summary>
/// Wrapper for GDI screen capture (placeholder for future Windows.Graphics.Capture API).
/// Currently delegates to GdiScreenCapture with configurable resolution.
/// </summary>
public sealed class WindowsGraphicsCapture : IScreenCapture
{
    private GdiScreenCapture? _gdiCapture;
    private bool _isCapturing;
    private bool _disposed;

    public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    public bool IsCapturing => _isCapturing;

    public WindowsGraphicsCapture(nint windowHandle, int targetWidth = 1920, int targetHeight = 1080, int targetFps = 60)
    {
        // Window handle is stored for future Windows.Graphics.Capture implementation
        // Currently using GDI which captures full screen
        _ = windowHandle;
        
        Logger.Debug($"Capture size: {targetWidth}x{targetHeight} (configured for quality)");
        _gdiCapture = new GdiScreenCapture(targetWidth, targetHeight, targetFps);
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_isCapturing)
            return Task.CompletedTask;

        if (_gdiCapture == null)
            throw new InvalidOperationException("Capture not initialized");

        _gdiCapture.FrameCaptured += (_, args) => FrameCaptured?.Invoke(this, args);
        _gdiCapture.StartAsync(cancellationToken).Wait(cancellationToken);
        _isCapturing = true;

        Logger.Debug("WindowsGraphicsCapture: Started");
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        if (!_isCapturing)
            return Task.CompletedTask;

        _isCapturing = false;
        _gdiCapture?.StopAsync().Wait(TimeSpan.FromSeconds(1));
        Logger.Debug("WindowsGraphicsCapture: Stopped");

        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));
        _gdiCapture?.Dispose();
        _gdiCapture = null;
    }
}