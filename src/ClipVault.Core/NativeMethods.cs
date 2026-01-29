using System.Runtime.InteropServices;
using System.Text;

namespace ClipVault.Core;

public static class NativeMethods
{
    public const int HWND_BOTTOM = 1;
    public const int HWND_TOPMOST = -1;
    public const int HWND_NOTOPMOST = -2;
    public const int HWND_TOP = 0;

    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_SHIFT = 0x0004;
    public const uint MOD_WIN = 0x0008;

    public const uint WM_HOTKEY = 0x0312;

    public static uint GetModifiers(string[] modifierStrings)
    {
        uint modifiers = 0;
        foreach (var mod in modifierStrings)
        {
            modifiers += mod.ToLowerInvariant() switch
            {
                "alt" => MOD_ALT,
                "ctrl" or "control" => MOD_CONTROL,
                "shift" => MOD_SHIFT,
                "win" or "windows" => MOD_WIN,
                _ => 0
            };
        }
        return modifiers;
    }

    public static uint GetKeyCode(string keyString)
    {
        return keyString.ToUpperInvariant() switch
        {
            "F1" => VK_F1,
            "F2" => VK_F2,
            "F3" => VK_F3,
            "F4" => VK_F4,
            "F5" => VK_F5,
            "F6" => VK_F6,
            "F7" => VK_F7,
            "F8" => VK_F8,
            "F9" => VK_F9,
            "F10" => VK_F10,
            "F11" => VK_F11,
            "F12" => VK_F12,
            "A" => 'A',
            "B" => 'B',
            "C" => 'C',
            "D" => 'D',
            "E" => 'E',
            "F" => 'F',
            "G" => 'G',
            "H" => 'H',
            "I" => 'I',
            "J" => 'J',
            "K" => 'K',
            "L" => 'L',
            "M" => 'M',
            "N" => 'N',
            "O" => 'O',
            "P" => 'P',
            "Q" => 'Q',
            "R" => 'R',
            "S" => 'S',
            "T" => 'T',
            "U" => 'U',
            "V" => 'V',
            "W" => 'W',
            "X" => 'X',
            "Y" => 'Y',
            "Z" => 'Z',
            "0" => '0',
            "1" => '1',
            "2" => '2',
            "3" => '3',
            "4" => '4',
            "5" => '5',
            "6" => '6',
            "7" => '7',
            "8" => '8',
            "9" => '9',
            _ => 0
        };
    }

    private const int VK_F1 = 0x70;
    private const int VK_F2 = 0x71;
    private const int VK_F3 = 0x72;
    private const int VK_F4 = 0x73;
    private const int VK_F5 = 0x74;
    private const int VK_F6 = 0x75;
    private const int VK_F7 = 0x76;
    private const int VK_F8 = 0x77;
    private const int VK_F9 = 0x78;
    private const int VK_F10 = 0x79;
    private const int VK_F11 = 0x7A;
    private const int VK_F12 = 0x7B;

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpWindowText, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("kernel32.dll")]
    public static extern IntPtr OpenProcess(ProcessAccessFlags dwDesiredAccess, bool bInheritHandle, int dwProcessId);

    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("psapi.dll")]
    public static extern int EnumProcesses(int[] lpidProcess, int cb, out int lpcbNeeded);

    [DllImport("psapi.dll", SetLastError = true)]
    public static extern int GetProcessImageFileName(IntPtr hProcess, StringBuilder lpImageFileName, int nSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern bool QueryPerformanceCounter(out long lpPerformanceCount);

    [DllImport("kernel32.dll")]
    public static extern bool QueryPerformanceFrequency(out long lpFrequency);

    public static int GetProcessIdFromWindow(IntPtr hWnd)
    {
        GetWindowThreadProcessId(hWnd, out int processId);
        return processId;
    }

    public static string? GetWindowTitle(IntPtr hWnd)
    {
        var length = GetWindowTextLength(hWnd);
        if (length == 0) return null;

        var sb = new StringBuilder(length + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    public static int[] GetRunningProcessIds()
    {
        var processes = new int[1024];
        EnumProcesses(processes, processes.Length * sizeof(int), out var bytesNeeded);

        var count = bytesNeeded / sizeof(int);
        var result = new int[count];
        Array.Copy(processes, result, count);
        return result;
    }

    public static string? GetProcessPath(int processId)
    {
        var hProcess = OpenProcess(ProcessAccessFlags.PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
        if (hProcess == IntPtr.Zero) return null;

        try
        {
            var sb = new StringBuilder(1024);
            if (GetProcessImageFileName(hProcess, sb, sb.Capacity) > 0)
            {
                return sb.ToString();
            }
        }
        finally
        {
            CloseHandle(hProcess);
        }

        return null;
    }

    public static string? GetProcessName(int processId)
    {
        var path = GetProcessPath(processId);
        return path != null ? Path.GetFileNameWithoutExtension(path) : null;
    }

    public static long GetHighResolutionTimestamp()
    {
        QueryPerformanceCounter(out long counter);
        return counter;
    }

    public static double TimestampToSeconds(long ticks)
    {
        QueryPerformanceFrequency(out long frequency);
        return (double)ticks / frequency;
    }
}

[Flags]
public enum ProcessAccessFlags
{
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000,
    PROCESS_VM_READ = 0x0010
}