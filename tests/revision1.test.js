import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { makeDist, rmDir, startUpstream, listenApp, freePort } from './helpers.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const handlers = {
  githubStats: (req, res) => res.status(200).json({}),
  projects: (req, res) => res.status(200).json({}),
}
const TTL = 600000

let dist
beforeAll(() => { dist = makeDist() })
afterAll(() => rmDir(dist))

// Raw client so header names and values are sent exactly as given.
function rawGet(port, urlPath, headers = {}, agent) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'GET', headers, agent }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('A1 proxy boundary', () => {
  it('/job-trackerX is 404 JSON and never reaches the upstream; // and case variants neither', async () => {
    const up = await startUpstream()
    const app = createApp({ distDir: dist, trackerUrl: up.url, handlers })
    try {
      const x = await request(app).get('/job-trackerX')
      expect(x.status).toBe(404)
      expect(x.headers['content-type']).toMatch(/application\/json/)
      expect(x.text).not.toContain('SPA-INDEX')
      await request(app).get('//job-tracker/x')
      await request(app).get('/Job-Tracker/x')
      expect(up.requests).toHaveLength(0)
    } finally {
      await up.close()
    }
  })
})

describe('A2 server.js logging and shutdown', () => {
  it('never logs GITHUB_TOKEN and exits 0 on SIGTERM', async () => {
    const port = await freePort()
    const sentinel = 'SENTINEL-gh-token-9f8e7d6c'
    const child = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), TRACKER_URL: 'http://127.0.0.1:1', GITHUB_TOKEN: sentinel },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    const exited = new Promise((r) => child.on('close', (code, sig) => r({ code, sig })))
    const killer = setTimeout(() => child.kill('SIGKILL'), 12000)
    try {
      // wait until it serves
      let ok = false
      for (let i = 0; i < 100 && !ok; i++) {
        try {
          const r = await rawGet(port, '/healthz')
          ok = r.status === 200
        } catch { await new Promise((r) => setTimeout(r, 50)) }
      }
      expect(ok).toBe(true)
      child.kill('SIGTERM')
      const { code } = await exited
      expect(code).toBe(0)
      expect(out).not.toContain(sentinel)
      expect(err).not.toContain(sentinel)
    } finally {
      clearTimeout(killer)
      child.kill('SIGKILL')
    }
  })
})

describe('A3 error handler', () => {
  it('a dist without index.html gives exactly 500 {"error":"internal"}', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dist-'))
    fs.mkdirSync(path.join(empty, 'index.html'))
    try {
      const app = createApp({ distDir: empty, trackerUrl: 'http://127.0.0.1:1', handlers })
      const res = await request(app).get('/')
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: 'internal' })
      expect(res.text).not.toMatch(/ENOENT|index\.html|\bat\s/)
    } finally {
      rmDir(empty)
    }
  })
})

describe('A4 / B10 static cache rules', () => {
  const imm = 'public, max-age=31536000, immutable'
  it('only hashed assets are immutable', async () => {
    const app = createApp({ distDir: dist, trackerUrl: 'http://127.0.0.1:1', handlers })
    for (const p of ['/robots.txt', '/resume.pdf', '/assets/plain.js']) {
      const res = await request(app).get(p)
      expect(res.status, p).toBe(200)
      expect(res.headers['cache-control'], p).not.toBe(imm)
    }
    const hashed = await request(app).get('/assets/index-AbC123xy.js')
    expect(hashed.headers['cache-control']).toBe(imm)
  })

  it('B10: an unhashed name with hyphens (assets/my-long-name.css) is not immutable', async () => {
    const app = createApp({ distDir: dist, trackerUrl: 'http://127.0.0.1:1', handlers })
    const res = await request(app).get('/assets/my-long-name.css')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).not.toBe(imm)
  })

  it('directory route /resume serves index.html 200 without redirect', async () => {
    const app = createApp({ distDir: dist, trackerUrl: 'http://127.0.0.1:1', handlers })
    const res = await request(app).get('/resume').redirects(0)
    expect(res.status).toBe(200)
    expect(res.text).toContain('SPA-INDEX')
    expect(res.headers.location).toBeUndefined()
  })

  it('dotfiles are 404', async () => {
    const app = createApp({ distDir: dist, trackerUrl: 'http://127.0.0.1:1', handlers })
    const res = await request(app).get('/.env')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('SECRET=1')
  })
})

