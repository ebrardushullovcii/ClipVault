// Export the outlined masters. No fonts, tracing, or image generation is needed to rebuild.
import sharp from 'sharp'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'assets/brand')
const read = name => readFile(join(brand, 'source', name), 'utf8')
const [icon, small, wordmark] = await Promise.all([
  read('icon.svg'), read('icon-small.svg'), read('wordmark.svg'),
])
const outputs = []
async function save(relative, bytes) {
  const dest = join(root, relative)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, bytes)
  outputs.push(relative)
}
async function copy(from, to) {
  await mkdir(dirname(join(root, to)), { recursive: true })
  await copyFile(join(root, from), join(root, to))
  outputs.push(to)
}
async function png(svg, width, height) {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(width, height).png().toBuffer()
}
const removePlate = svg => svg.replace(/\s*<rect[^>]+\/>/, '')
const mark = removePlate(icon)
const darkInk = svg => svg.replaceAll('#FFFFFF', '#141B1E').replaceAll('#00D6CF', '#00877F')
const mono = (svg, color) => svg.replaceAll('#FFFFFF', color).replaceAll('#00D6CF', color)
const wrap = (width, height, contents) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${contents}</svg>`
function nest(svg, x, y, width, height) {
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `)
}

// Small ICO entries use 32-bit DIB + alpha + AND mask; 256px uses PNG.
async function ico(sizes) {
  const entries = []
  for (const size of sizes) {
    const rendered = await png(size <= 20 ? small : icon, size, size)
    let bytes = rendered
    if (size < 256) {
      const rgba = await sharp(rendered).ensureAlpha().raw().toBuffer()
      const stride = Math.ceil(size / 32) * 4
      const pixels = size * size * 4
      bytes = Buffer.alloc(40 + pixels + stride * size)
      bytes.writeUInt32LE(40, 0)
      bytes.writeInt32LE(size, 4)
      bytes.writeInt32LE(size * 2, 8)
      bytes.writeUInt16LE(1, 12)
      bytes.writeUInt16LE(32, 14)
      bytes.writeUInt32LE(pixels + stride * size, 20)
      for (let y=0; y<size; y++) for(let x=0; x<size; x++) {
        const src=(y*size+x)*4, dst=40+((size-1-y)*size+x)*4
        bytes[dst]=rgba[src+2]; bytes[dst+1]=rgba[src+1]
        bytes[dst+2]=rgba[src]; bytes[dst+3]=rgba[src+3]
        if (!rgba[src+3]) bytes[40+pixels+(size-1-y)*stride+(x>>3)] |= 0x80 >> (x%8)
      }
    }
    entries.push({ size, bytes })
  }
  const header = Buffer.alloc(6 + entries.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = header.length
  entries.forEach(({size, bytes}, i) => {
    const at=6+i*16
    header[at]=size===256?0:size; header[at+1]=header[at]
    header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6)
    header.writeUInt32LE(bytes.length,at+8); header.writeUInt32LE(offset,at+12)
    offset+=bytes.length
  })
  return Buffer.concat([header, ...entries.map(e=>e.bytes)])
}
async function bmp(svg, width, height) {
  const rgb = await sharp(await png(svg, width, height)).removeAlpha().raw().toBuffer()
  const stride = Math.ceil(width * 3 / 4) * 4
  const bytes = Buffer.alloc(54 + stride * height)
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length,2); bytes.writeUInt32LE(54,10)
  bytes.writeUInt32LE(40,14); bytes.writeInt32LE(width,18); bytes.writeInt32LE(height,22)
  bytes.writeUInt16LE(1,26); bytes.writeUInt16LE(24,28)
  bytes.writeUInt32LE(stride*height,34)
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const src=(y*width+x)*3, dst=54+(height-1-y)*stride+x*3
    bytes[dst]=rgb[src+2];bytes[dst+1]=rgb[src+1];bytes[dst+2]=rgb[src]
  }
  return bytes
}

const windowsSizes = [16,20,24,30,32,36,40,48,60,64,72,80,96,128,256,512,1024]
for(const size of windowsSizes) {
  await save(`assets/brand/windows/app-${size}.png`, await png(size<=20?small:icon,size,size))
}
await save('assets/brand/windows/app.ico', await ico(windowsSizes.filter(s=>s<=256)))
await save('assets/brand/windows/tray.ico', await ico([16,20,24,32,40,48,64]))
for(const size of [16,20,24,32,40,48,64]) {
  await copy(`assets/brand/windows/app-${size}.png`, `assets/brand/windows/tray-${size}.png`)
}

