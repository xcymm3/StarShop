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
const KEY = 'starshop-save-v3'
function fixture(): Game {
  const s = createGame(42)
  const a = {
    ...s.inventory[0],
    uid: 'offer-a',
    known: false,
    claimedQuality: '稀有' as const,
    quality: '精良' as const,
    cost: 0,
    area: 'customer' as const,
    x: 0,
    y: 0,
  }
  const b = {
    ...s.inventory[2],
    uid: 'offer-b',
    known: false,
    cost: 0,
    area: 'customer' as const,
    x: 3,
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
    wholesaleDiscount: 20,
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
  await mkdir('artifacts/screenshots-v06', { recursive: true })
  await page.screenshot({
    path: 'artifacts/screenshots-v06/' + name + '.png',
    fullPage: true,
  })
}
async function tablet(page: Page) {
  await page
    .getByRole('button', { name: '交易平板', exact: true })
    .first()
    .click()
  await page.locator('.trading-backdrop .sheet').evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
  })
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

test('手机短屏可滚到完整仓库与保存状态，主要按钮达到44像素', async ({
  page,
}) => {
  await open(page)
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [375, 812],
    [414, 736],
    [768, 900],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => window.scrollTo(0, 0))
    const sizes = await page
      .locator('.console-key,.collect-key,.warehouse-zoom,.intercom-key')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { w: r.width, h: r.height }
        }),
      )
    for (const size of sizes) {
      expect(size.w).toBeGreaterThanOrEqual(43.9)
      expect(size.h).toBeGreaterThanOrEqual(43.9)
    }
    await page.locator('.save-note').scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
    const r = await page.locator('.warehouse-meter').boundingBox()
    expect(r!.y).toBeGreaterThanOrEqual(0)
    expect(r!.y + r!.height).toBeLessThanOrEqual(height)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    await page.screenshot({
      path: 'artifacts/mobile-fixed-' + width + '-' + height + '.png',
    })
  }
})

test('预算不足和全部拒收时保留预算、逐件明细及固定确认栏', async ({ page }) => {
  const s = fixture()
  s.visitor = {
    ...s.visitor!,
    kind: 'buyer',
    stock: [],
    asks: {},
    category: '机械',
    budget: 1,
    remaining: 3,
  }
  await open(page, s)
  await act(page, { type: 'stage', uid: s.inventory[0].uid })
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [414, 736],
    [768, 900],
  ]) {
    await page.setViewportSize({ width, height })
    await tablet(page)
    await expect(page.locator('.budget-pinned')).toContainText(
      '剩余预算 1 星币',
    )
    expect(
      await page.locator('.trade-scroll').evaluate((el) => el.clientHeight),
    ).toBeGreaterThanOrEqual(100)
    await expect(page.locator('.offer-row').first()).toBeInViewport()
    await expect(
      page.getByRole('button', { name: '确认出售', exact: true }),
    ).toHaveCount(1)
    await expect(
      page.getByRole('button', { name: '确认出售', exact: true }),
    ).toBeDisabled()
    const footer = await page.locator('.trade-footer').boundingBox()
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(height)
    await page.screenshot({ path: 'artifacts/budget-fixed-' + width + '.png' })
    await page.getByRole('button', { name: '关闭工具面板' }).click()
  }
  await act(page, { type: 'unstage', uid: s.inventory[0].uid })
  await act(page, { type: 'stage', uid: s.inventory[1].uid })
  await tablet(page)
  await expect(page.locator('.offer-row.refused')).toContainText(
    '不符合求购类别',
  )
})

