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
        shutdown();
        return false;
    }

    if (!create_audio_sources()) {
        shutdown();
        return false;
    }

    initialized_ = true;
    LOG_INFO("Capture sources initialized successfully!");
    return true;
}

void CaptureManager::shutdown()
{
    if (!initialized_ && !microphone_ && !desktop_audio_ && !video_source_ && !scene_) {
        return;
    }

    LOG_INFO("Shutting down capture sources...");

    if (microphone_) {
        obs_api::set_output_source(2, nullptr);
        obs_api::source_deactivate(microphone_);
        obs_api::source_release(microphone_);
        microphone_ = nullptr;
    }

    if (desktop_audio_) {
        obs_api::set_output_source(1, nullptr);
        obs_api::source_deactivate(desktop_audio_);
        obs_api::source_release(desktop_audio_);
        desktop_audio_ = nullptr;
    }

    release_video_source();
    game_window_ = {};
    initialized_ = false;
    LOG_INFO("Capture sources shutdown complete");
}

void CaptureManager::release_video_source()
{
    obs_api::set_output_source(0, nullptr);
    if (scene_) {
        obs_api::scene_release(scene_);
        scene_ = nullptr;
    }
    if (video_source_) {
        obs_api::source_release(video_source_);
        video_source_ = nullptr;
    }

}

bool CaptureManager::has_video() const
{
    if (ConfigManager::instance().video().capture_target == "game" || game_window_.handle) {
        HWND window = reinterpret_cast<HWND>(game_window_.handle);
        DWORD process_id = 0;
        if (!window || !IsWindowVisible(window) || IsIconic(window) ||
            !GetWindowThreadProcessId(window, &process_id) || process_id != game_window_.process_id) return false;
    }
    return video_source_ && obs_api::source_get_width(video_source_) > 0 &&
        obs_api::source_get_height(video_source_) > 0;
}

bool CaptureManager::wait_for_video(unsigned int timeout_ms) const
{
    const ULONGLONG deadline = GetTickCount64() + timeout_ms;
    while (GetTickCount64() < deadline) {
        if (has_video()) return true;
        MSG message;
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        Sleep(10);
    }
    return has_video();
}

bool CaptureManager::create_window_source(const std::string& selector)
{
    const auto& video = ConfigManager::instance().video();
    if (selector.empty() || std::count(selector.begin(), selector.end(), ':') != 2) {
        last_error_ = "Choose a game or app window in Settings before starting window capture";
        LOG_ERROR(last_error_);
        return false;
    }
    obs_data_t* settings = obs_api::data_create();
    if (!settings) {
        last_error_ = "Failed to allocate window capture settings";
        return false;
    }
    obs_api::data_set_string(settings, "window", selector.c_str());
    obs_api::data_set_int(settings, "method", 2); // Windows Graphics Capture; no injection.
    // Automatic capture must stay in the game's executable even if another app
    // uses the same title. OBS title-priority matching does not check the exe.
    obs_api::data_set_int(settings, "priority", video.capture_target != "window" ? 2 : 1);
    obs_api::data_set_bool(settings, "cursor", video.capture_cursor);
    obs_api::data_set_bool(settings, "client_area", true);
    obs_api::data_set_bool(settings, "capture_audio", false); // Desktop + mic remain separate sources.
    video_source_ = obs_api::source_create("window_capture", "selected_window", settings, nullptr);
    obs_api::data_release(settings);
    if (!video_source_) {
        last_error_ = "Failed to create Windows Graphics Capture source";
        return false;
    }
    scene_ = obs_api::scene_create("window_fit");
    obs_sceneitem_t* item = scene_ ? obs_api::scene_add(scene_, video_source_) : nullptr;
    if (!item) {
        last_error_ = "Failed to fit the selected window to the recording canvas";
        return false;
    }
    // OBS recomputes the fit when the source resizes, preserving its aspect ratio.
    obs_api::scene_fit_item(item, video.width, video.height);
    obs_api::set_output_source(0, obs_api::scene_get_source(scene_));
    LOG_INFO(std::string("Window capture: WGC, ") +
        (video.capture_target != "window" ? "game-executable matching" : "exact-title matching") + ", desktop audio unchanged");
    return true; // A closed/minimized window may become available later.
}

bool CaptureManager::set_game_window(const CaptureWindow& window)
{
    // The caller must stop or pause replay and stop its health thread before
    // replacing the source. Hybrid mode keeps the encoded history across switches.
    release_video_source();
    game_window_ = {};
    if (!window.handle) {
        if (ConfigManager::instance().video().capture_target == "hybrid") return create_monitor_source();
        scene_ = obs_api::scene_create("waiting_for_game");
        if (!scene_) { last_error_ = "Failed to create game capture scene"; return false; }
        obs_api::set_output_source(0, obs_api::scene_get_source(scene_));
        return true;
    }
    if (!create_window_source(window.id)) {
        release_video_source();
        return false;
    }
    game_window_ = window;
    LOG_INFO("[AUTO_GAME] Selected " + window.game + " (" + window.executable + ")");
    return true;
}

bool CaptureManager::create_video_source()
{
    const auto& video = ConfigManager::instance().video();
    if (video.capture_target == "game") return set_game_window({});
    if (video.capture_target == "window") return create_window_source(video.capture_window);

    return create_monitor_source();
}

bool CaptureManager::create_monitor_source()
{
    const auto& video = ConfigManager::instance().video();
    MonitorDescriptor monitor;
    if (!resolve_monitor(video.monitor, monitor)) {
        last_error_ = "Failed to resolve a Windows monitor for capture";
        LOG_ERROR(last_error_);
        return false;
    }
    LOG_INFO("Resolved monitor: " + monitor.device_name + " (" + monitor.device_id + ")");
    const int requested = working_monitor_method_ >= 0
        ? working_monitor_method_ : capture_method_value(video.capture_method);
    // Source creation can succeed without a single captured frame. Try the
    // alternate monitor API if the requested one cannot initialize on this PC.
    const int methods[] = {requested, requested == 2 ? 1 : 2};
    for (int method : methods) {
        obs_data_t* settings = obs_api::data_create();
        if (!settings) break;
        obs_api::data_set_string(settings, "monitor_id", monitor.device_id.c_str());
        obs_api::data_set_bool(settings, "capture_cursor", video.capture_cursor);
        obs_api::data_set_bool(settings, "force_sdr", false);
        obs_api::data_set_int(settings, "method", method);
        video_source_ = obs_api::source_create("monitor_capture", "monitor_capture", settings, nullptr);
        obs_api::data_release(settings);
        if (video_source_) {
            obs_api::set_output_source(0, video_source_);
            if (wait_for_video(3000)) {
                working_monitor_method_ = method;
                LOG_INFO("Monitor capture has frames: " + std::string(capture_method_name(method)));
                return true;
            }
            obs_api::set_output_source(0, nullptr);
            obs_api::source_release(video_source_);
            video_source_ = nullptr;
        }
        LOG_WARNING("Monitor capture unavailable: " + std::string(capture_method_name(method)));
    }
    last_error_ = "Neither monitor capture method produced video. Check the selected display and graphics driver.";
    LOG_ERROR(last_error_);
    return false;
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
    return scene_ ? obs_api::scene_get_source(scene_) : video_source_;
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
