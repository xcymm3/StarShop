import {
  transition,
  validateGame,
  product,
  estimate,
  bounds,
  quote,
  selectedTotal,
  debt,
  level,
  hot,
  type Action,
  type Game,
  type Item,
} from './engine'

export interface Persistence {
  save(state: Game): void
}
export function stateToken(s: Game): string {
  const { audit: _audit, ...business } = s
  const text = JSON.stringify(business)
  let hash = 2166136261
  for (let n = 0; n < text.length; n++)
    hash = Math.imul(hash ^ text.charCodeAt(n), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
export function visibleItem(s: Game, item: Item, owned: boolean) {
  const p = product(item)
  return {
    uid: item.uid,
    name: p.name,
    productId: p.id,
    category: p.category,
    condition: item.condition,
    quality: item.known ? item.quality : null,
    known: item.known,
    claim: owned ? null : item.claimedQuality,
    estimate: estimate(item),
    cost: owned ? item.cost : null,
    width: p.width,
    height: p.height,
    area: owned ? item.area : (s.stagePositions[item.uid]?.area ?? 'customer'),
    x: owned ? item.x : (s.stagePositions[item.uid]?.x ?? null),
    y: owned ? item.y : (s.stagePositions[item.uid]?.y ?? null),
    rotated: owned
      ? item.rotated
      : (s.stagePositions[item.uid]?.rotated ?? false),
    staged: s.staged.includes(item.uid),
    buyerOffer: owned ? quote(s, item) : null,
    sellerAsk:
      !owned && s.visitor
        ? Math.round(s.visitor.asks[item.uid] * s.visitor.priceFactor)
        : null,
  }
}
export function actionOptions(s: Game) {
  const candidates: Action[] = []
  if (s.report)
    candidates.push(
      { type: 'payRent' },
      { type: 'deferRent' },
      { type: 'ackDay' },
    )
  else if (s.job.active)
    for (const category of ['机械', '补给', '遗物', '数据'] as const)
      candidates.push({ type: 'completeJob', category })
  else {
    if (s.visitor) {
      const id = s.visitor.id
      candidates.push(
        { type: 'dismiss', visitorId: id },
        { type: 'bargain', visitorId: id },
        { type: s.visitor.kind === 'seller' ? 'buy' : 'sell', visitorId: id },
      )
      for (const item of [...s.inventory, ...s.visitor.stock])
        candidates.push({
          type: s.staged.includes(item.uid) ? 'unstage' : 'stage',
          uid: item.uid,
        })
    }
    for (const item of [...s.inventory, ...(s.visitor?.stock ?? [])])
      if (!item.known) candidates.push({ type: 'identify', uid: item.uid })
    for (const item of s.inventory) {
      for (const area of ['warehouse', 'counter', 'showcase'] as const)
        candidates.push({ type: 'autoPlace', uid: item.uid, area })
      candidates.push({ type: 'clearance', uid: item.uid })
    }
    candidates.push(
      { type: 'upgrade', target: 'storage' },
      { type: 'upgrade', target: 'shelves' },
      { type: 'payRent' },
      { type: 'startJob' },
    )
  }
  const options = candidates.map((action) => {
    try {
      transition(s, action)
      return { action, enabled: true, reason: '' }
    } catch (e) {
      return { action, enabled: false, reason: (e as Error).message }
    }
  })
  // Do not generate or inspect a hypothetical future customer while observing.
  if (!s.report && !s.job.active)
    options.unshift({
      action: { type: 'next' },
      enabled: !s.visitor,
      reason: s.visitor ? '先送走当前顾客。' : '',
    })
  return options
}
export function observe(s: Game) {
  const v = s.visitor
  return {
    token: stateToken(s),
    day: s.day,
    progress: s.progress,
    cash: s.cash,
    trades: s.trades,
    reputation: s.reputation,
    level: level(s),
    hot: hot(s),
    debt: debt(s),
    notice: s.notice,
    areas: {
      warehouse: bounds(s, 'warehouse'),
      counter: bounds(s, 'counter'),
      showcase: bounds(s, 'showcase'),
    },
    inventory: s.inventory.map((i) => visibleItem(s, i, true)),
    visitor: v
      ? {
          id: v.id,
          name: v.name,
          role: v.role,
          kind: v.kind,
          line: v.line,
          category: v.category,
          budget: v.budget,
          remaining: v.remaining,
          minimumQuality: v.minimumQuality,
          acceptsDamaged: v.acceptsDamaged,
          bargained: v.bargained,
          stock: v.stock.map((i) => visibleItem(s, i, false)),
        }
      : null,
    selectedTotal: selectedTotal(s),
    report: s.report ? { ...s.report } : null,
    bills: s.bills.map((b) => ({ ...b })),
    entries: s.entries.map((e) => ({ ...e })),
    job: s.job.active
      ? { active: true, label: '应急氧气罐', reward: 20 }
      : { active: false },
    actions: actionOptions(s),
    moveSchema: {
      type: 'move',
      uid: '自有且未选入交易的物品ID',
      area: ['warehouse', 'counter', 'showcase'],
      x: '从0开始的整数',
      y: '从0开始的整数',
      rotated: 'boolean；服务器校验边界与碰撞',
    },
  }
}
export interface Request {
  id: string
  token: string
  reason: string
  action: Action
}
export class PlayerController {
  constructor(
    private state: Game,
    private persistence: Persistence,
  ) {
    if (!validateGame(state)) throw new Error('无效存档。')
  }
  getState(): Game {
    return JSON.parse(JSON.stringify(this.state))
  }
  observe() {
    return observe(this.state)
  }
  act(request: Request) {
    if (
      !request ||
      !/^[a-zA-Z0-9_-]{8,80}$/.test(request.id) ||
      !request.reason?.trim()
    )
      throw new Error('操作需唯一请求ID和理由。')
    const prior = this.state.audit.find((a) => a.id === request.id)
    if (prior) {
      if (
        prior.action !== JSON.stringify(request.action) ||
        prior.reason !== request.reason
      )
        throw new Error('请求ID已用于其他操作。')
      return {
        status: 'replayed' as const,
        receipt: JSON.parse(JSON.stringify(prior)),
        observation: this.observe(),
      }
    }
    if (request.token !== stateToken(this.state))
      throw new Error('观察已过期，请重新观察后决定。')
    const allowed = [
      'next',
      'dismiss',
      'identify',
      'stage',
      'unstage',
      'buy',
      'sell',
      'bargain',
      'move',
      'autoPlace',
      'clearance',
      'upgrade',
      'payRent',
      'deferRent',
      'ackDay',
      'startJob',
      'completeJob',
    ]
    if (!request.action || !allowed.includes(request.action.type))
      throw new Error('未提供此玩家操作。')
    const before = this.state
    const next = transition(before, request.action)
    const beforeGoods = [...before.inventory, ...(before.visitor?.stock ?? [])]
    const afterGoods = [...next.inventory, ...(next.visitor?.stock ?? [])]
    const receipt = {
      id: request.id,
      action: JSON.stringify(request.action),
      reason: request.reason,
      day: before.day,
      cashDelta: next.cash - before.cash,
      before: stateToken(before),
      after: stateToken(next),
      cashBefore: before.cash,
      cashAfter: next.cash,
      dayAfter: next.day,
      goods: {
        added: next.inventory
          .filter((i) => !before.inventory.some((b) => b.uid === i.uid))
          .map((i) => i.uid),
        removed: before.inventory
          .filter((i) => !next.inventory.some((n) => n.uid === i.uid))
          .map((i) => i.uid),
        moved: next.inventory
          .filter((i) =>
            before.inventory.some(
              (b) =>
                b.uid === i.uid &&
                (b.area !== i.area ||
                  b.x !== i.x ||
                  b.y !== i.y ||
                  b.rotated !== i.rotated),
            ),
          )
          .map((i) => i.uid),
        identified: afterGoods
          .filter(
            (i) =>
              i.known && beforeGoods.some((b) => b.uid === i.uid && !b.known),
          )
          .map((i) => i.uid),
      },
    }
    next.audit = [...next.audit, receipt].slice(-200)
    this.persistence.save(next) // Commit before publishing state; storage failure leaves the original intact.
    this.state = next
    return {
      status: 'completed' as const,
      receipt: JSON.parse(JSON.stringify(receipt)),
      observation: this.observe(),
    }
  }
}
