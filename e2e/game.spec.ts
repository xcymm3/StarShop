import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import {
  createGame,
  type Game,
  type Visitor,
  type Action,
} from '../src/game/engine'
import type { observe } from '../src/game/interface'
type Observation = ReturnType<typeof observe>
const KEY = 'starshop-save-v2'
function fixture(): Game {
  const s = createGame(42)
  const a = {
    ...s.inventory[0],
    uid: 'offer-a',
    known: false,
    claimedQuality: '稀有' as const,
    quality: '精良' as const,
    cost: 0,
    area: 'counter' as const,
    x: 0,
    y: 0,
  }
  const b = {
    ...s.inventory[2],
    uid: 'offer-b',
    known: false,
    cost: 0,
    area: 'counter' as const,
    x: 0,
    y: 0,
  }
  s.visitor = {
    id: 100,
    name: '阿岚',
    role: '拾荒者',
    kind: 'seller',
    category: '机械',
    line: '这批货可以挑着收。',
    budget: 0,
    stock: [a, b],
    asks: { 'offer-a': 45, 'offer-b': 20 },
    remaining: 2,
    minimumQuality: '普通',
    acceptsDamaged: true,
    bargained: false,
    priceFactor: 1,
    tolerance: 0.8,
  }
  s.sequence = 110
  return s
}
async function open(page: Page, state: Game | string = fixture()) {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key))
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
  if (typeof state !== 'string')
    await expect
      .poll(() => page.evaluate(() => !!(window as any).starshop))
      .toBe(true)
}
async function stored(page: Page): Promise<Game> {
  return page.evaluate(
    (key) => JSON.parse(JSON.parse(localStorage.getItem(key)!).data),
    KEY,
  )
}
async function snap(page: Page, name: string) {
  await mkdir('artifacts/screenshots-v04', { recursive: true })
  await page.screenshot({
    path: 'artifacts/screenshots-v04/' + name + '.png',
    fullPage: true,
  })
}
async function tablet(page: Page) {
  await page
    .getByRole('button', { name: '交易平板', exact: true })
    .first()
    .click()
}
async function act(page: Page, action: Action, reason = '单步正常玩家操作') {
  return page.evaluate(
    ({ action, reason }) => {
      const api = (window as any).starshop
      return api.act({
        id: crypto.randomUUID(),
        token: api.observe().token,
        reason,
        action,
      })
    },
    { action, reason },
  )
}
async function observation(page: Page): Promise<Observation> {
  return page.evaluate(() => (window as any).starshop.observe())
}
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
})
test('工作台真实暂放、鉴定、收购、格子整理与刷新恢复', async ({ page }) => {
  await open(page)
  await snap(page, '01-workbench')
  await tablet(page)
  await snap(page, '02-trading-tablet')
  await page.getByText('查看商品', { exact: true }).first().click()
  await snap(page, '03-inspection')
  await page.getByText('鉴定 · 8', { exact: true }).click()
  expect((await stored(page)).cash).toBe(642)
  await page.getByText('返回', { exact: true }).click()
  await page.getByRole('button', { name: '选入 offer-a', exact: true }).click()
  expect((await stored(page)).cash).toBe(642)
  await page.reload()
  expect((await stored(page)).staged).toEqual(['offer-a'])
  await expect(page.locator('.shop-stage')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '暂放 磁悬轴承 offer-a', exact: true }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .locator('.shop-stage img')
        .evaluateAll(
          (images) =>
            images.length > 0 &&
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    )
    .toBe(true)
  await snap(page, '17-live-counter-main')
  await tablet(page)
  await snap(page, '04-staged-restored')
  await page.getByText('确认收购', { exact: true }).last().click()
  let s = await stored(page)
  expect(s.cash).toBe(597)
  expect(s.progress).toBe(1)
  expect(s.visitor?.stock).toHaveLength(1)
  const bought = s.inventory.find((i) => i.uid === 'offer-a')!
  expect(bought.area).toBe('counter')
  await snap(page, '05-owned-on-counter')
  await page
    .getByRole('button', { name: '库存 磁悬轴承 offer-a', exact: true })
    .click()
  await page.getByText('整理此物', { exact: true }).click()
  await page
    .locator('.placement-tools')
    .getByText('仓库', { exact: true })
    .click()
  await page.getByText('旋转 0°', { exact: true }).click()
  await page
    .getByRole('button', { name: 'warehouse格子 7,5', exact: true })
    .click()
  await expect(
    page.getByText('位置越界或与其他货物重叠。', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'warehouse格子 0,3', exact: true })
    .click()
  s = await stored(page)
  expect(s.inventory.find((i) => i.uid === 'offer-a')).toMatchObject({
    area: 'warehouse',
    x: 0,
    y: 3,
    rotated: true,
  })
  await page.reload()
  expect(
    (await stored(page)).inventory.find((i) => i.uid === 'offer-a')?.y,
  ).toBe(3)
  await snap(page, '06-grid-placement')
})
test('批量交易计一笔，直接收购仍未知，收购后可鉴定', async ({ page }) => {
  await open(page)
  await tablet(page)
  await page.getByRole('button', { name: '选入 offer-a', exact: true }).click()
  await page.getByRole('button', { name: '选入 offer-b', exact: true }).click()
  await snap(page, '07-batch-offer')
  await page.getByText('确认收购', { exact: true }).last().click()
  let s = await stored(page)
  expect(s.cash).toBe(585)
  expect(s.progress).toBe(1)
  expect(s.inventory).toHaveLength(5)
  expect(s.inventory.find((i) => i.uid === 'offer-a')?.known).toBe(false)
  await page
    .getByRole('button', { name: '库存 磁悬轴承 offer-a', exact: true })
    .click()
  await page.getByText('鉴定 · 8', { exact: true }).click()
  s = await stored(page)
  expect(s.cash).toBe(577)
  expect(s.inventory.find((i) => i.uid === 'offer-a')?.known).toBe(true)
  await snap(page, '08-post-purchase-inspection')
})
test('买家需求、共享预算、选货和一次还价反馈', async ({ page }) => {
  const s = fixture()
  s.inventory.push({
    ...s.inventory[0],
    uid: 'extra',
    area: 'counter',
    x: 0,
    y: 0,
  })
  s.visitor = {
    id: 100,
    name: '米洛',
    role: '船员',
    kind: 'buyer',
    category: '机械',
    line: '预算有限，找点实用的。',
    budget: 120,
    stock: [],
    asks: {},
    remaining: 2,
    minimumQuality: '普通',
    acceptsDamaged: true,
    bargained: false,
    priceFactor: 1,
    tolerance: 0.2,
  } satisfies Visitor
  await open(page, s)
  await tablet(page)
  await page
    .getByRole('button', { name: '选入 ' + s.inventory[0].uid, exact: true })
    .click()
  await page.getByText('还价 +10%', { exact: true }).click()
  await expect(
    page.getByText('还价被拒绝，仍可按原报价成交。', { exact: true }).last(),
  ).toBeVisible()
  await expect(page.getByText('已还价', { exact: true })).toBeDisabled()
  await snap(page, '09-buyer-bargain')
  await page.getByText('确认出售', { exact: true }).last().click()
  const next = await stored(page)
  expect(next.cash).toBe(710)
  expect(next.visitor?.budget).toBe(60)
  expect(next.visitor?.remaining).toBe(1)
})
test('日结租赁账单付款、刷新恢复且不重复收租', async ({ page }) => {
  const s = fixture()
  s.day = 7
  s.progress = 4
  s.dayStats.trades = 4
  await open(page, s)
  await tablet(page)
  await page.getByRole('button', { name: '选入 offer-a', exact: true }).click()
  await page.getByText('确认收购', { exact: true }).last().click()
  await expect(
    page.getByText('第 7 日 · 营业结算', { exact: true }),
  ).toBeVisible()
  await snap(page, '10-day-seven-rent')
  await page.reload()
  await expect(
    page.getByText('第 7 日 · 营业结算', { exact: true }),
  ).toBeVisible()
  await page.getByText('支付房租 · 120', { exact: true }).click()
  expect((await stored(page)).cash).toBe(485)
  expect((await stored(page)).bills[0].paid).toBe(120)
  await snap(page, '11-rent-paid')
  await page.getByText('继续营业 · 第8天', { exact: true }).click()
  await page.reload()
  const next = await stored(page)
  expect(next.day).toBe(8)
  expect(next.cash).toBe(485)
  expect(next.report).toBe(null)
})
test('零钱空仓可完成理货恢复；存储失败不显示虚假成交', async ({ page }) => {
  const s = fixture()
  s.cash = 0
  s.inventory = []
  await open(page, s)
  await page.getByText('承接应急理货 · 报酬20', { exact: true }).click()
  await page.getByText('机械', { exact: true }).click()
  await expect(
    page.getByText('分类不符，核对公开货签再试。', { exact: true }),
  ).toBeVisible()
  await page.getByText('补给', { exact: true }).click()
  expect((await stored(page)).cash).toBe(20)
  await snap(page, '12-recovery-job')
  await act(page, { type: 'stage', uid: 'offer-b' })
  const before = await stored(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('测试：存储空间不足')
    }
  })
  await page.getByText('确认收购', { exact: true }).first().click()
  await expect(
    page.getByText('测试：存储空间不足', { exact: true }),
  ).toBeVisible()
  expect(await stored(page)).toEqual(before)
})
test('坏档保留，旧版存档备份后迁移到真实格子', async ({ page }) => {
  await open(page, '{broken')
  await expect(
    page.getByText('STARSHOP · 存档恢复', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
  ).toContain('{broken')
  const old = {
    version: 1,
    cash: 650,
    day: 1,
    progress: 0,
    trades: 0,
    storage: 0,
    shelves: 0,
    debt: 0,
    seed: 42,
    sequence: 10,
    inventory: [
      {
        uid: 'old-item',
        productId: 'p0',
        quality: '普通',
        condition: '完好',
        known: true,
        cost: 28,
      },
    ],
    display: ['old-item'],
    visitor: null,
    entries: [],
  }
  await page.evaluate(
    ({ old, key }) => {
      localStorage.removeItem(key)
      localStorage.setItem(
        'starshop-save-v1',
        JSON.stringify({ data: JSON.stringify(old) }),
      )
    },
    { old, key: KEY },
  )
  // The init script only seeds absent data; navigate a new page without its injected fixture.
  await page.context().clearCookies()
  await page.evaluate((key) => localStorage.removeItem(key), KEY)
  // Use a new page in the same context, so only the app's migration runs.
  const clean = await page.context().newPage()
  await clean.goto('/')
  await expect
    .poll(() => clean.evaluate(() => !!(window as any).starshop))
    .toBe(true)
  expect((await stored(clean)).inventory[0].area).toBe('showcase')
  expect(
    await clean.evaluate(() => localStorage.getItem('starshop-save-v1-backup')),
  ).toContain('old-item')
  await clean.close()
})
test('320/375/414/768工作台、平板和工具面板无横向溢出', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 })
    const scene = await page.locator('.shop-stage').boundingBox()
    expect(scene!.width).toBeCloseTo(Math.min(width, 480), 0)
    expect(scene!.height / scene!.width).toBeCloseTo(1846 / 852, 2)
    await expect(page.locator('.shop-stage [data-area]')).toHaveCount(3)

    const check = async () => {
      const size = await page.evaluate(() => ({
        w: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      expect(size.scroll).toBeLessThanOrEqual(size.w + 1)
      const buttons = page.locator('.sheet .game-button:visible')
      for (let i = 0; i < (await buttons.count()); i++) {
        const b = buttons.nth(i)
        expect(
          await b.evaluate((e) => e.scrollWidth <= e.clientWidth + 2),
        ).toBe(true)
      }
    }
    await check()
    await snap(page, 'workbench-' + width)
    await tablet(page)
    await check()
    await snap(page, 'trade-' + width)
    await page
      .getByRole('button', { name: '关闭工具面板', exact: true })
      .click()
    for (const name of ['打开账本', '打开升级', '打开手册']) {
      await page.getByRole('button', { name, exact: true }).click()
      await check()
      if (width === 375) await snap(page, name)
      await page
        .getByRole('button', { name: '关闭工具面板', exact: true })
        .click()
    }
  }
  expect(errors).toEqual([])
})
test('浏览器从新局通过同一单步接口完成第七日房租', async ({ page }) => {
  test.setTimeout(180000)
  await open(page, createGame(77))
  for (let step = 0; step < 2500; step++) {
    const o = await observation(page)
    if (o.day === 8) {
      expect(o.trades).toBe(35)
      expect(o.bills[0].paid).toBe(120)
      await snap(page, '13-normal-week-complete')
      return
    }
    if (o.report) {
      if (o.debt) {
        await snap(page, '14-normal-week-rent-before')
        await act(page, { type: 'payRent' }, '核对第七日账单后正常交租')
        await snap(page, '15-normal-week-rent-after')
      } else await act(page, { type: 'ackDay' }, '确认五笔日结，进入次日')
      continue
    }
    const v = o.visitor
    if (!v) {
      await act(page, { type: 'next' })
      continue
    }
    if (v.kind === 'buyer') {
      const i = o.inventory
        .filter(
          (i) =>
            i.buyerOffer! > 0 &&
            i.buyerOffer! <= v.budget &&
            i.buyerOffer! >= i.cost!,
        )
        .sort((a, b) => b.buyerOffer! - a.buyerOffer!)[0]
      if (i && v.remaining > 0) {
        await act(page, { type: 'stage', uid: i.uid })
        await act(page, { type: 'sell', visitorId: v.id })
        continue
      }
    } else {
      const i = v.stock.find(
        (i) =>
          i.sellerAsk! <= i.estimate[0] * 0.85 &&
          i.sellerAsk! <= o.cash - 150 &&
          o.actions.some(
            (a) =>
              a.action.type === 'stage' &&
              'uid' in a.action &&
              a.action.uid === i.uid &&
              a.enabled,
          ),
      )
      if (i) {
        await act(page, { type: 'stage', uid: i.uid })
        await act(page, { type: 'buy', visitorId: v.id })
        const after = await observation(page)
        const move = after.actions.find(
          (a) =>
            a.action.type === 'autoPlace' &&
            a.action.uid === i.uid &&
            a.action.area === 'warehouse' &&
            a.enabled,
        )
        if (move) await act(page, move.action)
        continue
      }
    }
    await act(page, { type: 'dismiss', visitorId: v.id })
  }
  throw new Error('未完成正常一周')
})

