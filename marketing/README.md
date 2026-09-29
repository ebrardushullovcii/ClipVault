# Marketing media

Product videos and landing page concepts built from the real app. Generated media lives in `.out/`,
`video/public/`, `video/out/` (all gitignored); `sites/assets/` holds the web-sized copies the pages use.

## Pipeline

1. **Isolated app** (`capture/`): `node prepare-app.mjs` copies `ui/release/win-unpacked` into `.out/app`,
   repacks `app.asar` from the current `ui/dist`, and swaps `bin/ClipVault.exe` for a stub that never records
   (`capture/fake-backend`, compile with the .NET Framework `csc.exe`). The driver launches it with its own
   `--user-data-dir` and `APPDATA`, so it never touches the installed ClipVault or its settings.
2. **Library** (`capture/seed-library.mjs`): copies a curated set of real clips from `D:\Clips\ClipVault`
   (override with `CLIPVAULT_SOURCE`) into `.out/clips` with current naming, dates and metadata.
   One clip is held in `.out/staging` and moved in during capture to show a clip arriving after F9.
3. **Screenshots** (`capture/session.mjs`): `node session.mjs shots wide,compact` runs `shots.mjs` against the
   app at 1600×1000 and 1280×800, 2x scale (CDP device metrics), and writes `.out/shots/<layout>/*.png` plus
   `rects.json` with element positions for pointers and spotlights. `node session.mjs wizard wide,compact` does
   the first-run setup. Every session quits the app and reports leftover processes.
4. **Videos** (`video/`, Remotion 4): `node sync-assets.mjs` copies shots and cuts gameplay segments,
   `node render.mjs stills <id> <frames>` for review, `node render.mjs video all` for every composition:
   screenshot-driven videos (hero, tour, trim-export, library × wide/compact, 30 fps) and the motion pieces in
   `src/motion/` (launch-film, exploded, vertical 9:16, bento-wide/square, 60 fps; UI pieces recreated in `ui.tsx`).
   Output is CRF 20 in `video/out/full`, plus web versions and posters in `video/out/web`
   (`CONCURRENCY=6` speeds renders up).
5. **Landing pages** (`sites/`): `python build-assets.py` makes WebP screenshots, gameplay frames, loops and copies
   the web videos into `sites/assets`. Each concept is a static folder (`01-…` to `10-…`); `BRIEF.md` is the fact
   sheet and rules they follow; `node shoot.mjs <folder>` screenshots a page at desktop and phone widths.
6. **Deploy**: the live site is the #clips concept on Netlify project `getclipvault` (team `ebrardushullovcii`).
   The repo-root `netlify.toml` has Netlify run `sites/build-deploy.py`, which writes a standalone copy (only the
   assets the page uses, plus social preview tags) to `sites/dist` and publishes it. Pushes to master that don't
   touch `marketing/sites` skip the build. For a local copy, run
   `python build-deploy.py 08-thread https://getclipvault.netlify.app` (output in `.out/deploy/08-thread`).

Messaging: the save hotkey is configurable, so copy says "your hotkey", never leads with F9. Tagline: "Clutch now. Clip later."
