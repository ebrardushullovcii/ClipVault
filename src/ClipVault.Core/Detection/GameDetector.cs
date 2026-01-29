using System.Diagnostics;
using System.Runtime.InteropServices;
using ClipVault.Core;
using ClipVault.Core.Configuration;

namespace ClipVault.Core.Detection;

public sealed class GameDetector : IGameDetector
{
    private readonly GameDatabase _gameDatabase;
    private readonly FocusMonitor _focusMonitor;
    private readonly CancellationTokenSource _cts = new();
    private DetectedGame? _currentGame;
    private bool _disposed;

    public event EventHandler<GameDetectedEventArgs>? GameDetected;
    public event EventHandler<GameLostEventArgs>? GameLost;
    public DetectedGame? CurrentGame => _currentGame;

    public GameDetector(GameDatabase gameDatabase)
    {
        _gameDatabase = gameDatabase;
        _focusMonitor = new(OnFocusChanged);
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        _ = Task.Run(async () =>
        {
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token, cancellationToken);
            while (!linkedCts.Token.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(200, linkedCts.Token);
                    CheckForGameProcess();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        });

        _focusMonitor.Start();
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        _focusMonitor.Stop();
        _cts.Cancel();

        if (_currentGame != null)
        {
            var lostGame = _currentGame;
            _currentGame = null;
            GameLost?.Invoke(this, new GameLostEventArgs
            {
                GameName = lostGame.Name,
                Reason = GameLostReason.ProcessExited
            });
        }

        return Task.CompletedTask;
    }

    private void CheckForGameProcess()
    {
        if (_currentGame != null)
        {
            if (!ProcessExists(_currentGame.ProcessId))
            {
                HandleGameLost(GameLostReason.ProcessExited);
            }
            return;
        }

        var processIds = Core.NativeMethods.GetRunningProcessIds();

        foreach (var processId in processIds)
        {
            var processName = Core.NativeMethods.GetProcessName(processId);
            if (processName == null) continue;

            var game = _gameDatabase.FindGameByProcessName(processName);
            if (game == null) continue;

            var windowHandle = FindWindowForProcess(processId);
            if (windowHandle == IntPtr.Zero)
            {
                var allProcessIds = Core.NativeMethods.GetRunningProcessIds();
                foreach (var otherPid in allProcessIds)
                {
                    var name = Core.NativeMethods.GetProcessName(otherPid);
                    if (name != null && name.Equals("Code", StringComparison.OrdinalIgnoreCase))
                    {
                        var altHandle = FindWindowForProcess(otherPid);
                        if (altHandle != IntPtr.Zero)
                        {
                            windowHandle = altHandle;
                            var newPid = otherPid;
                            _currentGame = new DetectedGame(game.Name, newPid, windowHandle, game.TwitchId);
                            GameDetected?.Invoke(this, new GameDetectedEventArgs { Game = _currentGame });
                            return;
                        }
                    }
                }
            }

            if (windowHandle == IntPtr.Zero)
                continue;

            _currentGame = new DetectedGame(game.Name, processId, windowHandle, game.TwitchId);
            GameDetected?.Invoke(this, new GameDetectedEventArgs { Game = _currentGame });
            return;
        }
    }

    private void OnFocusChanged(nint windowHandle, int processId)
    {
        if (_currentGame == null) return;
        if (processId != _currentGame.ProcessId)
        {
            HandleGameLost(GameLostReason.LostFocus);
        }
    }

    private void HandleGameLost(GameLostReason reason)
    {
        if (_currentGame == null) return;

        var gameName = _currentGame.Name;
        _currentGame = null;

        GameLost?.Invoke(this, new GameLostEventArgs
        {
            GameName = gameName,
            Reason = reason
        });
    }

    private static bool ProcessExists(int processId)
    {
        try
        {
            var process = Process.GetProcessById(processId);
            return process != null && !process.HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static nint FindWindowForProcess(int processId)
    {
        var hwnds = new List<nint>();
        nint firstVisible = IntPtr.Zero;
        nint firstAny = IntPtr.Zero;

        EnumWindows((hwnd, _) =>
        {
            if (Core.NativeMethods.GetProcessIdFromWindow(hwnd) == processId)
            {
                if (firstAny == IntPtr.Zero)
                {
                    firstAny = hwnd;
                }

                if (Core.NativeMethods.IsWindowVisible(hwnd))
                {
                    hwnds.Add(hwnd);
                    if (firstVisible == IntPtr.Zero)
                    {
                        firstVisible = hwnd;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        var result = firstVisible != IntPtr.Zero ? firstVisible : firstAny;
        return result;
    }

    private delegate bool EnumResultsProc(nint hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumResultsProc lpEnumFunc, IntPtr lParam);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));
        _focusMonitor.Dispose();
        _cts.Dispose();
    }
}