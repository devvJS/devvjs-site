import { useEffect, useState } from 'react'
import TerminalCard from './TerminalCard'

const BAR_WIDTH = 14

function formatRelative(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = Date.now() - then
  const min = 60_000
  const hr = 3_600_000
  const day = 86_400_000
  if (diffMs < hr) return `${Math.max(1, Math.floor(diffMs / min))}m ago`
  if (diffMs < day) return `${Math.floor(diffMs / hr)}h ago`
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}d ago`
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))}mo ago`
  return `${Math.floor(diffMs / (365 * day))}y ago`
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded border border-text-secondary/30 bg-black/30 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl text-accent-green tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="font-mono text-[10px] text-text-secondary mt-0.5">
          {hint}
        </div>
      )}
    </div>
  )
}

function LanguageBar({ name, color, pct }) {
  const filled = Math.max(1, Math.round(pct * BAR_WIDTH))
  const empty = BAR_WIDTH - filled
  return (
    <li className="grid grid-cols-[110px_1fr_44px] items-center gap-3 font-mono text-xs">
      <span className="flex items-center gap-2 text-text-primary">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: color || '#00e5ff' }}
          aria-hidden="true"
        />
        <span className="truncate">{name}</span>
      </span>
      <span className="tracking-[0.05em] text-accent-cyan whitespace-nowrap overflow-hidden">
        <span>{'▰'.repeat(filled)}</span>
        <span className="text-text-secondary/60">{'▱'.repeat(empty)}</span>
      </span>
      <span className="text-right text-text-secondary tabular-nums">
        {(pct * 100).toFixed(0)}%
      </span>
    </li>
  )
}

function GitHubStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/github-stats')
      .then((r) => {
        if (!r.ok) throw new Error('not ok')
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error('not json')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error || !stats) return null

  const lastPush = stats.lastPush
  const lastPushRel = formatRelative(lastPush?.pushedAt)

  return (
    <div className="mt-12">
      <TerminalCard title="~/github-activity">
        <div className="font-mono text-sm text-text-secondary mb-5">
          <span className="text-accent-green">$</span>{' '}
          <span className="text-text-primary">gh stats --user devvJS</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Stat label="repos" value={stats.repos} />
          <Stat label="stars" value={stats.stars} />
          <Stat label="followers" value={stats.followers} />
          <Stat
            label="commits"
            value={stats.contributionsLastYear}
            hint="last 365 days"
          />
          <Stat
            label="streak"
            value={stats.streak}
            hint={stats.streak === 1 ? 'day' : 'days'}
          />
        </div>

        {lastPush && (
          <div className="font-mono text-xs text-text-secondary mb-6 flex flex-wrap items-center gap-x-2">
            <span className="text-accent-green">$</span>
            <span>last_push</span>
            <span className="text-text-secondary">→</span>
            <a
              href={lastPush.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-cyan hover:text-accent-green transition-colors"
            >
              {lastPush.name}
            </a>
            {lastPushRel && (
              <span className="text-text-secondary">({lastPushRel})</span>
            )}
          </div>
        )}

        {stats.topLanguages?.length > 0 && (
          <div>
            <div className="font-mono text-xs text-text-secondary mb-3">
              <span className="text-accent-green">#</span> top_languages
            </div>
            <ul className="space-y-1.5">
              {stats.topLanguages.map((lang) => (
                <LanguageBar key={lang.name} {...lang} />
              ))}
            </ul>
          </div>
        )}
      </TerminalCard>
    </div>
  )
}

export default GitHubStats
