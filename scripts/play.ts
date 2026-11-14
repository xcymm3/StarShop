// One explicit command per invocation. No autoplay and no game-state editing API.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import path from 'node:path'
import { createGame, validateGame } from '../src/game/engine'
import { PlayerController, type Request } from '../src/game/interface'
const args = process.argv.slice(2)
const fileIndex = args.indexOf('--file')
if (fileIndex < 0 || !args[fileIndex + 1])
  throw new Error(
    '用法：npm run play -- --file artifacts/play/shop.json init|observe|act [请求JSON]',
  )
const file = path.resolve(args[fileIndex + 1])
const root = path.resolve('artifacts/play')
if (!file.startsWith(root + path.sep))
  throw new Error('交互存档只能放在 artifacts/play/ 下。')
args.splice(fileIndex, 2)
const [command, payload] = args
const persistence = {
  save(state: unknown) {
    mkdirSync(path.dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
    renameSync(tmp, file)
  },
}
if (command === 'init') {
  if (existsSync(file)) throw new Error('已有存档，禁止覆盖。')
  persistence.save(createGame())
  console.log('新店已创建，没有执行经营操作。')
} else {
  const state: unknown = JSON.parse(
    readFileSync(file, 'utf8').replace(/^\uFEFF/, ''),
  )
  if (!validateGame(state)) throw new Error('存档无效，文件未修改。')
  const controller = new PlayerController(state, persistence)
  if (command === 'observe')
    console.log(JSON.stringify(controller.observe(), null, 2))
  else if (command === 'act')
    console.log(
      JSON.stringify(controller.act(JSON.parse(payload) as Request), null, 2),
    )
  else throw new Error('只支持 init、observe、act。')
}
