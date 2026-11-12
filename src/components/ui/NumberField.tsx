// src/components/ui/NumberField.tsx
// Sifferfält som går att tömma och skriva fritt i medan man redigerar (3.131.0).
// Texten hålls lokalt medan fältet har fokus. Värdet tolkas och sparas först
// när fältet lämnas eller med Enter. Escape ångrar. Tomt eller ogiltigt
// återställer föregående värde, under minsta tillåtna blir minsta tillåtna.
// Komma och punkt fungerar båda som decimaltecken, mellanslag ignoreras.

import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { formatNumberDraft, parseNumberDraft } from './numberDraft'

export interface NumberFieldProps {
  value: number | null | undefined
  /** Anropas bara när ett giltigt värde skiljer sig från value */
  onCommit: (value: number) => void
  min?: number
  max?: number
  /** Bara heltal (avrundas) */
  integer?: boolean
  /** Antal decimaler som sparas (standard 2) */
  decimals?: number
  /** Visning när fältet inte redigeras */
  format?: (value: number) => string
  className?: string
  disabled?: boolean
  placeholder?: string
  title?: string
  id?: string
  'aria-label'?: string
  onFocus?: () => void
}

export default function NumberField({
  value, onCommit, min, max, integer = false, decimals = 2, format, className = '',
  disabled, placeholder, title, id, 'aria-label': ariaLabel, onFocus,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const draftRef = useRef<string | null>(null)
  const avbryt = useRef(false)

  const visat = value == null || !Number.isFinite(Number(value))
    ? ''
    : format ? format(Number(value)) : formatNumberDraft(Number(value), integer ? 0 : decimals)

  const satt = (s: string | null) => { draftRef.current = s; setDraft(s) }

  const commit = () => {
    const raw = draftRef.current
    satt(null)
    if (avbryt.current) { avbryt.current = false; return }
    if (raw === null) return
    const n = parseNumberDraft(raw, { min, max, integer, decimals })
    if (n === null) return
    if (value != null && Math.abs(n - Number(value)) < 1e-9) return
    onCommit(n)
  }

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      id={id}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      placeholder={placeholder}
      value={draft ?? visat}
      onFocus={(e: FocusEvent<HTMLInputElement>) => {
        const start = value == null || !Number.isFinite(Number(value)) ? '' : formatNumberDraft(Number(value), integer ? 0 : decimals)
        satt(start)
        onFocus?.()
        const el = e.currentTarget
        requestAnimationFrame(() => { try { el.select() } catch { /* fältet kan vara borta */ } })
      }}
      onChange={e => satt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        else if (e.key === 'Escape') { avbryt.current = true; e.currentTarget.blur() }
      }}
      className={className}
    />
  )
}
