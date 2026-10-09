import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Builds into a temp dir (never touches dist/, which the e2e server serves), then checks
// that the game ships only in a lazy chunk. Kept in vitest: one build is ~10 s.
const ROOT = resolve(__dirname, '..')
const NEEDLES = ['TERMINAL CHAOS', 'Terminal Chaos']
let out
let entryFile
let chunks

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'tc-build-'))
  execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir'],
    { cwd: ROOT, stdio: 'pipe', timeout: 150000 },
  )
  const html = readFileSync(join(out, 'index.html'), 'utf8')
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/) || html.match(/<script[^>]*src="([^"]+)"[^>]*type="module"/)
  entryFile = m && m[1].split('/').pop()
  chunks = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'))
}, 180000)
afterAll(() => out && rmSync(out, { recursive: true, force: true }))

describe('build chunks', () => {
  it('index.html references an entry chunk that exists', () => {
    expect(entryFile).toBeTruthy()
    expect(chunks).toContain(entryFile)
  })

  it('the entry chunk holds no game text', () => {
    const entry = readFileSync(join(out, 'assets', entryFile), 'utf8')
    for (const n of NEEDLES) expect(entry.includes(n)).toBe(false)
  })

  it('some other chunk holds the game', () => {
    const others = chunks.filter((f) => f !== entryFile)
    const hits = others.filter((f) => {
      const t = readFileSync(join(out, 'assets', f), 'utf8')
      return NEEDLES.some((n) => t.includes(n))
    })
    expect(hits.length).toBeGreaterThanOrEqual(1)
  })
})
