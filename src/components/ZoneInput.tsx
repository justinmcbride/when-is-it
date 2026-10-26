import { useId } from 'react'
import { isValidZone, listZones } from '../lib/time.ts'

/** A free-text input backed by a datalist of every IANA zone. */
export default function ZoneInput({
  value,
  onChange,
  onEnter,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder?: string
  id?: string
}) {
  const listId = useId()
  const invalid = value.trim() !== '' && !isValidZone(value.trim())
  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        placeholder={placeholder ?? 'e.g. Europe/London'}
        aria-invalid={invalid}
        className={invalid ? 'invalid' : undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
      />
      <datalist id={listId}>
        {listZones().map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </>
  )
}
