using System.Diagnostics;
using ClipVault.Core;

namespace ClipVault.Core.Encoding;

public sealed class FFmpegEncoder : IEncoder
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
        var tempVideoFile = Path.Combine(outputDir, "temp_video.bin");
        var tempAudioFile = Path.Combine(outputDir, "temp_audio.bin");
        var tempMicAudioFile = Path.Combine(outputDir, "temp_mic_audio.bin");
        var tempTsFile = Path.Combine(outputDir, "temp_timestamps.txt");

        try
        {
            var baseTimestamp = validFrames[0].TimestampTicks;

            var videoDurationTicks = validFrames[validFrames.Count - 1].TimestampTicks - baseTimestamp;
            var videoDurationSeconds = NativeMethods.TimestampToSeconds(videoDurationTicks);

            Logger.Info($"Encoding {validFrames.Count} frames over {videoDurationSeconds:F3}s ({videoDurationTicks} ticks)");

            var avgFps = validFrames.Count / videoDurationSeconds;
            var roundedFps = Math.Round(avgFps);
            if (roundedFps < 1) roundedFps = 30;
            Logger.Info($"Average FPS: {avgFps:F1}, rounded to: {roundedFps}");

            using (var fs = new FileStream(tempVideoFile, FileMode.Create, FileAccess.Write, FileShare.None, 4096 * 1024))
            {
                for (int i = 0; i < validFrames.Count; i++)
                {
                    var frame = validFrames[i];
                    if (frame.FrameData != null && frame.FrameData.Length > 0)
                        fs.Write(frame.FrameData, 0, frame.FrameData.Length);
                }
            }

            var hasSystemAudio = systemAudio.Count > 0;
            var hasMicAudio = micAudio != null && micAudio.Count > 0;

            if (hasSystemAudio)
            {
                using (var fs = new FileStream(tempAudioFile, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024))
                {
                    foreach (var chunk in systemAudio)
                    {
                        if (chunk.Samples != null && chunk.Samples.Length > 0)
                            fs.Write(chunk.Samples, 0, chunk.Samples.Length);
                    }
                }
            }

            if (hasMicAudio)
            {
                using (var fs = new FileStream(tempMicAudioFile, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024))
                {
                    foreach (var chunk in micAudio!)
                    {
                        if (chunk.Samples != null && chunk.Samples.Length > 0)
                            fs.Write(chunk.Samples, 0, chunk.Samples.Length);
                    }
                }
            }

            Logger.Info("Step 2: Encoding with timestamp-aware FFmpeg...");

            string args;
            if (hasSystemAudio && hasMicAudio)
            {
                args = $"-y " +
                       $"-framerate {roundedFps} -f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -i \"{tempVideoFile}\" " +
                       $"-ar {settings.AudioSampleRate} -ac 2 -f f32le -i \"{tempAudioFile}\" " +
                       $"-ar {settings.AudioSampleRate} -ac 2 -f f32le -i \"{tempMicAudioFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"-c:a aac -b:a 192k " +
                       $"-c:a aac -b:a 192k " +
                       $"-map 0:v -map 1:a -map 2:a " +
                       $"-shortest " +
                       $"\"{outputPath}\"";
            }
            else if (hasSystemAudio)
            {
                args = $"-y " +
                       $"-framerate {roundedFps} -f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -i \"{tempVideoFile}\" " +
                       $"-ar {settings.AudioSampleRate} -ac 2 -f f32le -i \"{tempAudioFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"-c:a aac -b:a 192k " +
                       $"-map 0:v -map 1:a " +
                       $"-shortest " +
                       $"\"{outputPath}\"";
            }
            else if (hasMicAudio)
            {
                args = $"-y " +
                       $"-framerate {roundedFps} -f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -i \"{tempVideoFile}\" " +
                       $"-ar {settings.AudioSampleRate} -ac 2 -f f32le -i \"{tempMicAudioFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"-c:a aac -b:a 192k " +
                       $"-map 0:v -map 1:a " +
                       $"-shortest " +
                       $"\"{outputPath}\"";
            }
            else
            {
                args = $"-y " +
                       $"-framerate {roundedFps} -f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -i \"{tempVideoFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"-map 0:v " +
                       $"\"{outputPath}\"";
            }

            Logger.Debug($"FFmpeg args: {args}");

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
            var timeoutTask = Task.Delay(TimeSpan.FromSeconds(90));
            var exitTask = process.WaitForExitAsync();
            var completedTask = await Task.WhenAny(stderrTask, exitTask, timeoutTask);

            if (completedTask == timeoutTask)
            {
                Logger.Warning("FFmpeg timed out after 90s, killing process");
                try { process.Kill(); } catch { }
                await process.WaitForExitAsync(CancellationToken.None);
                return;
            }

            if (!process.HasExited)
            {
                await process.WaitForExitAsync();
            }

            var stderr = await stderrTask;

            if (process.ExitCode == 0)
            {
                var fileInfo = new FileInfo(outputPath);
                Logger.Info($"SUCCESS: {outputPath} ({fileInfo.Length / 1024}KB)");
            }
            else
            {
                Logger.Error($"FFmpeg failed (exit {process.ExitCode})");
                if (stderr.Length > 400)
                    stderr = stderr[^400..];
                Logger.Error(stderr);
            }
        }
        finally
        {
            try { File.Delete(tempVideoFile); } catch { }
            try { File.Delete(tempAudioFile); } catch { }
            try { File.Delete(tempMicAudioFile); } catch { }
            try { File.Delete(tempTsFile); } catch { }
        }

        progress?.Report(1.0);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}
