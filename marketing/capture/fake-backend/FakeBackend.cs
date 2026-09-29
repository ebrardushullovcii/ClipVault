// Stand-in for bin/ClipVault.exe during marketing captures.
// It never records anything: it reports a ready capture state and exits
// when the Electron app that spawned it goes away.
using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Threading;

class FakeBackend
{
    static int ParentPid()
    {
        int self = Process.GetCurrentProcess().Id;
        using (var search = new ManagementObjectSearcher(
            "SELECT ParentProcessId FROM Win32_Process WHERE ProcessId = " + self))
        {
            foreach (ManagementObject row in search.Get())
                return Convert.ToInt32(row["ParentProcessId"]);
        }
        return -1;
    }

    static bool Alive(int pid)
    {
        try { return !Process.GetProcessById(pid).HasExited; }
        catch { return false; }
    }

    static int Main(string[] args)
    {
        string game = Environment.GetEnvironmentVariable("CLIPVAULT_FAKE_GAME") ?? "Neon Drift";
        int parent = ParentPid();
        try
        {
            var stdout = new StreamWriter(Console.OpenStandardOutput());
            stdout.AutoFlush = true;
            stdout.WriteLine("[CAPTURE_STATE]ready");
            stdout.WriteLine("[CAPTURE_GAME]" + game);
            while (parent < 0 || Alive(parent))
                Thread.Sleep(1000);
        }
        catch (IOException) { }
        return 0;
    }
}
