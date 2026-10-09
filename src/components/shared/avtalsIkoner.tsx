// src/components/shared/avtalsIkoner.tsx
// Ikonserien i avtalswizarden: duoton, viewBox 48, streck 1,75 med rundade ändar
// och en tonad fyllnad på en del av formen.
//
// Tema: strecket är currentColor och sätts med en färgklass som remappas i ljust
// läge (text-emerald-300 blir mörkgrön i ljust, ljust mintgrön i mörkt). Fyllnaderna
// är Tailwind-klasser: "papper" är fill-slate-900 (vitt i ljust, kortytans mörka ton
// i mörkt) och tonen är en genomskinlig accent som fungerar på båda bottnarna.
// Därför ser ikonerna lika lugna ut i båda temana, utan hårdkodade ljusa ytor.

import type { ReactElement, ReactNode } from 'react'

export type IkonTon = 'gron' | 'bla' | 'orange'

/** Färgklasser per ton: streck för själva ikonen, ruta för den tonade bakgrunden. */
export const IKON_TON: Record<IkonTon, { streck: string; ruta: string; rutaVald: string }> = {
  gron: { streck: 'text-emerald-300', ruta: 'bg-[#20c58f]/10', rutaVald: 'bg-[#20c58f]/20' },
  bla: { streck: 'text-blue-300', ruta: 'bg-blue-400/10', rutaVald: 'bg-blue-400/20' },
  orange: { streck: 'text-orange-300', ruta: 'bg-orange-400/10', rutaVald: 'bg-orange-400/20' },
}

// Fyllnader
const PAPPER = 'fill-slate-900'
const GRON = 'fill-[#20c58f]/25'
const BLA = 'fill-blue-400/25'
const ORANGE = 'fill-orange-400/25'
const GRA = 'fill-slate-700'
const SAND = 'fill-amber-400/20'
const ACCENT = 'fill-[#20c58f]'
const PRICK = 'fill-current'

export interface IkonProps {
  /** Pixelstorlek (bredd = höjd). */
  size?: number
  /** Extra klasser. En text-färgklass här ersätter tonens streckfärg. */
  className?: string
}

type IkonKomponent = (p: IkonProps) => ReactElement

