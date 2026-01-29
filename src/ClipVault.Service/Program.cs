using System.Windows.Forms;

namespace ClipVault.Service;

internal static class Program
{
    private static NotifyIcon? _trayIcon;
    private static ContextMenuStrip? _trayMenu;
    private static ClipVaultService? _service;
    private static readonly string LogFile = Path.Combine(AppContext.BaseDirectory, "logs", $"clipvault_{DateTime.Now:yyyy-MM-dd_HH-mm-ss}.log");

    [STAThread]
    static void Main()
    {
        WriteStartupLog("=== ClipVault Starting ===");
        WriteStartupLog($"Runtime: {Environment.Version}");
        WriteStartupLog($"OS: {Environment.OSVersion}");
        WriteStartupLog($"BasePath: {AppContext.BaseDirectory}");

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogFile)!);

            WriteStartupLog("Initializing Windows Forms...");
            ApplicationConfiguration.Initialize();

            WriteStartupLog("Creating tray icon...");
            CreateTrayIcon();

            WriteStartupLog("Creating ClipVaultService...");
            var basePath = AppContext.BaseDirectory;
            _service = new ClipVaultService(basePath, _trayIcon!, _trayMenu!);

            WriteStartupLog("Calling Initialize()...");
            _service.Initialize();

            WriteStartupLog("Starting Application.Run()...");
            Application.ApplicationExit += (_, _) =>
            {
                WriteStartupLog("Application exiting");
            };
            Application.Run();
        }
        catch (Exception ex)
        {
            WriteStartupLog($"FATAL EXCEPTION: {ex.Message}");
            WriteStartupLog($"Stack: {ex.StackTrace}");
            MessageBox.Show($"Error: {ex.Message}\n\nCheck logs at: {LogFile}", "ClipVault Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void WriteStartupLog(string message)
    {
        var line = $"[{DateTime.Now:HH:mm:ss.fff}] {message}";
        Console.WriteLine(line);
        try
        {
            File.AppendAllText(LogFile, line + Environment.NewLine);
        }
        catch
        {
        }
    }

    private static void CreateTrayIcon()
    {
        WriteStartupLog("Creating menu strip...");
        _trayMenu = new ContextMenuStrip();

        WriteStartupLog("Creating notify icon...");
        _trayIcon = new NotifyIcon
        {
            Icon = new System.Drawing.Icon(System.Drawing.SystemIcons.Application, 32, 32),
            Text = "ClipVault - Running",
            ContextMenuStrip = _trayMenu,
            Visible = true
        };

        WriteStartupLog("Tray icon created and visible");
    }
}