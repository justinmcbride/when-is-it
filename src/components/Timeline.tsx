import { DateTime } from 'luxon'
import type { Timeline as TimelineModel } from '../lib/timeline.ts'
import { position } from '../lib/timeline.ts'

export interface TimelineProps {
  model: TimelineModel
  nowMs: number
  /** Extra text under each row label, keyed by row index. */
  sublabels?: string[]
}

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`

const KIND_TEXT = { night: 'night', off: 'off hours', work: 'working hours' } as const

export default function Timeline({ model, nowMs, sublabels }: TimelineProps) {
  const pos = (ms: number) => position(model, ms)
  const { startMs, endMs } = model.event
  const evLeft = pos(startMs)
  const evRight = pos(endMs ?? startMs)
  const nowPos = pos(nowMs)
  const nowVisible = nowPos >= 0 && nowPos <= 1

  return (
    <>
      <div className="timeline" role="img" aria-label="Timeline of the event across time zones">
        {model.rows.map((row, i) => (
          <div className="tl-row" key={row.zone}>
            <div className="tl-label">
              <div className="tl-label-main">{row.label}</div>
              {sublabels?.[i] && <div className="tl-label-sub">{sublabels[i]}</div>}
            </div>
            <div className="tl-track">
              {row.segments.map((s) => (
                <div
                  key={s.startMs}
                  className={`tl-seg tl-${s.kind}`}
                  style={{ left: pct(pos(s.startMs)), width: pct(pos(s.endMs) - pos(s.startMs)) }}
                  title={`${fmt(s.startMs, row.zone)}–${fmt(s.endMs, row.zone)} ${KIND_TEXT[s.kind]} in ${row.zone}`}
                />
              ))}
              {(row.days.length === 0 || pos(row.days[0].ms) > 0.15) && (
                <span className="tl-date tl-date-start">{row.startDateLabel}</span>
              )}
              {row.days.map((d) => (
                <div key={d.ms} className="tl-day" style={{ left: pct(pos(d.ms)) }}>
                  <span className="tl-date">{d.label}</span>
                </div>
              ))}
              {row.ticks.filter((t) => pos(t.ms) > 0.015 && pos(t.ms) < 0.985).map((t) => (
                <span key={t.ms} className="tl-tick" style={{ left: pct(pos(t.ms)) }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        ))}

        {model.rows.length > 1 && (
          <div className="tl-row tl-overlap-row">
            <div className="tl-label">
              <div className="tl-label-main">Overlap</div>
              <div className="tl-label-sub">
                {model.workOverlap.length ? 'everyone working / awake' : 'no shared working hours'}
              </div>
            </div>
            <div className="tl-track tl-track-overlap">
              {model.awakeOverlap.map((iv) => (
                <div
                  key={`a${iv.startMs}`}
                  className="tl-seg tl-awake-all"
                  style={{ left: pct(pos(iv.startMs)), width: pct(pos(iv.endMs) - pos(iv.startMs)) }}
                  title="Nobody is in night hours"
                />
              ))}
              {model.workOverlap.map((iv) => (
                <div
                  key={`w${iv.startMs}`}
                  className="tl-seg tl-work-all"
                  style={{ left: pct(pos(iv.startMs)), width: pct(pos(iv.endMs) - pos(iv.startMs)) }}
                  title="Everyone is in working hours"
                />
              ))}
            </div>
          </div>
        )}

        <div className="tl-overlay" aria-hidden="true">
          <div
            className={`tl-event ${endMs === undefined ? 'tl-event-point' : ''}`}
            style={{ left: pct(evLeft), width: endMs === undefined ? undefined : pct(evRight - evLeft) }}
          >
            <span className="tl-event-label">event</span>
          </div>
          {nowVisible && (
            <div className="tl-now" style={{ left: pct(nowPos) }}>
              <span className="tl-now-label">now</span>
            </div>
          )}
        </div>
      </div>

      <div className="tl-legend">
        <span><i className="sw tl-work" /> working (09–17)</span>
        <span><i className="sw tl-off" /> off hours</span>
        <span><i className="sw tl-night" /> night (22–07)</span>
        <span><i className="sw sw-event" /> event</span>
        <span><i className="sw sw-now" /> now</span>
      </div>
    </>
  )
}

function fmt(ms: number, zone: string) {
  return DateTime.fromMillis(ms, { zone }).toFormat('HH:mm')
}
