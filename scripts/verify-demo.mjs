import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
})
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  })
  const page = await context.newPage()
  const errors = []
  const network = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.protocol === 'file:') return route.continue()
    network.push(url.href)
    return route.abort()
  })
  await page.goto(
    pathToFileURL(path.resolve('release/StarShop-demo.html')).href,
  )
  await page.getByText('店长手册', { exact: true }).waitFor()
  const loaded = await page.locator('.room-sprite').evaluate((e) => {
    const img = e.querySelector('img') || e
    return {
      src: img.getAttribute('src'),
      loaded:
        img instanceof HTMLImageElement
          ? img.complete && img.naturalWidth > 0
          : false,
    }
  })
  if (!loaded.src?.startsWith('data:') || !loaded.loaded)
    throw new Error(
      `Room art is not embedded/loaded: ${JSON.stringify(loaded)}`,
    )
  const before = await page.evaluate(() =>
    JSON.parse(JSON.parse(localStorage.getItem('starshop-save-v1')).data),
  )
  if (before.visitor.kind === 'seller')
    await page
      .locator('taro-button-core.primary')
      .filter({ hasText: '收购' })
      .click()
  else await page.getByText('婉拒这位客人，不推进日期', { exact: true }).click()
  await page.getByText('接待下一位', { exact: true }).waitFor()
  const after = await page.evaluate(() =>
    localStorage.getItem('starshop-save-v1'),
  )
  await page.reload()
  await page.getByText('接待下一位', { exact: true }).waitFor()
  if (
    (await page.evaluate(() => localStorage.getItem('starshop-save-v1'))) !==
    after
  )
    throw new Error('Standalone reload lost state')
  await page.getByText('接待下一位', { exact: true }).click()
  await mkdir('artifacts/demo', { recursive: true })
  await page.screenshot({
    path: 'artifacts/demo/standalone.png',
    fullPage: true,
  })
  if (errors.length || network.length)
    throw new Error(JSON.stringify({ errors, network }))
  console.log(
    'PASS: file:// demo, embedded art, real action, save/reload, zero network requests',
  )
} finally {
  await browser.close()
}
