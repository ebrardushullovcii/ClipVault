using System.Text.Json;

namespace ClipVault.Core.Configuration;

public sealed class ConfigManager
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _configPath;
    private ClipVaultConfig? _config;

    public ClipVaultConfig Config => _config ?? throw new InvalidOperationException("Config not loaded");

    public ConfigManager(string configPath)
    {
        _configPath = configPath;
    }

    public static ConfigManager CreateDefault(string basePath)
    {
        return new ConfigManager(Path.Combine(basePath, "config", "settings.json"));
    }

    public void Load()
    {
        if (!File.Exists(_configPath))
        {
            _config = new ClipVaultConfig();
            Save();
            return;
        }

        var json = File.ReadAllText(_configPath);
        _config = JsonSerializer.Deserialize<ClipVaultConfig>(json, JsonOptions);

        if (_config == null)
        {
            _config = new ClipVaultConfig();
        }
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_configPath) ?? throw new InvalidOperationException("Invalid config path"));

        var json = JsonSerializer.Serialize(_config, JsonOptions);
        File.WriteAllText(_configPath, json);
    }

    public void Reload()
    {
        Load();
    }
}