// src/components/admin/invoicing/queue/queueUtils.ts
// Färger, format och markeringslogik för arbetslistorna i /admin/fakturering.

/** Statusfärgerna i listorna: punkt och text. */
export type Tone = 'red' | 'orange' | 'green' | 'blue' | 'grey'

export const TONE_DOT: Record<Tone, string> = {
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  green: 'bg-[#20c58f]',
  blue: 'bg-sky-400',
  grey: 'bg-slate-500',
}

export const TONE_TEXT: Record<Tone, string> = {
  red: 'text-red-400',
  orange: 'text-orange-400',
  green: 'text-[#20c58f]',
  blue: 'text-sky-400',
  grey: 'text-slate-400',
}

export const fmtKr = (n: number): string =>
  `${Math.round(n).toLocaleString('sv-SE')} kr`

export const fmtNum = (n: number): string => Math.round(n).toLocaleString('sv-SE')

export const fakturor = (n: number) => `${n} ${n === 1 ? 'faktura' : 'fakturor'}`

/** Markeringslogik för grupperade listor. */
export function groupCheckState(ids: string[], selected: Set<string>) {
  const n = ids.filter((id) => selected.has(id)).length
  return { checked: ids.length > 0 && n === ids.length, indeterminate: n > 0 && n < ids.length }
}

export function toggleGroup(ids: string[], selected: Set<string>): Set<string> {
  const next = new Set(selected)
  const all = ids.length > 0 && ids.every((id) => next.has(id))
  for (const id of ids) {
    if (all) next.delete(id)
    else next.add(id)
  }
  return next
}

export function toggleOne(id: string, selected: Set<string>): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}
