# ClipVault Agent Guide

Read this first. For any product behavior, backend, packaging, persistent path, release-flow, tray/startup, or OBS change, also read:

- [docs/GOALS.md](docs/GOALS.md) for product intent and boundaries.
- [docs/DECISIONS.md](docs/DECISIONS.md) for rationale that should not be rediscovered.

## What Is ClipVault?

ClipVault is a Windows game clipping tool. It keeps a rolling gameplay buffer and saves a local MP4 clip when the user presses the configured hotkey, F9 by default. Desktop/game audio and microphone audio are kept on separate tracks for editing.

The repo has two main parts:

- `src/`: C++ backend using libobs for capture, encoding, replay saving, hotkey, tray/service behavior, settings, logging, and game detection.
- `ui/`: Electron + React UI for clip browsing, editing, settings, exports, thumbnails, audio extraction, IPC, packaging, and installer behavior.

## Source Of Truth

Use source and scripts for exact facts:

- `package.json` and `ui/package.json`: build, test, lint, package, and release scripts.
- `build.ps1`, `setup-obs.ps1`, `scripts/`: backend build and OBS/FFmpeg runtime setup.
- `src/obs_core.cpp`, `src/capture.cpp`, `src/encoder.cpp`, `src/replay.cpp`, `src/hotkey.cpp`: critical recording pipeline behavior.
- `ui/src/main/main.ts`, `ui/build/afterPack.cjs`, `ui/package.json`: Electron paths, IPC, backend launch, packaging, resources, installer metadata.
- `CHANGELOG.md`: release history.

## Common Commands

Run from the repo root unless a script says otherwise:

```powershell
npm install
npm run backend:build
npm run build:react
npm run build:electron
npm run typecheck
npm run lint
npm run format
npm run package:portable
npm run package:win
```

For backend or packaging work, smoke-test a packaged app when practical:

```powershell
npm run package:portable
.\ui\release\win-unpacked\ClipVault.exe
type .\ui\release\win-unpacked\resources\bin\clipvault.log
```

Use `npm run package:win` when installer behavior, Windows registration, or release artifacts are affected.

## Git Workflow

All work should happen on branches and be merged via PR.

```powershell
git checkout -b docs/your-change
git add <files>
git commit -m "docs: describe change"
git push -u origin docs/your-change
```

Never commit directly to `master`, push to `master`, commit, push, tag, or create releases without explicit user permission.

If the user says "commit and PR", include all current changes by default unless they explicitly ask to exclude something.

## Code Style

C++ backend:

- Files: `snake_case.cpp`, `snake_case.h`
- Classes: `PascalCase`
- Functions and variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Private members: trailing underscore
- Indentation: 4 spaces

TypeScript/React UI:

- Files: `camelCase.ts`, `PascalCase.tsx`
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Run `npm run format` before committing UI changes.

## Backend Guardrails

- Always release libobs objects on every success and failure path.
- Preserve OBS initialization order: startup, data/module paths, load/post-load modules, then video/audio reset.
- Keep `graphics_module = "libobs-d3d11"` on Windows video init.
- Capture should prefer monitor capture for anti-cheat safety; see [docs/DECISIONS.md](docs/DECISIONS.md) before changing capture order.
- Audio sources must be activated, connected to OBS output channels, and routed to separate mixer tracks.
- A single full-monitor source should feed OBS output channel 0 directly; introduce a scene only when capture composition needs multiple video sources.
- Save replay through the replay buffer procedure handler and handle the `saved` callback.
- The hotkey uses a low-level keyboard hook so fullscreen games cannot easily swallow F9.
- Check OBS and Win32 return values and log actionable failure details.

## UI And Packaging Guardrails

- Packaged Windows behavior matters more than dev mode.
- Be careful with differences between repo-root paths, `bin/`, Electron `process.resourcesPath`, and Electron `userData`.
- Persisted settings live in `%APPDATA%\ClipVault\settings.json`; treat migrations and defaults carefully.
- Keep backend launch, tray ownership, startup behavior, installer metadata, bundled icons, OBS runtime files, and FFmpeg paths aligned when packaging changes.

## Docs Policy

Keep docs small and durable:

- Add or update [docs/GOALS.md](docs/GOALS.md) when product intent changes.
- Add or update [docs/DECISIONS.md](docs/DECISIONS.md) when the reason behind a technical choice changes.
- Do not add long command references, path inventories, or API guides that simply mirror source.

## Do Not

- Do not skip packaged verification for backend or packaging changes unless you clearly say why it was not run.
- Do not ignore OBS function return values.
- Do not forget libobs release paths.
- Do not change release/version/tag behavior without explicit permission.
- Do not revert user changes or unrelated dirty worktree files.
