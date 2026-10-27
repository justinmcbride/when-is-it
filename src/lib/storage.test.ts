import { describe, expect, it } from 'vitest'
import { loadSavedZones, MAX_SAVED_ZONES, saveZones, ZONES_KEY } from './storage'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const throwing = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

describe('saved zones', () => {
  it('round-trips zones', () => {
    const s = memoryStorage()
    saveZones(['Europe/London', 'Asia/Kolkata'], s)
    expect(JSON.parse(s.data.get(ZONES_KEY)!)).toEqual({ v: 1, zones: ['Europe/London', 'Asia/Kolkata'] })
    expect(loadSavedZones(s)).toEqual(['Europe/London', 'Asia/Kolkata'])
  })

  it('removes the key when nothing is selected', () => {
    const s = memoryStorage({ [ZONES_KEY]: '{"v":1,"zones":["UTC"]}' })
    saveZones([], s)
    expect(s.data.has(ZONES_KEY)).toBe(false)
  })

  it.each([
    ['missing', undefined],
    ['not JSON', '{nope'],
    ['null', 'null'],
    ['wrong shape', '{"zones":"Europe/London"}'],
    ['a bare array', '["Europe/London"]'],
  ])('returns no zones for %s data', (_, raw) => {
    expect(loadSavedZones(memoryStorage(raw === undefined ? {} : { [ZONES_KEY]: raw }))).toEqual([])
  })

  it('drops invalid, duplicate and excess entries', () => {
    const many = ['Nope/Zone', 42, 'Europe/London', 'Europe/London', ...Array(20).fill('UTC'), 'Asia/Tokyo']
    const s = memoryStorage({ [ZONES_KEY]: JSON.stringify({ v: 1, zones: many }) })
    expect(loadSavedZones(s)).toEqual(['Europe/London', 'UTC', 'Asia/Tokyo'])
    const lots = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Seoul', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'Pacific/Auckland']
    saveZones(lots, s)
    expect(loadSavedZones(s)).toHaveLength(MAX_SAVED_ZONES)
  })

  it('survives unavailable storage', () => {
    expect(loadSavedZones(throwing)).toEqual([])
    expect(() => saveZones(['UTC'], throwing)).not.toThrow()
    expect(loadSavedZones(undefined)).toEqual([])
  })
})
