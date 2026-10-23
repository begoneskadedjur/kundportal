// src/components/technician/ny/dokument/ForlangPaminn.tsx
// Förläng och påminn i ett steg, öppnas i nästa steg-rutan.
//
// 1. Förlänger fristen i Oneflow (OfferFollowUpService.extendSigningPeriod, samma
//    anrop och systemkommentar som ExtendSigningPeriodDialog).
// 2. Om påminnelsen är ikryssad: skickar texten som meddelande i Oneflow
//    (postComment, samma väg som Svar i Oneflow i konversationen) och loggar
//    en systemkommentar så att påminnelsen syns i Aktivitet.

import { useEffect, useMemo, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { sv } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { OfferFollowUpService, type FollowUpOffer } from '../../../../services/offerFollowUpService'
import { createSystemComment } from '../../../../services/communicationService'
import { idagSv, paminnelseText, plusDagar } from './dokumentData'
import { KNAPP_PRIMAR, KNAPP_TYST } from './dokumentUi'

registerLocale('sv', sv)

interface Props {
  offer: FollowUpOffer
  userId: string | null
  userName: string | null
  onStang: () => void
  onKlart: () => void
}

type Val = 7 | 14 | 30 | 'eget'

export function ForlangPaminn({ offer, userId, userName, onStang, onKlart }: Props) {
  const idag = idagSv()
  const [val, setVal] = useState<Val>(14)
  const [eget, setEget] = useState<string | null>(null)
  const [paminn, setPaminn] = useState(true)
  const [redigerad, setRedigerad] = useState(false)
  const datum = val === 'eget' ? eget : plusDagar(idag, val)
  const [text, setText] = useState(() => paminnelseText(offer, plusDagar(idag, 14), userName))
  const [sparar, setSparar] = useState(false)

  // Texten följer datumet tills teknikern har ändrat den själv
  useEffect(() => {
    if (!redigerad && datum) setText(paminnelseText(offer, datum, userName))
  }, [datum, redigerad, offer, userName])

  const imorgon = useMemo(() => new Date(plusDagar(idag, 1) + 'T00:00:00'), [idag])
  const kontakt = offer.contact_person || offer.company_name || 'kunden'
  const vad = offer.type === 'offer' ? 'offerten' : 'avtalet'
  const giltigt = !!datum && datum > idag && (!paminn || text.trim().length > 0)

  const kor = async () => {
    if (!datum || !giltigt || sparar) return
    setSparar(true)
    try {
      await OfferFollowUpService.extendSigningPeriod(offer.id, datum)
      if (userId) {
        createSystemComment(offer.id, 'contract', 'status_change', `Signeringsperiod förlängd till ${datum} av ${userName || 'okänd'}`, userId, userName || 'Okänd')
          .catch(err => console.error('Systemkommentar förlängning:', err))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte förlänga fristen')
      setSparar(false)
      return
    }

    if (paminn) {
      try {
        const body = text.trim()
        const svar = await OfferFollowUpService.postComment(offer.oneflow_contract_id, body)
        await OfferFollowUpService.mirrorPostedComment(offer.oneflow_contract_id, { id: svar?.id ?? svar?.data?.id, body }, { name: userName })
        await OfferFollowUpService.syncConversationFromOneflow(offer.oneflow_contract_id)
        if (userId) {
          createSystemComment(offer.id, 'contract', 'status_change', `Påminnelse skickad till kunden i Oneflow av ${userName || 'okänd'}`, userId, userName || 'Okänd')
            .catch(err => console.error('Systemkommentar påminnelse:', err))
        }
        toast.success(`Fristen är förlängd till ${datum} och påminnelsen är skickad`)
      } catch (err) {
        console.error('Påminnelse:', err)
        toast.error(`Fristen är förlängd till ${datum}, men påminnelsen kunde inte skickas`)
      }
    } else {
      toast.success(`Fristen är förlängd till ${datum}`)
    }
    setSparar(false)
    onKlart()
  }

  const knapp = (v: Val, rubrik: string, under: string) => {
    const vald = val === v
    return (
      <button
        key={String(v)}
        type="button"
        aria-pressed={vald}
        onClick={() => setVal(v)}
        className={`min-h-[52px] px-3 py-1.5 flex flex-col items-start justify-center rounded-xl text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
          vald ? 'border-2 border-[#20c58f] bg-[#20c58f]/10' : 'border border-slate-600 bg-slate-900 hover:bg-slate-800'
        }`}
      >
        <span className="text-sm font-semibold text-white">{rubrik}</span>
        <span className="font-mono text-sm text-slate-400">{under}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-900 border border-slate-700">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name="upphandling.forlangning" size={20} className="text-[#20c58f]" />
        Förläng och påminn
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-slate-300">Ny sista dag att signera</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {knapp(7, '7 dagar', plusDagar(idag, 7))}
          {knapp(14, '14 dagar', plusDagar(idag, 14))}
          {knapp(30, '30 dagar', plusDagar(idag, 30))}
          {knapp('eget', 'Välj datum', eget || 'kalender')}
        </div>
        {val === 'eget' && (
          <DatePicker
            selected={eget ? new Date(eget + 'T12:00:00') : null}
            onChange={(d: Date | null) => {
              if (!d) { setEget(null); return }
              setEget(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
            }}
            locale="sv"
            dateFormat="yyyy-MM-dd"
            minDate={imorgon}
            placeholderText="Välj sista dag"
            portalId="datepicker-portal"
            className="w-44 min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-600 text-[15px] text-white placeholder:text-slate-400 focus:outline-none focus:border-[#20c58f]"
          />
        )}
      </fieldset>

      <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={paminn}
          onChange={e => setPaminn(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-600 bg-slate-800 accent-[#20c58f]"
        />
        <span className="flex flex-col gap-0.5 text-sm">
          <span className="font-semibold text-white">Skicka påminnelse till {kontakt}</span>
          <span className="text-slate-400">Går som meddelande i Oneflow, kunden får ett mejl med länk till {vad}.</span>
        </span>
      </label>
      {paminn && (
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setRedigerad(true) }}
          rows={3}
          aria-label="Påminnelsens text"
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950/40 border border-slate-600 text-[15px] leading-relaxed text-white resize-y focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onStang} disabled={sparar} className={`${KNAPP_TYST} h-11`}>Avbryt</button>
        <button type="button" onClick={kor} disabled={!giltigt || sparar} className={`${KNAPP_PRIMAR} disabled:opacity-60`}>
          {sparar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name={paminn ? 'rapport.skicka' : 'upphandling.forlangning'} size={20} />}
          {paminn ? 'Förläng och skicka påminnelse' : 'Förläng fristen'}
        </button>
      </div>
    </div>
  )
}

export default ForlangPaminn
