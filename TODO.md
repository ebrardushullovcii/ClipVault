# ClipVault - Implementation TODO

Track implementation progress for Phase 1 (Core Engine).

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Core Engine

### Setup

- [ ] Verify solution builds with `dotnet build`
- [ ] Download FFmpeg with NVENC and place in `tools/`
- [ ] Test FFmpeg NVENC: `ffmpeg -encoders | findstr nvenc`

### Core Components

#### Configuration (`ClipVault.Core/Configuration/`)

- [ ] `ConfigManager` - Load/save settings.json
- [ ] `GameDatabase` - Load games.json, support custom games
- [ ] Validation and defaults

#### Screen Capture (`ClipVault.Core/Capture/`)

- [ ] `WindowsGraphicsCapture` - Primary capture via WinRT
  - [ ] D3D11 device initialization
  - [ ] Frame pool with `CreateFreeThreaded()`
  - [ ] Frame event handling with timestamps
- [ ] `DxgiDesktopDuplication` - Fallback for anti-cheat
- [ ] `CaptureManager` - Auto-select and fallback logic

#### Audio Capture (`ClipVault.Core/Audio/`)

- [ ] `SystemAudioCapture` - WASAPI loopback
- [ ] `MicrophoneCapture` - WASAPI input
- [ ] `AudioCaptureManager` - Coordinate both streams
- [ ] Ensure 48kHz stereo float32 output

#### Ring Buffers (`ClipVault.Core/Buffer/`)

- [x] `CircularBuffer<T>` - Generic implementation (starter code exists)
- [ ] `VideoFrameBuffer` - GPU texture buffer with timestamps
- [ ] `AudioSampleBuffer` - PCM buffer with timestamps
- [ ] Memory management (dispose old textures)

#### Encoding (`ClipVault.Core/Encoding/`)

- [ ] `FFmpegEncoder` - FFmpeg.AutoGen integration
  - [ ] NVENC initialization (h264_nvenc)
  - [ ] Frame encoding from D3D11 textures
  - [ ] Multi-track audio muxing
  - [ ] Progress reporting
- [ ] `EncoderSettings` - Quality presets

#### Game Detection (`ClipVault.Core/Detection/`)

- [ ] `GameDetector` - Process enumeration
- [ ] `FocusMonitor` - GetForegroundWindow tracking
- [ ] Process name matching against games.json

### Service (`ClipVault.Service/`)

- [ ] `ClipVaultService` - Main orchestrator
  - [ ] Start/stop capture on game detect
  - [ ] Handle hotkey save
  - [ ] Lifecycle management
- [ ] `HotkeyManager` - Win32 RegisterHotKey
- [ ] `TrayIcon` - System tray with status
- [ ] `NativeMethods` - P/Invoke declarations

### Output

- [ ] Clip folder creation with naming convention
- [ ] `metadata.json` generation
- [ ] Thumbnail extraction via FFmpeg

---

## Testing Milestones

1. [ ] Build succeeds without errors
2. [ ] Capture frames from a windowed app (e.g., Notepad)
3. [ ] Capture audio from system
4. [ ] Encode a test clip with NVENC
5. [ ] Full pipeline: detect game → capture → hotkey → save
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
