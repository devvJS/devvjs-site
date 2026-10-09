import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { makeDist, rmDir, startUpstream, freePort } from './helpers.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let dist
let upstream
let handlerCalls
let app
let plainApp

beforeAll(async () => {
  dist = makeDist()
  upstream = await startUpstream((req, res) => res.end('upstream'))
  handlerCalls = 0
  const handlers = {
    githubStats: (req, res) => { handlerCalls++; res.status(200).json({}) },
    projects: (req, res) => { handlerCalls++; res.status(200).json({}) },
  }
  app = createApp({ distDir: dist, trackerUrl: upstream.url, handlers, canonicalHost: 'devvjs.dev' })
  plainApp = createApp({ distDir: dist, trackerUrl: upstream.url, handlers })
})
afterAll(async () => {
  rmDir(dist)
  await upstream.close()
})

const isRedirect = (res) => [301, 308].includes(res.status) || res.headers.location !== undefined

describe('www redirect (canonicalHost set)', () => {
  it('GET / on www gives 301 to https://devvjs.dev/', async () => {
    const res = await request(app).get('/').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/')
  })

  it('keeps path and query byte-exact', async () => {
    const res = await request(app).get('/resume?x=1&y=%20z').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/resume?x=1&y=%20z')
  })

  it('redirects /job-tracker/* without contacting the tracker', async () => {
    const before = upstream.requests.length
    const res = await request(app).get('/job-tracker/api/applications').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/job-tracker/api/applications')
    expect(upstream.requests.length).toBe(before)
  })

  it('redirects /api/projects without calling the handler', async () => {
    const before = handlerCalls
    const res = await request(app).get('/api/projects').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/api/projects')
    expect(handlerCalls).toBe(before)
  })

  it('redirects static files', async () => {
    const res = await request(app).get('/robots.txt').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/robots.txt')
  })

  it('HEAD gives 301', async () => {
    const res = await request(app).head('/resume?x=1').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/resume?x=1')
  })

  it('POST gives 308 with the same Location, tracker not contacted', async () => {
    const before = upstream.requests.length
    const res = await request(app).post('/job-tracker/api/applications?a=1').send({ a: 1 })
      .set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(308)
    expect(res.headers.location).toBe('https://devvjs.dev/job-tracker/api/applications?a=1')
    expect(upstream.requests.length).toBe(before)
  })

  it('PATCH gives 308 with the same Location', async () => {
    const res = await request(app).patch('/api/projects').send({ a: 1 })
      .set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(308)
    expect(res.headers.location).toBe('https://devvjs.dev/api/projects')
  })

  it('matches Host case-insensitively and ignores the port', async () => {
    const res = await request(app).get('/x').set('Host', 'WWW.DEVVJS.DEV:443').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/x')
  })

  it('sets no Set-Cookie', async () => {
    const res = await request(app).get('/').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('never takes the Location host from X-Forwarded-Host', async () => {
    const res = await request(app).get('/a?b=1').set('Host', 'www.devvjs.dev')
      .set('X-Forwarded-Host', 'evil.com').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/a?b=1')
  })
})

describe('www redirect guards (these pass before the fix)', () => {
  for (const host of [
    'devvjs.dev',
    'site-production-725d.up.railway.app',
    'www.evil.com',
    'www.devvjs.dev.evil.com',
    'evilwww.devvjs.dev',
  ]) {
    it(`leaves Host ${host} alone`, async () => {
      const res = await request(app).get('/').set('Host', host).redirects(0)
      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
      expect(res.text).toContain('SPA-INDEX')
    })
  }

  it('does nothing when canonicalHost is unset', async () => {
    const res = await request(plainApp).get('/').set('Host', 'www.devvjs.dev').redirects(0)
    expect(isRedirect(res)).toBe(false)
    expect(res.status).toBe(200)
  })

  it('/healthz with Host localhost still gives 200 {ok:true}', async () => {
    const res = await request(app).get('/healthz').set('Host', 'localhost').redirects(0)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('server.js CANONICAL_HOST', () => {
  it('redirects www to the canonical host', async () => {
    const port = await freePort()
    const child = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), TRACKER_URL: 'http://127.0.0.1:1', CANONICAL_HOST: 'devvjs.dev' },
    })
    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('server did not start')), 10000)
        child.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(t); resolve() } })
        child.on('close', () => { clearTimeout(t); reject(new Error('server exited early')) })
      })
      const res = await new Promise((resolve, reject) => {
        const req = http.request(
          { host: '127.0.0.1', port, path: '/resume?x=1', method: 'GET', headers: { Host: 'www.devvjs.dev' } },
          (r) => { r.resume(); r.on('end', () => resolve(r)) },
        )
        req.on('error', reject)
        req.end()
      })
      expect(res.statusCode).toBe(301)
      expect(res.headers.location).toBe('https://devvjs.dev/resume?x=1')
    } finally {
      child.kill('SIGKILL')
      await new Promise((r) => (child.exitCode !== null || child.signalCode ? r() : child.on('close', r)))
    }
  })
})