test('柜台透视格子可点击，扩仓末行可在店内滚动后操作', async ({ page }) => {
  const s = fixture()
  s.storage = 5
  s.inventory[0].y = 19
  await open(page, s)
  await act(page, { type: 'stage', uid: 'offer-a' })
  await act(page, { type: 'buy', visitorId: 100 })
  await page
    .getByRole('button', { name: '库存 磁悬轴承 offer-a', exact: true })
    .click()
  await page.getByText('整理此物', { exact: true }).click()
  await page
    .getByRole('button', { name: 'counter格子 5,0', exact: true })
    .click()
  expect(
    (await stored(page)).inventory.find((i) => i.uid === 'offer-a'),
  ).toMatchObject({ area: 'counter', x: 5, y: 0 })
  const warehouseItem = page.getByRole('button', {
    name: '库存 磁悬轴承 ' + s.inventory[0].uid,
    exact: true,
  })
  await warehouseItem.scrollIntoViewIfNeeded()
  const frame = await page.locator('.warehouse-scroll').boundingBox()
  const target = await warehouseItem.boundingBox()
  expect(target!.y + target!.height / 2).toBeGreaterThan(frame!.y)
  expect(target!.y + target!.height / 2).toBeLessThan(frame!.y + frame!.height)
  await warehouseItem.click()
  await expect(page.getByText('商品检视', { exact: true })).toBeVisible()
  await snap(page, '16-expanded-warehouse-interaction')
})
