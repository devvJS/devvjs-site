import SectionWrapper from '../components/SectionWrapper'
import TerminalCard from '../components/TerminalCard'

const CONTACT_LINKS = [
  {
    key: 'email',
    label: 'email',
    value: 'd.coppage@icloud.com',
    href: 'mailto:d.coppage@icloud.com',
    flag: '--email',
    accent: 'text-accent-green',
    hover: 'hover:text-accent-green',
  },
  {
    key: 'github',
    label: 'github',
    value: 'github.com/devvJS',
    href: 'https://github.com/devvJS',
    flag: '--github',
    accent: 'text-accent-cyan',
    hover: 'hover:text-accent-cyan',
    external: true,
  },
  {
    key: 'linkedin',
    label: 'linkedin',
    value: 'linkedin.com/in/dkc86',
    href: 'https://linkedin.com/in/dkc86',
    flag: '--linkedin',
    accent: 'text-accent-cyan',
    hover: 'hover:text-accent-cyan',
    external: true,
  },
]

function Contact() {
  return (
    <SectionWrapper id="contact" title="contact">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2 space-y-4 text-text-primary/90 leading-relaxed">
          <p className="font-mono text-accent-green text-sm">
            <span className="opacity-70">$</span> reach_out --help
          </p>
          <p>
            Got an interesting problem, a role to discuss, or just want to
            trade notes on developer tooling? My inbox is open.
          </p>
          <p className="text-text-secondary text-sm">
            I try to reply within a couple of days.
          </p>
        </div>

        <div className="lg:col-span-3">
          <TerminalCard title="~/contact.sh">
            <div className="font-mono text-sm space-y-3">
              {CONTACT_LINKS.map((link) => (
                <div
                  key={link.key}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                >
                  <span className="text-text-secondary shrink-0">
                    <span className="text-accent-green">$</span> reach_out{' '}
                    <span className={link.accent}>{link.flag}</span>
                  </span>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className={`group inline-flex items-center gap-2 text-text-primary ${link.hover} transition-colors break-all`}
                    aria-label={`${link.label}: ${link.value}`}
                  >
                    <span className="opacity-70 group-hover:opacity-100">
                      →
                    </span>
                    <span className="underline decoration-dotted underline-offset-4">
                      {link.value}
                    </span>
                  </a>
                </div>
              ))}
              <div className="pt-3 flex items-center gap-1 text-text-secondary">
                <span className="text-accent-green">$</span>
                <span
                  className="inline-block h-4 w-2 bg-accent-green animate-pulse"
                  aria-hidden="true"
                />
              </div>
            </div>
          </TerminalCard>
        </div>
      </div>
    </SectionWrapper>
  )
}

export default Contact