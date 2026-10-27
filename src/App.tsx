import { useMemo } from 'react'
import EventPage from './components/EventPage.tsx'
import HomePage from './components/HomePage.tsx'
import { useHash } from './hooks.ts'
import { parseEventHash } from './lib/url.ts'

export default function App() {
  const hash = useHash()
  const route = hash.replace(/^#\/?/, '')

  const editing = useMemo(() => {
    if (!route.startsWith('edit/')) return undefined
    const r = parseEventHash(route.slice('edit/'.length))
    return r.ok ? r.event : undefined
  }, [route])

  return (
    <div className="app">
      <header className="app-header">
        <a href="#/" className="brand">
          <img src="./favicon.svg" alt="" />
          When is it?
        </a>
        <span className="tagline">One link, every time zone.</span>
      </header>
      <main>
        {route === '' ? (
          <HomePage key="new" />
        ) : route.startsWith('edit/') ? (
          <HomePage key={route} initial={editing} />
        ) : (
          <EventPage hash={hash} />
        )}
      </main>
      <footer className="app-footer">
        Everything lives in the link — no accounts, no server.
      </footer>
    </div>
  )
}
