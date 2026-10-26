import type { EventSpec } from './types'

export type ZoneTag = 'event' | 'you' | 'included'

export interface ZoneRow {
  zone: string
  tags: ZoneTag[]
}

/** Source zone, then the viewer's zone, then extras — each zone once, with all of its roles. */
export function zoneRows(spec: EventSpec, viewerZone: string): ZoneRow[] {
  const rows: ZoneRow[] = []
  const add = (zone: string, tag: ZoneTag) => {
    const existing = rows.find((r) => r.zone === zone)
    if (existing) existing.tags.push(tag)
    else rows.push({ zone, tags: [tag] })
  }
  add(spec.zone, 'event')
  add(viewerZone, 'you')
  for (const z of spec.extraZones) add(z, 'included')
  return rows
}
