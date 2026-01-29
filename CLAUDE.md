# CLAUDE.md - Claude AI Instructions

This file provides Claude-specific context for ClipVault. See `AGENTS.md` for general AI assistant instructions.

## Project Overview

ClipVault is a Windows game clipping software built in C#/.NET 8. It captures gameplay with a rolling buffer and saves clips on hotkey press using NVENC hardware encoding.

## Tech Stack (Current Implementation)

- **Screen Capture:** GDI (full screen, 720p) - see `src/ClipVault.Core/Capture/GdiScreenCapture.cs`
- **Audio:** NAudio 2.2+ with WASAPI (loopback + microphone)
- **Encoding:** FFmpeg process with NVENC (not FFmpeg.AutoGen)
- **Configuration:** System.Text.Json

## Build Commands

```bash
dotnet build              # Build from root
dotnet run                # Run service (from root)
dotnet publish -c Release # Release build
```

## Code Conventions

See `docs/CONVENTIONS.md` for full guidelines. Key points:

- File-scoped namespaces
- Records for immutable data
- Private fields: `_camelCase`
- Always async/await for I/O
- Implement IDisposable for unmanaged resources

## Documentation

- `docs/PLAN.md` - Implementation plan and architecture
- `docs/CONVENTIONS.md` - Code style guide
- `AGENTS.md` - General AI assistant rules (READ THIS FIRST)
