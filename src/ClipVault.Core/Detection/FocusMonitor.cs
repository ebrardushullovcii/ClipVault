using ClipVault.Core;

namespace ClipVault.Core.Detection;

/// <summary>
/// Monitors the foreground window to detect game focus changes.
/// </summary>
public sealed class FocusMonitor : IDisposable
{
    private readonly Action<nint, int> _onFocusChanged;
    private readonly CancellationTokenSource _cts = new();
    private Task? _monitorTask;
    private int _lastProcessId;
    private bool _disposed;

    public FocusMonitor(Action<nint, int> onFocusChanged)
    {
        _onFocusChanged = onFocusChanged;
    }

    public void Start()
    {
        _cts.CancelAfter(-1);
        _monitorTask = Task.Run(MonitorForegroundWindowAsync);
    }

    public void Stop()
    {
        _cts.Cancel();
        _monitorTask?.Wait(TimeSpan.FromSeconds(1));
    }

    private async Task MonitorForegroundWindowAsync()
    {
        while (!_cts.Token.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(100, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            var hwnd = Core.NativeMethods.GetForegroundWindow();
            if (hwnd == IntPtr.Zero)
                continue;

            var processId = Core.NativeMethods.GetProcessIdFromWindow(hwnd);

            if (processId != 0 && processId != _lastProcessId)
            {
                _lastProcessId = processId;
                _onFocusChanged(hwnd, processId);
            }
        }
    }

    public static (nint WindowHandle, int ProcessId) GetCurrentFocus()
    {
        var hwnd = Core.NativeMethods.GetForegroundWindow();
        var processId = Core.NativeMethods.GetProcessIdFromWindow(hwnd);
        return (hwnd, processId);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        Stop();
        _cts.Dispose();
    }
}