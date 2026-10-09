import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import net from 'node:net'
import { Buffer } from 'node:buffer'
import { createApp } from '../server/app.js'
import { makeDist, rmDir, startUpstream, listenApp } from './helpers.js'

const handlers = {
  githubStats: (req, res) => res.status(200).json({}),
  projects: (req, res) => res.status(200).json({}),
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let dist
beforeAll(() => { dist = makeDist() })
afterAll(() => rmDir(dist))

// Sends raw bytes, collects everything until the server closes or `waitMs` of quiet.
function rawSocket(port, payload, waitMs = 400) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1')
    const chunks = []
    let timer
    const done = () => { clearTimeout(timer); sock.destroy(); resolve(Buffer.concat(chunks).toString('latin1')) }
    const bump = () => { clearTimeout(timer); timer = setTimeout(done, waitMs) }
    sock.on('connect', () => { sock.write(payload); bump() })
    sock.on('data', (c) => { chunks.push(c); bump() })
    sock.on('close', done)
    sock.on('error', reject)
  })
}

async function withProxy(respond, opts, fn) {
  const up = await startUpstream(respond)
  const app = createApp({ distDir: dist, trackerUrl: up.url, handlers, ...opts })
  const srv = await listenApp(app)
  try {
    await fn({ up, srv })
  } finally {
    await srv.close()
    await up.close()
  }
}

describe('framing guard', () => {
  it('Connection: Content-Length cannot smuggle a second request upstream', async () => {
    await withProxy(undefined, {}, async ({ up, srv }) => {
      const body = 'GET /healthz HTTP/1.1\r\nHost: tracker\r\n\r\n'
      const n = Buffer.byteLength(body)
      await rawSocket(
        srv.port,
        `GET /job-tracker/x HTTP/1.1\r\nHost: site\r\nConnection: Content-Length\r\nContent-Length: ${n}\r\n\r\n${body}`,
        500,
      )
      await sleep(300)
      expect(up.requests).toHaveLength(1)
      expect(up.requests[0].method).toBe('GET')
      expect(up.requests[0].url).toBe('/job-tracker/x')
      expect(up.requests[0].headers['content-length']).toBe(String(n))
      expect(up.requests[0].body.toString('latin1')).toBe(body)
    })
  })
})

describe('proxy timeout covers only the wait for headers', () => {
  it('a slow-streaming body (gaps longer than proxyTimeoutMs) arrives in full with 200', async () => {
    await withProxy(
      async (req, res) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        res.write('one-')
        await sleep(450)
        res.write('two-')
        await sleep(450)
        res.end('three')
      },
      { proxyTimeoutMs: 300 },
      async ({ srv }) => {
        const r = await new Promise((resolve, reject) => {
          http.get({ host: '127.0.0.1', port: srv.port, path: '/job-tracker/stream', agent: false }, (res) => {
            const c = []
            res.on('data', (d) => c.push(d))
            res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(c).toString() }))
            res.on('error', reject)
          }).on('error', reject)
        })
        expect(r.status).toBe(200)
        expect(r.text).toBe('one-two-three')
      },
    )
  })
})

describe('hygiene nits', () => {
  it('upstream hop-by-hop response headers do not reach the client', async () => {
    await withProxy(
      (req, res) => {
        res.setHeader('Connection', 'keep-alive, X-Up-Hop')
        res.setHeader('Keep-Alive', 'timeout=77')
        res.setHeader('X-Up-Hop', 'secret')
        res.setHeader('X-Normal', 'kept')
        res.end('ok')
      },
      {},
      async ({ srv }) => {
        const raw = await rawSocket(srv.port, 'GET /job-tracker/h HTTP/1.1\r\nHost: s\r\nConnection: close\r\n\r\n')
        const head = raw.split('\r\n\r\n')[0].toLowerCase()
        expect(head).not.toContain('x-up-hop')
        expect(head).not.toContain('timeout=77')
        expect(head).toContain('x-normal: kept')
      },
    )
  })

  it('a client sending Connection: close gets connection: close', async () => {
    await withProxy(undefined, {}, async ({ srv }) => {
      const raw = await rawSocket(srv.port, 'GET /job-tracker/c HTTP/1.1\r\nHost: s\r\nConnection: close\r\n\r\n')
      expect(raw.split('\r\n\r\n')[0].toLowerCase()).toContain('connection: close')
    })
  })

  it('an HTTP/1.0 client gets connection: close', async () => {
    await withProxy(undefined, {}, async ({ srv }) => {
      const raw = await rawSocket(srv.port, 'GET /job-tracker/c HTTP/1.0\r\n\r\n')
      expect(raw.split('\r\n\r\n')[0].toLowerCase()).toContain('connection: close')
    })
  })

  it('an absolute-form request line is 404 JSON and never reaches the upstream', async () => {
    await withProxy(undefined, {}, async ({ up, srv }) => {
      const raw = await rawSocket(srv.port, 'GET http://evil/job-tracker/x HTTP/1.1\r\nHost: s\r\nConnection: close\r\n\r\n')
      expect(raw.startsWith('HTTP/1.1 404')).toBe(true)
      expect(raw.toLowerCase()).toContain('application/json')
      expect(raw.split('\r\n\r\n')[1]).toBe('{"error":"not_found"}')
      expect(up.requests).toHaveLength(0)
    })
  })

  it('Expect: 100-continue is not forwarded upstream', async () => {
    await withProxy(undefined, {}, async ({ up, srv }) => {
      const payload = '{"a":1}'
      const status = await new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1', port: srv.port, path: '/job-tracker/e', method: 'POST', agent: false,
          headers: { Expect: '100-continue', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
        req.on('error', reject)
        req.on('continue', () => req.end(payload))
      })
      expect(status).toBe(200)
      expect(up.requests).toHaveLength(1)
      expect(up.requests[0].headers.expect).toBeUndefined()
      expect(up.requests[0].body.toString()).toBe(payload)
    })
  })

  it('two sequential proxied requests reuse one upstream TCP connection', async () => {
    await withProxy(undefined, {}, async ({ up, srv }) => {
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })
      const get = (p) => new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port: srv.port, path: p, agent }, (res) => {
          res.resume(); res.on('end', () => resolve(res.statusCode))
        }).on('error', reject)
      })
      try {
        expect(await get('/job-tracker/a')).toBe(200)
        expect(await get('/job-tracker/b')).toBe(200)
        expect(up.requests).toHaveLength(2)
        expect(up.connections.count).toBe(1)
      } finally {
        agent.destroy()
      }
    })
  })
})
