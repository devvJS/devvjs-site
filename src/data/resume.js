export const resumeFile = '/resume.pdf'

export const header = {
  name: 'Dakota Coppage',
  title: 'Senior Software Engineer · Full-Stack and AI Systems',
  location: 'Wilmington, DE · Remote',
  email: 'devv@devvjs.dev',
  links: [
    { label: 'linkedin.com/in/dkc86', href: 'https://linkedin.com/in/dkc86' },
    { label: 'github.com/devvJS', href: 'https://github.com/devvJS' },
    { label: 'npmjs.com/~devvjs', href: 'https://npmjs.com/~devvjs' },
  ],
}

export const summary =
  'Full-stack engineer with over four years building and shipping production web applications across React, Angular, Node, and Java. Maintains automated test coverage on 11 production applications, rebuilt a team’s testing approach around pre-merge CI gates, and built the MCP-backed workflows the team now uses for coverage, release cuts, and runbooks. Works AI-first on analysis, code review, and refactoring, while verifying every change against the regulatory standards it has to meet. Applies the same rigor to AI systems, including a LangGraph clinical co-pilot with retrieval-grounded answers and a two-tier evaluation suite that gates every push. Two developer tools published to npm. Nine years running an independent business before moving into engineering.'

export const technicalSkills = [
  {
    label: 'Languages',
    items: ['TypeScript', 'JavaScript', 'Java', 'Python', 'Ruby', 'SQL', 'Bash', 'HTML5', 'CSS3'],
  },
  {
    label: 'Frontend',
    items: ['React', 'Angular', 'Redux', 'Next.js', 'React Native', 'Expo', 'SASS', 'Tailwind CSS', 'Styled Components', 'Framer Motion', 'design systems and component libraries', 'WCAG accessibility'],
  },
  {
    label: 'Backend & Data',
    items: ['Node.js', 'Express', 'Java services', 'GraphQL', 'REST', 'Ruby on Rails', 'PostgreSQL', 'Supabase', 'SQLite', 'OAuth2 and SMART on FHIR with PKCE', 'Stripe', 'webhooks'],
  },
  {
    label: 'AI Engineering',
    items: ['RAG pipelines', 'LangGraph', 'LangChain', 'Anthropic Claude API', 'OpenAI', 'Model Context Protocol (MCP)', 'agentic workflows', 'golden-set and behavioral evals', 'Langfuse observability', 'prompt engineering'],
  },
  {
    label: 'Testing & CI/CD',
    items: ['Playwright', 'Cypress', 'Jest', 'JUnit', 'pre-merge CI gates', 'governance and compliance gating', 'GitHub Actions', 'Spinnaker', 'Docker', 'Gitflow'],
  },
  {
    label: 'Cloud & Tooling',
    items: ['AWS', 'Vercel', 'Railway', 'Git', 'Linux and WSL', 'npm', 'Jira', 'Confluence', 'Atlassian workflows', 'release management'],
  },
]

export const experience = [
  {
    role: 'Software Engineer II',
    company: 'JPMorgan Chase & Co.',
    location: 'Wilmington, DE',
    period: 'January 2025 – Present',
    bullets: [
      'Built e2e-pilot, an application-agnostic AI agent skill that drives Playwright through complete user flows against live builds to replace manual regression passes. Currently in beta and slated for contribution to the firm’s internal skill directory.',
      'Rebuilt the team’s testing approach from post-deploy smoke checks to pre-merge CI gates covering a React frontend, its Node service, and a separately deployed downstream service on its own pipeline. Authored the PR gates that enforce firm governance and compliance standards, so both breakage and audit failures surface before release rather than after.',
      'Built MCP-server-backed AI workflows that keep the team working inside the IDE rather than across several web consoles, pulling Jira context, updating Confluence runbooks, checking work against story standards, polling live build logs to surface failures while a pipeline is still running, and driving release cuts.',
      'Built conversion tooling using MCP servers, inline skills, and CLIs to port components between the team’s Angular and React applications, keeping cross-framework migration fast without loosening governance requirements.',
      'Maintain automated test coverage across 11 applications, holding each above the firm’s 70 percent quality gate and typically between 80 and 90 percent.',
      'Own release cuts and CI/CD pipeline health against JPMorgan Chase engineering standards across React and Angular frontends backed by Node and Java services, and deliver features for an internal payments application supporting a business line’s operations team.',
    ],
  },
  {
    role: 'Software Engineer',
    company: 'JPMorgan Chase & Co.',
    location: 'Wilmington, DE',
    period: 'September 2022 – January 2025',
    bullets: [
      'Led the main development effort on a new internal application, building the React and TypeScript frontend from scratch on the firm’s internal component service with SASS for styling beyond it, and designing the UI workflows the application runs on.',
      'Raised automated test coverage on a production service from under 60 percent to 93 percent, and held that bar through code review as the team grew.',
      'Built and maintained Node.js services behind enterprise applications used across internal business lines, working with senior engineers on architecture and carrying features from design review through to production.',
      'Promoted to Software Engineer II in January 2025 for consistent delivery and expanded ownership of production systems.',
    ],
  },
  {
    role: 'Junior Software Developer',
    company: 'BDSA',
    location: 'Remote (Colorado)',
    period: 'January 2022 – June 2022',
    bullets: [
      'Built an internal data-processing application end to end, covering the React frontend and REST services, focused on back-office review workflows. Contributed to feature specifications and QA cycles.',
    ],
  },
  {
    role: 'Owner and Master Barber',
    company: 'True Barber Co.',
    location: 'Denver, CO',
    period: 'August 2012 – January 2022',
    bullets: [
      'Founded and ran an independent service business for nine years, managing P&L, scheduling, marketing, and a recurring client base.',
    ],
  },
]

