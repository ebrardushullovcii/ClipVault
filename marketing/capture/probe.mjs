// Ad-hoc look at the current app state.
export async function run(ctx, layout) {
  await ctx.setLayout(layout)
  await ctx.sleep(5000)
  await ctx.shot('probe-now', { layout })
  return (await ctx.page.evaluate(() => document.body.innerText)).slice(0, 400)
}
