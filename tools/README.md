# Tools Directory

This directory contains external tools required by ClipVault.

## Required: FFmpeg

Download FFmpeg with NVENC support and place the following files here:

- `ffmpeg.exe`
- `ffprobe.exe` (optional, for metadata extraction)

### Download Options

1. **gyan.dev** (Recommended): https://www.gyan.dev/ffmpeg/builds/
    - Download "ffmpeg-release-full.7z"
    - Extract and copy `ffmpeg.exe` to this folder

2. **BtbN builds**: https://github.com/BtbN/FFmpeg-Builds/releases
    - Download "ffmpeg-master-latest-win64-gpl.zip"
    - Extract and copy `ffmpeg.exe` to this folder

### Verify NVENC Support

Run this command to verify NVENC is available:

```
ffmpeg -encoders | findstr nvenc
```

You should see:

```
V..... h264_nvenc    NVIDIA NVENC H.264 encoder
V..... hevc_nvenc    NVIDIA NVENC hevc encoder
```

## Note

These files are excluded from git (see `.gitignore`). Each developer/user must provide their own FFmpeg binaries.
