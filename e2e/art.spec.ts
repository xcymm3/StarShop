import { test, expect } from '@playwright/test'
import { createGame, PRODUCTS, type Item } from '../src/game/engine'
import { firstFit } from '../src/game/grid'
import { bounds, located } from '../src/game/engine'
import { mkdir } from 'node:fs/promises'

test('全部原创商品图与四类顾客在格子工作台正常加载', async ({ page }) => {
  const s = createGame(42)
  s.storage = 5
  s.shelves = 2
  s.trades = 40
  s.reputation = 70
  s.sequence = 1000
  s.inventory = []
  for (const p of PRODUCTS) {
    const uid = 'art-' + p.id
    const position = firstFit(
      bounds(s, 'warehouse'),
      p,
      'warehouse',
      uid,
      s.inventory.map(located),
    )!
    s.inventory.push({
      uid,
      productId: p.id,
      quality: '普通',
      claimedQuality: '普通',
      condition: '完好',
      known: true,
      cost: p.base,
      ...position,
    } satisfies Item)
  }
  s.visitor = {
    id: 900,
    kind: 'seller',
    name: '素材检查',
    role: '拾荒者',
    line: '看看今天的来货。',
    category: '机械',
    budget: 0,
    stock: [
      {
        ...s.inventory[0],
        uid: 'art-offer',
        known: false,
        area: 'customer',
        x: 0,
        y: 0,
      },
    ],
    asks: { 'art-offer': 45 },
    remaining: 1,
    minimumQuality: '普通',
    acceptsDamaged: true,
    bargained: false,
    priceFactor: 1,
    tolerance: 0.8,
  }
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
  await page.addInitScript((s) => {
    if (!localStorage.getItem('starshop-save-v3'))
      localStorage.setItem(
        'starshop-save-v3',
        JSON.stringify({ data: JSON.stringify(s) }),
      )
  }, s)
  await page.goto('/')
  await mkdir('artifacts/art-review-v06', { recursive: true })
  async function loaded(selector: string, count: number) {
    const imgs = page.locator(selector)
    await expect(imgs).toHaveCount(count)
    await expect
      .poll(() =>
        imgs.evaluateAll((elements) =>
          elements.every(
            (e) =>
              (e as HTMLImageElement).complete &&
              (e as HTMLImageElement).naturalWidth > 0,
          ),
        ),
      )
      .toBe(true)
  }
  await loaded('.room-sprite img,img.room-sprite', 1)
  await expect(
    page.getByRole('button', { name: '打开账本', exact: true }),
  ).toBeVisible()
  await loaded('[data-area="warehouse"] .grid-item img', 24)
  for (const [n, role] of ['拾荒者', '船员', '商人', '收藏家'].entries()) {
    await page.evaluate((role) => {
      const key = 'starshop-save-v3'
      const s = JSON.parse(JSON.parse(localStorage.getItem(key)!).data)
      s.visitor.role = role
      localStorage.setItem(key, JSON.stringify({ data: JSON.stringify(s) }))
    }, role)
    await page.reload()
    await loaded('.visitor-sprite img,img.visitor-sprite', 1)
    await page.screenshot({
      path: 'artifacts/art-review-v06/visitor-' + n + '.png',
      fullPage: true,
    })
  }
  await page.locator('.grid-item[data-uid="art-offer"]').click()
  await loaded('.identify-tool img,img.identify-tool', 1)
  await page.screenshot({
    path: 'artifacts/art-review-v06/item-inspection.png',
    fullPage: true,
  })
})
