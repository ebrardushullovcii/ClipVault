#include "capture_windows.h"
#include "game_detector.h"
#include <windows.h>
#include <dwmapi.h>
#include <algorithm>

namespace clipvault {
namespace {

std::string utf8(const wchar_t* value)
{
    const int size = WideCharToMultiByte(CP_UTF8, 0, value, -1, nullptr, 0, nullptr, nullptr);
    if (size <= 1) return {};
    std::string result(static_cast<size_t>(size), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value, -1, result.data(), size, nullptr, nullptr);
    result.pop_back();
    return result;
}

std::string encode_component(const std::string& value)
{
    std::string result;
    for (const char c : value) {
        if (c == '#') result += "#22";
        else if (c == ':') result += "#3A";
        else result += c;
    }
    return result;
}

BOOL CALLBACK collect_window(HWND window, LPARAM context)
{
    if (!IsWindowVisible(window)) return TRUE;
    const LONG_PTR style = GetWindowLongPtrW(window, GWL_EXSTYLE);
    if (style & WS_EX_TOOLWINDOW) return TRUE;
    DWORD cloaked = 0;
    if (SUCCEEDED(DwmGetWindowAttribute(window, DWMWA_CLOAKED, &cloaked, sizeof(cloaked))) && cloaked) return TRUE;

    const int length = GetWindowTextLengthW(window);
    if (length <= 0) return TRUE;
    std::wstring title(static_cast<size_t>(length) + 1, L'\0');
    if (!GetWindowTextW(window, title.data(), static_cast<int>(title.size()))) return TRUE;
    wchar_t class_name[256]{};
    if (!GetClassNameW(window, class_name, 256)) return TRUE;
    DWORD process_id = 0;
    GetWindowThreadProcessId(window, &process_id);
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
    if (!process) return TRUE;
    wchar_t path[32768]{};
    DWORD size = 32768;
    const bool found = QueryFullProcessImageNameW(process, 0, path, &size) != 0;
    CloseHandle(process);
    if (!found) return TRUE;
    const wchar_t* executable = wcsrchr(path, L'\\');
    executable = executable ? executable + 1 : path;
    if (_wcsicmp(executable, L"ClipVault.exe") == 0) return TRUE;
    // These are Windows shell surfaces, not useful capture targets.
    if (wcscmp(class_name, L"Progman") == 0 || wcscmp(class_name, L"WorkerW") == 0 ||
        wcscmp(class_name, L"Shell_TrayWnd") == 0) return TRUE;

    CaptureWindow item;
    item.title = utf8(title.c_str());
    item.executable = utf8(executable);
    item.minimized = IsIconic(window) != 0;
    item.handle = reinterpret_cast<uintptr_t>(window);
    item.process_id = process_id;
    item.window_class = utf8(class_name);
    RECT client{};
    if (GetClientRect(window, &client)) {
        item.width = static_cast<unsigned int>(std::max(0L, client.right - client.left));
        item.height = static_cast<unsigned int>(std::max(0L, client.bottom - client.top));
    }
    item.id = encode_component(item.title) + ":" + encode_component(utf8(class_name)) + ":" + encode_component(item.executable);
    reinterpret_cast<std::vector<CaptureWindow>*>(context)->push_back(std::move(item));
    return TRUE;
}

} // namespace

std::vector<CaptureWindow> list_capture_windows()
{
    std::vector<CaptureWindow> windows;
    EnumWindows(collect_window, reinterpret_cast<LPARAM>(&windows));
    std::sort(windows.begin(), windows.end(), [](const CaptureWindow& a, const CaptureWindow& b) {
        return a.title < b.title;
    });
    return windows;
}

CaptureWindow select_game_capture_window(const std::vector<CaptureWindow>& windows,
    const CaptureWindow& current, uintptr_t foreground)
{
    CaptureWindow retained;
    CaptureWindow candidate;
    for (auto window : windows) {
        // These database entries are launchers, not the rendered game.
        if (_stricmp(window.executable.c_str(), "LeagueClient.exe") == 0 ||
            _stricmp(window.executable.c_str(), "VALORANT.exe") == 0) continue;
        // javaw is shared by unrelated apps. Minecraft identifies its own window.
        if (_stricmp(window.executable.c_str(), "javaw.exe") == 0 &&
            window.title.find("Minecraft") == std::string::npos &&
            window.window_class != "LWJGL" && window.window_class != "GLFW30") continue;
        for (const auto& game : GameDatabase::instance().games()) {
            const bool match = std::any_of(game.process_names.begin(), game.process_names.end(),
                [&](const std::string& executable) {
                    return _stricmp(executable.c_str(), window.executable.c_str()) == 0;
                });
            if (match) { window.game = game.name; break; }
        }
        if (window.game.empty()) continue;
        const bool same = window.handle == current.handle && window.process_id == current.process_id;
        if (same) retained = window;
        // Ignore splash screens and tiny auxiliary windows; retain a minimized game.
        if (window.minimized || window.width < 320 || window.height < 180) continue;
        if (window.handle == foreground) return window;
        if (static_cast<uint64_t>(window.width) * window.height >
            static_cast<uint64_t>(candidate.width) * candidate.height) candidate = window;
    }
    return retained.handle ? retained : candidate;
}

CaptureWindow find_game_capture_window(const CaptureWindow& current)
{
    return select_game_capture_window(list_capture_windows(), current,
        reinterpret_cast<uintptr_t>(GetForegroundWindow()));
}

} // namespace clipvault
