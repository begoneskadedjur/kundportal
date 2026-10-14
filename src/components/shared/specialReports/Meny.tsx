// src/components/shared/specialReports/Meny.tsx
// Liten meny eller popover till en knapp (3.53.0): delens typ och färg och
// blockets ⋯-meny. Från sm ligger den under knappen, på mobil som bottenark
// med mörk bakgrund. Stängs vid klick utanför och med Escape (fokus tillbaka
// till knappen). Pil upp och ned flyttar mellan menyvalen, Home och End till
// första och sista. Anroparen lägger knappen och menyn i samma relative-behållare.
// Bottenarket renderas i document.body: inuti en @container (container-type)
// blir fixed annars relativ till behållaren och inte till skärmen.

import { useEffect, useRef, useState, type KeyboardEvent as TangentHandelse, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const SM = '(min-width: 640px)'

/** Från sm ligger menyn under knappen, smalare än så som bottenark */
function useArSm(): boolean {
  const [ar, setAr] = useState(() => typeof window !== 'undefined' && window.matchMedia(SM).matches)
  useEffect(() => {
    const mq = window.matchMedia(SM)
    const andrad = () => setAr(mq.matches)
    andrad()
    mq.addEventListener('change', andrad)
    return () => mq.removeEventListener('change', andrad)
  }, [])
  return ar
}

interface MenyProps {
  open: boolean
  onClose: () => void
  /** Knappen som öppnar menyn: klick på den räknas inte som utanför */
  anchorRef: RefObject<HTMLElement | null>
  /** Rubrik i bottenarket och namn för skärmläsare */
  label: string
  /** role på panelen: menu för menyval, dialog för färgvalet */
  role?: 'menu' | 'dialog'
  align?: 'left' | 'right'
  className?: string
  children: ReactNode
}

const VAL = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled])'

export default function Meny({ open, onClose, anchorRef, label, role = 'menu', align = 'left', className = '', children }: MenyProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const arSm = useArSm()
  // Senaste onClose utan att lyssnarna behöver kopplas om vid varje rendering
  const stangRef = useRef(onClose)
  useEffect(() => { stangRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    // Fokus till valt alternativ, annars första valet
    const forsta = panel?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel?.querySelector<HTMLElement>(VAL)
    forsta?.focus()

    const utanfor = (e: PointerEvent) => {
      const mal = e.target as Node | null
      if (!mal) return
      if (panelRef.current?.contains(mal) || anchorRef.current?.contains(mal)) return
      stangRef.current()
    }
    const tangent = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      stangRef.current()
      anchorRef.current?.focus()
    }
    document.addEventListener('pointerdown', utanfor)
    document.addEventListener('keydown', tangent)
    return () => {
      document.removeEventListener('pointerdown', utanfor)
      document.removeEventListener('keydown', tangent)
    }
  }, [open, anchorRef, arSm])

  if (!open) return null

  const pilar = (e: TangentHandelse<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const val = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(VAL) ?? [])
    if (val.length === 0) return
    e.preventDefault()
    const i = val.indexOf(document.activeElement as HTMLElement)
    const n = e.key === 'Home' ? 0
      : e.key === 'End' ? val.length - 1
        : e.key === 'ArrowDown' ? (i + 1) % val.length
          : (i - 1 + val.length) % val.length
    val[n]?.focus()
  }

  const innehall = (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden="true" />
      <div
        ref={panelRef}
        role={role}
        aria-label={label}
        onKeyDown={pilar}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900 p-2 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl shadow-black/40 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:z-40 sm:mt-1.5 sm:max-h-none sm:rounded-2xl sm:border sm:pb-2 ${align === 'right' ? 'sm:right-0' : 'sm:left-0'} ${className}`}
      >
        <span className="block px-2.5 pb-2 pt-1 text-sm font-semibold text-white sm:hidden">{label}</span>
        {children}
      </div>
    </>
  )
  return arSm ? innehall : createPortal(innehall, document.body)
}
