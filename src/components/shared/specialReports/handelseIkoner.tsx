// src/components/shared/specialReports/handelseIkoner.tsx
// Händelseikoner i Specialrapporter (3.54.2): samma teknik som avtalswizardens
// ikonserie (avtalsIkoner.tsx). Duoton, viewBox 48, streck 1,75 med rundade ändar.
// Strecket är currentColor från en färgklass som remappas i ljust tema
// (text-blue-300 blir mörkblå i ljust, ljusblå i mörkt). Papper = fill-slate-900,
// tonerna är genomskinliga accenter som fungerar på båda bottnarna.

import type { ReactElement } from 'react'
import { Svg, type IkonProps } from '../avtalsIkoner'
import type { SpecialReportEventType } from '../../../types/specialReport'

const PAPPER = 'fill-slate-900'

/** Streckfärg per händelsetyp (remappas i ljust tema) */
const HANDELSE_STRECK: Record<SpecialReportEventType, string> = {
  inspektion: 'text-blue-300',
  besok: 'text-emerald-300',
  betning: 'text-amber-300',
  atgard: 'text-violet-300',
  underlev: 'text-cyan-300',
  notering: 'text-slate-400',
  avvikelse: 'text-red-300',
}

/** Inspektion: förstoringsglas */
function InspektionIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.inspektion}>
      <circle cx="21" cy="21" r="12" className="fill-blue-500/15" />
      <path d="M30 30l10 10" />
      <path d="M15 21a6 6 0 0 1 6-6" />
    </Svg>
  )
}

/** Besök: kalender med bock */
function BesokIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.besok}>
      <rect x="8" y="11" width="32" height="29" rx="4" className={PAPPER} />
      <path d="M8 15a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v5H8z" className="fill-[#20c58f]/25" />
      <path d="M16 7v8M32 7v8M18 30l4 4 8-8" />
    </Svg>
  )
}

/** Betning: betesstation */
function BetningIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.betning}>
      <path d="M8 20l4-8h24l4 8" className={PAPPER} />
      <rect x="8" y="20" width="32" height="18" rx="3" className="fill-amber-500/20" />
      <path d="M14 38v-6a3 3 0 0 1 6 0v6M28 38v-6a3 3 0 0 1 6 0v6M20 15.5h8" />
    </Svg>
  )
}

/** Åtgärd: skiftnyckel */
function AtgardIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.atgard}>
      <path
        d="M30 8a9 9 0 0 0-8.6 11.6L9 32a4.2 4.2 0 0 0 6 6l12.4-12.4A9 9 0 0 0 39 17l-5.4 5.4-5.6-1.4-1.4-5.6z"
        className="fill-violet-500/15"
      />
    </Svg>
  )
}

/** Underleverantör: två personer */
function UnderlevIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.underlev}>
      <circle cx="18" cy="17" r="6" className="fill-cyan-500/15" />
      <path d="M7 38a11 11 0 0 1 22 0" className="fill-cyan-500/15" />
      <circle cx="33" cy="19" r="5" />
      <path d="M30 28.5a9 9 0 0 1 11 9.5" />
    </Svg>
  )
}

/** Notering: papper med veck */
function NoteringIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.notering}>
      <path d="M12 7h18l8 8v24a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" className={PAPPER} />
      <path d="M30 7v8h8" className="fill-slate-500/20" />
      <path d="M16 24h16M16 30h10" />
    </Svg>
  )
}

/** Avvikelse: varningstriangel med utropstecken */
function AvvikelseIkon(p: IkonProps) {
  return (
    <Svg {...p} streck={HANDELSE_STRECK.avvikelse}>
      <path d="M24 7L43 40H5z" className="fill-red-500/15" />
      <path d="M24 19v10" />
      <circle cx="24" cy="34" r="1.6" className="fill-current" stroke="none" />
    </Svg>
  )
}

const IKONER: Record<SpecialReportEventType, (p: IkonProps) => ReactElement> = {
  inspektion: InspektionIkon,
  besok: BesokIkon,
  betning: BetningIkon,
  atgard: AtgardIkon,
  underlev: UnderlevIkon,
  notering: NoteringIkon,
  avvikelse: AvvikelseIkon,
}

interface HandelseIkonProps extends IkonProps {
  typ: SpecialReportEventType
}

/** Ikonen för en händelsetyp. Okänd typ visas som notering. */
export function HandelseIkon({ typ, size = 20, className }: HandelseIkonProps) {
  const Ikon = IKONER[typ] ?? NoteringIkon
  return <Ikon size={size} className={className} />
}
