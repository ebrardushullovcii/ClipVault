# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-07-11

### Added

- Added independent NVENC performance preset controls so encoder speed can be tuned without changing recording resolution, frame rate, or CQP quality.
- Added selectable DXGI, Windows Graphics Capture, and automatic full-monitor capture methods, plus an optional captured-cursor toggle.
- Added local OBS render, encode, output, CPU, memory, and source telemetry for evidence-based performance comparisons.

### Changed

- Switched OBS 31 NVENC recording to the native texture encoder path and kept high-quality CQP settings independent from the selected performance preset.
- Connected the single full-monitor source directly to the OBS video mix to remove an unnecessary composition layer.
- Kept the OBS graphics device at the driver-default GPU priority after testing showed that lowering it starved capture rendering and duplicated frames.
- Made the OBS runtime setup deterministic at version 31.0.0 and hardened the build against missing optional FFmpeg runtime files.

### Fixed

- Fixed OBS 31 monitor selection by resolving and writing the required string `monitor_id` instead of the obsolete numeric `monitor` setting.
- Corrected capture method values to OBS 31 semantics: Auto `0`, DXGI `1`, and WGC `2`.
- Fixed the legacy NVENC compatibility path silently replacing the requested fast preset with a slower preset.

## [1.5.9] - 2026-04-23

### Fixed

- Restored the Electron tray icon during Windows startup launches so enabling `Start with Windows` brings ClipVault up in the tray after a reboot instead of starting silently without any tray access.

## [1.5.8] - 2026-04-22

### Fixed

- Reworked tray ownership handoff between the Electron app and the fallback service tray so reopening ClipVault restores the main tray menu and keeps app and service controls in sync.
- Updated tray status labels and controls to use `Service` terminology, support starting and stopping the service from the Electron tray, and keep service state visible without showing backend PIDs.
- Hardened fallback tray launch behavior so failed UI launches no longer shut down the service tray, double-clicks do not trigger duplicate launches, and detached service handoff no longer keeps Electron alive through piped stdio.

## [1.5.7] - 2026-04-14

### Changed

- Consolidated ClipVault down to a single Electron tray icon by launching the bundled backend in background mode instead of giving the backend its own tray entry.
- Updated the tray menu to show whether the backend is running so you can confirm clipping is active from the remaining tray icon.
- Bumped the app version metadata to 1.5.7 for the root project and Electron UI package.

## [1.5.5] - 2026-04-14

### Changed

- Refreshed the Windows app branding by replacing the existing icon assets across the packaged app, backend executable, tray icon, and installer resources.
- Updated the Windows packaging flow to stamp both the Electron app and bundled backend executable with the shared application icon.
- Bumped the app version metadata to 1.5.5 for the root project and Electron UI package.

## [1.5.2] - 2026-03-15

### Fixed

- Startup registry changes now roll back cleanly if saving `start_with_windows` fails, so Windows autostart and persisted settings stay in sync.
- The Settings startup switch now blocks overlapping toggle requests while a change is in flight.
- The first-run setup flow now shows startup/save failures inline instead of trapping users with silent errors.

## [1.5.1] - 2026-03-15

### Fixed

- Windows startup registration now writes a valid `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry for installed builds, so ClipVault can launch correctly at login.
- The `Start with Windows` setting now persists immediately and rolls back in the UI if startup registration fails.

## [1.5.0] - 2026-03-09

### Added

- First-run setup wizard for new installs.
- Bulk clip operations for selecting and managing multiple clips.
- Game detection and tagging for saved clips.
- Audio source selection and clip save sound feedback.

### Fixed

- Library/editor navigation regressions, including stale history state and settings-overlay back/forward behavior.
- Thumbnail generation and audio extraction validation for existing clips and clip IDs.
- Replay buffer lifecycle and save-state races during stop, shutdown, and repeated save requests.
- Export dropdown, first-run folder picker, and window-state persistence issues.

### Changed

- Packaging guidance now clearly distinguishes installer, portable, and unpacked smoke-test builds.
- Repo tooling, release templates, GPL/license packaging, and troubleshooting docs were cleaned up and aligned.
