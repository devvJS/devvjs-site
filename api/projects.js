import { projects as curated } from '../src/data/content.js'

const GITHUB_API = 'https://api.github.com'
const GITHUB_USER = 'devvJS'
const PORTFOLIO_TOPIC = 'portfolio'

function parseRepoUrl(url) {
  if (!url) return null
  const m = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  return m ? { owner: m[1], repo: m[2] } : null
}

function repoKey(url) {
  const ref = parseRepoUrl(url)
  return ref ? `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}` : null
}

function repoToProject(data) {
  return {
    title: data.name,
    description: data.description || '',
    tags: (data.topics || []).filter((t) => t !== PORTFOLIO_TOPIC),
    liveUrl: data.homepage || null,
    repoUrl: data.html_url,
    stars: data.stargazers_count,
    language: data.language,
    updatedAt: data.pushed_at,
    githubDescription: data.description ?? null,
    topics: data.topics || [],
  }
}

async function fetchRepo({ owner, repo }, headers) {
  const r = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers })
  if (!r.ok) return null
  return r.json()
}

async function searchPortfolioRepos(headers) {
  const url = `${GITHUB_API}/search/repositories?q=user:${GITHUB_USER}+topic:${PORTFOLIO_TOPIC}&sort=updated&order=desc&per_page=50`
  const r = await fetch(url, { headers })
  if (!r.ok) return []
  const data = await r.json()
  return Array.isArray(data.items) ? data.items : []
}

export default async function handler(req, res) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devvjs-portfolio',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const enrichedCurated = await Promise.all(
    curated.map(async (project) => {
      const ref = parseRepoUrl(project.repoUrl)
      if (!ref) return project
      try {
        const data = await fetchRepo(ref, headers)
        if (!data) return project
        return {
          ...project,
          stars: data.stargazers_count,
          language: data.language,
          updatedAt: data.pushed_at,
          githubDescription: data.description ?? null,
          topics: Array.isArray(data.topics) ? data.topics : [],
        }
      } catch {
        return project
      }
    }),
  )

  let discovered = []
  try {
    const items = await searchPortfolioRepos(headers)
    const seen = new Set(
      enrichedCurated.map((p) => repoKey(p.repoUrl)).filter(Boolean),
    )
    discovered = items
      .filter((r) => {
        const k = repoKey(r.html_url)
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map(repoToProject)
  } catch {
    discovered = []
  }

  const projects = [...enrichedCurated, ...discovered]

  res.setHeader(
    'Cache-Control',
    's-maxage=600, stale-while-revalidate=86400',
  )
  res.status(200).json({
    projects,
    counts: { curated: enrichedCurated.length, discovered: discovered.length },
    fetchedAt: new Date().toISOString(),
  })
}