export const selectedProjects = [
  {
    name: 'AgentForge',
    blurb: 'Clinical co-pilot sidecar for an EHR system; Python, LangGraph, Claude, and Langfuse.',
    href: null,
    bullets: [
      'Python sidecar service integrated with a forked OpenEMR instance, built for a nurse-practitioner workflow operating under a collaborative practice agreement. Uses OAuth2 and SMART with PKCE for authentication, deployed on Railway.',
      'Used LangGraph’s durable pause and resume semantics so scope-of-practice decisions escalate to a human reviewer and resume cleanly afterward, making the escalation path a first-class state machine rather than a prompt instruction.',
      'Built the retrieval layer so answers are grounded in the clinician’s own uploaded documents and cite their source rather than relying on model recall.',
      'Shipped four workflows: pre-visit brief, refill safety check, scope-of-practice escalation, and note-to-claim verification.',
      'Built a two-tier evaluation suite that separates deterministic unit tests from live-model evals. A 10-case golden set gates every push, and a roughly 100-case behavioral coverage run executes on a slower cadence, traced end to end in Langfuse.',
    ],
  },
  {
    name: 'Docket (npm: testdocket)',
    blurb: 'Open-core Playwright test-suite governance CLI; Node.js and TypeScript.',
    href: 'https://npmjs.com/package/testdocket',
    bullets: [
      'Published an open-core CLI with a free MIT core covering audit, rules, and CI scaffolding, plus a paid tier for PR gating, flake triage, and runtime cost reporting.',
      'The guard command runs on every pull request, blocks only on tests that pull request actually touched, and reads Playwright’s JSON reporter for measured runtimes and flake outcomes, pricing a test suite by what it costs on every run rather than by line count.',
    ],
  },
  {
    name: 'groundup-cli',
    blurb: 'AI-powered project scaffolding CLI published to npm.',
    href: 'https://npmjs.com/package/groundup-cli',
    bullets: [
      'Interview-first CLI that takes a developer from empty folder to deployed project, with multi-provider AI covering Claude, Gemini, and Codex behind a single-source-of-truth model registry and live API validation.',
      'Full interview, build, and deploy pipeline with per-phase Git snapshots, approval gates, retry-with-feedback loops, and abort or resume from persisted session state. Vercel deploy stage with framework auto-detection.',
    ],
  },
  {
    name: 'megs.me',
    blurb: 'Production e-commerce storefront; Next.js, TypeScript, Sanity, and Stripe.',
    href: 'https://megs.me',
    bullets: [
      'Built end to end: headless CMS, checkout, on-demand fulfillment through Printful and Shippo, transactional email, and a three-mode site config for coming-soon, live, and maintenance.',
    ],
  },
  {
    name: 'bükmark',
    blurb: 'Cross-platform bookstore discovery app; React Native and Expo SDK 54.',
    href: null,
    bullets: [
      'Brand system, authentication flow, and an interactive Mapbox experience backed by Supabase and Zustand, covered by 99 passing tests and distributed through EAS Build.',
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
    degree: 'Software Engineering Immersive',
    school: 'Flatiron School',
    period: '2020 – 2021',
  },
]
