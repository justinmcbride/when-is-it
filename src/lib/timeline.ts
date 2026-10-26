import { DateTime } from 'luxon'

const HOUR = 3_600_000

export type HourKind = 'night' | 'off' | 'work'

/** Typical day shape: work 09-17, night 22-07, everything else is "off" (awake, not working). */
export const WORK_START = 9
export const WORK_END = 17
export const NIGHT_START = 22
export const NIGHT_END = 7

export function hourKind(hour: number): HourKind {
  if (hour < NIGHT_END || hour >= NIGHT_START) return 'night'
  if (hour >= WORK_START && hour < WORK_END) return 'work'
  return 'off'
}

export interface Interval {
  startMs: number
  endMs: number
}

export interface Segment extends Interval {
  kind: HourKind
}

export interface Tick {
  ms: number
  /** Local hour in the row's zone. */
  hour: number
  label: string
}

export interface DayMarker {
  ms: number
  label: string
}

export interface TimelineRow {
  zone: string
  label: string
  segments: Segment[]
  ticks: Tick[]
  /** Local midnights inside the window. */
  days: DayMarker[]
  /** Local date at the left edge of the window. */
  startDateLabel: string
}

export interface Timeline {
  windowStartMs: number
  windowEndMs: number
  tickStepHours: number
  rows: TimelineRow[]
  event: { startMs: number; endMs?: number }
  /** Intervals where every row is inside working hours. */
  workOverlap: Interval[]
  /** Intervals where no row is in night hours. */
  awakeOverlap: Interval[]
}

export interface TimelineInput {
  zones: { zone: string; label: string }[]
  startMs: number
  endMs?: number
  /** Minimum window length in hours (default 24). */
  minHours?: number
  /** Padding around the event in hours (default 2). */
  padHours?: number
}

export function computeWindow(startMs: number, endMs: number | undefined, minHours = 24, padHours = 2): Interval {
  let ws = startMs - padHours * HOUR
  let we = (endMs ?? startMs) + padHours * HOUR
  const span = we - ws
  if (span < minHours * HOUR) {
    const extra = (minHours * HOUR - span) / 2
    ws -= extra
    we += extra
  }
  return { startMs: Math.floor(ws / HOUR) * HOUR, endMs: Math.ceil(we / HOUR) * HOUR }
}

export function tickStepFor(hours: number): number {
  if (hours <= 30) return 3
  if (hours <= 60) return 6
  if (hours <= 168) return 12
  return 24
}

export function buildRow(zone: string, label: string, win: Interval, tickStep: number): TimelineRow {
  const segments: Segment[] = []
  const ticks: Tick[] = []
  const days: DayMarker[] = []
  let cur = DateTime.fromMillis(win.startMs, { zone }).startOf('hour')
  while (cur.toMillis() < win.endMs) {
    let next = cur.plus({ hours: 1 }).startOf('hour')
    if (next.toMillis() <= cur.toMillis()) next = cur.plus({ hours: 1 })
    const segStart = Math.max(cur.toMillis(), win.startMs)
    const segEnd = Math.min(next.toMillis(), win.endMs)
    if (segEnd > segStart) {
      const kind = hourKind(cur.hour)
      const prev = segments[segments.length - 1]
      if (prev && prev.kind === kind && prev.endMs === segStart) prev.endMs = segEnd
      else segments.push({ startMs: segStart, endMs: segEnd, kind })
    }
    if (cur.toMillis() >= win.startMs && cur.minute === 0) {
      if (cur.hour === 0) days.push({ ms: cur.toMillis(), label: cur.toFormat('ccc d LLL') })
      if (cur.hour % tickStep === 0) ticks.push({ ms: cur.toMillis(), hour: cur.hour, label: cur.toFormat('HH') })
    }
    cur = next
  }
  const startDateLabel = DateTime.fromMillis(win.startMs, { zone }).toFormat('ccc d LLL')
  return { zone, label, segments, ticks, days, startDateLabel }
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const s = Math.max(a[i].startMs, b[j].startMs)
    const e = Math.min(a[i].endMs, b[j].endMs)
    if (e > s) out.push({ startMs: s, endMs: e })
    if (a[i].endMs < b[j].endMs) i++
    else j++
  }
  return out
}

function mergeIntervals(list: Interval[]): Interval[] {
  const out: Interval[] = []
  for (const iv of list) {
    const prev = out[out.length - 1]
    if (prev && prev.endMs >= iv.startMs) prev.endMs = Math.max(prev.endMs, iv.endMs)
    else out.push({ ...iv })
  }
  return out
}

function rowIntervals(row: TimelineRow, pred: (k: HourKind) => boolean): Interval[] {
  return mergeIntervals(row.segments.filter((s) => pred(s.kind)).map(({ startMs, endMs }) => ({ startMs, endMs })))
}

export function buildTimeline(input: TimelineInput): Timeline {
  const win = computeWindow(input.startMs, input.endMs, input.minHours, input.padHours)
  const tickStepHours = tickStepFor((win.endMs - win.startMs) / HOUR)
  const rows = input.zones.map(({ zone, label }) => buildRow(zone, label, win, tickStepHours))
  const all: Interval[] = [win]
  const workOverlap = rows.reduce((acc, r) => intersect(acc, rowIntervals(r, (k) => k === 'work')), all)
  const awakeOverlap = rows.reduce((acc, r) => intersect(acc, rowIntervals(r, (k) => k !== 'night')), all)
  return {
    windowStartMs: win.startMs,
    windowEndMs: win.endMs,
    tickStepHours,
    rows,
    event: { startMs: input.startMs, endMs: input.endMs },
    workOverlap,
    awakeOverlap,
  }
}

/** Fractional position (0..1) of an instant within the timeline window; not clamped. */
export function position(t: Pick<Timeline, 'windowStartMs' | 'windowEndMs'>, ms: number): number {
  return (ms - t.windowStartMs) / (t.windowEndMs - t.windowStartMs)
}
