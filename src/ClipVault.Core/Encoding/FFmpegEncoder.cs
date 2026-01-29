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

        // Filter frames to only those matching expected size
        var expectedFrameSize = settings.Width * settings.Height * 4;
        var validFrames = videoFrames.Where(f =>
            f.FrameData != null &&
            f.FrameData.Length == expectedFrameSize).ToList();

        Logger.Info($"Encoding {validFrames.Count} frames, {systemAudio.Count} audio chunks");

        if (validFrames.Count == 0)
        {
            Logger.Error($"No valid frames! Expected {expectedFrameSize} bytes per frame");
            return;
        }

        var outputDir = Path.GetDirectoryName(outputPath)!;
        var tempVideoFile = Path.Combine(outputDir, "temp_video.bin");
        var tempAudioFile = Path.Combine(outputDir, "temp_audio.bin");

        try
        {
            // Step 1: Write video frames to temp file
            Logger.Info("Step 1: Writing video...");
            using (var fs = new FileStream(tempVideoFile, FileMode.Create, FileAccess.Write, FileShare.None, 4096 * 1024))
            {
                for (int i = 0; i < validFrames.Count; i++)
                {
                    var frame = validFrames[i];
                    if (frame.FrameData != null && frame.FrameData.Length > 0)
                        fs.Write(frame.FrameData, 0, frame.FrameData.Length);

                    if ((i + 1) % 50 == 0 || i == validFrames.Count - 1)
                        Logger.Info($"Video: {i + 1}/{validFrames.Count}");
                }
            }

            // Step 2: Write audio to temp file (if available)
            var hasAudio = systemAudio.Count > 0;
            if (hasAudio)
            {
                Logger.Info("Step 2: Writing audio...");
                using (var fs = new FileStream(tempAudioFile, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024))
                {
                    foreach (var chunk in systemAudio)
                    {
                        if (chunk.Samples != null && chunk.Samples.Length > 0)
                            fs.Write(chunk.Samples, 0, chunk.Samples.Length);
                    }
                }
                var audioSize = new FileInfo(tempAudioFile).Length;
                Logger.Info($"Audio: {audioSize / 1024}KB");
            }

            // Step 3: Run FFmpeg
            Logger.Info("Step 3: Encoding...");

            string args;
            if (hasAudio)
            {
                // Video + Audio
                args = $"-y " +
                       $"-f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -framerate {settings.Fps} -i \"{tempVideoFile}\" " +
                       $"-f f32le -ar {settings.AudioSampleRate} -ac 2 -i \"{tempAudioFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"-c:a aac -b:a 192k " +
                       $"-shortest " +
                       $"\"{outputPath}\"";
            }
            else
            {
                // Video only
                args = $"-y " +
                       $"-f rawvideo -pixel_format bgra -video_size {settings.Width}x{settings.Height} -framerate {settings.Fps} -i \"{tempVideoFile}\" " +
                       $"-c:v h264_nvenc -preset p4 -rc constqp -qp 23 " +
                       $"\"{outputPath}\"";
            }

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

            var stderr = await process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

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
        }

        progress?.Report(1.0);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}
