const fs = require('fs')
const path = require('path')
const rcedit = require('rcedit')

exports.default = async function afterPack(context) {
  if (process.platform !== 'win32') return

  const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon.ico')
  const exePaths = [
    path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`),
    path.join(context.appOutDir, 'resources', 'bin', 'ClipVault.exe'),
  ]

  for (const exePath of exePaths) {
    if (!fs.existsSync(exePath)) {
      continue
    }

    console.log(`  • rcedit: setting icon on ${path.basename(exePath)}`)
    await rcedit(exePath, { icon: iconPath })
  }
}
