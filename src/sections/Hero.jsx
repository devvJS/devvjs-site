import TypingEffect from '../components/TypingEffect'
import heroMark from '../assets/hero.svg'

function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-4xl w-full flex flex-col items-start">
        <p className="font-mono text-accent-green text-sm sm:text-base mb-4">
          <span className="opacity-70">&gt;</span> hello world, system.print("me") 
        <img
            src={heroMark}
            alt="{devvJS}"
            className="inline-block w-100 h-100 -mt-1"
        />
        </p>

        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-text-primary/90">
          A software developer crafting clean, thoughtful web experiences
          where engineering rigor meets an eye for design.
        </p>

        <div className="mt-8 font-mono text-sm sm:text-lg text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <span className="text-accent-green">$</span>{' '}
            <span className="text-text-primary">whoami</span>
          </span>
          <span className="text-text-secondary">→</span>
          <TypingEffect
            strings={[
              'full-stack developer',
              'AI engineer',
              'problem solver',
              'ui tinkerer',
              'systems thinker',
            ]}
            className="text-accent-cyan"
            cursorClassName="text-accent-green ml-0.5"
          />
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="#about"
            className="inline-flex items-center gap-2 rounded-md border border-accent-green/60 px-5 py-2.5 font-mono text-sm text-accent-green hover:bg-accent-green/10 hover:shadow-[0_0_14px_rgba(57,255,20,0.35)] transition"
          >
            ./learn_more
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-md border border-text-secondary/60 px-5 py-2.5 font-mono text-sm text-text-primary hover:border-accent-cyan hover:text-accent-cyan transition"
          >
            ./contact
          </a>
        </div>
      </div>

      <a
        href="#about"
        aria-label="Scroll to About section"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-text-secondary hover:text-accent-green transition"
      >
        <span className="font-mono text-xs tracking-widest uppercase mb-2">
          scroll
        </span>
        <span className="h-10 w-px bg-current animate-pulse" aria-hidden="true" />
      </a>
    </section>
  )
}

export default Hero