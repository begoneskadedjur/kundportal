// src/pages/shared/intranet/guider/guide-dokumentsignering-saljare.tsx
// Guidemodul: Skicka en offert eller ett avtal för signering (säljare, dator).
// Säljaren har kvar den gamla sidan på /saljare/dokumentsignering. Kontoret har
// en egen guide (guide-dokumentsignering) sedan sidan byggdes om 2026-10-23.
// Efterbildning av OfferFollowUp (Dokumentsignering, Arbetskö/Statistik, Sök kund, ärendenr…,
// Båda/Offerter/Avtal), DocumentQueueList (kategorin Utkast, ej skickade) och
// DocumentDetailPanel: väntarraden "Utkast, inte skickat till kunden. Granska PDF:en och skicka.",
// Visa PDF, Skicka för signering (offert: Skicka offerten), webbläsarens fråga
// "Skicka avtalet till <e-post> från info@begone.se?" och toasten
// "Avtalet är skickat för signering". Påhittad kund, ingenting skickas.

import { useState } from 'react'
import { Dator, DatorSida, Knapprad, Markor, Notis, OvningRam, PKnapp, Status, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { gorMk, type Mk, type Tryck } from './_arenden'

type Vy = 'ko' | 'vald' | 'pdf' | 'fraga' | 'klart'
interface Lage { vy: Vy; sett: boolean }

const MENY = ['Översikt', 'Skapa Avtal & Offerter', 'Dokumentsignering', 'Befintliga kunder', 'Leads (B2B)', 'Leads (Webb)']
const EPOST = 'anna@exempel.se'

function KoRad({ id, kund, typ, vald, mk, tryck }: { id: string; kund: string; typ: string; vald?: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`grid w-full gap-0.5 border-l-2 px-2.5 py-1.5 text-left ${vald ? 'border-[#20c58f] bg-slate-800/70' : 'border-transparent hover:bg-slate-800/40'}`}>
        <span className="truncate text-[12px] font-medium text-slate-200">{kund}</span>
        <span className="text-[10.5px] text-slate-500">{typ}</span>
      </button>
    </Markor>
  )
}

