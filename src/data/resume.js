export const resumeFile = '/resume/Dakota_Coppage_Resume.pdf'

export const header = {
  name: 'Dakota Coppage',
  title: 'Software Engineer II',
  location: 'Wilmington, DE',
  email: 'd.coppage@icloud.com',
  links: [
    { label: 'linkedin.com/in/dkc86', href: 'https://linkedin.com/in/dkc86' },
    { label: 'github.com/devvJS', href: 'https://github.com/devvJS' },
    { label: 'npmjs.com/~devvjs', href: 'https://npmjs.com/~devvjs' },
  ],
}

export const summary =
  'Software Engineer II at JPMorgan Chase with 4+ years of full-stack development experience building production web applications, internal tools, and developer-facing CLIs. Proficient in JavaScript, TypeScript, React, Node.js, and Ruby on Rails, with hands-on work across CI/CD pipelines, containerized deployments (Docker), and AI-assisted development workflows. Self-directed builder shipping multiple production indie projects spanning web, mobile, and CLI tooling. Owner-operator background brings a product mindset, strong ownership, and customer focus to every engineering decision.'

export const technicalSkills = [
  { label: 'Languages', items: ['JavaScript', 'TypeScript', 'Ruby', 'HTML5', 'CSS3', 'SQL', 'Bash'] },
  {
    label: 'Frameworks & Libraries',
    items: ['React', 'Redux', 'Next.js', 'Node.js', 'Express', 'Ruby on Rails', 'React Native', 'Expo', 'Tailwind CSS', 'Styled Components', 'Bootstrap', 'Semantic UI', 'Framer Motion'],
  },
  {
    label: 'Cloud, DevOps & Tooling',
    items: ['Docker', 'CI/CD', 'Git', 'GitHub Actions', 'Gitflow', 'Vercel', 'AWS', 'Linux/WSL/Ubuntu', 'npm', 'Jest'],
  },
  {
    label: 'Databases & Backend',
    items: ['PostgreSQL', 'SQLite', 'Supabase', 'Sanity', 'REST APIs', 'OAuth', 'Stripe', 'Webhooks'],
  },
  {
    label: 'AI & Developer Tooling',
    items: ['Anthropic Claude API', 'Claude Code', 'Gemini CLI', 'OpenAI Codex', 'prompt engineering', 'MCP servers', 'agentic workflows'],
  },
  {
    label: 'Practices',
    items: ['Agile/Scrum', 'code review', 'unit & integration testing', 'accessibility (WCAG)', 'responsive design', 'technical documentation'],
  },
]

export const experience = [
  {
    role: 'Software Engineer II',
    company: 'JPMorgan Chase & Co.',
    location: 'Wilmington, DE',
    period: 'January 2025 – Present',
    bullets: [
      'Develop and maintain production features across full-stack web applications serving internal business lines, contributing to roadmap planning and technical design reviews.',
      'Collaborate with cross-functional teams (product, design, QA) to deliver features within Agile sprint cycles, participating in code review and pair programming to maintain code quality.',
      'Apply CI/CD best practices and containerized deployment workflows (Docker) to ship changes safely, repeatably, and with minimal disruption to downstream consumers.',
    ],
  },
  {
    role: 'Software Engineer',
    company: 'JPMorgan Chase & Co.',
    location: 'Wilmington, DE',
    period: 'September 2022 – January 2025',
    bullets: [
      'Built and maintained React-based front-end features and Node.js services as part of enterprise-scale applications used across internal teams.',
      'Authored unit and integration tests, performed code reviews, and partnered with senior engineers on architectural decisions to improve maintainability and performance.',
      'Promoted to Software Engineer II in January 2025 in recognition of consistent delivery, technical growth, and increased ownership of production systems.',
    ],
  },
  {
    role: 'Junior Software Developer',
    company: 'BDSA',
    location: 'Remote (Colorado, US)',
    period: 'January 2022 – June 2022',
    bullets: [
      'Developed an internal data-processing application focused on user-friendly workflows and operational efficiency for back-office data review.',
      'Worked across the stack (React on the front end, REST APIs on the back end) and contributed to feature specifications and QA cycles.',
    ],
  },
  {
    role: 'Owner / Master Barber',
    company: 'True Barber Co.',
    location: 'Denver, CO',
    period: 'August 2012 – January 2022',
    bullets: [
      'Founded and operated an independent service business for 9+ years; managed P&L, scheduling, marketing, and a recurring client base.',
      'Transferable ownership, communication, and customer-focused problem-solving experience that informs product and engineering decisions today.',
    ],
  },
]

export const selectedProjects = [
  {
    name: 'groundup-cli',
    blurb: 'AI-powered Node.js CLI that takes developers from empty folder to scaffolded, deployed project via an interview-first workflow.',
    href: 'https://npmjs.com/package/groundup-cli',
    bullets: [
      'Published to npm; integrated multi-provider AI (Anthropic Claude, Google Gemini, OpenAI Codex) with live API validation and a single-source-of-truth model registry; ships a `groundup update-models` command for ongoing model maintenance.',
      'Designed and implemented a full pipeline (interview, build, deploy) with per-phase Git snapshots, approval gates, retry-with-feedback loops, and abort/resume via persisted session state.',
      'Built a Vercel deploy stage with framework auto-detection and graceful fallback to manual steps; established a Gitflow release process with squash merges, prereleases, and beta tags on npm.',
    ],
  },
  {
    name: 'megs.me',
    blurb: 'Production e-commerce site for an independent artist; Next.js / TypeScript / Tailwind on Sanity, Stripe, Printful, and Shippo.',
    href: 'https://megs.me',
    bullets: [
      'Designed and built end-to-end: headless CMS, checkout, on-demand fulfillment integration, transactional email (Resend), and a three-mode site config (coming-soon / live / maintenance) deployed on Vercel.',
    ],
  },
  {
    name: 'bükmark',
    blurb: 'Cross-platform mobile app for bookstore discovery; React Native (Expo SDK 54) with Mapbox, Supabase, RevenueCat, and Zustand.',
    href: null,
    bullets: [
      'Built brand system, authentication flow, and an interactive map experience covered by 99 passing tests; configured EAS Build for distribution; styled with NativeWind.',
    ],
  },
  {
    name: 'The Night Borrower',
    blurb: 'Solo Unity HDRP psychological-horror game with companion Next.js promotional site (Framer Motion) deployed on Vercel.',
    href: 'https://thenightborrower.com',
    bullets: [
      'Designed event-driven game architecture (static event bus, slot-based positioning, delta-compressed JSON saves) and shipped a production marketing site with devlog accordion and wishlist flows.',
    ],
  },
]

export const education = [
  {
    degree: 'Bachelor of Science, Computer Science',
    school: 'Southern New Hampshire University',
    period: '2026 – Present',
  },
  {
    degree: 'Software Engineering Immersive',
    school: 'Flatiron School',
    period: '2020 – 2021',
  },
]
