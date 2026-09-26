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

Decision: monitor capture remains the compatibility default, using selectable DXGI, WGC, or Auto. Automatic game capture and manual app-window capture are explicit experimental options using WGC without hooks or injection. Game-only and manual window capture never fall back to recording the desktop. The separate Monitor + automatic games option explicitly records the selected monitor when no capturable game is available.

Why: ClipVault should avoid game hooks and injection. This is safer for anti-cheat-sensitive games, even if direct game capture can be more targeted.

OBS 31 monitor capture requires the Windows display-interface string in `monitor_id`; the old numeric `monitor` source setting is not valid for the D3D11 monitor source. Resolve and log that ID before source creation. Check for captured dimensions before starting the replay buffer; source creation alone does not prove capture works. If the requested monitor method has no video after startup, try the alternate monitor method, then fail clearly. DXGI returned `DXGI_ERROR_UNSUPPORTED` on this PC while WGC worked. Earlier comparisons made with the incorrect module initialization order actually used legacy GDI and cannot establish DXGI/WGC performance.

### Initialize Graphics Before Loading OBS Modules

Decision: OBS startup order is `obs_startup`, add data/module paths, `obs_reset_video` and `obs_reset_audio`, then `obs_load_all_modules` and `obs_post_load_modules`.

Why: OBS 31's win-capture module checks the graphics device during module load. Loading it before D3D11 initialization disables WGC and registers legacy GDI monitor capture. A controlled visible-window test produced all-black BitBlt output with the former order and working WGC output after correcting it. This follows OBS Studio's initialization sequence. Keep `graphics_module = "libobs-d3d11"` and use `%module%` in the plugin data path so each plugin finds its own resources.

### Automatic Game And Manual Window Capture

Automatic game capture uses exact executable matches from the bundled game database, excluding launchers and generic Java app windows. OBS must also use executable-priority matching: title-priority matching can select an unrelated application with the same title. Prefer the foreground game, retain the current game across alt-tab, and otherwise select an open game. Fullscreen alone is not evidence that a browser or app is a game. Poll once per second rather than continuously scanning processes. A new game process/window gets a fresh replay buffer, so clips do not mix different games. Wait for video before starting the encoder; stop recording when the game closes. A minimized game keeps its buffer paused with both audio tracks together. Out-of-context Windows minimize notifications reduce the pause delay without injecting into the game; a few already-queued black frames can still appear at that transition. Unknown games remain available through manual window capture.

Why: the normal game-clipping workflow should work across launches and matches without asking users to reselect a window. Desktop apps must not be mistaken for gameplay. Keep manual selection for intentional app recording and unrecognized games.

Decision: use the OBS-escaped `title:class:executable` selector, exact-title matching, and WGC. Fit the window into the recording canvas without stretching; resize and borderless fullscreen changes should not require restarting capture. Do not enable the window source's audio capture: all PC audio and microphone capture retain their separate tracks.

Why: a title alone is not a valid OBS window selector. Exact-title matching avoids falling back to an unrelated title. A renamed window can continue while its handle survives; automatic game mode reacquires new game windows after reopening. Manual app mode needs reselection if reopened under a different title. WGC game capture is experimental until verified in the user's actual games, especially exclusive fullscreen and protected applications.

Pause the replay output while the selected window has no captured dimensions, preserving its buffer and pausing both audio tracks together. Resume when it returns. A save while unavailable should ask the user to restore the window, not produce a black clip. The tray reports waiting; the settings explain this behavior.

### Keep History In Monitor + Automatic Games Mode

Decision: hybrid mode records the selected monitor until a supported game opens, follows that game across alt-tab, and returns to the monitor when it closes, is minimized, or fails to produce video. Keep the replay encoder and both audio sources alive across source switches. Pause video and both audio tracks together during source warm-up rather than clearing recent history. Suspend the health reader while replacing its source, and reuse the last working monitor method to avoid repeating a failed API probe on every switch. Only one video capture source remains active after each switch.

Why: this explicit mode serves continuous clipping across desktop and gameplay. A clip may intentionally contain both. Keep game-only mode's fresh buffers and no-desktop boundary unchanged. Failed game captures retry at a bounded interval rather than repeatedly interrupting desktop capture.

### Use Bundled OBS Through Dynamic Function Loading

Decision: the backend loads `obs.dll` from its executable directory and resolves libobs functions with `GetProcAddress`.

Why: ClipVault ships a bundled OBS runtime. Dynamic loading gives clear diagnostics when a bundled DLL or required symbol is missing and keeps the backend tied to the packaged runtime layout.

### Feed A Single Monitor Source Directly

Decision: connect the selected full-monitor source directly to OBS output channel 0. Use a scene for multiple video sources or to fit a variable-sized window into the recording canvas.

Why: the replay encoder consumes the OBS video mix, so a single active monitor source does not need a one-item scene. Removing that composition layer reduces render work while preserving verified 1080p60 replay output and both audio tracks.

Keep the OBS D3D11 device at the driver-default GPU thread priority. Lowering it can reduce competition with the foreground compositor, but local telemetry showed that it also starves OBS rendering and produces duplicated frames. `CLIPVAULT_GPU_PRIORITY` exists only as an opt-in diagnostic override for controlled A/B tests.

### Keep Desktop And Microphone On Separate Tracks

Decision: desktop audio uses `wasapi_output_capture`, microphone uses `wasapi_input_capture`, each source is activated, connected to its own OBS output channel, routed to its own mixer track, and encoded with a separate AAC encoder.

