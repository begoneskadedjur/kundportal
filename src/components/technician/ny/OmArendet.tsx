// src/components/technician/ny/OmArendet.tsx
// Ihopfälld rad "Om ärendet" under ett besök i Idag. Ett tryck visar det som hör
// till just det här ärendet (beskrivning till teknikern, rapport i ärendet) och,
// tydligt avskilt, förra besöket hos avtalskunden, som är ett annat ärende och
// ofta en kollegas. Så kan man förbereda sig och packa bilen innan man kör.
// Texten hämtas först när raden fälls ut.

import { useId } from 'react'
import { Icon } from '../../icons/Icon'
import { TYP_ETIKETT, svenskDag, type DagBesok } from '../../../services/teknikerDagService'
import { useArendeText, type ArendeText } from './arendeText'

function Laddar() {
  return (
    <div className="space-y-2 py-1" aria-hidden="true">
      <div className="h-3 w-1/3 rounded bg-slate-800 animate-pulse" />
      <div className="h-3 w-full rounded bg-slate-800 animate-pulse" />
      <div className="h-3 w-4/5 rounded bg-slate-800 animate-pulse" />
    </div>
  )
}

function ForraBesoket({ forra }: { forra: NonNullable<ArendeText['forra']> | null }) {
  return (
    <section aria-label="Förra besöket hos kunden" className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
      <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
        <Icon name="allman.historik" size={16} className="text-slate-400" />
        Förra besöket hos kunden
      </h4>
      {forra ? (
        <>
          <p className="mt-0.5 text-[13px] text-slate-400">
            Annat ärende: {TYP_ETIKETT[forra.typ].toLowerCase()}
            {forra.avslutad && <>, <span className="font-mono">{svenskDag(forra.avslutad)}</span></>}
            {forra.tekniker && <>, {forra.tekniker}</>}
            {forra.arendenummer && <>, <span className="font-mono">{forra.arendenummer}</span></>}
          </p>
          {forra.rapport ? (
            <p className="mt-1.5 text-sm text-slate-300 whitespace-pre-line">{forra.rapport}</p>
          ) : (
            <p className="mt-1.5 text-sm italic text-slate-400">Ingen rapport skriven.</p>
          )}
        </>
      ) : (
        <p className="mt-0.5 text-sm italic text-slate-400">Inga tidigare avslutade besök hos kunden.</p>
      )}
    </section>
  )
}

function Innehall({ besok }: { besok: DagBesok }) {
  const { text, laddar } = useArendeText(besok, true)
  if (laddar || !text) return <Laddar />

  return (
    <div className="space-y-3">
      <section aria-label="Det här ärendet" className="space-y-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
            <Icon name="dok.konversation" size={16} className="text-slate-400" />
            Beskrivning till tekniker
          </h4>
          {text.beskrivning ? (
            <p className="mt-0.5 text-sm text-white whitespace-pre-line">{text.beskrivning}</p>
          ) : (
            <p className="mt-0.5 text-sm italic text-slate-400">Ingen beskrivning från koordinatorn.</p>
          )}
        </div>
        {text.rapport && (
          <div>
            <h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-300">
              <Icon name="arende.arende" size={16} className="text-slate-400" />
              Rapport i det här ärendet
            </h4>
            <p className="mt-0.5 text-sm text-slate-300 whitespace-pre-line">{text.rapport}</p>
          </div>
        )}
      </section>
      {text.forra !== undefined && <ForraBesoket forra={text.forra} />}
    </div>
  )
}

export function OmArendet({ besok, oppen, onVaxla, className = '' }: {
  besok: DagBesok
  oppen: boolean
  onVaxla: () => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={oppen}
        aria-controls={oppen ? id : undefined}
        onClick={onVaxla}
        className="min-h-[44px] flex items-center gap-1.5 text-sm font-semibold text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
      >
        Om ärendet
        <Icon name="allman.chevron" size={16} className={`transition-transform motion-reduce:transition-none ${oppen ? 'rotate-90' : ''}`} />
      </button>
      {oppen && (
        <div id={id} className="mt-1 mb-1 border-l-2 border-[#20c58f] pl-3">
          <Innehall besok={besok} />
        </div>
      )}
    </div>
  )
}
