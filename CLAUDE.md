# CLAUDE.md - Claude AI Instructions

This file provides context for Claude (claude.ai, Claude Code, Cursor) working on ClipVault.
For other AI tools, see also: `AGENTS.md`, `.cursorrules`, `opencode.json`.

## Project Overview

ClipVault is a Windows game clipping software that captures gameplay with a rolling buffer and saves clips on hotkey press. It uses hardware NVENC encoding for minimal performance impact.

## Tech Stack

- **Language:** C# / .NET 8.0
- **Screen Capture:** Windows.Graphics.Capture API (primary), DXGI Desktop Duplication (fallback)
- **Audio:** NAudio 2.2+ with WASAPI (loopback + microphone)
- **Encoding:** FFmpeg.AutoGen with NVENC hardware encoding
- **DirectX Interop:** Vortice.Direct3D11, Vortice.DXGI
- **WinRT Interop:** Microsoft.Windows.CsWinRT v2.2.0

## Key Architecture Decisions

1. **Rolling Buffer:** Keep frames in GPU memory (D3D11 textures), audio in CPU memory (~110MB for 5min)
2. **Two capture methods:** WGC for window capture, DXGI DD as fallback for anti-cheat issues
3. **NVENC encoding:** Use P7 preset (highest quality), CQP 22 rate control, zero-latency settings
4. **No database:** All config/metadata in JSON files
5. **Separate audio tracks:** System audio and mic as separate MP4 tracks for non-destructive editing

## Code Conventions

See `docs/CONVENTIONS.md` for full code style guide. Key points:

- File-scoped namespaces
- Records for immutable data
- Private fields: `_camelCase`
- Always async/await for I/O

## Important Technical Notes

### Screen Capture

- Use `Direct3D11CaptureFramePool.CreateFreeThreaded()` for 60fps
- Set `MinUpdateInterval` to at least 1ms (values <1ms throttle to ~50fps)
- Borderless windowed mode more reliable than fullscreen exclusive

### NVENC

- P7 preset for quality (dedicated hardware, no game impact)
- CQP 22 for recording (not CBR which is for streaming)
- Low-latency: `delay=0`, `zerolatency=1`, `gop_size=1`, `max_b_frames=0`

### Audio (NAudio)

- Standardize to 48kHz stereo float32
- Copy buffers immediately in DataAvailable handlers (they're reused!)
- Use sample-based timestamping for A/V sync

### Anti-Cheat (Riot Vanguard)

- NO injection or hooking - use only standard Windows APIs
- OBS Game Capture has issues, but window/desktop capture works
- Medal.tv, ShadowPlay approach works fine

## Common Tasks

### Adding a new capture method

1. Implement `IScreenCapture` interface in `ClipVault.Core/Capture/`
2. Add to `CaptureManager` factory method
3. Update `CaptureMethod` enum in configuration

### Adding a new game to detection

1. Edit `config/games.json`
2. Add to `customGames` array for user additions
3. Find process name via Task Manager or Process Explorer

### Debugging capture issues

1. Check if game uses protected content (black frames)
2. Try DXGI Desktop Duplication fallback
3. Verify window handle with Spy++
4. Check if game is fullscreen exclusive vs borderless

## Build Commands

```bash
# Build entire solution
dotnet build

# Build specific project
dotnet build src/ClipVault.Core/ClipVault.Core.csproj

# Run service
dotnet run --project src/ClipVault.Service/ClipVault.Service.csproj

# Publish release
dotnet publish -c Release -r win-x64 --self-contained
```

## Testing

When testing capture:

1. Start with a simple windowed game (Minecraft, etc.)
2. Verify frames are being captured (check buffer count)
3. Test save functionality with short buffer (10s)
4. Verify audio tracks are present and synced
5. Test with Valorant/League last (anti-cheat games)

## Documentation

- `docs/PLAN.md` - Full implementation plan with architecture diagrams
- `README.md` - User-facing documentation
- Code comments for complex logic only (self-documenting code preferred)

## Phase 1 vs Phase 2

**Phase 1 (Current):** Core engine with minimal UI

- Rolling buffer capture
- Game detection
- Hotkey save
- JSON configuration
- System tray icon only

**Phase 2 (Future):** Full UI

- Clip library browser
- Non-destructive editor
- Timeline with trim handles
- Export with edits applied
