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
    private IAudioCapture? _audioCapture;
    private HotkeyManager? _hotkeyManager;
    private VideoFrameBuffer? _videoBuffer;
    private AudioSampleBuffer? _audioBuffer;

    private bool _isCapturing;
    private bool _disposed;

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
        _audioBuffer = new AudioSampleBuffer(
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

        if (_isCapturing && _configManager.Config.AutoDetectGames)
        {
            StopCapture();
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
        if (_isCapturing)
            return;

        Logger.Info($"Starting capture for window: {windowHandle}");

        // DON'T clear buffers on restart - we want to keep rolling buffer across focus changes

        try
        {
            _screenCapture = new WindowsGraphicsCapture(windowHandle);
            _screenCapture.FrameCaptured += OnFrameCaptured;
            _ = _screenCapture.StartAsync();
            Logger.Info("Screen capture initialized successfully");
        }
        catch (Exception ex)
        {
            Logger.Error("Failed to start screen capture", ex);
            _screenCapture = null;
        }

        // Only start audio capture once (keep it running across focus changes)
        if (_configManager.Config.Audio.CaptureSystemAudio && _audioCapture == null)
        {
            try
            {
                _audioCapture = new SystemAudioCapture();
                _audioCapture.DataAvailable += OnAudioAvailable;
                _ = _audioCapture.StartAsync();
                Logger.AudioStarted(_audioCapture.Format.SampleRate, _audioCapture.Format.Channels);
            }
            catch (Exception ex)
            {
                Logger.AudioFailed(ex.Message);
                _audioCapture = null;
            }
        }

        _isCapturing = true;
        Logger.CaptureStarted(_gameDetector.CurrentGame?.Name ?? "Unknown");
        UpdateTrayStatus();
    }

    public void StopCapture()
    {
        if (!_isCapturing)
            return;

        var gameName = _gameDetector.CurrentGame?.Name ?? "Unknown";
        Logger.Info($"Stopping capture for: {gameName}");

        _screenCapture?.StopAsync().Wait(TimeSpan.FromSeconds(1));
        _screenCapture?.Dispose();
        _screenCapture = null;

        // DON'T stop audio capture on focus change - keep it running for continuous buffer
        // Audio will be stopped when app exits

        _isCapturing = false;
        Logger.CaptureStopped(gameName);
        UpdateTrayStatus();
    }

    public void SaveClip()
    {
        Logger.Info("Saving clip...");

        var timestamp = DateTime.Now;
        var gameName = _gameDetector.CurrentGame?.Name ?? "Unknown";

        var folderName = $"{gameName}_{timestamp:yyyy-MM-dd_HH-mm-ss}";
        var outputDir = Path.Combine(_basePath, _configManager.Config.OutputDirectory, folderName);
        Directory.CreateDirectory(outputDir);

        var frames = _videoBuffer?.GetAll() ?? Array.Empty<CoreEncoding.TimestampedFrame>();
        var audioSamples = _audioBuffer?.GetAll() ?? Array.Empty<CoreEncoding.TimestampedAudio>();

        var duration = _videoBuffer?.GetBufferedDuration(_configManager.Config.Quality.Fps) ?? TimeSpan.Zero;

        Logger.Info($"Buffered frames: {frames.Length}, audio samples: {audioSamples.Length}");

        var videoPath = Path.Combine(outputDir, "clip.mp4");

        try
        {
            // Use actual captured dimensions from first frame, not hardcoded values
            var firstFrame = frames.FirstOrDefault();
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
            encoder.EncodeAsync(
                videoPath,
                frames.ToList(),
                audioSamples.ToList(),
                null,
                settings,
                null,
                CancellationToken.None).GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Logger.Error("Encoding failed", ex);
        }

        var metadata = new
        {
            Game = gameName,
            Timestamp = timestamp,
            Duration = duration,
            VideoFrames = frames.Length,
            AudioSamples = audioSamples.Length,
            Resolution = $"{_configManager.Config.Quality.Resolution}",
            Fps = _configManager.Config.Quality.Fps
        };

        var metadataPath = Path.Combine(outputDir, "metadata.json");
        var json = System.Text.Json.JsonSerializer.Serialize(metadata, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(metadataPath, json);

        Logger.ClipSaved(outputDir, duration.TotalSeconds);
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
    private void OnAudioAvailable(object? sender, AudioDataEventArgs e)
    {
        _audioChunkCount++;
        if (_audioChunkCount <= 3)
            Logger.Debug($"OnAudioAvailable called #{_audioChunkCount}: {e.BytesRecorded} bytes");

        if (e.BytesRecorded == 0 || _audioBuffer == null) return;

        var copy = new byte[e.BytesRecorded];
        System.Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);
        _audioBuffer.Add(copy, e.TimestampTicks);
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
        _audioCapture?.Dispose();
        _videoBuffer?.Dispose();
        _audioBuffer?.Dispose();
        _hotkeyManager?.Dispose();
        _configManager?.Save();

        GC.SuppressFinalize(this);
    }
}

internal class WindowHandle : NativeWindow, IWin32Window
{
}