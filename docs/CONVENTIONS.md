# Code Conventions for ClipVault

This document defines coding standards for ClipVault. All AI assistants and contributors should follow these conventions.

## C# Style

### Namespaces

```csharp
// Use file-scoped namespaces
namespace ClipVault.Core.Capture;

public class WindowsGraphicsCapture { }
```

### Naming

| Element         | Convention  | Example             |
| --------------- | ----------- | ------------------- |
| Classes/Records | PascalCase  | `VideoFrameBuffer`  |
| Interfaces      | IPascalCase | `IScreenCapture`    |
| Methods         | PascalCase  | `StartCaptureAsync` |
| Properties      | PascalCase  | `IsCapturing`       |
| Private fields  | \_camelCase | `_frameBuffer`      |
| Parameters      | camelCase   | `cancellationToken` |
| Constants       | PascalCase  | `DefaultBufferSize` |

### Types

```csharp
// Use records for immutable data
public record TimestampedFrame(
    nint TexturePointer,
    long TimestampTicks,
    int Width,
    int Height);

// Use required for mandatory properties
public sealed class EncoderSettings
{
    public required int Width { get; init; }
    public required int Height { get; init; }
}

// Use sealed for classes not designed for inheritance
public sealed class FFmpegEncoder : IEncoder { }
```

### Async/Await

```csharp
// Always use async/await for I/O
// Suffix async methods with Async
// Accept CancellationToken
public async Task StartAsync(CancellationToken ct = default)
{
    await _capture.InitializeAsync(ct);

    while (!ct.IsCancellationRequested)
    {
        await ProcessFrameAsync(ct);
    }
}
```

### Disposal

```csharp
// Implement IDisposable for unmanaged resources
public sealed class WindowsGraphicsCapture : IScreenCapture
{
    private readonly ID3D11Device _device;
    private Direct3D11CaptureFramePool? _framePool;
    private bool _disposed;

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        _framePool?.Dispose();
        _device?.Dispose();
    }
}
```

### Error Handling

```csharp
// Use specific exception types
public void SetBufferDuration(int seconds)
{
    if (seconds <= 0)
        throw new ArgumentOutOfRangeException(nameof(seconds), "Must be positive");

    if (seconds > 300)
        throw new ArgumentOutOfRangeException(nameof(seconds), "Maximum is 5 minutes");
}

// Log errors before throwing/handling
catch (COMException ex) when (ex.HResult == E_ACCESSDENIED)
{
    _logger.LogError(ex, "Access denied during capture initialization");
    throw new CaptureException("Cannot access display - check permissions", ex);
}
```

## Architecture Rules

### Project Dependencies

```
ClipVault.Service
    └── ClipVault.Core (reference)
        └── No UI dependencies!
```

### Interface Segregation

```csharp
// Small, focused interfaces
public interface IScreenCapture : IDisposable
{
    event EventHandler<FrameCapturedEventArgs>? FrameCaptured;
    bool IsCapturing { get; }
    Task StartAsync(CancellationToken ct);
    Task StopAsync();
}

// Not: ICapture with 20 methods
```

### Event Patterns

```csharp
// Use nullable events with EventArgs derivatives
public event EventHandler<FrameCapturedEventArgs>? FrameCaptured;

// Copy data in event handlers - buffers may be reused!
private void OnDataAvailable(object? sender, WaveInEventArgs e)
{
    if (e.BytesRecorded == 0) return;

    // CRITICAL: Copy immediately
    var copy = new byte[e.BytesRecorded];
    Buffer.BlockCopy(e.Buffer, 0, copy, 0, e.BytesRecorded);

    _buffer.Add(new TimestampedAudio(copy, GetTimestamp(), e.BytesRecorded));
}
```

## Performance Guidelines

### Memory

```csharp
// Keep frames in GPU memory until encoding
// Don't copy to CPU unless necessary
var texture = frame.Surface.As<ID3D11Texture2D>();
_gpuBuffer.Add(texture); // Keep on GPU

// Use object pooling for hot paths
private readonly ObjectPool<byte[]> _audioBufferPool;
```

### Threading

```csharp
// Use lock-free structures where possible
private readonly ConcurrentQueue<TimestampedFrame> _pendingFrames;

// For simple synchronization, use lock
private readonly object _lock = new();
lock (_lock)
{
    _buffer[_position] = frame;
}
```

### Allocations

```csharp
// Avoid allocations in capture loop
// Bad:
while (capturing)
{
    var list = new List<Frame>(); // Allocation every iteration!
}

// Good:
var list = new List<Frame>(capacity);
while (capturing)
{
    list.Clear(); // Reuse
}
```

## Documentation

### XML Comments

```csharp
/// <summary>
/// Captures frames from a window using Windows.Graphics.Capture API.
/// </summary>
/// <remarks>
/// This is the primary capture method. Falls back to DXGI Desktop Duplication
/// if the target window has protected content.
/// </remarks>
public sealed class WindowsGraphicsCapture : IScreenCapture
{
    /// <summary>
    /// Start capturing frames from the target window.
    /// </summary>
    /// <param name="ct">Cancellation token to stop capture.</param>
    /// <exception cref="CaptureException">Window not found or access denied.</exception>
    public async Task StartAsync(CancellationToken ct = default)
}
```

### Code Comments

```csharp
// Only comment WHY, not WHAT
// Bad: Increment counter by 1
// Good: Skip first frame which may be stale from previous capture session
_frameIndex++;
```

## Testing

### Test Naming

```csharp
[Fact]
public async Task StartAsync_WhenWindowNotFound_ThrowsCaptureException()
{
    // Arrange
    var capture = new WindowsGraphicsCapture(invalidHwnd);

    // Act & Assert
    await Assert.ThrowsAsync<CaptureException>(() => capture.StartAsync());
}
```

### Test Priority

1. Capture produces frames
2. Audio produces samples
3. A/V timestamps are synchronized
4. Hotkey triggers save
5. Anti-cheat games work (Valorant, League)