describe('A5 cache extras', () => {
  async function mount(handler, opts) {
    const { cached } = await import('../server/cache.js')
    const { default: express } = await import('express')
    const a = express()
    a.get('/x', cached(handler, opts))
    return a
  }

  it('MISS exactly at ttlMs', async () => {
    let t = 0
    let n = 0
    const a = await mount((req, res) => res.status(200).json({ n: ++n }), { ttlMs: 1000, now: () => t })
    await request(a).get('/x')
    t = 1000
    const r = await request(a).get('/x')
    expect(r.headers['x-cache']).toBe('MISS')
    expect(r.body).toEqual({ n: 2 })
  })

  it('hanging handler without stale: 504 upstream_timeout', async () => {
    const a = await mount(() => new Promise(() => {}), { ttlMs: 1000, now: () => 0, timeoutMs: 80 })
    const r = await request(a).get('/x')
    expect(r.status).toBe(504)
    expect(r.body).toEqual({ error: 'upstream_timeout' })
  })

  it('hanging handler with stale: STALE', async () => {
    let t = 0
    let n = 0
    const a = await mount(
      (req, res) => (++n === 1 ? res.status(200).json({ v: 1 }) : new Promise(() => {})),
      { ttlMs: 1000, now: () => t, timeoutMs: 80 },
    )
    await request(a).get('/x')
    t = 5000
    const r = await request(a).get('/x')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ v: 1 })
    expect(r.headers['x-cache']).toBe('STALE')
  })

  it('5 concurrent requests after expiry whose shared run fails are all STALE with 1 call', async () => {
    let t = 0
    let n = 0
    const a = await mount(
      async (req, res) => {
        n++
        if (n === 1) return res.status(200).json({ v: 1 })
        await new Promise((r) => setTimeout(r, 150))
        return res.status(502).json({ error: 'x' })
      },
      { ttlMs: 1000, now: () => t },
    )
    await request(a).get('/x')
    t = 5000
    const rs = await Promise.all(Array.from({ length: 5 }, () => request(a).get('/x')))
    expect(n).toBe(2)
    for (const r of rs) {
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ v: 1 })
      expect(r.headers['x-cache']).toBe('STALE')
    }
  })

  it('ignores the query string', async () => {
    let n = 0
    const app = createApp({
      distDir: dist,
      trackerUrl: 'http://127.0.0.1:1',
      now: () => 1,
      handlers: { ...handlers, projects: (req, res) => res.status(200).json({ n: ++n }) },
    })
    const a = await request(app).get('/api/projects?x=1')
    const b = await request(app).get('/api/projects?x=2')
    expect(a.headers['x-cache']).toBe('MISS')
    expect(b.headers['x-cache']).toBe('HIT')
    expect(b.body).toEqual({ n: 1 })
    expect(TTL).toBe(600000)
  })
})

describe('B7 hop-by-hop headers', () => {
  it('are not forwarded; normal headers are', async () => {
    const up = await startUpstream()
    const app = createApp({ distDir: dist, trackerUrl: up.url, handlers })
    const srv = await listenApp(app)
    try {
      const res = await rawGet(srv.port, '/job-tracker/api/x', {
        Connection: 'keep-alive, X-Secret-Hop',
        'X-Secret-Hop': '1',
        TE: 'trailers',
        'Keep-Alive': 'timeout=5',
        'Proxy-Authorization': 'x',
        'Proxy-Connection': 'x',
        Cookie: 'sid=1',
        Authorization: 'Bearer t',
      })
      expect(res.status).toBe(200)
      const h = up.requests[0].headers
      expect(h['x-secret-hop']).toBeUndefined()
      expect(h.te).toBeUndefined()
      expect(h['keep-alive']).toBeUndefined()
      expect(h['proxy-authorization']).toBeUndefined()
      expect(h['proxy-connection']).toBeUndefined()
      expect(h.cookie).toBe('sid=1')
      expect(h.authorization).toBe('Bearer t')
    } finally {
      await srv.close()
      await up.close()
    }
  })
})

describe('B8 keep-alive', () => {
  it('proxied response has no Connection: close and one socket serves two requests', async () => {
    const up = await startUpstream()
    const app = createApp({ distDir: dist, trackerUrl: up.url, handlers })
    const srv = await listenApp(app)
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
    try {
      const a = await rawGet(srv.port, '/job-tracker/a', {}, agent)
      const b = await rawGet(srv.port, '/job-tracker/b', {}, agent)
      expect(a.status).toBe(200)
      expect(b.status).toBe(200)
      expect(String(a.headers.connection ?? '').toLowerCase()).not.toBe('close')
      expect(String(b.headers.connection ?? '').toLowerCase()).not.toBe('close')
      expect(srv.connections.count).toBe(1)
      expect(up.requests.map((r) => r.url)).toEqual(['/job-tracker/a', '/job-tracker/b'])
    } finally {
      agent.destroy()
      await srv.close()
      await up.close()
    }
  })
})

describe('B9 proxy timeout', () => {
  it('an upstream that never responds gives 504 tracker_timeout in bounded time', async () => {
    const up = await startUpstream(() => { /* accept, never answer */ })
    const app = createApp({ distDir: dist, trackerUrl: up.url, handlers, proxyTimeoutMs: 300 })
    const started = Date.now()
    try {
      const res = await request(app).get('/job-tracker/slow')
      expect(res.status).toBe(504)
      expect(res.body).toEqual({ error: 'tracker_timeout' })
      expect(Date.now() - started).toBeLessThan(5000)
    } finally {
      await up.close()
    }
  })
})
