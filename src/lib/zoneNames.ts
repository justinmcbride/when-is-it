import { listZones, MODERN_ZONE_IDS, zoneCity } from './time'

/*
 * Human names for IANA zones ("America/Denver" -> "Mountain Time") and a search that matches
 * cities, IANA ids, zone names ("pacific time", "central european") and common abbreviations
 * ("MST", "CET"). Links always store IANA ids; names are only for display and search.
 */

/** Zones offered as one-click suggestions and preferred when ranking ties. */
export const SUGGESTED_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
]

/**
 * Common abbreviations and short names -> the zones they usually mean, most likely first.
 * Abbreviations are ambiguous worldwide (e.g. IST, CST), so this is deliberately small.
 */
export const ZONE_ALIASES: Record<string, string[]> = {
  UTC: ['UTC'],
  GMT: ['Europe/London', 'UTC'],
  PT: ['America/Los_Angeles'],
  PST: ['America/Los_Angeles'],
  PDT: ['America/Los_Angeles'],
  MT: ['America/Denver', 'America/Phoenix'],
  MST: ['America/Denver', 'America/Phoenix'],
  MDT: ['America/Denver'],
  CT: ['America/Chicago'],
  CST: ['America/Chicago', 'Asia/Shanghai'],
  CDT: ['America/Chicago'],
  ET: ['America/New_York'],
  EST: ['America/New_York'],
  EDT: ['America/New_York'],
  AKST: ['America/Anchorage'],
  AKDT: ['America/Anchorage'],
  HST: ['Pacific/Honolulu'],
  AST: ['America/Halifax'],
  ADT: ['America/Halifax'],
  NST: ['America/St_Johns'],
  NDT: ['America/St_Johns'],
  BST: ['Europe/London'],
  IST: ['Asia/Kolkata', 'Europe/Dublin'],
  WET: ['Europe/Lisbon'],
  WEST: ['Europe/Lisbon'],
  CET: ['Europe/Paris', 'Europe/Berlin'],
  CEST: ['Europe/Paris', 'Europe/Berlin'],
  EET: ['Europe/Athens', 'Europe/Helsinki'],
  EEST: ['Europe/Athens', 'Europe/Helsinki'],
  MSK: ['Europe/Moscow'],
  GST: ['Asia/Dubai'],
  PKT: ['Asia/Karachi'],
  NPT: ['Asia/Kathmandu'],
  ICT: ['Asia/Bangkok'],
  WIB: ['Asia/Jakarta'],
  SGT: ['Asia/Singapore'],
  HKT: ['Asia/Hong_Kong'],
  JST: ['Asia/Tokyo'],
  KST: ['Asia/Seoul'],
  AWST: ['Australia/Perth'],
  ACST: ['Australia/Adelaide'],
  ACDT: ['Australia/Adelaide'],
  AEST: ['Australia/Sydney', 'Australia/Brisbane'],
  AEDT: ['Australia/Sydney'],
  NZST: ['Pacific/Auckland'],
  NZDT: ['Pacific/Auckland'],
  SAST: ['Africa/Johannesburg'],
  WAT: ['Africa/Lagos'],
  CAT: ['Africa/Maputo'],
  EAT: ['Africa/Nairobi'],
  BRT: ['America/Sao_Paulo'],
  ART: ['America/Argentina/Buenos_Aires'],
}

const NAME_LOCALE = 'en-US'
// Mid-winter and mid-summer (northern hemisphere) to capture both standard and daylight names.
const SAMPLE_DATES = [new Date(Date.UTC(2026, 0, 15, 12)), new Date(Date.UTC(2026, 6, 15, 12))]

function intlName(zone: string, style: Intl.DateTimeFormatOptions['timeZoneName'], date: Date): string | undefined {
  try {
    return new Intl.DateTimeFormat(NAME_LOCALE, { timeZone: zone, timeZoneName: style })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value
  } catch {
    return undefined
  }
}

/** Intl falls back to raw offsets ("GMT+05:45") when it has no name; those aren't names. */
const isOffsetName = (s: string | undefined) => !s || /^(GMT|UTC)([+-−]|$)/.test(s)

