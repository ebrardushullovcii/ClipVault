using System.Windows.Forms;

namespace ClipVault.Service;

internal static class Program
{
    private static NotifyIcon? _trayIcon;
    private static ContextMenuStrip? _trayMenu;

    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();

        CreateTrayIcon();

        Application.Run();
    }

    private static void CreateTrayIcon()
    {
        _trayMenu = new ContextMenuStrip();
        _trayMenu.Items.Add("Exit", null, OnExit);

        _trayIcon = new NotifyIcon
        {
            Icon = new System.Drawing.Icon(System.Drawing.SystemIcons.Application, 32, 32),
            Text = "ClipVault",
            ContextMenuStrip = _trayMenu,
            Visible = true
        };

        _trayIcon.DoubleClick += (sender, e) =>
        {
            Application.Exit();
        };
    }

    private static void OnExit(object? sender, EventArgs e)
    {
        _trayIcon?.Dispose();
        Application.Exit();
    }
}