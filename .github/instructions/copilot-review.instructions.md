---
applyTo: "**"
excludeAgent: "cloud-agent"
---

Use these instructions only for GitHub Copilot pull request reviews in this repository.

ClipVault is a Windows game clipping app with two parts:
- `src/`: C++ backend built around libobs, hotkeys, replay saving, and tray behavior.
- `ui/`: Electron + React UI for browsing, trimming, exporting, and settings.

Review priorities:
- Focus on bugs, regressions, missing validation, packaging mistakes, Windows-specific breakage, and incorrect runtime path assumptions.
- Prioritize issues that affect packaged builds, tray behavior, hotkeys, replay saving, installer behavior, or persisted settings.
- Keep findings concrete. Prefer exact failure modes with file paths over broad refactor suggestions.
- Ignore lockfiles, generated assets, binary icon files, and formatting-only churn unless they hide a real risk.

Repository-specific checks:
- Packaging changes should keep `build.ps1`, `ui/package.json`, `ui/build/afterPack.cjs`, and runtime path usage aligned.
- The backend output is `bin/ClipVault.exe`; packaged Electron output is under `ui/release/win-unpacked/`; final Windows artifacts are under `ui/release/`.
- Changes that affect bundled resources should match the documented layout in `docs/FILE_PATHS.md`.
- Be skeptical of changes that work in dev mode but not in packaged Windows builds.

Validation guidance:
- Recommend `npm run backend:build` for backend-only changes.
- Recommend `npm run package:win` for installer or packaging changes.
- Recommend `npm run package:portable` when portable packaging or bundled resources are affected.
- If a concern depends on a build or packaging step, say which command would expose it.

Avoid weak comments:
- Do not suggest generic refactors unless they prevent a concrete bug.
- Do not ask for more abstraction or renaming without a clear correctness or maintenance issue.
- Do not flag missing tests unless there is a realistic uncovered regression path.
