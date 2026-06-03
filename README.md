# ClipVault

A lightweight game clipping tool for Windows. Press F9 to save the last moments of gameplay as a high-quality MP4 with separate desktop/game audio and microphone tracks.

## Features

- Always-on replay buffer while the app is running.
- Separate desktop and microphone audio tracks.
- Anti-cheat-friendly monitor capture by default.
- NVENC hardware encoding with x264 fallback.
- Clip library, trimming, audio controls, tagging, favorites, and export tools.
- Portable and installer builds for Windows.

## Requirements

- Windows 10/11.
- NVIDIA GPU for NVENC, or CPU encoding through x264 fallback.
- Enough free disk space for local MP4 clips.

## Quick Start

Run ClipVault, leave it running in the tray, play normally, then press F9 to save a clip. Saved clips appear in the library where they can be edited and exported.

Settings are stored at `%APPDATA%\ClipVault\settings.json` and can be changed in the Settings UI.

## Building From Source

```powershell
npm install
npm run backend:build
npm run package:portable
```

Useful scripts are defined in `package.json` and `ui/package.json`.

## Project Structure

```text
ClipVault/
|-- src/           # C++ backend using libobs
|-- ui/            # Electron + React frontend
|-- bin/           # Backend build output and bundled runtime source
|-- config/        # Default settings and game database assets
\-- docs/          # Product goals and durable technical decisions
```

## Documentation

- [AGENTS.md](AGENTS.md): agent guide and repo working rules.
- [docs/GOALS.md](docs/GOALS.md): product goals, boundaries, and source-of-truth guidance.
- [docs/DECISIONS.md](docs/DECISIONS.md): durable architecture and implementation rationale.
- [CHANGELOG.md](CHANGELOG.md): release history.
- [CONTRIBUTING.md](CONTRIBUTING.md): contributor guidance.

## License

GPL-2.0-or-later.

This project uses libobs from OBS Studio, which is licensed under GPL-2.0-or-later. As required by the GPL, this project is also licensed under GPL-2.0-or-later.