test('来货报价与批发不再隐藏，确认前不扣钱、确认后就地反馈', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await open(page)
  await tablet(page)
  await expect(
    page.getByRole('button', { name: '整批收购', exact: true }),
  ).toBeInViewport()
  await page.getByRole('button', { name: '挑选 offer-a' }).click()
  expect((await stored(page)).cash).toBe(650)
  await expect(page.locator('.offer-row')).toContainText('45星币')
  await expect(
    page.getByRole('button', { name: '确认收购', exact: true }),
  ).toHaveCount(1)
  await page.getByRole('button', { name: '确认收购', exact: true }).tap()
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await expect(page.locator('.receipt-toast')).toContainText('已收购 1 件')
  await page.reload()
  await expect(page.locator('.save-note')).toContainText('已恢复存档')
  expect((await stored(page)).cash).toBe(605)
})

test('放大格子44像素、清晰列表筛选、方向一致、旋转图像与手动落位', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: '放大仓库' }).click()
  const cell = page.locator('.zoom-grid .grid-cell').first()
  const r = await cell.boundingBox()
  expect(r!.width).toBeCloseTo(44, 0)
  expect(r!.height).toBeCloseTo(44, 0)
  await page.getByRole('button', { name: '商品清单', exact: true }).click()
  await page.getByRole('button', { name: '已鉴定', exact: true }).click()
  await expect(page.locator('.inventory-list-row')).toHaveCount(2)
  await page.getByRole('button', { name: '检视 ' + safestamp() }).click()
  await page.getByRole('button', { name: '整理此物', exact: true }).click()
  await page.getByRole('button', { name: '旋转', exact: true }).click()
  await page.getByRole('button', { name: '找空位', exact: true }).click()
  const item = (await stored(page)).inventory.find(
    (i) => i.uid === safestamp(),
  )!
  expect(item.rotated).toBe(true)
  const transform = await page
    .locator('.zoom-grid [data-uid="' + safestamp() + '"] .grid-art')
    .evaluate((el) => getComputedStyle(el).transform)
  expect(transform).not.toBe('none')
})
function safestamp() {
  return fixture().inventory[2].uid
}

test('小屏还价反馈固定可见，成功、拒绝、离开都不发生隐式付款', async ({
  browser,
}) => {
  for (const [tolerance, label] of [
    [0.8, '已降价10%'],
    [0.2, '还价被拒'],
    [0.01, '离开'],
  ] as const) {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:10086',
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true,
    })
    try {
      const page = await context.newPage(),
        s = fixture()
      s.visitor!.tolerance = tolerance
      await open(page, s)
      await page.getByRole('button', { name: '交易平板', exact: true }).tap()
      await page
        .getByRole('button', { name: '挑选 offer-a', exact: true })
        .tap()
      await page.getByRole('button', { name: '还价 −10%', exact: true }).tap()
      if (tolerance < 0.08)
        await expect(page.locator('.empty-trade')).toContainText('离开')
      else {
        await expect(page.locator('.bargain-feedback')).toContainText(label)
        await expect(page.locator('.bargain-feedback')).toBeInViewport({
          ratio: 1,
        })
        await expect(page.locator('.offer-row').first()).toBeInViewport({
          ratio: 1,
        })
      }
      expect((await stored(page)).cash).toBe(650)
      expect((await stored(page)).trades).toBe(0)
      await mkdir('artifacts/screenshots-v06', { recursive: true })
      await page.screenshot({
        path: 'artifacts/screenshots-v06/bargain-' + tolerance + '-320.png',
      })
    } finally {
      await context.close()
    }
  }
})

test('四种手机宽度连续轻触只付款一次，关闭报价不穿透到仓库或货物', async ({
  browser,
}) => {
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [414, 736],
    [768, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    })
    try {
      const page = await context.newPage()
      await open(page)
      await page.getByRole('button', { name: '交易平板', exact: true }).tap()
      await page
        .getByRole('button', { name: '挑选 offer-a', exact: true })
        .tap()
      expect((await stored(page)).cash).toBe(650)
      await page.getByRole('button', { name: '确认收购', exact: true }).tap()
      await expect(page.locator('.modal-backdrop')).toHaveCount(0)
      await page.getByRole('button', { name: '收回柜台自有货物' }).tap()
      const s = await stored(page)
      expect(s.cash).toBe(605)
      expect(s.progress).toBe(1)
      expect(s.inventory.find((i) => i.uid === 'offer-a')?.area).toBe(
        'warehouse',
      )
      await page.locator('[data-uid="offer-a"]').tap()
      await expect(page.getByText('商品检视', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: '返回', exact: true }).tap()
      await expect(page.locator('.modal-backdrop')).toHaveCount(0)
    } finally {
      await context.close()
    }
  }
})

