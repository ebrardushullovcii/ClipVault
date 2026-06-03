# ClipVault Goals

This document is the product intent for agents. Keep it stable and short. If a command, path, or API detail can be rediscovered from source, prefer the source.

## Product Goal

ClipVault is a Windows game clipping tool. It should run quietly, keep a rolling gameplay buffer, and save the last moments of play as local MP4 clips when the user presses the configured hotkey.

The core promise:

- Always-on replay buffer while ClipVault is running.
- F9 by default saves the recent buffer without interrupting gameplay.
- Saved clips are ordinary MP4 files.
- Desktop/game audio and microphone audio stay on separate tracks.
- The Electron UI lets users browse, trim, adjust audio, tag, and export clips.

## User Experience Goals

- Packaged Windows behavior matters most. Dev mode is useful for iteration, but the shipped app is the installer or portable build.
- Tray behavior must stay predictable. Users need a reliable way to see whether clipping is active and to control the app/service.
- Capture should be anti-cheat friendly. Prefer monitor capture and avoid game-process hooks or injection unless the user explicitly reopens that decision.
- Settings should survive upgrades and be shared by the backend and UI.
- Clips should remain local and user-owned. Do not add accounts, cloud storage, telemetry, or remote processing without an explicit product decision.

## Current Product Surface

- `src/` contains the C++ backend: OBS startup, capture, encoders, replay buffer, hotkey, tray/service behavior, settings, logging, and game detection.
- `ui/` contains the Electron and React app: library, editor, settings, exports, thumbnails, audio extraction, IPC, packaging metadata, and installer integration.
- `bin/` is the backend build output and bundled runtime source for packaged Electron builds.
- `ui/release/` is the packaged app output.

## Non-Goals

- ClipVault is not a streaming app.
- ClipVault is not a cloud clip manager.
- ClipVault is not meant to hook directly into game processes.
- The docs should not mirror package scripts, generated layouts, or source files line by line.

## Agent Working Agreement

- Read [docs/DECISIONS.md](DECISIONS.md) before changing backend capture, libobs setup, audio routing, packaging, persistent paths, release flow, tray behavior, or startup behavior.
- Use source as the current truth for exact commands and runtime paths. Start with `package.json`, `ui/package.json`, `build.ps1`, `src/`, and `ui/src/main/main.ts`.
- Preserve the product goals above when proposing new features. If a change intentionally breaks one, record the new rationale in [docs/DECISIONS.md](DECISIONS.md).
- Keep future docs goal-oriented or decision-oriented. Avoid adding long command references that drift from scripts.
