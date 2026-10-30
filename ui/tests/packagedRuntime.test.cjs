// CLIPVAULT_ELECTRON=<electron executable> node --test ui/tests/packagedRuntime.test.cjs
/* global process, __dirname */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const asar = require('../node_modules/@electron/asar')
const { verifyRuntimeDependencies } = require('../build/afterPack.cjs')

test('packaged load check rejects a missing transitive module and accepts a complete tree', async () => {
  const electron = process.env.CLIPVAULT_ELECTRON
  assert.ok(electron, 'Set CLIPVAULT_ELECTRON to an existing Electron executable')
  // Place fixtures under the repo deliberately: the broken archive must not
  // silently load isexe from the working development install.
  const scratch = await fs.mkdtemp(path.resolve(__dirname, '../../.cache/runtime-probe-'))
  try {
    for (const complete of [false, true]) {
      const dir = path.join(scratch, complete ? 'complete' : 'missing')
      const source = path.join(dir, 'source')
      const resources = path.join(dir, 'resources')
      await fs.mkdir(resources, { recursive: true })
      for (const name of ['fluent-ffmpeg', 'chokidar', ...(complete ? ['isexe'] : [])]) {
        const module = path.join(source, 'node_modules', name)
        await fs.mkdir(module, { recursive: true })
        await fs.writeFile(
          path.join(module, 'index.js'),
          name === 'fluent-ffmpeg' ? "require('isexe')" : 'module.exports = {}'
        )
      }
      await asar.createPackage(source, path.join(resources, 'app.asar'))
      if (complete) await verifyRuntimeDependencies(dir, electron)
      else
        await assert.rejects(verifyRuntimeDependencies(dir, electron), /Cannot find module 'isexe'/)
    }
  } finally {
    // scratch is the absolute mkdtemp directory created above inside .cache.
    await fs.rm(scratch, { recursive: true, force: true })
  }
})