function Svg({ size = 48, className = '', streck, strokeWidth = 1.75, children }: IkonProps & {
  streck: string
  strokeWidth?: number
  children: ReactNode
}) {
  // En egen text-färg i className vinner över tonens
  const farg = /(^|\s)text-(\[#|[a-z]+-\d)/.test(className) ? '' : streck
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${farg} ${className}`}
    >
      {children}
    </svg>
  )
}

// --- Dokumenttyp ------------------------------------------------------------

export function DokumentAvtalIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M12 6h17l9 9v25a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" className={PAPPER} />
      <path d="M29 6v9h9" className={GRON} />
      <path d="M16 20h14M16 25h14M16 30h8" />
      <path d="M17 37c2-3 3.5-3 4.5-.5s2.5 2.5 4.5-1" className="stroke-[#20c58f]" />
      <circle cx="33" cy="35" r="4.5" className={ACCENT} />
    </Svg>
  )
}

export function DokumentOffertIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.bla.streck}>
      <path d="M10 8a2 2 0 0 1 2-2h18l8 8v26a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" className={PAPPER} />
      <path d="M16 18h12M16 23h16M16 28h10" />
      <path d="M24 34.5l6.5-6.5h8.5v8.5L32.5 43z" className={BLA} />
      <circle cx="35.5" cy="31.5" r="1.4" className={PRICK} />
    </Svg>
  )
}

// --- Mallar -----------------------------------------------------------------

export function SkadedjursavtalIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M24 5l15 6v11c0 10-6.5 17-15 21C15.5 39 9 32 9 22V11z" className={GRON} />
      <path d="M17 24l5 5 9-10" />
    </Svg>
  )
}

export function BetesstationIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M8 20l4-8h24l4 8" className={PAPPER} />
      <rect x="8" y="20" width="32" height="18" rx="3" className={GRON} />
      <path d="M14 38v-6a3 3 0 0 1 6 0v6M28 38v-6a3 3 0 0 1 6 0v6" />
      <path d="M20 15.5h8" />
    </Svg>
  )
}

export function BetongstationIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M7 38V18l17-9 17 9v20z" className={GRA} />
      <path d="M19 38v-7a5 5 0 0 1 10 0v7" className={PAPPER} />
      <path d="M12 24h3M33 24h3M14 30h2M32 31h2" />
      <path d="M4 38h40" />
    </Svg>
  )
}

export function IndikationsfallaIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M6 34l18-20 18 20z" className={SAND} />
      <path d="M14 34l10-11 10 11" className={PAPPER} />
      <circle cx="21" cy="30" r="1.2" className={PRICK} />
      <circle cx="26.5" cy="31.5" r="1.2" className={PRICK} />
      <circle cx="24" cy="27" r="1.2" className={PRICK} />
      <path d="M4 34h40" />
    </Svg>
  )
}

export function MekaniskFallaIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <rect x="6" y="18" width="36" height="16" rx="2.5" className={SAND} />
      <path d="M12 18v-2a6 6 0 0 1 6-6h4" />
      <path d="M12 18h18" />
      <circle cx="33" cy="26" r="3" className={PAPPER} />
      <path d="M14 26h12M10 34v4M38 34v4" />
    </Svg>
  )
}

// --- Avtalspart -------------------------------------------------------------

export function ForetagIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck}>
      <path d="M9 42V12l15-6v36" className={PAPPER} />
      <path d="M24 42V16h15v26" className={GRON} />
      <path d="M14 15h5M14 21h5M14 27h5M14 33h5M29 22h5M29 28h5M29 34h5" />
      <path d="M5 42h38" />
    </Svg>
  )
}

export function PrivatpersonIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.orange.streck}>
      <circle cx="24" cy="17" r="7.5" className={PAPPER} />
      <path d="M10 41c1.5-8 7-12.5 14-12.5S36.5 33 38 41z" className={ORANGE} />
    </Svg>
  )
}

// --- Kundgrupper (streck 2 eftersom de visas mindre) -------------------------

export function BrfIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <path d="M6 40V22l9-7 9 7v18M24 40V22l9-7 9 7v18" className={GRON} />
      <path d="M13 40v-8h4v8M31 40v-8h4v8M4 40h40" />
    </Svg>
  )
}

export function BostadRegionalIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <rect x="10" y="8" width="28" height="32" rx="2" className={GRON} />
      <path d="M16 15h4M28 15h4M16 22h4M28 22h4M16 29h4M28 29h4M21 40v-5h6v5M5 40h38" />
    </Svg>
  )
}

export function BostadRiksIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <rect x="6" y="14" width="18" height="26" rx="2" className={PAPPER} />
      <rect x="24" y="6" width="18" height="34" rx="2" className={GRON} />
      <path d="M11 21h3M17 21h2M11 28h3M17 28h2M29 13h3M36 13h2M29 20h3M36 20h2M29 27h3M36 27h2M4 40h40" />
    </Svg>
  )
}

export function KommersiellRegionalIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <path d="M14 40V6h20v34" className={GRON} />
      <path d="M19 12h10M19 18h10M19 24h10M19 30h10M22 40v-5h4v5M6 40h36" />
    </Svg>
  )
}

export function KommersiellRiksIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <path d="M8 40V16h12v24M20 40V6h20v34" className={GRON} />
      <path d="M25 12h10M25 18h10M25 24h10M25 30h10M12 22h4M12 28h4M4 40h40" />
    </Svg>
  )
}

export function HorecaIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <circle cx="24" cy="25" r="11" className={GRON} />
      <circle cx="24" cy="25" r="6" className={PAPPER} />
      <path d="M7 10v8a3 3 0 0 0 3 3v19M10 10v8M13 10v8a3 3 0 0 1-3 3M40 10c-3 2-4 6-4 11h4v19" />
    </Svg>
  )
}

export function ButikIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <path d="M6 18l3-9h30l3 9z" className={GRON} />
      <path d="M8 18v22h32V18M6 18a4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0 4.5 4.5 0 0 0 9 0" />
      <path d="M20 40v-9h8v9" />
    </Svg>
  )
}

/** Rikstäckande eller internationellt företag: jordglob. */
export function RikstackandeIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <circle cx="24" cy="24" r="17" className={GRON} />
      <ellipse cx="24" cy="24" rx="7.5" ry="17" className={PAPPER} />
      <path d="M8 18h32M8 30h32M24 7v34" />
    </Svg>
  )
}

export function LouIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <path d="M6 40h36M9 40V20l15-10 15 10v20" className={GRON} />
      <path d="M14 40V24M20 40V24M28 40V24M34 40V24M9 20h30" />
    </Svg>
  )
}

/** Privatperson som kundgrupp: villa med person. */
export function PrivatKundgruppIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.orange.streck} strokeWidth={2}>
      <path d="M7 22L24 8l17 14v18H7z" className={ORANGE} />
      <circle cx="24" cy="24" r="4" className={PAPPER} />
      <path d="M17 40c.8-5 3.5-7.5 7-7.5s6.2 2.5 7 7.5M4 40h40" />
    </Svg>
  )
}

/** Neutral kundgrupp när namnet inte känns igen: kortregister. */
export function KundgruppIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={IKON_TON.gron.streck} strokeWidth={2}>
      <rect x="7" y="11" width="34" height="27" rx="3" className={GRON} />
      <path d="M7 19h34" />
      <circle cx="15" cy="28" r="3" className={PAPPER} />
      <path d="M22 26h12M22 31h8" />
    </Svg>
  )
}

// --- Val av ikon ------------------------------------------------------------

export interface MallIkonVal {
  Ikon: IkonKomponent
  ton: IkonTon
  /** Kort beskrivning av malltypen när mallen inte har någon egen text. */
  beskrivning: string | null
}

/** Mallens ikon väljs på namnet. Sköld när inget specifikt ord känns igen. */
export function ikonForMall(namn: string): MallIkonVal {
  const n = namn.toLowerCase()
  if (n.includes('betong')) return { Ikon: BetongstationIkon, ton: 'gron', beskrivning: 'Utvändiga stationer i betong' }
  if (n.includes('betes')) return { Ikon: BetesstationIkon, ton: 'gron', beskrivning: 'Gnagare, låsbara betesstationer' }
  if (n.includes('indikation')) return { Ikon: IndikationsfallaIkon, ton: 'gron', beskrivning: 'Övervakning av insekter' }
  if (n.includes('mekanisk')) return { Ikon: MekaniskFallaIkon, ton: 'gron', beskrivning: 'Utan bekämpningsmedel' }
  return { Ikon: SkadedjursavtalIkon, ton: 'gron', beskrivning: null }
}

/** Kundgruppens ikon väljs på gruppnamnet. Neutral ikon när inget känns igen. */
export function ikonForKundgrupp(namn: string): { Ikon: IkonKomponent; ton: IkonTon } {
  const n = namn.toLowerCase()
  const har = (...ord: string[]) => ord.some(o => n.includes(o))
  if (har('privatperson', 'privatkund')) return { Ikon: PrivatKundgruppIkon, ton: 'orange' }
  if (har('brf', 'samfäll', 'bostadsrätt')) return { Ikon: BrfIkon, ton: 'gron' }
  if (har('lou', 'kommun', 'upphand')) return { Ikon: LouIkon, ton: 'gron' }
  if (har('horeca', 'restaurang')) return { Ikon: HorecaIkon, ton: 'gron' }
  if (har('internationell', 'rikstäck')) return { Ikon: RikstackandeIkon, ton: 'gron' }
  if (har('kommersiell', 'fb ')) {
    return har('riks') ? { Ikon: KommersiellRiksIkon, ton: 'gron' } : { Ikon: KommersiellRegionalIkon, ton: 'gron' }
  }
  if (har('bostad', 'fastighet')) {
    return har('riks') ? { Ikon: BostadRiksIkon, ton: 'gron' } : { Ikon: BostadRegionalIkon, ton: 'gron' }
  }
  if (har('företag', 'butik', 'lokal', 'handel')) return { Ikon: ButikIkon, ton: 'gron' }
  return { Ikon: KundgruppIkon, ton: 'gron' }
}
