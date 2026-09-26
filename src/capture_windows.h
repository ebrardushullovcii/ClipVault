#pragma once

#include <string>
#include <vector>
#include <cstdint>

namespace clipvault {

struct CaptureWindow {
    std::string id;
    std::string title;
    std::string executable;
    bool minimized = false;
    uintptr_t handle = 0;
    unsigned long process_id = 0;
    std::string window_class;
    std::string game;
    unsigned int width = 0;
    unsigned int height = 0;
};

std::vector<CaptureWindow> list_capture_windows();
// Prefer the foreground game, retain the current game across alt-tab, then
// choose an open game. Fullscreen alone never makes a browser/app a game.
CaptureWindow select_game_capture_window(const std::vector<CaptureWindow>& windows,
    const CaptureWindow& current, uintptr_t foreground);
CaptureWindow find_game_capture_window(const CaptureWindow& current);

} // namespace clipvault
