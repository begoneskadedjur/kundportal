// src/components/admin/customers/record/paperFold.tsx
// Hopfällning av paragrafer på avtalspappret. Långa avtal (28 enheter) blir
// annars en vägg. Reglerna styr vid varje laddning, manuell öppning lever i
// sessionStorage per avtal och paragraf, varningar går aldrig att fälla in
// (forceOpen), och ett hopfällt stycke öppnar sig när något dras över det i
// 400 ms (spring-loaded, som mappar i Finder). Utskrift visar allt: innehållet
// göms med `hidden print:block`, aldrig avmonterat.
//
// Rubrikraden är klickytan. Inga knappar, inga chevroner: "visa 28 rader"
// och "dölj" i samma prickiga understrykning som "visa händelser".
// Regler per paragraf: docs/paper-fold.md

import { useEffect, useRef, useState } from 'react'
import type { PaperInk } from './paperInk'

/** Fler rader än så här fälls stycket in */
export const FOLD_THRESHOLD = 5
const SPRING_MS = 400

type Manual = 'open' | 'closed' | null

const storageKey = (contractId: string, para: string) => `contract-paper:${contractId}:${para}`

/** Bara 'open' lagras: en sparad stängning skulle annars överleva regeln */
function readManual(contractId: string, para: string): Manual {
  try {
    return sessionStorage.getItem(storageKey(contractId, para)) === 'open' ? 'open' : null
  } catch {
    return null
  }
}

export interface PaperFold {
  open: boolean
  /** Reglerna eller en varning håller stycket öppet: ingen "dölj"-länk */
  pinned: boolean
  toggle: () => void
  /** Klick på rubrikraden (knappar i raden lämnas ifred) */
  onHeaderClick: (e: React.MouseEvent) => void
}

export function usePaperFold(opts: {
  contractId: string
  para: string
  /** Reglerna vill ha stycket hopfällt (t.ex. fler än 5 enheter) */
  closedByRule: boolean
  /** Varning eller beslut i stycket: alltid öppet, manuell stängning sparas inte */
  forceOpen?: boolean
  /** Något dras över stycket just nu */
  dragOver?: boolean
}): PaperFold {
  const { contractId, para, closedByRule, forceOpen = false, dragOver = false } = opts
  const [manual, setManual] = useState<Manual>(() => readManual(contractId, para))
  const [spring, setSpring] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    setManual(readManual(contractId, para))
  }, [contractId, para])

  useEffect(() => {
    if (dragOver) {
      if (timer.current == null) timer.current = window.setTimeout(() => setSpring(true), SPRING_MS)
    } else {
      if (timer.current != null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
    return () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [dragOver])

  const pinned = forceOpen || (!closedByRule && !manual)
  const open = forceOpen || spring || (manual ? manual === 'open' : !closedByRule)

  const toggle = () => {
    if (forceOpen) return
    const next: Manual = open ? 'closed' : 'open'
    setSpring(false)
    setManual(next)
    try {
      // Öppning sparas för sessionen, stängning lever bara i minnet
      if (next === 'open') sessionStorage.setItem(storageKey(contractId, para), 'open')
      else sessionStorage.removeItem(storageKey(contractId, para))
    } catch {
      /* privat läge */
    }
  }

  const onHeaderClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return
    toggle()
  }

  return { open, pinned, toggle, onHeaderClick }
}

/**
 * Har raderna i stycket ändrats sedan användaren senast såg det öppet?
 * Nycklarna sparas i localStorage per avtal när stycket är öppet, så en ny
 * eller borttagen rad öppnar stycket nästa gång (§ 6).
 */
export function useSeenRows(opts: { contractId: string; para: string; ids: string[]; ready: boolean }): boolean {
  const { contractId, para, ids, ready } = opts
  // Raderna registreras som sedda så fort de laddats: ändrade rader tvingar
  // ändå stycket öppet den här laddningen (spärren nedan), så användaren
  // hinner se dem.
  const open = true
  const key = `contract-paper-seen:${contractId}:${para}`
  const sorted = [...ids].sort().join(',')
  // Jämförs mot det som låg sparat när pappret öppnades, och spärren
  // släpper inte förrän pappret laddas om: annars skulle stycket stänga
  // sig igen så fort raderna registrerats som sedda.
  const baseline = useRef<{ key: string; value: string | null } | null>(null)
  if (baseline.current == null || baseline.current.key !== key) {
    let value: string | null = null
    try {
      value = localStorage.getItem(key)
    } catch {
      value = null
    }
    baseline.current = { key, value }
  }
  const changed = ready && baseline.current.value != null && baseline.current.value !== sorted
  const latched = useRef(false)
  if (changed) latched.current = true
  useEffect(() => {
    if (!open || !ready) return
    try {
      localStorage.setItem(key, sorted)
    } catch {
      /* privat läge */
    }
  }, [open, ready, key, sorted])
  return latched.current
}

/** "visa 28 rader" / "dölj" i rubrikraden, göms vid utskrift */
export function FoldLink({ fold, label, ink }: { fold: PaperFold; label: string; ink?: PaperInk }) {
  if (fold.pinned && fold.open) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        fold.toggle()
      }}
      className="print:hidden font-sans text-[10px] underline decoration-dotted whitespace-nowrap"
      style={{ color: ink?.muted ?? '#8a9099' }}
    >
      {fold.open ? 'dölj' : label}
    </button>
  )
}

/** Sammanfattningsraden under en hopfälld rubrik, som en invikt bilaga */
export function FoldSummary({
  children,
  warning,
  ink,
  onClick,
}: {
  children: React.ReactNode
  /** Lyfts före den neutrala texten, i varningsfärg */
  warning?: React.ReactNode
  ink?: PaperInk
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`print:hidden py-2 text-[12.5px] leading-snug border-b border-dotted ${onClick ? 'cursor-pointer hover:bg-black/[.03]' : ''}`}
      style={{ color: ink?.muted ?? '#8a9099', borderColor: ink?.rule ?? '#d9d3c2' }}
    >
      {warning && (
        <span className="font-semibold" style={{ color: ink?.warn ?? '#b45309' }}>
          {warning}
          {' · '}
        </span>
      )}
      {children}
    </div>
  )
}

/** Klassen för innehållet: göms på skärm när hopfällt, alltid med vid utskrift */
export const foldBodyClass = (open: boolean) => (open ? '' : 'hidden print:block')
