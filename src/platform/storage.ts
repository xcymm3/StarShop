import Taro from '@tarojs/taro'
import { createGame, validateGame, migrateV1, type Game } from '../game/engine'

export const KEY = 'starshop-save-v2'
export const save = (state: Game) =>
  Taro.setStorageSync(KEY, JSON.stringify(state))
export function load(): Game {
  const raw = Taro.getStorageSync(KEY)
  if (raw === '' || raw === null || raw === undefined) {
    if (Taro.getStorageInfoSync().keys.includes(KEY))
      throw new Error('存档封装已损坏，原数据已保留。')
    const legacy = Taro.getStorageSync('starshop-save-v1')
    if (legacy !== '' && legacy !== null && legacy !== undefined) {
      Taro.setStorageSync('starshop-save-v1-backup', legacy)
      const state = migrateV1(
        typeof legacy === 'string' ? JSON.parse(legacy) : legacy,
      )
      save(state)
      return state
    }
    const state = createGame()
    save(state)
    return state
  }
  const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!validateGame(parsed)) throw new Error('存档结构无法识别，原数据已保留。')
  return parsed
}
export function restart(): Game {
  const old = Taro.getStorageSync(KEY)
  if (!old && Taro.getStorageInfoSync().keys.includes(KEY))
    throw new Error('无法读取旧档进行备份，请先保留损坏数据。')
  if (old) Taro.setStorageSync(`${KEY}-backup`, old)
  const next = createGame()
  save(next)
  return next
}