test('送客与关闭不混淆，未付款来货送走前需要确认', async ({ page }) => {
  await open(page)
  await tablet(page)
  await page.getByRole('button', { name: '关闭工具面板' }).click()
  expect((await stored(page)).visitor?.id).toBe(100)
  await page.getByRole('button', { name: '送客', exact: true }).click()
  await expect(page.locator('.confirmation')).toContainText(
    '未付款来货将被带走',
  )
  await page
    .locator('.confirmation')
    .getByRole('button', { name: '取消', exact: true })
    .click()
  expect((await stored(page)).visitor?.id).toBe(100)
  await page.getByRole('button', { name: '送客', exact: true }).click()
  await page
    .locator('.confirmation')
    .getByRole('button', { name: '确认', exact: true })
    .click()
  expect((await stored(page)).visitor).toBeNull()
})

test('买够、首周完成、已付清账本和微信触屏优先说明都有明确状态', async ({
  page,
}) => {
  const s = createGame()
  s.day = 8
  s.trades = 35
  s.bills = [{ day: 7, amount: 120, paid: 120, deferred: false }]
  s.visitor = {
    ...s.visitor!,
    kind: 'buyer',
    stock: [],
    asks: {},
    remaining: 0,
  }
  await open(page, s)
  await expect(page.locator('.visitor-direction')).toHaveText(
    '已买够 · 可以送客',
  )
  await expect(page.locator('.week-goal')).toContainText('首周目标已达成')
  await page.getByRole('button', { name: '打开账本' }).click()
  await expect(page.getByRole('button', { name: '支付房租 · 0' })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: '关闭工具面板' }).click()
  await page.getByRole('button', { name: '打开手册' }).click()
  await expect(page.locator('.help-copy')).toContainText('① 收货')
  await expect(page.locator('.help-copy')).toContainText('格子小时用“放大整理”')
})
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  )
})
// Real pointer events inside headless Chromium; no OS desktop input.
async function drag(
  page: Page,
  uid: string,
  area: string,
  x: number,
  y: number,
  rotate = false,
) {
  await page.locator('.counter-console').scrollIntoViewIfNeeded()
  await page
    .locator('.grid-item[data-uid="' + uid + '"]')
    .scrollIntoViewIfNeeded()
  const source = await page
    .locator('.grid-item[data-uid="' + uid + '"]')
    .boundingBox()
  const cell = await page
    .getByRole('button', { name: area + '格子 ' + x + ',' + y, exact: true })
    .boundingBox()
  expect(source).not.toBeNull()
  expect(cell).not.toBeNull()
  await page.mouse.move(source!.x + 5, source!.y + 5)
  await page.mouse.down()
  await page.mouse.move(cell!.x + cell!.width / 2, cell!.y + cell!.height / 2, {
    steps: 12,
  })
  if (rotate) await page.keyboard.press('r')
  await page.mouse.up()
  await page.waitForTimeout(460)
}

