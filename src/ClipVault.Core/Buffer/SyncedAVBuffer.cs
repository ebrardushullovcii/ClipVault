using System.Runtime.InteropServices;

namespace ClipVault.Core.Buffer;

/// <summary>
/// Synchronized Audio/Video buffer that ensures A/V sync by using common timestamps.
/// All data is timestamped with the same high-resolution clock.
/// </summary>
public sealed class SyncedAVBuffer : IDisposable
{
    private readonly HybridFrameBuffer _videoBuffer;
    private readonly AudioSampleBuffer _systemAudioBuffer;
    private readonly AudioSampleBuffer _micAudioBuffer;
    private readonly int _durationSeconds;
    private readonly int _fps;
    private bool _disposed;

    public SyncedAVBuffer(int width, int height, int fps, int durationSeconds)
    {
        _durationSeconds = durationSeconds;
        _fps = fps;
        
        _videoBuffer = new HybridFrameBuffer(width, height, fps, 
            ramBufferSeconds: Math.Min(30, durationSeconds), 
            totalBufferSeconds: durationSeconds);
            
        _systemAudioBuffer = new AudioSampleBuffer(48000, 2, durationSeconds);
        _micAudioBuffer = new AudioSampleBuffer(48000, 2, durationSeconds);
        
        Logger.Info($"SyncedAVBuffer: {width}x{height}@{fps}fps, {durationSeconds}s buffer");
    }

    public void AddVideoFrame(nint texturePointer, long timestampTicks)
    {
        _videoBuffer.Add(texturePointer, timestampTicks);
    }

    public void AddSystemAudio(byte[] data, long timestampTicks)
    {
        _systemAudioBuffer.Add(data, timestampTicks);
    }

    public void AddMicrophoneAudio(byte[] data, long timestampTicks)
    {
        _micAudioBuffer.Add(data, timestampTicks);
    }

    /// <summary>
    /// Get synchronized A/V data for the last N seconds.
    /// Video frames define the time window, audio is strictly aligned.
    /// </summary>
    public SyncedAVData GetLastSeconds(int seconds)
    {
        var now = NativeMethods.GetHighResolutionTimestamp();
        var targetStartTicks = now - (long)(seconds * NativeMethods.TicksPerSecond);

        // Get all data
        var allFrames = _videoBuffer.GetAll();
        var allSystemAudio = _systemAudioBuffer.GetAll();
        var allMicAudio = _micAudioBuffer.GetAll();

        // Filter video to last N seconds
        var frames = allFrames.Where(f => f.TimestampTicks >= targetStartTicks).ToArray();

        if (frames.Length == 0)
        {
            Logger.Warning("No frames in target time window");
            return new SyncedAVData(Array.Empty<Encoding.TimestampedFrame>(),
                Array.Empty<Encoding.TimestampedAudio>(),
                Array.Empty<Encoding.TimestampedAudio>(), 0);
        }

        // Use VIDEO timestamps to define the clip window - audio must match exactly
        var videoStartTicks = frames[0].TimestampTicks;
        var videoEndTicks = frames[frames.Length - 1].TimestampTicks;
        var durationSeconds = NativeMethods.TimestampToSeconds(videoEndTicks - videoStartTicks);

        // STRICT audio filtering: only include audio AT OR AFTER video start
        // Small end margin to include audio chunk that spans video end
        var audioEndMargin = (long)(0.1 * NativeMethods.TicksPerSecond); // 100ms at end only

        var systemAudio = allSystemAudio
            .Where(a => a.TimestampTicks >= videoStartTicks && a.TimestampTicks <= videoEndTicks + audioEndMargin)
            .ToArray();
        var micAudio = allMicAudio
            .Where(a => a.TimestampTicks >= videoStartTicks && a.TimestampTicks <= videoEndTicks + audioEndMargin)
            .ToArray();

        Logger.Info($"Synced A/V: {frames.Length} frames ({durationSeconds:F1}s), " +
                    $"{systemAudio.Length} system audio, {micAudio.Length} mic audio");
        Logger.Debug($"  Video window: {videoStartTicks} to {videoEndTicks}");
        if (systemAudio.Length > 0)
            Logger.Debug($"  System audio: {systemAudio[0].TimestampTicks} to {systemAudio[^1].TimestampTicks}");

        return new SyncedAVData(frames, systemAudio, micAudio, durationSeconds);
    }

    public void Clear()
    {
        _videoBuffer.Clear();
        _systemAudioBuffer.Clear();
        _micAudioBuffer.Clear();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        
        _videoBuffer.Dispose();
        _systemAudioBuffer.Dispose();
        _micAudioBuffer.Dispose();
    }
}

public record SyncedAVData(
    Encoding.TimestampedFrame[] Frames,
    Encoding.TimestampedAudio[] SystemAudio,
    Encoding.TimestampedAudio[] MicrophoneAudio,
    double DurationSeconds
);