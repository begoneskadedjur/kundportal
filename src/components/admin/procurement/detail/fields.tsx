// src/components/admin/procurement/detail/fields.tsx
// Små formulärbyggstenar för upphandlingens detaljsida och anbudsverkstaden:
// kompakta fält (12 till 13 px), talfält som tål komma som decimal, ett
// hopfällbart block med ankare. Rena hjälpfunktioner ligger i helpers.tsx.

import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { numToInput, parseNum } from './helpers'
import type { ProcurementService } from '../../../../services/procurementService'

export type NoticePatch = Parameters<typeof ProcurementService.updateNotice>[1]
export type SaveNotice = (patch: NoticePatch, eventTitle?: string) => Promise<void>

/** Kompakt textfält i tabeller och formulär */
export const inputCls =
  'w-full px-2.5 py-1.5 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f] tabular-nums disabled:opacity-50'

/** Native select utanför modaler (globals.css stylar den) */
export const selectCls =
  'w-full px-2 py-1.5 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]'

export const checkboxCls = 'w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-medium text-slate-500 mb-1">
      {children}
    </label>
  )
}

/**
 * Talfält som håller en lokal textsträng så att "1," går att skriva, och
 * rapporterar tal (eller null) uppåt. commitOnBlur: anropa bara vid blur.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  commitOnBlur = false,
  className = '',
  disabled,
  ariaLabel,
}: {
  label?: string
  value: number | null | undefined
  onChange: (n: number | null) => void
  suffix?: string
  placeholder?: string
  commitOnBlur?: boolean
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [text, setText] = useState(numToInput(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(numToInput(value))
  }, [value, focused])

  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel ?? label}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setText(e.target.value)
            if (!commitOnBlur) onChange(parseNum(e.target.value))
          }}
          onBlur={() => {
            setFocused(false)
            const n = parseNum(text)
            if (commitOnBlur && n !== (value ?? null)) onChange(n)
            setText(numToInput(n))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className={`${inputCls} ${suffix ? 'pr-10' : ''} text-right`}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  )
}

/** Textfält som sparar vid blur om värdet ändrats */
export function BlurText({
  value,
  onCommit,
  placeholder,
  multiline = false,
  rows = 2,
  className = '',
  ariaLabel,
}: {
  value: string | null | undefined
  onCommit: (v: string | null) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value ?? '')
  }, [value, focused])
  const commit = () => {
    setFocused(false)
    const next = text.trim() === '' ? null : text
    if ((next ?? null) !== (value ?? null)) onCommit(next)
  }
  return multiline ? (
    <textarea
      aria-label={ariaLabel}
      value={text}
      rows={rows}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className={`${inputCls} resize-y ${className}`}
    />
  ) : (
    <input
      type="text"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className={`${inputCls} ${className}`}
    />
  )
}

/** Etikett och värde i en definitionslista */
export function KV({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-[12.5px] text-slate-200 mt-0.5 break-words tabular-nums">{children}</dd>
    </div>
  )
}

/** Underrubrik inne i ett block */
export function SubHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <h3 className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{children}</h3>
      {action}
    </div>
  )
}

/**
 * Avsnitt i detaljsidans steg (docs/upphandlingsportal-ux-plan.md avsnitt 3
 * och 5): liten versal rubrik med ikon, luft mellan avsnitten och tunn ram
 * bara runt innehåll med tabeller och fält (framed). Inget hopfällbart sedan
 * 3.64.0; stegen håller sidan kort.
 */
export function Block({
  id,
  icon,
  title,
  hint,
  action,
  children,
  framed = true,
}: {
  id?: string
  icon?: IconName
  title: string
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  framed?: boolean
}) {
  return (
    <section id={id} className="scroll-mt-24 min-w-0">
      <div className="flex items-end justify-between gap-3 mb-2 min-h-[28px]">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          {icon && <Icon name={icon} size={16} />}
          {title}
        </h2>
        {action && <div className="shrink-0 flex items-center gap-1">{action}</div>}
      </div>
      {hint && <p className="text-[12px] text-slate-500 -mt-1 mb-2">{hint}</p>}
      {framed ? <div className="rounded-[10px] border border-slate-800 bg-slate-900/40">{children}</div> : children}
    </section>
  )
}
