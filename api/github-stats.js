const GITHUB_GRAPHQL = 'https://api.github.com/graphql'
const GITHUB_USER = 'devvJS'

const QUERY = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
      totalCount
      nodes {
        name
        url
        stargazerCount
        pushedAt
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node { name color }
          }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}
`

function computeStreak(weeks) {
  const days = weeks
    .flatMap((w) => w.contributionDays)
    .sort((a, b) => a.date.localeCompare(b.date))
  const desc = [...days].reverse()
  if (desc.length === 0) return 0
  let i = 0
  // grace day: today might not be over
  if (desc[0].contributionCount === 0) i = 1
  if (i >= desc.length || desc[i].contributionCount === 0) return 0
  let count = 0
  for (; i < desc.length; i++) {
    if (desc[i].contributionCount > 0) count++
    else break
  }
  return count
}

function topLanguages(repos, n = 5) {
  const totals = new Map()
  for (const repo of repos) {
    for (const edge of repo.languages?.edges ?? []) {
      const name = edge.node.name
      const cur = totals.get(name) ?? { name, color: edge.node.color, bytes: 0 }
      cur.bytes += edge.size
      totals.set(name, cur)
    }
  }
  const all = [...totals.values()].sort((a, b) => b.bytes - a.bytes)
  const total = all.reduce((s, l) => s + l.bytes, 0) || 1
  return all.slice(0, n).map((l) => ({
    name: l.name,
    color: l.color,
    pct: l.bytes / total,
  }))
}

function lastPush(repos) {
  let best = null
  for (const r of repos) {
    if (!r.pushedAt) continue
    if (!best || r.pushedAt > best.pushedAt) {
      best = { name: r.name, url: r.url, pushedAt: r.pushedAt }
    }
  }
  return best
}

export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    res.status(500).json({ error: 'GITHUB_TOKEN required' })
    return
  }

  try {
    const r = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'devvjs-portfolio',
      },
      body: JSON.stringify({ query: QUERY, variables: { login: GITHUB_USER } }),
    })

    if (!r.ok) {
      res.status(502).json({ error: 'github api error', status: r.status })
      return
    }
    const json = await r.json()
    if (json.errors) {
      res.status(502).json({ error: 'graphql errors', errors: json.errors })
      return
    }
    const u = json.data?.user
    if (!u) {
      res.status(404).json({ error: 'user not found' })
      return
    }

    const repos = u.repositories.nodes || []
    const stars = repos.reduce((s, r) => s + (r.stargazerCount || 0), 0)
    const cal = u.contributionsCollection.contributionCalendar

    res.setHeader(
      'Cache-Control',
      's-maxage=600, stale-while-revalidate=86400',
    )
    res.status(200).json({
      repos: u.repositories.totalCount,
      stars,
      followers: u.followers.totalCount,
      contributionsLastYear: cal.totalContributions,
      streak: computeStreak(cal.weeks),
      topLanguages: topLanguages(repos),
      lastPush: lastPush(repos),
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    res.status(500).json({ error: 'internal', message: e.message })
  }
}
