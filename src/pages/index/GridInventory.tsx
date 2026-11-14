import { Button, Image, Text, View, type ITouchEvent } from '@tarojs/components'
import {
  bounds,
  product,
  type Game,
  type Item,
  type Area,
} from '../../game/engine'
import { dimensions } from '../../game/grid'
import { itemArt } from '../../assets'
import type { InventoryDrag } from './useInventoryDrag'
// Native mini-program View with catchMove prevents scrolling while dragging an item.
// Empty grid space remains scrollable; H5 keeps its normal button semantics.
const ItemSurface = process.env.TARO_ENV === 'h5' ? Button : View

export function GridInventory({
  game,
  area,
  selected,
  rotated,
  onItem,
  onCell,
  compact = false,
  fill = false,
  drag,
}: {
  game: Game
  area: Area
  selected?: Item | null
  rotated?: boolean
  compact?: boolean
  fill?: boolean
  drag?: InventoryDrag
  onItem(item: Item, owned: boolean): void
  onCell(x: number, y: number): void
}) {
  const b = bounds(game, area)
  const owned = game.inventory.filter((i) => i.area === area)
  const incoming =
    game.visitor?.kind === 'seller'
      ? game.visitor.stock
          .map((i) => ({ ...i, ...game.stagePositions[i.uid] }))
          .filter((i) => i.area === area)
      : []
  const preview = drag?.view?.target?.area === area ? drag.view : null
  return (
    <View
      className={
        'grid-frame ' +
        (selected ? 'placing ' : '') +
        (compact ? 'compact-grid' : '')
      }
      style={
        fill
          ? { height: '100%', paddingBottom: 0 }
          : { paddingBottom: (b.height / b.width) * 100 + '%' }
      }
      data-area={area}
    >
      <View
        className="grid-interior inventory-drop-zone"
        id={'grid-' + area}
        data-area={area}
      >
        {Array.from({ length: b.width * b.height }, (_, n) => {
          const x = n % b.width,
            y = Math.floor(n / b.width)
          return (
            <Button
              {...{ role: 'button' }}
              key={n}
              className="grid-cell"
              aria-label={area + '格子 ' + x + ',' + y}
              style={{
                left: (x / b.width) * 100 + '%',
                top: (y / b.height) * 100 + '%',
                width: 100 / b.width + '%',
                height: 100 / b.height + '%',
              }}
              onClick={() => onCell(x, y)}
            >
              {selected && x === 0 && y === 0 ? '·' : ''}
            </Button>
          )
        })}
        {[...owned, ...incoming].map((item) => {
          const isOwned = owned.some((i) => i.uid === item.uid),
            size = dimensions(product(item), item.rotated)
          return (
            <ItemSurface
              {...{ role: 'button' }}
              key={item.uid}
              {...(process.env.TARO_ENV !== 'h5' ? { catchMove: true } : {})}
              id={'item-' + item.uid}
              data-uid={item.uid}
              className={
                'grid-item ' +
                (!isOwned ? 'unowned ' : '') +
                (game.staged.includes(item.uid) ? 'reserved ' : '') +
                (selected?.uid === item.uid || drag?.view?.uid === item.uid
                  ? 'moving'
                  : '')
              }
              aria-label={
                (isOwned ? '库存 ' : '暂放 ') +
                product(item).name +
                ' ' +
                item.uid
              }
              style={{
                left: (item.x / b.width) * 100 + '%',
                top: (item.y / b.height) * 100 + '%',
                width: (size.width / b.width) * 100 + '%',
                height: (size.height / b.height) * 100 + '%',
              }}
              onClick={() =>
                drag?.canClick() !== false &&
                (selected ? onCell(item.x, item.y) : onItem(item, isOwned))
              }
              onTouchStart={(e) =>
                (e as ITouchEvent).touches[0] &&
                drag?.touchStart(item.uid, (e as ITouchEvent).touches[0])
              }
              onTouchMove={(e) =>
                (e as ITouchEvent).touches[0] &&
                drag?.touchMove((e as ITouchEvent).touches[0])
              }
              onTouchEnd={(e) =>
                (e as ITouchEvent).changedTouches[0] &&
                drag?.touchEnd((e as ITouchEvent).changedTouches[0])
              }
              onTouchCancel={() => drag?.cancel()}
            >
              <Image
                src={itemArt[item.productId]}
                mode="aspectFit"
                className="grid-art"
              />
              {!item.known && <Text className="unknown-mark">?</Text>}
              {!isOwned && <Text className="ownership-mark">待购</Text>}
              {!compact && (
                <Text className="grid-item-name">{product(item).name}</Text>
              )}
            </ItemSurface>
          )
        })}
        {preview?.target &&
          (() => {
            const item = [
              ...owned,
              ...incoming,
              ...game.inventory,
              ...(game.visitor?.stock ?? []),
            ].find((i) => i.uid === preview.uid)!
            const size = dimensions(product(item), preview.rotated)
            return (
              <View
                className={
                  'drop-preview ' + (preview.valid ? 'valid' : 'invalid')
                }
                style={{
                  left: (preview.target.x / b.width) * 100 + '%',
                  top: (preview.target.y / b.height) * 100 + '%',
                  width: (size.width / b.width) * 100 + '%',
                  height: (size.height / b.height) * 100 + '%',
                }}
              />
            )
          })()}
        {selected && (
          <Text className="grid-hint">
            {dimensions(product(selected), !!rotated).width}×
            {dimensions(product(selected), !!rotated).height} · 点空位放置
          </Text>
        )}
      </View>
    </View>
  )
}
