import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app.js'
import { makeDist, rmDir } from './helpers.js'

let dist
let app
beforeAll(() => {
  dist = makeDist()
  app = createApp({
    distDir: dist,
    trackerUrl: 'http://127.0.0.1:9',
    handlers: { githubStats: (q, r) => r.json({}), projects: (q, r) => r.json({}) },
  })
})
afterAll(() => rmDir(dist))

describe('Range on an unknown path', () => {
  it('answers 404 with the full index.html and no Content-Range', async () => {
    const res = await request(app).get('/nope').set('Range', 'bytes=0-3')
    expect(res.status).toBe(404)
    expect(res.text).toBe('<html><body>SPA-INDEX</body></html>')
    expect(res.headers['content-range']).toBeUndefined()
    expect(res.headers['cache-control']).toBe('no-cache')
  })
})
