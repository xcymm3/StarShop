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
  'StarShop v0.6 手机经营 Demo\n\n打开 StarShop-demo.html 即可游玩，无需安装依赖或联网。推荐现代 Chromium 浏览器。\n\n把顾客台面的来货按住拖到下方柜台，打开平板核价并确认收购；也可确认整批折扣收购。买下的货物留在柜台，可以直接拖入仓库或展示柜，↓收回只搬自有货。未购货只能在顾客台面和柜台之间移动，不会因拖动自动付款。拖动时绿色落点可放，红色不可放；R旋转，Esc取消。触屏也可拖动，或点物品在整理工具中先旋转。买入不会自动鉴定。红色按钮送客，蓝色按钮打开账本；店招可升级，右侧对讲机打开手册。\n\n把自有货拖上柜台，再查看逐件报价和拒收原因，确认出售只移除被接受的货物；拒收货仍留台，可直接拖回。买家按偏好和共享预算购货，每客可还价一次。每次确认成交算一笔，批量仍只算一笔；五笔日结，第七日结束出房租账单，主动付款或确认延期。操作后立即存档，无离线收益和惩罚。\n\n如果浏览器限制 file:// 存储，请在项目目录运行 npm run demo:serve 并访问 http://127.0.0.1:4179/。\n\n游戏素材沿用已认可的原创重绘。数值与流程边界见源项目docs目录；微信真机和长期经济平衡尚未验证。\n',
  'utf8',
)
console.log('Demo ready: release/StarShop-demo.html')
