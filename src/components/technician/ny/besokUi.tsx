// src/components/technician/ny/besokUi.tsx
// Små delar som Idag, Karta och Mina ärenden delar: statuspunkt och
// knapparna Navigera, Ring och Öppna.

import type { ReactNode } from 'react'
import { Icon } from '../../icons/Icon'
import { navigeraUrl, telUrl, type DagBesok } from '../../../services/teknikerDagService'
import type { Ton } from './besokTyp'


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
  gra: 'text-slate-400',
}

/** Status som platt text med punkt, aldrig piller */
export function StatusPunkt({ ton, children, className = '' }: { ton: Ton; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${TEXT[ton]} ${className}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${PUNKT[ton]}`} />
      {children}
    </span>
  )
}

const KNAPP_BAS = 'h-[52px] flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]'
const KNAPP_PRIMAR = `${KNAPP_BAS} bg-[#20c58f] text-[#04281c] hover:bg-[#1bb07f]`
const KNAPP_SEKUNDAR = `${KNAPP_BAS} border border-slate-600 bg-slate-900 text-white hover:bg-slate-800`
const KNAPP_AV = `${KNAPP_BAS} border border-slate-700 text-slate-500 cursor-not-allowed`

/** Navigera, Ring och Öppna. Saknas adress eller telefon visas knappen avstängd. */
export function BesokKnappar({ besok, onOppna }: { besok: DagBesok; onOppna: () => void }) {
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
      {besok.adress ? (
        <a href={navigeraUrl(besok.adress)} target="_blank" rel="noopener noreferrer" className={KNAPP_PRIMAR}>
          <Icon name="falt.navigera" size={20} />
          Navigera
        </a>
      ) : (
        <span className={KNAPP_AV} aria-disabled="true" title="Adress saknas">
          <Icon name="falt.navigera" size={20} />
          Navigera
        </span>
      )}
      {besok.telefon ? (
        <a href={telUrl(besok.telefon)} className={KNAPP_SEKUNDAR} aria-label={`Ring ${besok.kontaktperson || besok.kund}`}>
          <Icon name="kontakt.telefon" size={20} />
          Ring
        </a>
      ) : (
        <span className={KNAPP_AV} aria-disabled="true" title="Telefonnummer saknas">
          <Icon name="kontakt.telefon" size={20} />
          Ring
        </span>
      )}
      <button type="button" onClick={onOppna} className={KNAPP_SEKUNDAR}>
        <Icon name="arende.arende" size={20} />
        Öppna
      </button>
    </div>
  )
}
