const SOCIAL_LINKS = [
  { href: 'https://github.com', label: 'GitHub', symbol: 'gh' },
  { href: 'https://linkedin.com', label: 'LinkedIn', symbol: 'in' },
  { href: 'mailto:hello@example.com', label: 'Email', symbol: '@' },
]

function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 pb-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <hr className="border-0 h-px bg-accent-green/60 shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-xs text-text-secondary">
            © {year} devvJS — built with React + Tailwind
          </p>
          <ul className="flex items-center gap-4">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="font-mono text-sm text-text-primary hover:text-accent-cyan transition-colors border border-text-secondary/40 rounded px-2 py-1 hover:border-accent-cyan"
                >
                  {link.symbol}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

export default Footer