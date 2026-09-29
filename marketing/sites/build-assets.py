"""Builds web assets for the landing pages from the capture output.

Screenshots -> assets/shots/<name>-{1600,960}.webp (wide layout, 2x source)
Gameplay    -> assets/frames/<name>-{1920,960}.webp and assets/loops/<name>.mp4 (720p, silent)
Videos      -> assets/video/<id>.mp4 + .jpg (web renders from marketing/video/out/web)
"""
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent / '.out'
ASSETS = HERE / 'assets'
FFMPEG = OUT / 'app' / 'resources' / 'bin' / 'ffmpeg.exe'
SHOTS = OUT / 'shots'
WEB_VIDEO = HERE.parent / 'video' / 'out' / 'web'

SHOT_NAMES = [
    '01-library', '02-library-hover', '03-library-new-clip', '04-library-filter-game',
    '05-library-favorites', '07-library-list', '08-library-selected', '09-editor',
    '09b-editor-tagged', '10-editor-trimmed', '11-editor-audio', '12-editor-size-menu',
    '13b-editor-exported', '14-export-complete', '15-editor-game-picker', '16-editor-tekken',
    '17-editor-league', '18-settings-capture', '19-settings-games', '20-settings-quality',
    '22-settings-hotkey', 'w1-wizard-storage', 'w4-wizard-hotkey',
]

LIVE = 'staging/2026-09-28_23-30-00_VALORANT.mp4'
FRAMES = {
    'valorant-explosion': (LIVE, 0.5),
    'valorant-kill': (LIVE, 43.4),
    'valorant-won': (LIVE, 47.5),
    'tekken-fire': ('clips/2026-09-28_02-41-39_TEKKEN_8.mp4', 21.0),
    'tekken-ko': ('clips/2026-09-27_00-53-13_TEKKEN_8.mp4', 0.5),
    'league-fight': ('clips/2026-09-27_21-41-34_League_of_Legends.mp4', 0.6),
    'cs2-alley': ('clips/2026-09-25_22-34-47_Counter-Strike_2.mp4', 0.5),
    'valorant-neon': ('clips/2026-09-27_03-47-16_VALORANT.mp4', 0.5),
    'valorant-smoke': ('clips/2026-09-25_00-58-25_VALORANT.mp4', 0.5),
}
LOOPS = {
    'loop-valorant-win': (LIVE, 41.5, 5),
    'loop-tekken-fire': ('clips/2026-09-28_02-41-39_TEKKEN_8.mp4', 19.0, 5),
    'loop-league-fight': ('clips/2026-09-27_21-41-34_League_of_Legends.mp4', 0.0, 5),
}


def webp(src: Path, dst_stem: Path, widths, quality=82):
    im = Image.open(src).convert('RGB')
    out = {}
    for w in widths:
        h = round(im.height * w / im.width)
        path = dst_stem.parent / f'{dst_stem.name}-{w}.webp'
        im.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=quality, method=6)
        out[w] = [w, h]
    return out


def main():
    manifest = {'shots': {}, 'frames': {}, 'loops': [], 'videos': []}
    for sub in ['shots', 'frames', 'loops', 'video', 'brand']:
        (ASSETS / sub).mkdir(parents=True, exist_ok=True)

    for name in SHOT_NAMES:
        manifest['shots'][name] = webp(SHOTS / 'wide' / f'{name}.png', ASSETS / 'shots' / name, [1600, 960])
    # Export preview window is a separate small window.
    manifest['shots']['14-export-complete'] = webp(SHOTS / 'wide' / '14-export-complete.png', ASSETS / 'shots' / '14-export-complete', [980, 490])

    tmp = OUT / 'frame.png'
    for name, (src, t) in FRAMES.items():
        subprocess.run([str(FFMPEG), '-v', 'error', '-y', '-ss', str(t), '-i', str(OUT / src), '-frames:v', '1', str(tmp)], check=True)
        manifest['frames'][name] = webp(tmp, ASSETS / 'frames' / name, [1920, 960], quality=80)

    for name, (src, start, dur) in LOOPS.items():
        dst = ASSETS / 'loops' / f'{name}.mp4'
        subprocess.run([str(FFMPEG), '-v', 'error', '-y', '-ss', str(start), '-i', str(OUT / src), '-t', str(dur), '-an',
                        '-vf', 'scale=1280:-2', '-r', '30', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)], check=True)
        manifest['loops'].append(name)

    if WEB_VIDEO.exists():
        for f in sorted(WEB_VIDEO.iterdir()):
            if f.suffix in ('.mp4', '.jpg'):
                shutil.copy2(f, ASSETS / 'video' / f.name)
                if f.suffix == '.mp4':
                    manifest['videos'].append(f.stem)

    icon = HERE.parent.parent / 'ui' / 'public' / 'icons' / 'icon_256.png'
    shutil.copy2(icon, ASSETS / 'brand' / 'icon-256.png')
    Image.open(icon).resize((64, 64), Image.LANCZOS).save(ASSETS / 'brand' / 'favicon-64.png')

    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=1))
    print('assets ready:', sum(1 for _ in ASSETS.rglob('*') if _.is_file()), 'files')


if __name__ == '__main__':
    main()
