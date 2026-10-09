import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app.js'
import { makeDist, rmDir, startUpstream } from './helpers.js'

const noHandlers = {
  githubStats: (req, res) => res.status(200).json({}),
  projects: (req, res) => res.status(200).json({}),
}

let dist
let upstream
let app

beforeAll(async () => {
  dist = makeDist()
  upstream = await startUpstream((req, res) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end('FROM-TRACKER')
  })
  app = createApp({ distDir: dist, trackerUrl: upstream.url, handlers: noHandlers })
})
afterAll(async () => {
  rmDir(dist)
  await upstream.close()
})

describe('healthz', () => {
  it('returns 200 {ok:true} and is not proxied', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(upstream.requests).toHaveLength(0)
  })
})

describe('static files and SPA fallback', () => {
  it('serves index.html at / with no-cache', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('SPA-INDEX')
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it('serves index.html with a real 404 and no-cache for an unknown deep link', async () => {
    const res = await request(app).get('/projects/foo')
    expect(res.status).toBe(404)
    expect(res.text).toContain('SPA-INDEX')
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it('serves index.html with 200 and no-cache for a deep link on a known route', async () => {
    const res = await request(app).get('/resume/')
    expect(res.status).toBe(200)
    expect(res.text).toContain('SPA-INDEX')
    expect(res.headers['cache-control']).toBe('no-cache')
  })

  it('serves a hashed asset with an immutable cache header', async () => {
    const res = await request(app).get('/assets/index-AbC123xy.js')
    expect(res.status).toBe(200)
    expect(res.text).toBe('console.log("hashed")')
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('serves robots.txt as-is', async () => {
    const res = await request(app).get('/robots.txt')
    expect(res.status).toBe(200)
    expect(res.text).toBe('User-agent: *\nAllow: /\n')
  })

  it('returns 404, not index.html, for a missing path with a dot', async () => {
    const res = await request(app).get('/missing.js')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('SPA-INDEX')
  })

  it('returns 404 JSON for unknown /api paths', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(typeof res.body).toBe('object')
    expect(res.text).not.toContain('SPA-INDEX')
  })

  it('does not return index.html for /job-tracker or /job-tracker/x (proxied)', async () => {
    const before = upstream.requests.length
    const a = await request(app).get('/job-tracker')
    const b = await request(app).get('/job-tracker/x')
    expect(a.text).toBe('FROM-TRACKER')
    expect(b.text).toBe('FROM-TRACKER')
    expect(upstream.requests.length - before).toBe(2)
    expect(upstream.requests.slice(before).map((r) => r.url)).toEqual(['/job-tracker', '/job-tracker/x'])
  })
})
