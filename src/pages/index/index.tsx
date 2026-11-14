import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Image,
  Text,
  View,
  ScrollView,
  type ButtonProps,
} from '@tarojs/components'
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
  type Game,
  type Item,
  type Action,
  type Area,
} from '../../game/engine'
import { PlayerController, type Request } from '../../game/interface'
import { load, save, restart } from '../../platform/storage'
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
import './index.css'

function GameButton({ className = '', disabled, ...props }: ButtonProps) {
  return (
    <Button
      {...{ role: 'button', tabIndex: disabled ? -1 : 0 }}
      {...props}
      aria-disabled={!!disabled}
      disabled={disabled || undefined}
      className={'game-button ' + className}
    />
  )
}
type Panel = 'trade' | 'ledger' | 'upgrade' | 'help' | null
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
  const [detailId, setDetailId] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [rotated, setRotated] = useState(false)
  const [target, setTarget] = useState<Area>('warehouse')
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
    const result = controller.current!.act(r)
    publish()
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
      return false
    }
  }
  const drag = useInventoryDrag(game, apply, setError)
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
  const shown = game.inventory.filter((i) => i.area === 'showcase')
  const total = selectedTotal(game)
  const canTrade =
    !!v &&
    total > 0 &&
    (v.kind === 'seller' ? total <= game.cash : total <= v.budget)
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
  const select = (item: Item) =>
    apply(
      {
        type: game.staged.includes(item.uid) ? 'unstage' : 'stage',
        uid: item.uid,
      },
      '挑选或撤下本次交易商品',
    )
  const openPanel = (p: Panel) => {
    setPanel(p)
    setMoving(null)
    setError('')
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
    <View className="game-shell" style={{ maxWidth: '480px' }}>
      <View
        style={{ fontSize: 'clamp(12px, 3.6vw, 17px)' }}
        className="store-scene shop-stage"
        aria-label="店铺柜台"
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
          <Text className="progress-line">今日成交 {game.progress}/5</Text>
        </View>
        <GameButton
          className="cash-display"
          aria-label="查看现金账本"
          onClick={() => openPanel('ledger')}
        >
          <Text className="cash">{game.cash}¢</Text>
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
            吸引 · {displayCategory(game) ?? '未布置'}
          </Text>
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
          <View
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
            <Text className="dialogue-line">
              {v?.line ?? '整理好货物，按绿色按钮接客。'}
            </Text>
          </View>
        )}
        <GameButton
          className="intercom-key"
          aria-label="打开手册"
          onClick={() => openPanel('help')}
        >
          ?
        </GameButton>

        {v?.kind === 'seller' && v.stock.length > 0 && (
          <View className="customer-counter">
            <Text className="customer-counter-label">
              顾客来货 · 拖到下方柜台挑选
            </Text>
            {grid('customer')}
          </View>
        )}
        <View className="counter-title">
          <Text>柜台</Text>
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
          ↓ 收回
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
            {v ? '▤' : '↓'}
          </GameButton>
          <GameButton
            className="console-key dismiss-key"
            aria-label="送客"
            disabled={!v}
            onClick={() =>
              v &&
              apply(
                { type: 'dismiss', visitorId: v.id },
                '结束与当前顾客的接待',
              )
            }
          >
            ×
          </GameButton>
          <GameButton
            className="console-key ledger-key"
            aria-label="打开账本"
            onClick={() => openPanel('ledger')}
          >
            ▣
          </GameButton>
        </View>

        {v && game.staged.length > 0 && (
          <View className="deal-strip">
            <Text>
              {v.kind === 'seller' ? '待购' : '待售'}
              {game.staged.length}件 · {total}¢
            </Text>
            <GameButton
              className="primary"
              disabled={!canTrade || !!game.report}
              onClick={afterTrade}
            >
              {v.kind === 'seller' ? '确认收购' : '确认出售'}
            </GameButton>
          </View>
        )}

        <View className="warehouse-panel">
          <View className="warehouse-heading">
            <Text>仓库</Text>
          </View>
          <ScrollView
            className="warehouse-scroll inventory-viewport"
            data-area="warehouse"
            scrollY={!drag.scrollLock}
          >
            <View
              className="warehouse-content"
              style={{
                height:
                  Math.max(1, bounds(game, 'warehouse').height / 6) * 100 + '%',
              }}
            >
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
            <Text>今日热销 · {hot(game)}</Text>
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
                      { type: 'autoPlace', uid: movingItem.uid, area: target },
                      '寻找完整空位放置自有物品',
                    )
                  )
                    setMoving(null)
                }}
              >
                自动找空位
              </GameButton>
              <GameButton onClick={() => setMoving(null)}>取消整理</GameButton>
            </View>
            <Text className="muted">
              可直接拖动；此处也可旋转后点目标格子，重叠或越界不生效。
            </Text>
          </View>
        )}

        <Text className="stage-notice">{game.notice}</Text>
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

      {panel && !detail && !game.report && !game.job.active && (
        <View
          className={
            'modal-backdrop ' + (panel === 'trade' ? 'trading-backdrop' : '')
          }
        >
          <View
            className={
              'sheet ' + (panel === 'help' ? 'metal-sheet' : 'paper-sheet')
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
                      : '店长手册'}
              </Text>
              <GameButton
                aria-label="关闭工具面板"
                onClick={() => setPanel(null)}
              >
                关闭
              </GameButton>
            </View>
            {panel === 'trade' && (
              <>
                {!v ? (
                  <Text>当前没有顾客，请先按铃接客。</Text>
                ) : (
                  <>
                    <View className="visitor-heading">
                      <Text>
                        {v.name} · {v.role}
                      </Text>
                      <Text>{v.kind === 'seller' ? '来卖货' : '来买货'}</Text>
                    </View>
                    <Text className="body-copy">{v.line}</Text>
                    {v.kind === 'buyer' && (
                      <View className="demand">
                        <Text>
                          求购 {v.category} · 剩余预算 {v.budget}
                        </Text>
                        <Text>
                          {v.minimumQuality}起 ·{' '}
                          {v.acceptsDamaged ? '可接受损坏' : '不收损坏'} · 还买{' '}
                          {v.remaining} 件
                        </Text>
                      </View>
                    )}
                    <Text className="trade-instruction">
                      {v.kind === 'seller'
                        ? '把来货拖到柜台，逐件核价；或接受整批折扣。'
                        : '从仓库或展示柜把货拖上柜台，账单随台面更新。'}
                    </Text>
                    {v.kind === 'buyer' && v.variety && (
                      <Text className="trade-instruction">
                        多种多样：同种商品只买一件。
                      </Text>
                    )}
                    <View className="offer-list">
                      {!rows.length && (
                        <Text className="body-copy">
                          柜台暂无报价物品。关闭平板也可以继续搬货。
                        </Text>
                      )}
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
                              {accepted ? price + '¢' : '不收'}
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
                    {v.kind === 'seller' && v.stock.length > 0 && (
                      <View className="wholesale-offer">
                        <Text>
                          整批 {v.stock.length} 件 · 优惠{' '}
                          {v.wholesaleDiscount ?? 15}% · 实付{' '}
                          {wholesalePrice(game)}¢
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
                                ' 件？货物将留在柜台。',
                              run: () => {
                                if (
                                  apply(
                                    { type: 'wholesale', visitorId: v.id },
                                    '确认整批价格后接受批发收购',
                                  )
                                )
                                  setPanel(null)
                              },
                            })
                          }
                        >
                          接受整批报价
                        </GameButton>
                      </View>
                    )}
                    {!v.stock.length && v.kind === 'seller' && (
                      <Text className="body-copy">
                        这批来货已经收完，可以送客。
                      </Text>
                    )}
                    <View className="trade-footer">
                      <Text>
                        台面 {rows.length} 件 · 可成交{' '}
                        {rows.filter((r) => r.accepted).length} 件 · 合计{' '}
                        {total}
                      </Text>
                      <Text>每次确认成交计一笔，顾客继续留店。</Text>
                      <View className="toolbar">
                        <GameButton
                          disabled={!game.staged.length || v.bargained}
                          onClick={() =>
                            apply(
                              { type: 'bargain', visitorId: v.id },
                              '向当前顾客提出唯一一次10%还价请求',
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
                          disabled={!canTrade}
                          className="primary"
                          onClick={afterTrade}
                        >
                          {v.kind === 'seller' ? '确认收购' : '确认出售'}
                        </GameButton>
                      </View>
                      {game.staged.length > 0 && !canTrade && (
                        <Text className="inline-error">
                          {v.kind === 'seller'
                            ? '现金不足，可撤下一件或取消交易。'
                            : total > v.budget
                              ? '合计超过剩余预算，请从柜台拖回一件或撤下。'
                              : '没有符合需求的台面货物，请查看逐件拒收原因。'}
                        </Text>
                      )}
                    </View>
                  </>
                )}
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
                <GameButton
                  className="primary wide"
                  disabled={!debt(game) || !game.cash}
                  onClick={() =>
                    apply({ type: 'payRent' }, '主动支付账本中的到期房租')
                  }
                >
                  支付房租 · {Math.min(debt(game), game.cash)}
                </GameButton>
                <Text className="section-title">最近流水</Text>
                {game.entries.slice(0, 35).map((e) => (
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
                  Lv.{level(game)} · 声望 {game.reputation}
                  。15笔且声望45解锁二级，40笔且声望55解锁三级。
                </Text>
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
                      ；不挪动已有商品。
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
                  收货：把顾客台面的虚线来货拖到柜台，打开平板核价并确认收购；也可接受整批折扣。移动本身不付款。
                </Text>
                <Text>
                  整理：按住商品拖到仓库、展示柜或柜台，绿色落点可放，红色不可放。拖动时按R旋转、Esc取消；触屏可先点商品在整理工具中旋转。↓收回只收自有货物。
                </Text>
                <Text>
                  鉴定：花8币揭示品质。买下不会自动鉴定；卖家声明可能不准确。
                </Text>
                <Text>
                  出售：把自有货拖上柜台查看逐件报价，拖回即撤销。确认只卖被接受的货，拒收货留台。每位顾客共享预算，可还价一次。
                </Text>
                <Text>
                  展示：商品放进左侧展示柜会影响来客需求，但不保证立即有人购买。
                </Text>
                <Text>
                  日结：五笔成交一天，批量交易只算一笔。第七日结束出房租账单，可付款或明确延期。
                </Text>
                <Text>
                  没有离线变化。零库存且资金不足5时，可完成理货委托恢复周转。
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
            <Text className="feedback">{game.notice}</Text>
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
                : '顾客物品 · 声明品质 ' +
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
                  鉴定 · 8
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
                    setPanel(null)
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
                  清仓 · {clearanceValue(detail)}
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
            <View className="paper-stats">
              <Text>今日成交 {game.report.trades} 笔</Text>
              <Text>
                收入 {game.report.income} · 支出 {game.report.spending}
              </Text>
              <Text>已售/清仓毛利 {game.report.profit}</Text>
              <Text>可用现金 {game.cash}</Text>
            </View>
            <Text className="body-copy">
              柜台货物与当前顾客会保留；离开也会保留本张日结。
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
