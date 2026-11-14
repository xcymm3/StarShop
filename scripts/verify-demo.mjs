import { chromium } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
})
try {
  const demoFile = path.resolve(process.argv[2] || 'release/StarShop-demo.html')
  const output = path.join(
    'artifacts/offline-v04',
    path.basename(demoFile, '.html'),
  )
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
  const requests = [],
    errors = []
  page.on('request', (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', (route) =>
    new URL(route.request().url()).protocol === 'file:'
      ? route.continue()
      : route.abort(),
  )
  await page.goto(
    pathToFileURL(path.resolve(process.argv[2] || 'release/StarShop-demo.html'))
      .href,
  )
  await page.waitForFunction(() => !!window.starshop)
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('img')]
    return (
      images.length >= 3 &&
      images.every(
        (img) =>
          img.complete && img.naturalWidth > 0 && img.src.startsWith('data:'),
      )
    )
  })
  const before = await page.evaluate(() => window.starshop.observe())
  assert.equal(before.day, 1)
  await page
    .getByRole('button', { name: '交易平板', exact: true })
    .first()
    .click()
  const item = before.visitor.stock.find((i) => i.sellerAsk <= before.cash)
  assert.ok(item)
  await page
    .getByRole('button', { name: '选入 ' + item.uid, exact: true })
    .click()
  await page.getByText('确认收购', { exact: true }).last().click()
  const bought = await page.evaluate(() => window.starshop.observe())
  assert.equal(bought.cash, before.cash - item.sellerAsk)
  assert.equal(bought.inventory.find((i) => i.uid === item.uid).quality, null)
  await page.reload()
  await page.waitForFunction(() => !!window.starshop)
  const restored = await page.evaluate(() => window.starshop.observe())
  assert.equal(restored.cash, bought.cash)
  assert.equal(restored.inventory.length, bought.inventory.length)
  assert.deepEqual(requests, [])
  assert.deepEqual(errors, [])
  await mkdir(output, { recursive: true })
  await page.screenshot({
    path: path.join(output, 'standalone.png'),
    fullPage: true,
  })
  await writeFile(
    path.join(output, 'verification.json'),
    JSON.stringify(
      {
        scheme: 'file:',
        file: path.basename(demoFile),
        networkRequests: requests,
        errors,
        cashBefore: before.cash,
        cashAfter: bought.cash,
        purchased: item.uid,
        unknownPreserved: true,
        refreshRestored: true,
      },
      null,
      2,
    ),
  )
  console.log(
    'Standalone file:// demo: images, actual purchase, unknown quality, save/reload and zero network verified.',
  )
} finally {
  await browser.close()
}
