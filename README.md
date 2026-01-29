# ClipVault

A lightweight game clipping software for Windows, built with C++ and libobs.

## Why ClipVault?

Existing game clipping tools are frustrating:

- **Ads & Upsells**: Free tools nag for upgrades or show ads
- **Crashes**: Unreliable when you need them most
- **Bloat**: Heavy resource usage, slow startup, unnecessary features
- **No Control**: Can't customize behavior or fix issues yourself

**ClipVault is different**: Simple, lightweight, does exactly what's needed - nothing more. You control everything. No ads, no telemetry, no bloat. If something breaks, you can fix it.

## Architecture

Built on libobs (GPL-2.0) - the same core as OBS Studio, providing:

- **Rock-solid A/V sync** - libobs handles timestamps and synchronization
- **Display capture** via DXGI Desktop Duplication
- **Audio capture** via WASAPI
- **Hardware encoding** via NVIDIA NVENC
- **Anti-cheat compatible** - no injection, no process hooks

## Tech Stack

- **Capture**: libobs + DXGI Desktop Duplication
- **Audio**: WASAPI through libobs
- **Encoding**: NVENC through libobs
- **UI**: Minimal native Win32

## Building

Requires:

- CMake 3.28+
- NVIDIA GPU with NVENC support

## License

GNU General Public License Version 2 (GPL-2.0)
