import { useEffect } from 'react'

function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-14 pb-24">
      <p className="font-mono text-accent-green text-sm">
        <span className="opacity-70">&gt;</span> cat ~/privacy.md
      </p>
      <h1 className="mt-4 text-3xl sm:text-4xl font-mono tracking-tight text-text-primary">
        Privacy
      </h1>
      <p className="mt-6 text-text-primary/90 leading-relaxed">
        The House is a personal tool used only by its owner. Google data is not shared with anyone.
      </p>
    </section>
  )
}

export default Privacy
