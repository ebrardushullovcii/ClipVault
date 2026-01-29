namespace ClipVault.Core.Capture;

public sealed class WindowsGraphicsCapture : IScreenCapture
{
    private GdiScreenCapture? _gdiCapture;
    private bool _isCapturing;
    private bool _disposed;

    public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    public bool IsCapturing => _isCapturing;

    public WindowsGraphicsCapture(nint windowHandle)
    {
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_isCapturing)
            return Task.CompletedTask;

        _gdiCapture = new GdiScreenCapture();
        _gdiCapture.FrameCaptured += (_, args) => FrameCaptured?.Invoke(this, args);
        _gdiCapture.StartAsync(cancellationToken).Wait(cancellationToken);
        _isCapturing = true;

        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        if (!_isCapturing)
            return Task.CompletedTask;

        _isCapturing = false;
        _gdiCapture?.StopAsync().Wait(TimeSpan.FromSeconds(1));
        _gdiCapture?.Dispose();
        _gdiCapture = null;

        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));
    }
}