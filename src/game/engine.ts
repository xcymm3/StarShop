import {
  CATEGORIES,
  PRODUCTS,
  type Category,
  type Quality,
  type Condition,
} from './catalog'
import {
  firstFit,
  fits,
  type Area,
  type Placement,
  type Located,
  type Bounds,
} from './grid'
export { PRODUCTS, CATEGORIES }
export type { Category, Quality, Condition, Area }
export interface Item extends Placement {
  uid: string
  productId: string
  quality: Quality
  condition: Condition
  known: boolean
  claimedQuality: Quality
  cost: number
}
export interface Visitor {
  id: number
  name: string
  role: '拾荒者' | '船员' | '商人' | '收藏家'
  line: string
  kind: 'seller' | 'buyer'
  category: Category
  budget: number
  stock: Item[]
  asks: Record<string, number>
  remaining: number
  minimumQuality: Quality
  acceptsDamaged: boolean
  bargained: boolean
  priceFactor: number
  tolerance: number
}
export interface Entry {
  id: number
  day: number
  text: string
  delta: number
  kind: string
}
export interface Bill {
  day: number
  amount: number
  paid: number
  deferred: boolean
}
export interface DayStats {
  income: number
  spending: number
  profit: number
  trades: number
}
export interface DayReport extends DayStats {
  day: number
  rentDue: number
}
export interface Audit {
  id: string
  action: string
  reason: string
  day: number
  cashDelta: number
  before: string
  after: string
  cashBefore: number
  cashAfter: number
  dayAfter: number
  goods: {
    added: string[]
    removed: string[]
    moved: string[]
    identified: string[]
  }
}
export interface Game {
  version: 2
  cash: number
  day: number
  progress: number
  trades: number
  storage: number
  shelves: number
  reputation: number
  seed: number
  sequence: number
  inventory: Item[]
  visitor: Visitor | null
  staged: string[]
  stagePositions: Record<string, Placement>
  entries: Entry[]
  notice: string
  bills: Bill[]
  dayStats: DayStats
  report: DayReport | null
  job: { active: boolean; category: Category; completed: number }
  audit: Audit[]
}
export type Action =
  | { type: 'next' }
  | { type: 'dismiss'; visitorId: number }
  | { type: 'identify'; uid: string }
  | { type: 'stage'; uid: string }
  | { type: 'unstage'; uid: string }
  | { type: 'buy'; visitorId: number }
  | { type: 'sell'; visitorId: number }
  | { type: 'bargain'; visitorId: number }
  | {
      type: 'move'
      uid: string
      area: Area
      x: number
      y: number
      rotated: boolean
    }
  | { type: 'autoPlace'; uid: string; area: Area }
  | { type: 'clearance'; uid: string }
  | { type: 'upgrade'; target: 'storage' | 'shelves' }
  | { type: 'payRent' }
  | { type: 'deferRent' }
  | { type: 'ackDay' }
  | { type: 'startJob' }
  | { type: 'completeJob'; category: Category }
export const product = (item: Pick<Item, 'productId'>) =>
  PRODUCTS.find((p) => p.id === item.productId)!
const qualities: Quality[] = ['普通', '精良', '稀有']
const qualityFactor = { 普通: 1, 精良: 1.5, 稀有: 2.2 }
const conditionFactor = { 损坏: 0.6, 磨损: 0.85, 完好: 1 }
export const level = (s: Game) =>
  s.trades >= 40 && s.reputation >= 55
    ? 3
    : s.trades >= 15 && s.reputation >= 45
      ? 2
      : 1
export const hot = (s: Game) => CATEGORIES[(s.day - 1) % 4]
export const value = (item: Item) =>
  Math.max(
    1,
    Math.round(
      product(item).base *
        qualityFactor[item.quality] *
        conditionFactor[item.condition],
    ),
  )
export const estimate = (item: Item) =>
  item.known
    ? [value(item), value(item)]
    : [
        Math.max(
          1,
          Math.round(product(item).base * conditionFactor[item.condition]),
        ),
        Math.round(product(item).base * conditionFactor[item.condition] * 2.2),
      ]
export const bounds = (s: Game, area: Area): Bounds =>
  area === 'warehouse'
    ? { width: 8, height: 6 + s.storage * 3 }
    : area === 'counter'
      ? { width: 8, height: 3 }
      : { width: 4, height: 3 + s.shelves }
