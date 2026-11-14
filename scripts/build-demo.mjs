import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const result = spawnSync(
  process.execPath,
  [path.resolve('node_modules/@tarojs/cli/bin/taro'), 'build', '--type', 'h5'],
  {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, STARSHOP_DEMO: '1' },
  },
)
if (result.status !== 0) process.exit(result.status || 1)
await mkdir('release', { recursive: true })
let html = await readFile('dist/demo/index.html', 'utf8')
async function embed(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) {
      await embed(file)
      continue
    }
    if (!/\.(png|jpe?g|svg|webp)$/i.test(file)) continue
    const rel = path.relative('dist/demo', file).split(path.sep).join('/')
    const mime = file.endsWith('.svg')
      ? 'image/svg+xml'
      : file.endsWith('.webp')
        ? 'image/webp'
        : /\.jpe?g$/.test(file)
          ? 'image/jpeg'
          : 'image/png'
    const data = `data:${mime};base64,${(await readFile(file)).toString('base64')}`
    for (const ref of [`/${rel}`, `/${rel.replaceAll('/', '\\')}`, `./${rel}`])
      html = html.replaceAll(JSON.stringify(ref), JSON.stringify(data))
  }
}
await embed('dist/demo')
if (/<script[^>]*\ssrc=|<link[^>]*rel="stylesheet"/i.test(html))
  throw new Error('Standalone demo still has external code or styles')
await writeFile('release/StarShop-demo.html', html)
await writeFile(
  'release/游玩说明.txt',
  'StarShop v0.3 手机经营 Demo\n\n打开 StarShop-demo.html 即可游玩，无需安装依赖或联网。推荐现代 Chromium 浏览器。\n\n打开交易平板挑货，暂放后确认收购；买下的货物留在柜台，点它选择整理，可旋转、点格子放置或自动找空位。虚线为顾客的未购商品。买入不会自动鉴定。\n\n买家按偏好和共享预算购货，每客可还价一次。每次确认成交算一笔，批量仍只算一笔；五笔日结，第七日结束出房租账单，主动付款或确认延期。操作后立即存档，无离线收益和惩罚。\n\n如果浏览器限制 file:// 存储，请在项目目录运行 npm run demo:serve 并访问 http://127.0.0.1:4179/。\n\n游戏素材沿用已认可的原创重绘。数值与流程边界见源项目docs目录；微信真机和长期经济平衡尚未验证。\n',
  'utf8',
)
console.log('Demo ready: release/StarShop-demo.html')
