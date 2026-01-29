# CLAUDE.md

This file provides guidance for Claude (Claude Code, Cursor, etc.) when working on ClipVault.

## Project Overview

ClipVault is a lightweight game clipping tool built on libobs. It's designed to be:
- Simple and lightweight
- Anti-cheat compatible
- Rock-solid A/V sync (via libobs)
- User-controllable

## Key Principles

1. **Use libobs for everything it handles well** - Don't reinvent what libobs does
2. **Keep it minimal** - No bloat, no unnecessary features
3. **Anti-cheat first** - No injection, no hooks, no process modification
4. **Understand before modifying** - Read relevant libobs headers before using APIs

## libobs Architecture

libobs uses a signal/slot system for events:
```cpp
// Connect to signals
obs_source_t *source = obs_get_source_by_name("display_capture");
signal_handler_t *sh = obs_source_get_signal_handler(source);
signal_handler_connect(sh, "video_rendered", on_frame_rendered, nullptr);
```

Key concepts:
- **Sources** - Video/audio sources (display capture, audio input, etc.)
- **Outputs** - Where encoded data goes (RTMP, MP4 recording, etc.)
- **Services** - Streaming services (Twitch, YouTube, etc.)
- **Encoders** - NVENC, x264, AAC encoders
- **Transitions** - Scene switching

## Common libobs Patterns

### Creating a display capture source:
```cpp
obs_data_t *settings = obs_data_create();
obs_data_set_string(settings, "device", "\\Device\\Display1");
obs_source_t *source = obs_source_create("monitor_capture", "Display", settings, nullptr);
obs_data_release(settings);
```

### Setting up NVENC encoding:
```cpp
obs_encoder_t *encoder = obs_video_encoder_create("h264_nvenc", "video_encoder", nullptr, nullptr);
obs_encoder_set_video(encoder, obs_get_video());
obs_encoder_set_bitrate(encoder, 6000);
```

### Recording to MP4:
```cpp
obs_output_t *output = obs_output_create("ffmpeg_muxer", "recording", nullptr, nullptr);
obs_output_set_video_encoder(output, encoder);
obs_output_set_mixers(output, 1);
obs_output_start(output);
```

## Useful libobs Functions

- `obs_get_video()` - Get video context
- `obs_get_audio()` - Get audio context  
- `obs_enum_sources()` - Enumerate available sources
- `obs_source_add_audio_capture_callback()` - Raw audio access
- `obs_add_raw_video_callback()` - Raw video access
- `obs_output_set_delay()` - For buffering/delayed recording

## Build System

Uses CMake. Key targets:
- `clipvault` - Main application
- Links against libobs (static or shared)

## Game Detection

Uses the existing `games.json` database:
- 150+ known games
- Process name matching
- Window title optional
- Results in folder naming only

## LLM Instructions

- When adding new files, follow existing code style
- Use modern C++17 where it improves readability
- Keep functions focused and small
- Comment non-obvious code
- Don't add TODO comments - just ask the user what to do

## Files to Read First

- libobs/docs/sphinx/reference-core.rst - Core API reference
- libobs/docs/sphinx/reference-sources.rst - Source types
- libobs/docs/sphinx/reference-outputs.rst - Output configuration