import { describe, expect, it } from 'vitest'
import type { EventSpec } from './types'
import { parseEventHash, serializeEvent, shareUrl } from './url'

const wt = (s: string) => {
  const [d, t] = s.split(' ')
  const [year, month, day] = d.split('-').map(Number)
  const [hour, minute] = t.split(':').map(Number)
  return { year, month, day, hour, minute }
}

function parseOk(hash: string) {
  const r = parseEventHash(hash)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r
}

describe('parseEventHash', () => {
  it('parses the reference start-only format', () => {
    const { event } = parseOk('#/2026-10-26_17.30_America.Denver')
    expect(event).toEqual({
      start: wt('2026-10-26 17:30'),
      end: undefined,
      zone: 'America/Denver',
      extraZones: [],
      title: undefined,
    })
  })

  it('accepts the path with or without "#" and "/"', () => {
    for (const h of ['#/2026-10-26_17.30_UTC', '/2026-10-26_17.30_UTC', '2026-10-26_17.30_UTC']) {
      expect(parseOk(h).event.zone).toBe('UTC')
    }
  })

  it('parses a same-day end time', () => {
    const { event } = parseOk('#/2026-10-26_17.30-19.00_America.Denver')
    expect(event.end).toEqual(wt('2026-10-26 19:00'))
  })

  it('rolls a short end time that is not after the start to the next day', () => {
    expect(parseOk('#/2026-10-26_22.00-01.30_UTC').event.end).toEqual(wt('2026-10-27 01:30'))
    expect(parseOk('#/2026-12-31_23.00-23.00_UTC').event.end).toEqual(wt('2027-01-01 23:00'))
  })

  it('parses an explicit end date', () => {
    const { event } = parseOk('#/2026-10-26_09.00-2026-10-28_17.00_Europe.London')
    expect(event.end).toEqual(wt('2026-10-28 17:00'))
  })

  it('parses extra zones, dropping duplicates, the source zone and unknown zones', () => {
    const r = parseOk('#/2026-10-26_17.30_America.Denver,Europe.London,America.Denver,Asia.Tokyo,Europe.London,Mars.Base')
    expect(r.event.extraZones).toEqual(['Europe/London', 'Asia/Tokyo'])
    expect(r.warnings).toEqual(['Ignored unknown time zone "Mars/Base".'])
  })

  it('handles zones with hyphens, plus signs and multiple segments', () => {
    const r = parseOk('#/2026-10-26_08.00-09.00_America.Port-au-Prince,Etc.GMT+5,America.Argentina.Buenos_Aires')
    expect(r.event.zone).toBe('America/Port-au-Prince')
    expect(r.event.extraZones).toEqual(['Etc/GMT+5', 'America/Argentina/Buenos_Aires'])
    expect(r.event.end).toEqual(wt('2026-10-26 09:00'))
  })

  it('accepts percent-encoded paths', () => {
    expect(parseOk('#/2026-10-26_17.30_Etc.GMT%2B5').event.zone).toBe('Etc/GMT+5')
  })

  it('parses the title from the query string', () => {
    expect(parseOk('#/2026-10-26_17.30_UTC?t=Team%20sync%20%26%20demo').event.title).toBe('Team sync & demo')
    expect(parseOk('#/2026-10-26_17.30_UTC?t=Plus+spaces').event.title).toBe('Plus spaces')
    expect(parseOk('#/2026-10-26_17.30_UTC?t=%20%20').event.title).toBeUndefined()
  })

  it.each([
    ['', 'should look like'],
    ['#/', 'should look like'],
    ['#/2026-10-26_17:30_UTC', 'should look like'],
    ['#/2026-02-30_10.00_UTC', 'start date or time is not valid'],
    ['#/2026-10-26_24.00_UTC', 'start date or time is not valid'],
    ['#/2026-10-26_10.60_UTC', 'start date or time is not valid'],
    ['#/2026-10-26_10.00-25.00_UTC', 'end time is not valid'],
    ['#/2026-10-26_10.00-2026-10-25_12.00_UTC', 'ends before it starts'],
    ['#/2026-10-26_10.00-2026-10-26_10.00_UTC', 'ends before it starts'],
    ['#/2026-10-26_10.00_Not.AZone', 'Unknown time zone'],
    ['#/2026-10-26_10.00_%E0%A4%A', 'not correctly encoded'],
  ])('rejects %j', (hash, message) => {
    const r = parseEventHash(hash)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(message)
  })
})

describe('serializeEvent', () => {
  const base: EventSpec = { start: wt('2026-10-26 17:30'), zone: 'America/Denver', extraZones: [] }

  it('matches the reference format for start-only events', () => {
    expect(serializeEvent(base)).toBe('/2026-10-26_17.30_America.Denver')
  })

  it('uses the short end form when possible', () => {
    expect(serializeEvent({ ...base, end: wt('2026-10-26 19:00') })).toBe('/2026-10-26_17.30-19.00_America.Denver')
    expect(serializeEvent({ ...base, end: wt('2026-10-27 01:00') })).toBe('/2026-10-26_17.30-01.00_America.Denver')
    expect(serializeEvent({ ...base, end: wt('2026-10-27 17:30') })).toBe('/2026-10-26_17.30-17.30_America.Denver')
  })

  it('uses the long end form otherwise', () => {
    expect(serializeEvent({ ...base, end: wt('2026-10-27 18:00') })).toBe(
      '/2026-10-26_17.30-2026-10-27_18.00_America.Denver',
    )
  })

  it('includes extra zones (deduplicated) and the title', () => {
    expect(
      serializeEvent({
        ...base,
        extraZones: ['Europe/London', 'America/Denver', 'Asia/Kolkata', 'Europe/London'],
        title: '  Team sync & demo ',
      }),
    ).toBe('/2026-10-26_17.30_America.Denver,Europe.London,Asia.Kolkata?t=Team%20sync%20%26%20demo')
  })

  it('builds absolute share links', () => {
    expect(shareUrl(base, 'https://example.com/when/')).toBe('https://example.com/when/#/2026-10-26_17.30_America.Denver')
  })

  it.each<EventSpec>([
    base,
    { ...base, end: wt('2026-10-26 19:00') },
    { ...base, end: wt('2026-10-27 01:00') },
    { ...base, end: wt('2026-10-27 17:30') },
    { ...base, end: wt('2026-11-02 09:15') },
    { ...base, start: wt('2026-12-31 23:45'), end: wt('2027-01-01 00:15'), zone: 'Pacific/Kiritimati' },
    { ...base, zone: 'America/Port-au-Prince', extraZones: ['Etc/GMT-14', 'Asia/Kathmandu'], title: 'Café ☕ / 50% off?' },
  ])('round-trips %#', (spec) => {
    const parsed = parseOk(`#${serializeEvent(spec)}`)
    expect(parsed.event).toEqual({ end: undefined, title: undefined, ...spec })
  })
})
