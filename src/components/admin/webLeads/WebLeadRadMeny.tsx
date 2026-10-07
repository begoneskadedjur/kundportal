// src/components/admin/webLeads/WebLeadRadMeny.tsx
// Radmenyn i Leads (Webb): tre punkter som öppnar en liten meny med åtgärder för en förfrågan.
// Menyn renderas i body med fast position så att tabellens scrollruta inte klipper den.
// Stängs med Escape, klick utanför, scroll och storleksändring.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LeadIcon } from './WebLeadIcons'

export interface RadMenyVal {
  label: string
  ikon?: ReactNode
  onClick: () => void
  disabled?: boolean
}

export default function WebLeadRadMeny({ val, etikett }: { val: RadMenyVal[]; etikett: string }) {
  const [oppen, setOppen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const knapp = useRef<HTMLButtonElement>(null)
  const meny = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!oppen || !knapp.current) return
    const r = knapp.current.getBoundingClientRect()
    const hojd = val.length * 36 + 8
    const nedat = r.bottom + 4 + hojd < window.innerHeight
    setPos({ top: nedat ? r.bottom + 4 : Math.max(8, r.top - 4 - hojd), right: Math.max(8, window.innerWidth - r.right) })
  }, [oppen, val.length])

  useEffect(() => {
    if (!oppen) return
    const stang = () => setOppen(false)
    const klick = (e: MouseEvent) => {
      if (meny.current?.contains(e.target as Node) || knapp.current?.contains(e.target as Node)) return
      stang()
    }
    const tangent = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        stang()
        knapp.current?.focus()
      }
    }
    document.addEventListener('mousedown', klick)
    document.addEventListener('keydown', tangent, true)
    window.addEventListener('scroll', stang, true)
    window.addEventListener('resize', stang)
    meny.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    return () => {
      document.removeEventListener('mousedown', klick)
      document.removeEventListener('keydown', tangent, true)
      window.removeEventListener('scroll', stang, true)
      window.removeEventListener('resize', stang)
    }
  }, [oppen, pos])

  const flytta = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Portalen bubblar Reacts händelser till raden: Enter i menyn får inte öppna förfrågan
    e.stopPropagation()
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const knappar = [...(meny.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const i = knappar.indexOf(document.activeElement as HTMLButtonElement)
    const nasta = e.key === 'ArrowDown' ? (i + 1) % knappar.length : (i - 1 + knappar.length) % knappar.length
    knappar[nasta]?.focus()
  }

  return (
    <>
      <button
        ref={knapp}
        type="button"
        aria-label={etikett}
        aria-haspopup="menu"
        aria-expanded={oppen}
        onClick={(e) => {
          e.stopPropagation()
          setOppen((o) => !o)
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      >
        <LeadIcon name="meny" className="w-4 h-4" />
      </button>
      {oppen && pos &&
        createPortal(
          <div
            ref={meny}
            role="menu"
            onKeyDown={flytta}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 60 }}
            className="min-w-[200px] py-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl"
          >
            {val.map((v) => (
              <button
                key={v.label}
                type="button"
                role="menuitem"
                disabled={v.disabled}
                onClick={() => {
                  setOppen(false)
                  v.onClick()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-200 hover:bg-slate-700/60 focus:bg-slate-700/60 focus:outline-none disabled:opacity-40"
              >
                <span className="w-4 h-4 text-slate-400 flex-none">{v.ikon}</span>
                {v.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
