import { describe, expect, it } from 'vitest'
import { zoneRows } from './zoneRows'

const spec = {
  start: { year: 2026, month: 10, day: 26, hour: 17, minute: 30 },
  zone: 'America/Denver',
  extraZones: ['Europe/London', 'Asia/Tokyo'],
}

describe('zoneRows', () => {
  it('orders source, viewer, extras', () => {
    expect(zoneRows(spec, 'Asia/Kolkata')).toEqual([
      { zone: 'America/Denver', tags: ['event'] },
      { zone: 'Asia/Kolkata', tags: ['you'] },
      { zone: 'Europe/London', tags: ['included'] },
      { zone: 'Asia/Tokyo', tags: ['included'] },
    ])
  })

  it('merges the viewer into an existing row', () => {
    expect(zoneRows(spec, 'America/Denver')[0]).toEqual({ zone: 'America/Denver', tags: ['event', 'you'] })
    expect(zoneRows(spec, 'Asia/Tokyo')).toHaveLength(3)
    expect(zoneRows(spec, 'Asia/Tokyo')[1]).toEqual({ zone: 'Asia/Tokyo', tags: ['you', 'included'] })
  })
})
