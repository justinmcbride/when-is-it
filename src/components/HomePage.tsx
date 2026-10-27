import { useState } from 'react'
import { useNow } from '../hooks.ts'
import { defaultForm, formToSpec, shiftEndDate, specToForm, type FormState } from '../lib/form.ts'
import { loadSavedZones, saveZones } from '../lib/storage.ts'
import { detectViewerZone, isValidZone, zoneCity } from '../lib/time.ts'
import type { EventSpec } from '../lib/types.ts'
import { eventHash, shareUrl } from '../lib/url.ts'
import { SUGGESTED_ZONES, zoneLabel, zoneName } from '../lib/zoneNames.ts'
import CopyButton from './CopyButton.tsx'
import EventDetails from './EventDetails.tsx'
import ZonePicker from './ZonePicker.tsx'

function initialForm(viewerZone: string, initial?: EventSpec): FormState {
  if (initial) return specToForm(initial)
  const form = defaultForm(viewerZone)
  return { ...form, extraZones: loadSavedZones().filter((z) => z !== form.zone) }
}

export default function HomePage({ initial }: { initial?: EventSpec }) {
  const [viewerZone] = useState(detectViewerZone)
  const [form, setForm] = useState<FormState>(() => initialForm(viewerZone, initial))
  const nowMs = useNow()
  const result = formToSpec(form)

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))
  const setExtras = (extraZones: string[]) => {
    update({ extraZones })
    saveZones(extraZones)
  }
  const toggleZone = (zone: string) => {
    if (!isValidZone(zone) || zone === form.zone) return
    setExtras(form.extraZones.includes(zone) ? form.extraZones.filter((z) => z !== zone) : [...form.extraZones, zone])
  }
  const addZone = (zone: string) => {
    if (!form.extraZones.includes(zone)) toggleZone(zone)
  }

  // Suggested zones first (in a stable order), then anything else the user picked.
  const pills = [...SUGGESTED_ZONES, ...form.extraZones.filter((z) => !SUGGESTED_ZONES.includes(z))].filter(
    (z) => z !== form.zone,
  )

  return (
    <>
      <section className="card">
        <h1>{initial ? 'Edit a copy of an event' : 'Share a time with anyone, anywhere'}</h1>
        <p className="subtitle">
          Pick a time in your time zone. Everyone who opens the link sees it in their own time zone, plus any
          zones you include.
        </p>

        <form className="event-form" onSubmit={(e) => e.preventDefault()}>
          <h3 className="form-section">What</h3>
          <label className="field wide">
            <span>Title (optional)</span>
            <input
              value={form.title}
              maxLength={200}
              placeholder="Team sync"
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>

          <h3 className="form-section">When</h3>
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

          <label className="switch wide">
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

          <h3 className="form-section">Where</h3>
          <label className="field wide">
            <span>Event time zone</span>
            <ZonePicker value={form.zone} onSelect={(zone) => update({ zone })} />
          </label>

          <div className="field wide">
            <span>Also show these time zones</span>
            <div className="pills" role="group" aria-label="Time zones to include">
              {pills.map((z) => {
                const on = form.extraZones.includes(z)
                return (
                  <button
                    key={z}
                    type="button"
                    className="pill"
                    aria-pressed={on}
                    title={`${zoneLabel(z)} (${z})`}
                    onClick={() => toggleZone(z)}
                  >
                    <span className="pill-check" aria-hidden="true">
                      {on ? '✓' : '+'}
                    </span>
                    {zoneCity(z)}
                    {zoneName(z) && <span className="pill-name">{zoneName(z)}</span>}
                  </button>
                )
              })}
            </div>
            <ZonePicker
              onSelect={addZone}
              exclude={[form.zone, ...form.extraZones]}
              label="Add another time zone"
              placeholder="Add another: city, zone name (Pacific Time) or abbreviation (CET)…"
            />
            <small className="hint">
              Your picks are remembered on this device.
              {form.extraZones.length > 0 && (
                <>
                  {' '}
                  <button type="button" className="link-button" onClick={() => setExtras([])}>
                    Clear all
                  </button>
                </>
              )}
            </small>
          </div>
        </form>

        {result.ok ? (
          <div className="share">
            <div className="field wide">
              <label htmlFor="share-link">Shareable link</label>
              <div className="share-row">
                <input id="share-link" readOnly value={shareUrl(result.spec)} onFocus={(e) => e.target.select()} />
                <CopyButton text={shareUrl(result.spec)} label="Copy link" />
                <a className="button secondary" href={eventHash(result.spec)}>
                  Open
                </a>
              </div>
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
