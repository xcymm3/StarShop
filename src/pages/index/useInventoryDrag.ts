import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import {
  bounds,
  itemById,
  occupied,
  product,
  type Action,
  type Area,
  type Game,
} from '../../game/engine'
import { dimensions, fits, type Placement } from '../../game/grid'

type Rect = { left: number; top: number; width: number; height: number }
type Zone = Rect & { area: Area }
type Pending = {
  uid: string
  x: number
  y: number
  grabX: number
  grabY: number
  rotated: boolean
  started: boolean
}
export type DragView = {
  uid: string
  x: number
  y: number
  rotated: boolean
  target: Placement | null
  valid: boolean
  message: string
  width: number
  height: number
}
type Touch = {
  clientX?: number
  clientY?: number
  pageX: number
  pageY: number
}

// Temporary gesture state never mutates inventory. Only a valid release invokes the controller.
export function useInventoryDrag(
  game: Game | null,
  commit: (a: Action, reason?: string) => boolean | undefined,
  reject: (message: string) => void,
) {
  const current = useRef({ game, commit, reject })
  current.current = { game, commit, reject }
  const pending = useRef<Pending | null>(null)
  const zones = useRef<Zone[]>([])
  const viewports = useRef<Zone[]>([])
  const viewRef = useRef<DragView | null>(null)
  const [view, setView] = useState<DragView | null>(null)
  const suppressUntil = useRef(0)
  const [scrollLock, setScrollLock] = useState(false)
  const updateView = (v: DragView | null) => {
    viewRef.current = v
    setView(v)
  }
  const cancel = () => {
    pending.current = null
    updateView(null)
    setScrollLock(false)
  }
  const measure = () => {
    if (process.env.TARO_ENV === 'h5') {
      zones.current = Array.from(
        document.querySelectorAll<HTMLElement>('.inventory-drop-zone'),
      ).map((el) => ({ ...rect(el), area: el.dataset.area as Area }))
    } else {
      const query = Taro.createSelectorQuery()
      query
        .selectAll('.inventory-drop-zone')
        .fields({ rect: true, size: true, dataset: true }, (result) => {
          zones.current = (
            result as unknown as (Rect & { dataset: { area: Area } })[]
          ).map((r) => ({ ...r, area: r.dataset.area }))
        })
      query
        .selectAll('.inventory-viewport')
        .fields({ rect: true, size: true, dataset: true }, (result) => {
          viewports.current = (
            result as unknown as (Rect & { dataset: { area: Area } })[]
          ).map((r) => ({ ...r, area: r.dataset.area }))
        })
      query.exec()
    }
  }
  const start = (uid: string, x: number, y: number, source: Rect) => {
    const s = current.current.game
    const item = s && itemById(s, uid)
    if (!s || !item || s.report || s.job.active) return
    const pos = s.stagePositions[uid] ?? item
    const size = dimensions(product(item), pos.rotated)
    pending.current = {
      uid,
      x,
      y,
      rotated: pos.rotated,
      started: false,
      grabX: Math.floor((x - source.left) / (source.width / size.width)),
      grabY: Math.floor((y - source.top) / (source.height / size.height)),
    }
    measure()
  }
  const move = (x: number, y: number) => {
    const p = pending.current,
      s = current.current.game
    if (!p || !s) return
    if (!p.started && Math.hypot(x - p.x, y - p.y) < 6) return
    const item = itemById(s, p.uid)
    if (!item) {
      cancel()
      return
    }
    p.started = true
    setScrollLock(true)
    const owned = s.inventory.some((i) => i.uid === p.uid)
    // elementFromPoint respects clipping and overlays; a hidden part of a scroller is not a drop target.
    let hitArea: string | undefined
    if (process.env.TARO_ENV === 'h5') {
      measure()
      hitArea = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('.inventory-drop-zone')?.dataset.area
    }
    const zone = zones.current.find(
      (z) =>
        x >= z.left &&
        x < z.left + z.width &&
        y >= z.top &&
        y < z.top + z.height &&
        viewports.current.every(
          (v) =>
            v.area !== z.area ||
            (x >= v.left &&
              x < v.left + v.width &&
              y >= v.top &&
              y < v.top + v.height),
        ) &&
        (process.env.TARO_ENV !== 'h5' || z.area === hitArea),
    )
    const size = dimensions(product(item), p.rotated)
    let target: Placement | null = null,
      valid = false,
      message = '移到目标格子；松开空白区域会取消'
    if (zone) {
      const b = bounds(s, zone.area)
      target = {
        area: zone.area,
        x:
          Math.floor((x - zone.left) / (zone.width / b.width)) -
          Math.min(p.grabX, size.width - 1),
        y:
          Math.floor((y - zone.top) / (zone.height / b.height)) -
          Math.min(p.grabY, size.height - 1),
        rotated: p.rotated,
      }
      const allowed = owned
        ? zone.area !== 'customer'
        : zone.area === 'customer' || zone.area === 'counter'
      valid =
        allowed &&
        fits(b, { ...product(item), ...target, uid: p.uid }, occupied(s))
      message = !allowed
        ? owned
          ? '自有货不能放入顾客台面'
          : '尚未付款，不能放入仓库或展示柜'
        : valid
          ? '松开即可放置 · 不会自动成交'
          : '位置被占用或超出边界'
    }
    updateView({
      uid: p.uid,
      x,
      y,
      target,
      valid,
      message,
      rotated: p.rotated,
      width: zone
        ? (zone.width / bounds(s, zone.area).width) * size.width
        : size.width * 30,
      height: zone
        ? (zone.height / bounds(s, zone.area).height) * size.height
        : size.height * 30,
    })
  }
  const end = (x: number, y: number) => {
    const started = pending.current?.started
    if (started) {
      move(x, y)
      const v = viewRef.current
      if (v?.valid && v.target)
        current.current.commit(
          { type: 'move', uid: v.uid, ...v.target },
          '拖动物品到目标格子后松开',
        )
      else
        current.current.reject(v?.message ?? '未放入有效区域，物品已留在原位。')
      suppressUntil.current = Date.now() + 450
    }
    cancel()
  }
  const rotate = () => {
    const p = pending.current,
      v = viewRef.current
    if (p && v) {
      p.rotated = !p.rotated
      move(v.x, v.y)
    }
  }
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return
      const el = (e.target as Element).closest<HTMLElement>(
        '.grid-item[data-uid]',
      )
      if (el) start(el.dataset.uid!, e.clientX, e.clientY, rect(el))
    }
    const moving = (e: PointerEvent) => {
      if (pending.current) {
        move(e.clientX, e.clientY)
        if (pending.current?.started) e.preventDefault()
      }
    }
    const up = (e: PointerEvent) => {
      if (pending.current) end(e.clientX, e.clientY)
    }
    const click = (e: MouseEvent) => {
      if (Date.now() < suppressUntil.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const key = (e: KeyboardEvent) => {
      if (!pending.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      } else if (['r', 'R', 'q', 'Q', 'e', 'E'].includes(e.key)) {
        e.preventDefault()
        rotate()
      }
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('pointermove', moving, { passive: false })
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('click', click, true)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', cancel)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointermove', moving)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('click', click, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('blur', cancel)
    }
  }, [])
  return {
    view,
    scrollLock,
    cancel,
    rotate,
    touchStart: (uid: string, t: Touch) => {
      if (process.env.TARO_ENV === 'h5') return
      Taro.createSelectorQuery()
        .select('#item-' + uid)
        .boundingClientRect((r) => {
          if (r && !Array.isArray(r))
            start(uid, t.clientX ?? t.pageX, t.clientY ?? t.pageY, r)
        })
        .exec()
    },
    touchMove: (t: Touch) => {
      if (process.env.TARO_ENV !== 'h5')
        move(t.clientX ?? t.pageX, t.clientY ?? t.pageY)
    },
    touchEnd: (t: Touch) => {
      if (process.env.TARO_ENV !== 'h5')
        end(t.clientX ?? t.pageX, t.clientY ?? t.pageY)
    },
    canClick: () => Date.now() >= suppressUntil.current,
  }
}
function rect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
export type InventoryDrag = ReturnType<typeof useInventoryDrag>
