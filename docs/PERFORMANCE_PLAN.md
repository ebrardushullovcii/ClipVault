# ClipVault Performance Optimization Plan

## Project Motivation

ClipVault exists because existing game clipping tools are frustrating:

- **Ads**: Many free tools are ad-supported or nag for upgrades
- **Crashes**: Unreliable when you need them most
- **Bloat**: Heavy resource usage, unnecessary features, slow startup
- **No control**: Can't customize behavior or fix issues yourself

**Goal**: A simple, lightweight clipping tool that does exactly what's needed - nothing more. User controls everything, no bloat, no ads, no telemetry.

### Acceptable Trade-offs

This isn't about achieving the absolute best quality or lowest resource usage. It's about **control and reliability**.

- **Quality**: Good enough to share and watch back. Doesn't need to be lossless or broadcast-ready - just clean enough that compression artifacts aren't distracting.
- **Performance**: Reasonable CPU/GPU/RAM usage that doesn't impact gameplay. Doesn't need to be the most optimized solution - just not wasteful or excessive.
- **Features**: Core functionality done well. No need for every feature under the sun.

The sweet spot: A tool that works reliably, looks good, runs reasonably light, and can be understood and modified when needed. Perfect is the enemy of done.

---

## Problem Summary

| Issue     | Current | Target    | Root Cause                           |
| --------- | ------- | --------- | ------------------------------------ |
| RAM Usage | 6-10 GB | 1-2 GB    | Storing raw uncompressed BGRA frames |
| FPS       | ~35 fps | 50-60 fps | Large memory copies + GC pressure    |

## Root Cause Analysis

**Memory Math (why 7.5GB for 15 seconds):**

```
Frame size: 1920 × 1080 × 4 bytes (BGRA) = 8.3 MB per frame
15 seconds @ 60fps = 900 frames
Total: 900 × 8.3 MB = 7.47 GB
```

---

## Solution: Simple JPEG Compression Per Frame

**Keep it simple.** Instead of complex streaming H.264 encoding, just JPEG compress each frame before storing.

### Architecture Change

```
CURRENT:
  DXGI → byte[8.3MB raw] → Buffer[7.5GB] → FFmpeg encode on save

NEW (Simple):
  DXGI → JPEG compress (~100KB) → Buffer[~200MB] → Decompress → FFmpeg encode on save
```

### Expected Results

| Metric      | Before   | After     | Notes                       |
| ----------- | -------- | --------- | --------------------------- |
| RAM Usage   | 7.5 GB   | ~300 MB   | 96% reduction               |
| Capture FPS | 35 fps   | 50-60 fps | Less memory pressure        |
| Save Time   | 3-5 sec  | 5-8 sec   | Decompress + encode         |
| Quality     | Lossless | JPEG 90%  | Slight loss, configurable   |
| Complexity  | N/A      | Low       | Just add JPEG encode/decode |

### Why JPEG?

- **Simple**: Built into .NET, no external deps
- **Fast**: Hardware accelerated on modern CPUs
- **Good enough**: Quality 85-95% looks fine for game clips
- **Configurable**: User can trade quality for memory

---

## Implementation Plan

### Phase 1: Add JPEG Compression to Frame Storage

**Modify: `src/ClipVault.Core/Buffer/HybridFrameBuffer.cs`**

Add compression on store, decompression on retrieve:

```csharp
// On Add():
using var ms = new MemoryStream();
using var bitmap = new Bitmap(width, height, stride, PixelFormat.Format32bppArgb, framePtr);
bitmap.Save(ms, GetJpegEncoder(quality: 90));
var compressed = ms.ToArray();  // ~100-150KB instead of 8.3MB

// On GetAll():
// Decompress back to raw bytes for FFmpeg
```

**Memory calculation:**

- JPEG at 90% quality ≈ 100-200 KB per 1080p frame
- 900 frames × 150 KB = ~135 MB for video
- Add overhead = ~200-300 MB total

### Phase 2: Add Quality Setting

**Modify: `src/ClipVault.Core/Configuration/ClipVaultConfig.cs`**

```csharp
public class QualityConfig
{
    // Existing...
    public int BufferCompressionQuality { get; set; } = 90;  // 1-100, higher = better quality, more RAM
}
```

### Phase 3: Optimize Frame Pool

**Modify: `src/ClipVault.Core/Buffer/FramePool.cs`**

- Reduce pre-allocation since compressed frames are much smaller
- Pool MemoryStream objects instead of huge byte arrays

---

## Files to Modify

| File                   | Changes                                            | Effort |
| ---------------------- | -------------------------------------------------- | ------ |
| `HybridFrameBuffer.cs` | Add JPEG compress/decompress                       | Medium |
| `FramePool.cs`         | Reduce allocations, pool streams                   | Low    |
| `ClipVaultConfig.cs`   | Add compression quality setting                    | Low    |
| `FFmpegEncoder.cs`     | Accept compressed frames, decompress before encode | Low    |

## No New Files Needed

This approach modifies existing code rather than creating new complex systems.

---

## Alternative: Even Simpler - Just Use 720p

If JPEG adds too much complexity, just capture at 720p:

```
720p: 1280 × 720 × 4 = 3.7 MB per frame
15 seconds @ 60fps = 900 × 3.7 MB = 3.3 GB
```

Still high but ~50% reduction with zero code changes (just config).

**Can combine both:**

- 720p + JPEG 90% = ~50-80 KB per frame
- 900 frames = ~70 MB
- Total with overhead: ~150 MB

---

## Verification

1. **Memory test**: Monitor RAM - should stay under 1-2 GB
2. **Quality test**: Compare JPEG 90% vs raw - should be visually similar
3. **FPS test**: Should improve due to less memory pressure
4. **Save test**: May be slightly slower (decompress step) but acceptable

---

## Trade-offs (User Controllable)

| Setting        | Low Memory | Balanced  | High Quality  |
| -------------- | ---------- | --------- | ------------- |
| Resolution     | 720p       | 1080p     | 1080p         |
| JPEG Quality   | 80         | 90        | 95            |
| Est. RAM       | ~100 MB    | ~300 MB   | ~500 MB       |
| Visual Quality | Good       | Very Good | Near Lossless |
