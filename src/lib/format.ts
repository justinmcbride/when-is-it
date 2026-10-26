import { DateTime } from 'luxon'

/*
 * Display formatting that follows the browser's locale, including its 12h/24h hour cycle
 * (e.g. en-US -> "5:30 PM", en-GB/de -> "17:30", and "-u-hc-h23" locale overrides).
 * `locale` defaults to the runtime's default locale and exists mainly for tests.
 */

const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
const HOUR: Intl.DateTimeFormatOptions = { hour: 'numeric' }

export function prefersHour12(locale?: string): boolean {
  const o = new Intl.DateTimeFormat(locale, HOUR).resolvedOptions()
  if (o.hourCycle) return o.hourCycle === 'h11' || o.hourCycle === 'h12'
  return !!o.hour12
}

function loc(dt: DateTime, locale?: string): DateTime {
  return locale ? dt.setLocale(locale) : dt
}

/** "5:30 PM" or "17:30" */
export function formatTime(dt: DateTime, locale?: string): string {
  return loc(dt, locale).toLocaleString(TIME)
}

/** Compact hour label for timeline ticks: "3 PM" or "15". */
export function formatHour(dt: DateTime, locale?: string): string {
  if (!prefersHour12(locale)) return dt.toFormat('HH')
  return loc(dt, locale).toLocaleString(HOUR)
}

/** "5:30 PM–7:00 PM" or "17:30–19:00" */
export function formatTimeRange(start: DateTime, end?: DateTime, locale?: string): string {
  return end ? `${formatTime(start, locale)}–${formatTime(end, locale)}` : formatTime(start, locale)
}

/** A wall-clock hour of day (e.g. 9 -> "9 AM" / "09"), independent of any zone. */
export function formatHourOfDay(hour: number, locale?: string): string {
  return formatHour(DateTime.utc(2000, 1, 1, hour), locale)
}

/** "Monday, October 26, 2026" style long date. */
export function formatLongDate(dt: DateTime, locale?: string): string {
  return loc(dt, locale).toLocaleString({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** "Mon, Oct 26, 2026" style short date. */
export function formatShortDate(dt: DateTime, locale?: string): string {
  return loc(dt, locale).toLocaleString({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
