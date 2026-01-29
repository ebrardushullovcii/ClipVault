# ClipVault

A lightweight game clipping software for Windows, built with C# and designed for NVIDIA GPUs.

## Features

**Capture:**

- **Continuous full-screen capture** - Records entire screen at all times
- Rolling buffer (15s-3min configurable) with memory-efficient storage
- System audio + microphone as separate tracks
- Hardware encoding via NVENC (minimal performance impact)
- Global hotkey to save last X seconds
- Anti-cheat compatible (GDI-based, no injection)

**Game Detection (File Organization):**

- Detects 150+ games for automatic clip naming
- Uses game name in output folder (e.g., `League of Legends_2024-01-15_14-30-22/`)
- **Note:** Detection is for file naming only - capture is always full-screen
- Custom game support via JSON configuration

**Output:**

- Quality presets: 720p/1080p/1440p at 30/60 FPS
- Multi-track MP4 (video + system audio + mic)
- JSON metadata sidecar files
- Automatic thumbnail generation

## Requirements

- Windows 10 Version 1903+ (Build 18362+)
- .NET 8.0 Runtime
- NVIDIA GPU with NVENC support (GTX 600+ series)
- FFmpeg binaries (bundled or user-provided)

## Project Structure

```
ClipVault/
├── src/
│   ├── ClipVault.Core/          # Core library (capture, encoding, detection)
│   └── ClipVault.Service/       # Background service with tray icon
├── config/
│   ├── settings.json            # User configuration
│   └── games.json               # Game detection database (150+ games)
├── tools/
│   └── ffmpeg.exe               # FFmpeg binary (user must provide)
├── docs/
│   └── PLAN.md                  # Development plan and architecture
└── Clips/                       # Default output directory
```

## Quick Start

1. Clone the repository
2. Download FFmpeg with NVENC support and place in `tools/`
3. Build with `dotnet build`
4. Run `ClipVault.Service.exe`
5. Press `Ctrl+Alt+F9` (default) to save a clip

## Configuration

Edit `config/settings.json`:

```json
{
  "bufferDurationSeconds": 60,
  "quality": {
    "resolution": "1080p",
    "fps": 60,
    "nvencPreset": "p7",
    "cqLevel": 22
  },
  "hotkey": {
    "modifiers": ["Ctrl", "Alt"],
    "key": "F9"
  },
  "outputDirectory": "D:\\Clips"
}
```

## Development

This project is developed with AI coding assistants. Configuration files:

| File            | Tool                        |
| --------------- | --------------------------- |
| `AGENTS.md`     | OpenCode, Codex, generic AI |
| `CLAUDE.md`     | Claude, Cursor              |
| `opencode.json` | OpenCode CLI config         |
| `.cursorrules`  | Cursor IDE                  |

Documentation:

- `docs/PLAN.md` - Implementation plan with architecture
- `docs/CONVENTIONS.md` - Code style and conventions
- `CONTRIBUTING.md` - Setup and contribution guide

## Tech Stack

- **Screen Capture:** Windows.Graphics.Capture API + DXGI Desktop Duplication
- **Audio:** NAudio with WASAPI
- **Encoding:** FFmpeg.AutoGen with NVENC
- **DirectX:** Vortice.Windows

## License

MIT
