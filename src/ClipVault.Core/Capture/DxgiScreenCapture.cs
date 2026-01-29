using System.Runtime.InteropServices;
using Vortice.Direct3D11;
using Vortice.DXGI;

namespace ClipVault.Core.Capture;

/// <summary>
/// GPU-accelerated screen capture using DXGI Desktop Duplication.
/// Supports 1080p60, 1080p144, 1440p60, etc. with minimal CPU overhead.
/// </summary>
public sealed class DxgiScreenCapture : IScreenCapture, IDisposable
{
    private ID3D11Device? _device;
    private ID3D11DeviceContext? _context;
    private IDXGIOutputDuplication? _duplication;
    private ID3D11Texture2D? _stagingTexture;
    
    private byte[]? _frameBuffer;
    private bool _isCapturing;
    private bool _disposed;
    private int _targetWidth;
    private int _targetHeight;
    private int _targetFps;
    private int _frameCount;
    
    public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    public bool IsCapturing => _isCapturing;
    public int TargetWidth => _targetWidth;
    public int TargetHeight => _targetHeight;

    public DxgiScreenCapture(int targetWidth = 1920, int targetHeight = 1080, int targetFps = 60)
    {
        _targetWidth = targetWidth;
        _targetHeight = targetHeight;
        _targetFps = targetFps;
    }

    public static bool IsSupported()
    {
        IDXGIOutput? output = null;
        IDXGIAdapter? adapter = null;

        try
        {
            // Try to create a device
            using var device = D3D11.D3D11CreateDevice(
                Vortice.Direct3D.DriverType.Hardware,
                DeviceCreationFlags.None);

            if (device == null) return false;

            using var dxgiDevice = device.QueryInterface<IDXGIDevice>();
            if (dxgiDevice == null) return false;

            adapter = dxgiDevice.GetAdapter();
            if (adapter == null) return false;

            // Vortice API: EnumOutputs uses out parameter
            var result = adapter.EnumOutputs(0, out output);
            if (result.Failure || output == null) return false;

            // Test if we can create desktop duplication
            using var output1 = output.QueryInterface<IDXGIOutput1>();
            if (output1 != null)
            {
                using var dup = output1.DuplicateOutput(device);
                return dup != null;
            }

            return false;
        }
        catch (Exception ex)
        {
            Logger.Debug($"DXGI not supported: {ex.Message}");
            return false;
        }
        finally
        {
            output?.Dispose();
            adapter?.Dispose();
        }
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_isCapturing)
            return Task.CompletedTask;

        try
        {
            InitializeDxgi();
            _isCapturing = true;
            
            _ = Task.Run(async () => await CaptureLoopAsync(cancellationToken), cancellationToken);
            
            Logger.Info($"DXGI capture started: {_targetWidth}x{_targetHeight}@{_targetFps}fps");
        }
        catch (Exception ex)
        {
            Logger.Error("Failed to initialize DXGI capture", ex);
            throw;
        }

