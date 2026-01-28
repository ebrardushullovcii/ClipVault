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

| Component      | Technology                                              |
| -------------- | ------------------------------------------------------- |
| Screen Capture | Windows.Graphics.Capture API + DXGI Desktop Duplication |
| Audio          | NAudio 2.2+ with WASAPI                                 |
| Encoding       | FFmpeg.AutoGen with NVENC                               |
| DirectX        | Vortice.Direct3D11/DXGI                                 |
| WinRT          | Microsoft.Windows.CsWinRT v2.2.0                        |

## Project Structure

```
src/
  ClipVault.Core/        # Core library (no UI dependencies)
    Audio/               # WASAPI capture
    Buffer/              # Ring buffers
    Capture/             # Screen capture
    Configuration/       # Settings
    Detection/           # Game detection
    Encoding/            # FFmpeg/NVENC
  ClipVault.Service/     # Background service + tray icon
config/
  settings.json          # User settings
  games.json             # 150+ game definitions
docs/
  PLAN.md               # Implementation plan
  CONVENTIONS.md        # Code conventions
```

## Code Conventions

- Use file-scoped namespaces
- Use `required` modifier for mandatory properties
- Use records for immutable data types
- Private fields: `_camelCase`
- Always use async/await for I/O
- Implement IDisposable for unmanaged resources

## Important Rules

- **NEVER commit changes to git** - The user will commit manually

## Key Interfaces

```csharp
// Screen capture - implement for new capture methods
public interface IScreenCapture : IDisposable
{
    event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    Task StartAsync(CancellationToken ct);
    Task StopAsync();
}

// Audio capture - implement for new audio sources
public interface IAudioCapture : IDisposable
{
    event EventHandler<AudioDataEventArgs>? DataAvailable;
    AudioFormat Format { get; }
    Task StartAsync(CancellationToken ct);
    Task StopAsync();
}
```

## Critical Implementation Notes

### Screen Capture

- Use `Direct3D11CaptureFramePool.CreateFreeThreaded()` for 60fps
- Set `MinUpdateInterval` >= 1ms (lower values throttle to ~50fps)
- DXGI Desktop Duplication is fallback for anti-cheat games

### NVENC Encoding

- Use P7 preset for quality (dedicated hardware, no game impact)
- Use CQP 22 rate control (not CBR)
- Low-latency: `delay=0`, `zerolatency=1`, `gop_size=1`

### Audio (NAudio)

- Standardize to 48kHz stereo float32
- **Copy buffers immediately** in DataAvailable handlers (they're reused!)

### Anti-Cheat (Riot Vanguard)

- NO injection or hooking
- Window capture and Desktop Duplication work fine
- Game capture hooks cause issues

## Build Commands

```bash
dotnet build                    # Build all
dotnet run                      # Run service (from root)
dotnet publish -c Release       # Release build
```

## Testing Priority

1. Capture works with windowed games
2. Audio produces valid samples
3. A/V sync maintained
4. Hotkey triggers save
5. Valorant/League work (anti-cheat)

## File References

- [Implementation Plan](docs/PLAN.md)
- [Code Conventions](docs/CONVENTIONS.md)
- [Settings Schema](config/settings.json)
- [Game Database](config/games.json)
