#pragma once

#include <string>
#include "capture_windows.h"

// Forward declarations for OBS types
struct obs_source;
typedef struct obs_source obs_source_t;
struct obs_scene;
typedef struct obs_scene obs_scene_t;

namespace clipvault {

class CaptureManager {
public:
    static CaptureManager& instance();

    // Initialize capture sources
    bool initialize();

    // Shutdown and release sources
    void shutdown();

    // Check if initialized
    bool is_initialized() const { return initialized_; }

    // Get sources (for encoder/output setup)
    obs_source_t* get_video_source() const { return video_source_; }
    obs_source_t* get_desktop_audio() const { return desktop_audio_; }
    obs_source_t* get_microphone() const { return microphone_; }
    
    // Get the source connected to the OBS video mix and replay output.
    obs_source_t* get_output_source() const;
    
    // Check if capture is producing frames (for debugging)
    bool is_producing_frames() const;
    bool has_video() const;
    bool set_game_window(const CaptureWindow& window);
    bool wait_for_video(unsigned int timeout_ms) const;
    const CaptureWindow& game_window() const { return game_window_; }

    // Get last error
    const std::string& last_error() const { return last_error_; }

private:
    CaptureManager() = default;
    ~CaptureManager();

    CaptureManager(const CaptureManager&) = delete;
    CaptureManager& operator=(const CaptureManager&) = delete;

    bool create_video_source();
    bool create_window_source(const std::string& selector);
    bool create_monitor_source();
    void release_video_source();
    bool create_audio_sources();

    obs_source_t* video_source_ = nullptr;
    obs_scene_t* scene_ = nullptr;
    CaptureWindow game_window_;
    int working_monitor_method_ = -1;
    obs_source_t* desktop_audio_ = nullptr;
    obs_source_t* microphone_ = nullptr;

    bool initialized_ = false;
    std::string last_error_;
};

} // namespace clipvault
