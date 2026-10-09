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

describe('unknown paths get a real 404 with the SPA shell', () => {
  it.each(['/nope', '/a/b', '/resumes', '/resume/x', '/terminal-chaos/x'])(
    '%s -> 404, index.html, text/html, no-cache',
    async (p) => {
      const res = await request(app).get(p)
      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch(/text\/html/)
      expect(res.text).toContain('SPA-INDEX')
      expect(res.headers['cache-control']).toBe('no-cache')
    },
  )

  it('HEAD on an unknown path is also 404', async () => {
    const res = await request(app).head('/nope')
    expect(res.status).toBe(404)
  })
})

describe('known routes keep sending 200 with index.html', () => {
  it.each(['/', '/resume', '/resume/', '/terminal-chaos', '/terminal-chaos/'])('%s', async (p) => {
    const res = await request(app).get(p)
    expect(res.status).toBe(200)
    expect(res.text).toContain('SPA-INDEX')
    expect(res.headers['cache-control']).toBe('no-cache')
  })
})

describe('unchanged behavior', () => {
  it('/missing.js is still 404 JSON, not index.html', async () => {
    const res = await request(app).get('/missing.js')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({ error: 'not_found' })
  })

  it('/api/nope is still 404 JSON', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not_found' })
  })

  it('/healthz is still {ok:true}', async () => {
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('/job-tracker is still proxied', async () => {
    const res = await request(app).get('/job-tracker')
    expect(res.status).toBe(200)
    expect(res.text).toBe('FROM-TRACKER')
  })
})
