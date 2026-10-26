import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { formatHour, formatHourOfDay, formatTime, formatTimeRange, prefersHour12 } from './format'

const dt = DateTime.fromObject({ year: 2026, month: 10, day: 26, hour: 17, minute: 30 }, { zone: 'America/Denver' })

describe('hour cycle', () => {
  it('detects 12h vs 24h locales', () => {
    expect(prefersHour12('en-US')).toBe(true)
    expect(prefersHour12('en-GB')).toBe(false)
    expect(prefersHour12('de-DE')).toBe(false)
    expect(prefersHour12('en-US-u-hc-h23')).toBe(false)
  })

  it('formats times per locale', () => {
    expect(formatTime(dt, 'en-US').replace(/\s/g, ' ')).toBe('5:30 PM')
    expect(formatTime(dt, 'en-GB')).toBe('17:30')
    expect(formatTimeRange(dt, dt.plus({ minutes: 90 }), 'en-GB')).toBe('17:30–19:00')
  })

  it('formats tick hours compactly', () => {
    expect(formatHour(dt, 'en-US').replace(/\s/g, ' ')).toBe('5 PM')
    expect(formatHour(dt, 'en-GB')).toBe('17')
    expect(formatHourOfDay(9, 'en-US').replace(/\s/g, ' ')).toBe('9 AM')
    expect(formatHourOfDay(9, 'de-DE')).toBe('09')
  })
})
