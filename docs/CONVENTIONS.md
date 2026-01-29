# Code Conventions

## C++17 Standard

ClipVault uses C++17. Prefer:
- `[[nodiscard]]`, `[[maybe_unused]]` attributes
- `std::string_view` for string parameters
- `std::optional<T>` for optional values
- Structured bindings: `auto& [key, value] : map`
- `if constexpr` for compile-time conditionals

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Files | `snake_case.cpp` | `hotkey_handler.cpp` |
| Classes | `PascalCase` | `ClipVaultService` |
| Functions | `snake_case()` | `start_capture()` |
| Variables | `snake_case` | `frame_buffer` |
| Member variables | `snake_case_` | `capture_source_` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_BUFFER_SECONDS` |
| Templates | `PascalCase` | `Observable<T>` |
| Namespaces | `snake_case` | `clipvault::buffer` |

## Include Order

```cpp
// 1. Corresponding header
#include "hotkey_handler.h"

// 2. C standard library
#include <cstdint>
#include <cstring>

// 3. C++ standard library
#include <string>
#include <vector>
#include <optional>

// 4. Third-party libraries
#include <obs.h>

// 5. Project headers
#include "buffer.h"
#include "config.h"
```

## Code Organization

### Header Files (`.h`)

```cpp
#pragma once

// Forward declarations
struct ObsContext;

namespace clipvault {

// Forward declarations within namespace
class CaptureBuffer;

class HotkeyHandler
{
public:
    explicit HotkeyHandler(HWND window);
    ~HotkeyHandler();

    bool Register(UINT modifiers, UINT key);
    void Unregister();

    // Signals
    std::function<void()> OnClipRequested;

private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT msg, WPARAM wparam, LPARAM lparam);

    HWND window_ = nullptr;
    UINT hotkey_id_ = 0;
};

} // namespace clipvault
```

### Implementation Files (`.cpp`)

```cpp
#include "hotkey_handler.h"

#include "config.h"

namespace clipvault {

HotkeyHandler::HotkeyHandler(HWND window)
    : window_(window)
{
}

HotkeyHandler::~HotkeyHandler()
{
    Unregister();
}

bool HotkeyHandler::Register(UINT modifiers, UINT key)
{
    hotkey_id_ = GlobalAddAtom(std::to_string(modifiers + key).c_str());
    return RegisterHotKey(window_, hotkey_id_, modifiers, key);
}

// ... rest of implementation

} // namespace clipvault
```

## Memory Management

### Prefer RAII

```cpp
// BAD: Manual cleanup
void CaptureRecorder::Stop()
{
    obs_output_stop(output_);
    obs_output_release(output_);
}

// GOOD: RAII with scope guard
class ObsOutputGuard
{
public:
    explicit ObsOutputGuard(obs_output_t* output) : output_(output) {}
    ~Guard() { if (output_) obs_output_stop(output_); }

    // ... move semantics, no copy

private:
    obs_output_t* output_ = nullptr;
};
```

### Smart Pointers

- Use `std::unique_ptr<T>` for exclusive ownership
- Use `std::shared_ptr<T>` for shared ownership
- Use raw pointers for non-owning references
- Don't use `std::auto_ptr` (removed in C++17)

## Error Handling

### Result Types for Expected Errors

```cpp
struct ClipSaveResult
{
    bool success;
    std::string error_message;
    std::string file_path;
};

class ClipVaultError : public std::runtime_error
{
public:
    using std::runtime::runtime_error;
    explicit ClipVaultError(const char* msg) : std::runtime_error(msg) {}
};

// For functions that can fail expectedly:
std::expected<ClipSaveResult, std::string> SaveClip(Config config);

// For unrecoverable errors:
void CheckObsError(obs_property_t* prop, bool success)
{
    if (!success) {
        const char* error = obs_property_get_description(prop);
        throw ClipVaultError(error ? error : "Unknown OBS error");
    }
}
```

### Assertions in Debug

```cpp
#define CV_ASSERT(expr) assert(expr)

// Use for invariants that should never fail
CV_ASSERT(source != nullptr);
CV_ASSERT(buffer_size > 0);
```

## Logging

```cpp
#include "logging.h"

void StartCapture()
{
    CV_LOG_INFO("Starting capture at {}x{}", width, height);

    if (!obs_output_start(output_)) {
        CV_LOG_ERROR("Failed to start output: {}", obs_output_get_last_error(output_));
        return false;
    }

    CV_LOG_INFO("Capture started successfully");
}
```

## libobs Integration

### Object Lifecycle

```cpp
// Creation
obs_source_t* source = obs_source_create("monitor_capture", "Display", settings, nullptr);
obs_data_release(settings);

// Ownership transfer (for outputs that take ownership)
obs_output_set_video_encoder(output_, encoder);  // encoder must be retained

// Cleanup
obs_source_release(source);
```

### Signal Connection

```cpp
void ConnectSignals(obs_output_t* output)
{
    signal_handler_t* sh = obs_output_get_signal_handler(output);
    signal_handler_connect(sh, "start", OnOutputStart, this);
    signal_handler_connect(sh, "stop", OnOutputStop, this);
    signal_handler_connect(sh, "upload", OnUploadChunk, this);
}
```

### Threading

libobs is NOT thread-safe for most operations:
- Call libobs functions from the main/graphics thread
- Use `obs_queue_video()`, `obs_queue_audio()` for threaded callbacks
- Use signals for event notification

## Performance

### Avoid Unnecessary Copies

```cpp
// BAD: Copy
auto frames = buffer.GetAllFrames();

// GOOD: Const reference
const auto& frames = buffer.GetFrames();

// GOOD: Span for arrays
void ProcessFrames(std::span<const Frame> frames);
```

### Reserve Capacity

```cpp
std::vector<Frame> frames;
frames.reserve(expected_frame_count);

for (const auto& frame : source_frames) {
    frames.push_back(frame);
}
```

### Use Move Semantics

```cpp
std::vector<Frame> ProcessAndMove(std::vector<Frame>&& input)
{
    // Modify input directly (no copy)
    input.resize(desired_count);
    return std::move(input);  // Move return
}
```

## Comments

### When to Comment

- Why something is done, not what (obvious from code)
- Non-obvious assumptions
- TODO items (but prefer creating issues)
- Complex algorithms

### Style

```cpp
// Single line comment (use sparingly)

// Multi-line explanation
// of something non-obvious
// that requires context
```

### Doxygen (Public API Only)

```cpp
/**
 * Starts the rolling buffer capture.
 *
 * @param duration_seconds How many seconds to keep in the buffer
 * @return true if capture started successfully
 */
bool StartCapture(int duration_seconds);
```

## Formatting

Use clang-format with this config:

```yaml
BasedOnStyle: LLVM
IndentWidth: 4
ColumnLimit: 120
AllowShortFunctionsOnASingleLine: Empty
KeepEmptyLinesAtTheStartOfBlocks: false
```

Run: `clang-format -i src/*.cpp src/*.h`