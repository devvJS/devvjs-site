function SkillBadge({ children, accent = 'cyan' }) {
  const accentClasses =
    accent === 'green'
      ? 'border-accent-green/50 text-accent-green hover:shadow-[0_0_10px_rgba(57,255,20,0.5)] hover:border-accent-green'
      : 'border-accent-cyan/50 text-accent-cyan hover:shadow-[0_0_10px_rgba(0,229,255,0.5)] hover:border-accent-cyan'

  return (
    <span
      className={`inline-flex items-center rounded-md border px-3 py-1 font-mono text-xs sm:text-sm bg-black/30 transition-all duration-200 ${accentClasses}`}
    >
      {children}
    </span>
  )
}

export default SkillBadge