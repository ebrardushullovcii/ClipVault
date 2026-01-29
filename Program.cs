using System.Windows.Forms;

namespace ClipVault;

internal static class Program
{
    private static NotifyIcon? _trayIcon;
    private static ContextMenuStrip? _trayMenu;
    private static Service.ClipVaultService? _service;

    [STAThread]
    static void Main()
    {
        Console.WriteLine("=== ClipVault Starting ===");
        Console.WriteLine($"Runtime: {Environment.Version}");
        Console.WriteLine($"OS: {Environment.OSVersion}");
        Console.WriteLine($"BasePath: {AppContext.BaseDirectory}");

        try
        {
            ApplicationConfiguration.Initialize();

            CreateTrayIcon();

            var basePath = AppContext.BaseDirectory;
            _service = new Service.ClipVaultService(basePath, _trayIcon!, _trayMenu!);

            _service.Initialize();

            Application.ApplicationExit += (_, _) =>
            {
                Console.WriteLine("Application exiting");
            };
            Application.Run();
        }
        catch (Exception ex)
        {
            var errorMsg = $"FATAL EXCEPTION: {ex.Message}";
            Console.WriteLine(errorMsg);
            Console.WriteLine($"Stack: {ex.StackTrace}");
            MessageBox.Show($"Error: {ex.Message}\n\nCheck logs in the logs/ folder.", "ClipVault Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void CreateTrayIcon()
    {
        _trayMenu = new ContextMenuStrip();

        _trayIcon = new NotifyIcon
        {
            Icon = new System.Drawing.Icon(System.Drawing.SystemIcons.Application, 32, 32),
            Text = "ClipVault - Running",
            ContextMenuStrip = _trayMenu,
            Visible = true
        };
    }
}