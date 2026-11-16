export type Area = 'warehouse' | 'counter' | 'showcase' | 'customer'
export interface Placement {
  area: Area
  x: number
  y: number
  rotated: boolean
}
export interface Footprint {
  width: number
  height: number
}
export interface Located extends Placement, Footprint {
  uid: string
}
export interface Bounds {
  width: number
  height: number
}
export function dimensions(shape: Footprint, rotated: boolean): Bounds {
  return rotated ? { width: shape.height, height: shape.width } : { ...shape }
}
export function fits(
  bounds: Bounds,
  item: Located,
  others: Located[],
): boolean {
  const size = dimensions(item, item.rotated)
  if (
    ![item.x, item.y].every(Number.isSafeInteger) ||
    item.x < 0 ||
    item.y < 0 ||
    item.x + size.width > bounds.width ||
    item.y + size.height > bounds.height
  )
    return false
  return others.every((other) => {
    if (other.uid === item.uid || other.area !== item.area) return true
    const s = dimensions(other, other.rotated)
    return (
      item.x + size.width <= other.x ||
      other.x + s.width <= item.x ||
      item.y + size.height <= other.y ||
      other.y + s.height <= item.y
    )
  })
}
export function firstFit(
  bounds: Bounds,
  shape: Footprint,
  area: Area,
  uid: string,
  others: Located[],
  orientations: boolean[] = [false, true],
): Placement | null {
  for (const rotated of orientations) {
    const size = dimensions(shape, rotated)
    for (let y = 0; y <= bounds.height - size.height; y++)
      for (let x = 0; x <= bounds.width - size.width; x++) {
        const item = { ...shape, uid, area, x, y, rotated }
        if (fits(bounds, item, others)) return { area, x, y, rotated }
      }
  }
  return null
}