test('实物来货拖动、撤回、非法投放、刷新与单件付款', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await open(page)
  await snap(page, '01-customer-stock')
  await drag(page, 'offer-a', 'counter', 0, 0)
  let s = await stored(page)
  expect(s.cash).toBe(650)
  expect(s.staged).toEqual(['offer-a'])
  expect(s.inventory.some((i) => i.uid === 'offer-a')).toBe(false)
  await tablet(page)
  await snap(page, '02-staged-quote')
  await page.getByRole('button', { name: '关闭工具面板' }).click()
  await drag(page, 'offer-a', 'warehouse', 0, 3)
  expect((await stored(page)).cash).toBe(650)
  expect((await stored(page)).stagePositions['offer-a'].area).toBe('counter')
  await drag(page, 'offer-a', 'customer', 0, 0)
  expect((await stored(page)).staged).toEqual([])
  await drag(page, 'offer-a', 'counter', 0, 0)
  await page.reload()
  await expect(page.locator('.grid-item[data-uid="offer-a"]')).toBeVisible()
  expect((await stored(page)).staged).toEqual(['offer-a'])
  await tablet(page)
  await page.getByText('确认收购', { exact: true }).last().click()
  s = await stored(page)
  expect(s.cash).toBe(605)
  expect(s.progress).toBe(1)
  expect(s.inventory.find((i) => i.uid === 'offer-a')).toMatchObject({
    area: 'counter',
    known: false,
  })
  await drag(page, 'offer-a', 'warehouse', 0, 3, true)
  expect(
    (await stored(page)).inventory.find((i) => i.uid === 'offer-a'),
  ).toMatchObject({ area: 'warehouse', x: 0, y: 3, rotated: true })
  await snap(page, '03-purchased-and-stored')
  expect(errors).toEqual([])
})

test('仓库、展示柜、柜台双向拖动，非法落点和取消保持原位', async ({ page }) => {
  await open(page)
  const uid = fixture().inventory[0].uid
  await drag(page, uid, 'counter', 0, 0)
  expect((await stored(page)).inventory[0].area).toBe('counter')
  await drag(page, uid, 'showcase', 2, 0)
  expect((await stored(page)).inventory[0].area).toBe('showcase')
  await drag(page, uid, 'warehouse', 0, 3)
  const before = await stored(page)
  await drag(page, uid, 'warehouse', 7, 5)
  expect(await stored(page)).toEqual(before)
  const b = await page
    .locator('.grid-item[data-uid="' + uid + '"]')
    .boundingBox()
  await page.mouse.move(b!.x + 5, b!.y + 5)
  await page.mouse.down()
  await page.mouse.move(210, 440, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await stored(page)).toEqual(before)
  expect(before.cash).toBe(650)
  await page.reload()
  expect((await stored(page)).inventory[0]).toMatchObject({
    area: 'warehouse',
    x: 0,
    y: 3,
  })
})

test('独立整批报价付款一次，收回按钮不再扣钱', async ({ page }) => {
  await open(page)
  await drag(page, 'offer-b', 'counter', 0, 0)
  expect((await stored(page)).cash).toBe(650)
  await tablet(page)
  await page.getByRole('button', { name: '挑选货物', exact: true }).click()
  await page.getByRole('button', { name: '整批收购', exact: true }).click()
  await page.locator('.confirmation').getByText('确认', { exact: true }).click()
  let s = await stored(page)
  expect(s.cash).toBe(598)
  expect(s.progress).toBe(1)
  expect(s.visitor?.stock).toHaveLength(0)
  expect(s.inventory.filter((i) => i.area === 'counter')).toHaveLength(2)
  await snap(page, '04-wholesale-on-counter')
  await page
    .getByRole('button', { name: '收回柜台自有货物', exact: true })
    .click()
  s = await stored(page)
  expect(s.cash).toBe(598)
  expect(s.inventory.filter((i) => i.area === 'counter')).toHaveLength(0)
})