// ---- Revision 1 ----

async function spawnServer(canonical) {
  const port = await freePort()
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), TRACKER_URL: 'http://127.0.0.1:1', CANONICAL_HOST: canonical },
  })
  let err = ''
  child.stderr.on('data', (d) => { err += d })
  const closed = new Promise((r) => child.on('close', (code) => r(code)))
  return { child, port, closed, stderr: () => err }
}

async function waitListening(srv) {
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 10000)
    srv.child.stdout.on('data', (d) => { if (String(d).includes('listening')) { clearTimeout(t); resolve() } })
    srv.closed.then(() => { clearTimeout(t); reject(new Error('server exited early')) })
  })
}

async function stopServer(srv) {
  srv.child.kill('SIGKILL')
  await srv.closed
}

function rawRequest(port, head) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1')
    let data = ''
    sock.setTimeout(5000, () => { sock.destroy(); reject(new Error('timeout')) })
    sock.on('data', (d) => { data += d })
    sock.on('error', reject)
    sock.on('close', () => resolve(data))
    sock.write(head)
  })
}

const statusOf = (raw) => Number(raw.split(' ')[1])
const locationOf = (raw) => (raw.match(/^location:\s*(.*)$/im) || [])[1]

describe('revision 1: gap tests (pass now)', () => {
  it('Location is byte-exact for URLs res.redirect would re-encode, with no body or content-type', async () => {
    const res = await request(app).get('/a%zz?b=%zz').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/a%zz?b=%zz')
    expect(res.text).toBe('')
    expect(res.headers['content-type']).toBeUndefined()
  })

  it('/healthz on www is redirected too', async () => {
    const res = await request(app).get('/healthz').set('Host', 'www.devvjs.dev').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/healthz')
  })

  it('createApp throws for a canonicalHost with a port', () => {
    expect(() => createApp({ distDir: dist, canonicalHost: 'devvjs.dev:443' })).toThrow()
  })

  it('server.js exits 1 with "Could not start: Invalid canonical host" for CANONICAL_HOST=https://devvjs.dev', async () => {
    const srv = await spawnServer('https://devvjs.dev')
    const timer = setTimeout(() => srv.child.kill('SIGKILL'), 10000)
    const code = await srv.closed
    clearTimeout(timer)
    expect(code).toBe(1)
    expect(srv.stderr()).toContain('Could not start: Invalid canonical host')
  })

  it('server.js with CANONICAL_HOST="" starts and does not redirect www', async () => {
    const srv = await spawnServer('')
    try {
      await waitListening(srv)
      const raw = await rawRequest(srv.port, 'GET /healthz HTTP/1.1\r\nHost: www.devvjs.dev\r\nConnection: close\r\n\r\n')
      expect(statusOf(raw)).toBe(200)
      expect(locationOf(raw)).toBeUndefined()
    } finally {
      await stopServer(srv)
    }
  })
})

describe('revision 1: new behavior (fail now)', () => {
  it('does not redirect an absolute-form request target', async () => {
    const srv = await spawnServer('devvjs.dev')
    try {
      await waitListening(srv)
      const raw = await rawRequest(srv.port, 'GET http://evil.com/p HTTP/1.1\r\nHost: www.devvjs.dev\r\nConnection: close\r\n\r\n')
      const status = statusOf(raw)
      expect(status).toBeGreaterThanOrEqual(100)
      expect([301, 302, 303, 307, 308]).not.toContain(status)
      expect(locationOf(raw)).toBeUndefined()
      expect(raw).not.toContain('devvjs.devhttp')
    } finally {
      await stopServer(srv)
    }
  })

  it('does not redirect OPTIONS *', async () => {
    const srv = await spawnServer('devvjs.dev')
    try {
      await waitListening(srv)
      const raw = await rawRequest(srv.port, 'OPTIONS * HTTP/1.1\r\nHost: www.devvjs.dev\r\nConnection: close\r\n\r\n')
      const status = statusOf(raw)
      expect(status).toBeGreaterThanOrEqual(100)
      expect([301, 302, 303, 307, 308]).not.toContain(status)
      expect(locationOf(raw)).toBeUndefined()
      expect(raw).not.toContain('devvjs.dev*')
    } finally {
      await stopServer(srv)
    }
  })

  it('Host www.devvjs.dev. (one trailing dot) redirects to the apex', async () => {
    const res = await request(app).get('/x?y=1').set('Host', 'www.devvjs.dev.').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('https://devvjs.dev/x?y=1')
  })

  it('Host devvjs.dev. (trailing dot) is not redirected', async () => {
    const res = await request(app).get('/').set('Host', 'devvjs.dev.').redirects(0)
    expect(isRedirect(res)).toBe(false)
    expect(res.status).toBe(200)
  })

  it('createApp throws when canonicalHost itself starts with "www."', () => {
    expect(() => createApp({ distDir: dist, canonicalHost: 'www.devvjs.dev' })).toThrow()
  })
})
