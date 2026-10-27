import { DateTime } from 'luxon'
import { formatHour, formatHourOfDay, formatTime } from '../lib/format.ts'
import type { Timeline as TimelineModel } from '../lib/timeline.ts'
import { NIGHT_END, NIGHT_START, WORK_END, WORK_START, position } from '../lib/timeline.ts'

export interface TimelineProps {
  model: TimelineModel
  nowMs: number
  /** Extra text under each row label, keyed by row index. */
  sublabels?: string[]
}

const pct = (f: number) => `${(Math.min(1, Math.max(0, f)) * 100).toFixed(3)}%`

const KIND_TEXT = { night: 'night', off: 'off hours', work: 'working hours' } as const

const DAY_LABEL: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }

export default function Timeline({ model, nowMs, sublabels }: TimelineProps) {
  const pos = (ms: number) => position(model, ms)
  const at = (ms: number, zone: string) => DateTime.fromMillis(ms, { zone })
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
                  title={`${formatTime(at(s.startMs, row.zone))}–${formatTime(at(s.endMs, row.zone))} ${KIND_TEXT[s.kind]} in ${row.zone}`}
                />
              ))}
              {(row.days.length === 0 || pos(row.days[0]) > 0.15) && (
                <span className="tl-date tl-date-start">
                  {at(model.windowStartMs, row.zone).toLocaleString(DAY_LABEL)}
                </span>
              )}
              {row.days.map((ms) => (
                <div key={ms} className="tl-day" style={{ left: pct(pos(ms)) }}>
                  <span className="tl-date">{at(ms, row.zone).toLocaleString(DAY_LABEL)}</span>
                </div>
              ))}
              {row.ticks
                .filter((t) => pos(t.ms) > 0.015 && pos(t.ms) < 0.985)
                .map((t) => (
                  <span
                    key={t.ms}
                    className={t.hour % (model.tickStepHours * 2) === 0 ? 'tl-tick' : 'tl-tick tl-tick-minor'}
                    style={{ left: pct(pos(t.ms)) }}
                  >
                    {formatHour(at(t.ms, row.zone))}
                  </span>
                ))}
            </div>
          </div>
        ))}

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
        <span>
          <i className="sw tl-work" /> working ({formatHourOfDay(WORK_START)}–{formatHourOfDay(WORK_END)})
        </span>
        <span>
          <i className="sw tl-night" /> night ({formatHourOfDay(NIGHT_START)}–{formatHourOfDay(NIGHT_END)})
        </span>
        <span>
          <i className="sw sw-event" /> event
        </span>
        <span>
          <i className="sw sw-now" /> now
        </span>
      </div>
    </>
  )
}
