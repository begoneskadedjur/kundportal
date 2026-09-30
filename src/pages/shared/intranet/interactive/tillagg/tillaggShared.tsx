// src/pages/shared/intranet/interactive/tillagg/tillaggShared.tsx
// Gemensamt för guiden Tilläggsstationer: rollerna med färg, rolletiketten
// (platt text med statuspunkt, aldrig piller) och ramen runt skärmbilderna.
//
// Skärmbilderna i guiden är statiska illustrationer i portalens stil. De
// räknar ingenting själva: beloppen i räkneexemplet kommer från
// src/shared/addonEconomics.ts, samma modul som portalen använder.

import type { ReactNode } from 'react'

import { ROLE_CONFIG, type TillaggRole } from './tillaggRoles'

/** "● Tekniker" som platt text med färgad punkt */
export function RoleTag({ role, className = '' }: { role: TillaggRole; className?: string }) {
  const r = ROLE_CONFIG[role]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${r.text} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${r.dot} flex-shrink-0`} aria-hidden />
      {r.label}
    </span>
  )
}

/**
 * Ram runt en skärmbild: liten fönsterlist med var i portalen bilden kommer
 * ifrån. Innehållet är statiskt och går inte att klicka i.
 */
export function MiniScreen({ where, children, caption }: { where: string; children: ReactNode; caption?: string }) {
  return (
    <figure className="mt-3">
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden select-none" aria-label={`Förenklad bild: ${where}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border-b border-slate-700">
          <span className="flex gap-1" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          </span>
          <span className="text-[11px] text-slate-400 truncate">{where}</span>
        </div>
        <div className="p-3 pointer-events-none">{children}</div>
      </div>
      <figcaption className="mt-1.5 text-xs text-slate-500">
        Förenklad bild.{caption ? ` ${caption}` : ''}
      </figcaption>
    </figure>
  )
}

/** Sektion i portalens kompakta standard (samma som i modalerna) */
export const SECTION = 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl'
export const SUB_SECTION = 'p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl'

/** Ett "fält" i en skärmbild: ser ut som portalens inmatning men är text */
export function FakeInput({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-end px-2 py-0.5 bg-slate-800 border border-slate-600 rounded-md text-xs text-slate-200 tabular-nums ${className}`}>
      {value}
    </span>
  )
}

/** Radioknapp i en skärmbild */
export function FakeRadio({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex w-3.5 h-3.5 rounded-full border flex-shrink-0 items-center justify-center ${checked ? 'border-[#20c58f]' : 'border-slate-600'}`}
      aria-hidden
    >
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />}
    </span>
  )
}

/** Kryssruta i en skärmbild */
export function FakeCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex w-3.5 h-3.5 rounded border flex-shrink-0 items-center justify-center text-[9px] leading-none ${checked ? 'bg-[#20c58f] border-[#20c58f] text-[#fff]' : 'border-slate-600'}`}
      aria-hidden
    >
      {checked ? '✓' : ''}
    </span>
  )
}

/** Punktlista i stegens text */
export function Punkter({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] mt-2 flex-shrink-0" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Varningsrad i bärnsten med statuspunkt */
export function Obs({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 text-sm leading-relaxed text-amber-400">
      <span aria-hidden>● </span>
      {children}
    </p>
  )
}

/** Fetstil i stegens text */
export const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>
