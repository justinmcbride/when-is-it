import { useState } from 'react'
import { useNow } from '../hooks.ts'
import { defaultForm, formToSpec, shiftEndDate, specToForm, type FormState } from '../lib/form.ts'
import { detectViewerZone, isValidZone } from '../lib/time.ts'
import type { EventSpec } from '../lib/types.ts'
import { eventHash, shareUrl } from '../lib/url.ts'
import CopyButton from './CopyButton.tsx'
import EventDetails from './EventDetails.tsx'
import ZoneInput from './ZoneInput.tsx'

const SUGGESTED_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export default function HomePage({ initial }: { initial?: EventSpec }) {
  const [viewerZone] = useState(detectViewerZone)
  const [form, setForm] = useState<FormState>(() => (initial ? specToForm(initial) : defaultForm(viewerZone)))
  const [newZone, setNewZone] = useState('')
  const nowMs = useNow()
  const result = formToSpec(form)

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))
  const addZone = (zone: string) => {
    const z = zone.trim()
    if (!isValidZone(z)) return
    setForm((f) => (f.extraZones.includes(z) || f.zone === z ? f : { ...f, extraZones: [...f.extraZones, z] }))
    setNewZone('')
  }

  return (
    <>
      <section className="card">
        <h1>{initial ? 'Edit a copy of an event' : 'Share a time with anyone, anywhere'}</h1>
        <p className="subtitle">
          Pick a time in your time zone. Everyone who opens the link sees it in their own time zone, plus any
          zones you include.
        </p>

        <form className="event-form" onSubmit={(e) => e.preventDefault()}>
          <label className="field wide">
            <span>Title (optional)</span>
            <input
              value={form.title}
              maxLength={200}
              placeholder="Team sync"
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              required
              onChange={(e) => update({ date: e.target.value, endDate: shiftEndDate(form, e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Starts</span>
            <input type="time" value={form.start} required onChange={(e) => update({ start: e.target.value })} />
          </label>

          <label className="field checkbox wide">
            <input type="checkbox" checked={form.hasEnd} onChange={(e) => update({ hasEnd: e.target.checked })} />
            <span>Add an end time</span>
          </label>
          {form.hasEnd && (
            <>
              <label className="field">
                <span>End date</span>
                <input type="date" value={form.endDate} onChange={(e) => update({ endDate: e.target.value })} />
              </label>
              <label className="field">
                <span>
                  Ends {result.ok && result.endNextDay && <em className="hint">(next day)</em>}
                </span>
                <input type="time" value={form.end} onChange={(e) => update({ end: e.target.value })} />
              </label>
            </>
          )}

          <label className="field wide">
            <span>Event time zone</span>
            <ZoneInput value={form.zone} onChange={(zone) => update({ zone })} />
          </label>

          <div className="field wide">
            <span>Also show these time zones (optional)</span>
            <div className="chips">
              {form.extraZones.map((z) => (
                <span key={z} className="chip">
                  {z}
                  <button
                    type="button"
                    aria-label={`Remove ${z}`}
                    onClick={() => update({ extraZones: form.extraZones.filter((x) => x !== z) })}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="add-zone">
              <ZoneInput value={newZone} onChange={setNewZone} onEnter={() => addZone(newZone)} placeholder="Search zones…" />
              <button type="button" className="button secondary" disabled={!isValidZone(newZone.trim())} onClick={() => addZone(newZone)}>
                Add
              </button>
            </div>
            <div className="suggestions">
              {SUGGESTED_ZONES.filter((z) => z !== form.zone && !form.extraZones.includes(z)).map((z) => (
                <button key={z} type="button" className="link-button" onClick={() => addZone(z)}>
                  + {z}
                </button>
              ))}
            </div>
          </div>
        </form>

        {result.ok ? (
          <div className="share">
            <label className="field wide">
              <span>Shareable link</span>
              <input readOnly value={shareUrl(result.spec)} onFocus={(e) => e.target.select()} />
            </label>
            <div className="actions">
              <CopyButton text={shareUrl(result.spec)} label="Copy link" />
              <a className="button secondary" href={eventHash(result.spec)}>
                Open
              </a>
            </div>
          </div>
        ) : (
          <p className="error">{result.error}</p>
        )}
      </section>

      {result.ok && (
        <section className="card">
          <h2>Preview</h2>
          <EventDetails spec={result.spec} viewerZone={viewerZone} nowMs={nowMs} />
        </section>
      )}
    </>
  )
}
