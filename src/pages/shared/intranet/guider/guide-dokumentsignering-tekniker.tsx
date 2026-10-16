// src/pages/shared/intranet/guider/guide-dokumentsignering-tekniker.tsx
// Guidemodul: Skicka en offert från ärendet (tekniker, telefon).
// Efterbildning av EditCaseModal (kvittot Offert uppe till höger, title "Skapa offertförslag
// för denna kund", texten syns bara på större skärm) och OneflowContractCreator när den öppnas
// från ärendet med prissatta tjänster: steget Offertinnehåll (Steg 6 av 7, Skriv förslag från
// tjänsterna, Granska offerten), granskningen (Kontroll före utskick, Skapa och visa Oneflows PDF)
// och utkastet (Så här ser kunden offerten, Ser allt rätt ut?, Skicka offerten, Ändra i wizarden,
// Spara som utkast) samt bekräftelsen Offerten är skickad. Portalens tankstreck i "Offert, namn" skrivs här
// med komma. Påhittad kund, ingenting skickas.

import { useState, type ReactNode } from 'react'
import { ArendeHuvud, Flikar, Kort, Markor, Notis, OvningRam, PKnapp, Rad, Status, Telefon, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { gorMk, IkonRuta, type Mk, type Tryck } from './_arenden'

// ─── Lokala ikoner (ikonstandard 24/1,6). Portalen använder lucide Receipt och FileSignature ───

function KvittoIkon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 3v18l2-1.2 2 1.2 2-1.2 2 1.2 2-1.2 2 1.2 2-1.2V3l-2 1.2L15 3l-2 1.2L11 3 9 4.2 7 3 5 4.2" />
      <path d="M15 8.5h-4.5a1.75 1.75 0 0 0 0 3.5h3a1.75 1.75 0 0 1 0 3.5H9M12 7v10" />
    </svg>
  )
}

function SignaturIkon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12V7.5L14.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M14 3v5h5M14 19.5c1-1.5 2-2.5 3-2.5s1 1.5 2 1.5 1.5-.8 2-1.5M9 13h4M9 16.5h2" />
    </svg>
  )
}

// ─── Data ───

const EPOST = 'anna@exempel.se'
const TJANST = 'Bekämpning av getingbo'
const PRIS = '2 000 kr'
const STANDARDTEXT = 'Regelbunden kontroll och bekämpning av skadedjur enligt överenskommet schema. Detta inkluderar inspektion av samtliga betesstationer, påfyllning av bete vid behov, samt dokumentation av aktivitet. Vid tecken på gnagaraktivitet vidtas omedelbara åtgärder med förstärkta insatser.'
const FORSLAG = `Tjänster som ingår:\n\n- ${TJANST}`

type Vy = 'arende' | 'innehall' | 'granska' | 'pdf' | 'klart'
interface Lage { vy: Vy; forslag: boolean }

// ─── Delar ───

/** Det mörka bandet överst i avtalsguiden */
function Band({ titel, hoger, procent, tryck }: { titel: string; hoger?: ReactNode; procent?: number; tryck: Tryck }) {
  return (
    <div className="bg-[#0e1c2b] px-3 pb-2.5 pt-2.5 text-[#e8eef4]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f] text-[#052e22]"><Icon name="rapport.rapport" size={16} /></span>
          <div className="min-w-0">
            <button type="button" onClick={() => tryck('band-tillbaka')} className="block text-[10px] text-[#8ea3b8]">Avtal &amp; Offerter</button>
            <p className="truncate text-[14px] font-semibold text-[#fff]">{titel}</p>
          </div>
        </div>
        {hoger}
      </div>
      {procent !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded bg-[#2a3d52]" aria-hidden>
          <div className="h-1 bg-[#20c58f]" style={{ width: `${procent}%` }} />
        </div>
      )}
    </div>
  )
}

