// src/components/admin/procurement/clock/OptionPeriodHint.tsx
// Liten ikon (upphandling.forlangning) direkt efter basavtalets slutdatum när
// avtalet har förlängningsoptioner (sedan 3.66.0). Hovring på dator, tryck
// eller fokus på mobil och tangentbord visar en liten popover med optionerna,
// sista möjliga slut, källan och om en option troligen är avropad. Esc och
// klick utanför stänger. Popovern ritas i document.body med fast position så
// att tabeller med overflow inte klipper den.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../icons/Icon'
import { optionPeriodLines, type OptionPeriod } from './optionPeriod'

const POPOVER_WIDTH = 264

export default function OptionPeriodHint({ period, today }: { period: OptionPeriod | null; today: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | null>(null)
  const lastPointer = useRef<string>('')
  const id = useId()

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const vw = window.innerWidth
    const left = Math.max(8, Math.min(r.left + r.width / 2 - POPOVER_WIDTH / 2, vw - POPOVER_WIDTH - 8))
    setPos({ top: r.bottom + 4, left })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  useEffect(() => () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
  }, [])

  if (!period) return null

  const clearTimer = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }
  // Hovring bara med mus, så att ett tryck på mobil inte öppnar och stänger direkt
  const onEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimer()
    setOpen(true)
  }
  const onLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimer()
    hoverTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  const lines = optionPeriodLines(period, today)
  // Mus: hovringen har redan öppnat, klicket håller den öppen. Tryck och
  // tangentbord växlar. Fokus öppnar bara vid tangentbordsfokus (focus-visible),
  // inte när ett tryck ger fokus.
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Förlängningsoptioner, längst till ${period.maxEnd}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerDown={(e) => { lastPointer.current = e.pointerType }}
        onClick={() => setOpen((v) => (lastPointer.current === 'mouse' ? true : !v))}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setOpen(true) }}
        onBlur={(e) => {
          if (!popRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
        }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        className="inline-flex items-center justify-center w-11 h-11 -my-3.5 -mx-3 shrink-0 rounded-md text-slate-500 hover:text-slate-200 focus-visible:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/50"
      >
        <Icon name="upphandling.forlangning" size={16} />
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            onPointerEnter={onEnter}
            onPointerLeave={onLeave}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_WIDTH, zIndex: 60 }}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 shadow-xl text-[12px] leading-snug text-slate-300 space-y-1 whitespace-normal text-left"
          >
            {lines.map((l, i) => (
              <p key={i} className={i === 0 ? 'text-slate-100 tabular-nums' : l.startsWith('"') ? 'text-slate-500 italic' : ''}>{l}</p>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
