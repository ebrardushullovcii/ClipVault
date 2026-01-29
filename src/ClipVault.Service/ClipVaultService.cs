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
    private SyncedAVBuffer? _avBuffer;

    private bool _isCapturing;
    private bool _disposed;
    private bool _isSavingClip;
    private string? _currentGameName;

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

        // Start capture and audio immediately - DXGI captures full screen continuously
        StartCapture();
        StartAudioCapture();

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
        var compressionQuality = _configManager.Config.Quality.BufferCompressionQuality;
        var (width, height) = ParseResolution(_configManager.Config.Quality.Resolution);

        _avBuffer = new SyncedAVBuffer(width, height, fps, bufferSeconds, compressionQuality);

        Logger.Info($"Synchronized A/V buffer initialized for {width}x{height}@{fps}fps, {bufferSeconds}s duration, JPEG quality {compressionQuality}");
    }

    private static (int width, int height) ParseResolution(string resolution)
    {
        return resolution.ToLowerInvariant() switch
        {
            "720p" => (1280, 720),
            "1080p" => (1920, 1080),
            "1440p" => (2560, 1440),
            "4k" or "2160p" => (3840, 2160),
            _ => (1920, 1080)
        };
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
        _currentGameName = e.Game.Name;
        Logger.GameDetected(e.Game.Name, e.Game.ProcessId, e.Game.WindowHandle);

        // Start capture once if not already running - DXGI captures full screen continuously
        if (_configManager.Config.AutoDetectGames && !_isCapturing)
        {
            StartCapture();
        }

        UpdateTrayStatus();
    }

    private void OnGameLost(object? sender, GameLostEventArgs e)
    {
        // Just update the game name for clip folder naming - don't restart capture
        // DXGI captures the full screen regardless of focus
        _currentGameName = null;
        Logger.Debug($"Game focus lost: '{e.GameName}' - capture continues");
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
            StartCapture();
        }
    }

    /// <summary>
    /// Start full-screen capture. DXGI captures the entire screen continuously.
    /// </summary>
    public void StartCapture()
    {
        // Don't restart if already capturing
        if (_isCapturing && _screenCapture != null)
        {
            Logger.Debug("Capture already running, skipping restart");
            return;
        }

        try
        {
            var (width, height) = ParseResolution(_configManager.Config.Quality.Resolution);
            var fps = _configManager.Config.Quality.Fps;

            // Try DXGI first for GPU-accelerated capture, fall back to GDI
            if (DxgiScreenCapture.IsSupported())
            {
                _screenCapture = new DxgiScreenCapture(width, height, fps);
                Logger.Info($"Using DXGI Desktop Duplication for capture");
            }
            else
            {
                _screenCapture = new GdiScreenCapture(width, height, fps);
                Logger.Info($"Using GDI screen capture (DXGI not available)");
            }

            _screenCapture.FrameCaptured += OnFrameCaptured;
            _ = _screenCapture.StartAsync();
            Logger.Info($"Screen capture started: {width}x{height}@{fps}fps");

            _isCapturing = true;
        }
        catch (Exception ex)
        {
            Logger.Error("Failed to start screen capture", ex);
            _screenCapture = null;
        }

        UpdateTrayStatus();
    }

    /// <summary>
    /// Start audio capture (system audio + microphone).
    /// </summary>
    private void StartAudioCapture()
    {
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
            var gameName = _currentGameName ?? _gameDetector.CurrentGame?.Name ?? "Clip";

            var folderName = $"{gameName}_{timestamp:yyyy-MM-dd_HH-mm-ss}";
            var outputDir = Path.Combine(_basePath, _configManager.Config.OutputDirectory, folderName);
            Directory.CreateDirectory(outputDir);

            if (_avBuffer == null)
            {
                Logger.Warning("AV Buffer not initialized, cannot save clip");
                return;
            }

            var targetDuration = _configManager.Config.BufferDurationSeconds;
            var avResult = _avBuffer.WriteLastSecondsToTempFiles(targetDuration, outputDir);

            if (avResult.FrameCount == 0)
            {
                Logger.Warning("No frames in target time window, cannot save clip");
                return;
            }

            var durationSeconds = NativeMethods.TimestampToSeconds(avResult.EndTimestamp - avResult.StartTimestamp);
            Logger.Info($"Saving clip: {avResult.FrameCount} frames, {durationSeconds:F1}s duration");

            var videoPath = Path.Combine(outputDir, "clip.mp4");

            var (width, height) = ParseResolution(_configManager.Config.Quality.Resolution);

            try
            {
                Logger.Info($"Encoding at {width}x{height}");

                var settings = new CoreEncoding.EncoderSettings
                {
                    Width = width,
                    Height = height,
                    Fps = _configManager.Config.Quality.Fps,
                    NvencPreset = _configManager.Config.Quality.NvencPreset,
                    RateControl = _configManager.Config.Quality.RateControl,
                    CqLevel = _configManager.Config.Quality.CqLevel,
                    Bitrate = _configManager.Config.Quality.BitrateKbps,
                    AudioSampleRate = 48000
                };

                var encoder = new CoreEncoding.FFmpegEncoder();
                await encoder.EncodeFromFileAsync(
                    videoPath,
                    avResult.VideoFilePath,
                    avResult.FrameCount,
                    avResult.StartTimestamp,
                    avResult.EndTimestamp,
                    avResult.SystemAudio,
                    avResult.MicrophoneAudio,
                    settings,
                    null,
                    CancellationToken.None);
            }
            catch (Exception ex)
            {
                Logger.Error("Encoding failed", ex);
            }

            _avBuffer?.Clear();

            Logger.Debug("AV Buffer cleared");

            var metadata = new
            {
                Game = gameName,
                Timestamp = timestamp,
                Duration = TimeSpan.FromSeconds(durationSeconds),
                VideoFrames = avResult.FrameCount,
                SystemAudioSamples = avResult.SystemAudio.Length,
                MicrophoneAudioSamples = avResult.MicrophoneAudio.Length,
                Resolution = $"{_configManager.Config.Quality.Resolution}",
                Fps = _configManager.Config.Quality.Fps
            };

            var metadataPath = Path.Combine(outputDir, "metadata.json");
            var json = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(metadataPath, json);

            Logger.ClipSaved(outputDir, durationSeconds);
        }
        finally
        {
            _isSavingClip = false;
        }
    }

    private void OnFrameCaptured(object? sender, FrameCapturedEventArgs e)
    {
        if (_avBuffer == null) return;

        try
        {
            _avBuffer.AddVideoFrame(e.TexturePointer, e.TimestampTicks);
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

        if (e.BytesRecorded == 0 || _avBuffer == null) return;

        var copy = new byte[e.BytesRecorded];
        System.Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _avBuffer.AddSystemAudio(copy, e.TimestampTicks);
    }

    private static int _micChunkCount = 0;
    private void OnMicrophoneAudioAvailable(object? sender, AudioDataEventArgs e)
    {
        _micChunkCount++;
        if (_micChunkCount <= 3)
            Logger.Debug($"Microphone callback #{_micChunkCount}: {e.BytesRecorded} bytes");

        if (e.BytesRecorded == 0 || _avBuffer == null) return;

        var copy = new byte[e.BytesRecorded];
        System.Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _avBuffer.AddMicrophoneAudio(copy, e.TimestampTicks);
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
        _avBuffer?.Dispose();
        _hotkeyManager?.Dispose();
        _configManager?.Save();

        GC.SuppressFinalize(this);
    }
}

internal class WindowHandle : NativeWindow, IWin32Window
{
}