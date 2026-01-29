# Contributing to ClipVault

## For AI Assistants

Read these files before making changes:

1. `AGENTS.md` - Project overview and technical context
2. `CLAUDE.md` - Claude-specific instructions and libobs patterns
3. Context from previous conversations (check git history)

## For Human Developers

### Prerequisites

- Windows 10 Version 1903+ (Build 18362+)
- Visual Studio 2022 with C++ Desktop Development
- CMake 3.28+
- NVIDIA GPU with NVENC support

### Building

```bash
# Clone and build
git clone <repo-url>
cd ClipVault
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022"
cmake --build . --config Release

# Run the service
./Release/ClipVault.exe
```

### Project Structure

```
src/
  clipvault/       # Main application
    main.cpp       # Entry point
    hotkey.cpp/h   # Global hotkey handling
    buffer.cpp/h   # Rolling buffer
    config.cpp/h   # Configuration loading
  obs-frontend/    # libobs frontend wrapper
libobs/            # libobs as submodule
config/
  settings.json    # User configuration
  games.json       # Game detection database
```

### Code Style

Follow CLAUDE.md for guidelines. Key points:

- C++17 standard
- File-scoped namespaces where possible
- RAII for resource management
- Use libobs APIs before custom code
- Comment non-obvious code

### Testing Changes

1. Build succeeds: `cmake --build . --config Release`
2. No new warnings: Check build output
3. Test with a windowed game first
4. Test with Valorant/League last (anti-cheat)

### Pull Request Guidelines

1. One feature/fix per PR
2. Update documentation if needed
3. Follow existing code patterns
4. Test with at least one game

## Architecture Decisions

Key decisions should be documented when made. Major changes should be discussed first.

### Why libobs?

- **Rock-solid A/V sync**: libobs handles timestamps and synchronization
- **DXGI capture**: Works with anti-cheat, no injection needed
- **NVENC integration**: Direct hardware encoding
- **Battle-tested**: Same core as OBS Studio