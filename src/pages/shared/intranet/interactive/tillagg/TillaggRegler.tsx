// src/pages/shared/intranet/interactive/tillagg/TillaggRegler.tsx
// Guiden Besluta och fakturera tilläggsstationer: vad som händer med ett tillägg
// beroende på avtalets Tilläggsregler (Som tidigare eller Följer premien), hur
// premien faktureras och om ärendet där stationen sattes ut fortfarande är öppet.
// Fakta kontrollerade mot koden 2026-11-02 (tillägg per månad och delvis
// täckta stationer 2026-11-03): ContractBillingModePanel,
// sync_addon_prorata_line (legacy och v2), addonPlanV2 (addonCadence, addonCadenceFor),
// contract_work_items_internal (gap_invoice) och ContractSettingsDrawer
// (Tilläggen faktureras). Platt text med statuspunkt, inga piller.

import { useState } from 'react'

type Regler = 'v2' | 'legacy'
type Takt = 'manad' | 'period' | 'ingen'

const VAL = 'flex min-h-[40px] items-center gap-2 text-sm text-slate-200 cursor-pointer'
const RADIO = 'h-3.5 w-3.5 border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]'

function Steg({ rubrik, text, ton }: { rubrik: string; text: string; ton: 'ok' | 'warn' | 'muted' }) {
  const prick = ton === 'ok' ? 'bg-[#20c58f]' : ton === 'warn' ? 'bg-amber-400' : 'bg-slate-500'
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${prick}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{rubrik}</p>
        <p className="text-sm leading-relaxed text-slate-200">{text}</p>
      </div>
    </div>
  )
}

export default function TillaggRegler() {
  const [regler, setRegler] = useState<Regler>('v2')
  const [takt, setTakt] = useState<Takt>('period')
  const [stangt, setStangt] = useState(false)

  const v2 = regler === 'v2'
  const fore = v2
    ? 'Ingen pro rata. Raden Tillägg att besluta står i arbetslistan tills någon beslutar.'
    : 'Pro rata läggs på enhetens öppna ärende redan när stationen sätts ut, även innan någon har beslutat.'
  const forsta = !v2
    ? 'Pro rata för första perioden faktureras när ärendet stängs, under Merförsäljning Avtal.'
    : stangt
      ? 'Arbetslistan visar Faktura att skapa. Planera fakturor, eller nattkörningen, skapar en faktura av typen Tillägg från utsättning för dagarna fram till nästa periodstart.'
      : 'Pro rata läggs på ärendet där stationen sattes ut, för dagarna fram till nästa periodstart. Den faktureras när ärendet stängs.'
  const sedan = !v2
    ? 'Per år: egen tilläggsfaktura i samband med årsfakturan. Per månad: egen faktura varje månad. Teknikerns val per år eller per månad styr, inte premien.'
    : takt === 'manad'
      ? 'På premiens månadsfaktura, årspriset delat med tolv. Ingen egen tilläggsfaktura. Enhetens namn står på raden.'
      : takt === 'period'
        ? 'Per år: egen tilläggsfaktura för samma period som premien, en per enhetens referenskod, och enhetens namn står på varje rad. Per månad: egen faktura varje månad. En station som redan är betald för en del av perioden faktureras bara för resten.'
        : 'Per år: egen tilläggsfaktura en gång per år, på avtalsdagen, en per enhetens referenskod, och enhetens namn står på varje rad. Per månad: egen faktura varje månad. En station som redan är betald för en del av perioden faktureras bara för resten.'

  return (
    <div className="my-6 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <p className="text-sm font-semibold text-white">Vad händer med tillägget?</p>
      <p className="mt-0.5 text-sm text-slate-400">
        Välj som på avtalet. Tilläggsregler står i avtalskartans panel under Fakturering.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-slate-400">Tilläggsregler</legend>
          <label className={VAL}><input type="radio" className={RADIO} checked={v2} onChange={() => setRegler('v2')} />Följer premien</label>
          <label className={VAL}><input type="radio" className={RADIO} checked={!v2} onChange={() => setRegler('legacy')} />Som tidigare</label>
        </fieldset>
        <fieldset disabled={!v2} className={v2 ? '' : 'opacity-50'}>
          <legend className="mb-1 text-xs font-medium text-slate-400">Premien faktureras</legend>
          <label className={VAL}><input type="radio" className={RADIO} checked={takt === 'manad'} onChange={() => setTakt('manad')} />Månadsvis</label>
          <label className={VAL}><input type="radio" className={RADIO} checked={takt === 'period'} onChange={() => setTakt('period')} />Kvartal, halvår eller år</label>
          <label className={VAL}><input type="radio" className={RADIO} checked={takt === 'ingen'} onChange={() => setTakt('ingen')} />Ingen premie</label>
        </fieldset>
        <fieldset disabled={!v2} className={v2 ? '' : 'opacity-50'}>
          <legend className="mb-1 text-xs font-medium text-slate-400">När du beslutar är ärendet</legend>
          <label className={VAL}><input type="radio" className={RADIO} checked={!stangt} onChange={() => setStangt(false)} />Fortfarande öppet</label>
          <label className={VAL}><input type="radio" className={RADIO} checked={stangt} onChange={() => setStangt(true)} />Redan stängt</label>
        </fieldset>
      </div>

      <div className="mt-3 divide-y divide-slate-700/60 border-y border-slate-700/60">
        <Steg rubrik="När teknikern har satt ut stationen" text={fore} ton={v2 ? 'warn' : 'muted'} />
        <Steg rubrik="Första perioden" text={forsta} ton="ok" />
        <Steg rubrik="Sedan, så länge avtalet gäller" text={sedan} ton="ok" />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {v2
          ? 'Är nästa periods tilläggsfaktura redan skickad utan stationen räknas första perioden till perioden därefter. Pro rata kapas när ett uppsagt avtal slutar.'
          : 'Som tidigare gäller alla avtal som inte har ställts om. De fungerar precis som förut.'}
      </p>
    </div>
  )
}
