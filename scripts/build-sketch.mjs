import { spawnSync } from 'node:child_process'
import { copyFile } from 'node:fs/promises'
const result = spawnSync(process.execPath, ['scripts/build-demo.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, STARSHOP_ART: 'sketch' },
})
if (result.status !== 0) process.exit(result.status || 1)
await copyFile('release/StarShop-demo.html', 'release/StarShop-sketch.html')
