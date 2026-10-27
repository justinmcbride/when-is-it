import { describe, expect, it } from 'vitest'
import { isValidZone, listZones } from './time'
import { normalize, searchZones, SUGGESTED_ZONES, ZONE_ALIASES, zoneLabel, zoneName } from './zoneNames'

describe('zoneName / zoneLabel', () => {
  it('uses generic Intl names', () => {
    expect(zoneName('America/Denver')).toBe('Mountain Time')
    expect(zoneName('Europe/Berlin')).toBe('Central European Time')
    expect(zoneName('UTC')).toBe('Coordinated Universal Time')
  })

  it('has no name for raw offsets', () => {
    expect(zoneName('Etc/GMT+5')).toBeUndefined()
    expect(zoneLabel('Etc/GMT+5')).toBe('GMT+5')
  })

  it('combines city and name', () => {
    expect(zoneLabel('America/Los_Angeles')).toBe('Los Angeles · Pacific Time')
  })
})

describe('searchZones', () => {
  const top = (q: string) => searchZones(q)[0]

  it.each([
    ['denver', 'America/Denver'],
    ['America/Denver', 'America/Denver'],
    ['new york', 'America/New_York'],
    ['sao paulo', 'America/Sao_Paulo'],
    ['Mountain Time', 'America/Denver'],
    ['pacific', 'America/Los_Angeles'],
    ['eastern', 'America/New_York'],
    ['central european', 'Europe/Berlin'],
    ['india', 'Asia/Kolkata'],
    ['germany', 'Europe/Berlin'],
    ['MST', 'America/Denver'],
    ['pst', 'America/Los_Angeles'],
    ['CET', 'Europe/Paris'],
    ['JST', 'Asia/Tokyo'],
    ['utc', 'UTC'],
    ['calcutta', 'Asia/Kolkata'],
  ])('%s -> %s', (q, zone) => {
    expect(top(q)).toBe(zone)
  })

  it('lists every zone sharing a name', () => {
    const r = searchZones('mountain time', 50)
    expect(r).toEqual(expect.arrayContaining(['America/Denver', 'America/Boise', 'America/Edmonton']))
    expect(r).not.toContain('America/Los_Angeles')
  })

  it('expands abbreviations to every zone with the same name, aliases first', () => {
    const r = searchZones('CET', 50)
    expect(r.slice(0, 2)).toEqual(['Europe/Paris', 'Europe/Berlin'])
    expect(r).toEqual(expect.arrayContaining(['Europe/Madrid', 'Europe/Rome']))
    expect(r).not.toContain('Europe/London')
  })

  it('returns nothing for empty or unmatched queries', () => {
    expect(searchZones('  ')).toEqual([])
    expect(searchZones('qqqzzz')).toEqual([])
  })

  it('respects the limit', () => {
    expect(searchZones('america', 3)).toHaveLength(3)
  })

  it('only refers to real zones', () => {
    for (const z of [...SUGGESTED_ZONES, ...Object.values(ZONE_ALIASES).flat()]) expect(isValidZone(z), z).toBe(true)
    expect(listZones()).toContain('Asia/Kolkata')
    expect(listZones()).not.toContain('Asia/Calcutta')
  })

  it('normalizes accents and separators', () => {
    expect(normalize('América/São_Paulo')).toBe('america sao paulo')
  })
})
