// Production dependency audit gate.
//
// Runs `npm audit --omit=dev --json` and fails on any high or critical advisory
// that isn't in .github/audit-allowlist.json. Each allowlist entry needs an id
// (the GHSA), a reason, and an expiry date; an expired entry fails the gate so
// exceptions get re-checked instead of living forever.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BLOCKING = new Set(['high', 'critical'])
const today = new Date().toISOString().slice(0, 10)

const allowlist = JSON.parse(readFileSync(new URL('../audit-allowlist.json', import.meta.url), 'utf8'))
const allowed = new Map(allowlist.map((entry) => [entry.id, entry]))

let raw
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' })
} catch (err) {
  // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
  raw = err.stdout
}
const report = JSON.parse(raw)

const advisories = new Map()
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue
    const id = via.url?.split('/').pop() ?? String(via.source)
    advisories.set(id, { id, severity: via.severity, title: via.title, package: via.name })
  }
}

const problems = []
for (const adv of advisories.values()) {
  const entry = allowed.get(adv.id)
  if (!entry) {
    problems.push(`${adv.severity}: ${adv.package} ${adv.id} (${adv.title})`)
  } else if (entry.expires < today) {
    problems.push(`allowlist entry for ${adv.id} expired on ${entry.expires}; re-check it: ${entry.reason}`)
  } else {
    console.log(`allowed until ${entry.expires}: ${adv.package} ${adv.id}: ${entry.reason}`)
  }
}

if (problems.length) {
  console.error('Blocking production advisories:')
  for (const line of problems) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`No unallowed high or critical advisories in production dependencies (${advisories.size} checked).`)
