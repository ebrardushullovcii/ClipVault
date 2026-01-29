# Contributing to ClipVault

## For AI Assistants

Read these files before making changes:

1. `AGENTS.md` - Project overview and technical context
2. `docs/CONVENTIONS.md` - Code style requirements
3. `docs/PLAN.md` - Implementation plan and architecture

## For Human Developers

### Prerequisites

- Windows 10 Version 1903+ (Build 18362)
- .NET 8.0 SDK
- NVIDIA GPU with NVENC support
- FFmpeg binaries (see `tools/README.md`)

### Building

```bash
# Clone and build
git clone <repo-url>
cd ClipVault
dotnet build

# Run the service
dotnet run --project src/ClipVault.Service
# Or run directly (output goes to src/ClipVault.Service/bin/)
```

### Project Structure

```
src/
  ClipVault.Core/       # Core library (no UI dependencies!)
  ClipVault.Service/    # Background service with tray icon
config/
  settings.json         # User configuration
  games.json           # Game detection database
docs/
  PLAN.md              # Implementation plan
  CONVENTIONS.md       # Code conventions
```

### Code Style

See `docs/CONVENTIONS.md` for complete guidelines. Key points:

- File-scoped namespaces
- Records for immutable data types
- Private fields: `_camelCase`
- Async/await for all I/O operations
- Implement IDisposable for unmanaged resources

### Testing Changes

1. Build succeeds: `dotnet build`
2. No new warnings: Check build output
3. Test with a windowed game first
4. Test with Valorant/League last (anti-cheat)

### Pull Request Guidelines

1. One feature/fix per PR
2. Update documentation if needed
3. Follow existing code patterns
4. Test with at least one game

## Architecture Decisions

Key decisions are documented in `docs/PLAN.md`. Major changes should be discussed first.

### Why these choices?

- **Windows.Graphics.Capture**: Modern API, window-specific capture, works with anti-cheat
- **DXGI Desktop Duplication**: Fallback when WGC fails
- **NAudio**: Most mature C# audio library
- **FFmpeg.AutoGen**: Direct bindings, better than Process piping for real-time
- **NVENC**: Hardware encoding, zero game impact
