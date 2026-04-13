---
applyTo: "src/**/*.cpp,src/**/*.h,build.ps1,CMakeLists.txt,setup-obs.ps1,scripts/**/*.cmd"
excludeAgent: "cloud-agent"
---

For backend and build-system reviews, focus on Windows runtime correctness.

Check for:
- libobs initialization order issues and missing cleanup or release paths.
- resource file path mistakes between dev, `bin/`, and packaged `resources/bin/` layouts.
- tray, hotkey, and replay-buffer regressions.
- build-script assumptions that only work from one working directory.
- packaging steps that silently skip required files or degrade the backend executable metadata.

Do not comment on style unless it masks a real bug. Prefer concrete runtime failures over theoretical concerns.
