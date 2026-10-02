"""Builds a standalone, deployable copy of one landing page.

  python build-deploy.py 08-thread https://getclipvault.netlify.app [out-dir]

Copies the page's index.html/style.css/script.js into out-dir (default ../.out/deploy/<folder>),
copies only the assets it references, rewrites ../assets/ to assets/, and adds social preview tags.
Netlify runs this from the repo's netlify.toml with out-dir "dist".
"""
import re
import hashlib
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
folder, base_url = sys.argv[1], sys.argv[2].rstrip('/')
src = HERE / folder
out = (Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else HERE.parent / '.out' / 'deploy' / folder)
# The output folder is wiped first, so only allow it inside marketing/.
if HERE.parent not in out.parents:
    sys.exit(f'Refusing to write outside marketing/: {out}')
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)

texts = {}
for name in ['index.html', 'style.css', 'script.js']:
    p = src / name
    if p.exists():
        texts[name] = p.read_text(encoding='utf-8')

refs = set()
for t in texts.values():
    refs.update(re.findall(r'\.\./assets/[\w./-]+', t))

OG_IMAGE = 'assets/brand/social-card.png'
refs.add('../' + OG_IMAGE)
# Manifest icon URLs are relative to the manifest, rather than the HTML page.
refs.update('../assets/brand/' + name for name in [
    'android-chrome-192.png', 'android-chrome-512.png',
    'maskable-192.png', 'maskable-512.png',
])
missing = []
for ref in sorted(refs):
    rel = ref[3:]
    s = HERE / rel
    if not s.exists():
        missing.append(rel)
        continue
    d = out / rel
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(s, d)

html = texts['index.html']
title = re.search(r'<title>(.*?)</title>', html, re.S).group(1)
desc = re.search(r'<meta name="description" content="(.*?)">', html, re.S).group(1)
og = '\n'.join([
    f'<link rel="canonical" href="{base_url}/">',
    '<meta property="og:type" content="website">',
    f'<meta property="og:url" content="{base_url}/">',
    f'<meta property="og:title" content="{title}">',
    f'<meta property="og:description" content="{desc}">',
    f'<meta property="og:image" content="{base_url}/{OG_IMAGE}">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="ClipVault. Clutch now. Clip later.">',
    '<meta name="twitter:card" content="summary_large_image">',
    f'<meta name="twitter:image" content="{base_url}/{OG_IMAGE}">',
])
html = html.replace('<!--OG-->', og)
for name, t in texts.items():
    t = html if name == 'index.html' else t
    t = t.replace('../assets/', 'assets/')
    # A changed logo or video must refresh even when its old URL is cached.
    def asset_url(match):
        url = match.group(0)
        asset = out / url
        if not asset.is_file():
            return url
        revision = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        return f'{url}?v={revision}'
    t = re.sub(r'assets/[\w./-]+', asset_url, t)
    (out / name).write_text(t, encoding='utf-8')

# Static files, no build step.
(out / 'netlify.toml').write_text('[build]\n  publish = "."\n  command = ""\n')
# Long cache for media; the page itself revalidates.
(out / '_headers').write_text('/assets/*\n  Cache-Control: public, max-age=604800\n')

size = sum(f.stat().st_size for f in out.rglob('*') if f.is_file())
print(f'{out}: {sum(1 for f in out.rglob("*") if f.is_file())} files, {size / 1e6:.1f} MB')
if missing:
    print('MISSING:', missing)
    sys.exit(1)
