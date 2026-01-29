using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using ClipVault.Core;
using ClipVault.Core.Audio;
using ClipVault.Core.Buffer;
using ClipVault.Core.Capture;
using ClipVault.Core.Configuration;
using ClipVault.Core.Detection;
using CoreEncoding = ClipVault.Core.Encoding;

namespace ClipVault.Service;

public sealed class ClipVaultService : IDisposable
{
    private readonly string _basePath;
    private readonly NotifyIcon _trayIcon;
    private readonly ContextMenuStrip _trayMenu;
    private readonly Form _hiddenForm = new();

    private ConfigManager _configManager = null!;
    private GameDatabase _gameDatabase = null!;
    private IGameDetector _gameDetector = null!;
    private IScreenCapture? _screenCapture;
    private IAudioCapture? _systemAudioCapture;
    private IAudioCapture? _microphoneCapture;
    private HotkeyManager? _hotkeyManager;
    private VideoFrameBuffer? _videoBuffer;
    private AudioSampleBuffer? _systemAudioBuffer;
    private AudioSampleBuffer? _microphoneAudioBuffer;

    private bool _isCapturing;
    private bool _disposed;
    private bool _isSavingClip;

    public ClipVaultService(string basePath, NotifyIcon trayIcon, ContextMenuStrip trayMenu)
    {
        _basePath = basePath;
        _trayIcon = trayIcon;
        _trayMenu = trayMenu;

        _hiddenForm.ShowIcon = false;
        _hiddenForm.ShowInTaskbar = false;
        _hiddenForm.WindowState = FormWindowState.Minimized;
        _hiddenForm.Load += (_, _) => _hiddenForm.Hide();
        _hiddenForm.HandleCreated += (_, _) => _hiddenForm.BeginInvoke(new Action(() => _hiddenForm.Hide()));
    }

    public void Initialize()
    {
        Logger.Initialize(_basePath);
        Logger.Info("Initializing ClipVault service...");

        InitializeConfiguration();
        InitializeGameDatabase();
        InitializeBuffers();

        Logger.Info("Creating hidden form handle...");
        var handle = _hiddenForm.Handle;
        Logger.Info($"Hidden form handle created: 0x{handle:X}");

        InitializeGameDetector();
        InitializeHotkeys();

        Logger.Info("ClipVault service initialized successfully");
        UpdateTrayStatus();
    }

    private void InitializeConfiguration()
    {
        _configManager = ConfigManager.CreateDefault(_basePath);
        _configManager.Load();

        _trayMenu.Items.Clear();
        _trayMenu.Items.Add("Start Capture", null, (_, _) => ToggleCapture());
        _trayMenu.Items.Add("Exit", null, (_, _) => Exit());
    }

    private void InitializeGameDatabase()
    {
        _gameDatabase = GameDatabase.CreateDefault(_basePath);

        var configDir = Path.Combine(_basePath, "config");
        var gamesJsonDest = Path.Combine(configDir, "games.json");
        var gamesJsonSrc = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "config", "games.json");

        if (!File.Exists(gamesJsonDest) && File.Exists(gamesJsonSrc))
        {
            Directory.CreateDirectory(configDir);
            File.Copy(gamesJsonSrc, gamesJsonDest);
            Logger.Debug($"Copied games.json to output");
        }

