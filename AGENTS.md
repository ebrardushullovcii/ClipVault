# Agent Configuration

This file configures how AI assistants should approach the ClipVault project.

## Project Context

ClipVault is a lightweight game clipping tool built on libobs (the core of OBS Studio). The key goals are:
- Rock-solid A/V sync (handled by libobs)
- Minimal resource usage during capture
- Anti-cheat compatibility (no injection)
- Simple, understandable codebase

## Tech Stack

- **Language**: C++17
- **Build System**: CMake
- **Capture Engine**: libobs (OBS Studio core)
- **Rendering**: Direct3D 11 (via libobs)
- **Encoding**: NVIDIA NVENC (via libobs)
- **Audio**: WASAPI (via libobs)
- **UI**: Minimal Win32

## What libobs Provides

libobs handles:
- Screen capture via DXGI Desktop Duplication
- Audio capture via WASAPI
- A/V synchronization (timestamps, clock management)
- NVENC encoding
- Output muxer (MP4, FLV, etc.)
- Signal/slot system for events

## What We Need to Build

1. **libobs integration** - Compile and link libobs
2. **Custom frontend** - Minimal app that uses libobs Frontend API
3. **Hotkey handling** - Win32 RegisterHotKey
4. **Rolling buffer** - Store recent frames in memory
5. **Clip saving** - Save last N seconds on hotkey
6. **Game detection** - Detect focused game for folder naming

## Key Files Structure

```
ClipVault/
├── libobs/              # libobs as submodule or bundled
├── src/
│   ├── clipvault/       # Main application
│   │   ├── main.cpp
│   │   ├── hotkey.cpp/h
│   │   ├── buffer.cpp/h
│   │   └── config.cpp/h
│   └── obs-frontend/    # Minimal OBS frontend wrapper
├── CMakeLists.txt
└── config/
    ├── settings.json
    └── games.json
```

## Build Instructions

```bash
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022"
cmake --build . --config Release
```

## Important Notes

- libobs is GPL-2.0 licensed - this project must be GPL-2.0 compatible
- libobs provides excellent A/V sync - don't try to reimplement it
- Use libobs signals for frame capture events
- Rolling buffer can use libobs video callbacks