test('出售按台面报价，拒收货留台，未付款拖回即撤销报价', async ({ page }) => {
  const s = fixture()
  s.visitor = {
    ...s.visitor!,
    kind: 'buyer',
    role: '船员',
    category: '机械',
    stock: [],
    asks: {},
    budget: 500,
    remaining: 3,
    variety: true,
  }
  s.inventory.push({
    ...s.inventory[0],
    uid: 'duplicate',
    area: 'warehouse',
    x: 0,
    y: 3,
  })
  await open(page, s)
  await drag(page, s.inventory[0].uid, 'counter', 0, 0)
  await drag(page, 'duplicate', 'counter', 2, 0)
  await drag(page, s.inventory[2].uid, 'counter', 4, 0)
  await tablet(page)
  await expect(
    page.getByText('同种商品只买一件', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('不符合求购类别', { exact: true })).toBeVisible()
  await snap(page, '05-buyer-rejected-rows')
  const offer = (await observation(page)).selectedTotal
  await page.getByText('确认出售', { exact: true }).last().click()
  let sold = await stored(page)
  expect(sold.cash).toBe(650 + offer)
  expect(sold.visitor?.remaining).toBe(2)
  expect(sold.inventory.filter((i) => i.area === 'counter')).toHaveLength(2)
  await drag(page, 'duplicate', 'warehouse', 0, 3)
  sold = await stored(page)
  expect(sold.inventory.find((i) => i.uid === 'duplicate')?.area).toBe(
    'warehouse',
  )
})

test('第五笔日结与交租仍保留原简化且不会重复收费', async ({ page }) => {
  const s = fixture()
  s.day = 7
  s.progress = 4
  s.dayStats.trades = 4
  await open(page, s)
  await drag(page, 'offer-a', 'counter', 0, 0)
  await tablet(page)
  await page.getByText('确认收购', { exact: true }).last().click()
  await page.reload()
  await expect(
    page.getByText('第 7 日 · 营业结算', { exact: true }),
  ).toBeVisible()
  await page.getByText('支付房租 · 120', { exact: true }).click()
  expect((await stored(page)).cash).toBe(485)
  await snap(page, '06-rent-paid')
  await page.getByText('继续营业 · 第8天', { exact: true }).click()
  expect((await stored(page)).day).toBe(8)
  expect(
    (await stored(page)).inventory.find((i) => i.uid === 'offer-a')?.area,
  ).toBe('counter')
})

test('拖动写入失败不改变已发布状态，坏档不覆盖', async ({ page }) => {
  await open(page)
  const before = await stored(page)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('测试：存储空间不足')
    }
  })
  await drag(page, 'offer-a', 'counter', 0, 0)
  expect(await stored(page)).toEqual(before)
  await expect(
    page.getByText('保存失败，本次操作未提交。请检查存储空间后重试。', {
      exact: true,
    }),
  ).toBeVisible()
})

test('320/375/414/768竖屏布局无横向溢出，报价单关闭后可继续搬货', async ({
  page,
}) => {
  await open(page)
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 })
    await tablet(page)
    const size = await page.evaluate(() => ({
      w: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(size.scroll).toBeLessThanOrEqual(size.w + 1)
    await page
      .getByRole('button', { name: '关闭工具面板', exact: true })
      .click()
    await snap(page, 'layout-' + width)
  }
})