for(const [name, svg] of Object.entries({
  'wordmark-dark': wordmark, 'wordmark-light': darkInk(wordmark),
  'wordmark-white': mono(wordmark,'#FFFFFF'), 'wordmark-black': mono(wordmark,'#141B1E'),
  'mark-dark': mark, 'mark-light': darkInk(mark),
  'mark-white': mono(mark,'#FFFFFF'), 'mark-black': mono(mark,'#141B1E'),
  'app-icon': icon,
})) {
  await save(`assets/brand/logos/${name}.svg`, svg)
  const wide = name.startsWith('wordmark')
  await save(`assets/brand/logos/${name}.png`, await png(svg, wide?1580:1024,wide?490:1024))
  if(wide) await save(`assets/brand/logos/${name}@2x.png`, await png(svg,3160,980))
}

const webDir = 'assets/brand/web'
await save(`${webDir}/favicon.svg`, small)
await save(`${webDir}/favicon.ico`, await ico([16,24,32,48,64,256]))
for(const size of [16,32,48,64]) {
  await copy(`assets/brand/windows/app-${size}.png`, `${webDir}/favicon-${size}.png`)
}
// Touch icons are opaque; maskable icons keep the emblem inside the safe circle.
const touch = icon.replace('rx="208"', 'rx="0"')
const maskable = wrap(1024,1024,`<rect width="1024" height="1024" fill="#141B1E"/>${nest(mark,102.4,102.4,819.2,819.2)}`)
await save(`${webDir}/apple-touch-icon.png`, await png(touch,180,180))
for(const size of [192,512]) {
  await save(`${webDir}/android-chrome-${size}.png`, await png(icon,size,size))
  await save(`${webDir}/maskable-${size}.png`, await png(maskable,size,size))
}
await save(`${webDir}/site.webmanifest`, JSON.stringify({
  name:'ClipVault', short_name:'ClipVault', start_url:'/', display:'browser',
  background_color:'#141B1E', theme_color:'#141B1E',
  icons:[192,512].flatMap(s=>[
    {src:`android-chrome-${s}.png`,sizes:`${s}x${s}`,type:'image/png',purpose:'any'},
    {src:`maskable-${s}.png`,sizes:`${s}x${s}`,type:'image/png',purpose:'maskable'},
  ]),
},null,2)+'\n')

const social = wrap(1200,630,`<rect width="1200" height="630" fill="#141B1E"/>
${nest(wordmark,140,125,920,286)}
<text x="600" y="452" fill="#FFFFFF" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="34">Clutch now. Clip later.</text>
<text x="600" y="518" fill="#A9B6BA" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="22">Game clips. Local files. Free and open source.</text>`)
await save(`${webDir}/social-card.svg`, social)
await save(`${webDir}/social-card.png`, await png(social,1200,630))
const avatar = wrap(1024,1024,`<circle cx="512" cy="512" r="512" fill="#141B1E"/>${nest(mark,92,92,840,840)}`)
await save(`${webDir}/avatar.svg`,avatar)
await save(`${webDir}/avatar-512.png`,await png(avatar,512,512))

const sidebar=wrap(164,314,`<rect width="164" height="314" fill="#141B1E"/>
${nest(icon,36,62,92,92)}${nest(wordmark,11,176,142,44)}
<text x="82" y="261" text-anchor="middle" fill="#A9B6BA" font-size="11" font-family="Segoe UI,Arial,sans-serif">Clutch now.</text>
<text x="82" y="278" text-anchor="middle" fill="#A9B6BA" font-size="11" font-family="Segoe UI,Arial,sans-serif">Clip later.</text>`)
const header=wrap(150,57,`<rect width="150" height="57" fill="#FFFFFF"/>${nest(darkInk(wordmark),9,7,132,42)}`)
for(const [name,svg,width,height] of [['sidebar',sidebar,164,314],['header',header,150,57]]) {
  await save(`assets/brand/installer/${name}.svg`,svg)
  await save(`assets/brand/installer/${name}.png`,await png(svg,width,height))
  await save(`assets/brand/installer/${name}.bmp`,await bmp(svg,width,height))
}

