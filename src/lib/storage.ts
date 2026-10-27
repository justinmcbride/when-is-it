import { isValidZone } from './time'

/*
 * Remembers the extra time zones a user picks on the home page, on this device only.
 * Stored as {"v":1,"zones":[...]} so the shape can evolve; anything unreadable is ignored.
 */
export const ZONES_KEY = 'when-is-it:zones'
export const MAX_SAVED_ZONES = 12

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined
  } catch {
    // Access can throw when storage is disabled (e.g. some privacy modes).
    return undefined
  }
}

export function loadSavedZones(storage: StorageLike | undefined = defaultStorage()): string[] {
  if (!storage) return []
  let raw: string | null
  try {
    raw = storage.getItem(ZONES_KEY)
  } catch {
    return []
  }
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  const zones = (data as { zones?: unknown } | null)?.zones
  if (!Array.isArray(zones)) return []
  return cleanZones(zones)
}

export function saveZones(zones: readonly string[], storage: StorageLike | undefined = defaultStorage()): void {
  if (!storage) return
  const clean = cleanZones(zones)
  try {
    if (clean.length === 0) storage.removeItem(ZONES_KEY)
    else storage.setItem(ZONES_KEY, JSON.stringify({ v: 1, zones: clean }))
  } catch {
    // Quota exceeded or storage disabled: remembering zones is best-effort.
  }
}

function cleanZones(zones: readonly unknown[]): string[] {
  const out: string[] = []
  for (const z of zones) {
    if (typeof z === 'string' && isValidZone(z) && !out.includes(z)) out.push(z)
    if (out.length >= MAX_SAVED_ZONES) break
  }
  return out
}
