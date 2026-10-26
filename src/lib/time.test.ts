import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import {
  calendarDayDiff,
  eventStatus,
  formatDuration,
  listZones,
  offsetLabel,
  resolveEvent,
  resolveWallTime,
  zoneCity,
} from './time'

const wt = (year: number, month: number, day: number, hour: number, minute = 0) => ({ year, month, day, hour, minute })
const iso = (dt: DateTime) => dt.toUTC().toISO({ suppressMilliseconds: true })

describe('resolveWallTime', () => {
  it('converts the reference example (Denver, MDT)', () => {
    const r = resolveWallTime(wt(2026, 10, 26, 17, 30), 'America/Denver')
    expect(iso(r.dt)).toBe('2026-10-26T23:30:00Z')
    expect(r).toMatchObject({ gap: false, ambiguous: false })
  })

  it('uses standard time after the fall-back transition', () => {
    expect(iso(resolveWallTime(wt(2026, 11, 2, 17, 30), 'America/Denver').dt)).toBe('2026-11-03T00:30:00Z')
  })

  it('detects a spring-forward gap and shifts forward', () => {
    const r = resolveWallTime(wt(2026, 3, 8, 2, 30), 'America/Denver')
    expect(r.gap).toBe(true)
    expect(r.dt.toFormat('HH:mm')).toBe('03:30')
    expect(iso(r.dt)).toBe('2026-03-08T09:30:00Z')
  })

  it('detects a fall-back overlap and picks the earlier instant', () => {
    const r = resolveWallTime(wt(2026, 11, 1, 1, 30), 'America/Denver')
    expect(r.ambiguous).toBe(true)
    expect(iso(r.dt)).toBe('2026-11-01T07:30:00Z')

    const london = resolveWallTime(wt(2026, 10, 25, 1, 30), 'Europe/London')
    expect(london.ambiguous).toBe(true)
    expect(iso(london.dt)).toBe('2026-10-25T00:30:00Z')
  })

  it('handles the European gap', () => {
    const r = resolveWallTime(wt(2026, 3, 29, 1, 15), 'Europe/London')
    expect(r.gap).toBe(true)
    expect(r.dt.toFormat('HH:mm')).toBe('02:15')
  })

  it('handles half-hour and 45-minute offsets', () => {
    expect(iso(resolveWallTime(wt(2026, 10, 26, 9, 0), 'Asia/Kolkata').dt)).toBe('2026-10-26T03:30:00Z')
    expect(iso(resolveWallTime(wt(2026, 10, 26, 9, 0), 'Asia/Kathmandu').dt)).toBe('2026-10-26T03:15:00Z')
  })
})

