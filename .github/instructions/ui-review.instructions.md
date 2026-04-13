---
applyTo: "ui/**/*.ts,ui/**/*.tsx,ui/**/*.js,ui/**/*.cjs,ui/package.json"
excludeAgent: "cloud-agent"
---

For Electron and React reviews, focus on packaged Windows behavior rather than browser-only expectations.

Check for:
- differences between dev and packaged resource paths.
- Electron main-process issues affecting windows, tray behavior, IPC, startup, or file system access.
- settings or library changes that can break persisted user behavior.
- installer and app metadata mismatches that would surface in taskbar, Explorer, Start menu, or Apps & Features.

Skip comments about visual preference unless there is an accessibility, usability, or functional regression.
