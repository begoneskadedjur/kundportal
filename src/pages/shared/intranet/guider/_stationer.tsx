// src/pages/shared/intranet/guider/_stationer.tsx
// Delade delar för guiderna om stationer, kontroller och tilläggsstationer:
// stationstyperna med portalens färg och ikon (station_types, 2026-10-16),
// förenklad karta och planritning, typrutorna i utsättningsformuläret och
// telefonens sidhuvud. Ingen modul, filen hittas inte av registret (börjar med _).

import type { ReactNode } from 'react'
import { StationIcon } from '../../../../components/shared/stationIcons'
import { Markor, type MarkorProps } from '../skarmkit'

export interface StationTyp {
  namn: string
  farg: string
  ikon: string
}

/** Aktiva stationstyper i portalen, samma färg och ikon som station_types */
export const TYPER = {
  mekanisk: { namn: 'Mekanisk fälla', farg: '#3b82f6', ikon: 'mekanisk-falla' },
  betong: { namn: 'Betongstation', farg: '#1f2937', ikon: 'betongstation' },
  betes: { namn: 'Betesstation', farg: '#6b7280', ikon: 'af-multis' },
  plat: { namn: 'Plåtstation', farg: '#06b6d4', ikon: 'platstation' },
  ljus: { namn: 'Ljusfälla', farg: '#eab308', ikon: 'ljusfalla' },
  krypande: { namn: 'Klisterfälla Krypande', farg: '#14b8a6', ikon: 'klisterfalla-krypande' },
} as const satisfies Record<string, StationTyp>

export type TypNyckel = keyof typeof TYPER

/** Markör i markören-stil: färgad cirkel med stationstypens ikon */
export function StationPunkt({ typ, storlek = 22, tillagg, ny }: { typ: StationTyp; storlek?: number; tillagg?: boolean; ny?: boolean }) {
  return (
    <span className="relative inline-flex flex-none" aria-hidden>
      <span
        className={`flex items-center justify-center rounded-full border-2 text-[#fff] shadow ${ny ? 'border-[#20c58f] ring-2 ring-[#20c58f]/40' : 'border-white'}`}
        style={{ backgroundColor: typ.farg, width: storlek, height: storlek }}
      >
        <StationIcon name={typ.ikon} className="h-[60%] w-[60%]" />
      </span>
      {tillagg && (
        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[8px] font-bold leading-none text-slate-900">+</span>
      )}
    </span>
  )
}

export interface KartPunkt {
  x: number
  y: number
  typ: StationTyp
  tillagg?: boolean
  ny?: boolean
  nedtonad?: boolean
}

/** Förenklad karta: ett kvarter med vägar och stationspunkter i procent */
export function Karta({ punkter, hojd = 150, children, onClick }: { punkter: KartPunkt[]; hojd?: number; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700 bg-[#1d2b24]" style={{ height: hojd }} onClick={onClick}>
      <div className="absolute inset-y-0 left-[38%] w-3 bg-slate-600/60" aria-hidden />
      <div className="absolute inset-x-0 top-[62%] h-3 bg-slate-600/60" aria-hidden />
      <div className="absolute left-[8%] top-[12%] h-[38%] w-[24%] rounded-sm bg-slate-500/40" aria-hidden />
      <div className="absolute left-[50%] top-[10%] h-[40%] w-[40%] rounded-sm bg-slate-500/40" aria-hidden />
      <div className="absolute left-[52%] top-[72%] h-[20%] w-[30%] rounded-sm bg-slate-500/30" aria-hidden />
      {punkter.map((p, i) => (
        <span key={i} className={`absolute -translate-x-1/2 -translate-y-1/2 ${p.nedtonad ? 'opacity-35' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <StationPunkt typ={p.typ} storlek={p.nedtonad ? 14 : 20} tillagg={p.tillagg} ny={p.ny} />
        </span>
      ))}
      {children}
    </div>
  )
}

/** Förenklad planritning: rum med väggar och stationspunkter i procent */
export function Planritning({ punkter, hojd = 150, children, onClick }: { punkter: KartPunkt[]; hojd?: number; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-600 bg-slate-100" style={{ height: hojd }} onClick={onClick}>
      <div className="absolute inset-2 border-2 border-slate-500" aria-hidden />
      <div className="absolute bottom-2 left-[45%] top-2 border-l-2 border-slate-500" aria-hidden />
      <div className="absolute left-2 right-[55%] top-[55%] border-t-2 border-slate-500" aria-hidden />
      <span className="absolute left-[12%] top-[20%] text-[9px] text-slate-500" aria-hidden>Lager</span>
      <span className="absolute left-[60%] top-[20%] text-[9px] text-slate-500" aria-hidden>Kök</span>
      <span className="absolute left-[12%] top-[70%] text-[9px] text-slate-500" aria-hidden>Kontor</span>
      {punkter.map((p, i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <StationPunkt typ={p.typ} storlek={18} tillagg={p.tillagg} ny={p.ny} />
        </span>
      ))}
      {children}
    </div>
  )
}

/** Typrutan i utsättningsformuläret: cirkel i typens färg och namnet under */
export function TypRuta({ typ, vald, nedtonad, onClick, markor }: { typ: StationTyp; vald?: boolean; nedtonad?: boolean; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className={`grid w-full justify-items-center gap-1 rounded-xl border-2 p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/50'} ${nedtonad ? 'opacity-40' : ''}`}>
        <StationPunkt typ={typ} storlek={28} />
        <span className={`text-center text-[11px] font-medium leading-tight ${vald ? 'text-[#20c58f]' : 'text-slate-300'}`}>{typ.namn}</span>
      </button>
    </Markor>
  )
}

/** Sidhuvud i telefonens dialoger: titel, rad under och ett kryss */
export function ArkHuvud({ titel, under, onStang }: { titel: string; under?: ReactNode; onStang?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-slate-700 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{titel}</p>
        {under && <p className="truncate text-[11px] text-slate-400">{under}</p>}
      </div>
      {onStang && (
        <button type="button" onClick={onStang} aria-label="Stäng" className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      )}
    </div>
  )
}

/** Stort valkort med ikon till vänster, som Utomhus och Inomhus i Välj typ */
export function StortVal({ titel, text, ikon, onClick, markor }: { titel: string; text: string; ikon: ReactNode; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-700/60 text-slate-200">{ikon}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-white">{titel}</span>
          <span className="block text-[11px] text-slate-400">{text}</span>
        </span>
      </button>
    </Markor>
  )
}

/** Lokala ikoner enligt ikonstandarden (24 × 24, linje 1,6, currentColor) */
export function LokalIkon({ namn, storlek = 20 }: { namn: 'nal' | 'hus' | 'gps' | 'karta' | 'kamera' | 'plus'; storlek?: number }) {
  const p: Record<typeof namn, ReactNode> = {
    nal: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
    hus: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
    gps: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.8" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
    karta: <><path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
    kamera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.3" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
  }
  return (
    <svg viewBox="0 0 24 24" width={storlek} height={storlek} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[namn]}
    </svg>
  )
}

/** Två stora knappar bredvid varandra, som Hämta GPS och Välj på karta */
export function Dubbelknapp({ titel, ikon, klar, onClick, markor }: { titel: string; ikon: ReactNode; klar?: boolean; onClick?: () => void; markor?: MarkorProps }) {
  return (
    <Markor markor={markor} block>
      <button type="button" onClick={onClick}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 p-2 text-[11.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${klar ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slate-700 bg-slate-800/50 text-slate-300'}`}>
        {ikon}
        {titel}
      </button>
    </Markor>
  )
}
