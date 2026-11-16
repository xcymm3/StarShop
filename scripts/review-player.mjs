// Interactive review instrument: explicit UI gestures supplied by the reviewer.
// No trading strategy, game-state editing, seed overrides or automatic progression.
import { chromium } from '@playwright/test'
import http from 'node:http'
import { readFile, mkdir, writeFile, appendFile, stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'

const root = path.resolve(
  process.env.STARSHOP_REVIEW_DIR || 'artifacts/mobile-review-v05',
)
await mkdir(root, { recursive: true })
if (await stat(path.join(root, 'actions.jsonl')).catch(() => null)) {
  throw new Error(
    '评审目录已有记录，请设置 STARSHOP_REVIEW_DIR 为新目录，避免覆盖证据',
  )
}
const html = await readFile('release/StarShop-demo.html')
let stopRequested = false
let finish
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/review-control') {
    try {
      let body = ''
      for await (const part of req) body += part
      const result = await runCommands(JSON.parse(body))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
      if (stopRequested) setImmediate(() => finish?.())
    } catch (e) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(
    process.env.STARSHOP_REVIEW_LIVE === '1'
      ? await readFile('release/StarShop-demo.html')
      : html,
  )
})
await new Promise((resolve) =>
  server.listen(
    Number(process.env.STARSHOP_REVIEW_PORT || 0),
    '127.0.0.1',
    resolve,
  ),
)
const base = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--mute-audio',
  ],
})
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
  storageState: process.env.STARSHOP_REVIEW_STATE || undefined,
})
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.route('**/*', (route) =>
  new URL(route.request().url()).origin === base
    ? route.continue()
    : route.abort(),
)
await page.goto(base)
await page.waitForFunction(() => !!window.starshop)
let serial = 0

