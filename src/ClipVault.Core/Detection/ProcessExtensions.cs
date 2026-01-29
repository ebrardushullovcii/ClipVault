using System.Diagnostics;

namespace ClipVault.Core.Detection;

public static class ProcessExtensions
{
    public static bool HasExited(this Process process)
    {
        try
        {
            _ = process.MainModule;
            return process.HasExited;
        }
        catch
        {
            return true;
        }
    }
}