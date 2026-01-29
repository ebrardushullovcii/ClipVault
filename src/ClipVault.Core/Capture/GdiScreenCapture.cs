using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ClipVault.Core.Capture;

public sealed class GdiScreenCapture : IScreenCapture, IDisposable
{
    private Bitmap? _screenBitmap;
    private Graphics? _graphics;
    private bool _isCapturing;
    private bool _disposed;
    private int _frameCount;
    private int _width;
    private int _height;
    private byte[]? _frameBuffer;
    private readonly object _lock = new();

    public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    public bool IsCapturing => _isCapturing;

    public GdiScreenCapture()
    {
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_isCapturing)
            return Task.CompletedTask;

        try
        {
            InitializeCapture();
            _frameCount = 0;
            _isCapturing = true;

            _ = Task.Run(async () =>
            {
                await CaptureLoopAsync(cancellationToken);
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            Logger.Error("Failed to initialize GDI capture", ex);
            throw;
        }

        return Task.CompletedTask;
    }

    private void InitializeCapture()
    {
        _width = 1280;
        _height = 720;

        _screenBitmap = new Bitmap(_width, _height, PixelFormat.Format32bppRgb);
        _graphics = Graphics.FromImage(_screenBitmap);
        _frameBuffer = new byte[_width * _height * 4];
    }

    private async Task CaptureLoopAsync(CancellationToken ct)
    {
        var targetFrameTime = 1000.0 / 30; // 30 FPS for lower memory usage
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var retryCount = 0;
        const int maxRetries = 5;

        while (_isCapturing && !ct.IsCancellationRequested)
        {
            try
            {
                var captured = CaptureFrame();

                if (captured)
                {
                    retryCount = 0;

                    var elapsed = sw.ElapsedMilliseconds;
                    var sleepMs = Math.Max(1, (int)(targetFrameTime - elapsed));
                    if (sleepMs > 0)
                        await Task.Delay(sleepMs, ct);

                    sw.Restart();
                }
                else
                {
                    retryCount++;
                    if (retryCount >= maxRetries)
                    {
                        ReinitializeCapture();
                        retryCount = 0;
                    }
                    await Task.Delay(16, ct);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                Logger.Debug($"Capture error: {ex.Message}");
                await Task.Delay(16, ct);
            }
        }
    }

    private void ReinitializeCapture()
    {
        lock (_lock)
        {
            _graphics?.Dispose();
            _screenBitmap?.Dispose();

            _screenBitmap = new Bitmap(_width, _height, PixelFormat.Format32bppRgb);
            _graphics = Graphics.FromImage(_screenBitmap);
        }
    }

    private bool CaptureFrame()
    {
        try
        {
            lock (_lock)
            {
                if (_graphics == null || _screenBitmap == null)
                    return false;

                // Get actual screen size and scale down to our target resolution
                var screen = Screen.PrimaryScreen;
                var screenWidth = screen?.Bounds.Width ?? 1920;
                var screenHeight = screen?.Bounds.Height ?? 1080;

                // Capture full screen and scale to 720p
                using var fullScreen = new Bitmap(screenWidth, screenHeight, PixelFormat.Format32bppRgb);
                using var fullGraphics = Graphics.FromImage(fullScreen);
                fullGraphics.CopyFromScreen(0, 0, 0, 0, new Size(screenWidth, screenHeight), CopyPixelOperation.SourceCopy);

                // Scale down to target resolution
                _graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
                _graphics.DrawImage(fullScreen, 0, 0, _width, _height);

                var rect = new Rectangle(0, 0, _width, _height);
                var bitmapData = _screenBitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);

                try
                {
                    var sourcePtr = bitmapData.Scan0;
                    var destPtr = Marshal.UnsafeAddrOfPinnedArrayElement(_frameBuffer!, 0);

                    for (int y = 0; y < _height; y++)
                    {
                        var srcRow = IntPtr.Add(sourcePtr, y * bitmapData.Stride);
                        var dstRow = IntPtr.Add(destPtr, y * _width * 4);
                        RtlCopyMemory(dstRow, srcRow, (uint)(_width * 4));
                    }

                    _frameCount++;

                    var args = new FrameCapturedEventArgs
                    {
                        TexturePointer = Marshal.UnsafeAddrOfPinnedArrayElement(_frameBuffer!, 0),
                        TimestampTicks = NativeMethods.GetHighResolutionTimestamp(),
                        Width = _width,
                        Height = _height
                    };

                    FrameCaptured?.Invoke(this, args);
                }
                finally
                {
                    _screenBitmap.UnlockBits(bitmapData);
                }
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    [DllImport("kernel32.dll", EntryPoint = "RtlCopyMemory", SetLastError = false)]
    private static extern void RtlCopyMemory(IntPtr dest, IntPtr src, uint length);

    public Task StopAsync()
    {
        if (!_isCapturing)
            return Task.CompletedTask;

        lock (_lock)
        {
            if (!_isCapturing)
                return Task.CompletedTask;

            _isCapturing = false;
        }

        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));

        _graphics?.Dispose();
        _screenBitmap?.Dispose();
    }
}