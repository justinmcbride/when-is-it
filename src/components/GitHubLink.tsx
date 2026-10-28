import type { CSSProperties } from 'react'

export const REPO_URL = 'https://github.com/justinmcbride/when-is-it'

// Ported from justinmcbride/react-pig-latin-translator: start position, travel, size, duration, delay, colors.
const BUBBLES = [
  { x: 20, y: 20, dx: -30, dy: -60, size: 8, dur: 2, delay: 0, from: '#f472b6', to: '#a855f7' },
  { x: 10, y: 25, dx: -30, dy: -70, size: 12, dur: 2.2, delay: 0.2, from: '#60a5fa', to: '#06b6d4' },
  { x: 30, y: 15, dx: -25, dy: -55, size: 6, dur: 1.8, delay: 0.4, from: '#facc15', to: '#f97316' },
  { x: 5, y: 30, dx: -35, dy: -65, size: 10, dur: 2.1, delay: 0.6, from: '#4ade80', to: '#10b981' },
  { x: 25, y: 10, dx: -30, dy: -75, size: 8, dur: 1.9, delay: 0.8, from: '#f87171', to: '#ec4899' },
  { x: 15, y: 35, dx: -40, dy: -50, size: 4, dur: 2.3, delay: 1, from: '#818cf8', to: '#a855f7' },
]

export default function GitHubLink() {
  return (
    <a
      className="github-link"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View the source code on GitHub (opens in a new tab)"
      title="View on GitHub"
    >
      <span className="gh-bubbles" aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="gh-bubble"
            style={
              {
                left: b.x,
                top: b.y,
                width: b.size,
                height: b.size,
                background: `linear-gradient(to right, ${b.from}, ${b.to})`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
                '--dx': `${b.dx}px`,
                '--dy': `${b.dy}px`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <svg className="gh-mark" viewBox="0 0 98 96" width="40" height="40" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
        />
      </svg>
    </a>
  )
}
