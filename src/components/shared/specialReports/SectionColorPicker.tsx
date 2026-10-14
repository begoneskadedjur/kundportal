// src/components/shared/specialReports/SectionColorPicker.tsx
// Färgval för en del: radiogroup med åtta cirklar (24 px) i knappar på minst
// 36 px. Vald färg får en ring. Piltangenterna flyttar valet som i en radiogrupp.

import { useRef } from 'react'
import { SECTION_COLORS } from '../../../types/specialReport'

interface SectionColorPickerProps {
  value: string
  onChange: (color: string) => void
  /** Knappens storlek, 36 eller 44 px */
  size?: 36 | 44
  label?: string
  className?: string
}

export default function SectionColorPicker({ value, onChange, size = 44, label = 'Färg på delen', className = '' }: SectionColorPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const valdIndex = Math.max(0, SECTION_COLORS.findIndex(c => c.value.toLowerCase() === value.toLowerCase()))

  const flytta = (fran: number, steg: number) => {
    const n = (fran + steg + SECTION_COLORS.length) % SECTION_COLORS.length
    onChange(SECTION_COLORS[n].value)
    refs.current[n]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap ${className}`}>
      {SECTION_COLORS.map((c, i) => {
        const vald = i === valdIndex && c.value.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c.value}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={vald}
            aria-label={`Färg: ${c.name}`}
            title={c.name}
            tabIndex={i === valdIndex ? 0 : -1}
            onClick={() => onChange(c.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); flytta(i, 1) }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); flytta(i, -1) }
            }}
            className={`flex flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 ${size === 44 ? 'h-11 w-11' : 'h-9 w-9'}`}
          >
            <span
              className="block h-6 w-6 rounded-full"
              style={{
                background: c.value,
                boxShadow: vald ? `0 0 0 2px var(--color-slate-900, #0f172a), 0 0 0 4px ${c.value}` : 'none',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
