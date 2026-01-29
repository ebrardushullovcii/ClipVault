using NAudio.CoreAudioApi;
using NAudio.Wave;
using ClipVault.Core;

namespace ClipVault.Core.Audio;

/// <summary>
/// Captures system audio using WASAPI loopback.
/// </summary>
public sealed class SystemAudioCapture : IAudioCapture
{
    private WasapiLoopbackCapture? _capture;
    private WaveFormat? _waveFormat;
    private readonly byte[][] _bufferPool;
    private int _bufferIndex;
    private bool _isCapturing;
    private bool _disposed;

    public event EventHandler<AudioDataEventArgs>? DataAvailable;
    public AudioFormat Format { get; private set; } = null!;
    public bool IsCapturing => _isCapturing;

    public SystemAudioCapture()
    {
        _bufferPool = new byte[4][];
        for (var i = 0; i < _bufferPool.Length; i++)
        {
            _bufferPool[i] = new byte[65536];  // 64KB buffers to handle 23040 byte callbacks
        }
    }

    public Task StartAsync(CancellationToken cancellationToken = default)
    {
        if (_isCapturing)
            return Task.CompletedTask;

        var enumerator = new MMDeviceEnumerator();
        var device = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia);
        _waveFormat = device.AudioClient.MixFormat;

        if (_waveFormat.SampleRate != 48000 || _waveFormat.Channels != 2)
        {
            _waveFormat = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
        }

        Format = new AudioFormat(_waveFormat.SampleRate, _waveFormat.Channels, 32);

        _capture = new WasapiLoopbackCapture(device);
        _capture.WaveFormat = _waveFormat;
        _capture.DataAvailable += OnDataAvailable;

        Logger.Debug($"Starting WASAPI loopback on device: {device.FriendlyName}");
        _capture.StartRecording();
        Logger.Debug("WASAPI recording started");

        _isCapturing = true;
        return Task.CompletedTask;
    }

    public Task StopAsync()
    {
        if (!_isCapturing || _capture == null)
            return Task.CompletedTask;

        _capture.DataAvailable -= OnDataAvailable;
        _capture.StopRecording();
        _capture.Dispose();
        _capture = null;

        _isCapturing = false;
        return Task.CompletedTask;
    }

    private static int _callbackCount = 0;
    private long _startTimestampTicks;
    private bool _firstAudioReceived;

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        _callbackCount++;
        if (_callbackCount == 1 || _callbackCount % 500 == 0)
        {
            Logger.Debug($"Audio callback #{_callbackCount}: {e.BytesRecorded} bytes, hasSubscriber={DataAvailable != null}");
        }

        if (e.BytesRecorded == 0 || DataAvailable == null)
            return;

        // Capture timestamp - use raw timestamp, encoder handles sync
        var captureTimestamp = Core.NativeMethods.GetHighResolutionTimestamp();

        if (!_firstAudioReceived)
        {
            _firstAudioReceived = true;
            _startTimestampTicks = captureTimestamp;
            Logger.Debug($"First system audio captured at tick {captureTimestamp}");
        }

        var buffer = GetBuffer();
        System.Buffer.BlockCopy(e.Buffer, 0, buffer, 0, e.BytesRecorded);

        if (_callbackCount <= 3 || _callbackCount % 1000 == 0)
        {
            Logger.Debug($"System audio #{_callbackCount}: {e.BytesRecorded} bytes @ {captureTimestamp}");
        }

        try
        {
            DataAvailable.Invoke(this, new AudioDataEventArgs
            {
                Buffer = buffer,
                TimestampTicks = captureTimestamp,
                BytesRecorded = e.BytesRecorded
            });
        }
        catch (Exception ex)
        {
            Logger.Error($"Audio event invoke failed: {ex.Message}");
        }
    }

    private byte[] GetBuffer()
    {
        var buffer = _bufferPool[_bufferIndex];
        _bufferIndex = (_bufferIndex + 1) % _bufferPool.Length;
        return buffer;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopAsync().Wait(TimeSpan.FromSeconds(1));
        _capture?.Dispose();
    }
}