export const capacity = (s: Game) => {
  const b = bounds(s, 'warehouse')
  return b.width * b.height
}
export const displayCapacity = (s: Game) => {
  const b = bounds(s, 'showcase')
  return b.width * b.height
}
export const upgradeCost = (s: Game, target: 'storage' | 'shelves') =>
  (target === 'storage' ? 180 : 140) * (s[target] + 1)
export const debt = (s: Game) =>
  s.bills.reduce((a, b) => a + b.amount - b.paid, 0)
export const clearanceValue = (item: Item) =>
  Math.max(1, Math.floor((item.known ? value(item) : estimate(item)[0]) * 0.45))
export const located = (item: Item): Located => ({
  ...item,
  width: product(item).width,
  height: product(item).height,
})
export function occupied(s: Game): Located[] {
  const out = s.inventory.map(located)
  if (s.visitor?.kind === 'seller')
    for (const uid of s.staged) {
      const item = s.visitor.stock.find((i) => i.uid === uid)
      if (item && s.stagePositions[uid])
        out.push({ ...located(item), ...s.stagePositions[uid] })
    }
  return out
}
export const usedCells = (s: Game, area: Area) =>
  occupied(s)
    .filter((i) => i.area === area)
    .reduce((a, i) => a + i.width * i.height, 0)
