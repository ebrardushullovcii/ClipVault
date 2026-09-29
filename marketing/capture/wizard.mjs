// First-run wizard screenshots (driver launched with FIRST_RUN=1). Never finishes setup.
export async function run(ctx, layout) {
  const { page: p, sleep } = ctx
  await ctx.setLayout(layout)
  // Show a neutral example folder instead of the capture workspace path. Display only:
  // the main process keeps using the isolated clips folder and setup is never finished.
  await ctx.app.evaluate(({ ipcMain }) => {
    if (globalThis.__wizardPathPatched) return
    globalThis.__wizardPathPatched = true
    const original = ipcMain._invokeHandlers.get('settings:get')
    ipcMain.removeHandler('settings:get')
    ipcMain.handle('settings:get', async (...args) => ({
      ...(await original(...args)),
      output_path: 'C:\\Users\\Player\\Videos\\ClipVault',
    }))
  })
  await p.reload()
  await p.getByRole('button', { name: /Continue/ }).waitFor({ timeout: 30000 })
  await p.mouse.move(layout === 'wide' ? 760 : 610, 20)
  await sleep(1500)
  const shots = []
  for (const name of ['storage', 'capture', 'audio', 'hotkey']) {
    const file = `w${shots.length + 1}-wizard-${name}`
    await ctx.shot(file, { layout })
    shots.push(file)
    if (name === 'hotkey') break
    await p.getByRole('button', { name: /Continue/ }).click()
    await sleep(1200)
  }
  return shots
}
