import { DateTime } from 'luxon'
import type { EventSpec, WallTime } from './types'
import { addDays, compareWallTime, isValidZone, pad2, sameDate } from './time'

/*
 * URL format (inside the hash, so it works on any static host):
 *
 *   #/<YYYY-MM-DD>_<HH.MM>[-[<YYYY-MM-DD>_]<HH.MM>]_<Zone>[,<Zone>...][?t=<title>]
 *
 * - Zones use "." instead of "/" (America/Denver -> America.Denver). The first zone is the
 *   source zone; any others are extra zones to show every viewer.
 * - An end time without a date is on the start date, or the next day if it is not after
 *   the start time (e.g. 22.00-01.00).
 */
const PATH_RE =
  /^(\d{4})-(\d{2})-(\d{2})_(\d{2})\.(\d{2})(?:-(?:(\d{4})-(\d{2})-(\d{2})_)?(\d{2})\.(\d{2}))?_(.+)$/

export const MAX_TITLE_LENGTH = 200

export type ParseResult =
  | { ok: true; event: EventSpec; warnings: string[] }
  | { ok: false; error: string }

export function zoneToUrl(zone: string): string {
  return zone.replaceAll('/', '.')
}

export function zoneFromUrl(segment: string): string {
  return segment.replaceAll('.', '/')
}

/** Accepts "#/2026-...", "/2026-..." or "2026-..." (optionally followed by "?t=..."). */
export function parseEventHash(hash: string): ParseResult {
  let rest = hash.replace(/^#/, '').replace(/^\//, '')
  let query = ''
  const q = rest.indexOf('?')
  if (q >= 0) {
    query = rest.slice(q + 1)
    rest = rest.slice(0, q)
  }
  let path: string
  try {
    path = decodeURIComponent(rest)
  } catch {
    return { ok: false, error: 'The link is not correctly encoded.' }
  }

  const m = PATH_RE.exec(path)
  if (!m) {
    return {
      ok: false,
      error: 'The link should look like 2026-10-26_17.30_America.Denver (optionally with an end time).',
    }
  }
  const n = (i: number) => Number(m[i])
  const start: WallTime = { year: n(1), month: n(2), day: n(3), hour: n(4), minute: n(5) }
  if (!isValidWallTime(start)) return { ok: false, error: 'The start date or time is not valid.' }

  let end: WallTime | undefined
  if (m[9] !== undefined) {
    if (m[6] !== undefined) {
      end = { year: n(6), month: n(7), day: n(8), hour: n(9), minute: n(10) }
      if (!isValidWallTime(end)) return { ok: false, error: 'The end date or time is not valid.' }
    } else {
      end = { ...start, hour: n(9), minute: n(10) }
      if (!isValidWallTime(end)) return { ok: false, error: 'The end time is not valid.' }
      if (compareWallTime(end, start) <= 0) end = addDays(end, 1)
    }
    if (compareWallTime(end, start) <= 0) return { ok: false, error: 'The event ends before it starts.' }
  }

  const warnings: string[] = []
  const zones = m[11]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(zoneFromUrl)
  const [zone, ...extras] = zones
  if (!zone || !isValidZone(zone)) {
    return { ok: false, error: `Unknown time zone "${zone ?? ''}".` }
  }
  const extraZones: string[] = []
  for (const z of extras) {
    if (!isValidZone(z)) {
      warnings.push(`Ignored unknown time zone "${z}".`)
    } else if (z !== zone && !extraZones.includes(z)) {
      extraZones.push(z)
    }
  }

  const rawTitle = new URLSearchParams(query).get('t')?.trim()
  const title = rawTitle ? rawTitle.slice(0, MAX_TITLE_LENGTH) : undefined

  return { ok: true, event: { start, end, zone, extraZones, title }, warnings }
}

/** Serialize to the hash path (without the leading "#"), using the shortest end form. */
export function serializeEvent(ev: EventSpec): string {
  let s = `/${formatDate(ev.start)}_${formatTime(ev.start)}`
  if (ev.end) {
    s += `-${canUseShortEnd(ev.start, ev.end) ? '' : `${formatDate(ev.end)}_`}${formatTime(ev.end)}`
  }
  const zones = [ev.zone, ...ev.extraZones.filter((z) => z !== ev.zone)]
  s += `_${Array.from(new Set(zones)).map(zoneToUrl).join(',')}`
  const title = ev.title?.trim()
  if (title) s += `?t=${encodeURIComponent(title.slice(0, MAX_TITLE_LENGTH))}`
  return s
}

export function eventHash(ev: EventSpec): string {
  return `#${serializeEvent(ev)}`
}

/** Absolute share link for the current deployment. */
export function shareUrl(ev: EventSpec, base = currentBase()): string {
  return `${base}${eventHash(ev)}`
}

function currentBase(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

function canUseShortEnd(start: WallTime, end: WallTime): boolean {
  const endTimeAfterStart = end.hour * 60 + end.minute > start.hour * 60 + start.minute
  if (sameDate(start, end)) return endTimeAfterStart
  return sameDate(addDays(start, 1), end) && !endTimeAfterStart
}

function formatDate(wt: WallTime): string {
  return `${String(wt.year).padStart(4, '0')}-${pad2(wt.month)}-${pad2(wt.day)}`
}

function formatTime(wt: WallTime): string {
  return `${pad2(wt.hour)}.${pad2(wt.minute)}`
}

function isValidWallTime(wt: WallTime): boolean {
  if (wt.hour > 23 || wt.minute > 59) return false
  return DateTime.utc(wt.year, wt.month, wt.day).isValid
}
