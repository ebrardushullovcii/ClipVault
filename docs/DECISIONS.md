# ClipVault Decisions

This file keeps durable rationale that future agents should not rediscover from scratch. It is not a full API manual; inspect source for exact implementation details.

## Product And Architecture

### Split Backend And UI

Decision: keep the recording engine in C++ under `src/` and the clip browser/editor in Electron under `ui/`.

Why: libobs and Windows capture behavior are easier to control in a native process, while Electron gives a richer editing and library UI. Packaging bundles the backend into the Electron app instead of merging the two runtimes.

### Packaged App Is The Real Test Target

Decision: backend or packaging changes should be verified in a packaged Windows build when practical.

Why: many failures only appear after Electron resource paths, bundled OBS files, FFmpeg, icons, installer metadata, and backend startup handoff are involved. Dev mode does not exercise all of that.

## Capture And OBS

### Prefer Monitor Capture For Anti-Cheat Safety

Decision: video capture prefers OBS `monitor_capture` using DXGI, then WGC, then `window_capture`; `game_capture` is only a last resort.

Why: ClipVault should avoid game hooks and injection. This is safer for anti-cheat-sensitive games, even if direct game capture can be more targeted.

### Load OBS Modules Before Video And Audio Reset

Decision: OBS startup order is `obs_startup`, add data/module paths, `obs_load_all_modules`, `obs_post_load_modules`, then `obs_reset_video` and `obs_reset_audio`.

Why: capture and encoder modules need to register before video/audio reset. Reversing this can produce black video or missing capture sources. On Windows, video init also needs `graphics_module = "libobs-d3d11"`.

### Use Bundled OBS Through Dynamic Function Loading

Decision: the backend loads `obs.dll` from its executable directory and resolves libobs functions with `GetProcAddress`.

Why: ClipVault ships a bundled OBS runtime. Dynamic loading gives clear diagnostics when a bundled DLL or required symbol is missing and keeps the backend tied to the packaged runtime layout.

### Render Through An OBS Scene

Decision: the selected video source is added to an OBS scene; the scene source is connected as output channel 0 and as the replay output video source.

Why: raw capture sources alone can fail to produce frames for the replay output. The scene is the rendering object that should feed the buffer.

### Keep Desktop And Microphone On Separate Tracks

Decision: desktop audio uses `wasapi_output_capture`, microphone uses `wasapi_input_capture`, each source is activated, connected to its own OBS output channel, routed to its own mixer track, and encoded with a separate AAC encoder.

Why: the editor depends on separate desktop and microphone tracks for muting, volume adjustment, and exports. Missing source activation or output-channel connection can make clips silent even when sources were created successfully.

### Encoder Fallback Order Is Intentional

Decision: automatic video encoding tries NVENC variants first, then x264. Explicit `nvenc` or `x264` settings are respected.

Why: NVENC keeps CPU load low during gameplay, but OBS/driver/GPU combinations expose different encoder IDs. x264 keeps the app usable when hardware encoding fails.

Important constraints:

- `jim_nvenc` uses `p1`-`p7` presets.
- CQP mode for `jim_nvenc` requires multipass disabled.
- `ffmpeg_nvenc` uses FFmpeg-style CQ settings.

### Use A Low-Level Keyboard Hook For The Save Hotkey

Decision: the save hotkey uses `WH_KEYBOARD_LL` instead of `RegisterHotKey`.

Why: fullscreen and borderless games can consume normal hotkeys. The low-level hook is more reliable for the default F9 clipping workflow.

### Save Replay Through The Replay Buffer Procedure

Decision: saving calls the replay buffer procedure handler with `proc_handler_call(..., "save", ...)` and listens for the `saved` signal.

Why: signaling the output directly is not enough for reliable replay saves. OBS can also return a null path in the callback, so the backend keeps a fallback scan for the newest matching MP4 created after save start.

### Render Thread Is A Health Check

Decision: the replay render thread runs periodic health checks instead of rendering at 60 FPS.

Why: OBS handles frame production internally once sources and outputs are configured. A fast render loop caused unnecessary CPU load.

## Storage And Runtime Paths

### Shared Settings Path

Decision: backend and UI share `%APPDATA%\ClipVault\settings.json`.

Why: settings changed in the UI must affect backend capture and replay behavior. Be careful with migrations because persisted user settings span app versions.

### Keep Clip Data Beside Clips, Cache In UserData

Decision: saved MP4 clips live under the configured output path. Per-clip metadata lives in `clips-metadata` under that output path. Exported clips live in `exported-clips`. Thumbnails and extracted editor audio are cache data under Electron `userData`.

Why: clip files and editor metadata should stay with the user's chosen clip folder, while generated thumbnails/audio can be rebuilt and cleaned as cache.

### Use The `clipvault://` Protocol For Renderer Media

Decision: the renderer loads clips, thumbnails, audio, and exports through a custom `clipvault://` protocol.

Why: the UI needs media access without exposing arbitrary filesystem paths to the renderer. Keep path validation tight around clip-scoped files.

### Packaged Resources Live Under `process.resourcesPath`

Decision: packaged builds resolve the backend, OBS runtime files, FFmpeg tools, icons, config assets, and game database from the Electron resources directory. Dev mode resolves most of these from the repo root or `bin/`.

Why: path bugs are common when code works in dev but fails after packaging. Check `ui/src/main/main.ts`, `ui/package.json`, `ui/build/afterPack.cjs`, and `build.ps1` together when changing bundled resources.

### Installer, Portable, And Unpacked Outputs Are Different

Decision: `package:win` creates the installer, `package:portable` creates the portable executable, and `ui/release/win-unpacked/ClipVault.exe` is only a smoke-test output.

Why: the unpacked app is useful for quick packaged checks, but it is not the normal installed product and does not register with Windows like the installer.

## Releases

### Version And Changelog Move Together

Decision: releases update both root `package.json` and `ui/package.json`, then add a `CHANGELOG.md` entry.

Why: Electron Builder and repo metadata both carry version information. The changelog is the human release history.

### Do Not Create Releases Without Permission

Decision: agents may prepare release changes, but should not create GitHub releases, tags, or publish artifacts unless explicitly asked.

Why: releases are public distribution events and should remain user-controlled.

## Review And Maintenance

### Review For Runtime Regressions First

Decision: reviews should prioritize packaged Windows behavior, tray/startup/service behavior, hotkeys, replay saving, persistent settings, runtime paths, OBS object cleanup, and bundled resources.

Why: style-only feedback is less valuable than finding concrete failures in the app's main clipping workflow.

### Keep Documentation Small

Decision: future docs should capture goals, decisions, and user-facing release history. Avoid large command references, API guides, or path inventories unless they record rationale that cannot be inferred from source.

Why: stale docs mislead smarter agents. Source and scripts are better for exact facts; docs are best for intent and tradeoffs.