        _gameDatabase.Load();
    }

    private void InitializeBuffers()
    {
        var bufferSeconds = _configManager.Config.BufferDurationSeconds;
        var fps = _configManager.Config.Quality.Fps;

        _videoBuffer = new VideoFrameBuffer(fps, bufferSeconds);
        _systemAudioBuffer = new AudioSampleBuffer(
            _configManager.Config.Audio.SampleRate,
            2,
            bufferSeconds);
        _microphoneAudioBuffer = new AudioSampleBuffer(
            _configManager.Config.Audio.SampleRate,
            2,
            bufferSeconds);
    }

    private void InitializeGameDetector()
    {
        _gameDetector = new GameDetector(_gameDatabase);
        _gameDetector.GameDetected += OnGameDetected;
        _gameDetector.GameLost += OnGameLost;

        _ = _gameDetector.StartAsync();
    }

    private void InitializeHotkeys()
    {
        Logger.Info("Initializing hotkeys...");
        Logger.Info($"Hotkey config: {string.Join("+", _configManager.Config.Hotkey.Modifiers)}+{_configManager.Config.Hotkey.Key}");

        _hotkeyManager = new HotkeyManager(_hiddenForm, _configManager.Config.Hotkey);
        _hotkeyManager.HotkeyPressed += OnHotkeyPressed;
        Logger.Info("HotkeyManager created");

        var timer = new System.Windows.Forms.Timer { Interval = 1000 };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            timer.Dispose();
            RegisterHotkeys();
        };
        timer.Start();

        _trayIcon.MouseClick += (sender, e) =>
        {
            if (e.Button == MouseButtons.Left)
            {
                ToggleCapture();
            }
        };
    }

    private void RegisterHotkeys()
    {
        if (_hotkeyManager == null) return;

        Logger.Info($"Registering hotkeys...");
        if (!_hotkeyManager.Register())
        {
            var error = Marshal.GetLastWin32Error();
            Logger.Warning($"Failed to register hotkey (error {error})");
        }
        else
        {
            Logger.Info("Hotkey registered successfully!");
        }
    }

    private void OnGameDetected(object? sender, GameDetectedEventArgs e)
    {
        Logger.GameDetected(e.Game.Name, e.Game.ProcessId, e.Game.WindowHandle);

        if (_configManager.Config.AutoDetectGames && !_isCapturing)
        {
            StartCapture(e.Game.WindowHandle);
        }

        UpdateTrayStatus();
    }

    private void OnGameLost(object? sender, GameLostEventArgs e)
    {
        Logger.GameLost(e.GameName, e.Reason.ToString());

        var (hwnd, _) = FocusMonitor.GetCurrentFocus();
        if (hwnd != IntPtr.Zero)
        {
            StartCapture(hwnd);
        }

        UpdateTrayStatus();
    }

    private void OnHotkeyPressed(object? sender, EventArgs e)
    {
        Logger.HotkeyPressed();

        // Always try to save - use whatever frames are in the buffer
        // Don't require active capture since user switches tabs frequently
        SaveClip();
    }

    public void ToggleCapture()
    {
        if (_isCapturing)
        {
            StopCapture();
        }
        else
        {
            var (hwnd, _) = FocusMonitor.GetCurrentFocus();
            StartCapture(hwnd);
        }
    }

    public void StartCapture(nint windowHandle)
    {
        Logger.Info($"Starting capture for window: {windowHandle}");

        var wasCapturing = _screenCapture != null;

        if (_screenCapture != null)
        {
            try
            {
                _screenCapture.StopAsync().Wait(TimeSpan.FromSeconds(1));
                _screenCapture.Dispose();
            }
            catch { }
            _screenCapture = null;
        }

        try
        {
            _screenCapture = new WindowsGraphicsCapture(windowHandle);
            _screenCapture.FrameCaptured += OnFrameCaptured;
            _ = _screenCapture.StartAsync();
            Logger.Info("Screen capture initialized successfully");

            _isCapturing = true;
        }
        catch (Exception ex)
        {
            Logger.Error("Failed to start screen capture", ex);
            _screenCapture = null;
        }

        // Start system audio capture
        if (_configManager.Config.Audio.CaptureSystemAudio && _systemAudioCapture == null)
        {
            try
            {
                _systemAudioCapture = new SystemAudioCapture();
                _systemAudioCapture.DataAvailable += OnSystemAudioAvailable;
                _ = _systemAudioCapture.StartAsync();
                Logger.AudioStarted(_systemAudioCapture.Format.SampleRate, _systemAudioCapture.Format.Channels);
            }
            catch (Exception ex)
            {
                Logger.AudioFailed("System: " + ex.Message);
                _systemAudioCapture = null;
            }
        }

        // Start microphone capture
        if (_configManager.Config.Audio.CaptureMicrophone && _microphoneCapture == null)
        {
            try
            {
                _microphoneCapture = new MicrophoneCapture();
                _microphoneCapture.DataAvailable += OnMicrophoneAudioAvailable;
                _ = _microphoneCapture.StartAsync();
                Logger.Info($"Microphone started: {_microphoneCapture.Format.SampleRate}Hz, {_microphoneCapture.Format.Channels}ch");
            }
            catch (Exception ex)
            {
                Logger.AudioFailed("Microphone: " + ex.Message);
                _microphoneCapture = null;
            }
        }

        _isCapturing = true;
        UpdateTrayStatus();
    }

    public void StopCapture()
    {
        // Don't actually stop - keep recording at all times
        // This method is kept for UI consistency but capture continues
        Logger.Debug("StopCapture called - capture continues running");
    }

    public async void SaveClip()
    {
        if (_isSavingClip)
        {
            Logger.Warning("Already saving a clip, ignoring duplicate hotkey");
            return;
        }

        _isSavingClip = true;
        try
        {
            Logger.Info("Saving clip...");

        var timestamp = DateTime.Now;
        var gameName = _gameDetector.CurrentGame?.Name ?? "Unknown";

        var folderName = $"{gameName}_{timestamp:yyyy-MM-dd_HH-mm-ss}";
        var outputDir = Path.Combine(_basePath, _configManager.Config.OutputDirectory, folderName);
        Directory.CreateDirectory(outputDir);

        var frames = _videoBuffer?.GetAll() ?? Array.Empty<CoreEncoding.TimestampedFrame>();

        if (frames.Length == 0)
        {
            Logger.Warning("No frames captured, cannot save clip");
            return;
        }

        var videoStartTicks = frames[0].TimestampTicks;
        var videoEndTicks = frames[frames.Length - 1].TimestampTicks;
        var videoDurationTicks = videoEndTicks - videoStartTicks;
        var videoDurationSeconds = NativeMethods.TimestampToSeconds(videoDurationTicks);

        var allSystemAudio = _systemAudioBuffer?.GetAll() ?? Array.Empty<CoreEncoding.TimestampedAudio>();
        var allMicAudio = _microphoneAudioBuffer?.GetAll() ?? Array.Empty<CoreEncoding.TimestampedAudio>();

        var sampleRate = _configManager.Config.Audio.SampleRate;
        var channels = 2;
        var bytesPerSecond = sampleRate * channels * sizeof(float);
        var targetAudioBytes = (int)(videoDurationSeconds * bytesPerSecond);
        var toleranceBytes = (int)(0.5 * bytesPerSecond);
        var minAudioBytes = targetAudioBytes - toleranceBytes;
        var maxAudioBytes = targetAudioBytes + toleranceBytes;

        Logger.Info($"Target audio: {targetAudioBytes / 1024}KB for {videoDurationSeconds:F1}s video");

        var totalSystemBytes = allSystemAudio.Sum(a => a.Samples.Length);
        var totalMicBytes = allMicAudio.Sum(a => a.Samples.Length);

        var systemAudio = allSystemAudio.ToList();
        var micAudio = allMicAudio.ToList();

        if (totalSystemBytes > maxAudioBytes)
        {
            var excessBytes = totalSystemBytes - maxAudioBytes;
            var accumulated = 0;
            var toRemove = 0;
            for (int i = 0; i < systemAudio.Count; i++)
            {
                accumulated += systemAudio[i].Samples.Length;
                if (accumulated > excessBytes)
                {
                    toRemove = i + 1;
                    break;
                }
            }
            if (toRemove > 0 && toRemove < systemAudio.Count)
            {
                systemAudio = systemAudio.Skip(toRemove).ToList();
                Logger.Debug($"Trimmed {toRemove} system audio chunks to match video duration");
            }
        }

        if (totalMicBytes > maxAudioBytes)
        {
            var excessBytes = totalMicBytes - maxAudioBytes;
            var accumulated = 0;
            var toRemove = 0;
            for (int i = 0; i < micAudio.Count; i++)
            {
                accumulated += micAudio[i].Samples.Length;
                if (accumulated > excessBytes)
                {
                    toRemove = i + 1;
                    break;
                }
            }
            if (toRemove > 0 && toRemove < micAudio.Count)
            {
                micAudio = micAudio.Skip(toRemove).ToList();
                Logger.Debug($"Trimmed {toRemove} mic audio chunks to match video duration");
            }
        }

        Logger.Info($"Final audio: system={systemAudio.Count}, mic={micAudio.Count} (video {videoDurationSeconds:F1}s)");

        var videoPath = Path.Combine(outputDir, "clip.mp4");

        try
        {
            // Use actual captured dimensions from first frame, not hardcoded values
            var firstFrame = frames.Length > 0 ? frames[0] : null;
            var width = firstFrame?.Width ?? 1920;
            var height = firstFrame?.Height ?? 1080;

            Logger.Info($"Encoding at {width}x{height}");

            var settings = new CoreEncoding.EncoderSettings
            {
                Width = width,
                Height = height,
                Fps = _configManager.Config.Quality.Fps,
                NvencPreset = "p7",
                CqLevel = 22,
                AudioSampleRate = 48000
            };

            var encoder = new CoreEncoding.FFmpegEncoder();
            await encoder.EncodeAsync(
                videoPath,
                frames.ToList(),
                systemAudio.ToList(),
                micAudio.ToList(),
                settings,
                null,
                CancellationToken.None);
        }
        catch (Exception ex)
        {
            Logger.Error("Encoding failed", ex);
        }

        _videoBuffer?.Clear();
        _systemAudioBuffer?.Clear();
        _microphoneAudioBuffer?.Clear();

        Logger.Debug($"Buffers cleared - Video: {_videoBuffer?.Count ?? 0}, SystemAudio: {_systemAudioBuffer?.Count ?? 0}, MicAudio: {_microphoneAudioBuffer?.Count ?? 0}");

        var metadata = new
        {
            Game = gameName,
            Timestamp = timestamp,
            Duration = TimeSpan.FromSeconds(videoDurationSeconds),
            VideoFrames = frames.Length,
            SystemAudioSamples = systemAudio.Count,
            MicrophoneAudioSamples = micAudio.Count,
            Resolution = $"{_configManager.Config.Quality.Resolution}",
            Fps = _configManager.Config.Quality.Fps
        };

        var metadataPath = Path.Combine(outputDir, "metadata.json");
        var json = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(metadataPath, json);

        Logger.ClipSaved(outputDir, videoDurationSeconds);
        }
        finally
        {
            _isSavingClip = false;
        }
    }

    private void OnFrameCaptured(object? sender, FrameCapturedEventArgs e)
    {
        if (_videoBuffer == null) return;

        try
        {
            _videoBuffer.Add(e.TexturePointer, e.TimestampTicks, e.Width, e.Height);
        }
        catch (Exception ex)
        {
            Logger.Error("Error adding frame to buffer", ex);
        }
    }

    private static int _audioChunkCount = 0;
    private void OnSystemAudioAvailable(object? sender, AudioDataEventArgs e)
    {
        _audioChunkCount++;
        if (_audioChunkCount <= 3)
            Logger.Debug($"SystemAudio callback #{_audioChunkCount}: {e.BytesRecorded} bytes");

        if (e.BytesRecorded == 0 || _systemAudioBuffer == null) return;

        var copy = new byte[e.BytesRecorded];
        System.Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _systemAudioBuffer.Add(copy, e.TimestampTicks);
    }

    private static int _micChunkCount = 0;
    private void OnMicrophoneAudioAvailable(object? sender, AudioDataEventArgs e)
    {
        _micChunkCount++;
        if (_micChunkCount <= 3)
            Logger.Debug($"Microphone callback #{_micChunkCount}: {e.BytesRecorded} bytes");

        if (e.BytesRecorded == 0 || _microphoneAudioBuffer == null) return;

        var copy = new byte[e.BytesRecorded];
        System.Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _microphoneAudioBuffer.Add(copy, e.TimestampTicks);
    }

    private void UpdateTrayStatus()
    {
        var gameName = _gameDetector.CurrentGame?.Name ?? "No game";
        var status = _isCapturing ? "Recording" : "Idle";

        _trayIcon.Text = $"ClipVault - {status}";
        _trayIcon.Icon = _isCapturing
            ? new System.Drawing.Icon(System.Drawing.SystemIcons.Shield, 32, 32)
            : new System.Drawing.Icon(System.Drawing.SystemIcons.Application, 32, 32);
    }

    private void Exit()
    {
        StopCapture();

        _gameDetector.StopAsync().Wait(TimeSpan.FromSeconds(1));
        _hotkeyManager?.Dispose();

        _trayIcon.Visible = false;
        Application.Exit();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopCapture();

        _gameDetector?.Dispose();
        _screenCapture?.Dispose();
        _systemAudioCapture?.Dispose();
        _microphoneCapture?.Dispose();
        _videoBuffer?.Dispose();
        _systemAudioBuffer?.Dispose();
        _microphoneAudioBuffer?.Dispose();
        _hotkeyManager?.Dispose();
        _configManager?.Save();

        GC.SuppressFinalize(this);
    }
}

internal class WindowHandle : NativeWindow, IWin32Window
{
}