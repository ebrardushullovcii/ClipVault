# ClipVault - Implementation TODO

Track implementation progress for Phase 1 (Core Engine).

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Core Engine (Current)

### Setup

- [x] Verify solution builds with `dotnet build`
- [x] Download FFmpeg with NVENC and place in `tools/`
- [x] Test FFmpeg NVENC: `ffmpeg -encoders | findstr nvenc`

### Core Components

#### Configuration (`ClipVault.Core/Configuration/`)

- [x] `ConfigManager` - Load/save settings.json
- [x] `GameDatabase` - Load games.json, support custom games
- [ ] Validation and defaults

#### Screen Capture (`ClipVault.Core/Capture/`)

- [x] `GdiScreenCapture` - GDI-based full screen capture (720p, continuous)

#### Future Enhancements (Nice to have)

- [ ] Windows.Graphics.Capture API - Window-specific capture (when needed)
- [ ] DXGI Desktop Duplication - Alternative capture method (when needed)

#### Audio Capture (`ClipVault.Core/Audio/`)

- [x] `SystemAudioCapture` - WASAPI loopback
- [x] `MicrophoneCapture` - WASAPI input
- [x] Coordinate both streams in ClipVaultService
- [x] Ensure 48kHz stereo float32 output

#### Ring Buffers (`ClipVault.Core/Buffer/`)

- [x] `CircularBuffer<T>` - Generic implementation
- [x] `VideoFrameBuffer` - Pointer-based buffer with timestamps
- [x] `AudioSampleBuffer` - PCM buffer with timestamps

#### Encoding (`ClipVault.Core/Encoding/`)

- [x] `FFmpegEncoder` - Process-based FFmpeg (not FFmpeg.AutoGen)
  - [x] NVENC integration via FFmpeg process
  - [x] Multi-track audio muxing (system + mic audio synced)
- [x] `EncoderSettings` - Quality presets (in settings.json)

#### Game Detection (`ClipVault.Core/Detection/`)

- [x] `GameDetector` - Process enumeration
- [x] `FocusMonitor` - GetForegroundWindow tracking
- [x] Process name matching against games.json

### Service (`ClipVault.Service/`)

- [x] `ClipVaultService` - Main orchestrator
  - [x] Continuous capture (no start/stop on detect)
  - [x] Handle hotkey save
  - [x] Lifecycle management
- [x] `HotkeyManager` - Win32 RegisterHotKey
- [x] Tray icon integration in Program.cs
- [x] `NativeMethods` - P/Invoke declarations

### Output

- [x] Clip folder creation with naming convention
- [x] `metadata.json` generation

---

## Phase 1 Optimizations (Next)

- [ ] Test and optimize for 1080p 60fps capture
- [ ] Implement dynamic buffer sizing based on available memory
- [ ] Optimize encoding settings for faster processing
- [ ] Profile and reduce memory footprint of rolling buffer
- [ ] Test with different quality presets (p6 vs p7, CQ levels)
- [ ] Benchmark and optimize capture loop performance

---

## Testing Milestones

1. [x] Build succeeds without errors
2. [x] Capture frames from a windowed app - GDI capture works
3. [x] Capture audio from system - SystemAudioCapture starts
4. [x] Encode a test clip with NVENC - Full pipeline working, audio synced
5. [x] Full pipeline: detect game → capture → hotkey → save
6. [ ] Test with League of Legends
7. [ ] Test with Valorant (anti-cheat)
8. [ ] Test with 1080p 60fps capture
9. [ ] Benchmark memory usage at different buffer durations

---

## Phase 2: UI (Future)

- [ ] Clip library browser
- [ ] Thumbnail grid view
- [ ] Non-destructive editor
- [ ] Timeline with trim handles
- [ ] Export with edits applied

---

## Notes

- See `docs/PHASE1_PLAN.md` for architecture details
- See `docs/CONVENTIONS.md` for code style
- Target: League of Legends and Valorant must work
- Current capture: GDI-based full screen (720p), works with anti-cheat
