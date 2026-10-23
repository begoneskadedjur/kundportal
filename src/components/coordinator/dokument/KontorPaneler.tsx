// src/components/coordinator/dokument/KontorPaneler.tsx
// Paneler i nästa steg-rutan i kontorets dokumentdetalj.
//
// PaminnTekniker: förhandsvisning av notisen och Skicka påminnelsen
//   (bokaInService.paminnTekniker). Påminnelsen blir en post i kontaktloggen
//   via en systemkommentar på dokumentet.
// SkrivAv: anledning (fast lista plus fritext vid Annat), sätter dismissed_at och
//   anledningen i coordinator_notes. Dokumentet flyttas till Klara och anledningen
//   blir en post i kontaktloggen.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../icons/Icon'
import type { FollowUpOffer } from '../../../services/offerFollowUpService'
import { KNAPP_PRIMAR, KNAPP_TYST } from '../../technician/ny/dokument/dokumentUi'
import { SKRIV_AV_ANLEDNINGAR, dokTekniker, fornamn, skickaPaminnelse, skrivAvMedAnledning } from './kontorData'

const RUTA = 'flex flex-col gap-3 p-4 rounded-xl bg-slate-900 border border-slate-700'

/** Notisens text, samma som paminnTekniker skriver */
function notisText(o: FollowUpOffer, avsandare: string): { rubrik: string; text: string } {
  const dokument = `${o.type === 'contract' ? 'avtal' : 'offert'} ${o.quote_reference_number || o.oneflow_contract_id || ''}`.trim()
  const kund = o.company_name || o.contact_person || 'kunden'
  return {
    rubrik: `Påminnelse: följ upp ${dokument}, ${kund}`,
    text: `${avsandare} vill att du följer upp ${dokument} till ${kund}. Öppna dokumentet i Dokumentsignering.`,
  }
}

export function PaminnTekniker({ offer, userId, userName, onStang, onKlart }: {
  offer: FollowUpOffer
  userId: string | null
  userName: string | null
  onStang: () => void
  onKlart: () => void
}) {
  const [skickar, setSkickar] = useState(false)
  const t = dokTekniker(offer)
  const namn = fornamn(t.namn) || 'teknikern'
  const notis = notisText(offer, userName || 'Kontoret')

  const skicka = async () => {
    if (!userId || skickar) return
    setSkickar(true)
    try {
      const mottagare = await skickaPaminnelse(offer, userId, userName || 'Kontoret')
      toast.success(`${fornamn(mottagare) || 'Teknikern'} har fått påminnelsen`)
      onKlart()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skicka påminnelsen')
    } finally {
      setSkickar(false)
    }
  }

  return (
    <div className={RUTA}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name="upphandling.notis" size={20} className="text-[#20c58f]" />
        Påminnelsen till {namn}
      </p>
      <p className="text-sm text-slate-300">
        Går som notis i portalen och öppnar dokumentet i {namn}s Dokumentsignering.
      </p>
      <div className="px-3.5 py-3 rounded-xl bg-slate-950/40 border border-slate-700">
        <p className="text-sm font-semibold text-white">{notis.rubrik}</p>
        <p className="text-sm text-slate-300">{notis.text}</p>
      </div>
      <p className="text-sm text-slate-400">Påminnelsen blir en post i kontaktloggen.</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onStang} disabled={skickar} className={`${KNAPP_TYST} h-11`}>Avbryt</button>
        <button type="button" onClick={skicka} disabled={skickar || !userId} className={`${KNAPP_PRIMAR} disabled:opacity-60`}>
          {skickar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="upphandling.notis" size={20} />}
          Skicka påminnelsen
        </button>
      </div>
    </div>
  )
}

const VAL = (vald: boolean) => `min-h-[44px] px-3 rounded-xl border text-sm font-medium text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
  vald ? 'border-[#20c58f] bg-[#20c58f]/15 text-white' : 'border-slate-600 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
}`

export function SkrivAv({ offer, userId, onStang, onKlart }: {
  offer: FollowUpOffer
  userId: string | null
  onStang: () => void
  onKlart: () => void
}) {
  const [val, setVal] = useState<(typeof SKRIV_AV_ANLEDNINGAR)[number] | null>(null)
  const [fritext, setFritext] = useState('')
  const [sparar, setSparar] = useState(false)
  const anledning = val === 'Annat' ? fritext.trim() : val ? [val, fritext.trim()].filter(Boolean).join('. ') : ''
  const klar = !!anledning && !!userId

  const spara = async () => {
    if (!klar || !userId || sparar) return
    setSparar(true)
    try {
      await skrivAvMedAnledning(offer.id, anledning, userId)
      toast.success('Dokumentet är avskrivet och flyttat till Klara')
      onKlart()
    } catch (err) {
      console.error('Skriv av:', err)
      toast.error('Kunde inte skriva av dokumentet')
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className={RUTA}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name="allman.arkiv" size={20} className="text-slate-300" />
        Skriv av {offer.company_name || offer.contact_person || 'dokumentet'}
      </p>
      <p className="text-sm text-slate-300">För döda affärer. Dokumentet flyttas till Klara och anledningen blir en post i kontaktloggen.</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-slate-300">Anledning</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SKRIV_AV_ANLEDNINGAR.map(a => (
            <button key={a} type="button" aria-pressed={val === a} onClick={() => setVal(a)} className={VAL(val === a)}>{a}</button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-slate-300">{val === 'Annat' ? 'Beskriv anledningen' : 'Kommentar, valfri'}</span>
        <textarea
          value={fritext}
          onChange={e => setFritext(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950/40 border border-slate-600 text-[15px] text-white placeholder:text-slate-500 resize-y focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
        />
      </label>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onStang} disabled={sparar} className={`${KNAPP_TYST} h-11`}>Avbryt</button>
        <button type="button" onClick={spara} disabled={!klar || sparar} className={`${KNAPP_PRIMAR} disabled:opacity-60`}>
          {sparar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="allman.arkiv" size={20} />}
          Skriv av
        </button>
      </div>
    </div>
  )
}
