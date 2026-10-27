import { useEffect, useMemo, useState } from 'react'
import { useNow } from '../hooks.ts'
import { formatLongDate, formatShortDate, formatTime } from '../lib/format.ts'
import { detectViewerZone, offsetLabel, resolveEvent, zoneCity } from '../lib/time.ts'
import { parseEventHash, serializeEvent, shareUrl } from '../lib/url.ts'
import { zoneLabel } from '../lib/zoneNames.ts'
import CopyButton from './CopyButton.tsx'
import EventDetails from './EventDetails.tsx'

export default function EventPage({ hash }: { hash: string }) {
  const parsed = useMemo(() => parseEventHash(hash), [hash])
  const [viewerZone] = useState(detectViewerZone)
  const nowMs = useNow()

  const title = parsed.ok ? parsed.event.title : undefined
  useEffect(() => {
    document.title = title ? `${title} — When is it?` : 'When is it?'
    return () => {
      document.title = 'When is it?'
    }
  }, [title])

  if (!parsed.ok) {
    return (
      <section className="card">
        <h1>That link doesn't look right</h1>
        <p className="error">{parsed.error}</p>
        <p>
          <a href="#/">Create a new event</a>
        </p>
      </section>
    )
  }

  const spec = parsed.event
  const resolved = resolveEvent(spec)
  const yourStart = resolved.ok ? resolved.event.start.setZone(viewerZone) : undefined
  const yourEnd = resolved.ok ? resolved.event.end?.setZone(viewerZone) : undefined

  return (
    <section className="card">
      <h1>{spec.title || 'Event'}</h1>
      {yourStart && (
        <p className="your-time">
          <span className="your-time-label">Your time · {zoneCity(viewerZone)}</span>
          <span className="your-time-value">
            {formatLongDate(yourStart)}
            <br />
            <strong>
              {formatTime(yourStart)}
              {yourEnd &&
                ` – ${yourEnd.hasSame(yourStart, 'day') ? '' : `${formatShortDate(yourEnd)}, `}${formatTime(yourEnd)}`}
            </strong>
          </span>
        </p>
      )}
      {resolved.ok && (
        <p className="subtitle">
          Scheduled in <strong>{zoneLabel(spec.zone)}</strong> ({spec.zone}, {offsetLabel(resolved.event.start)})
        </p>
      )}
      {parsed.warnings.map((w) => (
        <p key={w} className="note">
          ⚠️ {w}
        </p>
      ))}

      <EventDetails spec={spec} viewerZone={viewerZone} nowMs={nowMs} />

      <div className="actions">
        <CopyButton text={shareUrl(spec)} label="Copy link" />
        <a className="button secondary" href={`#/edit${serializeEvent(spec)}`}>
          Edit a copy
        </a>
        <a className="button ghost" href="#/">
          New event
        </a>
      </div>
    </section>
  )
}
