using System.Diagnostics;
using ClipVault.Core;

namespace ClipVault.Core.Encoding;

/// <summary>
/// FFmpeg-based video encoder with NVENC hardware acceleration.
/// Optimized for low memory usage during encoding with buffered streams.
/// </summary>
public sealed class FFmpegEncoder : IEncoder, IDisposable
{
    private readonly string _ffmpegPath;
    private bool _disposed;

    private static string GetDefaultFFmpegPath()
    {
        var baseDir = Path.GetDirectoryName(AppContext.BaseDirectory) ?? Directory.GetCurrentDirectory();

        var possiblePaths = new[]
        {
            Path.Combine(baseDir, "..", "..", "..", "..", "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "..", "..", "..", "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "..", "..", "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "..", "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(baseDir, "ffmpeg.exe"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "tools", "ffmpeg", "bin", "ffmpeg.exe"),
            Path.Combine(AppContext.BaseDirectory, "tools", "ffmpeg", "bin", "ffmpeg.exe"),
        };

        foreach (var path in possiblePaths)
        {
            var fullPath = Path.GetFullPath(path);
            if (File.Exists(fullPath))
            {
                Logger.Info($"Found ffmpeg at: {fullPath}");
                return fullPath;
            }
        }

        return "ffmpeg.exe";
    }

    public FFmpegEncoder() : this(GetDefaultFFmpegPath())
    {
    }

    public FFmpegEncoder(string ffmpegPath)
    {
        _ffmpegPath = ffmpegPath;
    }

    public async Task EncodeAsync(
        string outputPath,
        IReadOnlyList<TimestampedFrame> videoFrames,
        IReadOnlyList<TimestampedAudio> systemAudio,
        IReadOnlyList<TimestampedAudio>? micAudio,
        EncoderSettings settings,
        IProgress<double>? progress = null,
        CancellationToken cancellationToken = default)
    {
        if (videoFrames.Count == 0)
        {
            Logger.Warning("No frames to encode");
            return;
        }

        var expectedFrameSize = settings.Width * settings.Height * 4;
        var validFrames = videoFrames.Where(f =>
            f.FrameData != null &&
            f.FrameData.Length == expectedFrameSize).ToList();

        if (validFrames.Count == 0)
        {
            Logger.Error($"No valid frames! Expected {expectedFrameSize} bytes per frame");
            return;
        }

        var outputDir = Path.GetDirectoryName(outputPath)!;
        var tempVideoFile = Path.Combine(outputDir, $"temp_video_{Guid.NewGuid():N}.bin");
        var tempAudioFile = Path.Combine(outputDir, $"temp_audio_{Guid.NewGuid():N}.bin");
        var tempMicAudioFile = Path.Combine(outputDir, $"temp_mic_{Guid.NewGuid():N}.bin");

        // Track files for cleanup
        var tempFiles = new List<string> { tempVideoFile };

        try
        {
            var baseTimestamp = validFrames[0].TimestampTicks;
            var videoDurationTicks = validFrames[validFrames.Count - 1].TimestampTicks - baseTimestamp;
            var videoDurationSeconds = NativeMethods.TimestampToSeconds(videoDurationTicks);

            Logger.Info($"Encoding {validFrames.Count} frames over {videoDurationSeconds:F3}s");

            // Calculate actual capture FPS - this is critical for A/V sync!
            // We must tell FFmpeg the TRUE rate of the input frames so audio stays in sync
            var actualFps = validFrames.Count / videoDurationSeconds;
            if (actualFps < 1) actualFps = 30;
            if (actualFps > 120) actualFps = 60; // Cap at reasonable max

            // Round to avoid weird framerates like 59.94 causing issues
            var inputFps = Math.Round(actualFps * 2) / 2; // Round to nearest 0.5
            Logger.Info($"Actual capture FPS: {actualFps:F2}, using input rate: {inputFps:F1}fps");

            // Write video frames using buffered stream for memory efficiency
            await WriteVideoFramesAsync(validFrames, tempVideoFile, progress, cancellationToken);

            var hasSystemAudio = systemAudio.Count > 0;
            var hasMicAudio = micAudio != null && micAudio.Count > 0;

            // Log audio info for debugging
            if (hasSystemAudio && systemAudio.Count > 0)
            {
                var audioStartTicks = systemAudio[0].TimestampTicks;
                var audioEndTicks = systemAudio[systemAudio.Count - 1].TimestampTicks;
                var audioOffsetMs = NativeMethods.TimestampToSeconds(audioStartTicks - baseTimestamp) * 1000;
                var audioDurationSec = NativeMethods.TimestampToSeconds(audioEndTicks - audioStartTicks);
                Logger.Info($"System audio: {systemAudio.Count} chunks, offset={audioOffsetMs:F0}ms, duration={audioDurationSec:F1}s");
            }

            if (hasMicAudio && micAudio!.Count > 0)
            {
                var micStartTicks = micAudio[0].TimestampTicks;
                var micOffsetMs = NativeMethods.TimestampToSeconds(micStartTicks - baseTimestamp) * 1000;
                Logger.Info($"Mic audio: {micAudio.Count} chunks, offset={micOffsetMs:F0}ms");
            }

            // Write audio data using buffered streams
            if (hasSystemAudio)
            {
                await WriteAudioDataAsync(systemAudio, tempAudioFile, progress, cancellationToken);
                tempFiles.Add(tempAudioFile);
            }

            if (hasMicAudio)
            {
                await WriteAudioDataAsync(micAudio!, tempMicAudioFile, progress, cancellationToken);
                tempFiles.Add(tempMicAudioFile);
            }

            Logger.Info("Encoding with FFmpeg...");

            // Build FFmpeg arguments - use actual input FPS for sync, not target FPS
            var videoArgs = BuildVideoArgs(settings);
            var args = BuildFFmpegArgs(tempVideoFile, tempAudioFile, tempMicAudioFile,
                hasSystemAudio, hasMicAudio, inputFps, settings, videoArgs, outputPath);

            Logger.Debug($"FFmpeg args: {args}");

            await RunFFmpegAsync(args, outputPath, cancellationToken);
        }
        finally
        {
            // Aggressive cleanup of temp files
            foreach (var file in tempFiles)
            {
                await CleanupTempFileAsync(file);
            }
        }

        progress?.Report(1.0);
    }

    private async Task WriteVideoFramesAsync(
        List<TimestampedFrame> frames, 
        string outputPath, 
        IProgress<double>? progress,
        CancellationToken ct)
    {
        // Use buffered stream with 4MB buffer for efficient disk I/O
        // This keeps memory usage low by streaming data rather than holding it all
        await using var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write, 
            FileShare.None, 4 * 1024 * 1024, FileOptions.SequentialScan);
        await using var bufferedStream = new BufferedStream(fs, 4 * 1024 * 1024);

        for (int i = 0; i < frames.Count; i++)
        {
            ct.ThrowIfCancellationRequested();
            
            var frame = frames[i];
            if (frame.FrameData != null && frame.FrameData.Length > 0)
            {
                await bufferedStream.WriteAsync(frame.FrameData, ct);
            }

            if (i % 30 == 0)
            {
                progress?.Report(i / (double)frames.Count * 0.3);
            }
        }

        await bufferedStream.FlushAsync(ct);
    }

