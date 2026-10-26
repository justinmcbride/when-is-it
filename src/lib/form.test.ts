import { describe, expect, it } from 'vitest'
import { defaultForm, formToSpec, shiftEndDate, specToForm, type FormState } from './form'
import { serializeEvent } from './url'

const base: FormState = {
  title: ' Standup ',
  date: '2026-10-26',
  start: '17:30',
  hasEnd: true,
  endDate: '2026-10-26',
  end: '19:00',
  zone: 'America/Denver',
  extraZones: ['Europe/London', 'America/Denver', 'Bogus/Zone', 'Europe/London'],
}

describe('formToSpec', () => {
  it('builds a spec and a URL', () => {
    const r = formToSpec(base)
    if (!r.ok) throw new Error(r.error)
    expect(r.endNextDay).toBe(false)
    expect(serializeEvent(r.spec)).toBe('/2026-10-26_17.30-19.00_America.Denver,Europe.London?t=Standup')
  })

  it('rolls a same-day end before the start to the next day', () => {
    const r = formToSpec({ ...base, start: '22:00', end: '01:00' })
    if (!r.ok) throw new Error(r.error)
    expect(r.endNextDay).toBe(true)
    expect(r.spec.end).toMatchObject({ day: 27, hour: 1 })
  })

  it('omits the end when disabled', () => {
    const r = formToSpec({ ...base, hasEnd: false })
    expect(r.ok && r.spec.end).toBeUndefined()
  })

  it('validates inputs', () => {
    expect(formToSpec({ ...base, zone: 'Nope' })).toMatchObject({ ok: false })
    expect(formToSpec({ ...base, date: '' })).toMatchObject({ ok: false })
    expect(formToSpec({ ...base, endDate: '2026-10-25' })).toMatchObject({ ok: false })
  })

  it('reports DST notes', () => {
    const r = formToSpec({ ...base, date: '2026-03-08', endDate: '2026-03-08', start: '02:30', end: '04:00' })
    expect(r.ok && r.notes[0]).toContain("doesn't exist")
  })

  it('round-trips through specToForm', () => {
    const r = formToSpec({ ...base, endDate: '2026-10-28', end: '09:00' })
    if (!r.ok) throw new Error(r.error)
    const again = formToSpec(specToForm(r.spec))
    expect(again.ok && again.spec).toEqual(r.spec)
  })
})

describe('defaultForm', () => {
  it('starts at the next whole hour in the given zone', () => {
    const f = defaultForm('Asia/Kolkata', Date.UTC(2026, 9, 26, 18, 40))
    // 18:40 UTC = 00:10 IST on the 27th -> next hour 01:00.
    expect(f).toMatchObject({ date: '2026-10-27', start: '01:00', end: '02:00', zone: 'Asia/Kolkata' })
  })
})

describe('shiftEndDate', () => {
  it('keeps the gap between start and end dates', () => {
    expect(shiftEndDate({ ...base, endDate: '2026-10-28' }, '2026-10-30')).toBe('2026-11-01')
  })
})
