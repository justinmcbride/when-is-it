import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { buildRow, buildTimeline, computeWindow, hourKind, position } from './timeline'

const HOUR = 3_600_000
const ms = (isoStr: string, zone = 'UTC') => DateTime.fromISO(isoStr, { zone }).toMillis()

describe('hourKind', () => {
  it('classifies hours', () => {
    expect([0, 6, 7, 8, 9, 16, 17, 21, 22, 23].map(hourKind)).toEqual([
      'night', 'night', 'off', 'off', 'work', 'work', 'off', 'off', 'night', 'night',
    ])
  })
})

describe('computeWindow', () => {
  it('centres a short event in a 24h window aligned to the hour', () => {
    const start = ms('2026-10-26T17:30')
    const w = computeWindow(start, start + 90 * 60_000)
    expect(w.endMs - w.startMs).toBe(25 * HOUR) // 24h expanded to hour boundaries
    expect(w.startMs % HOUR).toBe(0)
    expect(w.startMs).toBeLessThan(start)
    expect(w.endMs).toBeGreaterThan(start + 90 * 60_000)
  })

  it('pads long events', () => {
    const start = ms('2026-10-26T09:00')
    const w = computeWindow(start, start + 48 * HOUR)
    expect(w).toEqual({ startMs: start - 2 * HOUR, endMs: start + 50 * HOUR })
  })
})

describe('buildRow', () => {
  it('covers the window with contiguous segments in local time', () => {
    const win = { startMs: ms('2026-10-26T00:00'), endMs: ms('2026-10-27T00:00') }
    const row = buildRow('America/Denver', 'Denver', win, 3)
    expect(row.segments[0].startMs).toBe(win.startMs)
    expect(row.segments.at(-1)!.endMs).toBe(win.endMs)
    for (let i = 1; i < row.segments.length; i++) {
      expect(row.segments[i].startMs).toBe(row.segments[i - 1].endMs)
      expect(row.segments[i].kind).not.toBe(row.segments[i - 1].kind)
    }
    // UTC midnight is 18:00 MDT on the previous day; the only local midnight is 06:00 UTC.
    expect(row.days).toEqual([ms('2026-10-26T06:00')])
    const work = row.segments.find((s) => s.kind === 'work')!
    expect(DateTime.fromMillis(work.startMs, { zone: 'America/Denver' }).hour).toBe(9)
    expect(work.endMs - work.startMs).toBe(8 * HOUR)
  })

  it('splits segments at local half-hour boundaries', () => {
    const win = { startMs: ms('2026-10-26T00:00'), endMs: ms('2026-10-27T00:00') }
    const row = buildRow('Asia/Kolkata', 'Kolkata', win, 3)
    const work = row.segments.find((s) => s.kind === 'work')!
    expect(DateTime.fromMillis(work.startMs, { zone: 'UTC' }).toFormat('HH:mm')).toBe('03:30')
    expect(row.ticks.every((t) => t.hour % 3 === 0)).toBe(true)
    expect(DateTime.fromMillis(row.ticks[0].ms, { zone: 'UTC' }).minute).toBe(30)
  })

  it('handles DST transitions inside the window (23h and 25h days)', () => {
    const spring = buildRow('America/Denver', 'Denver', { startMs: ms('2026-03-08T00:00', 'America/Denver'), endMs: ms('2026-03-09T00:00', 'America/Denver') }, 1)
    expect(spring.ticks.map((t) => t.hour)).not.toContain(2)
    expect(spring.ticks).toHaveLength(23)

    const fall = buildRow('America/Denver', 'Denver', { startMs: ms('2026-11-01T00:00', 'America/Denver'), endMs: ms('2026-11-02T00:00', 'America/Denver') }, 1)
    expect(fall.ticks).toHaveLength(25)
    expect(fall.ticks.filter((t) => t.hour === 1)).toHaveLength(2)
    const total = fall.segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0)
    expect(total).toBe(25 * HOUR)
  })
})

describe('buildTimeline', () => {
  it('builds one row per zone on a shared window', () => {
    const start = ms('2026-10-26T17:30', 'America/Denver')
    const t = buildTimeline({
      zones: [
        { zone: 'America/Denver', label: 'Event' },
        { zone: 'Europe/London', label: 'London' },
      ],
      startMs: start,
      endMs: start + HOUR,
    })
    expect(t.rows.map((r) => r.zone)).toEqual(['America/Denver', 'Europe/London'])
    for (const r of t.rows) {
      expect(r.segments[0].startMs).toBe(t.windowStartMs)
      expect(r.segments.at(-1)!.endMs).toBe(t.windowEndMs)
    }
    expect(t).not.toHaveProperty('workOverlap')
    expect(position(t, t.windowStartMs)).toBe(0)
    expect(position(t, t.windowEndMs)).toBe(1)
    const p = position(t, start)
    expect(p).toBeGreaterThan(0.4)
    expect(p).toBeLessThan(0.6)
  })
})
