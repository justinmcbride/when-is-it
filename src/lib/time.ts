import { DateTime, IANAZone } from 'luxon'
import { formatShortDate, formatTime } from './format'
import type { EventSpec, WallTime } from './types'

export function isValidZone(zone: string): boolean {
  return IANAZone.isValidZone(zone)
}

/** The viewer's time zone as reported by the browser, falling back to UTC. */
export function detectViewerZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (zone && isValidZone(zone)) return zone
  } catch {
    // ignore and fall through
  }
  return 'UTC'
}

let cachedZones: string[] | undefined

/** All IANA zones the runtime knows about, sorted, always including UTC. */
export function listZones(): string[] {
  if (!cachedZones) {
    let zones: string[] = []
    try {
      zones = Intl.supportedValuesOf('timeZone')
    } catch {
      zones = []
    }
    cachedZones = Array.from(new Set([...zones, 'UTC'])).sort()
  }
  return cachedZones
}

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires" */
export function zoneCity(zone: string): string {
  const last = zone.split('/').pop() ?? zone
  return last.replaceAll('_', ' ')
}

export interface ResolvedWallTime {
  dt: DateTime
  /** The wall time does not exist in the zone (spring-forward gap); it was shifted forward. */
  gap: boolean
  /** The wall time occurs twice (fall-back overlap); the earlier instant was chosen. */
  ambiguous: boolean
}

/** Interpret a wall time in a zone, detecting DST gaps and overlaps. */
export function resolveWallTime(wt: WallTime, zone: string): ResolvedWallTime {
  let dt = DateTime.fromObject(
    { year: wt.year, month: wt.month, day: wt.day, hour: wt.hour, minute: wt.minute },
    { zone },
  )
  const gap =
    dt.year !== wt.year ||
    dt.month !== wt.month ||
    dt.day !== wt.day ||
    dt.hour !== wt.hour ||
    dt.minute !== wt.minute
  let ambiguous = false
  if (!gap && dt.isValid) {
    // Luxon doesn't consistently choose between the two instants, so always take the earlier one.
    const options = dt.getPossibleOffsets()
    ambiguous = options.length > 1
    if (ambiguous) dt = options.reduce((a, b) => (b.toMillis() < a.toMillis() ? b : a))
  }
  return { dt, gap, ambiguous }
}

export interface ResolvedEvent {
  start: DateTime
  end?: DateTime
  /** Human-readable notes about DST adjustments. */
  notes: string[]
}

export type ResolveResult = { ok: true; event: ResolvedEvent } | { ok: false; error: string }

/** Turn an EventSpec into concrete instants. */
export function resolveEvent(spec: EventSpec): ResolveResult {
  if (!isValidZone(spec.zone)) return { ok: false, error: `Unknown time zone "${spec.zone}".` }
  const notes: string[] = []
  const start = resolveWallTime(spec.start, spec.zone)
  if (!start.dt.isValid) return { ok: false, error: 'The start date is not valid.' }
  noteDst('start', spec.start, start, spec.zone, notes)

  let end: ResolvedWallTime | undefined
  if (spec.end) {
    end = resolveWallTime(spec.end, spec.zone)
    if (!end.dt.isValid) return { ok: false, error: 'The end date is not valid.' }
    noteDst('end', spec.end, end, spec.zone, notes)
    if (end.dt.toMillis() <= start.dt.toMillis()) {
      return { ok: false, error: 'The event ends before it starts.' }
    }
  }
  return { ok: true, event: { start: start.dt, end: end?.dt, notes } }
}

function noteDst(which: string, wt: WallTime, r: ResolvedWallTime, zone: string, notes: string[]) {
  if (!r.gap && !r.ambiguous) return
  const asWritten = DateTime.fromObject({ ...wt }, { zone: 'utc' })
  const wall = formatTime(asWritten)
  const day = formatShortDate(asWritten)
  if (r.gap) {
    notes.push(
      `Clocks in ${zone} jump forward on ${day}, so ${wall} never happens that day. The ${which} time is shown as ${formatTime(r.dt)} instead.`,
    )
  } else {
    notes.push(
      `Clocks in ${zone} fall back on ${day}, so ${wall} happens twice that day. The ${which} time uses the first one (${offsetLabel(r.dt)}).`,
    )
  }
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** "UTC-06:00", "UTC+05:30", "UTC+00:00" */
export function offsetLabel(dt: DateTime): string {
  return `UTC${dt.toFormat('ZZ')}`
}

/** Whole calendar days between the local dates of a and b (a - b), ignoring time of day. */
export function calendarDayDiff(a: DateTime, b: DateTime): number {
  const da = DateTime.utc(a.year, a.month, a.day)
  const db = DateTime.utc(b.year, b.month, b.day)
  return Math.round(da.diff(db, 'days').days)
}

export function wallTimeOf(dt: DateTime): WallTime {
  return { year: dt.year, month: dt.month, day: dt.day, hour: dt.hour, minute: dt.minute }
}

/** Compare wall times chronologically: negative if a < b. */
export function compareWallTime(a: WallTime, b: WallTime): number {
  return (
    a.year - b.year || a.month - b.month || a.day - b.day || a.hour - b.hour || a.minute - b.minute
  )
}

export function addDays(wt: WallTime, days: number): WallTime {
  const d = DateTime.utc(wt.year, wt.month, wt.day).plus({ days })
  return { ...wt, year: d.year, month: d.month, day: d.day }
}

export function sameDate(a: WallTime, b: WallTime): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** "2d 4h 12m", "1h 05m 09s", "42s" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}d ${h}h ${pad2(m)}m`
  if (h > 0) return `${h}h ${pad2(m)}m ${pad2(s)}s`
  if (m > 0) return `${m}m ${pad2(s)}s`
  return `${s}s`
}

export type EventStatus =
  | { kind: 'upcoming'; text: string }
  | { kind: 'live'; text: string }
  | { kind: 'ended'; text: string }

export function eventStatus(nowMs: number, startMs: number, endMs?: number): EventStatus {
  if (nowMs < startMs) return { kind: 'upcoming', text: `Starts in ${formatDuration(startMs - nowMs)}` }
  if (endMs === undefined) {
    return { kind: 'ended', text: `Started ${formatDuration(nowMs - startMs)} ago` }
  }
  if (nowMs < endMs) {
    return { kind: 'live', text: `Happening now — ends in ${formatDuration(endMs - nowMs)}` }
  }
  return { kind: 'ended', text: `Ended ${formatDuration(nowMs - endMs)} ago` }
}
