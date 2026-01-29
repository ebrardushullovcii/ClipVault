using System.Text.Json.Serialization;

namespace ClipVault.Core.Configuration;

/// <summary>
/// Main configuration for ClipVault.
/// Loaded from config/settings.json
/// </summary>
public sealed class ClipVaultConfig
{
    [JsonPropertyName("bufferDurationSeconds")]
    public int BufferDurationSeconds { get; set; } = 60;

    [JsonPropertyName("quality")]
    public QualitySettings Quality { get; set; } = new();

    [JsonPropertyName("hotkey")]
    public HotkeySettings Hotkey { get; set; } = new();

    [JsonPropertyName("audio")]
    public AudioSettings Audio { get; set; } = new();

    [JsonPropertyName("outputDirectory")]
    public string OutputDirectory { get; set; } = "./Clips";

    [JsonPropertyName("autoDetectGames")]
    public bool AutoDetectGames { get; set; } = true;

    [JsonPropertyName("captureMethod")]
    public string CaptureMethod { get; set; } = "auto";
}

public sealed class QualitySettings
{
    [JsonPropertyName("resolution")]
    public string Resolution { get; set; } = "1080p";

    [JsonPropertyName("fps")]
    public int Fps { get; set; } = 60;

    [JsonPropertyName("nvencPreset")]
    public string NvencPreset { get; set; } = "p4";

    [JsonPropertyName("rateControl")]
    public string RateControl { get; set; } = "cqp";

    [JsonPropertyName("cqLevel")]
    public int CqLevel { get; set; } = 22;

    [JsonPropertyName("bitrateKbps")]
    public int BitrateKbps { get; set; } = 8000;

    [JsonPropertyName("bufferCompressionQuality")]
    public int BufferCompressionQuality { get; set; } = 90;
}

public sealed class HotkeySettings
{
    [JsonPropertyName("modifiers")]
    public string[] Modifiers { get; set; } = ["Ctrl", "Alt"];

    [JsonPropertyName("key")]
    public string Key { get; set; } = "F9";
}

public sealed class AudioSettings
{
    [JsonPropertyName("captureSystemAudio")]
    public bool CaptureSystemAudio { get; set; } = true;

    [JsonPropertyName("captureMicrophone")]
    public bool CaptureMicrophone { get; set; } = true;

    [JsonPropertyName("sampleRate")]
    public int SampleRate { get; set; } = 48000;
}
