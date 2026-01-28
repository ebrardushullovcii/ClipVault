namespace ClipVault.Core.Detection;

/// <summary>
/// Detects running games by process name and monitors focus.
/// </summary>
public interface IGameDetector : IDisposable
{
    /// <summary>
    /// Fired when a game is detected or focus changes.
    /// </summary>
    event EventHandler<GameDetectedEventArgs>? GameDetected;

    /// <summary>
    /// Fired when a game loses focus or closes.
    /// </summary>
    event EventHandler<GameLostEventArgs>? GameLost;

    /// <summary>
    /// Currently detected game, if any.
    /// </summary>
    DetectedGame? CurrentGame { get; }

    /// <summary>
    /// Start monitoring for games.
    /// </summary>
    Task StartAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Stop monitoring.
    /// </summary>
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
    string? TwitchId);
