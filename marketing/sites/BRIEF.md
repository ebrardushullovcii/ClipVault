# ClipVault landing pages: shared brief

Ten landing page concepts for ClipVault, each in its own folder (`01-…` to `10-…`) with an `index.html`
(optional `style.css` / `script.js` in the same folder). All pages share `../assets/`.

## What ClipVault is (verified facts; do not claim anything beyond this list)

- A game clipping tool for **Windows 10 and 11**. Free and open source (GPL-2.0-or-later). Current version **1.7.6**.
- Runs in the background with an **always-on replay buffer**. Press your **save hotkey** (F9 by default, changeable) to save the
  **last 2 minutes** (default buffer length, adjustable in Settings) as a normal **MP4** file.
- The hotkey uses a low-level keyboard hook, so it works while a fullscreen game has focus.
- **Game/desktop audio and microphone are recorded to separate audio tracks.** In the editor either track can be
  turned off or its volume changed before export.
- When a clip is saved, Windows shows a "Clip Saved" notification and the clip appears in the library right away.
- **Library**: thumbnails, hover-to-preview (clips play in the grid), grid or list view, search, sort (date, size,
  name, favorite), filter by **game**, **tag** or **favorites**. Detected games are tagged automatically (the clip
  file name also includes the game, e.g. `2026-09-28_23-30-00_VALORANT.mp4`). Select several clips to favorite,
  tag, add/remove game, export or delete them in bulk.
- **Editor**: drag trim handles, playback stays inside the trim, add tags, favorite, change the game tag,
  frame-step and 5-second skip controls. **Export** with a size target: **Up to 10 MB** (Discord-friendly),
  50 MB, 100 MB, or keep original. Compression **H.264** (most compatible) or **AV1** (better quality per MB, needs
  an NVIDIA RTX 40-series or newer GPU). Optional FPS (30/60) and resolution (720p/1080p) for the export.
  "Trim Original" trims the file in place. After export, a small window lets you drag the file anywhere,
  copy its path or open its folder.
- **Capture**: monitor capture by default (DXGI), which is anti-cheat friendly: **no game hooks or injection**.
  Optional modes: "Games automatically" (experimental; records supported games only, follows the active game),
  "Monitor + automatic games" (experimental), or a manually chosen app window.
- **Encoding**: NVENC (NVIDIA GPU, lowest CPU use) with x264 CPU fallback ("Auto" picks). H.264 or AV1 recording.
  Frame rates 30, 60, 120, 144. Quality presets: Compact, Efficient, Balanced, Detailed, Maximum.
- **Local**: clips are ordinary files in a folder you choose. No account. Nothing is uploaded.
- Tray app; can start with Windows. A first-run setup walks through clips folder, capture, audio and hotkey.
- Built on libobs (the engine from OBS Studio) plus an Electron/React app.

### The hotkey is not the message

The save hotkey is user-configurable and the default may change in a future version. Do not build headlines,
taglines, hero visuals, key graphics, stats, easter eggs or concept names around "F9". Say "your hotkey",
"one key" or "the save key". F9 may appear at most once or twice as a plain spec/FAQ detail, phrased as
"F9 by default, changeable in Settings". Key graphics show a generic hotkey (e.g. a keycap with a record dot
and the word HOTKEY), never "F9".

### Do not claim or invent

No testimonials, quotes, ratings, user counts, download counts, GitHub stars, "trusted by", press logos,
awards, benchmarks, "zero FPS impact", AI features, macOS/Linux/console support, cloud sync, mobile apps,
Discord/YouTube upload integrations, pricing tiers, or roadmap promises. No fake stats. If a design needs
numbers, use real ones from the list above (2:00, 10 MB, 144 fps, 2 audio tracks, 1.7.6, GPL-2.0, Win 10/11).

## Links

- Download (primary CTA): `https://github.com/ebrardushullovcii/ClipVault/releases/latest`
  (installer file is `ClipVault-Setup-1.7.6.exe`, Windows 10/11 x64)
- Source code: `https://github.com/ebrardushullovcii/ClipVault`
- License: GPL-2.0-or-later

## Assets (`../assets/`)