// Runtime and website copies are deliberate: packaging doesn't resolve symlinks reliably.
await copy('assets/brand/windows/app.ico','ui/public/icons/icon.ico')
await copy('assets/brand/windows/app-256.png','ui/public/icons/icon_256.png')
await copy('assets/brand/windows/tray.ico','ui/public/icons/tray.ico')
await copy('assets/brand/windows/app-64.png','64x64.png')
await copy('assets/brand/windows/tray-64.png','64x64-2.png')
for(const name of ['app-icon','mark-dark','wordmark-dark','wordmark-light']) {
  await copy(`assets/brand/logos/${name}.svg`,`ui/public/brand/${name}.svg`)
}
for(const name of ['favicon.svg','favicon.ico','favicon-16.png','favicon-32.png','favicon-48.png','favicon-64.png',
  'apple-touch-icon.png','android-chrome-192.png','android-chrome-512.png',
  'maskable-192.png','maskable-512.png','site.webmanifest','social-card.png']) {
  await copy(`${webDir}/${name}`,`marketing/sites/assets/brand/${name}`)
}
await copy('assets/brand/windows/app-256.png','marketing/sites/assets/brand/icon-256.png')
for(const name of ['app-icon','mark-dark','mark-light','wordmark-dark','wordmark-light']) {
  await copy(`assets/brand/logos/${name}.svg`,`marketing/sites/assets/brand/${name}.svg`)
}
await copy('assets/brand/windows/app-256.png','marketing/video/public/brand/icon.png')
await copy('assets/brand/logos/wordmark-dark.svg','marketing/video/public/brand/wordmark.svg')

// A visual review page shows real-size icons on both themes, not only enlarged masters.
const iconRows=windowsSizes.filter(s=>s<=96).map(s=>`<div><img src="windows/app-${s}.png" width="${s}" height="${s}" alt="${s} pixel icon"><small>${s}px</small></div>`).join('')
const review=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClipVault brand assets</title>
<style>body{margin:0;background:#0d1315;color:#f3f6f7;font:16px Segoe UI,Arial,sans-serif}main{max-width:1120px;margin:auto;padding:48px 28px}h1{font-size:28px;margin:0 0 12px}p{color:#a9b6ba}section{padding:26px;margin:24px 0;border:1px solid #344246;border-radius:16px}.row{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.row>div{min-width:44px;display:flex;align-items:center;flex-direction:column;gap:12px}small{font-size:12px;opacity:.7}.light{background:#f4f6f7;color:#141b1e}.word{width:min(100%,560px);height:auto}.card{width:min(100%,700px);height:auto}.installer{display:flex;gap:24px;align-items:flex-start}a{color:#00d6cf}</style>
<main><h1>ClipVault brand assets</h1><p>Outlined vector masters. Transparent logo exports. Icons shown at their actual pixel sizes.</p>
<section><img class="word" src="logos/wordmark-dark.svg" alt="ClipVault"><div class="row">${iconRows}</div></section>
<section class="light"><img class="word" src="logos/wordmark-light.svg" alt="ClipVault"><div class="row">${iconRows}</div></section>
<section class="row"><img src="windows/app-256.png" width="224" height="224" alt="App icon"><img src="logos/mark-dark.svg" width="224" height="224" alt="Transparent mark"></section>
<section><img class="card" src="web/social-card.png" alt="ClipVault sharing card"></section>
<section class="installer"><img src="installer/sidebar.png" width="164" height="314" alt="Installer sidebar"><img src="installer/header.png" width="150" height="57" alt="Installer header"></section>
<p><a href="windows/app.ico">Windows app ICO</a> · <a href="windows/tray.ico">System tray ICO</a> · <a href="logos/wordmark-dark.svg">Wordmark SVG</a></p></main></html>`
await save('assets/brand/preview.html',review)
await save('assets/brand/manifest.json',JSON.stringify({
  colors:{background:'#141B1E',white:'#FFFFFF',turquoise:'#00D6CF',turquoiseOnLight:'#00877F'},
  masters:['source/icon.svg','source/icon-small.svg','source/wordmark.svg'],
  windowsSizes, files:outputs.filter(p=>p.startsWith('assets/brand/')).map(p=>p.slice('assets/brand/'.length)),
},null,2)+'\n')
console.log(`Exported ${outputs.length} brand assets and runtime copies.`)
