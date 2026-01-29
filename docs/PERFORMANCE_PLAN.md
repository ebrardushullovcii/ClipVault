# ClipVault Performance Optimization Plan

## Problem Summary

| Issue | Current | Target | Root Cause |
|-------|---------|--------|------------|
| RAM Usage | 6-10 GB | < 500 MB | Storing raw uncompressed BGRA frames |
| FPS | ~35 fps | 60 fps | CPU copy bottleneck + GC pressure |

## Root Cause Analysis

**Memory Math (why 7.5GB for 15 seconds):**
```
Frame size: 1920 × 1080 × 4 bytes (BGRA) = 8.3 MB per frame
15 seconds @ 60fps = 900 frames
Total: 900 × 8.3 MB = 7.47 GB
```

**Insights Capture comparison (2 min @ 1080p60 with ~1GB RAM):**
- Uses NV12 pixel format (1.5 bytes/pixel vs 4)
- Encodes on-the-fly with NVENC
- Stores compressed H.264 at 6 Mbps (~750 KB/s)
- 2 minutes = ~90 MB storage (vs 60GB raw)

## Solution: On-the-fly NVENC Encoding

### Architecture Change

```
CURRENT (Store Raw → Encode on Save):
  DXGI → byte[8.3MB] → HybridFrameBuffer[7.5GB] → [save] → FFmpeg encode

NEW (Encode on Capture → Store Compressed):
  DXGI → FFmpeg stdin pipe → NVENC → CircularNalBuffer[~100MB] → [save] → just remux
```

### Expected Results

| Metric | Before | After |
|--------|--------|-------|
| RAM Usage | 7.5 GB | ~100 MB |
| Capture FPS | 35 fps | 60 fps |
| Save Time | 3-5 sec | < 0.5 sec |
| GC Pressure | Heavy | Minimal |

---

## Implementation Plan

### Phase 1: Create Streaming Encoder

**New file: `src/ClipVault.Core/Encoding/StreamingNvencEncoder.cs`**

- Maintains persistent FFmpeg process with stdin/stdout pipes
- Writes raw BGRA frames to FFmpeg stdin
- Reads encoded H.264 NAL units from stdout
- Uses low-latency NVENC settings: `-preset p1 -tune ll -rc cbr -b:v 6M`

```csharp
public sealed class StreamingNvencEncoder : IDisposable
{
    private Process _ffmpeg;
    private readonly CircularNalBuffer _nalBuffer;

    public void WriteFrame(nint bgraPointer, int size, long timestamp);
    public void Flush();
}
```

### Phase 2: Create Compressed Frame Buffer

**New file: `src/ClipVault.Core/Buffer/CircularNalBuffer.cs`**

- Pre-allocated ~100 MB byte array (no per-frame allocations)
- Stores H.264 NAL units with timestamps
- Tracks keyframes for proper clip extraction

```csharp
public sealed class CircularNalBuffer : IDisposable
{
    private readonly byte[] _buffer;  // ~100MB
    private readonly List<NalEntry> _index;  // Frame metadata

    public void Write(ReadOnlySpan<byte> nalUnit, long timestamp, bool isKeyframe);
    public IEnumerable<NalEntry> GetLastSeconds(int seconds);
}
```

### Phase 3: Modify DXGI Capture

**Modify: `src/ClipVault.Core/Capture/DxgiScreenCapture.cs`**

- Remove byte[] frame buffer allocation
- Write directly from mapped GPU memory to encoder pipe
- Fire event with encoded frame data instead of raw pixels

### Phase 4: Update Buffer System

**Modify: `src/ClipVault.Core/Buffer/SyncedAVBuffer.cs`**

- Replace `HybridFrameBuffer` with `CircularNalBuffer`
- Update `GetLastSeconds()` to return encoded data

**Deprecate (keep as fallback):**
- `HybridFrameBuffer.cs`
- `FramePool.cs`

### Phase 5: Update Save Flow

**Modify: `src/ClipVault.Core/Encoding/FFmpegEncoder.cs`**

Add fast remux method (video already encoded, just package into MP4):

```csharp
public async Task MuxClipAsync(
    string outputPath,
    IEnumerable<NalEntry> encodedVideo,  // Already H.264!
    IReadOnlyList<TimestampedAudio> audio)
{
    // Write NAL units to temp .h264 file (~10MB)
    // FFmpeg: -i video.h264 -i audio.raw -c:v copy -c:a aac output.mp4
    // -c:v copy = NO re-encoding, instant!
}
```

### Phase 6: Service Integration

**Modify: `src/ClipVault.Service/ClipVaultService.cs`**

- Initialize StreamingNvencEncoder on startup
- Wire DXGI capture to streaming encoder
- Update SaveClip to use MuxClipAsync

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/ClipVault.Core/Encoding/StreamingNvencEncoder.cs` | Real-time FFmpeg pipe encoder |
| `src/ClipVault.Core/Buffer/CircularNalBuffer.cs` | Compressed frame storage |

## Files to Modify

| File | Changes |
|------|---------|
| `DxgiScreenCapture.cs` | Pipe frames to streaming encoder |
| `SyncedAVBuffer.cs` | Use CircularNalBuffer instead of HybridFrameBuffer |
| `FFmpegEncoder.cs` | Add MuxClipAsync for instant saves |
| `ClipVaultService.cs` | Wire up streaming encoder pipeline |

## Files to Deprecate

| File | Reason |
|------|--------|
| `HybridFrameBuffer.cs` | Replaced by CircularNalBuffer |
| `FramePool.cs` | No longer needed |

---

## Verification

1. **Memory test**: Monitor RAM during 30+ seconds of capture - should stay under 500MB
2. **FPS test**: Check logs for "DXGI Capture FPS: 60+" consistently
3. **Quality test**: Compare clip quality visually with previous versions
4. **Save speed test**: Clip save should complete in under 1 second
5. **A/V sync test**: Verify audio and video remain synchronized

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| FFmpeg pipe hangs | Watchdog timer, auto-restart |
| NVENC unavailable | Fall back to existing raw buffer system |
| Quality concerns | Make bitrate configurable (default 8 Mbps) |
| A/V sync drift | Timestamp all NAL units, align during mux |
