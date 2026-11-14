import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import {
  createGame,
  transition,
  validateGame,
  product,
  quote,
  bounds,
  debt,
  value,
  migrateV1,
  type Game,
  type Visitor,
  type Action,
} from '../src/game/engine'
import { dimensions, fits } from '../src/game/grid'
import { PlayerController, observe } from '../src/game/interface'

function seller(s: Game, prices = [30, 20]): Visitor {
  const stock = prices.map((_, n) => ({
    ...s.inventory[0],
    uid: 'offer-' + ++s.sequence,
    known: false,
    quality: '普通' as const,
    claimedQuality: '稀有' as const,
    x: 0,
    y: 0,
    area: 'counter' as const,
    cost: 0,
    rotated: false,
    productId: n % 2 ? 'p12' : 'p0',
  }))
  const v: Visitor = {
    id: ++s.sequence,
    name: '测试卖家',
    role: '拾荒者',
    kind: 'seller',
    category: '机械',
    line: '测试来货',
    budget: 0,
    stock,
    asks: Object.fromEntries(stock.map((i, n) => [i.uid, prices[n]])),
    remaining: stock.length,
    minimumQuality: '普通',
    acceptsDamaged: true,
    bargained: false,
    priceFactor: 1,
    tolerance: 0.8,
  }
  s.visitor = v
  return v
}
function buyer(s: Game, budget = 200): Visitor {
  const v: Visitor = {
    id: ++s.sequence,
    name: '测试买家',
    role: '船员',
    kind: 'buyer',
    category: '机械',
    line: '测试需求',
    budget,
    stock: [],
    asks: {},
    remaining: 3,
    minimumQuality: '普通',
    acceptsDamaged: true,
    bargained: false,
    priceFactor: 1,
    tolerance: 0.8,
  }
  s.visitor = v
  return v
}
function step(s: Game, a: Action) {
  const next = transition(s, a)
  assert.ok(validateGame(next))
  return next
}
test('新局格子有效，可确定复现，观察不会推进随机数', () => {
  const s = createGame(42),
    before = JSON.stringify(s)
  assert.ok(validateGame(s))
  assert.deepEqual(s, createGame(42))
  observe(s)
  assert.equal(JSON.stringify(s), before)
})
test('旋转真实改变占地，拒绝边界、重叠和分数坐标', () => {
  const item = {
    uid: 'a',
    area: 'warehouse' as const,
    x: 0,
    y: 0,
    width: 2,
    height: 3,
    rotated: false,
  }
  assert.deepEqual(dimensions(item, true), { width: 3, height: 2 })
  assert.equal(fits({ width: 3, height: 2 }, item, []), false)
  assert.equal(
    fits({ width: 3, height: 2 }, { ...item, rotated: true }, []),
    true,
  )
  assert.equal(fits({ width: 8, height: 6 }, { ...item, x: 0.5 }, []), false)
  assert.equal(
    fits({ width: 8, height: 6 }, { ...item, uid: 'b' }, [item]),
    false,
  )
  const s = createGame()
  const a = s.inventory[0],
    b = s.inventory[2]
  assert.throws(
    () =>
      transition(s, {
        type: 'move',
        uid: a.uid,
        area: 'warehouse',
        x: b.x,
        y: b.y,
        rotated: false,
      }),
    /重叠/,
  )
  assert.throws(
    () =>
      transition(s, {
        type: 'move',
        uid: a.uid,
        area: 'warehouse',
        x: 7,
        y: 5,
        rotated: true,
      }),
    /越界/,
  )
})
test('暂放不转移归属，批量收购只算一笔，未知品质不会因买入揭示', () => {
  let s = createGame()
  const v = seller(s)
  const ids = v.stock.map((i) => i.uid)
  for (const uid of ids) s = step(s, { type: 'stage', uid })
  assert.equal(s.cash, 650)
  assert.equal(s.inventory.length, 3)
  assert.equal(s.staged.length, 2)
  assert.throws(
    () =>
      transition(s, {
        type: 'move',
        uid: ids[0],
        area: 'warehouse',
        x: 0,
        y: 4,
        rotated: false,
      }),
    /自己的/,
  )
  s = step(s, { type: 'buy', visitorId: v.id })
  assert.equal(s.cash, 600)
  assert.equal(s.progress, 1)
  assert.equal(s.trades, 1)
  assert.equal(
    s.inventory.filter(
      (i) => ids.includes(i.uid) && i.area === 'counter' && !i.known,
    ).length,
    2,
  )
  assert.equal(s.visitor?.stock.length, 0)
  assert.equal(s.visitor?.id, v.id)
  assert.throws(() => transition(s, { type: 'buy', visitorId: v.id }), /先挑选/)
})
test('柜台满、现金不足和非法区域不会扣款或复制', () => {
  const s = createGame()
  const v = seller(s, [9999])
  const before = JSON.stringify(s)
  assert.throws(() => transition(s, { type: 'buy', visitorId: v.id }), /先挑选/)
  assert.equal(JSON.stringify(s), before)
  const staged = step(s, { type: 'stage', uid: v.stock[0].uid })
  assert.throws(
    () => transition(staged, { type: 'buy', visitorId: v.id }),
    /资金不足/,
  )
  assert.throws(
    () =>
      transition(s, {
        type: 'autoPlace',
        uid: s.inventory[0].uid,
        area: 'hack' as 'warehouse',
      }),
    /不存在/,
  )
  for (let n = 0; n < 4; n++)
    s.inventory.push({
      ...s.inventory[0],
      uid: 'large-' + n,
      productId: 'p3',
      area: 'counter',
      x: n * 2,
      y: 0,
      rotated: false,
    })
  assert.ok(validateGame(s))
  assert.throws(
    () => transition(s, { type: 'stage', uid: v.stock[0].uid }),
    /柜台放不下/,
  )
})
test('收购前后都可鉴定，每件收费一次，报价不随揭示刷新', () => {
  let s = createGame()
  const v = seller(s, [60])
  const uid = v.stock[0].uid
  s = step(s, { type: 'stage', uid })
  s = step(s, { type: 'buy', visitorId: v.id })
  const cost = s.inventory.find((i) => i.uid === uid)!.cost
  s = step(s, { type: 'identify', uid })
  assert.equal(s.cash, 582)
  assert.equal(s.inventory.find((i) => i.uid === uid)!.cost, cost)
  assert.equal(s.progress, 1)
  assert.throws(() => transition(s, { type: 'identify', uid }), /已经鉴定/)
  let pre = createGame()
  const before = seller(pre, [60])
  pre = step(pre, { type: 'identify', uid: before.stock[0].uid })
  assert.equal(pre.visitor!.asks[before.stock[0].uid], 60)
})
test('展示柜与仓库位置独立保存，撤回与扩容不影响日期', () => {
  let s = createGame()
  const item = s.inventory[0],
    cash = s.cash
  s = step(s, { type: 'autoPlace', uid: item.uid, area: 'showcase' })
  assert.equal(s.inventory[0].area, 'showcase')
  assert.equal(s.cash, cash)
  s = step(s, { type: 'autoPlace', uid: item.uid, area: 'warehouse' })
  const before = bounds(s, 'warehouse').height
  s = step(s, { type: 'upgrade', target: 'storage' })
  assert.equal(bounds(s, 'warehouse').height, before + 3)
  assert.equal(s.progress, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
  assert.ok(validateGame(JSON.parse(JSON.stringify(s))))
})
test('买家共享预算、数量与偏好，选货阶段没有出售', () => {
  let s = createGame()
  const v = buyer(s, 59),
    uid = s.inventory[0].uid
  assert.ok(quote(s, s.inventory[0]) > 0)
  assert.equal(quote(s, s.inventory[2]), 0)
  assert.throws(() => transition(s, { type: 'stage', uid }), /预算/)
  v.budget = 200
  s = step(s, { type: 'stage', uid })
  assert.equal(s.inventory.length, 3)
  assert.equal(s.cash, 650)
  const price = quote(s, s.inventory[0])
  s = step(s, { type: 'sell', visitorId: v.id })
  assert.equal(s.cash, 650 + price)
  assert.equal(s.visitor!.budget, 200 - price)
  assert.equal(s.visitor!.remaining, 2)
  assert.equal(s.inventory.length, 2)
  assert.equal(s.progress, 1)
})
test('收藏家不收普通/损坏货，未匹配需求不能直接成交', () => {
  const s = createGame()
  const v = buyer(s, 1000)
  v.role = '收藏家'
  v.minimumQuality = '精良'
  v.acceptsDamaged = false
  assert.equal(quote(s, s.inventory[0]), 0)
  assert.throws(
    () => transition(s, { type: 'stage', uid: s.inventory[0].uid }),
    /不接受/,
  )
  assert.throws(
    () => transition(s, { type: 'sell', visitorId: v.id }),
    /先选入/,
  )
})
test('还价仅一次，有接受、拒绝、离开与声望反馈', () => {
  for (const [tolerance, result] of [
    [0.8, 'accept'],
    [0.2, 'reject'],
    [0.01, 'leave'],
  ] as const) {
    let s = createGame()
    const v = seller(s, [40])
    v.tolerance = tolerance
    s = step(s, { type: 'stage', uid: v.stock[0].uid })
    const reputation = s.reputation
    s = step(s, { type: 'bargain', visitorId: v.id })
    if (result === 'leave') {
      assert.equal(s.visitor, null)
      assert.equal(s.staged.length, 0)
      assert.equal(s.reputation, reputation - 2)
    } else {
      assert.equal(s.visitor!.priceFactor, result === 'accept' ? 0.9 : 1)
      assert.throws(
        () => transition(s, { type: 'bargain', visitorId: v.id }),
        /仅可还价一次/,
      )
    }
  }
})
test('第五笔生成可恢复日结，第七日账单需付款/延期且不重复计租', () => {
  let s = createGame()
  s.day = 7
  s.progress = 4
  s.dayStats.trades = 4
  const v = seller(s, [10])
  s = step(s, { type: 'stage', uid: v.stock[0].uid })
  s = step(s, { type: 'buy', visitorId: v.id })
  assert.equal(s.day, 7)
  assert.equal(s.report?.trades, 5)
  assert.equal(debt(s), 120)
  assert.throws(() => transition(s, { type: 'next' }), /日结/)
  assert.throws(() => transition(s, { type: 'ackDay' }), /付款/)
  const cash = s.cash
  s = step(s, { type: 'payRent' })
  assert.equal(s.cash, cash - 120)
  assert.equal(s.bills[0].paid, 120)
  assert.throws(() => transition(s, { type: 'payRent' }), /没有欠租/)
  s = step(s, { type: 'ackDay' })
  assert.equal(s.day, 8)
  assert.equal(s.bills.length, 1)
  assert.equal(s.progress, 0)
})
test('部分交租与明确延期保留余额，后续补缴不重复收费', () => {
  let s = createGame()
  s.day = 7
  s.progress = 4
  s.dayStats.trades = 4
  s.cash = 30
  const v = seller(s, [10])
  s = step(s, { type: 'stage', uid: v.stock[0].uid })
  s = step(s, { type: 'buy', visitorId: v.id })
  s = step(s, { type: 'payRent' })
  assert.equal(s.cash, 0)
  assert.equal(debt(s), 100)
  s = step(s, { type: 'deferRent' })
  s = step(s, { type: 'ackDay' })
  assert.equal(debt(s), 100)
  s = step(s, { type: 'clearance', uid: s.inventory[0].uid })
  const cash = s.cash
  s = step(s, { type: 'payRent' })
  assert.equal(s.cash, 0)
  assert.equal(debt(s), 100 - cash)
})
test('零资金零库存有正常理货恢复路径，不能无限凭空领钱', () => {
  let s = createGame()
  s.cash = 0
  s.inventory = []
  assert.throws(
    () => transition(s, { type: 'completeJob', category: '补给' }),
    /没有进行/,
  )
  s = step(s, { type: 'startJob' })
  assert.throws(
    () => transition(s, { type: 'completeJob', category: '机械' }),
    /分类不符/,
  )
  s = step(s, { type: 'completeJob', category: '补给' })
  assert.equal(s.cash, 20)
  assert.equal(s.day, 1)
  assert.equal(s.progress, 0)
  assert.throws(() => transition(s, { type: 'startJob' }), /仅在/)
  s = step(s, { type: 'dismiss', visitorId: s.visitor!.id })
  s = step(s, { type: 'next' })
  assert.ok(s.visitor!.stock.some((i) => s.visitor!.asks[i.uid] <= 20))
})
test('观察不泄露真实隐藏品质、随机状态或议价容忍度', () => {
  const s = createGame()
  const v = seller(s)
  const seen = observe(s)
  assert.equal(seen.visitor!.stock[0].quality, null)
  assert.equal('tolerance' in seen.visitor!, false)
  assert.equal('seed' in seen, false)
  assert.equal(seen.visitor!.stock[0].claim, v.stock[0].claimedQuality)
  assert.ok(
    seen.actions.some((a) => a.action.type === 'buy' && !a.enabled && a.reason),
  )
})
test('单步接口拒绝过期/作弊请求，幂等重放不重复扣款', () => {
  const s = createGame()
  const v = seller(s, [30])
  let persisted: Game | null = null
  const c = new PlayerController(s, {
    save: (next) => {
      persisted = next
    },
  })
  const run = (action: Action, id: string) =>
    c.act({ id, action, token: c.observe().token, reason: '测试正常玩家操作' })
  const old = c.observe().token
  run({ type: 'stage', uid: v.stock[0].uid }, 'request-stage')
  assert.throws(
    () =>
      c.act({
        id: 'request-stale',
        token: old,
        reason: '测试过期',
        action: { type: 'buy', visitorId: v.id },
      }),
    /过期/,
  )
  const req = {
    id: 'request-buy',
    token: c.observe().token,
    reason: '确认收购',
    action: { type: 'buy', visitorId: v.id } as Action,
  }
  c.act(req)
  const cash = c.getState().cash
  assert.equal(c.act(req).status, 'replayed')
  assert.equal(c.getState().cash, cash)
  assert.ok(persisted)
  assert.throws(
    () =>
      c.act({
        id: 'request-cheat',
        token: c.observe().token,
        reason: '非法',
        action: { type: 'addMoney' } as unknown as Action,
      }),
    /未提供/,
  )
})
test('存储写失败不公布新状态，保存的随机与交易状态可继续', () => {
  const s = createGame()
  const v = seller(s, [30])
  const c = new PlayerController(s, {
    save: () => {
      throw new Error('磁盘写入失败')
    },
  })
  const before = c.observe().token
  assert.throws(
    () =>
      c.act({
        id: 'failed-save',
        token: before,
        reason: '暂放来货',
        action: { type: 'stage', uid: v.stock[0].uid },
      }),
    /写入失败/,
  )
  assert.equal(c.observe().token, before)
  assert.deepEqual(c.getState(), s)
})
test('返回的观察与收据不能通过引用修改真实存档，审计记录现金与商品变化', () => {
  const s = createGame()
  const v = seller(s, [30])
  const c = new PlayerController(s, { save: () => {} })
  const before = c.observe().token
  c.observe().bills.push({ day: 7, amount: 120, paid: 120, deferred: false })
  assert.equal(c.observe().token, before)
  assert.equal(c.getState().bills.length, 0)
  c.act({
    id: 'audit-stage-01',
    token: before,
    reason: '暂放来货',
    action: { type: 'stage', uid: v.stock[0].uid },
  })
  const bought = c.act({
    id: 'audit-buy-01',
    token: c.observe().token,
    reason: '确认收购',
    action: { type: 'buy', visitorId: v.id },
  })
  assert.equal(bought.receipt.cashBefore, 650)
  assert.equal(bought.receipt.cashAfter, 620)
  assert.deepEqual(bought.receipt.goods.added, [v.stock[0].uid])
  bought.receipt.goods.added.push('fake')
  assert.equal(c.getState().audit.at(-1)!.goods.added.length, 1)
})
test('旧存档迁移保留现金、未知来货、报价、展示与欠租', () => {
  const old = {
    version: 1,
    cash: 100,
    day: 8,
    progress: 2,
    trades: 37,
    storage: 0,
    shelves: 0,
    debt: 90,
    seed: 42,
    sequence: 100,
    inventory: [
      {
        uid: 'old1',
        productId: 'p0',
        quality: '普通',
        condition: '完好',
        known: true,
        cost: 20,
      },
    ],
    display: ['old1'],
    entries: [],
    visitor: {
      id: 99,
      name: '旧客',
      role: '拾荒者',
      line: '旧报价',
      kind: 'seller',
      category: '机械',
      budget: 0,
      ask: 35,
      item: {
        uid: 'old2',
        productId: 'p12',
        quality: '稀有',
        condition: '磨损',
        known: false,
        cost: 0,
      },
    },
  }
  const s = migrateV1(old)
  assert.ok(validateGame(s))
  assert.equal(s.cash, 100)
  assert.equal(s.inventory[0].area, 'showcase')
  assert.equal(s.visitor!.asks.old2, 35)
  assert.equal(s.visitor!.stock[0].known, false)
  assert.equal(debt(s), 90)
  assert.equal(s.progress, 2)
  assert.equal(s.trades, 37)
})
test('坏档拒绝重复物品、碰撞、幽灵暂放与非法账单', () => {
  const s = createGame()
  assert.equal(
    validateGame({ ...s, inventory: [...s.inventory, { ...s.inventory[0] }] }),
    false,
  )
  assert.equal(validateGame({ ...s, staged: ['ghost'] }), false)
  assert.equal(
    validateGame({
      ...s,
      bills: [{ day: 7, amount: 120, paid: 121, deferred: false }],
    }),
    false,
  )
  const clone = JSON.parse(JSON.stringify(s))
  clone.inventory[2].x = clone.inventory[0].x
  assert.equal(validateGame(clone), false)
})
test('买家预算不按库存实际价值兜底，卖家确实存在高于真值的报价', () => {
  let compared = false,
    overpriced = false
  for (let seed = 1; seed <= 80; seed++) {
    let s = createGame(seed)
    s = step(s, { type: 'dismiss', visitorId: s.visitor!.id })
    const rich = JSON.parse(JSON.stringify(s)) as Game
    rich.inventory[0].productId = 'p17'
    rich.inventory[0].quality = '稀有'
    const a = step(s, { type: 'next' }),
      b = step(rich, { type: 'next' })
    if (a.visitor!.kind === 'buyer') {
      assert.equal(a.visitor!.budget, b.visitor!.budget)
      compared = true
    }
    if (a.visitor!.kind === 'seller')
      overpriced ||= a.visitor!.stock.some(
        (i) => a.visitor!.asks[i.uid] > value(i),
      )
  }
  assert.ok(compared)
  assert.ok(overpriced)
})
test('24项基础价格保留证据映射，占地和估价有统一定义', () => {
  const refs = JSON.parse(
    readFileSync('docs/商品数值对照.json', 'utf8').replace(/^\uFEFF/, ''),
  )
  for (const r of refs.products) {
    const p = product({ productId: r.demoId })
    assert.equal(p.base, r.sourceBase)
    assert.ok(p.width >= 1 && p.height >= 1)
  }
})

function fullWeek(seed: number) {
  const c = new PlayerController(createGame(seed), { save: () => {} })
  let command = 0
  const log: unknown[] = []
  const perform = (action: Action, reason: string) => {
    const result = c.act({
      id: 'week-' + seed + '-' + ++command,
      token: c.observe().token,
      reason,
      action,
    })
    log.push(result.receipt)
  }
  for (let n = 0; n < 6000; n++) {
    const o = c.observe()
    if (o.day >= 8 && o.bills.some((b) => b.day === 7 && b.paid === b.amount))
      return {
        seed,
        commands: command,
        cash: o.cash,
        trades: o.trades,
        day: o.day,
        bills: o.bills,
        log,
      }
    if (o.report) {
      if (o.debt > 0) {
        assert.ok(o.cash >= o.debt, '正常周流程应有足够资金交租')
        perform({ type: 'payRent' }, '在第七日日结账单主动交租')
      } else perform({ type: 'ackDay' }, '确认日结，正常进入下一天')
      continue
    }
    const v = o.visitor
    if (!v) {
      perform({ type: 'next' }, '按铃接待下一位')
      continue
    }
    if (v.kind === 'buyer') {
      const choices = o.inventory
        .filter(
          (i) =>
            i.buyerOffer! > 0 &&
            i.buyerOffer! <= v.budget &&
            i.buyerOffer! >= i.cost!,
        )
        .sort((a, b) => b.buyerOffer! - a.buyerOffer!)
      const item = choices[0]
      if (item && v.remaining > 0) {
        perform({ type: 'stage', uid: item.uid }, '按公开需求和报价挑选商品')
        perform({ type: 'sell', visitorId: v.id }, '确认正常出售')
        continue
      }
    } else {
      const item = v.stock.find(
        (i) =>
          i.sellerAsk! <= i.estimate[0] * 0.85 && i.sellerAsk! <= o.cash - 150,
      )
      if (item) {
        const legal = o.actions.find(
          (a) =>
            a.action.type === 'stage' &&
            'uid' in a.action &&
            a.action.uid === item.uid &&
            a.enabled,
        )
        if (legal) {
          perform(
            { type: 'stage', uid: item.uid },
            '报价低于保守估价，保留房租周转资金',
          )
          perform({ type: 'buy', visitorId: v.id }, '确认收购，物品留在柜台')
          const now = c.observe()
          const move = now.actions.find(
            (a) =>
              a.action.type === 'autoPlace' &&
              'uid' in a.action &&
              a.action.uid === item.uid &&
              a.enabled &&
              a.action.area === 'warehouse',
          )
          if (move) perform(move.action, '把买下的商品整理入仓库')
          continue
        }
      }
    }
    perform(
      { type: 'dismiss', visitorId: v.id },
      '没有合适的后续交易，正常送客',
    )
  }
  throw new Error('六千步内未完成正常一周')
}
test('完整周流程：新局正常买卖35笔、日结、付清首租，不注入资金日期或顾客', () => {
  const reports = [42, 77, 20261114].map(fullWeek)
  mkdirSync('artifacts', { recursive: true })
  writeFileSync(
    'artifacts/full-week-proof.json',
    JSON.stringify(
      {
        scope:
          'Pure rule/controller simulation, no fixtures or state editing after createGame; public observations only',
        reports,
      },
      null,
      2,
    ),
  )
  for (const r of reports) {
    assert.equal(r.trades, 35)
    assert.equal(r.day, 8)
    assert.equal(r.bills[0].paid, 120)
  }
})