const nameCache = new Map<string, string | undefined>()

/** "Mountain Time", "Central European Time", "India Standard Time"; undefined if Intl has none. */
export function zoneName(zone: string): string | undefined {
  if (nameCache.has(zone)) return nameCache.get(zone)
  let name: string | undefined
  for (const style of ['longGeneric', 'long'] as const) {
    const n = intlName(zone, style, SAMPLE_DATES[0])
    if (!isOffsetName(n)) {
      name = n
      break
    }
  }
  nameCache.set(zone, name)
  return name
}

/** City plus zone name, e.g. "Denver · Mountain Time". */
export function zoneLabel(zone: string): string {
  const name = zoneName(zone)
  const city = zoneCity(zone)
  return name && name !== city ? `${city} · ${name}` : city
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[/_.,()\-–]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface IndexEntry {
  zone: string
  city: string
  id: string
  name: string
  /** Every searchable string, normalized and space-joined with leading/trailing spaces. */
  haystack: string
}

let index: IndexEntry[] | undefined

const aliasesByZone = (() => {
  const m = new Map<string, string[]>()
  for (const [abbr, zones] of Object.entries(ZONE_ALIASES)) {
    for (const z of zones) m.set(z, [...(m.get(z) ?? []), abbr])
  }
  return m
})()

const legacyByZone = new Map(Object.entries(MODERN_ZONE_IDS).map(([legacy, modern]) => [modern, legacy]))

function buildIndex(): IndexEntry[] {
  return listZones().map((zone) => {
    const words = new Set<string>([zone, zoneCity(zone), ...(aliasesByZone.get(zone) ?? [])])
    const legacy = legacyByZone.get(zone)
    if (legacy) words.add(legacy)
    for (const date of SAMPLE_DATES) {
      for (const style of ['longGeneric', 'long', 'shortGeneric', 'short'] as const) {
        const n = intlName(zone, style, date)
        if (!isOffsetName(n)) words.add(n!)
      }
    }
    return {
      zone,
      city: normalize(zoneCity(zone)),
      id: normalize(zone),
      name: normalize(zoneName(zone) ?? ''),
      haystack: ` ${[...words].map(normalize).join(' | ')} `,
    }
  })
}

/** Builds the search index ahead of time (it takes a few tens of milliseconds). */
export function warmZoneIndex(): void {
  index ??= buildIndex()
}

/** Zones matching a city, IANA id, zone name or abbreviation, best matches first. */
export function searchZones(query: string, limit = 8): string[] {
  const q = normalize(query)
  if (!q) return []
  warmZoneIndex()
  const tokens = q.split(' ')
  const alias = ZONE_ALIASES[query.trim().toUpperCase()] ?? []

  // "CET" -> Paris, Berlin first, then every other "Central European Time" zone.
  const aliasNames = new Set(index!.filter((e) => alias.includes(e.zone) && e.name).map((e) => e.name))

  const scored: { zone: string; score: number; city: string }[] = []
  for (const e of index!) {
    const aliasRank = alias.indexOf(e.zone)
    const sharesAliasName = aliasNames.has(e.name)
    if (aliasRank < 0 && !sharesAliasName && !tokens.every((t) => e.haystack.includes(t))) continue
    let score = 0
    if (aliasRank >= 0) score = 1000 - aliasRank
    else if (sharesAliasName) score = 600
    else if (e.city === q || e.id === q) score = 500
    // "india" -> "India Time", "pacific" -> "Pacific Time"
    else if (e.name === q || e.haystack.includes(` ${q} time `)) score = 400
    else if (e.city.startsWith(q)) score = 300
    else if (e.name.startsWith(q)) score = 250
    else if (tokens.every((t) => e.haystack.includes(` ${t}`))) score = 150
    else score = 50
    if (SUGGESTED_ZONES.includes(e.zone) || aliasesByZone.has(e.zone)) score += 20
    scored.push({ zone: e.zone, score, city: e.city })
  }
  scored.sort((a, b) => b.score - a.score || a.city.localeCompare(b.city))
  return scored.slice(0, limit).map((s) => s.zone)
}
