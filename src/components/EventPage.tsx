import { useEffect, useMemo, useState } from 'react'
import { useNow } from '../hooks.ts'
import { detectViewerZone, offsetLabel, resolveEvent } from '../lib/time.ts'
import { parseEventHash, serializeEvent, shareUrl } from '../lib/url.ts'
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

  return (
    <section className="card">
      <h1>{spec.title || 'Event'}</h1>
      {resolved.ok && (
        <p className="subtitle">
          {resolved.event.start.toFormat('cccc d LLLL yyyy, HH:mm')}
          {resolved.event.end &&
            ` – ${resolved.event.end.toFormat(
              resolved.event.end.hasSame(resolved.event.start, 'day') ? 'HH:mm' : 'cccc d LLLL, HH:mm',
            )}`}{' '}
          in <strong>{spec.zone}</strong> ({offsetLabel(resolved.event.start)})
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
        <a className="button secondary" href="#/">
          New event
        </a>
      </div>
    </section>
  )
}