describe('resolveEvent', () => {
  it('resolves an event crossing midnight and into another zone', () => {
    const r = resolveEvent({
      start: wt(2026, 10, 26, 22, 0),
      end: wt(2026, 10, 27, 1, 0),
      zone: 'America/Denver',
      extraZones: [],
    })
    if (!r.ok) throw new Error(r.error)
    expect(iso(r.event.start)).toBe('2026-10-27T04:00:00Z')
    expect(iso(r.event.end!)).toBe('2026-10-27T07:00:00Z')
    const tokyo = r.event.start.setZone('Asia/Tokyo')
    expect(tokyo.toFormat('yyyy-LL-dd HH:mm')).toBe('2026-10-27 13:00')
    expect(r.event.notes).toEqual([])
  })

  it('computes the true duration across a DST change', () => {
    const r = resolveEvent({
      start: wt(2026, 11, 1, 0, 0),
      end: wt(2026, 11, 1, 3, 0),
      zone: 'America/Denver',
      extraZones: [],
    })
    if (!r.ok) throw new Error(r.error)
    expect(r.event.end!.diff(r.event.start, 'hours').hours).toBe(4)
  })

  it('adds notes for gaps and overlaps', () => {
    const r = resolveEvent({ start: wt(2026, 3, 8, 2, 30), end: wt(2026, 11, 1, 1, 30), zone: 'America/Denver', extraZones: [] })
    if (!r.ok) throw new Error(r.error)
    expect(r.event.notes).toHaveLength(2)
    expect(r.event.notes[0]).toContain('Clocks in America/Denver jump forward')
    expect(r.event.notes[0]).toContain('never happens')
    expect(r.event.notes[1]).toContain('fall back')
    expect(r.event.notes[1]).toContain('happens twice')
  })

  it('only flags the real transition hours (one gap, one repeat per year in Denver)', () => {
    const gaps: string[] = []
    const repeats: string[] = []
    let d = DateTime.fromObject({ year: 2026, month: 1, day: 1 }, { zone: 'utc' })
    while (d.year === 2026) {
      const r = resolveWallTime(wt(d.year, d.month, d.day, d.hour, 30), 'America/Denver')
      if (r.gap) gaps.push(d.toFormat('yyyy-LL-dd HH'))
      if (r.ambiguous) repeats.push(d.toFormat('yyyy-LL-dd HH'))
      d = d.plus({ hours: 1 })
    }
    expect(gaps).toEqual(['2026-03-08 02'])
    expect(repeats).toEqual(['2026-11-01 01'])
  })

  it('adds no notes on an ordinary date in any zone', () => {
    for (const zone of listZones()) {
      for (const hour of [0, 2, 9, 17, 23]) {
        const r = resolveEvent({ start: wt(2026, 10, 26, hour, 30), zone, extraZones: [] })
        if (!r.ok) throw new Error(`${zone}: ${r.error}`)
        expect(r.event.notes, zone).toEqual([])
      }
    }
  })

  it('rejects an end that is not after the start once resolved', () => {
    // 01:30 (first, MDT) -> 01:15 is ambiguous; picking the earlier instant puts it before the start.
    const r = resolveEvent({ start: wt(2026, 11, 1, 1, 30), end: wt(2026, 11, 1, 1, 15), zone: 'America/Denver', extraZones: [] })
    expect(r).toEqual({ ok: false, error: 'The event ends before it starts.' })
  })

  it('rejects unknown zones', () => {
    expect(resolveEvent({ start: wt(2026, 1, 1, 0), zone: 'Nope/Zone', extraZones: [] }).ok).toBe(false)
  })
})

describe('helpers', () => {
  it('formats offsets', () => {
    expect(offsetLabel(DateTime.fromISO('2026-10-26T12:00', { zone: 'America/Denver' }))).toBe('UTC-06:00')
    expect(offsetLabel(DateTime.fromISO('2026-10-26T12:00', { zone: 'Asia/Kathmandu' }))).toBe('UTC+05:45')
    expect(offsetLabel(DateTime.fromISO('2026-10-26T12:00', { zone: 'UTC' }))).toBe('UTC+00:00')
  })

  it('computes calendar day differences between zones', () => {
    const start = DateTime.fromISO('2026-10-26T22:00', { zone: 'America/Denver' })
    expect(calendarDayDiff(start.setZone('Asia/Tokyo'), start)).toBe(1)
    expect(calendarDayDiff(start.setZone('America/Los_Angeles'), start)).toBe(0)
    const early = DateTime.fromISO('2026-10-26T01:00', { zone: 'Europe/London' })
    expect(calendarDayDiff(early.setZone('America/Denver'), early)).toBe(-1)
  })

  it('names zones by city', () => {
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
    expect(zoneCity('UTC')).toBe('UTC')
  })

  it('formats durations', () => {
    expect(formatDuration(42_000)).toBe('42s')
    expect(formatDuration(65_000)).toBe('1m 05s')
    expect(formatDuration(3_600_000 + 5 * 60_000 + 9_000)).toBe('1h 05m 09s')
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000)).toBe('2d 4h 12m')
    expect(formatDuration(-5)).toBe('0s')
  })

  it('reports event status', () => {
    expect(eventStatus(0, 60_000).kind).toBe('upcoming')
    expect(eventStatus(0, 60_000).text).toBe('Starts in 1m 00s')
    expect(eventStatus(90_000, 60_000, 120_000)).toEqual({ kind: 'live', text: 'Happening now — ends in 30s' })
    expect(eventStatus(180_000, 60_000, 120_000)).toEqual({ kind: 'ended', text: 'Ended 1m 00s ago' })
    expect(eventStatus(180_000, 60_000).text).toBe('Started 2m 00s ago')
  })
})
