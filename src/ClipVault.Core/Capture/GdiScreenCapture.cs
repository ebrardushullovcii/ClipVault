using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace ClipVault.Core.Capture;

/// <summary>
/// Optimized GDI-based screen capture with minimal allocations.
/// Pre-allocates buffers and reuses them to eliminate GC pressure.
/// </summary>
public sealed class GdiScreenCapture : IScreenCapture, IDisposable
{
    // Pre-allocated resources (reused every frame)
    private Bitmap? _targetBitmap;
    private Graphics? _targetGraphics;
    private Bitmap? _fullScreenBitmap;
    private Graphics? _fullScreenGraphics;
    private byte[]? _frameBuffer;

    // Configuration
    private int _targetWidth;
    private int _targetHeight;
    private int _sourceWidth;
    private int _sourceHeight;
    private int _targetFps;

    // State
    private bool _isCapturing;
    private bool _disposed;
    private long _frameCount;
    private readonly object _lock = new();

    public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    public bool IsCapturing => _isCapturing;
    public int TargetWidth => _targetWidth;
    public int TargetHeight => _targetHeight;

    public GdiScreenCapture(int targetWidth = 1920, int targetHeight = 1080, int targetFps = 60)
    {
        _targetWidth = targetWidth;
        _targetHeight = targetHeight;
        _targetFps = targetFps;
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

            Logger.Info($"GDI capture started: {_targetWidth}x{_targetHeight}@{_targetFps}fps");
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
        lock (_lock)
        {
            // Get source screen size
            var screen = Screen.PrimaryScreen;
            _sourceWidth = screen?.Bounds.Width ?? 1920;
            _sourceHeight = screen?.Bounds.Height ?? 1080;

            // Dispose old resources if any
            CleanupResources();

            // Target bitmap for scaled output (720p/1080p/etc)
            _targetBitmap = new Bitmap(_targetWidth, _targetHeight, PixelFormat.Format32bppRgb);
            _targetGraphics = Graphics.FromImage(_targetBitmap);
            _targetGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
            _targetGraphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            _targetGraphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighSpeed;
            _targetGraphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;

            // Full-screen bitmap for capturing (reused every frame)
            _fullScreenBitmap = new Bitmap(_sourceWidth, _sourceHeight, PixelFormat.Format32bppRgb);
            _fullScreenGraphics = Graphics.FromImage(_fullScreenBitmap);
            _fullScreenGraphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;

            // Frame buffer for raw pixel data
            _frameBuffer = new byte[_targetWidth * _targetHeight * 4];

            Logger.Debug($"Capture initialized: {_sourceWidth}x{_sourceHeight} -> {_targetWidth}x{_targetHeight}");
        }
    }

    private void CleanupResources()
    {
        _targetGraphics?.Dispose();
        _targetBitmap?.Dispose();
        _fullScreenGraphics?.Dispose();
        _fullScreenBitmap?.Dispose();

        _targetGraphics = null;
        _targetBitmap = null;
        _fullScreenGraphics = null;
        _fullScreenBitmap = null;
    }

    private async Task CaptureLoopAsync(CancellationToken ct)
    {
        var targetFrameTime = 1000.0 / _targetFps;
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var frameCounter = 0;
        var logInterval = _targetFps * 5; // Log every 5 seconds

        while (_isCapturing && !ct.IsCancellationRequested)
        {
            try
            {
                var captured = CaptureFrame();

                if (captured)
                {
                    frameCounter++;
                    if (frameCounter % logInterval == 0)
                    {
                        var actualFps = frameCounter / sw.Elapsed.TotalSeconds;
                        Logger.Debug($"Capture FPS: {actualFps:F1} (target: {_targetFps})");
                    }

                    var elapsed = sw.ElapsedMilliseconds;
                    var sleepMs = Math.Max(1, (int)(targetFrameTime - elapsed));
                    if (sleepMs > 0)
                        await Task.Delay(sleepMs, ct);

                    sw.Restart();
                    if (frameCounter >= logInterval)
                        frameCounter = 0;
                }
                else
                {
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

    private bool CaptureFrame()
    {
        try
        {
            lock (_lock)
            {
                if (_targetGraphics == null || _targetBitmap == null || _fullScreenBitmap == null || _frameBuffer == null)
                    return false;

                // Capture full screen (reuse bitmap - NO ALLOCATION!)
                _fullScreenGraphics!.CopyFromScreen(
                    0, 0, 0, 0,
                    new Size(_sourceWidth, _sourceHeight),
                    CopyPixelOperation.SourceCopy);

                // Scale to target resolution (reuse graphics object)
                _targetGraphics.DrawImage(
                    _fullScreenBitmap,
                    0, 0, _targetWidth, _targetHeight);

                // Lock bits and copy to frame buffer
                var rect = new Rectangle(0, 0, _targetWidth, _targetHeight);
                var bitmapData = _targetBitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);

                try
                {
                    var sourcePtr = bitmapData.Scan0;
                    var destPtr = Marshal.UnsafeAddrOfPinnedArrayElement(_frameBuffer, 0);

                    // Fast row-by-row copy
                    for (int y = 0; y < _targetHeight; y++)
                    {
                        var srcRow = IntPtr.Add(sourcePtr, y * bitmapData.Stride);
                        var dstRow = IntPtr.Add(destPtr, y * _targetWidth * 4);
                        RtlCopyMemory(dstRow, srcRow, (uint)(_targetWidth * 4));
                    }

                    Interlocked.Increment(ref _frameCount);

                    var args = new FrameCapturedEventArgs
                    {
                        TexturePointer = destPtr,
                        TimestampTicks = NativeMethods.GetHighResolutionTimestamp(),
                        Width = _targetWidth,
                        Height = _targetHeight
                    };

                    FrameCaptured?.Invoke(this, args);
                }
                finally
                {
                    _targetBitmap.UnlockBits(bitmapData);
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            Logger.Debug($"Frame capture failed: {ex.Message}");
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

        Logger.Info($"GDI capture stopped. Total frames: {_frameCount}");
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));

        lock (_lock)
        {
            CleanupResources();
            _frameBuffer = null;
        }
    }
}