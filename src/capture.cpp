#include "capture.h"
#include "logger.h"
#include "config.h"
#include "obs_core.h"
#include <windows.h>
#include <algorithm>
#include <utility>
#include <vector>

namespace clipvault {

namespace {

struct MonitorDescriptor {
    std::string device_id;
    std::string device_name;
    RECT bounds{};
    bool primary = false;
};

BOOL CALLBACK collect_monitor(HMONITOR handle, HDC, LPRECT rect, LPARAM param)
{
    auto* monitors = reinterpret_cast<std::vector<MonitorDescriptor>*>(param);

    MONITORINFOEXA monitor_info{};
    monitor_info.cbSize = sizeof(monitor_info);
    if (!GetMonitorInfoA(handle, &monitor_info)) {
        return TRUE;
    }

    MonitorDescriptor monitor;
    monitor.bounds = *rect;
    monitor.primary = (monitor_info.dwFlags & MONITORINFOF_PRIMARY) != 0;
    monitor.device_id = monitor_info.szDevice;
    monitor.device_name = monitor_info.szDevice;

    DISPLAY_DEVICEA display_device{};
    display_device.cb = sizeof(display_device);
    if (EnumDisplayDevicesA(
            monitor_info.szDevice,
            0,
            &display_device,
            EDD_GET_DEVICE_INTERFACE_NAME)) {
        if (display_device.DeviceID[0] != '\0') {
            monitor.device_id = display_device.DeviceID;
        }
        if (display_device.DeviceString[0] != '\0') {
            monitor.device_name = display_device.DeviceString;
        }
    }

    monitors->push_back(std::move(monitor));
    return TRUE;
}

bool resolve_monitor(int configured_index, MonitorDescriptor& selected)
{
    std::vector<MonitorDescriptor> monitors;
    if (!EnumDisplayMonitors(nullptr, nullptr, collect_monitor, reinterpret_cast<LPARAM>(&monitors)) || monitors.empty()) {
        return false;
    }

    int selected_index = configured_index;
    if (selected_index < 0 || selected_index >= static_cast<int>(monitors.size())) {
        auto primary = std::find_if(monitors.begin(), monitors.end(), [](const MonitorDescriptor& monitor) {
            return monitor.primary;
        });
        selected_index = primary == monitors.end() ? 0 : static_cast<int>(primary - monitors.begin());
        LOG_WARNING(
            "  Configured monitor index " + std::to_string(configured_index) +
            " is unavailable; using monitor " + std::to_string(selected_index));
    }

    selected = monitors[static_cast<size_t>(selected_index)];
    return true;
}

int capture_method_value(const std::string& method)
{
    if (method == "auto") {
        return 0;
    }
    if (method == "wgc") {
        return 2;
    }
    return 1;
}

const char* capture_method_name(int method)
{
    switch (method) {
    case 0:
        return "Auto";
    case 2:
        return "WGC";
    default:
        return "DXGI";
    }
}

} // namespace

CaptureManager& CaptureManager::instance()
{
    static CaptureManager instance;
    return instance;
}

CaptureManager::~CaptureManager()
{
    shutdown();
}

bool CaptureManager::initialize()
{
    if (initialized_) {
        LOG_WARNING("Capture already initialized");
        return true;
    }

    LOG_INFO("Initializing capture sources...");

    if (!create_video_source()) {
        return false;
    }

    if (!create_audio_sources()) {
        // Cleanup video source if audio fails
        if (video_source_) {
            obs_api::source_release(video_source_);
            video_source_ = nullptr;
        }
        return false;
    }

    initialized_ = true;
    LOG_INFO("Capture sources initialized successfully!");
    return true;
}

void CaptureManager::shutdown()
{
    if (!initialized_) {
        return;
    }

    LOG_INFO("Shutting down capture sources...");

    if (microphone_) {
        obs_api::source_release(microphone_);
        microphone_ = nullptr;
    }

    if (desktop_audio_) {
        obs_api::source_release(desktop_audio_);
        desktop_audio_ = nullptr;
    }

    if (video_source_) {
        obs_api::source_release(video_source_);
        video_source_ = nullptr;
    }

    initialized_ = false;
    LOG_INFO("Capture sources shutdown complete");
}

bool CaptureManager::create_video_source()
{
    const char* capture_method_used = "none";

    const auto& video_config = ConfigManager::instance().video();
    int monitor_index = video_config.monitor;
    LOG_INFO("  Using monitor index: " + std::to_string(monitor_index));

    MonitorDescriptor monitor;
    if (!resolve_monitor(monitor_index, monitor)) {
        last_error_ = "Failed to resolve a Windows monitor for capture";
        LOG_ERROR(last_error_);
        return false;
    }

    const int requested_method = capture_method_value(video_config.capture_method);
    const bool capture_cursor = video_config.capture_cursor;
    const int monitor_width = monitor.bounds.right - monitor.bounds.left;
    const int monitor_height = monitor.bounds.bottom - monitor.bounds.top;
    LOG_INFO("  Resolved monitor: " + monitor.device_name + " (" +
             std::to_string(monitor_width) + "x" + std::to_string(monitor_height) +
             " at " + std::to_string(monitor.bounds.left) + "," +
             std::to_string(monitor.bounds.top) + ")");
    LOG_INFO("  OBS monitor_id: " + monitor.device_id);
    LOG_INFO("  Capture method: " + std::string(capture_method_name(requested_method)) +
             " (" + std::to_string(requested_method) + ")");
    LOG_INFO("  Capture cursor: " + std::string(capture_cursor ? "yes" : "no"));

    obs_data_t* settings = obs_api::data_create();
    if (!settings) {
        last_error_ = "Failed to allocate monitor capture settings";
        LOG_ERROR(last_error_);
        return false;
    }
    obs_api::data_set_string(settings, "monitor_id", monitor.device_id.c_str());
    obs_api::data_set_bool(settings, "capture_cursor", capture_cursor);
    obs_api::data_set_bool(settings, "force_sdr", false);
    obs_api::data_set_int(settings, "method", requested_method);

    video_source_ = obs_api::source_create("monitor_capture", "monitor_capture", settings, nullptr);
    obs_api::data_release(settings);
    settings = nullptr;

    if (video_source_) {
        capture_method_used = "monitor_capture";
        LOG_INFO("  Using monitor_capture (" + std::string(capture_method_name(requested_method)) + ")");
    } else {
        // Let OBS choose a compatible monitor-capture method before falling back
        // to a less safe process/window-specific source.
        settings = obs_api::data_create();
        if (settings) {
            obs_api::data_set_string(settings, "monitor_id", monitor.device_id.c_str());
            obs_api::data_set_bool(settings, "capture_cursor", capture_cursor);
            obs_api::data_set_bool(settings, "force_sdr", false);
            obs_api::data_set_int(settings, "method", 0);
            video_source_ = obs_api::source_create("monitor_capture", "monitor_capture_auto", settings, nullptr);
            obs_api::data_release(settings);
            settings = nullptr;
        }

        if (video_source_) {
            capture_method_used = "monitor_capture";
            LOG_INFO("  Using monitor_capture (Auto fallback)");
        } else {
            // Fallback to window_capture
            settings = obs_api::data_create();
            if (!settings) {
                last_error_ = "Failed to allocate window capture settings";
                LOG_ERROR(last_error_);
                return false;
            }

            HWND foreground = GetForegroundWindow();
            if (foreground) {
                char window_title[256];
                GetWindowTextA(foreground, window_title, sizeof(window_title));
                LOG_INFO("  Using window_capture: " + std::string(window_title));
                obs_api::data_set_string(settings, "window", window_title);
            } else {
                LOG_INFO("  Using window_capture (no foreground window)");
            }
            
            video_source_ = obs_api::source_create("window_capture", "window_capture", settings, nullptr);
            obs_api::data_release(settings);
            settings = nullptr;

            if (video_source_) {
                capture_method_used = "window_capture";
            }
        }
    }

    if (!video_source_) {
        last_error_ = "Failed to create any capture source";
        LOG_ERROR(last_error_);
        
        // Last resort - try game_capture
        settings = obs_api::data_create();
        if (!settings) {
            last_error_ = "Failed to allocate game capture settings";
            LOG_ERROR(last_error_);
            return false;
        }
        obs_api::data_set_string(settings, "capture_mode", "any_fullscreen");
        obs_api::data_set_bool(settings, "capture_cursor", capture_cursor);
        LOG_INFO("  Using game_capture (any_fullscreen mode - last resort)");
        
        video_source_ = obs_api::source_create("game_capture", "game_capture", settings, nullptr);
        obs_api::data_release(settings);
        
        if (video_source_) {
            capture_method_used = "game_capture";
        }
    }

    if (!video_source_) {
        last_error_ = "Failed to create any video capture source";
        LOG_ERROR(last_error_);
        return false;
    }

    // A single full-frame monitor source can feed the video mix directly.
    // Avoiding a one-item scene removes an unnecessary composition layer.
    obs_api::set_output_source(0, video_source_);
    LOG_INFO("  Capture source connected directly to the video mix");

    LOG_INFO("  Video capture source created: " + std::string(capture_method_used));
    return true;
}

bool CaptureManager::create_audio_sources()
{
    const auto& audio_cfg = ConfigManager::instance().audio();

    // Create desktop audio (system audio - what you hear)
    if (audio_cfg.system_audio_enabled) {
        LOG_INFO("  Creating desktop audio capture...");

        obs_data_t* settings = obs_api::data_create();
        // Use device_id from config, default to "default" if empty
        std::string device_id = audio_cfg.system_audio_device_id.empty() ? "default" : audio_cfg.system_audio_device_id;
        LOG_INFO("    Using device: " + device_id);
        obs_api::data_set_string(settings, "device_id", device_id.c_str());
        // use_device_timing is recommended for output capture
        obs_api::data_set_bool(settings, "use_device_timing", true);

        desktop_audio_ = obs_api::source_create("wasapi_output_capture", "desktop_audio", settings, nullptr);
        obs_api::data_release(settings);

        if (!desktop_audio_) {
            last_error_ = "Failed to create desktop audio source";
            LOG_ERROR(last_error_);
            return false;
        }

        // CRITICAL: Activate the source to start capturing
        obs_api::source_activate(desktop_audio_);
        LOG_INFO("    Desktop audio source activated");

        // CRITICAL: Connect to output channel 1 (desktop audio channel)
        obs_api::set_output_source(1, desktop_audio_);
        LOG_INFO("    Desktop audio connected to output channel 1");

        // Route desktop audio to mixer track 1 (bit 0 = 0x01)
        obs_api::source_set_audio_mixers(desktop_audio_, 1);
        LOG_INFO("    Desktop audio -> Track 1");
    }

    // Create microphone capture
    if (audio_cfg.microphone_enabled) {
        LOG_INFO("  Creating microphone capture...");

        obs_data_t* settings = obs_api::data_create();
        // Use device_id from config, default to "default" if empty
        std::string device_id = audio_cfg.microphone_device_id.empty() ? "default" : audio_cfg.microphone_device_id;
        LOG_INFO("    Using device: " + device_id);
        obs_api::data_set_string(settings, "device_id", device_id.c_str());

        microphone_ = obs_api::source_create("wasapi_input_capture", "microphone", settings, nullptr);
        obs_api::data_release(settings);

        if (!microphone_) {
            last_error_ = "Failed to create microphone source";
            LOG_ERROR(last_error_);
            return false;
        }

        // CRITICAL: Activate the source to start capturing
        obs_api::source_activate(microphone_);
        LOG_INFO("    Microphone source activated");

        // CRITICAL: Connect to output channel 2 (microphone channel)
        obs_api::set_output_source(2, microphone_);
        LOG_INFO("    Microphone connected to output channel 2");

        // Route microphone to mixer track 2 (bit 1 = 0x02)
        obs_api::source_set_audio_mixers(microphone_, 2);
        LOG_INFO("    Microphone -> Track 2");
    }

    return true;
}

obs_source_t* CaptureManager::get_output_source() const
{
    return video_source_;
}

bool CaptureManager::is_producing_frames() const
{
    obs_source_t* output_source = get_output_source();
    if (!video_source_ || !output_source) {
        return false;
    }

    // Check if source is active
    bool source_active = obs_api::source_active(video_source_);
    bool output_active = obs_api::source_active(output_source);

    LOG_INFO("[CAPTURE] Frame production check:");
    LOG_INFO("  Video source active: " + std::string(source_active ? "YES" : "NO"));
    LOG_INFO("  Output source active: " + std::string(output_active ? "YES" : "NO"));

    return source_active && output_active;
}

} // namespace clipvault
