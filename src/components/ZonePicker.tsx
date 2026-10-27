import { DateTime } from 'luxon'
import { useId, useMemo, useRef, useState } from 'react'
import { offsetLabel, zoneCity } from '../lib/time.ts'
import { searchZones, SUGGESTED_ZONES, warmZoneIndex, zoneLabel, zoneName } from '../lib/zoneNames.ts'

/**
 * Searchable time zone combobox. Matches cities, IANA ids, zone names ("Pacific Time") and
 * abbreviations ("CET"); always yields an IANA id.
 */
export default function ZonePicker({
  value,
  onSelect,
  placeholder = 'Search a city, zone name or abbreviation…',
  exclude = [],
  id,
  label,
}: {
  /** Currently selected zone, shown when the input isn't being edited. */
  value?: string
  onSelect: (zone: string) => void
  placeholder?: string
  exclude?: readonly string[]
  id?: string
  /** Accessible name when the picker isn't wrapped in a <label>. */
  label?: string
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const options = useMemo(() => {
    if (!open) return []
    const found = query.trim() ? searchZones(query, 12) : SUGGESTED_ZONES
    return found.filter((z) => !exclude.includes(z)).slice(0, 8)
  }, [open, query, exclude])

  const choose = (zone: string) => {
    onSelect(zone)
    setQuery('')
    setOpen(false)
    if (value !== undefined) inputRef.current?.blur()
  }

  const shown = open ? query : value ? zoneLabel(value) : ''
  const activeId = options[active] ? `${listId}-${active}` : undefined

  return (
    <div className="zone-picker">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        value={shown}
        placeholder={open && value ? zoneLabel(value) : placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          warmZoneIndex()
          setOpen(true)
          setQuery('')
          setActive(0)
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) return setOpen(true)
            const d = e.key === 'ArrowDown' ? 1 : -1
            setActive((a) => (options.length ? (a + d + options.length) % options.length : 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (open && options[active]) choose(options[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
      />
      {open && (
        <ul className="zone-options" id={listId} role="listbox">
          {options.length === 0 && <li className="zone-empty">No matching time zones</li>}
          {options.map((z, i) => (
            <li
              key={z}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(z)}
            >
              <ZoneOption zone={z} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ZoneOption({ zone }: { zone: string }) {
  const now = DateTime.now().setZone(zone)
  const name = zoneName(zone)
  return (
    <>
      <span className="zo-main">
        <strong>{zoneCity(zone)}</strong>
        {name && <span className="zo-name">{name}</span>}
      </span>
      <span className="zo-meta">
        <span className="zo-id">{zone}</span>
        <span className="zo-offset">
          {now.offsetNameShort && !now.offsetNameShort.startsWith('GMT') ? `${now.offsetNameShort} · ` : ''}
          {offsetLabel(now)}
        </span>
      </span>
    </>
  )
}
