import useScrollReveal from '../hooks/useScrollReveal'

function SectionWrapper({ id, title, children }) {
  const [ref, isVisible] = useScrollReveal()

  return (
    <section
      id={id}
      ref={ref}
      className={`py-20 sm:py-24 scroll-mt-20 transition-all duration-700 ease-out motion-reduce:transition-none ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 motion-reduce:translate-y-0 motion-reduce:opacity-100'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="font-mono text-2xl sm:text-3xl text-text-primary mb-10">
            <span className="text-accent-green">$</span> {title}
            <span className="block mt-2 h-px w-16 bg-accent-green shadow-[0_0_8px_rgba(57,255,20,0.5)]" />
          </h2>
        )}
        {children}
      </div>
    </section>
  )
}

export default SectionWrapper