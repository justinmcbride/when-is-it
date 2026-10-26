/** A wall-clock date and time with no attached time zone. Months are 1-12. */
export interface WallTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/** Everything needed to describe a shared event; this is exactly what the URL carries. */
export interface EventSpec {
  start: WallTime
  /** Optional end, as a wall time in the same (source) zone. */
  end?: WallTime
  /** IANA zone the event was created in, e.g. "America/Denver". */
  zone: string
  /** Additional IANA zones the creator wants every viewer to see. */
  extraZones: string[]
  title?: string
}
