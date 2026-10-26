import { DateTime } from 'luxon'
import { useMemo } from 'react'
import { calendarDayDiff, eventStatus, offsetLabel, resolveEvent, zoneCity } from '../lib/time.ts'
import { buildTimeline } from '../lib/timeline.ts'
import type { EventSpec } from '../lib/types.ts'
import Timeline from './Timeline.tsx'
import { zoneRows } from '../lib/zoneRows.ts'

const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
const DATE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }

export default function EventDetails({
  spec,
  viewerZone,
  nowMs,
}: {
  spec: EventSpec
  viewerZone: string
  nowMs: number
}) {
  const resolved = useMemo(() => resolveEvent(spec), [spec])
  const rows = useMemo(() => zoneRows(spec, viewerZone), [spec, viewerZone])
  const timeline = useMemo(() => {
    if (!resolved.ok) return undefined
    return buildTimeline({
      zones: rows.map((r) => ({ zone: r.zone, label: `${zoneCity(r.zone)}${r.tags.includes('you') ? ' (you)' : ''}` })),
      startMs: resolved.event.start.toMillis(),
      endMs: resolved.event.end?.toMillis(),
    })
  }, [resolved, rows])

  if (!resolved.ok) return <p className="error">{resolved.error}</p>
  const { start, end, notes } = resolved.event
  const status = eventStatus(nowMs, start.toMillis(), end?.toMillis())

  const local = rows.map((r) => {
    const s = start.setZone(r.zone)
    const e = end?.setZone(r.zone)
    return { ...r, s, e, dayDiff: calendarDayDiff(s, start) }
  })

  return (
    <div className="event-details">
      <p className={`status status-${status.kind}`}>{status.text}</p>

      <table className="zone-table">
        <thead>
          <tr>
            <th>Time zone</th>
            <th>Starts</th>
            {end && <th>Ends</th>}
          </tr>
        </thead>
        <tbody>
          {local.map((r) => (
            <tr key={r.zone} className={r.tags.includes('you') ? 'is-you' : undefined}>
              <td>
                <div className="zone-name">
                  {zoneCity(r.zone)}
                  {r.tags.map((t) => (
                    <span key={t} className={`tag tag-${t}`}>
                      {t === 'you' ? 'you' : t}
                    </span>
                  ))}
                </div>
                <div className="zone-meta">
                  {r.zone} · {r.s.offsetNameShort} · {offsetLabel(r.s)}
                </div>
              </td>
              <td>
                <Moment dt={r.s} dayDiff={r.dayDiff} />
              </td>
              {r.e && (
                <td>
                  <Moment dt={r.e} dayDiff={calendarDayDiff(r.e, start)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {notes.map((n) => (
        <p key={n} className="note">
          ⚠️ {n}
        </p>
      ))}

      {timeline && (
        <Timeline
          model={timeline}
          nowMs={nowMs}
          sublabels={local.map((r) => `${r.s.toFormat('HH:mm')}${r.e ? `–${r.e.toFormat('HH:mm')}` : ''} ${r.s.offsetNameShort ?? ''}`)}
        />
      )}
    </div>
  )
}

function Moment({ dt, dayDiff }: { dt: DateTime; dayDiff: number }) {
  return (
    <>
      <div className="moment-time">
        {dt.toLocaleString(TIME)}
        {dayDiff !== 0 && (
          <span className="day-diff" title="Compared with the date in the event's time zone">
            {dayDiff > 0 ? `+${dayDiff}` : dayDiff} day
          </span>
        )}
      </div>
      <div className="moment-date">{dt.toLocaleString(DATE)}</div>
    </>
  )
}
