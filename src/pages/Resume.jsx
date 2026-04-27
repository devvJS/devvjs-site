import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  header,
  summary,
  technicalSkills,
  experience,
  selectedProjects,
  education,
  resumeFile,
} from '../data/resume'

function Prompt({ command }) {
  return (
    <div className="font-mono text-sm text-text-secondary mb-4">
      <span className="text-accent-green">$</span>{' '}
      <span className="text-text-primary">{command}</span>
    </div>
  )
}

function Section({ command, title, children }) {
  return (
    <section className="mt-12">
      <Prompt command={command} />
      <h2 className="font-mono text-accent-cyan text-xs tracking-[0.2em] uppercase mb-4">
        # {title}
      </h2>
      {children}
    </section>
  )
}

function Resume() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen pt-14 pb-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <nav className="pt-8 flex items-center justify-between">
          <Link
            to="/"
            className="font-mono text-sm text-text-secondary hover:text-accent-green transition-colors"
          >
            <span className="text-accent-green">$</span> cd ..
          </Link>
          <div className="flex items-center gap-3">
            <a
              href={resumeFile}
              download
              className="inline-flex items-center gap-2 rounded-md border border-accent-green/60 px-4 py-2 font-mono text-sm text-accent-green hover:bg-accent-green/10 hover:shadow-[0_0_14px_rgba(57,255,20,0.35)] transition"
            >
              ./download.pdf
            </a>
            <a
              href={resumeFile}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-text-secondary/60 px-4 py-2 font-mono text-sm text-text-primary hover:border-accent-cyan hover:text-accent-cyan transition"
            >
              ./view.pdf
            </a>
          </div>
        </nav>

        <header className="mt-10">
          <p className="font-mono text-accent-green text-sm">
            <span className="opacity-70">&gt;</span> cat ~/resume.md
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-mono tracking-tight text-text-primary">
            {header.name}
          </h1>
          <p className="mt-2 text-accent-cyan font-mono text-base sm:text-lg">
            {header.title}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-secondary">
            <span>{header.location}</span>
            <span aria-hidden>•</span>
            <a href={`mailto:${header.email}`} className="hover:text-accent-cyan transition-colors">
              {header.email}
            </a>
            {header.links.map((link) => (
              <span key={link.href} className="flex items-center gap-x-4">
                <span aria-hidden>•</span>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-cyan transition-colors"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </div>
        </header>

        <Section command="cat summary.txt" title="Professional Summary">
          <p className="text-text-primary/90 leading-relaxed">{summary}</p>
        </Section>

        <Section command="ls skills/" title="Technical Skills">
          <dl className="space-y-3">
            {technicalSkills.map((group) => (
              <div
                key={group.label}
                className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1"
              >
                <dt className="font-mono text-accent-green text-sm">{group.label}:</dt>
                <dd className="text-text-primary/90 text-sm">{group.items.join(' · ')}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section command="git log --author=dakota" title="Professional Experience">
          <div className="space-y-8">
            {experience.map((job) => (
              <article
                key={`${job.company}-${job.period}`}
                className="border-l-2 border-accent-green/40 pl-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-mono text-text-primary text-base">
                    {job.role}{' '}
                    <span className="text-text-secondary">@</span>{' '}
                    <span className="text-accent-cyan">{job.company}</span>
                  </h3>
                  <span className="font-mono text-xs text-text-secondary">{job.period}</span>
                </div>
                <p className="font-mono text-xs text-text-secondary mt-1">{job.location}</p>
                <ul className="mt-3 space-y-2">
                  {job.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-primary/90">
                      <span className="text-accent-green font-mono shrink-0">→</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section command="ls -la projects/" title="Selected Projects">
          <div className="space-y-6">
            {selectedProjects.map((p) => (
              <article
                key={p.name}
                className="rounded-md border border-text-secondary/30 bg-[#11141a]/60 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-mono text-accent-green text-base">{p.name}</h3>
                  {p.href && (
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-accent-cyan hover:underline"
                    >
                      {p.href.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-primary/90 leading-relaxed">{p.blurb}</p>
                <ul className="mt-3 space-y-2">
                  {p.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-primary/80">
                      <span className="text-accent-green font-mono shrink-0">→</span>
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section command="cat education.txt" title="Education">
          <ul className="space-y-3">
            {education.map((e) => (
              <li
                key={`${e.school}-${e.period}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span className="text-text-primary text-sm">
                  {e.degree}{' '}
                  <span className="text-text-secondary">—</span>{' '}
                  <span className="text-accent-cyan">{e.school}</span>
                </span>
                <span className="font-mono text-xs text-text-secondary">{e.period}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-16 font-mono text-sm text-text-secondary">
          <span className="text-accent-green">$</span> _<span className="animate-pulse">█</span>
        </div>
      </div>
    </div>
  )
}

export default Resume
