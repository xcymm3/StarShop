import { useRef, useState } from 'react'
import { Button, Image, Text, View, type ButtonProps } from '@tarojs/components'
import {
  capacity,
  CATEGORIES,
  clearanceValue,
  displayCapacity,
  hot,
  level,
  product,
  quote,
  transition,
  upgradeCost,
  value,
  type Action,
  type Game,
  type Item,
} from '../../game/engine'
import { load, restart, save } from '../../platform/storage'
import { itemArt, visitorArt, roomArt } from '../../assets'
import './index.css'

function GameButton({ className = '', disabled, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || undefined}
      className={'game-button ' + className}
    />
  )
}

type Tab = '柜台' | '仓库' | '升级' | '账本'
type Confirm = { title: string; message: string; run: () => void }
function Merchandise({ item, small = false }: { item: Item; small?: boolean }) {
  const p = product(item)
  return (
    <View
      className={`merch category-${CATEGORIES.indexOf(p.category)} ${small ? 'merch-small' : ''}`}
    >
      <Image
        className="product-sprite"
        src={itemArt[p.id]}
        mode="aspectFit"
        aria-label={p.name}
      />
    </View>
  )
}
export default function Index() {
  const [initial] = useState(() => {
    try {
      return { game: load(), error: '' }
    } catch {
      return {
        game: null,
        error: '存档无法读取或保存。原数据已保留，请重试，或备份后重新开店。',
      }
    }
  })
  const [game, setGame] = useState<Game | null>(initial.game)
  const current = useRef(game)
  const [error, setError] = useState(initial.error)
  const [tab, setTab] = useState<Tab>('柜台')
  const [filter, setFilter] = useState('全部')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Item | null>(null)
  const [help, setHelp] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const apply = (action: Action) => {
    try {
      if (!current.current) return
      const next = transition(current.current, action)
      save(next)
      current.current = next
      setGame(next)
      setError('')
      setDetail(null)
      setSelected(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作未保存，请重试。')
    }
  }
  const reset = () => {
    try {
      const next = restart()
      current.current = next
      setGame(next)
      setError('')
      setHelp(false)
      setDetail(null)
      setTab('柜台')
    } catch {
      setError('无法备份或保存新局，原店铺未替换，请重试。')
    }
  }
  const askReset = () =>
    setConfirm({
      title: '重新开一家店？',
      message: '当前进度会先备份，然后从第 1 天开始。此操作不会带来离线收益。',
      run: reset,
    })
  if (!game)
    return (
      <View className="game-shell recovery">
        <Text className="wordmark">STARSHOP</Text>
        <Text className="page-title">存档需要处理</Text>
        <Text className="error">{error}</Text>
        <GameButton
          onClick={() => {
            try {
              const s = load()
              current.current = s
              setGame(s)
              setError('')
            } catch {
              setError('存档仍无法读取。可以备份旧档后重开。')
            }
          }}
        >
          重新读取
        </GameButton>
        <GameButton onClick={askReset}>备份并重开</GameButton>
        {confirm && (
          <View className="modal-backdrop">
            <View className="sheet">
              <Text className="page-title">{confirm.title}</Text>
              <Text>{confirm.message}</Text>
              <GameButton
                onClick={() => {
                  const c = confirm
                  setConfirm(null)
                  c.run()
                }}
              >
                确认重开
              </GameButton>
              <GameButton onClick={() => setConfirm(null)}>保留原档</GameButton>
            </View>
          </View>
        )}
      </View>
    )
  const v = game.visitor
  const chosen = game.inventory.find((i) => i.uid === selected)
  const offered = v?.kind === 'seller' ? v.item : undefined
  const matches = game.inventory.filter(
    (i) => v?.kind === 'buyer' && product(i).category === v.category,
  )
  const detailIsOffer = !!detail && offered?.uid === detail.uid
  const shown = game.inventory.filter((i) => game.display.includes(i.uid))
  const items = game.inventory.filter(
    (i) => filter === '全部' || product(i).category === filter,
  )
  const cannotBuy =
    game.inventory.length >= capacity(game)
      ? '仓库已满，先清理货物'
      : game.cash < (v?.ask || 0)
        ? '资金不足，先出售或清仓'
        : ''
  return (
    <View className="game-shell">
      <View className="masthead">
        <View>
          <Text className="wordmark">STARSHOP</Text>
          <Text className="station">远星港 · 第七码头</Text>
        </View>
        <GameButton className="small-button" onClick={() => setHelp(true)}>
          店长手册
        </GameButton>
      </View>
      <View className="statusbar">
        <View>
          <Text className="muted">可用星币</Text>
          <Text className="cash">{game.cash.toLocaleString()}</Text>
        </View>
        <View className="day-status">
          <Text>
            第 {game.day} 天 · Lv.{level(game)}
          </Text>
          <Text className="muted">本日成交 {game.progress} / 5</Text>
          <View className="ticks">
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                className={`tick ${i < game.progress ? 'lit' : ''}`}
              />
            ))}
          </View>
        </View>
      </View>
      <View className="market-strip">
        <Text>热销 · {hot(game)}</Text>
        <Text>
          距周租 {7 - ((game.day - 1) % 7)} 天
          {game.debt > 0 ? ` · 欠租 ${game.debt}` : ''}
        </Text>
      </View>
      {error && (
        <View className="error" role="alert">
          <Text>{error}</Text>
          <GameButton className="text-button" onClick={() => setError('')}>
            收起
          </GameButton>
        </View>
      )}
      {tab === '柜台' && (
        <>
          <View className="store-scene">
            <Image className="room-sprite" src={roomArt} mode="aspectFill" />
            <View className="scene-sign">
              <Text>远星杂货</Text>
              <Text className="sign-sub">收旧物 · 迎远客</Text>
            </View>
            <View className="display-case">
              <Text className="scene-label">
                展示柜 {shown.length}/{displayCapacity(game)}
              </Text>
              <View className="display-items">
                {shown.map((i) => (
                  <View key={i.uid} onClick={() => setDetail(i)}>
                    <Merchandise item={i} small />
                  </View>
                ))}
                {!shown.length && <Text className="muted">空柜待上架</Text>}
              </View>
            </View>
            {v && (
              <Image
                className="visitor-sprite"
                src={visitorArt[v.role] || visitorArt['拾荒者']}
                mode="aspectFit"
                aria-label={v.role}
              />
            )}
            {!v && <View className="closed-label">等下一位客人</View>}
            <View className="counter-caption">
              {v
                ? v.kind === 'seller'
                  ? '来货登记'
                  : '旅客求购'
                : '交易已保存'}
            </View>
          </View>
          <View className="trade-panel">
            <View className="panel-heading">
              <Text>{v ? `${v.name} · ${v.role}` : '柜台小票'}</Text>
              <Text className="muted">
                {v ? (v.kind === 'seller' ? '来出售' : '来采购') : '等待接待'}
              </Text>
            </View>
            {v ? (
              <>
                <Text className="dialogue">“{v.line}”</Text>
                {offered && (
                  <View
                    className="offer-item"
                    onClick={() => setDetail(offered)}
                  >
                    <Merchandise item={offered} />
                    <View className="item-copy">
                      <Text className="item-name">{product(offered).name}</Text>
                      <Text className="muted">
                        {product(offered).category} / {offered.condition} /{' '}
                        {offered.known ? offered.quality : '品质待鉴定'}
                      </Text>
                      <Text className="estimate">
                        {offered.known
                          ? `参考价 ${value(offered)}`
                          : `基础估价 ${product(offered).base}，品质可能影响价值`}{' '}
                        星币
                      </Text>
                    </View>
                    <Text className="inspect-link">查看 ›</Text>
                  </View>
                )}
                {v.kind === 'seller' && (
                  <>
                    <View className="price-row">
                      <Text>对方报价</Text>
                      <Text className="quote">
                        {v.ask} <Text className="unit">星币</Text>
                      </Text>
                    </View>
                    <View className="action-row">
                      <GameButton
                        className="secondary"
                        disabled={!!offered?.known || game.cash < 8}
                        onClick={() =>
                          apply({ type: 'identify', visitorId: v.id })
                        }
                      >
                        {offered?.known ? '已鉴定' : '鉴定 · 8'}
                      </GameButton>
                      <GameButton
                        className="primary"
                        disabled={!!cannotBuy}
                        onClick={() => apply({ type: 'buy', visitorId: v.id })}
                      >
                        收购 · {v.ask}
                      </GameButton>
                    </View>
                    {cannotBuy && (
                      <Text className="inline-error">{cannotBuy}</Text>
                    )}
                  </>
                )}
                {v.kind === 'buyer' && (
                  <>
                    <View className="buyer-summary">
                      <Text>想找：{v.category}</Text>
                      <Text>预算 {v.budget} 星币</Text>
                    </View>
                    {matches.length ? (
                      <View className="buy-options">
                        {matches.map((i) => (
                          <View
                            key={i.uid}
                            className={`buy-option ${chosen?.uid === i.uid ? 'selected' : ''}`}
                            onClick={() => setSelected(i.uid)}
                          >
                            <Merchandise item={i} small />
                            <View className="item-copy">
                              <Text>{product(i).name}</Text>
                              <Text className="muted">
                                {i.quality} / {i.condition} · 报价{' '}
                                {quote(game, i)}
                              </Text>
                            </View>
                            <Text>{chosen?.uid === i.uid ? '●' : '○'}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View className="empty">
                        <Text>暂时没有合适的货</Text>
                        <Text className="muted">
                          可以婉拒，等有库存时再做这笔生意。
                        </Text>
                      </View>
                    )}
                    <GameButton
                      className="primary wide"
                      disabled={!chosen || !quote(game, chosen)}
                      onClick={() =>
                        chosen &&
                        apply({
                          type: 'sell',
                          visitorId: v.id,
                          uid: chosen.uid,
                        })
                      }
                    >
                      {chosen
                        ? `出售 · ${quote(game, chosen)} 星币`
                        : '先选一件商品'}
                    </GameButton>
                  </>
                )}
                <GameButton
                  className="text-button wide"
                  onClick={() => apply({ type: 'decline', visitorId: v.id })}
                >
                  婉拒这位客人，不推进日期
                </GameButton>
              </>
            ) : (
              <View className="receipt">
                <Text>{game.notice}</Text>
                <Text className="muted">
                  资金与库存已存入本地，可随时离开。
                </Text>
                <GameButton
                  className="primary wide"
                  onClick={() => apply({ type: 'next' })}
                >
                  接待下一位
                </GameButton>
              </View>
            )}
          </View>
          <View className="news">
            <Text className="news-label">港口广播</Text>
            <Text>
              {
                [
                  '补给船已靠泊，船员们正在寻找旅途中的小物。',
                  '维修班换岗，机械零件的需求有所上升。',
                  '外环旧货集市开张，留意那些有故事的东西。',
                  '观测站开放档案交换，数据货物受到关注。',
                ][(game.day - 1) % 4]
              }
            </Text>
          </View>
        </>
      )}
      {tab === '仓库' && (
        <View className="section">
          <View className="section-heading">
            <Text className="page-title">仓库清单</Text>
            <Text>
              {game.inventory.length} / {capacity(game)} 格
            </Text>
          </View>
          <Text className="muted">
            展示 {shown.length}/{displayCapacity(game)} · 上架更容易被顾客看见
          </Text>
          <View className="filters">
            {['全部', ...CATEGORIES].map((c) => (
              <GameButton
                key={c}
                className={filter === c ? 'filter active' : 'filter'}
                onClick={() => setFilter(c)}
              >
                {c}
              </GameButton>
            ))}
          </View>
          <View className="inventory-grid">
            {items.map((i) => (
              <View
                key={i.uid}
                className="inventory-card"
                onClick={() => setDetail(i)}
              >
                <View className="inventory-top">
                  <Merchandise item={i} />
                  <Text className="stock-tag">
                    {game.display.includes(i.uid)
                      ? '展示中'
                      : product(i).category}
                  </Text>
                </View>
                <Text className="item-name">{product(i).name}</Text>
                <Text className="muted">
                  {i.quality} / {i.condition}
                </Text>
                <Text className="stock-price">
                  {value(i)} <Text className="unit">星币参考价</Text>
                </Text>
              </View>
            ))}
          </View>
          {!items.length && (
            <View className="empty">
              <Text>这层货架还空着</Text>
              <Text className="muted">去柜台收点来货，或切换商品分类。</Text>
              <GameButton onClick={() => setTab('柜台')}>返回柜台</GameButton>
            </View>
          )}
        </View>
      )}
      {tab === '升级' && (
        <View className="section">
          <Text className="page-title">把小店慢慢做大</Text>
          <View className="level-board">
            <Text className="level-number">Lv.{level(game)}</Text>
            <View>
              <Text>远星杂货铺</Text>
              <Text className="muted">累计成交 {game.trades} 笔</Text>
              <Text className="muted">
                {level(game) === 3
                  ? '全部来货已开放'
                  : `下一等级：${level(game) === 1 ? 15 : 40} 笔成交`}
              </Text>
            </View>
          </View>
          {(['storage', 'shelves'] as const).map((target) => (
            <View key={target} className="upgrade-panel">
              <View className="panel-heading">
                <Text>{target === 'storage' ? '仓库扩容' : '增加展示位'}</Text>
                <Text className="muted">已升级 {game[target]}/5 次</Text>
              </View>
              <Text className="upgrade-effect">
                {target === 'storage'
                  ? `${capacity(game)} → ${capacity(game) + 4} 格`
                  : `${displayCapacity(game)} → ${displayCapacity(game) + 1} 位`}
              </Text>
              <Text className="muted">
                {target === 'storage'
                  ? '收下更多货物，为下一位买家留点余地。'
                  : '让好货被看见，提高它们被求购的机会。'}
              </Text>
              <GameButton
                className="primary wide"
                disabled={
                  game.cash < upgradeCost(game, target) || game[target] >= 5
                }
                onClick={() => apply({ type: 'upgrade', target })}
              >
                {game[target] >= 5
                  ? '已达到上限'
                  : `升级 · ${upgradeCost(game, target)} 星币`}
              </GameButton>
            </View>
          ))}
        </View>
      )}
      {tab === '账本' && (
        <View className="section">
          <Text className="page-title">店长账本</Text>
          <View className="paper">
            <Text className="paper-title">
              第 {Math.floor((game.day - 1) / 7) + 1} 周 · 租赁账单
            </Text>
            <View className="ledger-row">
              <Text>每周租金</Text>
              <Text>120 星币</Text>
            </View>
            <View className="ledger-row">
              <Text>距下次结算</Text>
              <Text>{7 - ((game.day - 1) % 7)} 个游戏日</Text>
            </View>
            <View className="ledger-row">
              <Text>待补租金</Text>
              <Text>{game.debt} 星币</Text>
            </View>
            <Text className="paper-note">
              日期只随成交推进。离开店铺，不会额外计租。
            </Text>
            <GameButton
              className="paper-button"
              disabled={!game.debt || !game.cash}
              onClick={() => apply({ type: 'payRent' })}
            >
              补缴租金{game.debt ? ` · ${Math.min(game.cash, game.debt)}` : ''}
            </GameButton>
          </View>
          <View className="section-heading">
            <Text>最近流水</Text>
            <Text className="muted">最多保留 60 条</Text>
          </View>
          {game.entries.length ? (
            game.entries.map((e) => (
              <View className="entry" key={e.id}>
                <View>
                  <Text>{e.text}</Text>
                  <Text className="muted">第 {e.day} 天</Text>
                </View>
                <Text className={e.delta >= 0 ? 'positive' : 'negative'}>
                  {e.delta > 0 ? '+' : ''}
                  {e.delta}
                </Text>
              </View>
            ))
          ) : (
            <View className="empty">
              <Text>账本还是新的一页</Text>
              <Text className="muted">完成第一笔生意，就会留下记录。</Text>
            </View>
          )}
        </View>
      )}
      <View className="save-note">本地存档 · 操作后自动保存 · 无离线收益</View>
      <View className="bottom-nav">
        {(['柜台', '仓库', '升级', '账本'] as Tab[]).map((t, i) => (
          <GameButton
            key={t}
            className={tab === t ? 'nav-button current' : 'nav-button'}
            onClick={() => {
              setTab(t)
              setSelected(null)
              setError('')
            }}
          >
            <Text className="nav-mark">{['▤', '▦', '⌁', '≡'][i]}</Text>
            <Text>{t}</Text>
          </GameButton>
        ))}
      </View>
      {detail && (
        <View className="modal-backdrop" onClick={() => setDetail(null)}>
          <View className="sheet" onClick={(e) => e.stopPropagation()}>
            <View className="section-heading">
              <Text className="page-title">商品档案</Text>
              <GameButton
                className="small-button"
                onClick={() => setDetail(null)}
              >
                关闭
              </GameButton>
            </View>
            <View className="detail-product">
              <Merchandise item={detail} />
              <Text className="page-title">{product(detail).name}</Text>
              <Text className="muted">
                {product(detail).category} / {detail.condition} /{' '}
                {detail.known ? detail.quality : '品质未知'}
              </Text>
            </View>
            <Text className="detail-story">{product(detail).story}</Text>
            <View className="price-row">
              <Text>{detail.known ? '参考价值' : '基础估价'}</Text>
              <Text className="quote">
                {detail.known ? value(detail) : product(detail).base}
              </Text>
            </View>
            {detailIsOffer ? (
              <>
                <Text className="muted">
                  鉴定可揭示品质，不改变顾客已经给出的报价。
                </Text>
                <GameButton
                  className="primary wide"
                  disabled={detail.known || game.cash < 8}
                  onClick={() =>
                    v && apply({ type: 'identify', visitorId: v.id })
                  }
                >
                  {detail.known ? '已经完成鉴定' : '鉴定商品 · 8 星币'}
                </GameButton>
              </>
            ) : (
              <>
                <View className="ledger-row">
                  <Text>收购成本</Text>
                  <Text>{detail.cost} 星币</Text>
                </View>
                <GameButton
                  className="primary wide"
                  disabled={
                    !game.display.includes(detail.uid) &&
                    shown.length >= displayCapacity(game)
                  }
                  onClick={() => apply({ type: 'display', uid: detail.uid })}
                >
                  {game.display.includes(detail.uid)
                    ? '从展示柜撤下'
                    : '放进展示柜'}
                </GameButton>
                <GameButton
                  className="secondary wide"
                  onClick={() => {
                    const item = detail
                    setConfirm({
                      title: '低价清仓这件商品？',
                      message: `可回款 ${clearanceValue(item)} 星币。清仓不计成交次数，也不会推进日期。`,
                      run: () => apply({ type: 'clearance', uid: item.uid }),
                    })
                  }}
                >
                  清仓 · 回款 {clearanceValue(detail)}
                </GameButton>
              </>
            )}
          </View>
        </View>
      )}
      {help && (
        <View className="modal-backdrop">
          <View className="sheet help">
            <View className="section-heading">
              <Text className="page-title">店长手册</Text>
              <GameButton
                className="small-button"
                onClick={() => setHelp(false)}
              >
                关闭
              </GameButton>
            </View>
            <Text className="help-heading">一件旧物，一笔好生意</Text>
            <Text>
              收购来货，再卖给需要它的旅客。参考价是估值，不保证成交收益。
            </Text>
            <Text>
              每完成 5
              笔买入或卖出，推进一天。拒绝、鉴定、清仓和升级不推进日期。
            </Text>
            <Text>
              每 7 个游戏日收租 120 星币。不够时记为欠租，仍可继续营业。
            </Text>
            <Text>
              展示商品更容易被求购。仓库满了可以清仓回款，或扩充仓位。
            </Text>
            <Text>
              每次操作立即保存在本机。刷新可继续当前报价；离开多久都没有额外收益或损失。
            </Text>
            <Text className="muted">
              本地存档不跨设备同步，清理浏览器数据会丢失进度。
            </Text>
            <GameButton className="secondary wide" onClick={askReset}>
              备份当前存档并重开
            </GameButton>
          </View>
        </View>
      )}
      {confirm && (
        <View className="modal-backdrop confirmation">
          <View className="sheet">
            <Text className="page-title">{confirm.title}</Text>
            <Text className="detail-story">{confirm.message}</Text>
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
            <GameButton
              className="secondary wide"
              onClick={() => setConfirm(null)}
            >
              取消
            </GameButton>
          </View>
        </View>
      )}
    </View>
  )
}
