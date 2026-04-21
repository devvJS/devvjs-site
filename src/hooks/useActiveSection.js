import { useEffect, useState } from 'react'

export default function useActiveSection(sectionIds, { rootMargin = '-45% 0px -45% 0px' } = {}) {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const nodes = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (nodes.length === 0) return

    const visible = new Map()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio)
          } else {
            visible.delete(entry.target.id)
          }
        })

        if (visible.size > 0) {
          const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0][0]
          setActiveId(top)
        }
      },
      { rootMargin, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [sectionIds, rootMargin])

  return activeId
}