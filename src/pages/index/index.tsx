import { useEffect, useRef, useState } from 'react'
import { Image, Text, View, ScrollView } from '@tarojs/components'
import {
  CATEGORIES,
  product,
  bounds,
  usedCells,
  estimate,
  level,
  hot,
  debt,
  selectedTotal,
  tradeRows,
  wholesalePrice,
  displayCategory,
  clearanceValue,
  upgradeCost,
  quote,
  ledgerProfit,
  type Game,
  type Item,
  type Action,
  type Area,
} from '../../game/engine'
import { PlayerController, type Request } from '../../game/interface'
import { load, save as writeSave, restart } from '../../platform/storage'
import {
  itemArt,
  visitorArt,
  portraitRoomArt,
  customerSheet,
  customerCell,
  magnifierArt,
} from '../../assets'
import { GridInventory } from './GridInventory'
import { useInventoryDrag } from './useInventoryDrag'
import { TouchButton as GameButton } from '../../components/TouchButton'
import './index.css'
import './mobile.css'

function save(next: Game) {
  try {
    writeSave(next)
  } catch {
    throw new Error('保存失败，本次操作未提交。请检查存储空间后重试。')
  }
}
type Panel = 'trade' | 'ledger' | 'upgrade' | 'help' | 'inventory' | null
const areaName = {
  warehouse: '仓库',
  counter: '柜台',
  showcase: '展示柜',
  customer: '顾客台面',
}
function Price({ item }: { item: Item }) {
  const range = estimate(item)
  return (
    <Text className="estimate">
      {item.known ? '参考价 ' + range[0] : '估价 ' + range[0] + '～' + range[1]}{' '}
      星币
    </Text>
  )
}
export default function Index() {
  const [initial] = useState(() => {
    try {
      return { game: load(), error: '' }
    } catch (e) {
      return {
        game: null,
        error: (e as Error).message || '存档无法读取，原数据已保留。',
      }
    }
  })
  const controller = useRef<PlayerController | null>(
    initial.game ? new PlayerController(initial.game, { save }) : null,
  )
  const [game, setGame] = useState<Game | null>(initial.game)
  const [error, setError] = useState(initial.error)
  const [panel, setPanel] = useState<Panel>(null)
  const [tradeView, setTradeView] = useState<'quote' | 'stock'>('stock')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [rotated, setRotated] = useState(false)
  const [target, setTarget] = useState<Area>('warehouse')
  const [zoomArea, setZoomArea] = useState<Area>('warehouse')
  const [inventoryView, setInventoryView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState('全部')
  const [receipt, setReceipt] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [saveStatus, setSaveStatus] = useState(
    initial.game?.trades
      ? '已恢复存档 · 未确认的报价不会付款'
      : '已保存 · 随时退出，无离线变化',
  )
  const [warehouseRow, setWarehouseRow] = useState(1)
  const [warehouseAnchor, setWarehouseAnchor] = useState('')
  const [ledgerDay, setLedgerDay] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [confirm, setConfirm] = useState<{
    title: string
    run: () => void
  } | null>(null)
  const sequence = useRef(0)
  const publish = () => {
    setGame(controller.current!.getState())
    setError('')
  }
  const request = (r: Request) => {
    const before = controller.current!.getState()
    const result = controller.current!.act(r)
    publish()
    const after = controller.current!.getState()
    setSaveStatus('已保存 · 随时退出，无离线变化')
    if (['buy', 'sell', 'wholesale', 'clearance'].includes(r.action.type)) {
      const count =
        result.receipt.goods.added.length || result.receipt.goods.removed.length
      const buying = ['buy', 'wholesale'].includes(r.action.type)
      setReceipt(
        (buying ? '已收购 ' : '已出售 ') +
          count +
          ' 件 · ' +
          (buying ? '支出 ' : '到账 ') +
          Math.abs(result.receipt.cashDelta) +
          ' 星币。' +
          (buying
            ? '已付款，货物留在柜台，可收回仓库。'
            : '未被接受的货物仍在柜台。'),
      )
      setShowReceipt(true)
    }
    if (r.action.type === 'ackDay')
      setAnnouncement(
        '第 ' +
          after.day +
          ' 天开店 · 今日热销 ' +
          hot(after) +
          (level(after) > level(before)
            ? ' · 店铺升至 Lv.' + level(after)
            : ''),
      )
    if (level(after) > level(before))
      setAnnouncement('店铺升至 Lv.' + level(after) + ' · 新商品已加入来货')
    if (
      r.action.type === 'payRent' &&
      after.bills.some((b) => b.day === 7 && b.paid === b.amount)
    )
      setAnnouncement('首周目标达成 · 房租已付清，接下来继续经营！')
    if (r.action.type === 'upgrade')
      setAnnouncement(after.notice + ' · 打开放大整理查看新增区域')
    return result
  }
  const apply = (action: Action, reason = '玩家在柜台执行 ' + action.type) => {
    try {
      const c = controller.current
      if (!c) return
      request({
        id: 'ui-' + Date.now() + '-' + ++sequence.current,
        token: c.observe().token,
        reason,
        action,
      })
      return true
    } catch (e) {
      setError((e as Error).message)
      if (/storage|quota|存储|写入|保存/i.test((e as Error).message))
        setSaveStatus('保存失败 · 本次操作未提交，请重试')
      return false
    }
  }
  const drag = useInventoryDrag(game, apply, setError)
  useEffect(() => {
    if (!showReceipt) return
    const timer = setTimeout(() => setShowReceipt(false), 4800)
    return () => clearTimeout(timer)
  }, [showReceipt, receipt])
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    const open =
      !!panel || !!detailId || !!confirm || !!game?.report || !!game?.job.active
    const old = document.body.style.overflowY
    document.body.style.setProperty(
      'overflow-y',
      open ? 'hidden' : 'auto',
      'important',
    )
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !game?.report && !game?.job.active) {
        if (confirm) setConfirm(null)
        else if (detailId) setDetailId(null)
        else setPanel(null)
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.setProperty('overflow-y', old || 'auto', 'important')
      document.removeEventListener('keydown', key)
    }
  }, [panel, detailId, confirm, !!game?.report, !!game?.job.active])
  useEffect(() => {
    if (
      process.env.TARO_ENV !== 'h5' ||
      typeof window === 'undefined' ||
      !controller.current
    )
      return
    const host = window as unknown as {
      starshop?: { observe: () => unknown; act: (r: Request) => unknown }
    }
    host.starshop = {
      observe: () => controller.current!.observe(),
      act: request,
    }
    return () => {
      delete host.starshop
    }
  }, [game])
  const reset = () => {
    try {
      const next = restart()
      controller.current = new PlayerController(next, { save })
      publish()
      setDetailId(null)
      setMoving(null)
      setPanel(null)
      setReceipt('')
      setSaveStatus('已保存 · 新店已开张')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (!game)
    return (
      <View className="game-shell recovery" style={{ maxWidth: '480px' }}>
        <Text className="wordmark">STARSHOP · 存档恢复</Text>
        <Text>{error}</Text>
        <GameButton
          onClick={() => {
            try {
              const next = load()
              controller.current = new PlayerController(next, { save })
              publish()
            } catch (e) {
              setError((e as Error).message)
            }
          }}
        >
          重新读取
        </GameButton>
        <GameButton
          onClick={() =>
            setConfirm({ title: '备份原存档并重新开店？', run: reset })
          }
        >
          备份并重开
        </GameButton>
        {confirm && (
          <View className="modal-backdrop">
            <View className="sheet">
              <Text>{confirm.title}</Text>
              <GameButton
                onClick={() => {
                  setConfirm(null)
                  confirm.run()
                }}
              >
                确认重开
              </GameButton>
              <GameButton onClick={() => setConfirm(null)}>取消</GameButton>
            </View>
          </View>
        )}
      </View>
    )

  const v = game.visitor
  const detail =
    game.inventory.find((i) => i.uid === detailId) ??
    v?.stock.find((i) => i.uid === detailId)
  const detailOwned =
    !!detail && game.inventory.some((i) => i.uid === detail.uid)
  const movingItem = game.inventory.find((i) => i.uid === moving) ?? null
  const draggedItem = [...game.inventory, ...(v?.stock ?? [])].find(
    (i) => i.uid === drag.view?.uid,
  )
  const rows = tradeRows(game)
  const ledgerEntries = game.entries.filter(
    (e) => !ledgerDay || e.day === ledgerDay,
  )
  const ledgerMargin = ledgerProfit(ledgerEntries)
  const inventoryItems = [
    ...game.inventory,
    ...(v?.stock ?? []).map((i) => ({ ...i, ...game.stagePositions[i.uid] })),
  ].filter(
    (i) =>
      i.area === zoomArea &&
      (filter === '全部' ||
        (filter === '符合顾客' && quote(game, i) > 0) ||
        (filter === '已鉴定' && i.known) ||
        (filter === '未鉴定' && !i.known) ||
        product(i).category === filter),
  )
  const shown = game.inventory.filter((i) => i.area === 'showcase')
  const total = selectedTotal(game)
  const originalQuote = rows
    .filter((row) => row.accepted)
    .reduce(
      (sum, row) =>
        sum +
        (v?.kind === 'seller'
          ? v.asks[row.item.uid]
          : v
            ? quote({ ...game, visitor: { ...v, priceFactor: 1 } }, row.item)
            : 0),
      0,
    )
  const canTrade =
    !!v &&
    total > 0 &&
    (v.kind === 'seller' ? total <= game.cash : total <= v.budget)
  const tradeProblem =
    rows.length && !canTrade
      ? total === 0
        ? '没有可成交货物，请看逐件说明'
        : v?.kind === 'seller'
          ? '现金不足，还差' + (total - game.cash) + '星币'
          : '超过预算' + (total - (v?.budget ?? 0)) + '星币，请撤下一件'
      : ''
  const doMove = (area: Area, x: number, y: number) => {
    if (
      movingItem &&
      apply(
        { type: 'move', uid: movingItem.uid, area, x, y, rotated },
        '将自有商品放置到选定格子',
      )
    )
      setMoving(null)
  }
  const inspect = (item: Item) => {
    setDetailId(item.uid)
    setError('')
  }
  const select = (item: Item) => {
    const result = apply(
      {
        type: game.staged.includes(item.uid) ? 'unstage' : 'stage',
        uid: item.uid,
      },
      '挑选或撤下本次交易商品',
    )
    if (result) setTradeView('quote')
    return result
  }
  const openPanel = (p: Panel) => {
    setPanel(p)
    if (p === 'trade') setTradeView(rows.length ? 'quote' : 'stock')
    setMoving(null)
    setError('')
  }
  const openInventory = (area: Area) => {
    setZoomArea(area)
    setInventoryView('grid')
    setFilter('全部')
    setPanel('inventory')
    setError('')
  }
  const dismiss = () => {
    if (!v) return
    const leave = () => {
      if (
        apply(
          { type: 'dismiss', visitorId: v.id },
          '结束接待，顾客带走未付款来货',
        )
      )
        setPanel(null)
    }
    if (game.staged.length || (v.kind === 'seller' && v.stock.length))
      setConfirm({
        title: '送别 ' + v.name + '？未付款来货将被带走；自有货物仍然保留。',
        run: leave,
      })
    else leave()
  }
  const afterTrade = () => {
    if (!v) return
    if (
      apply(
        { type: v.kind === 'seller' ? 'buy' : 'sell', visitorId: v.id },
        '核对商品合计与所有权后确认交易',
      )
    )
      setPanel(null)
  }
  const grid = (area: Area, compact = true) => (
    <GridInventory
      game={game}
      area={area}
      compact={compact}
      fill
      drag={drag}
      selected={movingItem && target === area ? movingItem : null}
      rotated={rotated}
      onItem={(item) => inspect(item)}
      onCell={(x, y) => doMove(area, x, y)}
    />
  )
  const bill = game.bills.find((b) => b.day === game.day)
  const modal =
    !!panel || !!detail || !!game.report || game.job.active || !!confirm

  return (
    <View
      className={'game-shell' + (game.staged.length ? ' has-staged' : '')}
      style={{ maxWidth: '480px' }}
    >
      <View
        style={{ fontSize: '16px' }}
        className="store-scene shop-stage"
        aria-label="店铺柜台"
        aria-hidden={modal}
      >
        <Image
          className="room-sprite"
          src={portraitRoomArt}
          mode="scaleToFill"
        />
        <View className="date-display">
          <Text className="day-number">第{game.day}天</Text>
          <Text className="rent-line">
            {debt(game)
              ? '待付房租 ' + debt(game)
              : '距交租' + (7 - ((game.day - 1) % 7)) + '天'}
          </Text>
          <Text className="progress-line">
            成交 {game.progress}/5 · 租金120
          </Text>
        </View>
        <GameButton
          className="cash-display"
          aria-label="查看现金账本"
          onClick={() => openPanel('ledger')}
        >
          <Text
            className="cash"
            style={
              game.cash >= 10000
                ? { fontSize: game.cash >= 100000 ? '16px' : '18px' }
                : undefined
            }
          >
            {game.cash}
          </Text>
          <Text className="cash-unit">星币</Text>
        </GameButton>
        <GameButton
          className="station-sign"
          aria-label="打开升级"
          onClick={() => openPanel('upgrade')}
        >
          <Text>远星杂货</Text>
          <Text className="sign-sub">
            Lv.{level(game)} · 声望{game.reputation}
          </Text>
        </GameButton>

        <View className="display-case">
          <View className="scene-label">
            <Text>展示柜</Text>
            <Text className="showcase-count">{shown.length}件</Text>
          </View>
          <ScrollView
            className="showcase-scroll inventory-viewport"
            data-area="showcase"
            scrollY={!drag.scrollLock}
          >
            <View
              className="showcase-content"
              style={{
                height:
                  Math.max(1, bounds(game, 'showcase').height / 3) * 100 + '%',
              }}
            >
              {grid('showcase')}
            </View>
          </ScrollView>
          <Text className="display-prediction">
            引导 {displayCategory(game) ?? '未布置'}
          </Text>
          <GameButton
            className="showcase-zoom"
            aria-label="放大展示柜"
            onClick={() => openInventory('showcase')}
          >
            放大整理
          </GameButton>
        </View>

        {v ? (
          <View className="visitor-window">
            <Image
              className={
                'visitor-sprite ' +
                (customerSheet ? 'atlas-visitor' : 'single-visitor')
              }
              src={customerSheet || visitorArt[v.role]}
              mode="scaleToFill"
              aria-label={v.role}
              style={
                customerSheet
                  ? {
                      left: -(customerCell[v.role] % 2) * 100 + '%',
                      top: -Math.floor(customerCell[v.role] / 2) * 100 + '%',
                    }
                  : {}
              }
            />
          </View>
        ) : (
          <Text className="closed-label">等待下一位来客</Text>
        )}

        {!movingItem && (
          <GameButton
            className="dialogue-strip"
            aria-label="查看当前顾客"
            onClick={() =>
              v
                ? openPanel('trade')
                : apply({ type: 'next' }, '按铃接待下一位顾客')
            }
          >
            <Text className="client-name">
              {v ? v.name + ' · ' + v.role : '柜台空闲'}
            </Text>
            <Text className="visitor-direction">
              {v
                ? v.kind === 'seller'
                  ? '来卖货 · 待购 ' + v.stock.length + ' 件'
                  : v.remaining === 0
                    ? '已买够 · 可以送客'
                    : '来买货 · 求购' + v.category
                : '按铃开始接待'}
            </Text>
            <Text className="dialogue-line">
              {v
                ? v.kind === 'buyer'
                  ? '预算 ' + v.budget + ' 星币 · 还买 ' + v.remaining + ' 件'
                  : '点来货可检视，也可整批核价'
                : '自有货物可以随时整理'}
            </Text>
            <Text className="dialogue-more">
              {v ? '查看对白与需求 ›' : '下一位来客 ›'}
            </Text>
          </GameButton>
        )}
        <GameButton
          className="intercom-key"
          aria-label="打开手册"
          onClick={() => openPanel('help')}
        >
          ?
        </GameButton>

        {v?.kind === 'seller' && (
          <View className="customer-counter">
            <Text className="customer-counter-label">
              来货 {v.stock.length} 件 · 未付款
            </Text>
            {grid('customer')}
            <GameButton
              className="customer-zoom"
              aria-label="放大顾客来货"
              onClick={() => openInventory('customer')}
            >
              挑选来货 ›
            </GameButton>
            {v.stock.every((i) => !!game.stagePositions[i.uid]) && (
              <Text className="customer-empty">
                {v.stock.length
                  ? '来货已放上柜台，尚未付款'
                  : '这批货已收完，可送客'}
              </Text>
            )}
          </View>
        )}
        <View className="counter-title">
          <Text>交易柜台</Text>
        </View>
        <View className="counter-console">
          <View
            className="counter-plane"
            style={{
              transform: 'none',
            }}
          >
            {grid('counter')}
          </View>
        </View>

        <GameButton
          className="collect-key"
          aria-label="收回柜台自有货物"
          onClick={() =>
            apply(
              { type: 'collectCounter' },
              '将柜台自有货物收回仓库，放不下的留台',
            )
          }
        >
          收回仓库
        </GameButton>
        <View className="console-actions">
          <GameButton
            className="console-key call-key"
            aria-label={v ? '交易平板' : '按铃接客'}
            onClick={() =>
              v
                ? openPanel('trade')
                : apply({ type: 'next' }, '按铃接待下一位顾客')
            }
          >
            {v ? '核价' : '接客'}
          </GameButton>
          <GameButton
            className="console-key dismiss-key"
            aria-label="送客"
            disabled={!v}
            onClick={dismiss}
          >
            送客
          </GameButton>
          <GameButton
            className="console-key ledger-key"
            aria-label="打开账本"
            onClick={() => openPanel('ledger')}
          >
            账本
          </GameButton>
        </View>

        {v && game.staged.length > 0 && !panel && (
          <View className="deal-strip">
            <Text>
              {v.kind === 'seller' ? '待购' : '待售'}
              {game.staged.length}件 · {total} 星币 · 点核价确认
            </Text>
          </View>
        )}

        <View className="warehouse-panel">
          <View className="warehouse-heading">
            <Text>仓库</Text>
            <GameButton
              aria-label="放大仓库"
              className="warehouse-zoom"
              onClick={() => openInventory('warehouse')}
            >
              放大整理 ›
            </GameButton>
          </View>
          <ScrollView
            className="warehouse-scroll inventory-viewport"
            data-area="warehouse"
            scrollIntoView={warehouseAnchor || undefined}
            onScroll={(e) => {
              setWarehouseRow(
                Math.floor(
                  e.detail.scrollTop /
                    (e.detail.scrollHeight / bounds(game, 'warehouse').height),
                ) + 1,
              )
            }}
            scrollY={!drag.scrollLock}
          >
            <View
              className="warehouse-content"
              style={{
                height:
                  Math.max(1, bounds(game, 'warehouse').height / 6) * 100 + '%',
              }}
            >
              <View
                id="warehouse-top-anchor"
                style={{ position: 'absolute', top: 0, left: 0, height: '1px' }}
              />
              {grid('warehouse')}
            </View>
          </ScrollView>
          <View className="warehouse-meter">
            <Text>
              库存 {usedCells(game, 'warehouse')}/
              {bounds(game, 'warehouse').width *
                bounds(game, 'warehouse').height}{' '}
              格
            </Text>
            <GameButton
              className="warehouse-position"
              onClick={() => {
                setWarehouseAnchor('warehouse-top-anchor')
                setTimeout(() => setWarehouseAnchor(''), 100)
              }}
            >
              第{warehouseRow || 1}/{bounds(game, 'warehouse').height}行 ↑ 顶部
            </GameButton>
          </View>
        </View>

        {drag.view && draggedItem && (
          <View
            className="drag-ghost"
            style={{
              position: 'fixed',
              left: drag.view.x + 12 + 'px',
              top: drag.view.y + 12 + 'px',
              width: Math.min(120, drag.view.width) + 'px',
              height: Math.min(120, drag.view.height) + 'px',
            }}
          >
            <Image src={itemArt[draggedItem.productId]} mode="aspectFit" />
            <Text>{drag.view.message}</Text>
          </View>
        )}
        {movingItem && (
          <View className="placement-tools">
            <Text>整理 · {product(movingItem).name}</Text>
            <View className="toolbar">
              {(['warehouse', 'counter', 'showcase'] as Area[]).map((area) => (
                <GameButton
                  key={area}
                  className={target === area ? 'selected' : ''}
                  onClick={() => setTarget(area)}
                >
                  {areaName[area]}
                </GameButton>
              ))}
              <GameButton onClick={() => setRotated(!rotated)}>
                旋转 {rotated ? '90°' : '0°'}
              </GameButton>
            </View>
            <View className="toolbar">
              <GameButton
                className="primary"
                onClick={() => {
                  if (
                    apply(
                      {
                        type: 'autoPlace',
                        uid: movingItem.uid,
                        area: target,
                        rotated,
                      },
                      '寻找完整空位放置自有物品',
                    )
                  )
                    setMoving(null)
                }}
              >
                按当前方向找位
              </GameButton>
              <GameButton onClick={() => setMoving(null)}>取消整理</GameButton>
            </View>
            <Text className="muted">
              先选目标区域，再点空格放置。也可打开放大整理，格子更好点。
            </Text>
          </View>
        )}

        {game.cash < 5 && !game.inventory.length && !game.report && (
          <GameButton
            className="relief-button"
            onClick={() =>
              apply({ type: 'startJob' }, '接取港口理货委托，以劳动恢复周转')
            }
          >
            承接应急理货 · 报酬20
          </GameButton>
        )}
        {error && !modal && (
          <View className="error" role="alert">
            <Text>{error}</Text>
            <GameButton onClick={() => setError('')}>关闭</GameButton>
          </View>
        )}
      </View>

      <View className="shop-journal">
        <View className="journal-heading">
          <Text>港口营业日志</Text>
          <Text>今日热销 · {hot(game)}</Text>
        </View>
        <Text className="live-notice" {...{ role: 'status' }}>
          {game.notice}
        </Text>
        <Text className="week-goal">
          {game.bills.some((b) => b.day === 7 && b.paid === b.amount)
            ? '首周目标已达成 · 继续经营你的商店'
            : '首周目标 · 完成35笔交易并付清120星币房租'}
        </Text>
        <Text className="rent-reserve">
          本周租金120 · 可用现金{game.cash} ·{' '}
          {game.cash >= 120
            ? '租金已够，余款' + (game.cash - 120)
            : '距租金还差' + (120 - game.cash)}
          星币
        </Text>
        {receipt && (
          <Text className="latest-receipt" {...{ role: 'status' }}>
            {receipt}
          </Text>
        )}
        <Text className="save-note" {...{ role: 'status' }}>
          {saveStatus}
        </Text>
      </View>
      {showReceipt && !panel && !detail && !game.report && (
        <View className="receipt-toast" role="status">
          <Text>{receipt.split('。')[0]}。</Text>
        </View>
      )}
      {announcement && (
        <View className="announcement" role="status">
          <Text>{announcement}</Text>
          <GameButton
            aria-label="收起营业提示"
            onClick={() => setAnnouncement('')}
          >
            知道了
          </GameButton>
        </View>
      )}
      {panel && !detail && !game.report && !game.job.active && (
        <View
          className={
            'modal-backdrop ' + (panel === 'trade' ? 'trading-backdrop' : '')
          }
        >
          <View
            {...{ role: 'dialog', 'aria-modal': true }}
            className={
              'sheet ' +
              (panel === 'help' ? 'metal-sheet' : 'paper-sheet') +
              (panel === 'inventory' ? ' inventory-sheet' : '')
            }
            style={
              panel === 'trade'
                ? {
                    fontSize: '16px',
                    height: !v
                      ? 'auto'
                      : 450 +
                        Math.min(
                          rows.length +
                            (v?.kind === 'seller'
                              ? v.stock.length
                              : v?.remaining === 0
                                ? 0
                                : game.inventory.length),
                          5,
                        ) *
                          70 +
                        'px',
                  }
                : undefined
            }
          >
            <View className="sheet-heading">
              <Text>
                {panel === 'trade'
                  ? '交易平板'
                  : panel === 'ledger'
                    ? '店长账本'
                    : panel === 'upgrade'
                      ? '设备升级'
                      : panel === 'inventory'
                        ? areaName[zoomArea] + ' · 放大整理'
                        : '店长手册'}
              </Text>
              <GameButton
                aria-label="关闭工具面板"
                onClick={() => setPanel(null)}
              >
                关闭
              </GameButton>
            </View>
            {panel === 'trade' && v && (
              <>
                <View className="trade-summary">
                  <View className="visitor-heading">
                    <Text>
                      {v.name} · {v.role}
                    </Text>
                    <Text className="direction-tag">
                      {v.kind === 'seller'
                        ? '来卖货'
                        : v.remaining === 0
                          ? '已买够'
                          : '来买货'}
                    </Text>
                  </View>
                  <Text className="budget-pinned">
                    {v.kind === 'buyer'
                      ? '求购' +
                        v.category +
                        ' · 剩余预算 ' +
                        v.budget +
                        ' 星币 · 还买 ' +
                        v.remaining +
                        ' 件'
                      : '可用现金 ' +
                        game.cash +
                        ' 星币 · 来货 ' +
                        v.stock.length +
                        ' 件'}
                  </Text>
                  {v.kind === 'seller' &&
                    v.stock.length > 0 &&
                    tradeView === 'stock' && (
                      <View className="wholesale-offer">
                        <Text>
                          整批{v.stock.length}件 · 优惠
                          {v.wholesaleDiscount ?? 15}% · 实付
                          {wholesalePrice(game)}星币
                        </Text>
                        <GameButton
                          aria-label="整批收购"
                          disabled={game.cash < wholesalePrice(game)}
                          onClick={() =>
                            setConfirm({
                              title:
                                '以 ' +
                                wholesalePrice(game) +
                                ' 星币收购全部 ' +
                                v.stock.length +
                                ' 件？已付款货物留在柜台。',
                              run: () => {
                                if (
                                  apply(
                                    { type: 'wholesale', visitorId: v.id },
                                    '确认整批价格后收购',
                                  )
                                )
                                  setPanel(null)
                              },
                            })
                          }
                        >
                          整批收购
                        </GameButton>
                      </View>
                    )}
                </View>
                <View className="trade-tabs">
                  <GameButton
                    className={tradeView === 'quote' ? 'selected' : ''}
                    onClick={() => setTradeView('quote')}
                  >
                    柜台报价 · {rows.length}
                  </GameButton>
                  <GameButton
                    className={tradeView === 'stock' ? 'selected' : ''}
                    onClick={() => setTradeView('stock')}
                  >
                    挑选货物
                  </GameButton>
                </View>
                <ScrollView key={tradeView} className="trade-scroll" scrollY>
                  {v.kind === 'buyer' && (
                    <Text className="demand">
                      {v.minimumQuality}起 ·{' '}
                      {v.acceptsDamaged ? '接受损坏' : '不收损坏'}
                      {v.variety ? ' · 同种限一件' : ''}
                    </Text>
                  )}
                  {tradeView === 'quote' && (
                    <>
                      {!rows.length && (
                        <Text className="empty-copy">
                          柜台还没有报价物品，点“挑选货物”开始。
                        </Text>
                      )}
                      {rows.length > 0 && (
                        <Text className="section-title">
                          柜台报价 · {rows.length}件
                        </Text>
                      )}
                      {v.kind === 'buyer' && v.remaining === 0 && (
                        <Text className="empty-copy">
                          这位顾客已经买够了，可以送客。
                        </Text>
                      )}
                      <View className="offer-list">
                        {rows.map(({ item, price, reason, accepted }) => (
                          <View
                            className={
                              'offer-row ' + (accepted ? 'selected' : 'refused')
                            }
                            key={item.uid}
                          >
                            <Image
                              src={itemArt[item.productId]}
                              mode="aspectFit"
                              className="offer-art"
                            />
                            <View className="offer-copy">
                              <Text className="item-name">
                                {product(item).name}
                              </Text>
                              <Text>
                                {reason ||
                                  (v.kind === 'seller'
                                    ? '待购 · 尚未付款'
                                    : '可出售')}
                              </Text>
                            </View>
                            <View className="offer-controls">
                              <Text className="offer-price">
                                {accepted ? price + '星币' : '不收'}
                              </Text>
                              <GameButton
                                aria-label={'撤下 ' + item.uid}
                                onClick={() => select(item)}
                              >
                                撤下
                              </GameButton>
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {tradeView === 'stock' && (
                    <>
                      {v.kind === 'seller' && v.stock.length > 0 && (
                        <>
                          <Text className="section-title">
                            挑选来货 · 移动不付款
                          </Text>
                          <View className="stock-list">
                            {v.stock.map((item) => (
                              <View className="stock-row" key={item.uid}>
                                <Image
                                  src={itemArt[item.productId]}
                                  mode="aspectFit"
                                  className="offer-art"
                                />
                                <View className="offer-copy">
                                  <Text className="item-name">
                                    {product(item).name}
                                  </Text>
                                  <Text>
                                    {item.condition} · 要价
                                    {Math.max(
                                      1,
                                      Math.round(
                                        v.asks[item.uid] * v.priceFactor,
                                      ),
                                    )}
                                    星币
                                  </Text>
                                </View>
                                <GameButton
                                  aria-label={'挑选 ' + item.uid}
                                  onClick={() => select(item)}
                                >
                                  {game.staged.includes(item.uid)
                                    ? '撤回'
                                    : '上柜台'}
                                </GameButton>
                              </View>
                            ))}
                          </View>
                        </>
                      )}
                      {v.kind === 'buyer' && v.remaining > 0 && (
                        <>
                          <Text className="section-title">
                            自有库存 · 可售优先
                          </Text>
                          <View className="stock-list">
                            {[...game.inventory]
                              .sort((a, b) => quote(game, b) - quote(game, a))
                              .filter((i) => !game.staged.includes(i.uid))
                              .map((item) => (
                                <View className="stock-row" key={item.uid}>
                                  <Image
                                    src={itemArt[item.productId]}
                                    mode="aspectFit"
                                    className="offer-art"
                                  />
                                  <View className="offer-copy">
                                    <Text className="item-name">
                                      {product(item).name}
                                    </Text>
                                    <Text>
                                      {quote(game, item) > 0
                                        ? '报价' + quote(game, item) + '星币'
                                        : '不符合当前需求'}{' '}
                                      · 成本{item.cost}
                                    </Text>
                                  </View>
                                  <GameButton
                                    disabled={quote(game, item) <= 0}
                                    aria-label={'报价 ' + item.uid}
                                    onClick={() => select(item)}
                                  >
                                    上柜台
                                  </GameButton>
                                </View>
                              ))}
                          </View>
                        </>
                      )}
                    </>
                  )}
                  <Text className="customer-full-dialogue">“{v.line}”</Text>
                  {game.staged.length > 0 && !canTrade && (
                    <Text className="inline-error" {...{ role: 'alert' }}>
                      {v.kind === 'seller'
                        ? '现金不足，请撤下部分来货。'
                        : total > v.budget
                          ? '合计超过剩余预算，请从柜台拖回一件或撤下。'
                          : '没有符合需求的台面货物，请查看逐件拒收原因。'}
                    </Text>
                  )}
                  <GameButton className="wide" onClick={() => setPanel(null)}>
                    返回柜台搬货
                  </GameButton>
                </ScrollView>
                <View className="trade-footer">
                  <View className="quote-total">
                    <Text>
                      符合需求{rows.filter((r) => r.accepted).length}/
                      {rows.length}件
                    </Text>
                    <Text className="total-amount">{total} 星币</Text>
                  </View>
                  <View className="toolbar">
                    <GameButton
                      disabled={
                        !game.staged.length ||
                        v.bargained ||
                        (v.remaining === 0 && v.kind === 'buyer')
                      }
                      onClick={() =>
                        apply(
                          { type: 'bargain', visitorId: v.id },
                          '提出一次10%还价',
                        )
                      }
                    >
                      {v.bargained
                        ? '已还价'
                        : v.kind === 'seller'
                          ? '还价 −10%'
                          : '还价 +10%'}
                    </GameButton>
                    <GameButton
                      className="primary"
                      disabled={!canTrade}
                      onClick={afterTrade}
                    >
                      {v.kind === 'seller' ? '确认收购' : '确认出售'}
                    </GameButton>
                  </View>
                  {v.bargained && (
                    <Text className="bargain-feedback" {...{ role: 'status' }}>
                      {total
                        ? v.priceFactor === 1
                          ? '还价被拒 · 保持' + total + '星币'
                          : (v.kind === 'seller' ? '已降价10%' : '已加价10%') +
                            ' · ' +
                            originalQuote +
                            ' → ' +
                            total +
                            '星币'
                        : '本客还价已使用'}
                    </Text>
                  )}
                  <Text
                    className={
                      'footer-hint' + (tradeProblem ? ' is-problem' : '')
                    }
                  >
                    {tradeProblem ||
                      (v.kind === 'seller'
                        ? '确认后才付款 · 已购货留在柜台'
                        : '只出售被接受的货物 · 拒收货留台')}
                  </Text>
                </View>
              </>
            )}
            {panel === 'trade' && !v && (
              <View className="empty-trade">
                <Text className="body-copy">{game.notice}</Text>
                <GameButton
                  className="primary wide"
                  onClick={() => apply({ type: 'next' }, '接待下一位顾客')}
                >
                  按铃接客
                </GameButton>
              </View>
            )}
            {panel === 'inventory' && (
              <>
                <View className="inventory-tabs">
                  {(
                    [
                      'warehouse',
                      'showcase',
                      'counter',
                      ...(v?.kind === 'seller' ? ['customer'] : []),
                    ] as Area[]
                  ).map((area) => (
                    <GameButton
                      className={zoomArea === area ? 'selected' : ''}
                      key={area}
                      onClick={() => {
                        setZoomArea(area)
                        setTarget(area)
                      }}
                    >
                      {area === 'customer' ? '来货' : areaName[area]}
                    </GameButton>
                  ))}
                </View>
                {!movingItem && (
                  <View className="inventory-view-tabs">
                    <GameButton
                      className={inventoryView === 'grid' ? 'selected' : ''}
                      onClick={() => setInventoryView('grid')}
                    >
                      格子摆放
                    </GameButton>
                    <GameButton
                      className={inventoryView === 'list' ? 'selected' : ''}
                      onClick={() => setInventoryView('list')}
                    >
                      商品清单
                    </GameButton>
                  </View>
                )}
                <Text className="zoom-instruction">
                  {movingItem
                    ? '已选 ' + product(movingItem).name + ' · 点空格放置'
                    : '点商品检视；点“整理此物”选择摆放位置'}
                </Text>
                {movingItem && (
                  <View className="zoom-tools">
                    <Text>方向 {rotated ? '90°' : '0°'}</Text>
                    <GameButton onClick={() => setRotated(!rotated)}>
                      旋转
                    </GameButton>
                    <GameButton onClick={() => setMoving(null)}>
                      取消整理
                    </GameButton>
                    <GameButton
                      disabled={zoomArea === 'customer'}
                      onClick={() => {
                        if (
                          apply(
                            {
                              type: 'autoPlace',
                              uid: movingItem.uid,
                              area: zoomArea,
                              rotated,
                            },
                            '按当前方向找完整空位',
                          )
                        )
                          setMoving(null)
                      }}
                    >
                      找空位
                    </GameButton>
                  </View>
                )}
                {inventoryView === 'grid' && (
                  <>
                    <ScrollView className="zoom-grid-scroll" scrollX scrollY>
                      <View
                        className="zoom-grid"
                        style={{
                          width: bounds(game, zoomArea).width * 44 + 'px',
                          height: bounds(game, zoomArea).height * 44 + 'px',
                        }}
                      >
                        <GridInventory
                          game={game}
                          area={zoomArea}
                          fill
                          compact
                          selected={movingItem}
                          rotated={rotated}
                          onItem={(item) => inspect(item)}
                          onCell={(x, y) => doMove(zoomArea, x, y)}
                        />
                      </View>
                    </ScrollView>
                    <Text className="grid-pan-hint">
                      {bounds(game, zoomArea).width}列 ×{' '}
                      {bounds(game, zoomArea).height}行 · 每格44px ·
                      可向四周滑动查看
                    </Text>
                  </>
                )}
                {inventoryView === 'list' && (
                  <>
                    <View className="inventory-filters">
                      {[
                        '全部',
                        '符合顾客',
                        '已鉴定',
                        '未鉴定',
                        ...CATEGORIES,
                      ].map((label) => (
                        <GameButton
                          key={label}
                          className={filter === label ? 'selected' : ''}
                          onClick={() => setFilter(label)}
                        >
                          {label}
                        </GameButton>
                      ))}
                    </View>
                    <ScrollView className="inventory-list" scrollY>
                      {!inventoryItems.length && (
                        <Text className="empty-copy">
                          当前没有符合筛选的货物，试试“全部”。
                        </Text>
                      )}
                      {inventoryItems.map((i) => (
                        <GameButton
                          className="inventory-list-row"
                          key={i.uid}
                          aria-label={'检视 ' + i.uid}
                          onClick={() => inspect(i)}
                        >
                          <Image src={itemArt[i.productId]} mode="aspectFit" />
                          <View>
                            <Text>
                              {product(i).name} · {i.condition}
                            </Text>
                            <Text>
                              {i.known ? i.quality : '品质未知'} ·{' '}
                              {!game.inventory.some(
                                (owned) => owned.uid === i.uid,
                              )
                                ? '待购'
                                : '成本' + i.cost + '星币'}{' '}
                              · {i.x + 1}列{i.y + 1}行
                            </Text>
                          </View>
                        </GameButton>
                      ))}
                    </ScrollView>
                  </>
                )}
                <Text className="display-explainer">
                  {zoomArea === 'showcase'
                    ? '展示引导：' +
                      (displayCategory(game) ?? '未布置') +
                      '。只影响后续客流，不会自动出售。'
                    : '货物占地和归属保持不变；移动不会自动成交。'}
                </Text>
                {error && <Text className="inline-error">{error}</Text>}
              </>
            )}
            {panel === 'ledger' && (
              <>
                <View className="paper-stats">
                  <Text>现金 {game.cash}</Text>
                  <Text>
                    声望 {game.reputation} · 等级 {level(game)}
                  </Text>
                  <Text>累计成交 {game.trades} 笔</Text>
                </View>
                <Text className="section-title">租赁账单 · 每周120</Text>
                {game.bills.length ? (
                  game.bills.map((b) => (
                    <View className="bill-row" key={b.day}>
                      <Text>第{b.day}日到期</Text>
                      <Text>
                        {b.paid === b.amount
                          ? '已付清'
                          : b.deferred
                            ? '延期中'
                            : '待付款'}{' '}
                        {b.paid}/{b.amount}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className="body-copy">首张账单于第7日结束生成。</Text>
                )}
                {debt(game) > 0 && (
                  <GameButton
                    className="primary wide"
                    disabled={!game.cash}
                    onClick={() =>
                      apply({ type: 'payRent' }, '主动支付账本中的到期房租')
                    }
                  >
                    支付房租 · {Math.min(debt(game), game.cash)}星币
                  </GameButton>
                )}
                <Text className="section-title">按日流水</Text>
                <View className="ledger-days">
                  {[...new Set(game.entries.map((e) => e.day))].map((day) => (
                    <GameButton
                      key={day}
                      className={ledgerDay === day ? 'selected' : ''}
                      onClick={() =>
                        setLedgerDay(ledgerDay === day ? null : day)
                      }
                    >
                      第{day}天
                    </GameButton>
                  ))}
                </View>
                <View className="ledger-summary">
                  <Text>
                    {ledgerDay ? '第' + ledgerDay + '天' : '全部记录'} · 收入
                    {ledgerEntries
                      .filter((e) => e.delta > 0)
                      .reduce((sum, e) => sum + e.delta, 0)}{' '}
                    · 支出
                    {ledgerEntries
                      .filter((e) => e.delta < 0)
                      .reduce((sum, e) => sum - e.delta, 0)}{' '}
                    星币
                  </Text>
                  <Text>
                    毛利{' '}
                    {ledgerMargin === null
                      ? '—（旧记录缺少成本）'
                      : ledgerMargin + ' 星币'}
                  </Text>
                </View>
                {ledgerEntries.map((e) => (
                  <View className="entry" key={e.id}>
                    <View>
                      <Text>{e.text}</Text>
                      <Text className="muted">
                        第{e.day}天 · {e.kind}
                      </Text>
                    </View>
                    <Text>
                      {e.delta > 0 ? '+' : ''}
                      {e.delta}
                    </Text>
                  </View>
                ))}
              </>
            )}
            {panel === 'upgrade' && (
              <>
                <Text className="body-copy">
                  当前 Lv.{level(game)} · 声望 {game.reputation} · 成交
                  {game.trades}笔
                </Text>
                {game.entries[0]?.kind === '升级' && (
                  <Text className="upgrade-feedback">
                    {game.entries[0].text} · 现有货物位置保持不变
                  </Text>
                )}
                <View className="level-requirements">
                  <Text>二级：15笔成交 + 声望45</Text>
                  <Text>三级：40笔成交 + 声望55</Text>
                </View>
                {(['storage', 'shelves'] as const).map((target) => (
                  <View className="upgrade-row" key={target}>
                    <Text className="section-title">
                      {target === 'storage' ? '仓库扩容' : '展示柜扩容'} ·{' '}
                      {game[target]}/5
                    </Text>
                    <Text>
                      {target === 'storage'
                        ? '增加3行，共24格'
                        : '增加1行，共4格'}
                      。当前
                      {target === 'storage'
                        ? bounds(game, 'warehouse').width *
                          bounds(game, 'warehouse').height
                        : bounds(game, 'showcase').width *
                          bounds(game, 'showcase').height}
                      格 →{' '}
                      {target === 'storage'
                        ? bounds(game, 'warehouse').width *
                            bounds(game, 'warehouse').height +
                          24
                        : bounds(game, 'showcase').width *
                            bounds(game, 'showcase').height +
                          4}
                      格。不挪动已有货物。
                    </Text>
                    <GameButton
                      className="primary wide"
                      disabled={
                        game[target] >= 5 ||
                        game.cash < upgradeCost(game, target)
                      }
                      onClick={() =>
                        apply({ type: 'upgrade', target }, '购买固定设备升级')
                      }
                    >
                      {game[target] >= 5
                        ? '已达上限'
                        : '升级 · ' + upgradeCost(game, target)}
                    </GameButton>
                  </View>
                ))}
              </>
            )}
            {panel === 'help' && (
              <View className="help-copy">
                <Text>
                  ① 收货：点“挑选来货”或拖来货上柜台 → 核价 →
                  确认收购。未确认前不付款，货仍属于顾客。也可整批收购。
                </Text>
                <Text>
                  ② 整理：已购货留在柜台。按住拖到仓库或展示柜；也可点商品 →
                  整理此物 → 旋转 →
                  点目标空格。格子小时用“放大整理”。收回仓库只搬自有货。
                </Text>
                <Text>
                  鉴定：花8币揭示品质。买下不会自动鉴定；卖家声明可能不准确。
                </Text>
                <Text>
                  ③ 出售：找求购类别合适的买家 → 将自有货放上柜台 →
                  核对逐件报价和预算 →
                  确认出售。拒收货留台；拖回撤销报价，每客仅可还价一次。
                </Text>
                <Text>
                  展示：商品放进左侧展示柜会影响来客需求，但不保证立即有人购买。
                </Text>
                <Text>
                  日结：五笔成交一天，批量交易只算一笔。第七日结束出房租账单，可付款或明确延期。
                </Text>
                <Text>
                  没有离线变化。零库存且现金不足5时，可接理货委托。桌面辅助键：拖动时R旋转，Esc取消。
                </Text>
                <Text>本地存档不跨设备同步。清除浏览器数据会丢失进度。</Text>
                <GameButton
                  className="wide"
                  onClick={() =>
                    setConfirm({
                      title: '备份当前进度并重新开店？',
                      run: reset,
                    })
                  }
                >
                  备份当前进度并重开
                </GameButton>
              </View>
            )}
            {error && <Text className="inline-error">{error}</Text>}
            {panel === 'inventory' && /已放入|增加|位置/.test(game.notice) && (
              <Text className="feedback">{game.notice}</Text>
            )}
          </View>
        </View>
      )}

      {detail && !game.report && (
        <View className="modal-backdrop detail-overlay">
          <View className="sheet paper-sheet">
            <View className="sheet-heading">
              <Text>商品检视</Text>
              <GameButton onClick={() => setDetailId(null)}>返回</GameButton>
            </View>
            <View className="item-inspection">
              <Image
                src={itemArt[detail.productId]}
                className="detail-art"
                mode="aspectFit"
              />
              <View>
                <Text className="section-title">{product(detail).name}</Text>
                <Text>
                  {product(detail).category} / {detail.condition} /{' '}
                  {detail.known ? detail.quality : '品质未知'}
                </Text>
                <Price item={detail} />
                <Text>
                  占地 {product(detail).width}×{product(detail).height}
                </Text>
              </View>
            </View>
            <Text className="body-copy">{product(detail).story}</Text>
            <Text className="ownership-note">
              {detailOwned
                ? '自有物品 · 成本 ' + detail.cost
                : '待购 · 要价 ' +
                  Math.max(
                    1,
                    Math.round(
                      (v?.asks[detail.uid] ?? 0) * (v?.priceFactor ?? 1),
                    ),
                  ) +
                  '星币 · 声明品质 ' +
                  detail.claimedQuality +
                  '，未成交前不属于你'}
            </Text>
            {!detail.known && (
              <View className="inspection-action">
                <Image
                  src={magnifierArt}
                  mode="aspectFit"
                  className="identify-tool"
                />
                <GameButton
                  disabled={game.cash < 8}
                  onClick={() =>
                    apply(
                      { type: 'identify', uid: detail.uid },
                      '付费检视当前物品的真实品质',
                    )
                  }
                >
                  鉴定 · 8星币
                </GameButton>
              </View>
            )}
            {detailOwned ? (
              <>
                <GameButton
                  className="primary wide"
                  onClick={() => {
                    setMoving(detail.uid)
                    setRotated(detail.rotated)
                    setTarget(detail.area)
                    setDetailId(null)
                    setZoomArea(detail.area)
                    setInventoryView('grid')
                    setPanel('inventory')
                  }}
                >
                  整理此物
                </GameButton>
                {v?.kind === 'buyer' && (
                  <GameButton
                    className="wide"
                    onClick={() => {
                      if (select(detail)) setDetailId(null)
                    }}
                  >
                    {game.staged.includes(detail.uid)
                      ? '撤下报价'
                      : '移上柜台报价'}
                  </GameButton>
                )}
                <GameButton
                  className="wide"
                  disabled={game.staged.includes(detail.uid)}
                  onClick={() => {
                    const item = detail
                    setConfirm({
                      title:
                        '清仓 ' +
                        product(item).name +
                        '，回款 ' +
                        clearanceValue(item) +
                        ' 星币？',
                      run: () => {
                        if (
                          apply(
                            { type: 'clearance', uid: item.uid },
                            '确认折价清仓以回收资金与仓位',
                          )
                        )
                          setDetailId(null)
                      },
                    })
                  }}
                >
                  折价清仓 · {clearanceValue(detail)}星币
                </GameButton>
              </>
            ) : (
              <GameButton
                className="primary wide"
                onClick={() => {
                  if (select(detail)) setDetailId(null)
                }}
              >
                {game.staged.includes(detail.uid) ? '从柜台撤下' : '暂放到柜台'}
              </GameButton>
            )}
            {error && <Text className="inline-error">{error}</Text>}
          </View>
        </View>
      )}

      {game.report && (
        <View className="modal-backdrop">
          <View className="sheet paper-sheet day-report">
            <Text className="report-stamp">
              第 {game.report.day} 日 · 营业结算
            </Text>
            {(announcement.includes('升至') ||
              announcement.includes('首周目标')) && (
              <Text className="report-update">{announcement}</Text>
            )}
            <View className="paper-stats">
              <Text>今日成交 {game.report.trades} 笔 · 日目标完成</Text>
              <Text>
                收入 {game.report.income} · 支出 {game.report.spending}
              </Text>
              <Text>已售/清仓毛利 {game.report.profit}星币</Text>
              <Text>
                可用现金 {game.cash}星币 · 店铺 Lv.{level(game)}
              </Text>
            </View>
            <Text className="body-copy">
              柜台留货{' '}
              {game.inventory.filter((i) => i.area === 'counter').length} 件 ·
              当前顾客保留。继续营业后可整理；退出会保留本张日结。
            </Text>
            {bill && (
              <View className="rent-slip">
                <Text className="section-title">房东账单 · 第{bill.day}日</Text>
                <Text>
                  本期 {bill.amount} · 已付 {bill.paid} · 总欠租 {debt(game)}
                </Text>
                <Text>
                  {bill.paid === bill.amount
                    ? '本期租金已付清。'
                    : bill.deferred
                      ? '已确认延期，欠款继续保留。'
                      : '请付款或明确选择延期。'}
                </Text>
              </View>
            )}
            {debt(game) > 0 && (
              <>
                <GameButton
                  className="primary wide"
                  disabled={!game.cash}
                  onClick={() =>
                    apply({ type: 'payRent' }, '在日结账单主动支付到期房租')
                  }
                >
                  支付房租 · {Math.min(debt(game), game.cash)}
                </GameButton>
                {game.bills.some((b) => b.paid < b.amount && !b.deferred) && (
                  <GameButton
                    className="wide"
                    onClick={() =>
                      apply(
                        { type: 'deferRent' },
                        '确认本期欠租延期，保留偿还义务',
                      )
                    }
                  >
                    确认延期交租
                  </GameButton>
                )}
              </>
            )}
            <GameButton
              className="wide"
              disabled={game.bills.some(
                (b) => b.paid < b.amount && !b.deferred,
              )}
              onClick={() => {
                if (apply({ type: 'ackDay' }, '核对日结后进入下一游戏日')) {
                  setPanel(null)
                  setDetailId(null)
                  setMoving(null)
                }
              }}
            >
              继续营业 · 第{game.day + 1}天
            </GameButton>
            {error && <Text className="inline-error">{error}</Text>}
          </View>
        </View>
      )}
      {game.job.active && (
        <View className="modal-backdrop">
          <View className="sheet paper-sheet">
            <Text className="section-title">港口理货委托</Text>
            <Text className="body-copy">
              货签写着「应急氧气罐」。把货签归入正确类别，完成后领取20星币劳动报酬。
            </Text>
            <View className="job-choices">
              {CATEGORIES.map((category) => (
                <GameButton
                  key={category}
                  onClick={() =>
                    apply(
                      { type: 'completeJob', category },
                      '核对货签后完成理货工作',
                    )
                  }
                >
                  {category}
                </GameButton>
              ))}
            </View>
            {error && <Text className="inline-error">{error}</Text>}
          </View>
        </View>
      )}
      {confirm && (
        <View className="modal-backdrop confirmation">
          <View className="sheet paper-sheet">
            <Text className="section-title">{confirm.title}</Text>
            <GameButton
              className="primary wide"
              onClick={() => {
                const c = confirm
                setConfirm(null)
                c.run()
              }}
            >
              确认
            </GameButton>
            <GameButton className="wide" onClick={() => setConfirm(null)}>
              取消
            </GameButton>
          </View>
        </View>
      )}
    </View>
  )
}
