const fs = require('fs')
const path = require('path')
const rcedit = require('rcedit')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon.ico')
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Missing icon for afterPack: ${iconPath}`)
  }

  const exeTargets = [
    {
      path: path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`),
      required: true,
    },
    {
      path: path.join(context.appOutDir, 'resources', 'bin', 'ClipVault.exe'),
      required: true,
    },
  ]

  for (const target of exeTargets) {
    const exePath = target.path
    if (!fs.existsSync(exePath)) {
      const message = `Missing packaged executable for icon update: ${exePath}`
      if (target.required) {
        throw new Error(message)
      }
      console.warn(`  • rcedit: ${message}`)
      continue
    }

    console.log(`  • rcedit: setting ClipVault icon and version on ${path.basename(exePath)}`)
    await rcedit(exePath, {
      icon: iconPath,
      'file-version': context.packager.appInfo.version,
      'product-version': context.packager.appInfo.version,
      'version-string': {
        ProductName: 'ClipVault',
        FileDescription: target.path.includes(`${path.sep}bin${path.sep}`)
          ? 'ClipVault Recording Service'
          : 'ClipVault Editor',
        CompanyName: 'ClipVault',
        OriginalFilename: 'ClipVault.exe',
      },
    })
  }
}
