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
  'StarShop 竖屏经营 Demo\n\n打开 StarShop-demo.html 即可游玩，无需安装依赖或联网。推荐现代 Chromium 浏览器。\n\n收购与出售均计成交，5笔一天、7天周租。操作后保存在当前浏览器本地，不跨设备同步，无离线收益和惩罚。\n\n如果浏览器限制 file:// 存储，请在项目目录运行 npm run demo:serve 并访问 http://127.0.0.1:4179/。\n\n游戏素材为参照原作视觉语言的原创重绘。数值对照见源项目docs目录。\n',
  'utf8',
)
console.log('Demo ready: release/StarShop-demo.html')
