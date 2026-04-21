function TerminalCard({ title, children, className = '' }) {
  return (
    <div
      className={`rounded-lg border border-accent-green/30 bg-[#11141a] shadow-[0_0_18px_rgba(57,255,20,0.08)] overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-text-secondary/30 bg-black/40">
        <span className="h-3 w-3 rounded-full bg-red-500/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" aria-hidden="true" />
        {title && (
          <span className="ml-3 font-mono text-xs text-text-secondary truncate">
            {title}
          </span>
        )}
      </div>
      <div className="p-5 font-sans text-text-primary">{children}</div>
    </div>
  )
}

export default TerminalCard