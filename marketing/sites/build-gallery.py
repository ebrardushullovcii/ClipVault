"""Builds the gallery page (index.html) and its thumbnails.

Thumbnails come from the desktop screenshots made by shoot.mjs; the video list only includes
files that exist in assets/video, so the gallery can be rebuilt as renders finish.
"""
import html
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SHOTS = HERE.parent / '.out' / 'site-shots'
GALLERY = HERE / 'gallery'
VIDEO = HERE / 'assets' / 'video'

PAGES = [
    ('01-broadcast', 'Instant Replay', 'Live sports broadcast package: scorebug, lower thirds, replay wipes, telestrator marks.'),
    ('02-vault', 'The Vault', 'A vault door that opens onto the product; features as safe-deposit boxes.'),
    ('03-rewind', 'Rewind', 'Home video era: a CRT, tape counters and a shelf of labeled cassettes.'),
    ('04-manpage', 'man clipvault', 'The product written up as a Unix manual page, for open-source and power users.'),
    ('05-arcade', 'Insert Coin', 'An arcade cabinet in attract mode, with a high-score table of real clips.'),
    ('06-issue', 'Issue 1.7.6', 'A Swiss-style magazine feature printed on paper. Light theme.'),
    ('07-timeline', 'Scrub', 'The page is a video editor timeline, with game and mic audio lanes.'),
    ('08-thread', '#clips', 'A group chat where a clip gets saved, trimmed and shared.'),
    ('09-poster', 'Poster', 'Kinetic brutalist poster: giant type, acid lime, tickers and stickers.'),
    ('10-studio', 'Studio', 'A light, premium product page with scroll-driven product shots.'),
]

VIDEOS = [
    ('launch-film', 'Launch film', '35 s, 60 fps. Kinetic type, the hotkey press, a 3D library wall, trim, mute, export and a feature montage.', []),
    ('exploded', 'Exploded view', '24 s, 60 fps. The real app split into 3D layers with callouts.', []),
    ('vertical', 'Vertical cut', '20 s, 60 fps, 9:16 for X, TikTok and Reels.', []),
    ('bento-wide', 'Bento loop', '16 s seamless loop of animated feature tiles.', [('bento-square', 'Square')]),
    ('hero-wide', 'Hero loop', '12 s seamless loop: round win, hotkey, library, trim, export.', [('hero-compact', '1280×800 app')]),
    ('tour-wide', 'Product tour', '50 s tour with captions.', [('tour-compact', '1280×800 app')]),
    ('trim-export-wide', 'Trim & export', '17 s: tag, trim, mute the mic, export under 10 MB.', [('trim-export-compact', '1280×800 app')]),
    ('library-wide', 'Library', '17 s: a new clip arrives, hover preview, filters, bulk select.', [('library-compact', '1280×800 app')]),
]

CSS = """
:root {
  /* Layout: a dark contact sheet; page previews as tall cards, videos below. */
  --bg: #0b0d0d;
  --panel: #131616;
  --line: rgba(236, 244, 242, 0.1);
  --fg: #ecf4f2;
  --muted: rgba(236, 244, 242, 0.62);
  --accent: #19d3ad;
  --display: 'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif;
  --body: 'Geist', 'Segoe UI', system-ui, sans-serif;
  --mono: 'Geist Mono', Consolas, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); line-height: 1.5; }
a { color: inherit; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.wrap { max-width: 1320px; margin: 0 auto; padding-inline: 20px; padding-block: 40px 56px; }
header { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
header img { width: 52px; height: 52px; }
h1 { font-family: var(--display); font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.02em; margin: 0; text-wrap: balance; }
.lede { margin: 6px 0 0; color: var(--muted); max-width: 62ch; }
h2 { font-family: var(--display); font-size: 22px; margin: 44px 0 16px; }
.note { color: var(--muted); font-size: 14px; margin: -8px 0 18px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 20px; }
.card { display: flex; flex-direction: column; min-width: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; text-decoration: none; }
a.card:hover { border-color: var(--accent); }
.shot { aspect-ratio: 16 / 10; overflow: hidden; background: #000; }
.shot img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.meta { padding: 14px 16px 16px; display: grid; gap: 4px; }
.num { font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; color: var(--accent); }
.meta h3 { margin: 0; font-size: 18px; }
.meta p { margin: 0; color: var(--muted); font-size: 14.5px; }
.vid { aspect-ratio: 16 / 9; background: #000; }
.vid video { width: 100%; height: 100%; object-fit: contain; display: block; }
.links { display: flex; flex-wrap: wrap; gap: 14px; font-size: 14px; margin-top: 4px; }
.links a { color: var(--accent); }
footer { margin-top: 48px; color: var(--muted); font-size: 13.5px; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
"""


def main():
    GALLERY.mkdir(exist_ok=True)
    cards = []
    for folder, name, desc in PAGES:
        shot = SHOTS / f'{folder}-desktop.png'
        if not (HERE / folder / 'index.html').exists():
            continue
        if shot.exists():
            im = Image.open(shot).convert('RGB')
            im.resize((960, round(im.height * 960 / im.width))).save(GALLERY / f'{folder}.webp', 'WEBP', quality=80)
        cards.append(
            f'<a class="card" href="{folder}/index.html"><div class="shot"><img src="gallery/{folder}.webp" '
            f'alt="First screen of the {html.escape(name)} concept" width="960" height="600" loading="lazy"></div>'
            f'<div class="meta"><span class="num">{folder[:2]}</span><h3>{html.escape(name)}</h3><p>{html.escape(desc)}</p></div></a>'
        )
    vids = []
    for file, name, desc, extra in VIDEOS:
        if not (VIDEO / f'{file}.mp4').exists():
            continue
        poster = f' poster="assets/video/{file}.jpg"' if (VIDEO / f'{file}.jpg').exists() else ''
        links = ''.join(f'<a href="assets/video/{f}.mp4">{html.escape(label)}</a>' for f, label in extra if (VIDEO / f'{f}.mp4').exists())
        vids.append(
            f'<div class="card"><div class="vid"><video src="assets/video/{file}.mp4"{poster} controls preload="none" playsinline></video></div>'
            f'<div class="meta"><h3>{html.escape(name)}</h3><p>{html.escape(desc)}</p><div class="links"><a href="assets/video/{file}.mp4">Open video</a>{links}</div></div></div>'
        )
    missing = len(VIDEOS) - len(vids)
    page = f"""<title>ClipVault Concepts</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Geist:wght@400;600&family=Geist+Mono:wght@500&display=swap">
<style>{CSS}</style>
<div class="wrap">
<header><img src="assets/brand/icon-256.png" alt="" width="52" height="52">
<div><h1>ClipVault landing page concepts</h1>
<p class="lede">Ten directions built from the real app and a real clip library. Open one to see it full size; each is a complete page.</p></div></header>
<main>
<h2>Landing pages</h2>
<div class="grid">{''.join(cards)}</div>
<h2>Videos</h2>
{f'<p class="note">{missing} more are still rendering and will appear here.</p>' if missing else ''}
<div class="grid">{''.join(vids)}</div>
</main>
<footer>Gameplay recorded with ClipVault. Game names and footage belong to their respective owners.</footer>
</div>
"""
    (HERE / 'index.html').write_text(page, encoding='utf-8')
    print(f'gallery: {len(cards)} pages, {len(vids)} videos ({missing} pending)')


if __name__ == '__main__':
    main()
