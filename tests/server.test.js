import { describe, it, expect } from 'vitest'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('server.js', () => {
  it('exits non-zero with one stderr line naming the port when PORT is occupied', async () => {
    const blocker = net.createServer()
    await new Promise((r) => blocker.listen(0, r))
    const port = blocker.address().port
    try {
      const child = spawn(process.execPath, ['server.js'], {
        cwd: root,
        env: { ...process.env, PORT: String(port), TRACKER_URL: 'http://127.0.0.1:1', GITHUB_TOKEN: 'x' },
      })
      let err = ''
      child.stderr.on('data', (d) => { err += d })
      const timer = setTimeout(() => child.kill('SIGKILL'), 10000)
      const code = await new Promise((r) => child.on('close', r))
      clearTimeout(timer)
      expect(code).not.toBe(0)
      expect(code).not.toBeNull()
      const lines = err.split('\n').filter((l) => l.trim() !== '')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(String(port))
      expect(lines[0]).not.toMatch(/\n\s+at /)
    } finally {
      await new Promise((r) => blocker.close(r))
    }
  })
})
