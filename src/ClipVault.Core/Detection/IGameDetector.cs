namespace ClipVault.Core.Detection;

public interface IGameDetector : IDisposable
{
    event EventHandler<GameDetectedEventArgs>? GameDetected;
    event EventHandler<GameLostEventArgs>? GameLost;
    DetectedGame? CurrentGame { get; }
    Task StartAsync(CancellationToken cancellationToken = default);
    Task StopAsync();
}

public sealed class GameDetectedEventArgs : EventArgs
{
    public required DetectedGame Game { get; init; }
}

public sealed class GameLostEventArgs : EventArgs
{
    public required string GameName { get; init; }
    public required GameLostReason Reason { get; init; }
}

public enum GameLostReason
{
    ProcessExited,
    LostFocus
}

public sealed record DetectedGame(
    string Name,
    int ProcessId,
    nint WindowHandle,
    string? TwitchId
);