test('首位卖家在矮窗口打开完整报价单，付款按钮不随内容滚走', async ({
  page,
}) => {
  await page.setViewportSize({ width: 592, height: 590 })
  await open(page, createGame())
  const first = (await observation(page)).visitor!
  expect(first.kind).toBe('seller')
  const uid = first.stock[0].uid
  await drag(page, uid, 'counter', 0, 0)
  await tablet(page)
  await page.evaluate(() => window.scrollTo(0, 200))
  const bodyHeight = await page
    .locator('.trade-scroll')
    .evaluate((el) => el.clientHeight)
  expect(bodyHeight).toBeGreaterThanOrEqual(100)
  await expect(page.locator('.budget-pinned')).toBeVisible()
  const confirm = page
    .locator('.trade-footer')
    .getByText('确认收购', { exact: true })
  const before = await confirm.boundingBox()
  await page.locator('.trade-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const after = await confirm.boundingBox()
  expect(after!.y).toBeCloseTo(before!.y, 0)
  expect(after!.y).toBeGreaterThanOrEqual(0)
  expect(after!.y + after!.height).toBeLessThanOrEqual(590)
  await page.screenshot({ path: 'artifacts/customer-trade-fixed.png' })
  await confirm.click()
  expect((await stored(page)).cash).toBe(650 - first.stock[0].sellerAsk!)
  await expect(
    page.getByText('这批货已收完，可送客', { exact: true }),
  ).toBeVisible()
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
    const carry = o.inventory.find(
      (i) =>
        i.area === 'counter' &&
        o.actions.some(
          (a) =>
            a.enabled &&
            a.action.type === 'autoPlace' &&
            a.action.uid === i.uid &&
            a.action.area === 'warehouse',
        ),
    )
    if (carry) {
      await act(page, { type: 'autoPlace', uid: carry.uid, area: 'warehouse' })
      continue
    }
    const v = o.visitor
    if (!v) {
      const displayed = o.inventory.find(
        (i) =>
          i.area !== 'showcase' &&
          o.actions.some(
            (a) =>
              a.enabled &&
              a.action.type === 'autoPlace' &&
              a.action.uid === i.uid &&
              a.action.area === 'showcase',
          ),
      )
      if (
        displayed &&
        o.inventory.filter((i) => i.area === 'showcase').length < 3
      ) {
        await act(page, {
          type: 'autoPlace',
          uid: displayed.uid,
          area: 'showcase',
        })
        continue
      }

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
    .locator('.zoom-grid')
    .getByRole('button', { name: 'counter格子 5,0', exact: true })
    .click()
  expect(
    (await stored(page)).inventory.find((i) => i.uid === 'offer-a'),
  ).toMatchObject({ area: 'counter', x: 5, y: 0 })
  await page.getByRole('button', { name: '关闭工具面板' }).click()
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

test('H5触摸拖动使用相同规则且不会产生点开详情的误触', async ({ page }) => {
  await open(page)
  const source = await page
    .locator('.grid-item[data-uid="offer-a"]')
    .boundingBox()
  const target = await page
    .getByRole('button', { name: 'counter格子 0,0', exact: true })
    .boundingBox()
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  })
  const start = { x: source!.x + 4, y: source!.y + 4 }
  const end = {
    x: target!.x + target!.width / 2,
    y: target!.y + target!.height / 2,
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [start],
  })
  for (let n = 1; n <= 10; n++)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: start.x + ((end.x - start.x) * n) / 10,
          y: start.y + ((end.y - start.y) * n) / 10,
        },
      ],
    })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await expect
    .poll(async () => (await stored(page)).staged)
    .toEqual(['offer-a'])
  expect((await stored(page)).cash).toBe(650)
  await expect(page.getByText('商品检视', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '交易平板', exact: true }).tap()
  await expect(page.locator('.trade-footer')).toContainText('确认收购')
})

test('旧v2未付款存档先备份后迁移，坏档保留', async ({ page }) => {
  const old = JSON.parse(JSON.stringify(fixture()))
  old.version = 2
  old.staged = ['offer-a']
  old.stagePositions = {
    'offer-a': { area: 'counter', x: 0, y: 0, rotated: false },
  }
  for (const i of old.visitor.stock) i.area = 'counter'
  await page.addInitScript((old) => {
    if (!localStorage.getItem('starshop-save-v2'))
      localStorage.setItem(
        'starshop-save-v2',
        JSON.stringify({ data: JSON.stringify(old) }),
      )
  }, old)
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => !!(window as any).starshop))
    .toBe(true)
  expect((await stored(page)).staged).toEqual(['offer-a'])
  expect((await stored(page)).cash).toBe(650)
  expect(
    await page.evaluate(() => localStorage.getItem('starshop-save-v2-backup')),
  ).toContain('offer-a')
  await page.evaluate(() =>
    localStorage.setItem(
      'starshop-save-v3',
      JSON.stringify({ data: '{broken' }),
    ),
  )
  await page.reload()
  await expect(
    page.getByText('STARSHOP · 存档恢复', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('starshop-save-v3')),
  ).toContain('{broken')
})
