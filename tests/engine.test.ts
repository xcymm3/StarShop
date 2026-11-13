import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createGame,
  transition,
  value,
  validateGame,
  capacity,
  quote,
  type Game,
} from '../src/game/engine'

function seller(s: Game, ask = 10) {
  s.visitor = {
    id: ++s.sequence,
    name: '测试客',
    role: '拾荒者',
    line: '',
    kind: 'seller',
    category: '机械',
    budget: 0,
    ask,
    item: {
      uid: `i${++s.sequence}`,
      productId: 'p0',
      quality: '普通',
      condition: '完好',
      known: false,
      cost: 0,
    },
  }
  return s.visitor.id
}
test('新局可验证且相同种子可复现', () => {
  assert.ok(validateGame(createGame()))
  assert.deepEqual(createGame(42), createGame(42))
})
test('收购原子执行，不足资金和满仓不修改输入', () => {
  const s = createGame()
  const id = seller(s, 9999)
  const original = JSON.stringify(s)
  assert.throws(() => transition(s, { type: 'buy', visitorId: id }), /资金不足/)
  assert.equal(JSON.stringify(s), original)
  seller(s, 1)
  while (s.inventory.length < capacity(s))
    s.inventory.push({ ...s.inventory[0], uid: `extra${s.inventory.length}` })
  assert.throws(
    () => transition(s, { type: 'buy', visitorId: s.visitor!.id }),
    /仓库已满/,
  )
})
test('鉴定付费一次、报价锁定，重放成交不可重复扣款', () => {
  const s = createGame()
  const id = seller(s, 40)
  const identified = transition(s, { type: 'identify', visitorId: id })
  assert.equal(identified.cash, 642)
  assert.equal(identified.visitor!.ask, 40)
  assert.equal(identified.progress, 0)
  assert.throws(() =>
    transition(identified, { type: 'identify', visitorId: id }),
  )
  const bought = transition(identified, { type: 'buy', visitorId: id })
  assert.equal(bought.cash, 602)
  assert.equal(bought.inventory.length, 4)
  assert.throws(() => transition(bought, { type: 'buy', visitorId: id }))
})
test('第五笔跨日，第七日结束交租且缺额成为欠租', () => {
  const s = createGame()
  s.day = 7
  s.progress = 4
  s.cash = 20
  const id = seller(s, 10)
  const next = transition(s, { type: 'buy', visitorId: id })
  assert.equal(next.day, 8)
  assert.equal(next.progress, 0)
  assert.equal(next.cash, 0)
  assert.equal(next.debt, 110)
  const generated = transition(next, { type: 'next' })
  assert.equal(generated.debt, 110)
})
test('清仓回款和拒绝不推进日期，零资金可恢复', () => {
  const s = createGame()
  s.cash = 0
  const old = value(s.inventory[0])
  const next = transition(s, { type: 'clearance', uid: s.inventory[0].uid })
  assert.equal(next.cash, Math.floor(old * 0.45))
  assert.equal(next.trades, 0)
  assert.equal(next.day, 1)
  const declined = transition(next, {
    type: 'decline',
    visitorId: next.visitor!.id,
  })
  assert.equal(declined.progress, 0)
})
test('出售遵守偏好和预算，并移除展示引用', () => {
  const s = createGame()
  const item = s.inventory[0]
  s.visitor = {
    id: 500,
    kind: 'buyer',
    name: '测试',
    role: '船员',
    category: '机械',
    budget: 30,
    line: '',
  }
  assert.equal(quote(s, item), 30)
  const sold = transition(s, { type: 'sell', visitorId: 500, uid: item.uid })
  assert.equal(sold.cash, 680)
  assert.ok(!sold.display.includes(item.uid))
  assert.ok(validateGame(sold))
})
test('展示和扩容不计交易，升级不能透支', () => {
  const s = createGame()
  assert.throws(
    () => transition(s, { type: 'display', uid: 'i3' }),
    /展示位已满/,
  )
  const next = transition(s, { type: 'upgrade', target: 'shelves' })
  assert.equal(next.cash, 510)
  assert.equal(next.trades, 0)
  assert.equal(
    transition(next, { type: 'display', uid: 'i3' }).display.length,
    3,
  )
})
test('存档拒绝重复物品、坏类型和幽灵展示，合法存档往返不变', () => {
  const s = createGame()
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s)
  assert.equal(validateGame({ ...s, cash: -1 }), false)
  assert.equal(
    validateGame({ ...s, inventory: [...s.inventory, s.inventory[0]] }),
    false,
  )
  assert.equal(validateGame({ ...s, display: ['missing'] }), false)
  assert.equal(validateGame({ ...s, visitor: { kind: 'seller' } }), false)
})
test('长程经营不会出现负资金，随机状态可恢复', () => {
  let s = createGame(77)
  for (let i = 0; i < 300; i++) {
    if (!s.visitor) s = transition(s, { type: 'next' })
    const v = s.visitor!
    if (
      v.kind === 'seller' &&
      v.ask! <= s.cash &&
      s.inventory.length < capacity(s)
    )
      s = transition(s, { type: 'buy', visitorId: v.id })
    else if (v.kind === 'buyer' && s.inventory.some((x) => quote(s, x) > 0))
      s = transition(s, {
        type: 'sell',
        visitorId: v.id,
        uid: s.inventory.find((x) => quote(s, x) > 0)!.uid,
      })
    else s = transition(s, { type: 'decline', visitorId: v.id })
    if (s.cash < 20 && s.inventory.length)
      s = transition(s, { type: 'clearance', uid: s.inventory[0].uid })
    assert.ok(validateGame(s))
    assert.ok(s.cash >= 0)
  }
})
