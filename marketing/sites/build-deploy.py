"""Builds a standalone, deployable copy of one landing page.

  python build-deploy.py 08-thread https://clipvault.netlify.app

Copies the page's index.html/style.css/script.js into ../.out/deploy/<folder>, copies only the
assets it references, rewrites ../assets/ to assets/, and adds social preview tags.
"""
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
folder, base_url = sys.argv[1], sys.argv[2].rstrip('/')
src = HERE / folder
out = HERE.parent / '.out' / 'deploy' / folder
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

OG_IMAGE = 'assets/video/launch-film.jpg'
refs.add('../' + OG_IMAGE)
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
    '<meta property="og:image:width" content="1280">',
    '<meta property="og:image:height" content="720">',
    '<meta name="twitter:card" content="summary_large_image">',
])
html = html.replace('<!--OG-->', og)
for name, t in texts.items():
    t = html if name == 'index.html' else t
    (out / name).write_text(t.replace('../assets/', 'assets/'), encoding='utf-8')

# Static files, no build step.
(out / 'netlify.toml').write_text('[build]\n  publish = "."\n  command = ""\n')
# Long cache for media; the page itself revalidates.
(out / '_headers').write_text('/assets/*\n  Cache-Control: public, max-age=604800\n')

size = sum(f.stat().st_size for f in out.rglob('*') if f.is_file())
print(f'{out}: {sum(1 for f in out.rglob("*") if f.is_file())} files, {size / 1e6:.1f} MB')
if missing:
    print('MISSING:', missing)
    sys.exit(1)
