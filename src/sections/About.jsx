import SectionWrapper from '../components/SectionWrapper'
import TerminalCard from '../components/TerminalCard'
import GitHubStats from '../components/GitHubStats'

function About() {
    return (
        <SectionWrapper id="about" title="about">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-start">
                <div className="md:col-span-3 space-y-5 text-text-primary/90 leading-relaxed">
                    <p>
                        I&apos;m <span className="font-mono text-accent-green">devvJS</span>, a{' '}
                        <span className="text-accent-cyan">software engineer</span> at{' '}
                        <span className="font-mono text-text-primary">JPMorgan Chase</span>{' '}
                        building enterprise-scale systems, and a site-tinkerer since{' '}
                        <span className="font-mono text-accent-green">2012</span> who went all-in
                        on the craft in <span className="font-mono text-accent-green">2022</span>.
                        Started on <span className="font-mono text-text-primary">Ruby on Rails</span>{' '}
                        and <span className="font-mono text-text-primary">vanilla JS</span>. Still
                        grateful to both.
                    </p>
                    <p>
                        Day-to-day I ship with{' '}
                        <span className="font-mono text-text-primary">TypeScript</span>,{' '}
                        <span className="font-mono text-text-primary">React</span>,{' '}
                        <span className="font-mono text-text-primary">Node</span>, and{' '}
                        <span className="font-mono text-text-primary">GraphQL</span> across
                        close-knit teams and offshore collaboration. I care about{' '}
                        <span className="text-accent-cyan">clean abstractions</span>, honest
                        documentation, and coordination: the quiet infrastructure that makes good
                        work possible. I reach for{' '}
                        <span className="text-accent-green">AI tools</span> where they earn their
                        keep, which is increasingly often, not without{' '}
                        <span className="text-accent-cyan">thorough code reviews</span>...
                        obviously :).
                    </p>
                    <p>
                        Off-hours I build <span className="text-accent-green">CLIs nobody asked for</span>,
                        collect vinyl, play hockey, and am currently bringing up my first{' '}
                        <span className="font-mono text-text-primary">Linux</span> system. Also a
                        dad, which is the hardest, best, and most caffeine-intensive job I&apos;ll
                        ever have.
                    </p>
                    <p>
                        I believe most tools are a{' '}
                        <span className="text-accent-cyan">posture disguised as a feature set</span>.
                        I build accordingly.
                    </p>
                </div>

                <div className="md:col-span-2">
                    <TerminalCard title="~/about/stats.json">
                        <ul className="font-mono text-sm space-y-2">
                            <li className="flex justify-between gap-4">
                                <span className="text-text-secondary">role</span>
                                <span className="text-accent-cyan">software_developer</span>
                            </li>
                            <li className="flex justify-between gap-4">
                                <span className="text-text-secondary">focus</span>
                                <span className="text-text-primary">web + tooling</span>
                            </li>
                            <li className="flex justify-between gap-4">
                                <span className="text-text-secondary">loves</span>
                                <span className="text-accent-green">clean_code</span>
                            </li>
                            <li className="flex justify-between gap-4">
                                <span className="text-text-secondary">caffeine</span>
                                <span className="text-text-primary">over 9000</span>
                            </li>
                            <li className="flex justify-between gap-4">
                                <span className="text-text-secondary">status</span>
                                <span className="text-accent-green inline-flex items-center gap-2">
                                    <span
                                        className="h-2 w-2 rounded-full bg-accent-green shadow-[0_0_6px_rgba(57,255,20,0.8)]"
                                        aria-hidden="true"
                                    />
                                    shipping
                                </span>
                            </li>
                        </ul>
                    </TerminalCard>
                </div>
            </div>

            <GitHubStats />
        </SectionWrapper>
    )
}

export default About