Screenshots are the real app with a real clip library (the developer's own gameplay).
All screenshot/frame images come in two widths: `-1600.webp`/`-960.webp` (screens) or `-1920.webp`/`-960.webp`
(gameplay frames). Use `srcset` so phones load the small one. Screens are 16:10 (1600×1000); frames are 16:9.

Videos (`video/`, 1280×720, silent H.264, each has a `.jpg` poster with the same name):

| file | length | content |
| --- | --- | --- |
| `hero-wide.mp4` | 12 s, seamless loop | round win in VALORANT → hotkey press → "Clip Saved" → clip shrinks into the library → trim → export. Best hero video. |
| `tour-wide.mp4` | 50 s | full product tour with on-screen captions (title card, save, library, editor, audio, export, capture settings, end card). Use behind a "watch the tour" button or in a section, not autoplaying muted in the hero. |
| `trim-export-wide.mp4` | 17 s | editor: tag, trim, mute mic, export under 10 MB, export window. Captions included. |
| `library-wide.mp4` | 17 s | hotkey → new clip appears, hover preview, favorites/game filter, bulk select. Captions included. |
| `*-compact.mp4` | same | the same four videos from a smaller 1280×800 app window (denser UI). |
| `launch-film.mp4` | 35 s, 60 fps | motion-design launch film: kinetic type, hotkey press, 3D library wall, trim, mute mic, export, feature montage, logo. |
| `exploded.mp4` | 24 s, 60 fps | calm 3D "exploded view" of the real app with callouts (library, editor, settings). |
| `vertical.mp4` | 20 s, 60 fps, 720×1280 | 9:16 social cut. |
| `bento-wide.mp4`, `bento-square.mp4` | 16 s, 60 fps, seamless loop | six (square: four) animated feature tiles. Good as a looping section background or feature block. |

Gameplay loops (`loops/`, 5 s, 1280×720, silent): `loop-valorant-win.mp4` (kill + "WON" banner),
`loop-tekken-fire.mp4` (fighting game fireball), `loop-league-fight.mp4` (MOBA teamfight).

Gameplay frames (`frames/`): `valorant-explosion` (orange/red laser explosion, strongest image), `valorant-kill`,
`valorant-won` ("WON" banner), `tekken-fire` (fireball punch, very colorful), `tekken-ko`, `league-fight`,
`cs2-alley` (calm sandy street), `valorant-neon` (rainbow wall), `valorant-smoke` (purple smoke).

App screenshots (`shots/`):

| name | shows |
| --- | --- |
| `01-library` | library grid, 23 clips across VALORANT, TEKKEN 8, League of Legends, CS2, TFT |
| `02-library-hover` | hover preview playing on a card |
| `03-library-new-clip` | the just-saved VALORANT clip at the top of the library (24 clips) |
| `04-library-filter-game` | filtered to VALORANT |
| `05-library-favorites` | favorites only |
| `07-library-list` | list view |
| `08-library-selected` | 3 clips selected, bulk action bar (Favorite, Add Tag, Remove Tag, Add Game, Remove Game, Size, Compression, Export, Delete) |
| `09-editor` | editor on the new clip (big gameplay frame, audio tracks panel, export panel) |
| `09b-editor-tagged` | editor after adding tag "clutch" and favoriting |
| `10-editor-trimmed` | trimmed to 0:38–1:04 (25.8 s) on the "WON" moment |
| `11-editor-audio` | microphone track turned off, desktop audio volume up |
| `12-editor-size-menu` | export size menu open (Keep original / Up to 10 MB / 50 / 100 MB) |
| `13b-editor-exported` | "Export Complete!" |
| `14-export-complete` | the small export window (980×733): video + "Drag from here to share the file anywhere", Copy Path, Open Folder |
| `15-editor-game-picker` | game tag picker dialog |
| `16-editor-tekken`, `17-editor-league` | editor on a TEKKEN 8 clip / a League of Legends clip |
| `18-settings-capture` | Settings > Video & Capture (Record: Monitor, monitors, DXGI, resolution, fps, quality presets) |
| `19-settings-games` | Record set to "Games automatically (Experimental)" with its explanation |
| `20-settings-quality` | quality presets, buffer duration, encoder (Auto/NVENC/x264), H.264/AV1 |
| `22-settings-hotkey` | export defaults, Hotkey (F9), Startup & Behavior toggles |
| `w1-wizard-storage`, `w4-wizard-hotkey` | first-run setup, step 1 and step 4 |

Brand: `brand/icon-256.png` (dark rounded square with a glowing teal "CV"), `brand/favicon-64.png`.
The app's own palette: background `#0f0f0f`/`#1a1a1a`, accent teal `#00d4aa`. A concept may use a completely
different palette; keep the product screenshots unaltered (no recoloring, no fake UI painted over them).

Footer note to include somewhere small: "Gameplay recorded with ClipVault. Game names and footage belong to their
respective owners." No game logos.

## Technical rules

- Static HTML/CSS/vanilla JS only. No build step, no npm packages, no CDNs except Google Fonts.
- Paths are relative (`../assets/...`). The page must work opened from disk and when served from a folder.
- Responsive from 360 px to 1920 px wide. No horizontal scrolling at any width.
- Videos: `<video autoplay muted loop playsinline preload="metadata" poster="...">` for loops; the tour gets
  controls and `preload="none"`. Pause offscreen autoplay videos with IntersectionObserver when there are several.
- `prefers-reduced-motion: reduce` must remove large motion (parallax, marquees, auto-scrolling, scroll-jacking)
  and should not autoplay video.
- Accessibility: semantic landmarks and heading order, meaningful `alt` text, visible focus styles, WCAG AA
  contrast for body text, buttons are real `<a>`/`<button>` elements.
- Images below the fold: `loading="lazy"` and explicit `width`/`height` to avoid layout shift.
- `<title>` = "ClipVault · <short line>". Add a meta description and the favicon.
- Keep each page self-contained in its folder. Do not edit `../assets/` or other concepts.

## Copy rules

Plain, direct sentences. Say what the product does. No hype words ("revolutionary", "seamless", "game-changing",
"unleash", "elevate", "supercharge"), no rhetorical questions stacked for effect, no filler transitions.
The concept supplies the tone and vocabulary, but every claim must map to the fact list above.

## Self-check before finishing

Run `node shoot.mjs <folder>` from `marketing/sites/` and look at the three PNGs it writes to
`marketing/.out/site-shots/` (desktop viewport, desktop full page, 390 px phone full page). Fix anything broken:
overflow, overlapping text, unreadable contrast, empty sections, images not loading, console errors.
