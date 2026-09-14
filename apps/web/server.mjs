import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWebStore } from './web-store.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const workspace = path.resolve(root, '../..')
const webStore = createWebStore({ file: path.resolve(process.env.TRACE_WEB_STATE_FILE || path.join(workspace, '.trace/state/web.sqlite')) })
const requestedPort = Number(process.env.TRACE_DESKTOP_PORT ?? '4173')
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.json', 'application/json; charset=utf-8'],
])

function resolveAsset(url = '/') {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const absolute = path.resolve(root, relative)
  return absolute === root || absolute.startsWith(`${root}${path.sep}`) ? absolute : null
}

const server = http.createServer(async (request, response) => {
  try {
  if (await webStore.handle(request, response)) return
  const asset = resolveAsset(request.url)
  const allowedAsset = asset && (['index.html','legacy.html'].includes(path.basename(asset)) && path.dirname(asset) === root || asset.startsWith(path.join(root,'src') + path.sep) || asset.startsWith(path.join(root,'public') + path.sep))
  if (!allowedAsset || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  response.writeHead(200, {
    'content-type': mimeTypes.get(path.extname(asset).toLowerCase()) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  fs.createReadStream(asset).pipe(response)
  } catch (error) {
    console.error(error)
    if (!response.headersSent) response.writeHead(500, {'content-type':'text/plain; charset=utf-8'})
    response.end('Unable to serve this request')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Trace Web: http://127.0.0.1:${port}/`)
  console.log(`Local Web data: ${webStore.file}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { webStore.close(); process.exit(0) }))
}
