import { Button, Image, Text, View } from '@tarojs/components'
import {
  bounds,
  product,
  type Game,
  type Item,
  type Area,
} from '../../game/engine'
import { dimensions } from '../../game/grid'
import { itemArt } from '../../assets'

export function GridInventory({
  game,
  area,
  selected,
  rotated,
  onItem,
  onCell,
  compact = false,
}: {
  game: Game
  area: Area
  selected?: Item | null
  rotated?: boolean
  compact?: boolean
  onItem(item: Item, owned: boolean): void
  onCell(x: number, y: number): void
}) {
  const b = bounds(game, area)
  const owned = game.inventory.filter((i) => i.area === area)
  const incoming =
    area === 'counter' && game.visitor?.kind === 'seller'
      ? game.visitor.stock
          .filter((i) => game.staged.includes(i.uid))
          .map((i) => ({ ...i, ...game.stagePositions[i.uid] }))
      : []
  return (
    <View
      className={
        'grid-frame ' +
        (selected ? 'placing ' : '') +
        (compact ? 'compact-grid' : '')
      }
      style={{ paddingBottom: (b.height / b.width) * 100 + '%' }}
      data-area={area}
    >
      <View className="grid-interior">
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
            <Button
              {...{ role: 'button' }}
              key={item.uid}
              className={
                'grid-item ' +
                (!isOwned ? 'unowned ' : '') +
                (game.staged.includes(item.uid) ? 'reserved ' : '') +
                (selected?.uid === item.uid ? 'moving' : '')
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
                selected ? onCell(item.x, item.y) : onItem(item, isOwned)
              }
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
            </Button>
          )
        })}
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
