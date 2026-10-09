import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ROUTES } from '../routes'

const LINK_CLASS =
  'inline-flex items-center rounded-md border border-accent-cyan/50 px-4 py-2 font-mono text-sm text-accent-cyan hover:bg-accent-cyan/10 hover:border-accent-cyan hover:shadow-[0_0_14px_rgba(0,229,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan transition'

function NotFound() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    // main already clears the fixed navbar (pt-14); pb-14 balances it so the
    // content sits at the true middle of the viewport.
    <section
      data-testid="not-found"
      className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4 pb-14"
    >
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-8 max-w-full text-left font-mono text-xs sm:text-sm text-text-secondary inline-block">
          <div className="break-words">
            <span className="text-accent-green">$</span>{' '}
            <span className="text-text-primary">cd {pathname}</span>
          </div>
          <div className="break-words">bash: cd: {pathname}: No such file or directory</div>
        </div>

        <h1 className="font-mono font-bold tracking-tight">
          <span className="block text-7xl sm:text-8xl text-accent-green drop-shadow-[0_0_18px_rgba(57,255,20,0.35)]">
            404
          </span>{' '}
          <span className="mt-2 block text-2xl sm:text-3xl text-text-primary">Not Found</span>
        </h1>

        <p className="mt-4 text-text-primary/90">This is not the page you are looking for</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to={ROUTES.home} className={LINK_CLASS}>
            {'<- Go back'}
          </Link>
          <Link to={ROUTES.game} className={LINK_CLASS}>
            {'Waste time ->'}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default NotFound