function Punkt({ farg, text }: { farg: string; text: string }) {
  return (
    <li className="flex items-start gap-1.5">
      <span className={`mt-[5px] h-1.5 w-1.5 flex-none rounded-full ${farg}`} aria-hidden />
      <span className="min-w-0 text-[10.5px] text-slate-200">{text}</span>
    </li>
  )
}

// ─── Skärmen ───

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'arende') {
    return (
      <Telefon>
        <ArendeHuvud
          nr="BE-0001234"
          status={<Status text="Bokad" />}
          kund="Anna Exempel · Exempelvägen 4, Södertälje"
          ikoner={<>
            <IkonRuta etikett="Skapa serviceavtal för denna kund" onClick={() => tryck('avtal')} markor={mk('avtal')}><SignaturIkon /></IkonRuta>
            <IkonRuta etikett="Skapa offertförslag för denna kund" onClick={() => tryck('offert')} markor={mk('offert')}><KvittoIkon /></IkonRuta>
            <IkonRuta etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')}><Icon name="arende.aterbesok" size={20} /></IkonRuta>
            <IkonRuta etikett="Ärendehistorik" onClick={() => tryck('historik')}><Icon name="allman.historik" size={20} /></IkonRuta>
          </>}
        />
        <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
        <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Getingbo under taket vid entrén. Kunden vill ha pris innan vi gör jobbet." /></Kort>
        <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Tisdag 2026-10-20, 13:00 till 14:00" /></Kort>
      </Telefon>
    )
  }

  if (l.vy === 'innehall') {
    const text = l.forslag ? FORSLAG : STANDARDTEXT
    return (
      <Telefon>
        <Band titel="Ny offert" procent={71} tryck={tryck}
          hoger={<div className="flex flex-none items-center gap-2 pt-1 text-[10.5px]"><span className="text-[#8ea3b8]">71 % klart</span><button type="button" onClick={() => tryck('avbryt')} className="text-[#c9d6e2]">Avbryt</button></div>} />
        <div className="grid gap-2.5 p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-[15px] text-emerald-400">6</span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white">Offertinnehåll</p>
              <p className="text-[10.5px] text-slate-400">Vad arbetet omfattar, med kundens egna ord.</p>
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
            <p className="text-[11px] font-bold text-slate-300">Offertinnehåll, arbetsbeskrivningen i offerten</p>
            <Markor markor={mk('forslag')}>
              <button type="button" onClick={() => tryck('forslag')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#20c58f]">
                <Icon name="allman.blixt" size={16} className="h-3.5 w-3.5" />Skriv förslag från tjänsterna
              </button>
            </Markor>
            <button type="button" onClick={() => tryck('textruta')} className="h-[150px] overflow-hidden whitespace-pre-line rounded-lg border border-slate-600 bg-slate-800/60 p-2 text-left text-[11.5px] leading-relaxed text-white">
              {text}
            </button>
            <p className="text-[10.5px] text-slate-400">{text.length.toLocaleString('sv-SE')} av 2 048 tecken</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 border-t border-slate-700 bg-slate-900 px-3 py-2">
          <PKnapp onClick={() => tryck('tillbaka')}>Tillbaka</PKnapp>
          <span className="text-[10.5px] text-slate-400">Steg 6 av 7</span>
          <PKnapp prim onClick={() => tryck('granska')} markor={mk('granska')}>Granska offerten →</PKnapp>
        </div>
      </Telefon>
    )
  }

  if (l.vy === 'granska') {
    return (
      <Telefon>
        <Band titel="Ny offert" procent={86} tryck={tryck}
          hoger={<div className="flex flex-none items-center gap-2 pt-1 text-[10.5px]"><span className="text-[#8ea3b8]">86 % klart</span><button type="button" onClick={() => tryck('avbryt')} className="text-[#c9d6e2]">Avbryt</button></div>} />
        <div className="grid gap-2 p-3">
          <div>
            <p className="text-[10px] text-slate-400">Steg 7 av 7</p>
            <p className="text-[15px] font-semibold text-white">Granska offerten</p>
          </div>
          <div className="grid gap-1.5 rounded-md border border-slate-700 bg-slate-900 p-2.5">
            <p className="text-[12px] font-bold text-white">Offert, Anna Exempel</p>
            <div className="flex justify-between text-[10px]"><span className="font-bold uppercase tracking-wide text-slate-400">Kund</span><button type="button" onClick={() => tryck('andra')} className="font-semibold text-emerald-400">Ändra</button></div>
            <Rad v="E-post" h={EPOST} />
            <p className="border-t border-slate-700 pt-1 text-[11px] font-bold text-white">Offertinnehåll</p>
            <p className="whitespace-pre-line text-[10.5px] text-slate-300">{l.forslag ? FORSLAG : STANDARDTEXT.slice(0, 60) + '…'}</p>
            <div className="border-t border-slate-700 pt-1"><Rad v={TJANST} h={PRIS} /><Rad v="Totalt inkl. moms" h={PRIS} /></div>
          </div>
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
            <p className="text-[11.5px] font-bold text-white">Kontroll före utskick</p>
            <ul className="grid gap-1">
              <Punkt farg="bg-amber-400" text="E-post för faktura saknas, kunden fyller i vid signering" />
              <Punkt farg="bg-[#20c58f]" text={`Offerten skickas till ${EPOST}`} />
              <Punkt farg="bg-[#20c58f]" text="1 tjänst" />
            </ul>
          </div>
          <Markor markor={mk('skapa')} block>
            <button type="button" onClick={() => tryck('skapa')} className="w-full rounded-lg bg-[#20c58f] px-3 py-2 text-[12.5px] font-semibold text-[#fff]">Skapa och visa Oneflows PDF</button>
          </Markor>
          <p className="text-[10px] text-slate-400">Offerten skapas som utkast i Oneflow. Inget skickas till kunden förrän du godkänt PDF:en.</p>
        </div>
      </Telefon>
    )
  }

  if (l.vy === 'pdf') {
    return (
      <Telefon>
        <Band titel="Offert, Anna Exempel" tryck={tryck}
          hoger={<span className="flex flex-none items-center gap-1 pt-1 text-[10px] text-[#c9d6e2]"><span className="h-1.5 w-1.5 rounded-full bg-[#f5a524]" />Utkast</span>} />
        <div className="grid gap-2 p-3">
          <p className="text-[15px] font-semibold text-white">Så här ser kunden offerten</p>
          <button type="button" onClick={() => tryck('pdf-yta')} className="grid gap-1 rounded bg-white p-2.5 text-left text-[10px] text-slate-700 shadow">
            <span className="text-[11.5px] font-bold text-slate-900">Offert</span>
            <span>Kund: Anna Exempel, Exempelvägen 4, Södertälje</span>
            <span className="whitespace-pre-line">{FORSLAG}</span>
            <span className="flex justify-between border-t border-slate-200 pt-1"><span>Totalt inkl. moms</span><span>{PRIS}</span></span>
          </button>
          <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
            <p className="text-[11.5px] font-bold text-white">Ser allt rätt ut?</p>
            <Markor markor={mk('skicka')} block>
              <button type="button" onClick={() => tryck('skicka')} className="w-full rounded-lg bg-[#20c58f] px-3 py-2 text-[12.5px] font-semibold text-[#fff]">Skicka offerten</button>
            </Markor>
            <p className="text-[10px] text-slate-400">Skickas från info@begone.se till {EPOST}.</p>
            <div className="flex gap-1.5 border-t border-slate-700/60 pt-1.5">
              <PKnapp onClick={() => tryck('andra-wizard')}>Ändra i wizarden</PKnapp>
              <PKnapp onClick={() => tryck('spara-utkast')}>Spara som utkast</PKnapp>
            </div>
          </div>
        </div>
      </Telefon>
    )
  }

  return (
    <Telefon>
      <Band titel="Offert, Anna Exempel" tryck={tryck} />
      <div className="grid gap-2.5 p-3">
        <p className="text-[17px] font-semibold text-white">Offerten är skickad</p>
        <p className="text-[11.5px] text-slate-400">Kunden har fått offerten för granskning från info@begone.se. Du skickas vidare till Dokumentsignering.</p>
        <div className="grid gap-1 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
          <Rad v="Offert-ID" h="#1234567" />
          <Rad v="Status" h={<Status text="Skickat för granskning" farg="bg-[#20c58f]" />} />
        </div>
      </div>
      <Notis text="Offerten är skickad" />
    </Telefon>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'arende', forslag: false }, markera: 'offert' },
  { lage: { vy: 'innehall', forslag: false }, markera: 'forslag' },
  { lage: { vy: 'innehall', forslag: true }, markera: 'granska' },
  { lage: { vy: 'granska', forslag: true }, markera: 'skapa' },
  { lage: { vy: 'pdf', forslag: true }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'arende', forslag: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet. Leta upp knappen som skapar en offert och tryck på den.' }

const TIPS: Record<string, string> = {
  avtal: 'Det där är Avtal, för kunder som ska ha ett löpande serviceavtal. Familjen Exempel vill ha pris på ett jobb, alltså en offert.',
  fotspar: 'Fotspåren bokar återbesök eller skapar nytt ärende. Offerten skapar du med kvittot.',
  historik: 'Klockan är ärendehistoriken. Offerten skapar du med kvittot.',
  flik: 'Flikarna byter vy i ärendet. Offerten skapar du med kvittot uppe till höger.',
  avbryt: 'Avbryt lämnar guiden och du får börja om. Fortsätt i stället.',
  tillbaka: 'Tjänsten och priset är redan hämtade från ärendet. Fortsätt med texten.',
  textruta: 'Du kan skriva själv, men knappen Skriv förslag från tjänsterna gör det åt dig.',
  'band-tillbaka': 'Avtal & Offerter tar dig till Dokumentsignering. Gör klart offerten först.',
  andra: 'Ändra tar dig till rätt steg. Här stämmer allt redan.',
  'pdf-yta': 'Det här är Oneflows PDF. Ser den rätt ut skickar du med knappen under.',
  'andra-wizard': 'Ändra i wizarden tar bort utkastet. Allt stämmer, så skicka i stället.',
  'spara-utkast': 'Spara som utkast skickar inget. Uppdraget var att skicka offerten nu.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'arende') {
      if (id === 'offert') { setL({ ...l, vy: 'innehall' }); tips('Offertguiden är öppen', 'Kund och tjänst är hämtade från ärendet. Läs texten i rutan. Stämmer den med jobbet?') }
      else miss(TIPS[id] ?? 'Leta efter kvittot uppe till höger.')
    } else if (l.vy === 'innehall') {
      if (id === 'forslag') { setL({ ...l, forslag: true }); tips('Bättre text', 'Nu står getingboet i offerten. Tryck Granska offerten.') }
      else if (id === 'granska') {
        if (!l.forslag) miss('Texten handlar om betesstationer och avtalskontroller, inte om getingboet. Tryck Skriv förslag från tjänsterna först.')
        else { setL({ ...l, vy: 'granska' }); tips('Granska', 'Så här ser offerten ut för kunden. Gul punkt stoppar inte. Skapa PDF:en.') }
      } else miss(TIPS[id] ?? 'Byt ut texten och gå vidare till granskningen.')
    } else if (l.vy === 'granska') {
      if (id === 'skapa') { setL({ ...l, vy: 'pdf' }); tips('Utkastet är skapat', 'Inget är skickat än. Titta på PDF:en och skicka.') }
      else miss(TIPS[id] ?? 'Tryck Skapa och visa Oneflows PDF.')
    } else {
      if (id === 'skicka') {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Offerten på ${PRIS} inkl. moms är skickad från info@begone.se till ${EPOST}. Ärendet får status Offert skickad och du följer offerten under Dokumentsignering.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else miss(TIPS[id] ?? 'Tryck Skicka offerten.')
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'innehall' ? (l.forslag ? 2 : 1) : l.vy === 'granska' ? 3 : l.vy === 'pdf' ? 4 : 5
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