function Panel({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'ko') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-[12px] text-slate-500">Välj ett dokument i kön</p>
        <p className="text-[10.5px] text-slate-600">Pil upp/ned bläddrar · Enter öppnar</p>
      </div>
    )
  }
  const klar = l.vy === 'klart'
  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="border-b border-slate-800 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-white">Exempel AB {klar ? <Status text="Pågående" farg="bg-blue-400" /> : <Status text="Utkast" />}</p>
            <p className="text-[10.5px] text-slate-500">Avtal · 12 500 kr · {klar ? 'Skickad' : 'Skapad'} 16 okt. 2026 av Anna Exempel</p>
            <p className="text-[10.5px] text-slate-400">Anna Exempel · {EPOST}</p>
          </div>
          <button type="button" onClick={() => tryck('oneflow')} className="flex flex-none items-center gap-1 rounded-lg border border-slate-700 px-2 py-0.5 text-[10.5px] text-slate-400">
            <Icon name="rapport.lank" size={16} className="h-3 w-3" />Oneflow
          </button>
        </div>
      </div>
      {!klar && (
        <div className="border-b border-slate-800 px-3 py-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5">
            <span className="text-[11px] text-amber-300">Utkast, inte skickat till kunden. Granska PDF:en och skicka.</span>
            <button type="button" onClick={() => tryck('visa-pdf')} className="flex-none rounded-md bg-[#20c58f] px-2 py-0.5 text-[11px] font-medium text-[#fff]">Visa PDF</button>
          </div>
        </div>
      )}
      <div className="flex gap-2 border-b border-slate-800 px-3 pt-1.5 text-[11px]">
        {['Konversation', 'Aktivitet', 'Innehåll'].map((t, i) => (
          <button key={t} type="button" onClick={() => tryck('flik')} className={`border-b-2 px-1.5 pb-1 ${i === 0 ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-500'}`}>{t}</button>
        ))}
      </div>
      <p className="flex-1 px-3 py-5 text-center text-[11px] text-slate-500">Ingen konversation ännu</p>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800 px-3 py-2">
        {klar ? (
          <>
            <PKnapp onClick={() => tryck('ring')}>Ring upp</PKnapp>
            <PKnapp onClick={() => tryck('logga')}>Logga samtal</PKnapp>
            <PKnapp onClick={() => tryck('forlang')}>Förläng frist</PKnapp>
          </>
        ) : (
          <>
            <PKnapp prim ikon="rapport.skicka" onClick={() => tryck('skicka')} markor={mk('skicka')}>Skicka för signering</PKnapp>
            <PKnapp onClick={() => tryck('visa-pdf')} markor={mk('visa-pdf')}>Visa PDF</PKnapp>
          </>
        )}
      </div>

      {l.vy === 'pdf' && (
        <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
          <div className="border-b border-slate-700 px-3 py-2">
            <p className="text-[12.5px] font-bold text-white">Avtal, Exempel AB</p>
            <p className="text-[10.5px] text-slate-400">Utkast i Oneflow · ID 1234567</p>
          </div>
          <div className="flex-1 overflow-hidden bg-slate-800/40 p-3">
            <div className="mx-auto grid max-w-xs gap-1.5 rounded bg-white p-3 text-[10.5px] text-slate-700 shadow">
              <p className="text-[12px] font-bold text-slate-900">Avtal om skadedjursbekämpning</p>
              <p>Kund: Exempel AB, Exempelgatan 12, Solna</p>
              <p>Kontaktperson: Anna Exempel</p>
              <div className="flex justify-between border-t border-slate-200 pt-1"><span>Årspremie</span><span>12 500 kr</span></div>
              <p className="text-slate-400">Signering: Exempel AB och BeGone</p>
            </div>
          </div>
          <div className="flex justify-end gap-1.5 border-t border-slate-700 px-3 py-2">
            <PKnapp onClick={() => tryck('stang-pdf')}>Stäng</PKnapp>
            <PKnapp prim onClick={() => tryck('skicka-pdf')} markor={mk('skicka-pdf')}>Skicka för signering</PKnapp>
          </div>
        </div>
      )}
    </div>
  )
}

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  const klar = l.vy === 'klart'
  return (
    <Dator adress="saljare › dokumentsignering">
      <DatorSida meny={MENY} aktiv="Dokumentsignering" titel="Dokumentsignering">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-slate-800/50 p-0.5 text-[10.5px]">
            <span className="rounded-md bg-[#20c58f] px-2 py-0.5 font-medium text-[#fff]">Arbetskö</span>
            <button type="button" onClick={() => tryck('statistik')} className="px-2 py-0.5 text-slate-400">Statistik</button>
          </div>
          <button type="button" onClick={() => tryck('sok')} className="flex w-40 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-left text-[10.5px] text-slate-500">
            <Icon name="allman.sok" size={16} className="h-3 w-3" />Sök kund, ärendenr…
          </button>
          <div className="flex rounded-lg bg-slate-800/50 p-0.5 text-[10.5px]">
            {['Båda', 'Offerter', 'Avtal'].map((t, i) => (
              <button key={t} type="button" onClick={() => tryck('typfilter')} className={`rounded-md px-2 py-0.5 ${i === 0 ? 'bg-[#20c58f] font-medium text-[#fff]' : 'text-slate-400'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="relative flex min-h-[300px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="w-[42%] flex-none border-r border-slate-800 py-1">
            {!klar && (
              <>
                <p className="flex justify-between px-2.5 py-1 text-[10.5px] font-semibold text-slate-300">Utkast, ej skickade <span className="text-amber-400">1</span></p>
                <KoRad id="rad-utkast" kund="Exempel AB" typ="Avtal · 12 500 kr" vald={l.vy !== 'ko'} mk={mk} tryck={tryck} />
              </>
            )}
            <p className="mt-1 flex justify-between px-2.5 py-1 text-[10.5px] font-semibold text-slate-300">Bevakas <span className="text-slate-500">{klar ? 2 : 1}</span></p>
            {klar && <KoRad id="rad-utkast" kund="Exempel AB" typ="Avtal · 12 500 kr" vald mk={mk} tryck={tryck} />}
            <KoRad id="rad-bevakas" kund="Brf Exempelgården" typ="Offert · 4 900 kr" mk={mk} tryck={tryck} />
          </div>
          <Panel l={l} mk={mk} tryck={tryck} />
          {l.vy === 'fraga' && (
            <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/50 p-4">
              <div className="grid w-full max-w-xs gap-2 rounded-lg border border-slate-600 bg-slate-800 p-3 shadow-2xl">
                <p className="text-[10.5px] text-slate-400">portal.begone.se</p>
                <p className="text-[12px] text-white">Skicka avtalet till {EPOST} från info@begone.se?</p>
                <Knapprad>
                  <PKnapp onClick={() => tryck('fraga-avbryt')}>Avbryt</PKnapp>
                  <PKnapp prim onClick={() => tryck('ok')} markor={mk('ok')}>OK</PKnapp>
                </Knapprad>
              </div>
            </div>
          )}
        </div>
      </DatorSida>
      {klar && <Notis text="Avtalet är skickat för signering" />}
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'ko', sett: false }, markera: 'rad-utkast' },
  { lage: { vy: 'vald', sett: false }, markera: 'visa-pdf' },
  { lage: { vy: 'pdf', sett: true }, markera: 'skicka-pdf' },
  { lage: { vy: 'fraga', sett: true }, markera: 'ok' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'ko', sett: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Avtalet till Exempel AB ligger som utkast överst i kön. Öppna det.' }

const TIPS: Record<string, string> = {
  'rad-bevakas': 'Brf Exempelgården är redan skickad och bevakas. Utkastet ligger överst.',
  oneflow: 'Du behöver inte öppna Oneflow. Allt görs härifrån.',
  statistik: 'Statistiken visar siffror. Utkastet skickar du från arbetskön.',
  sok: 'Sökfältet behövs inte, utkastet syns redan överst i kön.',
  typfilter: 'Filtret visar bara offerter eller avtal. Utkastet syns redan.',
  flik: 'Flikarna visar konversation, aktivitet och innehåll. Granska i stället PDF:en.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'fraga') {
      if (id === 'ok') {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Avtalet är skickat från info@begone.se till ${EPOST}. Det har lämnat Utkast, ej skickade och bevakas nu i kön tills kunden signerar.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'fraga-avbryt') { setL({ ...l, vy: l.sett ? 'pdf' : 'vald' }); miss('Avbryt skickar ingenting. Stämmer e-postadressen trycker du OK.') }
      else miss('Svara på frågan: tryck OK för att skicka.')
      return
    }
    if (l.vy === 'pdf') {
      if (id === 'skicka-pdf') { setL({ ...l, vy: 'fraga' }); tips('En fråga visas', 'Kontrollera e-postadressen och tryck OK.') }
      else if (id === 'stang-pdf') { setL({ ...l, vy: 'vald' }); tips('PDF:en är stängd', 'Du har sett den. Tryck Skicka för signering.') }
      else miss('Läs PDF:en och tryck Skicka för signering längst ner.')
      return
    }
    if (id === 'rad-utkast') {
      if (l.vy === 'ko') { setL({ ...l, vy: 'vald' }); tips('Utkastet är öppet', 'Granska PDF:en innan du skickar.') }
      return
    }
    if (id === 'visa-pdf') {
      if (l.vy === 'ko') { miss('Öppna utkastet i kön först.'); return }
      setL({ ...l, vy: 'pdf', sett: true }); tips('Så ser kunden avtalet', 'Stämmer kund, kontaktperson och premie? Tryck Skicka för signering.')
      return
    }
    if (id === 'skicka') {
      if (!l.sett) { miss('Granska PDF:en först. Tryck Visa PDF, så ser du exakt vad kunden får.'); return }
      setL({ ...l, vy: 'fraga' }); tips('En fråga visas', 'Kontrollera e-postadressen och tryck OK.')
      return
    }
    miss(TIPS[id] ?? 'Öppna utkastet, granska PDF:en och skicka.')
  }

  const framsteg = l.vy === 'ko' ? 0 : l.vy === 'klart' ? 4 : l.vy === 'fraga' ? 3 : l.sett ? 2 : 1
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