        return Task.CompletedTask;
    }

    private void InitializeDxgi()
    {
        IDXGIOutput? output = null;
        IDXGIAdapter? adapter = null;

        try
        {
            // Create D3D11 device
            _device = D3D11.D3D11CreateDevice(
                Vortice.Direct3D.DriverType.Hardware,
                DeviceCreationFlags.None);

            if (_device == null)
                throw new InvalidOperationException("Failed to create D3D11 device");

            _context = _device.ImmediateContext;

            // Get DXGI device
            using var dxgiDevice = _device.QueryInterface<IDXGIDevice>();
            if (dxgiDevice == null)
                throw new InvalidOperationException("Failed to get DXGI device");

            // Get adapter
            adapter = dxgiDevice.GetAdapter();
            if (adapter == null)
                throw new InvalidOperationException("Failed to get DXGI adapter");

            // Get primary output
            var result = adapter.EnumOutputs(0, out output);
            if (result.Failure || output == null)
                throw new InvalidOperationException($"Failed to enumerate outputs: {result}");

            // Get output description
            var outputDesc = output.Description;
            int displayWidth = outputDesc.DesktopCoordinates.Right - outputDesc.DesktopCoordinates.Left;
            int displayHeight = outputDesc.DesktopCoordinates.Bottom - outputDesc.DesktopCoordinates.Top;
            Logger.Debug($"DXGI Output: {displayWidth}x{displayHeight}");

            // Create desktop duplication
            using var output1 = output.QueryInterface<IDXGIOutput1>();
            if (output1 == null)
                throw new InvalidOperationException("Failed to get IDXGIOutput1");

            _duplication = output1.DuplicateOutput(_device);
            if (_duplication == null)
                throw new InvalidOperationException("Failed to create desktop duplication");

            // Create staging texture for CPU read
            var stagingDesc = new Texture2DDescription
            {
                Width = (uint)_targetWidth,
                Height = (uint)_targetHeight,
                MipLevels = 1,
                ArraySize = 1,
                Format = Format.B8G8R8A8_UNorm,
                SampleDescription = new SampleDescription(1, 0),
                Usage = ResourceUsage.Staging,
                BindFlags = BindFlags.None,
                CPUAccessFlags = CpuAccessFlags.Read,
                MiscFlags = ResourceOptionFlags.None
            };
            _stagingTexture = _device.CreateTexture2D(stagingDesc);

            _frameBuffer = new byte[_targetWidth * _targetHeight * 4];
        }
        finally
        {
            output?.Dispose();
            adapter?.Dispose();
        }
    }

    private async Task CaptureLoopAsync(CancellationToken ct)
    {
        var targetFrameTimeMs = 1000.0 / _targetFps;
        var targetFrameTimeTicks = (long)(targetFrameTimeMs * System.Diagnostics.Stopwatch.Frequency / 1000.0);
        var fpsStopwatch = System.Diagnostics.Stopwatch.StartNew();
        var logInterval = _targetFps * 5;
        var lastFrameTime = System.Diagnostics.Stopwatch.GetTimestamp();

        while (_isCapturing && !ct.IsCancellationRequested)
        {
            try
            {
                var captured = CaptureFrame();

                if (captured)
                {
                    _frameCount++;
                    if (_frameCount % logInterval == 0)
                    {
                        var actualFps = _frameCount / fpsStopwatch.Elapsed.TotalSeconds;
                        Logger.Debug($"DXGI Capture FPS: {actualFps:F1} (target: {_targetFps})");
                    }
                }

                // High-precision timing: sleep most of the time, then spin for accuracy
                var now = System.Diagnostics.Stopwatch.GetTimestamp();
                var elapsed = now - lastFrameTime;
                var remaining = targetFrameTimeTicks - elapsed;

                if (remaining > 0)
                {
                    // Sleep for most of the wait time (leave 2ms for spin)
                    var sleepTicks = remaining - (2 * System.Diagnostics.Stopwatch.Frequency / 1000);
                    if (sleepTicks > 0)
                    {
                        var sleepMs = (int)(sleepTicks * 1000 / System.Diagnostics.Stopwatch.Frequency);
                        if (sleepMs > 0)
                            await Task.Delay(sleepMs, ct);
                    }

                    // Spin-wait for the final precision
                    while (System.Diagnostics.Stopwatch.GetTimestamp() - lastFrameTime < targetFrameTimeTicks)
                    {
                        Thread.SpinWait(10);
                    }
                }

                lastFrameTime = System.Diagnostics.Stopwatch.GetTimestamp();
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                Logger.Debug($"DXGI capture error: {ex.Message}");
                await Task.Delay(16, ct);
                lastFrameTime = System.Diagnostics.Stopwatch.GetTimestamp();
            }
        }
    }

    private bool CaptureFrame()
    {
        if (_disposed || _duplication == null || _device == null || _context == null || _stagingTexture == null || _frameBuffer == null)
            return false;

        try
        {
            // Acquire next frame with 0 timeout (non-blocking)
            var result = _duplication.AcquireNextFrame(0, out var frameInfo, out var desktopResource);
            
            if (result.Code == Vortice.DXGI.ResultCode.WaitTimeout.Code)
                return false; // No new frame available

            if (result.Failure)
            {
                Logger.Debug($"AcquireNextFrame failed: {result}");
                return false;
            }

            try
            {
                if (desktopResource == null)
                    return false;

                using var texture = desktopResource.QueryInterface<ID3D11Texture2D>();
                if (texture == null)
                    return false;

                // Copy to staging texture for CPU access
                _context.CopyResource(_stagingTexture, texture);

                // Map the staging texture to read pixels
                var mapped = _context.Map(_stagingTexture, 0, MapMode.Read, Vortice.Direct3D11.MapFlags.None);
                try
                {
                    // Copy to our frame buffer
                    CopyFromMappedResource(mapped, _frameBuffer, _targetWidth, _targetHeight);

                    _frameCount++;

                    // Fire event with frame data
                    var args = new FrameCapturedEventArgs
                    {
                        TexturePointer = Marshal.UnsafeAddrOfPinnedArrayElement(_frameBuffer, 0),
                        TimestampTicks = NativeMethods.GetHighResolutionTimestamp(),
                        Width = _targetWidth,
                        Height = _targetHeight
                    };

                    FrameCaptured?.Invoke(this, args);
                    return true;
                }
                finally
                {
                    _context.Unmap(_stagingTexture, 0);
                }
            }
            finally
            {
                _duplication.ReleaseFrame();
                desktopResource?.Dispose();
            }
        }
        catch (Exception ex)
        {
            Logger.Debug($"Frame capture error: {ex.Message}");
            return false;
        }
    }

    private static unsafe void CopyFromMappedResource(MappedSubresource mapped, byte[] destination, int width, int height)
    {
        var srcPtr = (byte*)mapped.DataPointer;
        var rowPitch = mapped.RowPitch;
        var destRowPitch = width * 4;

        fixed (byte* dstPtr = destination)
        {
            for (int y = 0; y < height; y++)
            {
                var srcRow = srcPtr + (y * rowPitch);
                var dstRow = dstPtr + (y * destRowPitch);
                
                // Copy row using Buffer.MemoryCopy
                System.Buffer.MemoryCopy(srcRow, dstRow, destRowPitch, destRowPitch);
            }
        }
    }

    public Task StopAsync()
    {
        if (!_isCapturing)
            return Task.CompletedTask;

        _isCapturing = false;
        Logger.Info($"DXGI capture stopped. Total frames: {_frameCount}");
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));

        _stagingTexture?.Dispose();
        _duplication?.Dispose();
        _context?.Dispose();
        _device?.Dispose();
    }
}