export type Category = '机械' | '补给' | '遗物' | '数据'
export type Quality = '普通' | '精良' | '稀有'
export type Condition = '损坏' | '磨损' | '完好'
export interface Product {
  id: string
  name: string
  category: Category
  base: number
  level: number
  mark: string
  story: string
}
export interface Item {
  uid: string
  productId: string
  quality: Quality
  condition: Condition
  known: boolean
  cost: number
}
export interface Visitor {
  id: number
  name: string
  role: string
  line: string
  kind: 'seller' | 'buyer'
  category: Category
  budget: number
  item?: Item
  ask?: number
}
export interface Entry {
  id: number
  day: number
  text: string
  delta: number
}
export interface Game {
  version: 1
  cash: number
  day: number
  progress: number
  trades: number
  storage: number
  shelves: number
  debt: number
  seed: number
  sequence: number
  inventory: Item[]
  display: string[]
  visitor: Visitor | null
  entries: Entry[]
  notice: string
}
export type Action =
  | { type: 'next' }
  | { type: 'decline'; visitorId: number }
  | { type: 'identify'; visitorId: number }
  | { type: 'buy'; visitorId: number }
  | { type: 'sell'; visitorId: number; uid: string }
  | { type: 'display'; uid: string }
  | { type: 'clearance'; uid: string }
  | { type: 'upgrade'; target: 'storage' | 'shelves' }
  | { type: 'payRent' }
export const CATEGORIES: Category[] = ['机械', '补给', '遗物', '数据']
const names = [
  ['机械', '磁悬轴承', 50, 'AX', '来自退役货船的转向组件。'],
  ['机械', '微型燃料泵', 85, 'FP', '外壳上的编号属于旧港口。'],
  ['机械', '导航陀螺', 125, 'GY', '长途船员总会备上一只。'],
  ['机械', '气闸控制器', 170, 'AC', '还留着维修班的铅笔记号。'],
  ['机械', '聚变点火芯', 240, 'FC', '拆卸它的人很小心。'],
  ['机械', '量子线圈', 310, 'QC', '只在深空补给站见过。'],
  ['补给', '藻类口粮', 25, 'AL', '口味朴素，但能撑过一段航程。'],
  ['补给', '净水滤芯', 45, 'WF', '独立密封的便携滤芯。'],
  ['补给', '密封咖啡豆', 70, 'CF', '标签写着：留给抵港那天。'],
  ['补给', '应急氧气罐', 100, 'O2', '船员离不开的备用物资。'],
  ['补给', '医疗补给包', 155, 'MD', '前往外环航线的旅客会需要它。'],
  ['补给', '恒温培养盒', 220, 'BX', '还带着一小段生态舱的编号。'],
  ['遗物', '旧地球邮票', 40, 'ST', '邮戳来自一座已经更名的城市。'],
  ['遗物', '矿工纪念章', 65, 'MN', '背面刻着一次团聚的日期。'],
  ['遗物', '轨道怀表', 100, 'WT', '指针停在某次抵达的时刻。'],
  ['遗物', '航海铜星盘', 160, 'AS', '没有电源，也能指向故乡。'],
  ['遗物', '殖民地唱片', 230, 'LP', '封套上印着陌生的海岸线。'],
  ['遗物', '月海玻璃', 320, 'MG', '收藏家说每一片都有独特纹路。'],
  ['数据', '港口星图', 35, 'MP', '一位拾荒客标出了安全泊位。'],
  ['数据', '修理手册', 60, 'RM', '有几页被反复翻阅。'],
  ['数据', '植物样本记录', 95, 'DNA', '研究员留下的离线记录。'],
  ['数据', '探测器日志', 145, 'LOG', '记录过一段没有名字的航线。'],
  ['数据', '古航路坐标', 210, 'CO', '坐标旁有一行很小的祝福。'],
  ['数据', '失落观测档案', 290, 'AR', '最后一条记录来自外环深处。'],
] as const
export const PRODUCTS: Product[] = names.map((x, i) => ({
  id: `p${i}`,
  category: x[0],
  name: x[1],
  base: x[2],
  mark: x[3],
  story: x[4],
  level: i % 6 < 4 ? 1 : i % 6 === 4 ? 2 : 3,
}))
export const product = (item: Item) =>
  PRODUCTS.find((p) => p.id === item.productId)!
export const level = (s: Game) => (s.trades >= 40 ? 3 : s.trades >= 15 ? 2 : 1)
export const hot = (s: Game) => CATEGORIES[(s.day - 1) % CATEGORIES.length]
export const value = (item: Item) =>
  Math.max(
    1,
    Math.round(
      product(item).base *
        { 普通: 1, 精良: 1.5, 稀有: 2.2 }[item.quality] *
        { 损坏: 0.6, 磨损: 0.85, 完好: 1 }[item.condition],
    ),
  )
export const capacity = (s: Game) => 8 + s.storage * 4
export const displayCapacity = (s: Game) => 2 + s.shelves
export const upgradeCost = (s: Game, target: 'storage' | 'shelves') =>
  (target === 'storage' ? 180 : 140) * (s[target] + 1)
