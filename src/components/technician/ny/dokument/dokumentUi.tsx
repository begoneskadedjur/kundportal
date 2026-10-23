// src/components/technician/ny/dokument/dokumentUi.tsx
// Små delar för Dokumentsignering i nya arbetsvyn: statuspunkt i 14 px och
// knappklasserna (samma som Stationer, 44 px minsta yta).

/* eslint-disable react-refresh/only-export-components -- klasser och komponent hör ihop */
import type { ReactNode } from 'react'
import type { Ton } from '../besokTyp'

export { KNAPP_PRIMAR, KNAPP_SEKUNDAR, KNAPP_TYST, IKONKNAPP, RADKNAPP, RAM_IKONKNAPP, KORT } from '../utrustning/utrustningUi'

const PUNKT: Record<Ton, string> = {
  gron: 'bg-[#20c58f]',
  gul: 'bg-amber-500',
  rod: 'bg-red-500',
  bla: 'bg-sky-500',
  gra: 'bg-slate-500',
}

const TEXT: Record<Ton, string> = {
  gron: 'text-[#20c58f]',
  gul: 'text-amber-500',
  rod: 'text-red-400',
  bla: 'text-sky-400',
  gra: 'text-slate-300',
}

/** Rutans färg i nästa steg efter status. Rött bara för förfallet och mejl som inte kom fram. */
export const RUTA: Record<Ton, string> = {
  gron: 'bg-[#20c58f]/10 border-[#20c58f]/30',
  gul: 'bg-amber-500/10 border-amber-500/30',
  rod: 'bg-red-500/10 border-red-500/30',
  bla: 'bg-sky-500/10 border-sky-500/30',
  gra: 'bg-slate-800/60 border-slate-700',
}

/** Status som platt text med punkt, aldrig piller */
export function Punkt({ ton, children, stor = false, className = '' }: { ton: Ton; children: ReactNode; stor?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-medium leading-snug ${stor ? 'text-[15px]' : 'text-sm'} ${TEXT[ton]} ${className}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${PUNKT[ton]}`} />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export const telUrl = (tel: string) => `tel:${tel.replace(/[\s-]/g, '')}`
