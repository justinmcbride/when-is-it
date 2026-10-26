import { DateTime } from 'luxon'
import { addDays, compareWallTime, isValidZone, pad2, resolveEvent } from './time'
import type { EventSpec, WallTime } from './types'

/** Raw values from the create form (HTML date/time input formats). */
export interface FormState {
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  start: string
  hasEnd: boolean
  endDate: string
  end: string
  zone: string
  extraZones: string[]
}

export type FormResult =
  | { ok: true; spec: EventSpec; endNextDay: boolean; notes: string[] }
  | { ok: false; error: string }

function parseWall(date: string, time: string): WallTime | undefined {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const tm = /^(\d{2}):(\d{2})/.exec(time)
  if (!dm || !tm) return undefined
  const wt = { year: +dm[1], month: +dm[2], day: +dm[3], hour: +tm[1], minute: +tm[2] }
  if (wt.hour > 23 || wt.minute > 59 || !DateTime.utc(wt.year, wt.month, wt.day).isValid) return undefined
  return wt
}

export function formToSpec(f: FormState): FormResult {
  const zone = f.zone.trim()
  if (!isValidZone(zone)) return { ok: false, error: 'Pick a valid time zone for the event.' }
  const start = parseWall(f.date, f.start)
  if (!start) return { ok: false, error: 'Enter a valid start date and time.' }

  let end: WallTime | undefined
  let endNextDay = false
  if (f.hasEnd) {
    end = parseWall(f.endDate || f.date, f.end)
    if (!end) return { ok: false, error: 'Enter a valid end time.' }
    // Same-day end at or before the start means "the next day", e.g. 22:00-01:00.
    if (f.endDate === f.date && compareWallTime(end, start) <= 0) {
      end = addDays(end, 1)
      endNextDay = true
    }
    if (compareWallTime(end, start) <= 0) return { ok: false, error: 'The end must be after the start.' }
  }

  const extraZones = Array.from(new Set(f.extraZones.map((z) => z.trim()))).filter(
    (z) => z !== zone && isValidZone(z),
  )
  const title = f.title.trim() || undefined
  const spec: EventSpec = { start, end, zone, extraZones, title }
  const resolved = resolveEvent(spec)
  if (!resolved.ok) return { ok: false, error: resolved.error }
  return { ok: true, spec, endNextDay, notes: resolved.event.notes }
}

export function specToForm(spec: EventSpec): FormState {
  const d = (wt: WallTime) => `${wt.year}-${pad2(wt.month)}-${pad2(wt.day)}`
  const t = (wt: WallTime) => `${pad2(wt.hour)}:${pad2(wt.minute)}`
  return {
    title: spec.title ?? '',
    date: d(spec.start),
    start: t(spec.start),
    hasEnd: !!spec.end,
    endDate: d(spec.end ?? spec.start),
    end: spec.end ? t(spec.end) : t({ ...spec.start, hour: (spec.start.hour + 1) % 24 }),
    zone: spec.zone,
    extraZones: [...spec.extraZones],
  }
}

/** Defaults: next whole hour in the viewer's zone, one hour long. */
export function defaultForm(zone: string, nowMs = Date.now()): FormState {
  const start = DateTime.fromMillis(nowMs, { zone }).plus({ hours: 1 }).startOf('hour')
  const end = start.plus({ hours: 1 })
  return {
    title: '',
    date: start.toFormat('yyyy-LL-dd'),
    start: start.toFormat('HH:mm'),
    hasEnd: false,
    endDate: start.toFormat('yyyy-LL-dd'),
    end: end.toFormat('HH:mm'),
    zone,
    extraZones: [],
  }
}

/** Move the end date along with the start date so the gap between them is preserved. */
export function shiftEndDate(f: FormState, newDate: string): string {
  const a = DateTime.fromISO(f.date, { zone: 'utc' })
  const b = DateTime.fromISO(newDate, { zone: 'utc' })
  const e = DateTime.fromISO(f.endDate, { zone: 'utc' })
  if (!a.isValid || !b.isValid || !e.isValid) return newDate
  return e.plus(b.diff(a, 'days')).toFormat('yyyy-LL-dd')
}