Why: the editor depends on separate desktop and microphone tracks for muting, volume adjustment, and exports. Missing source activation or output-channel connection can make clips silent even when sources were created successfully.

Use OBS's public active-reference API, balance each explicit activation, and detach output channels before releasing capture sources. Leaving channel references alive until OBS teardown caused intermittent shutdown crashes in packaged-runtime tests.

### Encoder Fallback Order Is Intentional

Decision: automatic video encoding tries NVENC variants first, then x264. Explicit `nvenc` or `x264` settings are respected.

Why: NVENC keeps CPU load low during gameplay, but OBS/driver/GPU combinations expose different encoder IDs. x264 keeps the app usable when hardware encoding fails.

Important constraints:

- On OBS 31, prefer the native `obs_nvenc_h264_tex` encoder. `jim_nvenc` is a deprecated compatibility ID whose settings migration can replace an incorrectly supplied preset.
- Keep visual quality (CQP/CRF) independent from NVENC performance (`p1`-`p7`). The default is P3; P1/P2 are user-selectable when more encode-engine headroom is valuable.
- Keep CQP, high-quality tuning, two B-frames, lookahead disabled, and single-pass encoding. Adaptive quantization defaults on but can be disabled independently to compare GPU work against image quality; it does not change audio, resolution, or frame rate.
- Log local OBS render/encode frame deltas so preset and capture changes can be compared without adding remote telemetry.

Recording codec is a separate opt-in choice. H.264 remains the default for existing settings and uses high profile. AV1 uses the native OBS texture encoder with main profile and falls back to the H.264 NVENC chain if creation or replay startup fails. Only Auto may fall back to CPU encoding. Preserve both AAC tracks regardless of video codec. OBS 31 scales AV1 CQP by four internally; map the quality tiers separately instead of treating the native H.264 and AV1 quantizers as interchangeable.

Why: AV1 can reduce file size and encoded replay-buffer memory on supported NVIDIA GPUs. It does not reduce monitor capture work, and software decoding can increase editor CPU use. Keep the codec and AQ controls independent and preserve export codec selection so users can still produce compatible H.264 sharing files.

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

The Windows installer backs up shared settings outside that folder before upgrading and restores them afterward, because older uninstallers remove the folder during an upgrade. Keep the backup on disk if restoration fails. New uninstallers skip settings removal when invoked for an upgrade.

Preserve an existing Windows startup entry across upgrades and point it at the new installation path. Installed app launches also repair a missing or outdated entry when the saved startup preference is enabled; development, unpacked, and portable builds must not register temporary paths automatically. Leave Windows Task Manager's startup approval state untouched. A packaged startup launch must start the backend and tray without opening the editor.

### Keep Clip Data Beside Clips, Cache In UserData

Decision: saved MP4 clips live under the configured output path. Per-clip metadata lives in `clips-metadata` under that output path. Exported clips live in `exported-clips`. Thumbnails and extracted editor audio are cache data under Electron `userData`.

Why: clip files and editor metadata should stay with the user's chosen clip folder, while generated thumbnails/audio can be rebuilt and cleaned as cache.

### Stream Editor Audio And Preserve Track Controls

Decision: prepare separate editor audio files by copying AAC packets with their timestamps intact; use a bounded AAC conversion only for other codecs. Serialize preparation and cancel work when the editor leaves a clip. Stream those files through native audio players with independent mute and volume controls instead of decoding the entire recording into PCM buffers.

Why: normal editing starts with two- to three-minute recordings. Full audio decoding consumes substantial memory, and re-encoding existing AAC wastes CPU. The muted video remains the playback clock. Avoid repeated fractional playback-rate corrections: local pulse tests found growing audible delay in Chromium's time stretcher despite aligned media time counters. Verify actual audio pulses against presented video frames after playback changes. Exports must honor the same mute and volume settings; trimming the original preserves both source tracks.

### Treat Recording Size As A Range

Decision: settings show a calibrated typical size and range for CQP/CRF recording instead of presenting one low fixed-bitrate number as an expected result.

Why: constant-quality encoding intentionally spends more bits on detailed or fast-moving gameplay. The replay buffer keeps that encoded data in memory, so the same range also gives users an honest indication of buffer RAM use.

Use five user-facing levels: Compact, Efficient, Balanced, Detailed, and Maximum. Keep the names tied to visible image quality and explain RAM and storage effects directly. Encoder compression effort remains a separate choice because it primarily changes NVENC use, not the selected image-quality level.

### Default Sharing Exports To A Size Limit

Decision: editor and bulk exports default to an upper 10 MB target and AV1 for better quality per megabyte on NVIDIA RTX 40-series or newer GPUs. H.264 remains selectable for maximum playback compatibility. Export codec, size target, frame rate, and resolution defaults are persistent settings, while each editor export can still override them. Re-encoding prefers bundled FFmpeg NVENC, then H.264 falls back to x264 limited to four threads. Original-quality stream copy remains selectable.

Why: a short stream-copy export preserves the recording bitrate and can still be tens of megabytes. A visible size target matches sharing expectations, while hardware encoding and a bounded software fallback avoid unnecessary CPU pressure. Discord accepts H.264 and AV1 in MP4 files, but H.264 recording remains the compatibility baseline for ClipVault's own library and editor. AV1 improves image quality at the same size limit; it does not reduce a fixed 10 MB target below that selected limit.

### Use One Clip Folder Watcher

Decision: one main-process watcher handles clip add/remove notifications and thumbnail generation. The library performs a visibility-aware 30-second safety scan instead of reparsing every clip every three seconds.

Why: duplicate watchers and frequent full-library scans add filesystem work without improving the normal event-driven path.

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
