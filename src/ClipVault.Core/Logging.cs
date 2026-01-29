using System.Runtime.InteropServices;
using System.Text;

namespace ClipVault.Core;

public static class Logger
{
    private static string _logFile = null!;
    private static readonly object _lock = new();
    private static bool _initialized;

    public static void Initialize(string basePath)
    {
        try
        {
            var logPath = Path.Combine(basePath, "logs");
            Directory.CreateDirectory(logPath);

            _logFile = Path.Combine(logPath, "clipvault.log");

            _initialized = true;
            Info("=== ClipVault Started ===");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LOG ERROR] {ex.Message}");
        }
    }

    public static void Info(string message) => WriteLog("INFO", message);
    public static void Debug(string message) => WriteLog("DEBUG", message);
    public static void Warning(string message) => WriteLog("WARN", message);
    public static void Error(string message, Exception? ex = null) => WriteLog("ERROR", ex != null ? $"{message}: {ex.Message}" : message);

    private static void WriteLog(string level, string message)
    {
        lock (_lock)
        {
            var line = $"[{level}] [{DateTime.Now:HH:mm:ss.fff}] {message}";
            Console.WriteLine(line);

            if (_initialized)
            {
                try { File.AppendAllText(_logFile, line + Environment.NewLine); } catch { }
            }
        }
    }

    public static void GameDetected(string gameName, int processId, nint windowHandle) =>
        Info($"🎮 GAME FOCUSED: '{gameName}' (PID: {processId}, HWND: 0x{windowHandle:X})");

    public static void GameLost(string gameName, string reason) =>
        Debug($"Game focus lost: '{gameName}' - {reason}");

    public static void HotkeyPressed() =>
        Info($"⌨️  HOTKEY TRIGGERED");

    public static void CaptureStarted(string gameName) =>
        Info($"🔴 CAPTURE ACTIVE: '{gameName}'");

    public static void CaptureStopped(string gameName) =>
        Debug($"Capture session ended: '{gameName}'");

    public static void ClipSaved(string outputPath, double durationSeconds) =>
        Info($"💾 CLIP SAVED: {outputPath} ({durationSeconds:F1}s)");

    public static void AudioStarted(int sampleRate, int channels) =>
        Info($"🔊 AUDIO: {sampleRate}Hz, {channels}ch");

    public static void AudioFailed(string error) =>
        Warning($"❌ AUDIO FAILED: {error}");
}