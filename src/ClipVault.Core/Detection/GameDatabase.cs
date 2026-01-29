using System.Text.Json;
using System.Text.Json.Serialization;

namespace ClipVault.Core.Configuration;

public sealed class GameDatabase
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly string _gamesPath;
    private List<GameDefinition> _games = [];
    private List<GameDefinition> _customGames = [];

    public IReadOnlyList<GameDefinition> AllGames => _games.Concat(_customGames).ToList();

    public GameDatabase(string gamesPath)
    {
        _gamesPath = gamesPath;
    }

    public static GameDatabase CreateDefault(string basePath)
    {
        return new GameDatabase(Path.Combine(basePath, "config", "games.json"));
    }

    public void Load()
    {
        if (!File.Exists(_gamesPath))
        {
            _games = [];
            Logger.Error($"games.json not found at: {_gamesPath}");
            return;
        }

        var json = File.ReadAllText(_gamesPath);
        var data = JsonSerializer.Deserialize<GamesDatabaseFile>(json, JsonOptions);

        _games = data?.Games ?? [];
        _customGames = data?.CustomGames ?? [];

        Logger.Debug($"GameDatabase.Load(): Loaded {_games.Count} games + {_customGames.Count} custom from {_gamesPath}");
    }

    public GameDefinition? FindGameByProcessName(string processName)
    {
        var allGames = AllGames;

        var exactMatch = allGames.FirstOrDefault(g =>
            g.ProcessNames.Contains(processName, StringComparer.OrdinalIgnoreCase));

        if (exactMatch != null) return exactMatch;

        var withExt = processName + ".exe";
        return allGames.FirstOrDefault(g =>
            g.ProcessNames.Contains(withExt, StringComparer.OrdinalIgnoreCase));
    }

    public IReadOnlyList<GameDefinition> FindGamesByProcessNames(IEnumerable<string> processNames)
    {
        var nameSet = new HashSet<string>(processNames, StringComparer.OrdinalIgnoreCase);
        return AllGames.Where(g => g.ProcessNames.Any(p => nameSet.Contains(p))).ToList();
    }

    public void AddCustomGame(GameDefinition game)
    {
        _customGames.Add(game);
    }

    public void RemoveCustomGame(string gameName)
    {
        _customGames.RemoveAll(g => g.Name.Equals(gameName, StringComparison.OrdinalIgnoreCase));
    }

    public void SaveCustomGames()
    {
        if (!File.Exists(_gamesPath))
            return;

        var json = File.ReadAllText(_gamesPath);
        var data = JsonSerializer.Deserialize<GamesDatabaseFile>(json, JsonOptions);

        if (data != null)
        {
            data.CustomGames = _customGames;
            var newJson = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_gamesPath, newJson);
        }
    }
}

public sealed record GameDefinition(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("processNames")] string[] ProcessNames,
    [property: JsonPropertyName("twitchId")] string? TwitchId
);

internal sealed class GamesDatabaseFile
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.0";

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("games")]
    public List<GameDefinition> Games { get; set; } = [];

    [JsonPropertyName("customGames")]
    public List<GameDefinition> CustomGames { get; set; } = [];
}