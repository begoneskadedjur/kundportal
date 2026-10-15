// src/components/admin/procurement/StatusMenu.tsx
// Statusbyte från statusens text (docs/upphandlingsportal-ux-plan.md avsnitt 5,
// Knappar och ikoner): färgad text med punkt som öppnar en meny. Aldrig en
// rullista i raden och aldrig ett piller. Används i detaljsidans sidhuvud och
// på anbudstavlans kort.

import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../icons/Icon'
import { dotText } from './uiFormat'

export interface StatusOption<T extends string> {
  value: T
  label: string
  /** bg-klass för punkten */
  dot: string
}

interface Props<T extends string> {
  value: T
  label: string
  dot: string
  options: Array<StatusOption<T>>
  onChange: (value: T) => void
  disabled?: boolean
  /** Etikett för skärmläsare, t.ex. "Byt status för ..." */
  ariaLabel: string
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
}

export default function StatusMenu<T extends string>({ value, label, dot, options, onChange, disabled, ariaLabel, align = 'left', size = 'md' }: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`inline-flex items-center gap-1.5 min-h-[44px] ${size === 'sm' ? 'text-[12px]' : 'text-[13px]'} font-medium ${dotText(dot)} hover:opacity-80 disabled:opacity-50`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}, nu ${label}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
        <Icon name="allman.chevron" className="w-3 h-3 rotate-90 opacity-60" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-40 w-48 rounded-xl border border-slate-800 bg-slate-900 shadow-xl py-1`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={(e) => {
                e.preventDefault()
                setOpen(false)
                if (o.value !== value) onChange(o.value)
              }}
              className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 text-[13px] text-left hover:bg-slate-800/60 ${o.value === value ? 'text-slate-100 font-medium' : 'text-slate-300'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.dot}`} />
              <span className="flex-1">{o.label}</span>
              {o.value === value && <Icon name="allman.bock" size={16} className="text-[#20c58f]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
