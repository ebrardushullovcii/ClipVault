#pragma once

#include <windows.h>
#include <shellapi.h>
#include <functional>
#include <string>

namespace clipvault {

class SystemTray {
public:
    static SystemTray& instance();

    bool initialize(HINSTANCE hInstance);
    void shutdown();

    // Run the message loop (blocks until quit)
    int run();

    // Request exit
    void quit();

    // Show a balloon notification
    void show_notification(const std::string& title, const std::string& message);

    // Set callback for menu actions
    using MenuCallback = std::function<void(int)>;
    void set_menu_callback(MenuCallback callback) { menu_callback_ = callback; }

    // Set callback for tray icon click (to show main window)
    using TrayClickCallback = std::function<void()>;
    void set_tray_click_callback(TrayClickCallback callback) { tray_click_callback_ = callback; }

    // Set callback for "Open" menu item
    using OpenUICallback = std::function<void()>;
    void set_open_ui_callback(OpenUICallback callback) { open_ui_callback_ = callback; }

    void set_app_running(bool app_running);
    bool is_app_running() const { return app_running_; }
    void rebuild_menu();
    void hide_icon();

    // Menu item IDs
    static constexpr int MENU_STATUS_APP = 1;
    static constexpr int MENU_STATUS_SERVICE = 2;
    static constexpr int MENU_OPEN = 3;
    static constexpr int MENU_OPEN_FOLDER = 4;
    static constexpr int MENU_START_SERVICE = 5;
    static constexpr int MENU_EXIT_SERVICE = 6;
    static constexpr int MENU_HIDE_TRAY_ICON = 8;

private:
    SystemTray() = default;
    ~SystemTray();

    SystemTray(const SystemTray&) = delete;
    SystemTray& operator=(const SystemTray&) = delete;

    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
    void handle_tray_message(WPARAM wParam, LPARAM lParam);
    void show_context_menu();
    void refresh_app_state();

    HWND hwnd_ = nullptr;
    NOTIFYICONDATAA nid_ = {};
    HMENU menu_ = nullptr;
    HICON hIcon_ = nullptr;
    ULONG_PTR gdiplus_token_ = 0;
    bool initialized_ = false;
    bool icon_visible_ = false;
    bool running_ = false;
    bool app_running_ = false;
    MenuCallback menu_callback_;
    TrayClickCallback tray_click_callback_;
    OpenUICallback open_ui_callback_;

    static constexpr UINT WM_TRAYICON = WM_USER + 1;
};

} // namespace clipvault
