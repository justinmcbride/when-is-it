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
}

export interface TimelineRow {
  zone: string
  label: string
  segments: Segment[]
  ticks: Tick[]
  /** Local midnights inside the window (ms). */
  days: number[]
}

export interface Timeline {
  windowStartMs: number
  windowEndMs: number
  tickStepHours: number
  rows: TimelineRow[]
  event: { startMs: number; endMs?: number }
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
  const days: number[] = []
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
      if (cur.hour === 0) days.push(cur.toMillis())
      if (cur.hour % tickStep === 0) ticks.push({ ms: cur.toMillis(), hour: cur.hour })
    }
    cur = next
  }
  return { zone, label, segments, ticks, days }
}

export function buildTimeline(input: TimelineInput): Timeline {
  const win = computeWindow(input.startMs, input.endMs, input.minHours, input.padHours)
  const tickStepHours = tickStepFor((win.endMs - win.startMs) / HOUR)
  const rows = input.zones.map(({ zone, label }) => buildRow(zone, label, win, tickStepHours))
  return {
    windowStartMs: win.startMs,
    windowEndMs: win.endMs,
    tickStepHours,
    rows,
    event: { startMs: input.startMs, endMs: input.endMs },
  }
}

/** Fractional position (0..1) of an instant within the timeline window; not clamped. */
export function position(t: Pick<Timeline, 'windowStartMs' | 'windowEndMs'>, ms: number): number {
  return (ms - t.windowStartMs) / (t.windowEndMs - t.windowStartMs)
}
