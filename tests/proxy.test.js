import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { Buffer } from 'node:buffer'
import { createApp } from '../server/app.js'
import { makeDist, rmDir, startUpstream, closedPortUrl } from './helpers.js'

const handlers = {
  githubStats: (req, res) => res.status(200).json({}),
  projects: (req, res) => res.status(200).json({}),
}
const COOKIES = [
  'sid=abc123; Path=/job-tracker; HttpOnly; Secure; SameSite=Lax',
  'csrf=zzz; Path=/job-tracker; HttpOnly; Secure',
]

let dist
let upstream
let app

beforeAll(async () => {
  dist = makeDist()
  upstream = await startUpstream((req, res, body) => {
    if (req.url.startsWith('/job-tracker/redirect')) {
      res.statusCode = 302
      res.setHeader('Location', '/job-tracker/login?next=%2Fa')
      res.end()
      return
    }
    if (req.url.startsWith('/job-tracker/teapot')) {
      res.statusCode = 418
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Set-Cookie', COOKIES)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
      res.end(JSON.stringify({ short: 'stout' }))
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ echoed: body.length }))
  })
  app = createApp({ distDir: dist, trackerUrl: upstream.url, handlers })
})
afterAll(async () => {
  rmDir(dist)
  await upstream.close()
})

const last = () => upstream.requests[upstream.requests.length - 1]

describe('tracker proxy', () => {
  it('forwards GET /job-tracker/ with path unchanged', async () => {
    const res = await request(app).get('/job-tracker/')
    expect(res.status).toBe(200)
    expect(last().method).toBe('GET')
    expect(last().url).toBe('/job-tracker/')
  })

  it('forwards path and query unchanged', async () => {
    await request(app).get('/job-tracker/api/x?q=1&z=a%20b')
    expect(last().url).toBe('/job-tracker/api/x?q=1&z=a%20b')
  })

  it('streams a POST JSON body byte-exact and forwards request headers', async () => {
    const payload = '{ "a":1,  "name":"café ✓",\n "n":[1,2,3] }'
    const res = await request(app)
      .post('/job-tracker/api/applications')
      .set('Content-Type', 'application/json')
      .set('Cookie', 'sid=abc123; other=1')
      .set('Authorization', 'Bearer secret-token')
      .set('If-Match', '2026-10-07T14:00:00.000Z')
      .send(payload)
    expect(res.status).toBe(200)
    const u = last()
    expect(u.method).toBe('POST')
    expect(u.url).toBe('/job-tracker/api/applications')
    expect(u.body.equals(Buffer.from(payload, 'utf8'))).toBe(true)
    expect(res.body).toEqual({ echoed: Buffer.byteLength(payload) })
    expect(u.headers['content-type']).toMatch(/^application\/json/)
    expect(u.headers.cookie).toBe('sid=abc123; other=1')
    expect(u.headers.authorization).toBe('Bearer secret-token')
    expect(u.headers['if-match']).toBe('2026-10-07T14:00:00.000Z')
  })

  it('proxies other methods (PATCH, DELETE)', async () => {
    await request(app).patch('/job-tracker/api/applications/1').send({ a: 1 })
    expect(last().method).toBe('PATCH')
    await request(app).delete('/job-tracker/api/applications/1')
    expect(last().method).toBe('DELETE')
  })

  it('passes status, body, multiple Set-Cookie, Cache-Control and X-Robots-Tag back unchanged', async () => {
    const res = await request(app).get('/job-tracker/teapot')
    expect(res.status).toBe(418)
    expect(res.body).toEqual({ short: 'stout' })
    expect(res.headers['set-cookie']).toEqual(COOKIES)
    expect(res.headers['cache-control']).toBe('private, no-store')
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow')
  })

  it('passes a 302 Location through unrewritten', async () => {
    const res = await request(app).get('/job-tracker/redirect').redirects(0)
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('/job-tracker/login?next=%2Fa')
  })

  it('sets X-Forwarded-For, -Proto and -Host upstream', async () => {
    await request(app).get('/job-tracker/api/x').set('Host', 'devvjs.dev')
    const h = last().headers
    expect(h['x-forwarded-for']).toMatch(/(^|, ?)(::ffff:)?127\.0\.0\.1$|(^|, ?)::1$/)
    expect(h['x-forwarded-proto']).toBe('http')
    expect(h['x-forwarded-host']).toBe('devvjs.dev')
  })

  it('returns 502 {error:"tracker_unavailable"} with no stack when upstream is down', async () => {
    const dead = createApp({ distDir: dist, trackerUrl: await closedPortUrl(), handlers })
    const res = await request(dead).get('/job-tracker/api/x')
    expect(res.status).toBe(502)
    expect(res.body).toEqual({ error: 'tracker_unavailable' })
    expect(res.text).not.toMatch(/ECONNREFUSED|\bat\s+\S+\s*\(|node_modules/)
  })
})
