import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app.js'
import { makeDist, rmDir } from './helpers.js'

const TTL = 10 * 60 * 1000
let dist
beforeAll(() => { dist = makeDist() })
afterAll(() => rmDir(dist))

function setup({ gh, pr } = {}) {
  const clock = { t: 1_000_000 }
  const calls = { gh: 0, pr: 0 }
  const handlers = {
    githubStats: async (req, res) => {
      calls.gh++
      if (gh) return gh(req, res, calls.gh)
      return res.status(200).json({ route: 'gh', n: calls.gh })
    },
    projects: async (req, res) => {
      calls.pr++
      if (pr) return pr(req, res, calls.pr)
      return res.status(200).json({ route: 'pr', n: calls.pr })
    },
  }
  const app = createApp({
    distDir: dist,
    trackerUrl: 'http://127.0.0.1:1',
    now: () => clock.t,
    handlers,
  })
  return { app, clock, calls }
}

describe('cached()', () => {
  it('is exported from server/cache.js and returns a handler function', async () => {
    const { cached } = await import('../server/cache.js')
    expect(typeof cached).toBe('function')
    const h = cached(() => {}, { ttlMs: TTL, now: () => 0 })
    expect(typeof h).toBe('function')
  })

  it('caches per TTL when mounted directly in express', async () => {
    const { cached } = await import('../server/cache.js')
    const { default: express } = await import('express')
    let t = 0
    let n = 0
    const a = express()
    a.get('/x', cached((req, res) => res.status(200).json({ n: ++n }), { ttlMs: 1000, now: () => t }))
    const r1 = await request(a).get('/x')
    t = 999
    const r2 = await request(a).get('/x')
    t = 1001
    const r3 = await request(a).get('/x')
    expect([r1.body.n, r2.body.n, r3.body.n]).toEqual([1, 1, 2])
    expect([r1.headers['x-cache'], r2.headers['x-cache'], r3.headers['x-cache']]).toEqual(['MISS', 'HIT', 'MISS'])
  })
})

describe('API cache via createApp', () => {
  it('first call MISS, second HIT with one handler call', async () => {
    const { app, calls } = setup()
    const a = await request(app).get('/api/github-stats')
    const b = await request(app).get('/api/github-stats')
    expect(a.status).toBe(200)
    expect(a.headers['x-cache']).toBe('MISS')
    expect(a.body).toEqual({ route: 'gh', n: 1 })
    expect(b.status).toBe(200)
    expect(b.headers['x-cache']).toBe('HIT')
    expect(b.body).toEqual({ route: 'gh', n: 1 })
    expect(calls.gh).toBe(1)
  })

  it('still HIT just before the 10-minute TTL, MISS after it', async () => {
    const { app, clock, calls } = setup()
    await request(app).get('/api/projects')
    clock.t += TTL - 1
    const hit = await request(app).get('/api/projects')
    expect(hit.headers['x-cache']).toBe('HIT')
    expect(calls.pr).toBe(1)
    clock.t += 2
    const miss = await request(app).get('/api/projects')
    expect(miss.headers['x-cache']).toBe('MISS')
    expect(miss.body).toEqual({ route: 'pr', n: 2 })
    expect(calls.pr).toBe(2)
  })

  it('does not cache non-200 responses', async () => {
    const { app, calls } = setup({
      gh: (req, res, n) => (n === 1 ? res.status(502).json({ error: 'down' }) : res.status(200).json({ ok: n })),
    })
    const a = await request(app).get('/api/github-stats')
    expect(a.status).toBe(502)
    expect(a.body).toEqual({ error: 'down' })
    expect(a.headers['x-cache']).toBe('MISS')
    const b = await request(app).get('/api/github-stats')
    expect(b.status).toBe(200)
    expect(b.body).toEqual({ ok: 2 })
    expect(b.headers['x-cache']).toBe('MISS')
    expect(calls.gh).toBe(2)
  })

  it('serves the stale 200 with X-Cache STALE when the handler then fails', async () => {
    const { app, clock, calls } = setup({
      gh: (req, res, n) => (n === 1 ? res.status(200).json({ stars: 7 }) : res.status(502).json({ error: 'rate' })),
    })
    await request(app).get('/api/github-stats')
    clock.t += TTL + 1
    const s = await request(app).get('/api/github-stats')
    expect(s.status).toBe(200)
    expect(s.body).toEqual({ stars: 7 })
    expect(s.headers['x-cache']).toBe('STALE')
    expect(calls.gh).toBe(2)
  })

  it('makes one handler call for 5 concurrent cold requests', async () => {
    const { app, calls } = setup({
      gh: async (req, res) => {
        await new Promise((r) => setTimeout(r, 150))
        res.status(200).json({ done: true })
      },
    })
    const rs = await Promise.all(Array.from({ length: 5 }, () => request(app).get('/api/github-stats')))
    expect(calls.gh).toBe(1)
    for (const r of rs) {
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ done: true })
    }
  })

  it('caches the two routes independently', async () => {
    const { app, calls } = setup()
    const g = await request(app).get('/api/github-stats')
    const p = await request(app).get('/api/projects')
    expect(g.headers['x-cache']).toBe('MISS')
    expect(p.headers['x-cache']).toBe('MISS')
    expect(g.body.route).toBe('gh')
    expect(p.body.route).toBe('pr')
    const g2 = await request(app).get('/api/github-stats')
    const p2 = await request(app).get('/api/projects')
    expect(g2.headers['x-cache']).toBe('HIT')
    expect(p2.headers['x-cache']).toBe('HIT')
    expect(calls).toEqual({ gh: 1, pr: 1 })
  })
})

describe('default handlers are the real api/*.js exports', () => {
  afterAll(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('/api/github-stats runs api/github-stats.js against a stubbed fetch', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'fake-token-123')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          user: {
            followers: { totalCount: 4 },
            repositories: {
              totalCount: 3,
              nodes: [
                {
                  name: 'a', url: 'https://github.com/devvJS/a', stargazerCount: 5, pushedAt: '2026-01-01T00:00:00Z',
                  languages: { edges: [{ size: 300, node: { name: 'JavaScript', color: '#f1e05a' } }] },
                },
                {
                  name: 'b', url: 'https://github.com/devvJS/b', stargazerCount: 2, pushedAt: '2026-02-01T00:00:00Z',
                  languages: { edges: [{ size: 100, node: { name: 'Ruby', color: '#701516' } }] },
                },
              ],
            },
            contributionsCollection: {
              contributionCalendar: {
                totalContributions: 11,
                weeks: [
                  {
                    contributionDays: [
                      { date: '2026-03-01', contributionCount: 0 },
                      { date: '2026-03-02', contributionCount: 3 },
                      { date: '2026-03-03', contributionCount: 4 },
                      { date: '2026-03-04', contributionCount: 4 },
                    ],
                  },
                ],
              },
            },
          },
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const app = createApp({ distDir: dist, trackerUrl: 'http://127.0.0.1:1' })
    const res = await request(app).get('/api/github-stats')
    expect(res.status).toBe(200)
    expect(res.body.repos).toBe(3)
    expect(res.body.stars).toBe(7)
    expect(res.body.followers).toBe(4)
    expect(res.body.contributionsLastYear).toBe(11)
    expect(res.body.streak).toBe(3)
    expect(res.body.topLanguages).toEqual([
      { name: 'JavaScript', color: '#f1e05a', pct: 0.75 },
      { name: 'Ruby', color: '#701516', pct: 0.25 },
    ])
    expect(res.headers['x-cache']).toBe('MISS')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/graphql')
    expect(JSON.stringify(res.body)).not.toContain('fake-token-123')
  })
})
