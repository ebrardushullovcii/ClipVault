using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using ClipVault.Core;
using ClipVault.Core.Configuration;

namespace ClipVault.Service;

public sealed class HotkeyManager : NativeWindow, IDisposable
{
    private readonly HotkeySettings _settings;
    private int _hotkeyId;
    private bool _registered;
    private bool _disposed;

    public event EventHandler? HotkeyPressed;

    public HotkeyManager(Form window, HotkeySettings settings)
    {
        _settings = settings;
        var handle = window.Handle;
        Console.WriteLine($"[DEBUG] HotkeyManager: Form handle is 0x{handle:X}");
        AssignHandle(handle);
    }

    public bool Register()
    {
        if (_registered)
            return true;

        var modifiers = Core.NativeMethods.GetModifiers(_settings.Modifiers);
        var keyCode = Core.NativeMethods.GetKeyCode(_settings.Key);

        if (keyCode == 0)
        {
            Logger.Warning($"Invalid hotkey key: {_settings.Key}");
            return false;
        }

        _hotkeyId = 1;
        _registered = Core.NativeMethods.RegisterHotKey(Handle, _hotkeyId, modifiers, keyCode);

        if (!_registered)
        {
            var error = Marshal.GetLastWin32Error();
            Logger.Warning($"Failed to register hotkey (error {error}): {string.Join("+", _settings.Modifiers)}+{_settings.Key}");
        }
        else
        {
            Logger.Info($"Hotkey registered: {string.Join("+", _settings.Modifiers)}+{_settings.Key}");
        }

        return _registered;
    }

    public void Unregister()
    {
        if (!_registered) return;

        Core.NativeMethods.UnregisterHotKey(Handle, _hotkeyId);
        _registered = false;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Core.NativeMethods.WM_HOTKEY)
        {
            Logger.Debug("WM_HOTKEY message received");
            HotkeyPressed?.Invoke(this, EventArgs.Empty);
        }

        base.WndProc(ref m);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        Unregister();
    }
}