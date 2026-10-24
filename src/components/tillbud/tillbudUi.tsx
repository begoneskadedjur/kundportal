// src/components/tillbud/tillbudUi.tsx
// Små delar för Tillbud och avvikelser: status och typ som punkt eller ikon och
// text (aldrig piller), typens rund-ikon och fältklasser.

import type { ReactNode } from 'react'
import { Icon } from '../icons/Icon'
import type { IncidentStatus, IncidentType } from '../../types/caseIncidents'
import { STATUS_TON, TON_PUNKT, TON_TEXT, TYP_IKON, TYP_TON, statusText, typText, type Ton } from './tillbudLogik'

export function PunktText({ ton, children, className = '' }: { ton: Ton; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium leading-snug ${TON_TEXT[ton]} ${className}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${TON_PUNKT[ton]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export function StatusPunkt({ status }: { status: IncidentStatus }) {
  return <PunktText ton={STATUS_TON[status] || 'gra'}>{statusText(status)}</PunktText>
}

/** Typens ikon i en rund ruta, i typens färg */
export function TypRund({ typ, stor = false }: { typ: IncidentType; stor?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`${stor ? 'w-11 h-11' : 'w-9 h-9'} flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center ${TON_TEXT[TYP_TON[typ]]}`}
    >
      <Icon name={TYP_IKON[typ]} size={stor ? 24 : 20} />
    </span>
  )
}

export function TypText({ typ, className = '' }: { typ: IncidentType; className?: string }) {
  return <span className={`font-semibold ${TON_TEXT[TYP_TON[typ]]} ${className}`}>{typText(typ)}</span>
}

export const FALT =
  'w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-600 bg-slate-950 text-[15px] text-white placeholder-slate-500 focus:outline-none focus:border-[#20c58f] focus-visible:ring-2 focus-visible:ring-[#20c58f]/40'

export const TEXTRUTA = `${FALT} resize-y leading-relaxed`

export const ETIKETT = 'block text-sm font-medium text-slate-300 mb-1.5'

export const VALFRITT = 'font-normal text-slate-500'

export function StegRubrik({ nr, children }: { nr: number; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-white">
      <span aria-hidden="true" className="w-7 h-7 rounded-full border border-slate-600 text-sm font-semibold text-slate-300 flex items-center justify-center font-mono">{nr}</span>
      {children}
    </h3>
  )
}
