# ClipVault brand assets

The outlined SVG masters in `source/` preserve the approved angular C, turquoise play symbol, and white/turquoise wordmark. They contain no font dependencies, gradients, or textures. Run `npm run brand:build` to export and synchronize the assets; open `preview.html` to check actual-size icons on both themes.

- `windows/`: multi-resolution app and tray ICOs plus exact-size PNGs for Explorer, executables, Task Manager, taskbar, Start, shortcuts, drag previews, and notifications.
- `logos/`: transparent SVG/PNG wordmarks and standalone marks for dark/light backgrounds, plus single-color versions. Light-background turquoise is darker to preserve contrast.
- `web/`: SVG/ICO/PNG favicons, touch and maskable icons, avatar, web manifest, and a 1200×630 sharing card.
- `installer/`: NSIS header and sidebar artwork in SVG, PNG, and 24-bit BMP.

At 16 and 20 pixels, the C has thicker strokes and the turquoise symbol omits its tiny play cutout. Larger icons retain the full design. These are assets for the existing Win32/Electron and static website distribution; no MSIX package or new splash screen is introduced.

`scripts/build-brand-assets.mjs` owns the runtime copies in `ui/public/`, the legacy root PNG paths, and `marketing/sites/assets/brand/`. Windows shell icons are embedded in both executables by the existing build and packaging hooks. Existing clips and MP4 associations keep their video-player icons.
