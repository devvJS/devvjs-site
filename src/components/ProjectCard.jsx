import TerminalCard from './TerminalCard'

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v7H3V3h7" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.11.79-.25.79-.56v-2.02c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.3-.52-1.48.11-3.08 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.6.23 2.78.11 3.08.74.8 1.19 1.82 1.19 3.08 0 4.41-2.7 5.38-5.27 5.67.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62Z" />
    </svg>
  )
}

function formatRelative(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = Date.now() - then
  const day = 86_400_000
  const days = Math.floor(diffMs / day)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function ProjectCard({ title, description, tags, liveUrl, repoUrl, stars, language, updatedAt }) {
  const updated = formatRelative(updatedAt)
  const hasMeta = typeof stars === 'number' || language || updated

  return (
    <TerminalCard title={`~/projects/${title}`} className="h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="font-mono text-lg text-accent-green mb-2">
          <span className="text-text-secondary">$</span> {title}
        </h3>
        <p className="text-text-primary/85 leading-relaxed text-sm sm:text-base mb-4 flex-1">
          {description}
        </p>

        {tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded border border-text-secondary/40 px-2 py-0.5 font-mono text-xs text-text-secondary bg-black/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {hasMeta && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 font-mono text-xs text-text-secondary">
            {language && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-cyan" aria-hidden="true" />
                {language}
              </span>
            )}
            {typeof stars === 'number' && (
              <span className="inline-flex items-center gap-1">
                <StarIcon />
                {stars}
              </span>
            )}
            {updated && (
              <span className="inline-flex items-center gap-1">
                <span className="text-accent-green">↻</span>
                {updated}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-3 border-t border-text-secondary/20">
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs sm:text-sm text-accent-cyan hover:text-accent-green transition-colors"
            >
              <ExternalLinkIcon />
              live
            </a>
          )}
          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs sm:text-sm text-text-primary hover:text-accent-green transition-colors"
            >
              <GitHubIcon />
              repo
            </a>
          )}
        </div>
      </div>
    </TerminalCard>
  )
}

export default ProjectCard