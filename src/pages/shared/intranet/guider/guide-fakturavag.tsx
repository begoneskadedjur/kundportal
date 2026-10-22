// src/pages/shared/intranet/guider/guide-fakturavag.tsx
// Guidemodul: Välj fakturaväg för en kund (koordinator och admin, dator).
// Etiketterna kommer från InvoiceDeliveryPanel (Fakturaväg, Hur ska kunden få fakturan?,
// E-post / E-faktura / Brev, hjälptexterna under valen, Fakturamejl, Fakturaadress,
// Er referens (valfritt), Spara och uppdatera Fortnox, Ändra fakturaväg, Satt av ...),
// InvoiceDetailModal (rutan under pulsraden, spärrindikatorn "att kontrollera ·
// fakturavägen är inte bekräftad", Skapa utkast i Fortnox) och src/shared/invoiceDelivery.ts
// (texterna när vägen saknas och felen när ett val inte räcker). Felen räknas med
// samma validateDeliveryChoice som portalen. Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { validateDeliveryChoice, type InvoiceDeliveryMethod } from '../../../../shared/invoiceDelivery'
import { Dator, DatorSida, Markor, Notis, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { mk } from './_fakturering'

const KUND = 'Exempel AB'
const ORGNR = '559999-0001'
const KUNDENS_TEXT = 'FE 512, 831 90 Östersund. Referens: Ansvar 28310'
const RATT_ADRESS = 'FE 512, 831 90 Östersund'
const REFERENS = 'Ansvar 28310'
const OSAKER = `Fakturavägen för ${KUND} är inte bekräftad. Välj e-post, e-faktura eller brev innan fakturan godkänns.`

const VAL: { m: InvoiceDeliveryMethod; text: string }[] = [
  { m: 'email', text: 'E-post' },
  { m: 'einvoice', text: 'E-faktura' },
  { m: 'print', text: 'Brev' },
]

const HJALP: Record<InvoiceDeliveryMethod, string> = {
  email: 'Fakturan mejlas från Fortnox till fakturamejlet.',
  einvoice: 'Fakturan går som e-faktura (Peppol) på organisationsnumret.',
  print: 'Fakturan skickas som brev till fakturaadressen.',
}

interface Lage {
  oppen: boolean
  metod: InvoiceDeliveryMethod | null
  adressRattad: boolean
  referens: boolean
  sparad: boolean
}

const START: Lage = { oppen: false, metod: null, adressRattad: false, referens: false, sparad: false }

type Bas = { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }

const felet = (l: Lage) =>
  l.metod
    ? validateDeliveryChoice({
        method: l.metod,
        billingEmail: '',
        billingAddress: l.adressRattad ? RATT_ADRESS : KUNDENS_TEXT,
        billingReference: l.referens ? REFERENS : '',
      }, ORGNR)
    : 'Välj hur kunden ska få fakturan.'

/** Fält som i portalen: etikett, värdet och hjälptexten under */
function Falt({ id, etikett, varde, platshallare, hjalp, tryck, markor }: {
  id: string; etikett: string; varde: string; platshallare: string; hjalp?: string; tryck: (id: string) => void; markor?: ReturnType<typeof mk>
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-medium text-slate-400">{etikett}</span>
      <Markor markor={markor} block>
        <button type="button" onClick={() => tryck(id)}
          className={`block w-full truncate rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-left text-[12px] ${varde ? 'text-white' : 'text-slate-500'}`}>
          {varde || platshallare}
        </button>
      </Markor>
      {hjalp && <span className="text-[10.5px] text-slate-500">{hjalp}</span>}
    </div>
  )
}

/** Rutan Fakturaväg, som InvoiceDeliveryPanel */
function Fakturavag({ l, tryck, markera, nr }: Bas) {
  const fel = felet(l)
  if (l.sparad) {
    return (
      <div className="mx-3 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Icon name="kontakt.mejl" size={16} className="text-slate-400" />
            <span className="text-[12.5px] font-semibold text-white">Fakturaväg</span>
            <span className="text-[12.5px] text-slate-200">Brev</span>
          </span>
          <button type="button" title="Ändra fakturaväg" aria-label="Ändra fakturaväg" onClick={() => tryck('andra')} className="rounded p-1 text-slate-400 hover:text-white">
            <Icon name="rapport.penna" size={16} />
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-slate-500">Satt av ekonomi (Anna Exempel) · 2026-10-22</p>
      </div>
    )
  }
  return (
    <div className="mx-3 rounded-xl border border-amber-500/40 bg-slate-800/30 p-2.5">
      <span className="flex items-center gap-1.5">
        <Icon name="rapport.avvikelse" size={16} className="text-amber-400" />
        <span className="text-[12.5px] font-semibold text-white">Fakturaväg</span>
        {l.metod && <span className="text-[12.5px] text-slate-200">{VAL.find(v => v.m === l.metod)?.text}</span>}
      </span>
      <p className="mt-1 text-[11px] text-amber-300">{OSAKER}</p>
      <div className="mt-2 grid gap-2">
        <div>
          <p className="mb-1 text-[11px] font-medium text-slate-400">Hur ska kunden få fakturan?</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {VAL.map(v => (
              <Markor key={v.m} markor={mk(markera, `val-${v.m}`, nr)}>
                <button type="button" role="radio" aria-checked={l.metod === v.m} onClick={() => tryck(`val-${v.m}`)} className="flex items-center gap-1.5 px-0.5 text-[12px] text-slate-200">
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] ${l.metod === v.m ? 'border-[#20c58f]' : 'border-slate-500'}`}>
                    {l.metod === v.m && <span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />}
                  </span>
                  {v.text}
                </button>
              </Markor>
            ))}
          </div>
          {l.metod && <p className="mt-1 text-[10.5px] text-slate-500">{HJALP[l.metod]}</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Falt id="mejl" etikett={l.metod === 'email' ? 'Fakturamejl' : 'Fakturamejl (valfritt)'} varde="" platshallare="faktura@kund.se" tryck={tryck} />
          <Falt id="adress" etikett={l.metod === 'print' ? 'Fakturaadress' : 'Fakturaadress (valfritt)'} varde={l.adressRattad ? RATT_ADRESS : KUNDENS_TEXT} platshallare="Box 123, 831 90 Östersund"
            hjalp="Gata eller box, postnummer och ort. Det kunden skrev i avtalet står här tills du rättar det." tryck={tryck} markor={mk(markera, 'adress', nr)} />
          <Falt id="referens" etikett="Er referens (valfritt)" varde={l.referens ? REFERENS : ''} platshallare="T.ex. Ansvar 28310"
            hjalp="Kundens referens eller ansvarskod. Står på alla kundens fakturor." tryck={tryck} markor={mk(markera, 'referens', nr)} />
        </div>
        {fel && l.metod && <p className="text-[11px] text-amber-300">{fel}</p>}
        <div className="flex justify-end">
          <PKnapp prim ikon="allman.bock" inaktiv={!!fel} onClick={() => tryck('spara')} markor={mk(markera, 'spara', nr)}>Spara och uppdatera Fortnox</PKnapp>
        </div>
      </div>
    </div>
  )
}

function FakturaModal({ l, tryck, markera, nr }: Bas) {
  const sparr = !l.sparad
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/60 p-3">
      <div className="grid w-full max-w-2xl gap-2 rounded-xl border border-slate-700 bg-slate-900 pb-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-sm font-semibold text-white">INV-202610-0051</span>
            <span className="text-[11.5px] text-slate-300">{KUND}</span>
            <Status text="Redo för Fortnox" farg="bg-sky-400" />
          </div>
          <button type="button" aria-label="Stäng" onClick={() => tryck('stang')} className="rounded p-1 text-slate-400 hover:text-white"><Icon name="allman.stang" size={16} /></button>
        </div>
        <div className="mx-3 grid grid-cols-3 divide-x divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60 text-[11px]">
          {[['Att fakturera', '4 500 kr'], ['Förfaller', '2026-11-21'], ['Betalvillkor', '30 dagar']].map(([e, v]) => (
            <div key={e} className="px-2.5 py-1.5">
              <span className="block text-[9.5px] uppercase tracking-wider text-slate-500">{e}</span>
              <span className="block font-semibold text-white">{v}</span>
            </div>
          ))}
        </div>
        <Fakturavag l={l} tryck={tryck} markera={markera} nr={nr} />
        <div className="mx-3 grid gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[11.5px] text-slate-300">
          <p className="text-[12px] font-semibold text-white">Fakturarader</p>
          <p className="flex justify-between"><span>Råttbekämpning, extrabesök</span><span>4 500 kr</span></p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 bg-slate-800/50 px-3 py-2">
          <PKnapp ikon="allman.ladda-ner" onClick={() => tryck('exportera')}>Exportera</PKnapp>
          <div className="flex flex-wrap items-center gap-1.5">
            {sparr && <span className="text-[10.5px] text-red-400">⚠ 1 att kontrollera · fakturavägen är inte bekräftad</span>}
            <PKnapp prim ikon="allman.anteckning" inaktiv={sparr} onClick={() => tryck('utkast')} markor={mk(markera, 'utkast', nr)}>Skapa utkast i Fortnox</PKnapp>
            <PKnapp fara onClick={() => tryck('makulera')}>Makulera</PKnapp>
          </div>
        </div>
      </div>
    </div>
  )
}

function Skarm({ l, tryck, markera, nr, notis }: Bas & { notis?: string }) {
  return (
    <Dator adress="fakturering">
      <div className="min-h-[560px]">
        <DatorSida meny={['Översikt', 'Ärenden', 'Fakturering']} aktiv="Fakturering" titel="Fakturering">
          <div className="mb-2 flex gap-4 border-b border-slate-700">
            {['Privat & Företag', 'Avtalskunder', 'Merförsäljning Avtal'].map((f, i) => (
              <button key={f} type="button" onClick={() => tryck(`flik-${i}`)}
                className={`-mb-px border-b-2 py-1.5 text-[12px] font-semibold ${i === 0 ? 'border-[#20c58f] text-[#20c58f]' : 'border-transparent text-slate-400'}`}>{f}</button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="grid grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr_40px] gap-2 bg-slate-900/80 px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Nr</span><span>Kund</span><span className="text-right">Belopp</span><span>Status</span><span />
            </div>
            {[
              { id: 'exempel', nr: 'INV-202610-0051', kund: KUND, belopp: '4 500 kr' },
              { id: 'brf', nr: 'INV-202610-0048', kund: 'Brf Exempelgården', belopp: '2 750 kr' },
            ].map(r => (
              <div key={r.id} className="grid grid-cols-[1.1fr_1.3fr_0.8fr_1.1fr_40px] items-center gap-2 border-t border-slate-800/60 px-3 py-1.5">
                <span className="font-mono text-[11px] text-white">{r.nr}</span>
                <span><span className="block text-[12px] text-white">{r.kund}</span><span className="block text-[10.5px] text-slate-500">Företag</span></span>
                <span className="text-right text-[12px] font-medium text-white">{r.belopp}</span>
                <Status text="Redo för Fortnox" farg="bg-sky-400" />
                <span className="flex justify-end text-slate-500">
                  <Markor markor={mk(markera, `detaljer-${r.id}`, nr)}>
                    <button type="button" title="Detaljer" aria-label="Detaljer" onClick={() => tryck(`detaljer-${r.id}`)} className="rounded p-0.5 hover:text-white"><Icon name="rapport.forhandsgranska" size={16} /></button>
                  </Markor>
                </span>
              </div>
            ))}
          </div>
        </DatorSida>
      </div>
      {l.oppen && <FakturaModal l={l} tryck={tryck} markera={markera} nr={nr} />}
      {notis && <Notis text={notis} />}
    </Dator>
  )
}

// ─── Visning ───

const SPARAD_NOTIS = 'Fakturavägen är sparad och Fortnox-kortet 1234 uppdaterat'

const VISNING: { lage: Lage; markera: string; notis?: string }[] = [
  { lage: START, markera: 'detaljer-exempel' },
  { lage: { ...START, oppen: true }, markera: 'val-print' },
  { lage: { ...START, oppen: true, metod: 'print' }, markera: 'adress' },
  { lage: { ...START, oppen: true, metod: 'print', adressRattad: true }, markera: 'referens' },
  { lage: { ...START, oppen: true, metod: 'print', adressRattad: true, referens: true }, markera: 'spara' },
  { lage: { oppen: true, metod: 'print', adressRattad: true, referens: true, sparad: true }, markera: 'utkast', notis: SPARAD_NOTIS },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} notis={v.notis} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Fakturan till Exempel AB går inte att skicka. Öppna den.' }

const TIPS: Record<string, string> = {
  'flik-1': 'Avtalskunder är årspremierna. Fakturan till Exempel AB ligger under Privat & Företag.',
  'flik-2': 'Merförsäljning Avtal är extraarbeten hos avtalskunder. Fakturan ligger under Privat & Företag.',
  'detaljer-brf': 'Det är Brf Exempelgården. Uppdraget gäller Exempel AB.',
  exportera: 'Exportera laddar ner fakturan som fil. Fakturavägen ändras inte.',
  makulera: 'Makulera stryker fakturan. Den ska skickas, inte strykas.',
  mejl: 'Kunden har inte skrivit någon e-postadress. Fakturan ska som brev till skanningsadressen.',
  'val-email': 'E-post kräver ett fakturamejl, och kunden har inte gett något. Exempel AB skrev en skanningsadress, alltså brev.',
  'val-einvoice': 'E-faktura går på organisationsnumret. Exempel AB skrev en skanningsadress för pappersfakturor, alltså brev.',
  stang: 'Fakturan är stängd. Öppna den igen med ögat på raden.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [notis, setNotis] = useState<string | undefined>()
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    setNotis(undefined)
    if (!l.oppen) {
      if (id === 'detaljer-exempel') { setL({ ...l, oppen: true }); tips('Fakturan är öppen', 'Rutan Fakturaväg har gul ram. Läs vad kunden skrev i Fakturaadress och välj hur fakturan ska skickas.') }
      else if (id === 'flik-0') tips('Privat & Företag', 'Du är redan här.')
      else miss(TIPS[id] ?? 'Leta efter Exempel AB i listan och öppna fakturan med ögat.')
      return
    }
    if (id === 'stang') { setL({ ...l, oppen: false }); tips('Fakturan stängd', TIPS.stang); return }
    if (l.sparad) {
      if (id === 'utkast') {
        setNotis('Utkast skapat i Fortnox (nr 1234)'); setKlar(true)
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Exempel AB får fakturan som brev till FE 512, 831 90 Östersund med Ansvar 28310 som Er referens. Vägen är sparad på kunden och på Fortnox-kortet, så nästa faktura till kunden stoppas inte.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'andra') tips('Ändra fakturaväg', 'Pennan öppnar valet igen. Vägen är redan rätt, skapa utkastet i stället.')
      else miss(TIPS[id] ?? 'Vägen är sparad. Skapa utkastet i Fortnox.')
      return
    }
    if (id === 'val-print') {
      setL({ ...l, metod: 'print' })
      tips('Brev', l.adressRattad && l.referens ? 'Tryck Spara och uppdatera Fortnox.' : 'Bra. Titta nu på Fakturaadress. Där står referensen ihop med adressen.')
    } else if (id === 'val-email' || id === 'val-einvoice') {
      setL({ ...l, metod: id === 'val-email' ? 'email' : 'einvoice' })
      miss(TIPS[id])
    } else if (id === 'adress') {
      setL({ ...l, adressRattad: true })
      tips('Adressen är rättad', 'Nu står bara FE 512, 831 90 Östersund. Referensen behöver en egen plats.')
    } else if (id === 'referens') {
      setL({ ...l, referens: true })
      tips('Referensen är flyttad', 'Ansvar 28310 står nu i Er referens och kommer med på alla kundens fakturor.')
    } else if (id === 'spara') {
      const f = felet(l)
      if (f) miss(l.metod ? f : 'Välj först hur kunden ska få fakturan.')
      else if (l.metod !== 'print') miss('Exempel AB skrev en skanningsadress, alltså brev. Välj Brev först.')
      else if (!l.adressRattad) miss('Referensen står kvar i Fakturaadress och skulle hamna i adressen på Fortnox-kortet. Rätta adressen först.')
      else if (!l.referens) miss('Referensen försvann ur adressen. Skriv den i Er referens, annars hittar kunden inte fakturan.')
      else {
        setL({ ...l, sparad: true }); setNotis(SPARAD_NOTIS)
        tips('Sparad', 'Rutan säger Fakturaväg Brev och Satt av ekonomi. Spärren är borta. Skapa utkastet i Fortnox.')
      }
    } else if (id === 'utkast') miss(`Knappen är spärrad: ${OSAKER}`)
    else miss(TIPS[id] ?? 'Välj väg, rätta adressen, flytta referensen och spara.')
  }

  const framsteg = klar ? 6 : l.sparad ? 5 : !l.oppen ? 0 : 1 + (l.metod === 'print' ? 1 : 0) + (l.adressRattad ? 1 : 0) + (l.referens ? 1 : 0)
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0); setNotis(undefined); setKlar(false) }}>
      <Skarm l={l} tryck={tryck} nr={0} notis={notis} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