    private async Task WriteAudioDataAsync(
        IReadOnlyList<TimestampedAudio> audioData, 
        string outputPath,
        IProgress<double>? progress,
        CancellationToken ct)
    {
        // Use buffered stream with 1MB buffer for audio
        await using var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write,
            FileShare.None, 1024 * 1024, FileOptions.SequentialScan);
        await using var bufferedStream = new BufferedStream(fs, 1024 * 1024);

        int totalChunks = audioData.Count;
        for (int i = 0; i < totalChunks; i++)
        {
            ct.ThrowIfCancellationRequested();
            
            var chunk = audioData[i];
            if (chunk.Samples != null && chunk.Samples.Length > 0)
            {
                await bufferedStream.WriteAsync(chunk.Samples, ct);
            }
        }

        await bufferedStream.FlushAsync(ct);
    }

    private string BuildVideoArgs(EncoderSettings settings)
    {
        var preset = settings.NvencPreset.ToLowerInvariant();
        var rateControl = settings.RateControl.ToLowerInvariant();

        // Validate preset (p1-p7)
        if (!new[] { "p1", "p2", "p3", "p4", "p5", "p6", "p7" }.Contains(preset))
        {
            preset = "p4"; // Default to p4 (balanced)
        }

        var baseArgs = $"-c:v h264_nvenc -preset {preset}";

        return rateControl switch
        {
            "cbr" => $"{baseArgs} -rc cbr -b:v {settings.Bitrate}k -maxrate {settings.Bitrate}k -bufsize {settings.Bitrate * 2}k",
            "vbr" => $"{baseArgs} -rc vbr -b:v {settings.Bitrate}k -maxrate {settings.Bitrate * 1.5}k",
            _ => $"{baseArgs} -rc constqp -qp {settings.CqLevel}" // CQP default
        };
    }

    private static string BuildFFmpegArgs(
        string tempVideoFile,
        string tempAudioFile,
        string tempMicAudioFile,
        bool hasSystemAudio,
        bool hasMicAudio,
        double inputFps,
        EncoderSettings settings,
        string videoArgs,
        string outputPath)
    {
        // Video input - use actual capture FPS for correct A/V sync
        var videoInput = $"-y -framerate {inputFps:F1} -f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -i \"{tempVideoFile}\"";

        // Audio input format - raw 32-bit float PCM
        var audioFormat = $"-f f32le -ar {settings.AudioSampleRate} -ac 2";

        if (hasSystemAudio && hasMicAudio)
        {
            return $"{videoInput} " +
                   $"{audioFormat} -i \"{tempAudioFile}\" " +
                   $"{audioFormat} -i \"{tempMicAudioFile}\" " +
                   $"{videoArgs} " +
                   $"-c:a aac -b:a 192k " +
                   $"-map 0:v -map 1:a -map 2:a " +
                   $"-shortest " +
                   $"\"{outputPath}\"";
        }
        else if (hasSystemAudio)
        {
            return $"{videoInput} " +
                   $"{audioFormat} -i \"{tempAudioFile}\" " +
                   $"{videoArgs} " +
                   $"-c:a aac -b:a 192k " +
                   $"-map 0:v -map 1:a " +
                   $"-shortest " +
                   $"\"{outputPath}\"";
        }
        else if (hasMicAudio)
        {
            return $"{videoInput} " +
                   $"{audioFormat} -i \"{tempMicAudioFile}\" " +
                   $"{videoArgs} " +
                   $"-c:a aac -b:a 192k " +
                   $"-map 0:v -map 1:a " +
                   $"-shortest " +
                   $"\"{outputPath}\"";
        }
        else
        {
            return $"{videoInput} " +
                   $"{videoArgs} " +
                   $"-map 0:v " +
                   $"\"{outputPath}\"";
        }
    }

    private async Task RunFFmpegAsync(string args, string outputPath, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _ffmpegPath,
            Arguments = args,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi);
        if (process == null)
        {
            Logger.Error("Failed to start FFmpeg");
            return;
        }

        var stderrTask = process.StandardError.ReadToEndAsync();
        var timeoutTask = Task.Delay(TimeSpan.FromSeconds(120), ct); // 2 min timeout for large clips
        var exitTask = process.WaitForExitAsync(ct);
        
        var completedTask = await Task.WhenAny(stderrTask, exitTask, timeoutTask);

        if (completedTask == timeoutTask)
        {
            Logger.Warning("FFmpeg timed out after 120s, killing process");
            try { process.Kill(); } catch { }
            await process.WaitForExitAsync(CancellationToken.None);
            return;
        }

        if (!process.HasExited)
        {
            await process.WaitForExitAsync(ct);
        }

        var stderr = await stderrTask;

        if (process.ExitCode == 0)
        {
            var fileInfo = new FileInfo(outputPath);
            Logger.Info($"SUCCESS: {outputPath} ({fileInfo.Length / 1024 / 1024}MB)");
        }
        else
        {
            Logger.Error($"FFmpeg failed (exit {process.ExitCode})");
            if (stderr.Length > 400)
                stderr = stderr[^400..];
            Logger.Error(stderr);
        }
    }

    private static async Task CleanupTempFileAsync(string filePath)
    {
        try
        {
            if (File.Exists(filePath))
            {
                // Try multiple times in case file is locked
                for (int i = 0; i < 3; i++)
                {
                    try
                    {
                        File.Delete(filePath);
                        Logger.Debug($"Cleaned up temp file: {Path.GetFileName(filePath)}");
                        return;
                    }
                    catch (IOException)
                    {
                        if (i < 2)
                        {
                            await Task.Delay(100);
                            continue;
                        }
                        throw;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Warning($"Failed to cleanup temp file {filePath}: {ex.Message}");
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}