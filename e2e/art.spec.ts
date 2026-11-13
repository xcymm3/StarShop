import { test, expect } from '@playwright/test'
import { createGame, PRODUCTS } from '../src/game/engine'
import { mkdir } from 'node:fs/promises'

test('全部商品图、四类顾客与场景分层在游戏内可加载', async ({ page }) => {
  const state = createGame(42)
  state.trades = 40
  state.storage = 5
  state.shelves = 5
  state.sequence = 1000
  state.inventory = PRODUCTS.map((p, index) => ({
    uid: `art-${index}`,
    productId: p.id,
    quality: '普通' as const,
    condition: '完好' as const,
    known: true,
    cost: p.base,
  }))
  state.display = state.inventory.slice(0, 7).map((i) => i.uid)
  const visitor = {
    id: 900,
    kind: 'seller' as const,
    name: '素材验证',
    role: '拾荒者',
    line: '看看今天的来货。',
    category: '机械' as const,
    budget: 0,
    ask: 45,
    item: { ...state.inventory[0], uid: 'art-offer', known: false },
  }
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
  await page.addInitScript(
    (s) => {
      const key = 'starshop-save-v1'
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify({ data: JSON.stringify(s) }))
    },
    { ...state, visitor },
  )
  await page.goto('/')
  await mkdir('artifacts/art-review', { recursive: true })
  async function loaded(selector: string, count: number) {
    const imgs = page.locator(selector)
    await expect(imgs).toHaveCount(count)
    await expect
      .poll(() =>
        imgs.evaluateAll((elements) =>
          elements.every((element) => {
            const im = element as HTMLImageElement
            return im.complete && im.naturalWidth > 0
          }),
        ),
      )
      .toBe(true)
  }
  await loaded('.room-sprite img, img.room-sprite', 1)
  await loaded('.scene-terminal img, img.scene-terminal', 1)
  for (const [index, role] of ['拾荒者', '船员', '商人', '收藏家'].entries()) {
    await page.evaluate((role) => {
      const s = JSON.parse(
        JSON.parse(localStorage.getItem('starshop-save-v1')!).data,
      )
      s.visitor.role = role
      localStorage.setItem(
        'starshop-save-v1',
        JSON.stringify({ data: JSON.stringify(s) }),
      )
    }, role)
    await page.reload()
    await loaded('.visitor-sprite img, img.visitor-sprite', 1)
    await page.screenshot({
      path: `artifacts/art-review/visitor-${index}.png`,
      fullPage: true,
    })
  }
  await page.getByText('查看 ›', { exact: true }).click()
  await loaded('.identify-tool img, img.identify-tool', 1)
  await page.getByText('关闭', { exact: true }).click()
  await page.getByText('仓库', { exact: true }).click()
  await loaded('.inventory-card img', 24)
  await page.screenshot({
    path: 'artifacts/art-review/all-items.png',
    fullPage: true,
  })
})
