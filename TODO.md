# ClipVault - Implementation TODO

Track implementation progress for Phase 1 (Core Engine).

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Core Engine

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

- [~] `WindowsGraphicsCapture` - Wrapper using DXGI Desktop Duplication (P/Invoke)
- [~] `DxgiDesktopDuplication` - P/Invoke implementation (fires frame events)
- [ ] `CaptureManager` - Auto-select and fallback logic

#### Audio Capture (`ClipVault.Core/Audio/`)

- [x] `SystemAudioCapture` - WASAPI loopback
- [ ] `MicrophoneCapture` - WASAPI input
- [ ] `AudioCaptureManager` - Coordinate both streams
- [x] Ensure 48kHz stereo float32 output

#### Ring Buffers (`ClipVault.Core/Buffer/`)

- [x] `CircularBuffer<T>` - Generic implementation
- [x] `VideoFrameBuffer` - Pointer-based buffer with timestamps
- [x] `AudioSampleBuffer` - PCM buffer with timestamps

#### Encoding (`ClipVault.Core/Encoding/`)

- [~] `FFmpegEncoder` - Process-based FFmpeg (simpler, stable)
  - [ ] NVENC integration (needs FFmpeg binary with --enable-nvenc)
  - [ ] Multi-track audio muxing
- [x] `EncoderSettings` - Quality presets (in settings.json)

#### Game Detection (`ClipVault.Core/Detection/`)

- [x] `GameDetector` - Process enumeration
- [x] `FocusMonitor` - GetForegroundWindow tracking
- [x] Process name matching against games.json

### Service (`ClipVault.Service/`)

- [x] `ClipVaultService` - Main orchestrator
  - [x] Start/stop capture on game detect
  - [x] Handle hotkey save
  - [x] Lifecycle management
- [x] `HotkeyManager` - Win32 RegisterHotKey
- [x] `TrayIcon` - System tray with status
- [x] `NativeMethods` - P/Invoke declarations

### Output

- [x] Clip folder creation with naming convention
- [x] `metadata.json` generation
- [ ] Thumbnail extraction via FFmpeg

---

## Testing Milestones

1. [x] Build succeeds without errors
2. [~] Capture frames from a windowed app (e.g., Notepad) - Game detection works, capture placeholder
3. [~] Capture audio from system - SystemAudioCapture starts
4. [ ] Encode a test clip with NVENC
5. [~] Full pipeline: detect game → capture → hotkey → save - Detection works, encoding pending
6. [ ] Test with League of Legends
7. [ ] Test with Valorant

---

## Phase 2: UI (Future)

- [ ] Clip library browser
- [ ] Thumbnail grid view
- [ ] Non-destructive editor
- [ ] Timeline with trim handles
- [ ] Export with edits applied

---

## Notes

- See `docs/PLAN.md` for architecture details
- See `docs/CONVENTIONS.md` for code style
- Target: League of Legends and Valorant must work
