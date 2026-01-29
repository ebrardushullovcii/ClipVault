# AGENTS.md - AI Coding Assistant Instructions

This file provides instructions for AI coding assistants (OpenCode, Claude, Cursor, etc.)

> **OpenCode users**: This file is auto-loaded. See also `opencode.json` for config.
> Additional context in `docs/CONVENTIONS.md` and `docs/PLAN.md`.

## Project Overview

**ClipVault** is a Windows game clipping software built in C#/.NET 8. It captures gameplay with a rolling buffer and saves clips on hotkey press using NVENC hardware encoding.

## Quick Reference

- **Language:** C# 12 / .NET 8.0
- **Platform:** Windows 10+ (Build 18362+)
- **GPU:** NVIDIA with NVENC (GTX 600+)

## Tech Stack

| Component      | Technology                                      | Status      |
| -------------- | ----------------------------------------------- | ----------- |
| Screen Capture | GDI + Screen.CopyFromScreen (full screen, 720p) | Implemented |
| Screen Capture | Windows.Graphics.Capture API (window)           | Not done    |
| Screen Capture | DXGI Desktop Duplication (fallback)             | Not done    |
| Audio          | NAudio 2.2+ with WASAPI                         | Implemented |
| Encoding       | FFmpeg process with NVENC                       | Implemented |
| DirectX        | Vortice.Direct3D11/DXGI (not currently used)    | Available   |
| WinRT          | Microsoft.Windows.CsWinRT (not currently used)  | Available   |

## Project Structure

```
root/
  Program.cs              # Entry point (WinExe)
  ClipVault.csproj        # Main project
  src/
    ClipVault.Core/        # Core library (no UI dependencies)
      Audio/               # WASAPI capture
      Buffer/              # Ring buffers
      Capture/             # Screen capture (GDI)
      Configuration/       # Settings
      Detection/           # Game detection
      Encoding/            # FFmpeg/NVENC
    ClipVault.Service/     # Library (ClipVaultService class)
config/
  settings.json          # User settings
  games.json             # 150+ game definitions
docs/
  PLAN.md               # Implementation plan
  CONVENTIONS.md        # Code conventions
```

## Code Conventions

See `docs/CONVENTIONS.md` for full guidelines:

- File-scoped namespaces
- `required` modifier for mandatory properties
- Records for immutable data types
- Private fields: `_camelCase`
- Async/await for I/O
- IDisposable for unmanaged resources

## Important Rules

- **NEVER commit changes to git** - The user will commit manually
- **Always run/build from root** - Use `dotnet build` and `dotnet run` from the project root, not from subdirectories
- **Document recurring preferences** - If the user expresses a rule like "always X" or "never Y" (e.g., "always put logs in one file", "never require cd into subdirectories"), ask if they want it added to AGENTS.md so future assistants follow it too

## Key Interfaces

```csharp
// Screen capture
public interface IScreenCapture : IDisposable
{
    event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    bool IsCapturing { get; }
    Task StartAsync(CancellationToken ct = default);
    Task StopAsync();
}

// Audio capture
public interface IAudioCapture : IDisposable
{
    event EventHandler<AudioDataEventArgs>? DataAvailable;
    AudioFormat Format { get; }
    Task StartAsync(CancellationToken ct = default);
    Task StopAsync();
}
```

## Critical Implementation Notes

### Screen Capture

- **Always full-screen capture** - Records entire screen continuously
- Uses GDI `Screen.CopyFromScreen` (anti-cheat compatible)
- Target resolution configurable (720p/1080p/1440p) via settings.json
- No window-specific capture (future: Windows.Graphics.Capture API)

### Game Detection (File Naming Only)

- Detects focused game for **folder naming** (e.g., `GameName_2024-01-15_14-30-22/`)
- Detection does NOT start/stop capture - capture is always running
- Capture continues regardless of which window is focused

### NVENC Encoding

- Process-based FFmpeg (not FFmpeg.AutoGen)
- P7 preset, CQP 22 rate control, zero-latency settings
- Multi-track audio: system + mic as separate streams

### Audio (NAudio)

- 48kHz stereo float32
- **Copy buffers immediately** in DataAvailable handlers (they're reused!)

## Build Commands

```bash
dotnet build              # Build from root
dotnet run                # Run service (from root)
dotnet publish -c Release # Release build
```

## Testing Priority

1. Capture works with windowed games
2. Audio produces valid samples
3. A/V sync maintained
4. Hotkey triggers save
5. Valorant/League work (anti-cheat)

## File References

- [Implementation Plan](docs/PHASE1_PLAN.md)
- [Code Conventions](docs/CONVENTIONS.md)
- [Settings Schema](config/settings.json)
- [Game Database](config/games.json)