export function itemById(s: Game, uid: string): Item | undefined {
  return (
    s.inventory.find((i) => i.uid === uid) ??
    s.visitor?.stock.find((i) => i.uid === uid)
  )
}
export function quote(s: Game, item: Item): number {
  const v = s.visitor
  if (
    !v ||
    v.kind !== 'buyer' ||
    v.remaining <= 0 ||
    product(item).category !== v.category ||
    (!v.acceptsDamaged && item.condition === '损坏') ||
    qualities.indexOf(item.quality) < qualities.indexOf(v.minimumQuality)
  )
    return 0
  // The buyer's offer is public. It does not reveal the property's underlying quality.
  return Math.max(
    1,
    Math.round(
      value(item) *
        (v.role === '收藏家' ? 1.22 : v.role === '商人' ? 0.9 : 1.05) *
        (hot(s) === v.category ? 1.15 : 1) *
        v.priceFactor,
    ),
  )
}
export function selectedTotal(s: Game): number {
  const v = s.visitor
  if (!v) return 0
  return s.staged.reduce((a, uid) => {
    const i = itemById(s, uid)
    return (
      a +
      (i
        ? v.kind === 'seller'
          ? Math.max(1, Math.round(v.asks[uid] * v.priceFactor))
          : quote(s, i)
        : 0)
    )
  }, 0)
}
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error(reason)
}
function rand(s: Game) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
  return s.seed / 4294967296
}
function pick<T>(s: Game, values: readonly T[]): T {
  return values[Math.floor(rand(s) * values.length)]
}
function entry(s: Game, text: string, delta = 0, kind = '操作') {
  s.entries.unshift({ id: ++s.sequence, day: s.day, text, delta, kind })
  s.entries = s.entries.slice(0, 180)
  s.notice = text
  if (delta > 0) s.dayStats.income += delta
  else s.dayStats.spending -= delta
}
function reputation(s: Game, amount: number) {
  s.reputation = Math.max(0, Math.min(100, s.reputation + amount))
}
function makeItem(s: Game, productId: string, known = false): Item {
  return {
    uid: 'i' + ++s.sequence,
    productId,
    quality: pick(s, ['普通', '普通', '普通', '精良', '稀有']),
    claimedQuality: pick(s, qualities),
    condition: pick(s, ['损坏', '磨损', '完好', '完好']),
    known,
    cost: 0,
    area: 'counter',
    x: 0,
    y: 0,
    rotated: false,
  }
}
function generate(s: Game): Visitor {
  const seller = s.inventory.length === 0 || rand(s) < 0.5
  const role: Visitor['role'] = seller
    ? pick(s, ['拾荒者', '商人'])
    : pick(s, ['船员', '船员', '商人', '收藏家'])
  let category = pick(s, CATEGORIES)
  const displayed = s.inventory.filter((i) => i.area === 'showcase')
  if (!seller && displayed.length && rand(s) < 0.55)
    category = product(pick(s, displayed)).category
  const v: Visitor = {
    id: ++s.sequence,
    name: pick(s, [
      '阿岚',
      '米洛',
      '周砾',
      '塔玛',
      '洛伊',
      '林舟',
      '艾达',
      '索恩',
    ]),
    role,
    kind: seller ? 'seller' : 'buyer',
    category,
    budget: 0,
    line: '',
    stock: [],
    asks: {},
    remaining: 1 + Math.floor(rand(s) * 3),
    minimumQuality: role === '收藏家' ? '精良' : '普通',
    acceptsDamaged: role !== '收藏家',
    bargained: false,
    priceFactor: 1,
    tolerance: rand(s),
  }
  if (seller) {
    const goods = PRODUCTS.filter((p) => p.level <= level(s))
    for (let n = 0; n < v.remaining; n++) {
      const item = makeItem(s, pick(s, goods).id)
      v.stock.push(item)
      // Seller claims can overstate quality. Asking price is not derived from secret true value.
      v.asks[item.uid] = Math.max(
        5,
        Math.round(
          product(item).base *
            qualityFactor[item.claimedQuality] *
            conditionFactor[item.condition] *
            (0.62 + rand(s) * 0.63),
        ),
      )
    }
    // A low-cash, empty shop can still find genuinely cheap stock without free items.
    if (!s.inventory.length && s.cash >= 5 && s.cash <= 25) {
      const cheap = makeItem(s, 'p9')
      cheap.quality = cheap.claimedQuality = '普通'
      cheap.condition = '损坏'
      v.stock[0] = cheap
      v.asks[cheap.uid] = Math.min(s.cash, 8)
    }
    v.line =
      role === '拾荒者'
        ? '刚从废弃货舱回来。挑你看得上的，价钱可以谈一次。'
        : '接驳艇快到了。这批货可以挑着收。'
  } else {
    const ranges =
      role === '收藏家'
        ? [180, 850 * level(s)]
        : role === '商人'
          ? [100, 420 * level(s)]
          : [60, 200 * level(s)]
    v.budget = Math.round(ranges[0] + rand(s) * (ranges[1] - ranges[0]))
    v.line =
      role === '收藏家'
        ? '只收精良以上、没有损坏的藏品。价格合适就留下。'
        : role === '商人'
          ? '想收几件转售的货，价格要留点余地。'
          : '明天出港，找点能用的东西。磨损和损坏也可以看看。'
  }
  return v
}
function blank(seed: number): Game {
  return {
    version: 2,
    cash: 650,
    day: 1,
    progress: 0,
    trades: 0,
    storage: 0,
    shelves: 0,
    reputation: 50,
    seed: seed >>> 0,
    sequence: 10,
    inventory: [],
    visitor: null,
    staged: [],
    stagePositions: {},
    entries: [],
    notice: '先看看来货，挑选后放上柜台。货物尺寸决定仓位。',
    bills: [],
    dayStats: { income: 0, spending: 0, profit: 0, trades: 0 },
    report: null,
    job: { active: false, category: '补给', completed: 0 },
    audit: [],
  }
}
export function createGame(seed = 20261114): Game {
  const s = blank(seed)
  for (const [productId, cost, area] of [
    ['p0', 28, 'warehouse'],
    ['p6', 14, 'showcase'],
    ['p12', 20, 'warehouse'],
  ] as const) {
    const item = makeItem(s, productId, true)
    item.quality = item.claimedQuality = '普通'
    item.condition = '完好'
    item.cost = cost
    const pos = firstFit(
      bounds(s, area),
      product(item),
      area,
      item.uid,
      occupied(s),
    )!
    s.inventory.push({ ...item, ...pos })
  }
  s.visitor = generate(s)
  return s
}
function finish(s: Game, text: string, delta: number, profit = 0) {
  entry(s, text, delta, delta >= 0 ? '出售' : '收购')
  s.trades++
  s.progress++
  s.dayStats.trades++
  s.dayStats.profit += profit
  reputation(s, 1)
  s.staged = []
  s.stagePositions = {}
  if (s.progress === 5) {
    if (s.day % 7 === 0 && !s.bills.some((b) => b.day === s.day))
      s.bills.push({ day: s.day, amount: 120, paid: 0, deferred: false })
    s.report = { ...s.dayStats, day: s.day, rentDue: debt(s) }
    s.notice = '当日五笔成交已完成。请查看日结，当前顾客和柜台货物都会保留。'
  }
}
export function transition(input: Game, action: Action): Game {
  const s: Game = JSON.parse(JSON.stringify(input))
  const v = s.visitor
  if (s.report)
    need(
      ['ackDay', 'payRent', 'deferRent'].includes(action.type),
      '先处理当日日结与租赁账单。',
    )
  if (s.job.active)
    need(action.type === 'completeJob', '先核对理货委托的货签。')
  if ('visitorId' in action)
    need(v && v.id === action.visitorId, '这位顾客已离开，请重新观察。')
  switch (action.type) {
    case 'next':
      need(!v, '先送走当前顾客。')
      s.visitor = generate(s)
      s.notice = s.visitor.line
      break
    case 'dismiss':
      s.visitor = null
      s.staged = []
      s.stagePositions = {}
      s.notice = '顾客离开了。柜台上的自有货物仍归你所有。'
      break
    case 'identify': {
      const item = itemById(s, action.uid)
      need(item, '物品不在店内或当前来货中。')
      need(!item.known, '这件商品已经鉴定。')
      need(s.cash >= 8, '鉴定需要 8 星币。')
      s.cash -= 8
      item.known = true
      entry(s, '鉴定 ' + product(item).name + '：' + item.quality, -8, '鉴定')
      break
    }
    case 'stage': {
      need(v, '没有顾客。')
      need(!s.staged.includes(action.uid), '商品已经选中。')
      const item = itemById(s, action.uid)
      need(item, '未找到商品。')
      if (v.kind === 'seller') {
        need(
          v.stock.some((i) => i.uid === item.uid),
          '只能暂放当前顾客的来货。',
        )
        const pos = firstFit(
          bounds(s, 'counter'),
          product(item),
          'counter',
          item.uid,
          occupied(s),
        )
        need(pos, '柜台放不下这件货，请先整理自有货物或撤下一件来货。')
        s.stagePositions[item.uid] = pos
      } else {
        need(
          s.inventory.some((i) => i.uid === item.uid),
          '不能出售他人的货物。',
        )
        need(quote(s, item) > 0, '顾客不接受这件商品的类别、状态或品质。')
        need(s.staged.length < v.remaining, '超过顾客本次可购买数量。')
        need(
          selectedTotal(s) + quote(s, item) <= v.budget,
          '合计报价超过顾客剩余预算。',
        )
      }
      s.staged.push(item.uid)
      s.notice =
        v.kind === 'seller'
          ? '来货已暂放，尚未付款。'
          : '已选入报价，尚未出售。'
      break
    }
    case 'unstage':
      need(s.staged.includes(action.uid), '商品尚未选中。')
      s.staged = s.staged.filter((id) => id !== action.uid)
      delete s.stagePositions[action.uid]
      break
    case 'buy': {
      need(v?.kind === 'seller', '当前没有卖货顾客。')
      need(s.staged.length, '先挑选并暂放来货。')
      const total = selectedTotal(s)
      need(total > 0 && s.cash >= total, '收购资金不足。')
      const selected = v.stock.filter((i) => s.staged.includes(i.uid))
      need(selected.length === s.staged.length, '来货已改变。')
      const layout = s.inventory.map(located)
      for (const item of selected) {
        const position = s.stagePositions[item.uid]
        need(position, '来货没有柜台位置。')
        const placed = { ...located(item), ...position }
        need(fits(bounds(s, 'counter'), placed, layout), '柜台位置已被占用。')
        layout.push(placed)
      }
      s.cash -= total
      for (const item of selected) {
        s.inventory.push({
          ...item,
          ...s.stagePositions[item.uid],
          cost: Math.max(1, Math.round(v.asks[item.uid] * v.priceFactor)),
        })
        delete v.asks[item.uid]
      }
      v.stock = v.stock.filter((i) => !s.staged.includes(i.uid))
      v.remaining = v.stock.length
      finish(s, '收购 ' + selected.length + ' 件，留在柜台待整理', -total)
      break
    }
    case 'sell': {
      need(v?.kind === 'buyer', '当前没有买货顾客。')
      need(
        s.staged.length && s.staged.length <= v.remaining,
        '先选入可出售的货物。',
      )
      const selected = s.inventory.filter((i) => s.staged.includes(i.uid))
      need(
        selected.length === s.staged.length &&
          selected.every((i) => quote(s, i) > 0),
        '选中的商品已不符合需求。',
      )
      const total = selectedTotal(s)
      need(total > 0 && total <= v.budget, '超过顾客预算。')
      const profit = total - selected.reduce((a, i) => a + i.cost, 0)
      s.cash += total
      v.budget -= total
      v.remaining -= selected.length
      s.inventory = s.inventory.filter((i) => !s.staged.includes(i.uid))
      finish(
        s,
        '出售 ' + selected.length + ' 件 · 毛利 ' + profit,
        total,
        profit,
      )
      break
    }
    case 'bargain': {
      need(
        v && !v.bargained && s.staged.length,
        '先选货，每位顾客仅可还价一次。',
      )
      v.bargained = true
      if (v.tolerance < 0.08) {
        reputation(s, -2)
        s.visitor = null
        s.staged = []
        s.stagePositions = {}
        entry(s, '顾客不接受还价，离开了。', 0, '还价')
      } else if (v.tolerance < 0.38) {
        reputation(s, -1)
        entry(s, '还价被拒绝，仍可按原报价成交。', 0, '还价')
      } else {
        const factor = v.kind === 'seller' ? 0.9 : 1.1
        need(
          v.kind === 'seller' ||
            Math.round(selectedTotal(s) * factor) <= v.budget,
          '加价后超过预算。',
        )
        v.priceFactor = factor
        entry(
          s,
          v.kind === 'seller' ? '顾客同意降价 10%。' : '顾客同意加价 10%。',
          0,
          '还价',
        )
      }
      break
    }
    case 'move':
    case 'autoPlace': {
      const item = s.inventory.find((i) => i.uid === action.uid)
      need(item, '只能整理自己的商品。')
      need(!s.staged.includes(item.uid), '先撤下交易选中的商品。')
      need(
        ['warehouse', 'showcase', 'counter'].includes(action.area),
        '不存在的库存区域。',
      )
      const pos =
        action.type === 'move'
          ? action
          : firstFit(
              bounds(s, action.area),
              product(item),
              action.area,
              item.uid,
              occupied(s),
            )
      need(pos, '这个区域没有完整空位。')
      const placed = {
        ...located(item),
        area: action.area,
        x: pos.x,
        y: pos.y,
        rotated: pos.rotated,
      }
      need(
        fits(bounds(s, action.area), placed, occupied(s)),
        '位置越界或与其他货物重叠。',
      )
      Object.assign(item, {
        area: action.area,
        x: pos.x,
        y: pos.y,
        rotated: pos.rotated,
      })
      s.notice =
        product(item).name +
        '已放入' +
        { warehouse: '仓库', counter: '柜台', showcase: '展示柜' }[item.area]
      break
    }
    case 'clearance': {
      const item = s.inventory.find((i) => i.uid === action.uid)
      need(item, '商品已离开库存。')
      need(!s.staged.includes(item.uid), '先撤下交易选中的商品。')
      const price = clearanceValue(item)
      s.cash += price
      s.inventory = s.inventory.filter((i) => i.uid !== item.uid)
      s.dayStats.profit += price - item.cost
      entry(s, '清仓 ' + product(item).name, price, '清仓')
      break
    }
    case 'upgrade': {
      need(['storage', 'shelves'].includes(action.target), '不存在的升级。')
      need(s[action.target] < 5, '已达到升级上限。')
      const cost = upgradeCost(s, action.target)
      need(s.cash >= cost, '升级资金不足。')
      s.cash -= cost
      s[action.target]++
      entry(
        s,
        action.target === 'storage' ? '仓库增加 3 行' : '展示柜增加 1 行',
        -cost,
        '升级',
      )
      break
    }
    case 'payRent': {
      const amount = Math.min(debt(s), s.cash)
      need(amount > 0, '没有欠租，或当前没有现金。')
      let remaining = amount
      for (const bill of s.bills) {
        const paid = Math.min(remaining, bill.amount - bill.paid)
        bill.paid += paid
        remaining -= paid
      }
      s.cash -= amount
      entry(
        s,
        '支付房租 ' + amount + (debt(s) ? '，仍欠 ' + debt(s) : '，账单已付清'),
        -amount,
        '房租',
      )
      if (s.report) s.report.rentDue = debt(s)
      break
    }
    case 'deferRent':
      need(s.report && debt(s) > 0, '当前没有待延期账单。')
      for (const bill of s.bills)
        if (bill.paid < bill.amount) bill.deferred = true
      entry(s, '确认延期交租，欠款保留，可在账本补缴。', 0, '房租')
      break
    case 'ackDay':
      need(s.report, '没有待确认日结。')
      need(
        s.bills.every((b) => b.paid === b.amount || b.deferred),
        '先付款或明确选择延期。',
      )
      s.day++
      s.progress = 0
      s.report = null
      s.dayStats = { income: 0, spending: 0, profit: 0, trades: 0 }
      s.notice =
        '第 ' + s.day + ' 天 · 今日热销 ' + hot(s) + '。当前顾客与货物已保留。'
      break
    case 'startJob':
      need(
        s.cash < 5 && s.inventory.length === 0,
        '仅在资金不足 5 且没有自有货物时可接应急理货。',
      )
      need(!s.job.active, '已有理货委托。')
      s.job.active = true
      s.job.category = '补给'
      s.staged = []
      s.stagePositions = {}
      s.notice = '货签：应急氧气罐。请将货签归入正确类别，完成可获 20 星币。'
      break
    case 'completeJob':
      need(s.job.active, '没有进行中的理货。')
      need(action.category === s.job.category, '分类不符，核对公开货签再试。')
      s.job.active = false
      s.job.completed++
      s.cash += 20
      entry(s, '完成港口理货委托', 20, '委托')
      break
  }
  need(validateGame(s), '操作产生了无效状态，未保存。')
  return s
}
export function validateGame(raw: unknown): raw is Game {
  try {
    const s = raw as Game
    const integer = (n: unknown) =>
      typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
    if (
      !s ||
      s.version !== 2 ||
      ![
        s.cash,
        s.day,
        s.progress,
        s.trades,
        s.storage,
        s.shelves,
        s.reputation,
        s.seed,
        s.sequence,
      ].every(integer) ||
      s.day < 1 ||
      s.progress > 5 ||
      s.storage > 5 ||
      s.shelves > 5 ||
      s.reputation > 100 ||
      s.seed > 4294967295
    )
      return false
    const validItem = (i: Item) =>
      !!i &&
      typeof i.uid === 'string' &&
      !!product(i) &&
      qualities.includes(i.quality) &&
      qualities.includes(i.claimedQuality) &&
      ['损坏', '磨损', '完好'].includes(i.condition) &&
      typeof i.known === 'boolean' &&
      integer(i.cost) &&
      ['warehouse', 'counter', 'showcase'].includes(i.area) &&
      integer(i.x) &&
      integer(i.y) &&
      typeof i.rotated === 'boolean'
    if (
      !Array.isArray(s.inventory) ||
      !s.inventory.every(validItem) ||
      !Array.isArray(s.staged) ||
      new Set(s.staged).size !== s.staged.length ||
      !s.stagePositions ||
      typeof s.stagePositions !== 'object'
    )
      return false
    const v = s.visitor
    if (
      v !== null &&
      (!v ||
        !integer(v.id) ||
        !['seller', 'buyer'].includes(v.kind) ||
        !['拾荒者', '船员', '商人', '收藏家'].includes(v.role) ||
        typeof v.name !== 'string' ||
        typeof v.line !== 'string' ||
        !CATEGORIES.includes(v.category) ||
        !integer(v.budget) ||
        !integer(v.remaining) ||
        v.remaining > 3 ||
        !qualities.includes(v.minimumQuality) ||
        typeof v.acceptsDamaged !== 'boolean' ||
        typeof v.bargained !== 'boolean' ||
        ![1, 0.9, 1.1].includes(v.priceFactor) ||
        typeof v.tolerance !== 'number' ||
        v.tolerance < 0 ||
        v.tolerance >= 1 ||
        !Array.isArray(v.stock) ||
        !v.stock.every(validItem) ||
        !v.asks)
    )
      return false
    const all = [...s.inventory, ...(v?.stock ?? [])]
    if (
      new Set(all.map((i) => i.uid)).size !== all.length ||
      all.some((i) => !/^.{1,100}$/.test(i.uid))
    )
      return false
    if (
      v?.kind === 'seller' &&
      (v.remaining !== v.stock.length ||
        v.stock.some((i) => !integer(v.asks[i.uid]) || v.asks[i.uid] < 1))
    )
      return false
    if (v?.kind === 'buyer' && v.stock.length) return false
    if (
      s.staged.some((uid) =>
        v?.kind === 'seller'
          ? !v.stock.some((i) => i.uid === uid)
          : !v || !s.inventory.some((i) => i.uid === uid),
      )
    )
      return false
    if (
      Object.keys(s.stagePositions).some(
        (uid) => !s.staged.includes(uid) || v?.kind !== 'seller',
      )
    )
      return false
    if (
      v?.kind === 'seller' &&
      s.staged.some(
        (uid) =>
          !s.stagePositions[uid] ||
          s.stagePositions[uid].area !== 'counter' ||
          !integer(s.stagePositions[uid].x) ||
          !integer(s.stagePositions[uid].y) ||
          typeof s.stagePositions[uid].rotated !== 'boolean',
      )
    )
      return false
    if (
      v?.kind === 'buyer' &&
      (s.staged.length > v.remaining ||
        s.staged.some((uid) => !quote(s, itemById(s, uid)!)) ||
        selectedTotal(s) > v.budget)
    )
      return false
    const layout = occupied(s)
    if (!layout.every((i) => fits(bounds(s, i.area), i, layout))) return false
    if (
      !Array.isArray(s.bills) ||
      new Set(s.bills.map((b) => b.day)).size !== s.bills.length ||
      s.bills.some(
        (b) =>
          !integer(b.day) ||
          b.day < 7 ||
          b.day % 7 ||
          b.day > s.day ||
          b.amount !== 120 ||
          !integer(b.paid) ||
          b.paid > b.amount ||
          typeof b.deferred !== 'boolean',
      )
    )
      return false
    const validStats = (d: DayStats) =>
      d &&
      [d.income, d.spending, d.trades].every(integer) &&
      Number.isSafeInteger(d.profit)
    if (
      !validStats(s.dayStats) ||
      s.dayStats.trades !== s.progress ||
      (s.progress === 5) !== !!s.report
    )
      return false
    if (
      s.report &&
      (!validStats(s.report) ||
        s.report.day !== s.day ||
        s.report.trades !== 5 ||
        !integer(s.report.rentDue))
    )
      return false
    if (
      !s.job ||
      typeof s.job.active !== 'boolean' ||
      !CATEGORIES.includes(s.job.category) ||
      !integer(s.job.completed)
    )
      return false
    if (
      !Array.isArray(s.entries) ||
      s.entries.length > 180 ||
      s.entries.some(
        (e) =>
          !integer(e.id) ||
          !integer(e.day) ||
          typeof e.text !== 'string' ||
          typeof e.kind !== 'string' ||
          !Number.isSafeInteger(e.delta),
      )
    )
      return false
    if (
      !Array.isArray(s.audit) ||
      s.audit.length > 200 ||
      s.audit.some(
        (a) =>
          typeof a.id !== 'string' ||
          typeof a.action !== 'string' ||
          typeof a.reason !== 'string' ||
          !integer(a.day) ||
          !Number.isSafeInteger(a.cashDelta) ||
          typeof a.before !== 'string' ||
          typeof a.after !== 'string' ||
          !integer(a.cashBefore) ||
          !integer(a.cashAfter) ||
          !integer(a.dayAfter) ||
          a.cashAfter - a.cashBefore !== a.cashDelta ||
          !a.goods ||
          ![
            a.goods.added,
            a.goods.removed,
            a.goods.moved,
            a.goods.identified,
          ].every(
            (ids) =>
              Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
          ),
      )
    )
      return false
    return typeof s.notice === 'string'
  } catch {
    return false
  }
}
// Migration uses only saved facts. Old files are backed up by the storage adapter first.
export function migrateV1(raw: unknown): Game {
  const old = raw as Record<string, unknown>
  need(
    old && old.version === 1 && Array.isArray(old.inventory),
    '无法识别旧存档。',
  )
  const s = blank(Number(old.seed))
  for (const key of [
    'cash',
    'day',
    'progress',
    'trades',
    'storage',
    'shelves',
    'sequence',
  ] as const) {
    need(
      Number.isSafeInteger(old[key]) && Number(old[key]) >= 0,
      '旧存档数值损坏。',
    )
    s[key] = Number(old[key])
  }
  s.dayStats.trades = s.progress
  for (const source of old.inventory as Item[]) {
    need(
      source &&
        !!product(source) &&
        qualities.includes(source.quality) &&
        ['损坏', '磨损', '完好'].includes(source.condition) &&
        typeof source.known === 'boolean' &&
        Number.isSafeInteger(source.cost) &&
        source.cost >= 0,
      '旧商品数据损坏。',
    )
    const prefer: Area =
      Array.isArray(old.display) && old.display.includes(source.uid)
        ? 'showcase'
        : 'warehouse'
    const area = firstFit(
      bounds(s, prefer),
      product(source),
      prefer,
      source.uid,
      occupied(s),
    )
      ? prefer
      : 'warehouse'
    const pos =
      firstFit(
        bounds(s, area),
        product(source),
        area,
        source.uid,
        occupied(s),
      ) ??
      firstFit(
        bounds(s, 'counter'),
        product(source),
        'counter',
        source.uid,
        occupied(s),
      )
    need(pos, '旧库存无法安全摆放，原档已保留。')
    s.inventory.push({ ...source, claimedQuality: source.quality, ...pos })
  }
  const visitor = old.visitor as Record<string, unknown> | null
  if (visitor) {
    const kind = visitor.kind
    need(kind === 'buyer' || kind === 'seller', '旧顾客数据损坏。')
    need(
      Number.isSafeInteger(visitor.id) &&
        Number.isSafeInteger(visitor.budget) &&
        Number(visitor.budget) >= 0 &&
        CATEGORIES.includes(visitor.category as Category) &&
        typeof visitor.name === 'string' &&
        typeof visitor.line === 'string' &&
        ['拾荒者', '船员', '商人', '收藏家'].includes(String(visitor.role)),
      '旧顾客数据损坏。',
    )
    s.visitor = {
      id: Number(visitor.id),
      kind,
      name: String(visitor.name),
      role: visitor.role as Visitor['role'],
      line: String(visitor.line),
      category: visitor.category as Category,
      budget: Number(visitor.budget),
      remaining: 1,
      stock: [],
      asks: {},
      minimumQuality: '普通',
      acceptsDamaged: true,
      bargained: false,
      priceFactor: 1,
      tolerance: 0.5,
    }
    if (kind === 'seller') {
      const item = visitor.item as Item
      need(
        item &&
          product(item) &&
          Number.isSafeInteger(visitor.ask) &&
          Number(visitor.ask) > 0,
        '旧来货数据损坏。',
      )
      s.visitor.stock = [
        {
          ...item,
          claimedQuality: item.quality,
          area: 'counter',
          x: 0,
          y: 0,
          rotated: false,
        },
      ]
      s.visitor.asks[item.uid] = Number(visitor.ask)
    }
  }
  const oldDebt = Number(old.debt)
  need(Number.isSafeInteger(oldDebt) && oldDebt >= 0, '旧欠租损坏。')
  if (oldDebt) {
    // Preserve arbitrary old arrears as standard historical bill fragments; never erase a balance.
    let remaining = oldDebt
    for (let d = 7; remaining > 0 && d < s.day; d += 7) {
      const outstanding = Math.min(120, remaining)
      s.bills.push({
        day: d,
        amount: 120,
        paid: 120 - outstanding,
        deferred: true,
      })
      remaining -= outstanding
    }
    need(remaining === 0, '旧欠租与日期不符，原档已保留。')
  }
  if (Array.isArray(old.entries))
    s.entries = (old.entries as Entry[])
      .slice(0, 180)
      .map((e) => ({ ...e, kind: '旧账' }))
  s.notice = '旧店铺已迁移，资金、当前报价和未知信息保留。商品已安排格子位置。'
  need(validateGame(s), '旧存档迁移验证失败，原档已保留。')
  return s
}