async function observe() {
  const o = await page.evaluate(() => window.starshop.observe())
  return {
    day: o.day,
    progress: o.progress,
    cash: o.cash,
    trades: o.trades,
    debt: o.debt,
    notice: o.notice,
    hot: o.hot,
    displayCategory: o.displayCategory,
    level: o.level,
    report: o.report,
    bills: o.bills,
    inventory: o.inventory.map((i) => ({
      uid: i.uid,
      name: i.name,
      cat: i.category,
      area: i.area,
      x: i.x,
      y: i.y,
      w: i.width,
      h: i.height,
      rotated: i.rotated,
      known: i.known,
      condition: i.condition,
      cost: i.cost,
      offer: i.buyerOffer,
      estimate: i.estimate,
    })),
    visitor: o.visitor && {
      ...o.visitor,
      stock: o.visitor.stock.map((i) => ({
        uid: i.uid,
        name: i.name,
        cat: i.category,
        area: i.area,
        x: i.x,
        y: i.y,
        w: i.width,
        h: i.height,
        condition: i.condition,
        claim: i.claim,
        known: i.known,
        estimate: i.estimate,
        ask: i.sellerAsk,
      })),
    },
    quote: o.tradeRows,
    total: o.selectedTotal,
    wholesale: o.wholesalePrice,
    visible: await page
      .locator(
        '.sheet-heading,.trade-footer,.inline-error,.error,.placement-tools,.day-report',
      )
      .allTextContents(),
    scrollY: await page.evaluate(() => window.scrollY),
    errors,
  }
}
function locator(command) {
  return command.selector
    ? page.locator(command.selector)
    : page.getByRole('button', { name: command.name, exact: true })
}
async function touchDrag(command) {
  const item = page.locator('.grid-item[data-uid="' + command.uid + '"]')
  await item.scrollIntoViewIfNeeded()
  const source = await item.boundingBox()
  const cell = page.getByRole('button', {
    name: command.area + '格子 ' + command.x + ',' + command.y,
    exact: true,
  })
  const target = await cell.boundingBox()
  if (!source || !target) throw new Error('物品或落点不可见')
  const v = page.viewportSize()
  const from = { x: source.x + 4, y: source.y + 4 }
  const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  if (to.y < 0 || to.y >= v.height)
    throw new Error('目标格子在屏幕外，先滚动页面再决定')
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [from],
  })
  for (let n = 1; n <= 12; n++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * n) / 12,
          y: from.y + ((to.y - from.y) * n) / 12,
        },
      ],
    })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.waitForTimeout(470)
}
async function metrics() {
  return page.evaluate(() => {
    const vw = innerWidth,
      vh = innerHeight
    const rect = (r) => ({
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    })
    const visibility = (el) => {
      const r = el.getBoundingClientRect()
      let left = Math.max(0, r.left),
        top = Math.max(0, r.top),
        right = Math.min(vw, r.right),
        bottom = Math.min(vh, r.bottom)
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p),
          b = p.getBoundingClientRect()
        if (/auto|scroll|hidden|clip/.test(s.overflowY)) {
          top = Math.max(top, b.top)
          bottom = Math.min(bottom, b.bottom)
        }
        if (/auto|scroll|hidden|clip/.test(s.overflowX)) {
          left = Math.max(left, b.left)
          right = Math.min(right, b.right)
        }
      }
      return r.width * r.height
        ? (Math.max(0, right - left) * Math.max(0, bottom - top)) /
            (r.width * r.height)
        : 0
    }
    const buttons = [
      ...document.querySelectorAll('[role="button"],.game-button,.grid-item'),
    ]
      .map((e) => {
        const r = e.getBoundingClientRect(),
          s = getComputedStyle(e)
        return {
          label: e.getAttribute('aria-label') || e.textContent.trim(),
          class: e.className,
          ...rect(r),
          font: parseFloat(s.fontSize),
          visible: Math.round(visibility(e) * 100) / 100,
          disabled: e.hasAttribute('disabled'),
          clipped:
            e.scrollWidth > e.clientWidth + 1 ||
            e.scrollHeight > e.clientHeight + 2,
        }
      })
      .filter((b) => b.label && !/格子 /.test(b.label))
    const texts = [...document.querySelectorAll('text,taro-text-core,span')]
      .filter(
        (e) =>
          e.textContent.trim() &&
          ![...e.children].some((c) => c.textContent.trim()),
      )
      .map((e) => {
        const r = e.getBoundingClientRect(),
          s = getComputedStyle(e)
        return {
          text: e.textContent.trim(),
          class: e.className,
          ...rect(r),
          font: parseFloat(s.fontSize),
          visible: Math.round(visibility(e) * 100) / 100,
          clipped:
            e.scrollWidth > e.clientWidth + 1 ||
            e.scrollHeight > e.clientHeight + 2,
          clamp: s.webkitLineClamp,
        }
      })
    return {
      viewport: { width: vw, height: vh, scrollY },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      buttons,
      texts,
    }
  })
}
async function execute(c) {
  if (c.op === 'tap') await locator(c).first().tap({ timeout: 5000 })
  else if (c.op === 'drag') await touchDrag(c)
  else if (c.op === 'scroll')
    await page.evaluate((y) => window.scrollTo(0, y), c.y)
  else if (c.op === 'insideScroll')
    await page.locator(c.selector).evaluate((e, y) => {
      e.scrollTop = y
    }, c.y)
  else if (c.op === 'viewport')
    await page.setViewportSize({ width: c.width, height: c.height })
  else if (c.op === 'reload') {
    await page.reload()
    await page.waitForFunction(() => !!window.starshop)
  } else if (c.op === 'sample') {
    await page.waitForTimeout(220)
    const name =
      String(++serial).padStart(3, '0') +
      '-' +
      c.name.replace(/[^a-zA-Z0-9_-]/g, '_')
    await page.screenshot({
      path: path.join(root, name + '.png'),
      fullPage: !!c.fullPage,
    })
    await writeFile(
      path.join(root, name + '.json'),
      JSON.stringify(
        { state: await observe(), metrics: await metrics() },
        null,
        2,
      ),
    )
    return { file: name + '.png' }
  } else if (c.op === 'metrics') return metrics()
  else if (c.op === 'stop') stopRequested = true
  else if (c.op !== 'observe') throw new Error('未知审查命令')
  return null
}

async function runCommands(commands) {
  const results = []
  for (const c of Array.isArray(commands) ? commands : [commands]) {
    const before = await observe()
    let result
    try {
      result = await execute(c)
    } catch (e) {
      result = { error: e.message }
      results.push(result)
      await appendFile(
        path.join(root, 'actions.jsonl'),
        JSON.stringify({ command: c, before, failed: result }) + '\n',
      )
      break
    }
    const after = await observe()
    await appendFile(
      path.join(root, 'actions.jsonl'),
      JSON.stringify({ command: c, before, after }) + '\n',
    )
    if (result) results.push(result)
  }
  return { results, state: await observe() }
}
await writeFile(path.join(root, 'session.json'), JSON.stringify({ base }))
console.log(JSON.stringify({ ready: true, base, state: await observe() }))
try {
  if (process.env.REVIEW_CONTROL === 'http')
    await new Promise((resolve) => {
      finish = resolve
      process.once('SIGINT', resolve)
      process.once('SIGTERM', resolve)
    })
  else
    for await (const line of createInterface({ input: process.stdin })) {
      try {
        console.log(JSON.stringify(await runCommands(JSON.parse(line))))
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }))
      }
    }
} finally {
  await context.storageState({
    path: path.join(root, 'isolated-browser-state.json'),
  })
  await browser.close()
  server.close()
}
