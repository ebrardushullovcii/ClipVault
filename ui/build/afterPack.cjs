const fs = require('fs')
const path = require('path')
const rcedit = require('rcedit')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

async function verifyRuntimeDependencies(appOutDir, executable) {
  const probeDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clipvault-runtime-'))
  const probe = path.join(probeDir, 'probe.cjs')
  try {
    const archive = path.join(appOutDir, 'resources', 'app.asar')
    // Only main-process packages are loaded by Node; renderer dependencies
    // (including React and Zustand) are already bundled by Vite.
    const imports = ['fluent-ffmpeg', 'chokidar']
      .map(
        name =>
          `require(${JSON.stringify(path.join(appOutDir, 'resources', 'app.asar', 'node_modules', name))})`
      )
      .join('\n')
    // A smoke build inside the repo must not resolve missing shipped modules
    // from the developer's node_modules higher up the directory tree.
    const source = `const Module = require('node:module')
const archive = ${JSON.stringify(archive)}
const modulePaths = Module._nodeModulePaths
Module._nodeModulePaths = function (from) {
  return modulePaths.call(this, from).filter(p => p.startsWith(archive + require('node:path').sep))
}
${imports}`
    await fs.promises.writeFile(probe, source)
    // Load the shipped dependency tree in Electron's Node mode. This does not
    // start the app, recorder, watcher, or user settings migrations.
    await execFileAsync(executable, [probe], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      timeout: 30000,
    })
    console.log('  • verified packaged runtime dependencies')
  } finally {
    await fs.promises.unlink(probe).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
    await fs.promises.rmdir(probeDir)
  }
}

exports.verifyRuntimeDependencies = verifyRuntimeDependencies

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

  await verifyRuntimeDependencies(context.appOutDir, exeTargets[0].path)
}