export const clearanceValue = (item: Item) =>
  Math.max(1, Math.floor(value(item) * 0.45))
export function quote(s: Game, item: Item): number {
  const v = s.visitor
  if (!v || v.kind !== 'buyer' || product(item).category !== v.category)
    return 0
  return Math.min(
    v.budget,
    Math.max(
      1,
      Math.round(
        value(item) *
          (v.role === '收藏家' ? 1.2 : 1.05) *
          (hot(s) === v.category ? 1.2 : 1) *
          (1 + (level(s) - 1) * 0.03),
      ),
    ),
  )
}
function rand(s: Game) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
  return s.seed / 4294967296
}
function pick<T>(s: Game, values: readonly T[]): T {
  return values[Math.floor(rand(s) * values.length)]
}
function entry(s: Game, text: string, delta = 0) {
  s.entries.unshift({ id: ++s.sequence, day: s.day, text, delta })
  s.entries = s.entries.slice(0, 60)
}
function generate(s: Game): Visitor {
  const seller = !s.inventory.length || rand(s) < 0.48
  const role = seller
    ? pick(s, ['拾荒者', '商人'])
    : pick(s, ['船员', '收藏家'])
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
    category: pick(s, CATEGORIES),
    budget: 0,
    line: '',
  }
  if (seller) {
    const p = pick(
      s,
      PRODUCTS.filter((x) => x.level <= level(s)),
    )
    const item: Item = {
      uid: `i${++s.sequence}`,
      productId: p.id,
      quality: pick(s, ['普通', '普通', '精良', '稀有']),
      condition: pick(s, ['损坏', '磨损', '完好', '完好']),
      known: false,
      cost: 0,
    }
    v.item = item
    v.category = p.category
    v.ask = Math.max(5, Math.round(value(item) * (0.55 + rand(s) * 0.3)))
    v.line =
      role === '拾荒者'
        ? '刚从废弃货舱回来。老板，看看这件能收吗？'
        : '下一班接驳艇快到了，这件货留给有眼光的人。'
  } else {
    const shown = s.inventory.filter((i) => s.display.includes(i.uid))
    const candidates = shown.length && rand(s) < 0.7 ? shown : s.inventory
    if (rand(s) < 0.85) v.category = product(pick(s, candidates)).category
    v.budget = 100 + Math.floor(rand(s) * 450)
    v.line =
      role === '收藏家'
        ? '我想找一点有故事的东西。合眼缘的话，价格好说。'
        : '明天就出港了。店里有没有能派上用场的货？'
  }
  return v
}
export function createGame(seed = 20261113): Game {
  const s: Game = {
    version: 1,
    cash: 650,
    day: 1,
    progress: 0,
    trades: 0,
    storage: 0,
    shelves: 0,
    debt: 0,
    seed: seed >>> 0,
    sequence: 10,
    inventory: [
      {
        uid: 'i1',
        productId: 'p0',
        quality: '普通',
        condition: '完好',
        known: true,
        cost: 28,
      },
      {
        uid: 'i2',
        productId: 'p8',
        quality: '精良',
        condition: '完好',
        known: true,
        cost: 65,
      },
      {
        uid: 'i3',
        productId: 'p12',
        quality: '普通',
        condition: '磨损',
        known: true,
        cost: 20,
      },
    ],
    display: ['i1', 'i2'],
    visitor: null,
    entries: [],
    notice: '轨道港重新开放，第一批旅客即将抵达。',
  }
  s.visitor = generate(s)
  return s
}
function finish(s: Game, text: string, delta: number) {
  entry(s, text, delta)
  s.visitor = null
  s.trades++
  s.progress++
  s.notice = text
  if (s.progress === 5) {
    const ending = s.day
    s.day++
    s.progress = 0
    s.notice = `第 ${s.day} 天，今日热销：${hot(s)}。`
    if (ending % 7 === 0) {
      const paid = Math.min(120, s.cash)
      s.cash -= paid
      s.debt += 120 - paid
      entry(
        s,
        `第 ${ending} 日周租，已缴 ${paid}，新增欠租 ${120 - paid}`,
        -paid,
      )
      s.notice += ` 周租实缴 ${paid}，欠租共 ${s.debt}。`
    }
  }
}
export function transition(input: Game, action: Action): Game {
  const s: Game = JSON.parse(JSON.stringify(input))
  const v = s.visitor
  if (
    ['buy', 'sell', 'identify', 'decline'].includes(action.type) &&
    (!v || !('visitorId' in action) || action.visitorId !== v.id)
  )
    throw new Error('这位顾客已离开，请查看当前柜台。')
  switch (action.type) {
    case 'next':
      if (v) throw new Error('请先处理当前顾客。')
      s.visitor = generate(s)
      break
    case 'decline':
      s.visitor = null
      s.notice = '这笔生意先放一放，等待下一位有缘人。'
      break
    case 'identify':
      if (v?.kind !== 'seller' || !v.item || v.item.known)
        throw new Error('这件商品无需再次鉴定。')
      if (s.cash < 8) throw new Error('鉴定需要 8 星币，可先去仓库清仓回款。')
      s.cash -= 8
      v.item.known = true
      entry(s, `鉴定：${product(v.item).name}`, -8)
      break
    case 'buy':
      if (v?.kind !== 'seller' || !v.item || !v.ask)
        throw new Error('当前没有可收购商品。')
      if (s.inventory.length >= capacity(s))
        throw new Error('仓库已满，请先出售或清仓。')
      if (s.cash < v.ask) throw new Error('资金不足，可拒绝报价或清仓回款。')
      s.cash -= v.ask
      s.inventory.push({ ...v.item, cost: v.ask, known: true })
      finish(s, `收购 ${product(v.item).name}`, -v.ask)
      break
    case 'sell': {
      const item = s.inventory.find((x) => x.uid === action.uid)
      if (!item) throw new Error('商品已经离开仓库。')
      const price = quote(s, item)
      if (!price) throw new Error('这位顾客不需要此类商品。')
      s.cash += price
      s.inventory = s.inventory.filter((x) => x.uid !== item.uid)
      s.display = s.display.filter((x) => x !== item.uid)
      finish(s, `售出 ${product(item).name} · 毛利 ${price - item.cost}`, price)
      break
    }
    case 'clearance': {
      const item = s.inventory.find((x) => x.uid === action.uid)
      if (!item) throw new Error('商品已经离开仓库。')
      const price = clearanceValue(item)
      s.cash += price
      s.inventory = s.inventory.filter((x) => x.uid !== item.uid)
      s.display = s.display.filter((x) => x !== item.uid)
      entry(s, `清仓 ${product(item).name}`, price)
      s.notice = `清仓回款 ${price} 星币，不推进日期。`
      break
    }
    case 'display':
      if (!s.inventory.some((x) => x.uid === action.uid))
        throw new Error('未找到该商品。')
      if (s.display.includes(action.uid))
        s.display = s.display.filter((x) => x !== action.uid)
      else {
        if (s.display.length >= displayCapacity(s))
          throw new Error('展示位已满，请先撤下商品或升级。')
        s.display.push(action.uid)
      }
      break
    case 'upgrade': {
      if (s[action.target] >= 5) throw new Error('此项目已升至首版上限。')
      const cost = upgradeCost(s, action.target)
      if (s.cash < cost) throw new Error('资金不足，先完成几笔生意再回来。')
      s.cash -= cost
      s[action.target]++
      entry(s, action.target === 'storage' ? '仓库扩容 +4' : '展示位 +1', -cost)
      break
    }
    case 'payRent': {
      const pay = Math.min(s.debt, s.cash)
      if (!pay) throw new Error('当前无需补租，或没有可用资金。')
      s.cash -= pay
      s.debt -= pay
      entry(s, '补缴周租', -pay)
      break
    }
  }
  return s
}
export function validateGame(x: unknown): x is Game {
  if (!x || typeof x !== 'object') return false
  const s = x as Game
  const integer = (n: unknown) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
  const validItem = (i: Item) =>
    !!i &&
    typeof i.uid === 'string' &&
    PRODUCTS.some((p) => p.id === i.productId) &&
    ['普通', '精良', '稀有'].includes(i.quality) &&
    ['损坏', '磨损', '完好'].includes(i.condition) &&
    typeof i.known === 'boolean' &&
    integer(i.cost)
  if (
    s.version !== 1 ||
    ![
      s.cash,
      s.day,
      s.progress,
      s.trades,
      s.storage,
      s.shelves,
      s.debt,
      s.seed,
      s.sequence,
    ].every(integer) ||
    s.day < 1 ||
    s.progress >= 5 ||
    s.storage > 5 ||
    s.shelves > 5 ||
    s.seed > 4294967295
  )
    return false
  if (
    !Array.isArray(s.inventory) ||
    !s.inventory.every(validItem) ||
    s.inventory.length > capacity(s) ||
    new Set(s.inventory.map((i) => i.uid)).size !== s.inventory.length
  )
    return false
  if (
    !Array.isArray(s.display) ||
    s.display.length > displayCapacity(s) ||
    new Set(s.display).size !== s.display.length ||
    !s.display.every((id) => s.inventory.some((i) => i.uid === id))
  )
    return false
  if (
    !Array.isArray(s.entries) ||
    s.entries.length > 60 ||
    !s.entries.every(
      (e) =>
        e &&
        integer(e.id) &&
        integer(e.day) &&
        typeof e.text === 'string' &&
        Number.isSafeInteger(e.delta),
    ) ||
    typeof s.notice !== 'string'
  )
    return false
  const v = s.visitor
  return (
    v === null ||
    (!!v &&
      integer(v.id) &&
      typeof v.name === 'string' &&
      typeof v.role === 'string' &&
      typeof v.line === 'string' &&
      CATEGORIES.includes(v.category) &&
      integer(v.budget) &&
      (v.kind === 'buyer' ||
        (v.kind === 'seller' &&
          !!v.item &&
          validItem(v.item) &&
          integer(v.ask) &&
          v.ask! > 0)))
  )
}
