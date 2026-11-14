import http from 'node:http'
import { readFile } from 'node:fs/promises'
const host = '127.0.0.1'
const port = Number(process.env.STARSHOP_PORT || 4179)
const demoFile = new URL('../release/StarShop-demo.html', import.meta.url)
http
  .createServer(async (req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.url !== '/' && req.url !== '/index.html') {
      res.writeHead(404)
      res.end()
      return
    }
    try {
      const html = await readFile(demoFile)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(html)
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('演示包尚未生成，请先运行 npm run build:demo。')
    }
  })
  .listen(port, host, () =>
    console.log(
      `StarShop playable: http://${host}:${port}/ (no browser launched)`,
    ),
  )
