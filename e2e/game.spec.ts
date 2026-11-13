import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { createGame, type Game } from '../src/game/engine'
const KEY = 'starshop-save-v1'
function seller() {
  const s = createGame(42)
  s.visitor = {
    id: 100,
    kind: 'seller',
    name: '阿岚',
    role: '拾荒者',
    category: '机械',
    budget: 0,
    line: '刚从废弃货舱回来。老板，看看这件能收吗？',
    ask: 45,
    item: {
      uid: 'offer-1',
      productId: 'p0',
      quality: '精良',
      condition: '完好',
      known: false,
      cost: 0,
    },
  }
  return s
}
async function open(page: Page, state: Game | string) {
  await page.addInitScript(
    ({ key, state }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(
          key,
          JSON.stringify({
            data: typeof state === 'string' ? state : JSON.stringify(state),
          }),
        )
    },
    { key: KEY, state },
  )
  await page.goto('/')
}
async function stored(page: Page): Promise<Game> {
  return page.evaluate(
    (key) => JSON.parse(JSON.parse(localStorage.getItem(key)!).data),
    KEY,
  )
}
async function snap(page: Page, name: string) {
  await mkdir('artifacts/screenshots', { recursive: true })
  await page.screenshot({
    path: `artifacts/screenshots/${name}.png`,
    fullPage: true,
  })
}
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
})
test('真实收购、鉴定、刷新恢复和五笔日结', async ({ page }) => {
  const s = seller()
  s.progress = 4
  await open(page, s)
  await expect(page.getByText('磁悬轴承', { exact: true })).toBeVisible()
  await snap(page, '01-counter')
  await page.getByText('查看 ›', { exact: true }).click()
  await snap(page, '02-identification-detail')
  await page.getByText('鉴定商品 · 8 星币', { exact: true }).click()
  await expect(
    page.getByText('机械 / 完好 / 精良', { exact: true }),
  ).toBeVisible()
  expect((await stored(page)).cash).toBe(642)
  await snap(page, '03-identified')
  await page.reload()
  await expect(
    page.getByText('机械 / 完好 / 精良', { exact: true }),
  ).toBeVisible()
  await page.getByText('收购 · 45', { exact: true }).click()
  await expect(page.getByText('接待下一位', { exact: true })).toBeVisible()
  const bought = await stored(page)
  expect(bought.cash).toBe(597)
  expect(bought.day).toBe(2)
  expect(bought.progress).toBe(0)
  expect(bought.inventory).toHaveLength(4)
  await snap(page, '04-trade-day-change')
})
test('仓库展示、清仓确认和升级', async ({ page }) => {
  await open(page, seller())
  await page.getByText('仓库', { exact: true }).click()
  await snap(page, '05-warehouse')
  await page.getByText('磁悬轴承', { exact: true }).click()
  await snap(page, '06-stock-detail')
  await page.getByText('从展示柜撤下', { exact: true }).click()
  expect((await stored(page)).display).not.toContain('i1')
  await page.getByText('磁悬轴承', { exact: true }).click()
  await page.getByText('清仓 · 回款 22', { exact: true }).click()
  await snap(page, '07-clearance-confirm')
  await page.getByText('确认', { exact: true }).click()
  const cleared = await stored(page)
  expect(cleared.cash).toBe(672)
  expect(cleared.trades).toBe(0)
  await page.getByText('升级', { exact: true }).click()
  await snap(page, '08-upgrades')
  await page.getByText('升级 · 180 星币', { exact: true }).click()
  expect((await stored(page)).storage).toBe(1)
})
test('买家成交、欠租账本与帮助', async ({ page }) => {
  const s = seller()
  s.visitor = {
    id: 100,
    kind: 'buyer',
    name: '米洛',
    role: '船员',
    category: '机械',
    budget: 200,
    line: '明天就出港了。店里有没有能派上用场的货？',
  }
  s.debt = 90
  await open(page, s)
  await snap(page, '09-buyer')
  await page.getByText('磁悬轴承', { exact: true }).click()
  await page.getByText('出售 · 63 星币', { exact: true }).click()
  expect((await stored(page)).cash).toBe(713)
  await page.getByText('账本', { exact: true }).click()
  await snap(page, '10-ledger')
  await page.getByText('补缴租金 · 90', { exact: true }).click()
  expect((await stored(page)).debt).toBe(0)
  await page.getByText('店长手册', { exact: true }).click()
  await snap(page, '11-handbook')
})
test('资金不足、满仓、无匹配与坏档有明确处理', async ({ page }) => {
  const s = seller()
  s.cash = 0
  await open(page, s)
  await expect(
    page.getByText('资金不足，先出售或清仓', { exact: true }),
  ).toBeVisible()
  await snap(page, '12-low-cash')
  const full = seller()
  for (let i = 0; i < 5; i++)
    full.inventory.push({ ...full.inventory[0], uid: `full-${i}` })
  await page.evaluate(
    ({ key, s }) =>
      localStorage.setItem(key, JSON.stringify({ data: JSON.stringify(s) })),
    { key: KEY, s: full },
  )
  await page.reload()
  await expect(
    page.getByText('仓库已满，先清理货物', { exact: true }),
  ).toBeVisible()
  await snap(page, '13-full-stock')
  full.visitor = {
    id: 101,
    kind: 'buyer',
    name: '塔玛',
    role: '收藏家',
    category: '数据',
    budget: 500,
    line: '看看有没有合适的记录。',
  }
  await page.evaluate(
    ({ key, s }) =>
      localStorage.setItem(key, JSON.stringify({ data: JSON.stringify(s) })),
    { key: KEY, s: full },
  )
  await page.reload()
  await expect(
    page.getByText('暂时没有合适的货', { exact: true }),
  ).toBeVisible()
  await snap(page, '14-no-match')
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ data: '{broken' })),
    KEY,
  )
  await page.reload()
  await expect(page.getByText('存档需要处理', { exact: true })).toBeVisible()
  await snap(page, '15-save-recovery')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).toContain('{broken')
})
test('存储写失败时不生效、不覆盖已有报价', async ({ page }) => {
  await open(page, seller())
  await expect(page.getByText('收购 · 45', { exact: true })).toBeVisible()
  const before = await stored(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('测试：存储空间不足')
    }
  })
  await page.getByText('收购 · 45', { exact: true }).click()
  await expect(
    page.getByText('测试：存储空间不足', { exact: true }),
  ).toBeVisible()
  expect(await stored(page)).toEqual(before)
  await expect(page.getByText('收购 · 45', { exact: true })).toBeVisible()
})
test('320/375/414/768宽度无横向溢出或页面异常', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page, seller())
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tab of ['柜台', '仓库', '升级', '账本']) {
      await page.getByText(tab, { exact: true }).click()
      const sizes = await page.evaluate(() => ({
        w: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.w + 1)
    }
    await snap(page, `responsive-${width}`)
  }
  expect(errors).toEqual([])
})
