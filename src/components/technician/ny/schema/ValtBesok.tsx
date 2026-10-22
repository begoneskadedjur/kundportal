// src/components/technician/ny/schema/ValtBesok.tsx
// Valt besök i datorns sidopanel. Öppna ärendet är förstaknappen, Navigera och Ring under.

import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import { TYP_IKON } from '../besokTyp'
import type { Restid } from '../../../../services/restidService'
import {
  TYP_ETIKETT, klockslag, navigeraUrl, telUrl, tidTill, type DagBesok,
} from '../../../../services/teknikerDagService'
import { dagRubrik, kollegor, schemaStatus, visaStationer } from './schemaLogik'
import { ArbetsTid } from './SchemaDelar'

const SEKUNDAR = 'h-11 flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
const AV = 'h-11 flex items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-500 cursor-not-allowed'

interface Props {
  besok: DagBesok | null
  idag: string
  kortid?: Restid | null
  stationer?: number
  minId: string | null
  onOppna: (b: DagBesok) => void
}

export function ValtBesok({ besok: b, idag, kortid, stationer, minId, onOppna }: Props) {
  if (!b) {
    return (
      <section aria-label="Valt besök" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4">
        <p className="text-sm text-slate-400">Välj ett besök i schemat för att se det här.</p>
      </section>
    )
  }
  const st = schemaStatus(b, idag)
  const om = b.dag === idag && !b.avslutad ? tidTill(b.start) : ''
  const med = kollegor(b, minId)
  return (
    <section aria-labelledby="schema-valt-rubrik" data-genomgang="schema-valt" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-3">
      {kortid && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
          <Icon name="falt.bil" size={16} className="text-[#20c58f]" />
          {kortid.minuter} min med bil från förra besöket
        </p>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-xl font-bold text-white">
          {klockslag(b.start) || '--:--'}{b.slut ? ` till ${klockslag(b.slut)}` : ''}
        </p>
        <StatusPunkt ton={st.ton}>{st.text}</StatusPunkt>
      </div>
      {b.dag && <p className="-mt-2 text-[13px] text-slate-400">{dagRubrik(b.dag)}{om ? `, ${om}` : ''}</p>}
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
          <Icon name={TYP_IKON[b.typ]} size={16} />
          {TYP_ETIKETT[b.typ]}
        </p>
        <h3 id="schema-valt-rubrik" className="text-lg font-semibold text-white">{b.kund}</h3>
        <p className="text-sm text-slate-400">{b.adress || 'Adress saknas i ärendet'}</p>
      </div>
      <ul className="space-y-1.5 text-[13px] text-slate-300">
        {visaStationer(b) && !!stationer && (
          <li className="flex items-center gap-2"><Icon name="arende.station" size={16} className="text-slate-400" />{stationer} stationer{b.typ === 'inspection' ? ' att kontrollera' : ''}</li>
        )}
        {(b.typ === 'private' || b.typ === 'business') && b.skadedjur && (
          <li className="flex items-center gap-2"><Icon name="arende.arende" size={16} className="text-slate-400" />{b.skadedjur}</li>
        )}
        {(b.kontaktperson || b.telefon) && (
          <li className="flex items-center gap-2"><Icon name="rapport.person" size={16} className="text-slate-400" />{[b.kontaktperson, b.telefon].filter(Boolean).join(', ')}</li>
        )}
        {med.length > 0 && (
          <li className="flex items-center gap-2"><Icon name="bokning.team" size={16} className="text-slate-400" />Med {med.join(' och ')}</li>
        )}
        {(b.arbeteStartat || b.arbetadeMinuter > 0) && (
          <li className="flex items-center gap-2"><Icon name="allman.klocka" size={16} className="text-slate-400" /><ArbetsTid b={b} /></li>
        )}
        {b.arendenummer && (
          <li className="flex items-center gap-2"><Icon name="arende.arende" size={16} className="text-slate-400" /><span className="font-mono">{b.arendenummer}</span></li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => onOppna(b)}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
      >
        <Icon name="arende.arende" size={20} />
        Öppna ärendet
      </button>
      <div className="grid grid-cols-2 gap-2">
        {b.adress ? (
          <a href={navigeraUrl(b.adress)} target="_blank" rel="noopener noreferrer" className={SEKUNDAR}>
            <Icon name="falt.navigera" size={20} />Navigera
          </a>
        ) : (
          <span className={AV} aria-disabled="true" title="Adress saknas"><Icon name="falt.navigera" size={20} />Navigera</span>
        )}
        {b.telefon ? (
          <a href={telUrl(b.telefon)} className={SEKUNDAR} aria-label={`Ring ${b.kontaktperson || b.kund}`}>
            <Icon name="kontakt.telefon" size={20} />Ring
          </a>
        ) : (
          <span className={AV} aria-disabled="true" title="Telefonnummer saknas"><Icon name="kontakt.telefon" size={20} />Ring</span>
        )}
      </div>
    </section>
  )
}

export default ValtBesok
