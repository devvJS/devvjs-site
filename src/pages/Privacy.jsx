import { useEffect } from 'react'

function Privacy() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 min-h-[60vh]">
      <h1 className="font-mono text-3xl sm:text-4xl font-bold text-accent-green">Privacy</h1>
      <p className="mt-6 max-w-2xl text-text-primary leading-relaxed">
        The House is a personal tool used only by its owner. Google data is not shared with anyone.
      </p>
    </section>
  )
}

export default Privacy
