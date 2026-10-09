import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'

export function makeDist() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'))
  fs.mkdirSync(path.join(dir, 'assets'))
  fs.writeFileSync(path.join(dir, 'index.html'), '<html><body>SPA-INDEX</body></html>')
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbC123xy.js'), 'console.log("hashed")')
  fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n')
  fs.writeFileSync(path.join(dir, 'resume.pdf'), '%PDF-1.4 fake')
  fs.writeFileSync(path.join(dir, 'assets', 'plain.js'), 'console.log("plain")')
  fs.writeFileSync(path.join(dir, 'assets', 'my-long-name.css'), 'body{}')
  fs.mkdirSync(path.join(dir, 'resume'))
  fs.writeFileSync(path.join(dir, 'resume', 'cv.txt'), 'cv')
  fs.writeFileSync(path.join(dir, '.env'), 'SECRET=1')
  return dir
}

export function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

// A tiny upstream. `respond(req, res, body)` is called for every request.
export async function startUpstream(respond) {
  const requests = []
  const connections = { count: 0 }
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      })
      if (respond) respond(req, res, body)
      else res.end('ok')
    })
  })
  server.on('connection', () => { connections.count++ })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address()
  return {
    requests,
    connections,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
  }
}

export async function closedPortUrl() {
  const s = net.createServer()
  await new Promise((r) => s.listen(0, '127.0.0.1', r))
  const { port } = s.address()
  await new Promise((r) => s.close(r))
  return `http://127.0.0.1:${port}`
}

export async function listenApp(app) {
  const server = http.createServer(app)
  const connections = { count: 0 }
  server.on('connection', () => { connections.count++ })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return {
    port: server.address().port,
    connections,
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
  }
}

export async function freePort() {
  const s = net.createServer()
  await new Promise((r) => s.listen(0, '127.0.0.1', r))
  const { port } = s.address()
  await new Promise((r) => s.close(r))
  return port
}
