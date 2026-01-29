namespace ClipVault.Core.Buffer;

public sealed class SyncedAVBuffer : IDisposable
{
    private readonly HybridFrameBuffer _videoBuffer;
    private readonly AudioSampleBuffer _systemAudioBuffer;
    private readonly AudioSampleBuffer _micAudioBuffer;
    private readonly int _fps;
    private readonly int _width;
    private readonly int _height;
    private bool _disposed;

    public SyncedAVBuffer(int width, int height, int fps, int durationSeconds, int compressionQuality = 90)
    {
        _width = width;
        _height = height;
        _fps = fps;
        
        _videoBuffer = new HybridFrameBuffer(width, height, fps, 
            ramBufferSeconds: Math.Min(30, durationSeconds), 
            totalBufferSeconds: durationSeconds,
            compressionQuality: compressionQuality);
            
        _systemAudioBuffer = new AudioSampleBuffer(48000, 2, durationSeconds);
        _micAudioBuffer = new AudioSampleBuffer(48000, 2, durationSeconds);
        
        Logger.Info($"SyncedAVBuffer: {width}x{height}@{fps}fps, {durationSeconds}s buffer, JPEG quality {compressionQuality}");
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

    public (string VideoFilePath, int FrameCount, long StartTimestamp, long EndTimestamp, Encoding.TimestampedAudio[] SystemAudio, Encoding.TimestampedAudio[] MicrophoneAudio) WriteLastSecondsToTempFiles(int seconds, string outputDir)
    {
        var now = NativeMethods.GetHighResolutionTimestamp();
        var targetStartTicks = now - (long)(seconds * NativeMethods.TicksPerSecond);

        var allSystemAudio = _systemAudioBuffer.GetAll();
        var allMicAudio = _micAudioBuffer.GetAll();

        var videoFilePath = Path.Combine(outputDir, $"video_raw_{Guid.NewGuid():N}.bin");
        var result = _videoBuffer.WriteRawFramesToFile(videoFilePath, targetStartTicks);

        if (result.FrameCount == 0)
        {
            File.Delete(videoFilePath);
            return (string.Empty, 0, 0, 0, Array.Empty<Encoding.TimestampedAudio>(), Array.Empty<Encoding.TimestampedAudio>());
        }

        var audioEndMargin = (long)(0.1 * NativeMethods.TicksPerSecond);

        var systemAudio = allSystemAudio
            .Where(a => a.TimestampTicks >= result.StartTimestamp && a.TimestampTicks <= result.EndTimestamp + audioEndMargin)
            .ToArray();
        var micAudio = allMicAudio
            .Where(a => a.TimestampTicks >= result.StartTimestamp && a.TimestampTicks <= result.EndTimestamp + audioEndMargin)
            .ToArray();

        var durationSeconds = NativeMethods.TimestampToSeconds(result.EndTimestamp - result.StartTimestamp);
        Logger.Info($"Synced A/V: {result.FrameCount} frames ({durationSeconds:F1}s), " +
                    $"{systemAudio.Length} system audio, {micAudio.Length} mic audio");

        return (videoFilePath, result.FrameCount, result.StartTimestamp, result.EndTimestamp, systemAudio, micAudio);
    }

    public SyncedAVData GetLastSeconds(int seconds)
    {
        var now = NativeMethods.GetHighResolutionTimestamp();
        var targetStartTicks = now - (long)(seconds * NativeMethods.TicksPerSecond);

        var allFrames = _videoBuffer.GetAll();
        var allSystemAudio = _systemAudioBuffer.GetAll();
        var allMicAudio = _micAudioBuffer.GetAll();

        var frames = allFrames.Where(f => f.TimestampTicks >= targetStartTicks).ToArray();

        if (frames.Length == 0)
        {
            return new SyncedAVData(Array.Empty<Encoding.TimestampedFrame>(),
                Array.Empty<Encoding.TimestampedAudio>(),
                Array.Empty<Encoding.TimestampedAudio>(), 0);
        }

        var videoStartTicks = frames[0].TimestampTicks;
        var videoEndTicks = frames[frames.Length - 1].TimestampTicks;
        var durationSeconds = NativeMethods.TimestampToSeconds(videoEndTicks - videoStartTicks);

        var audioEndMargin = (long)(0.1 * NativeMethods.TicksPerSecond);

        var systemAudio = allSystemAudio
            .Where(a => a.TimestampTicks >= videoStartTicks && a.TimestampTicks <= videoEndTicks + audioEndMargin)
            .ToArray();
        var micAudio = allMicAudio
            .Where(a => a.TimestampTicks >= videoStartTicks && a.TimestampTicks <= videoEndTicks + audioEndMargin)
            .ToArray();

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