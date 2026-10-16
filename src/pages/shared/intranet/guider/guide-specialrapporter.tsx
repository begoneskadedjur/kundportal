// src/pages/shared/intranet/guider/guide-specialrapporter.tsx
// Guidemodul: Skriv en specialrapport (tekniker, telefon).
// Etiketterna kommer från EditCaseModal (fliken Utförande), CaseSpecialReportsSection
// (Specialrapporter, Skapa specialrapport), NewSpecialReportModal (Ny specialrapport,
// Börja tomt, Börja med kartan, Titel, Skapa rapport), SpecialReportEditorPage
// (Klar att skicka, Rapportens delar, Lägg till del, Delar, Redigera, Visa som kund,
// Ny händelse), AddSectionModal (Lägg till del, Område, Besök, Underleverantör, Fritt),
// AreaMapEditor (Avbryt ritning, Skapa del, Vad heter området?, Hoppa över, Spara)
// och MobileAddEventSheet (Ny händelse, Del, Vad har du gjort?, Datum, Rubrik,
// Spara i rapporten, Händelsen är sparad i rapporten). Påhittad kund, inget sparas.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import {
  Ark, ArendeHuvud, Falt, Flikar, IkonKnapp, Knapprad, Kort, Markor, Notis, OvningRam, PKnapp, Rad, Status, Telefon, Val,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import { KlarAttSkicka, RapportensDelar, type Del, type KlarNyckel } from './_specialrapport'
import type { GuideModul } from './registry'

type Vy = 'arende' | 'ny' | 'delar' | 'laggtill' | 'karta' | 'namn' | 'redigera' | 'handelse' | 'klart'
type Typ = 'inspektion' | 'besok' | 'betning' | 'atgard' | 'underlev' | 'notering' | 'avvikelse'

const TYPER: { id: Typ; namn: string; ikon: IconName }[] = [
  { id: 'inspektion', namn: 'Inspektion', ikon: 'rapport.inspektion' },
  { id: 'besok', namn: 'Besök', ikon: 'rapport.besok' },
  { id: 'betning', namn: 'Betning', ikon: 'rapport.betning' },
  { id: 'atgard', namn: 'Åtgärd', ikon: 'rapport.atgard' },
  { id: 'underlev', namn: 'Underlev.', ikon: 'rapport.underlev' },
  { id: 'notering', namn: 'Notering', ikon: 'rapport.notering' },
  { id: 'avvikelse', namn: 'Avvikelse', ikon: 'rapport.avvikelse' },
]

/** Hörnen man trycker ut på kartan, i procent av kartytan */
const HORN: [number, number][] = [[22, 30], [70, 26], [76, 66], [28, 72]]

interface Lage {
  vy: Vy
  horn: number
  namn: boolean
  typ: Typ | null
}

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

function Editorhuvud({ tryck }: { tryck: (id: string) => void }) {
  const ikon = (namn: IconName, etikett: string, id: string) => (
    <button type="button" aria-label={etikett} title={etikett} onClick={() => tryck(id)}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-700 text-slate-200">
      <Icon name={namn} size={16} />
    </button>
  )
  return (
    <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/80 px-1.5 py-1.5">
      <button type="button" aria-label="Tillbaka till rapporterna" onClick={() => tryck('tillbaka')} className="flex h-8 w-7 flex-none items-center justify-center text-slate-300">
        <Icon name="rapport.tillbaka" size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">Råttor hos Brf Exempelgården</p>
        <p className="flex items-center gap-1 truncate text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Sparad 10:42 · Saneringsrapport · version 1 pågår</p>
      </div>
      {ikon('rapport.snygga', 'Snygga till hela rapporten', 'snygga')}
      {ikon('rapport.forhandsgranska', 'Visa som kund', 'visa')}
      {ikon('rapport.skicka', 'Skicka till kund', 'skicka')}
    </div>
  )
}

function Flikrad({ aktiv, tryck }: { aktiv: 'delar' | 'redigera'; tryck: (id: string) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-slate-800 bg-slate-900">
      {([['delar', 'Delar', 'allman.lista'], ['redigera', 'Redigera', 'allman.anteckning'], ['kund', 'Visa som kund', 'rapport.forhandsgranska']] as const).map(([id, namn, ik]) => (
        <button key={id} type="button" onClick={() => tryck(`flik-${id}`)}
          className={`flex h-11 flex-col items-center justify-center gap-0.5 text-[10px] ${aktiv === id ? 'font-bold text-[#20c58f]' : 'text-slate-400'}`}>
          <Icon name={ik} size={16} />{namn}
        </button>
      ))}
    </div>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const harDel = l.namn || ['redigera', 'handelse', 'klart'].includes(l.vy)
  const delar: Del[] = harDel ? [{ nr: 1, titel: 'Förrådet', typ: 'Område', handelser: l.vy === 'klart' ? 1 : 0, farg: '#20c58f' }] : []
  const klara: KlarNyckel[] = [...(harDel ? ['delar' as const] : []), ...(l.vy === 'klart' ? ['handelser' as const] : [])]

  if (l.vy === 'arende' || l.vy === 'ny') {
    return (
      <Telefon>
        <ArendeHuvud nr="BE-0001234" status={<Status text="Pågående" />} kund="Brf Exempelgården · Exempelgatan 12, Solna"
          ikoner={<IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />} />
        <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={1} onClick={() => tryck('flik')} />
        <Kort titel="Arbetsbeskrivning" ikon="allman.anteckning"><Rad v="Spår i förrådet och längs fasaden." /></Kort>
        <div className="m-2.5 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
          <span className="flex flex-none items-center gap-1.5 text-xs font-semibold text-white"><Icon name="rapport.rapport" size={16} className="text-[#20c58f]" />Specialrapporter</span>
          <span className="min-w-0 flex-1 text-[11px] leading-snug text-slate-500">Ingen än. En fri rapport med delar, händelser och bilder.</span>
          <IkonKnapp ikon="allman.plus" etikett="Skapa specialrapport" onClick={() => tryck('plus')} markor={mk(markera, 'plus', nr)} />
        </div>
        <Kort titel="Bilder" ikon="allman.foto"><Rad v="4 bilder" /></Kort>

        {l.vy === 'ny' && (
          <Ark titel="Ny specialrapport" under="Koppla till ett ärende så hämtas kunden till rapporten">
            <div className="rounded-lg border-[1.5px] border-[#20c58f] bg-[#20c58f]/5 px-2 py-1.5 text-xs text-white">
              Brf Exempelgården <span className="font-mono text-[10.5px] text-slate-400">BE-0001234</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Val titel="Börja tomt" text="Lägg till delar efter hand" vald onClick={() => tryck('start-tom')} />
              <Val titel="Börja med kartan" text="Varje område du ritar blir en del" onClick={() => tryck('start-karta')} />
            </div>
            <Falt etikett="Titel" varde="Råttor hos Brf Exempelgården" onClick={() => tryck('titel')} />
            <Knapprad>
              <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
              <PKnapp prim onClick={() => tryck('skapa')} markor={mk(markera, 'skapa', nr)}>Skapa rapport</PKnapp>
            </Knapprad>
          </Ark>
        )}
      </Telefon>
    )
  }

  if (l.vy === 'karta' || l.vy === 'namn') {
    const punkter = HORN.slice(0, l.horn)
    const klar = l.horn >= 3
    return (
      <Telefon>
        <Editorhuvud tryck={tryck} />
        <div className="px-3 py-2">
          <p className="text-sm font-semibold text-white">Översiktskarta</p>
          <p className="text-[11px] text-slate-400">Rita ett område, så blir det en egen del. Kartan är valfri.</p>
        </div>
        <div className="relative mx-3 h-[330px] overflow-hidden rounded-xl border border-slate-700 bg-[linear-gradient(135deg,#3f4f3a,#55624a_40%,#47533f)]">
          <button type="button" aria-label="Kartan" onClick={() => tryck('karta')} className="absolute inset-0" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <rect x="30" y="34" width="38" height="28" fill="#8b8f86" opacity="0.55" />
            {punkter.length >= 2 && (
              <polygon points={punkter.map(p => p.join(',')).join(' ')} fill={l.vy === 'namn' ? '#20c58f55' : '#20c58f33'} stroke="#20c58f" strokeWidth="0.8" />
            )}
          </svg>
          {punkter.map(([x, y], i) => (
            <span key={i} className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#20c58f]" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
          <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-[#20c58f] px-2 py-1 text-[11px] font-semibold text-[#04140d]">
            <Icon name="rapport.omrade" size={16} />{l.vy === 'karta' ? 'Avbryt ritning' : 'Rita område'}
          </span>
          {l.vy === 'karta' && (
            <div className="absolute inset-x-2 bottom-2 grid gap-1.5 rounded-xl bg-slate-950/85 p-2">
              <p className="text-[11px] text-slate-200">
                {l.horn === 0 ? 'Tryck ut områdets hörn ett i taget' : klar ? `${l.horn} hörn. Dra i ett hörn för att justera. Stäng med första hörnet eller Skapa del` : `${l.horn} hörn. Fortsätt, minst tre behövs`}
              </p>
              <div className="flex justify-end gap-1.5">
                <button type="button" aria-label="Ångra senaste punkten" onClick={() => tryck('angra')} className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-600 text-slate-200"><Icon name="rapport.angra" size={16} /></button>
                <Markor markor={mk(markera, 'skapa-del', nr)}>
                  <button type="button" onClick={() => tryck('skapa-del')} className={`rounded-lg px-3 py-1 text-xs font-semibold ${klar ? 'bg-[#20c58f] text-[#04140d]' : 'bg-slate-800 text-slate-500'}`}>Skapa del</button>
                </Markor>
              </div>
            </div>
          )}
          {l.vy === 'namn' && (
            <div className="absolute inset-x-2 bottom-2 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-900 p-2.5">
              <p className="text-xs font-semibold text-white">Vad heter området?</p>
              <Falt etikett="Områdets namn" varde={l.namn ? 'Förrådet' : 'Till exempel Förrådet eller Baksidan'} tom={!l.namn} onClick={() => tryck('namnfalt')} />
              <Knapprad>
                <PKnapp onClick={() => tryck('hoppa')}>Hoppa över</PKnapp>
                <PKnapp prim onClick={() => tryck('spara-namn')} markor={mk(markera, 'spara-namn', nr)}>Spara</PKnapp>
              </Knapprad>
            </div>
          )}
        </div>
      </Telefon>
    )
  }

  // Delar, Redigera och arken ovanpå
  const iRedigera = l.vy === 'redigera' || l.vy === 'handelse' || l.vy === 'klart'
  return (
    <Telefon>
      <Editorhuvud tryck={tryck} />
      <div className="grid h-[430px] content-start gap-2 overflow-hidden p-2.5">
        {iRedigera ? (
          <>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#20c58f] text-xs font-extrabold text-[#fff]">1</span>
              <span className="text-sm font-semibold text-white">Förrådet</span>
            </div>
            <Kort titel="Text" ikon="rapport.text"><Rad v="Beskriv läget med egna ord." /></Kort>
            <Kort titel="Händelser" ikon="rapport.handelser">
              {l.vy === 'klart' ? <Rad v="2026-10-16 · Betning" h="Bild 1" /> : <Rad v="Inga händelser än." />}
            </Kort>
          </>
        ) : (
          <>
            <KlarAttSkicka klara={klara} kompakt />
            <RapportensDelar delar={delar} omraden={delar.length} tryck={tryck} markera={markera} nr={nr} />
          </>
        )}
      </div>
      {iRedigera && (
        <div className="absolute bottom-14 right-3 z-10">
          <Markor markor={mk(markera, 'ny-handelse', nr)}>
            <button type="button" onClick={() => tryck('ny-handelse')}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-[#20c58f] px-3 text-xs font-semibold text-[#04140d] shadow-lg shadow-black/40">
              <Icon name="allman.plus" size={16} />Ny händelse
            </button>
          </Markor>
        </div>
      )}
      <Flikrad aktiv={iRedigera ? 'redigera' : 'delar'} tryck={tryck} />

      {l.vy === 'laggtill' && (
        <Ark titel="Lägg till del" under="Vad ska delen handla om? Du kan ändra det senare.">
          <Val titel="Område" text="En plats du ritar på kartan, till exempel ett hus, en källare eller en del av tomten." onClick={() => tryck('val-omrade')} markor={mk(markera, 'val-omrade', nr)} />
          <Val titel="Besök" text="Vad som gjordes en viss dag, oavsett var." onClick={() => tryck('val-besok')} />
          <Val titel="Underleverantör" text="Arbete som någon annan utförde på vårt uppdrag, till exempel tätning." onClick={() => tryck('val-underlev')} />
          <Val titel="Fritt" text="Valfri rubrik med text och bilder." onClick={() => tryck('val-fritt')} />
        </Ark>
      )}

      {l.vy === 'handelse' && (
        <Ark titel="Ny händelse" under="Råttor hos Brf Exempelgården · BE-0001234">
          <div className="grid gap-1">
            <span className="text-[11.5px] font-medium text-slate-300">Del</span>
            <span className="flex h-11 w-16 flex-col items-center justify-center rounded-lg border-[1.5px] border-[#20c58f] bg-[#20c58f]/10">
              <span className="text-sm font-extrabold text-[#20c58f]">1</span><span className="text-[10px] text-slate-400">Förrådet</span>
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-[11.5px] font-medium text-slate-300">Vad har du gjort?</span>
            <div className="grid grid-cols-4 gap-1">
              {TYPER.map(t => (
                <button key={t.id} type="button" onClick={() => tryck(`typ-${t.id}`)} aria-pressed={l.typ === t.id}
                  className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border-[1.5px] text-[10px] text-slate-200 ${l.typ === t.id ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700/60'}`}>
                  <Icon name={t.ikon} size={16} />{t.namn}
                </button>
              ))}
            </div>
          </div>
          <Falt etikett="Rubrik" varde={l.typ ? TYPER.find(t => t.id === l.typ)!.namn : 'Rubrik'} tom={!l.typ} onClick={() => tryck('rubrik')} />
          <Markor markor={mk(markera, 'spara-handelse', nr)} block>
            <button type="button" onClick={() => tryck('spara-handelse')} aria-disabled={!l.typ}
              className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#20c58f] text-xs font-semibold text-[#04140d] ${l.typ ? '' : 'opacity-50'}`}>
              <Icon name="allman.bock" size={16} />Spara i rapporten
            </button>
          </Markor>
        </Ark>
      )}

      {l.vy === 'klart' && <Notis text="Händelsen är sparad i rapporten" />}
    </Telefon>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'arende', horn: 0, namn: false, typ: null }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'plus' },
  { lage: { ...BAS, vy: 'ny' }, markera: 'skapa' },
  { lage: { ...BAS, vy: 'delar' }, markera: 'lagg-till-del' },
  { lage: { ...BAS, vy: 'laggtill' }, markera: 'val-omrade' },
  { lage: { ...BAS, vy: 'karta', horn: 4 }, markera: 'skapa-del' },
  { lage: { ...BAS, vy: 'redigera', namn: true }, markera: 'ny-handelse' },
  { lage: { ...BAS, vy: 'handelse', namn: true, typ: 'betning' }, markera: 'spara-handelse' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendets Utförande-flik. Leta upp rutan för specialrapporter.' }

const TIPS: Record<string, string> = {
  historik: 'Klockan är ärendehistoriken. Rapporten skapar du i rutan Specialrapporter.',
  flik: 'Du är redan på rätt flik. Rutan Specialrapporter har en plusknapp.',
  'start-karta': 'Det går också, men börja tomt i den här övningen. Du lägger till området efteråt.',
  titel: 'Titeln är redan ifylld från ärendet. Den duger.',
  avbryt: 'Avbryt stänger rutan. Tryck Skapa rapport i stället.',
  tillbaka: 'Pilen tar dig tillbaka. Allt sparas, men uppdraget är inte klart.',
  snygga: 'Snygga till läser igenom texten. Det finns ingen text än, rita området först.',
  visa: 'Visa som kund visar sidan kunden får. Rapporten är tom än så länge.',
  skicka: 'Rapporten ska inte skickas än. Den saknar både område och händelse.',
  om: 'Om rapporten har kund och inledning. Uppdraget var att rita förrådet.',
  oversikt: 'Kartan går också, men lägg till en del så öppnas den direkt.',
  samm: 'Bedömningen skriver du sist. Börja med en del för förrådet.',
  'val-besok': 'Besök är en dag, oavsett var. Förrådet är en plats, alltså ett område.',
  'val-underlev': 'Underleverantör är arbete som någon annan har gjort. Förrådet är en plats.',
  'val-fritt': 'Fritt har ingen plats på kartan. Välj Område.',
  angra: 'Ångra tar bort senaste hörnet. Tryck hellre ut fler hörn på kartan.',
  hoppa: 'Då blir delen Utan rubrik. Skriv namnet Förrådet först.',
  rubrik: 'Rubriken fylls i när du väljer vad du har gjort.',
  'flik-delar': 'Delar visar listan. Händelsen lägger du till med den gröna knappen.',
  'flik-redigera': 'Du är redan i Redigera.',
  'flik-kund': 'Visa som kund visar sidan, men uppdraget var en betning i förrådet.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    switch (l.vy) {
      case 'arende':
        if (id === 'plus') { setL({ ...l, vy: 'ny' }); tips('Ny specialrapport', 'Ärendet och titeln är redan ifyllda. Börja tomt och skapa rapporten.') }
        else miss(TIPS[id] ?? 'Tryck på plus i rutan Specialrapporter.')
        return
      case 'ny':
        if (id === 'skapa') { setL({ ...l, vy: 'delar' }); tips('Rapporten är skapad', 'Listan Rapportens delar är tom. Lägg till en del för förrådet.') }
        else if (id === 'start-tom') tips('Börja tomt', 'Redan valt. Tryck Skapa rapport.')
        else miss(TIPS[id] ?? 'Tryck Skapa rapport.')
        return
      case 'delar':
        if (id === 'lagg-till-del') { setL({ ...l, vy: 'laggtill' }); tips('Vilken sorts del?', 'Förrådet är en plats på tomten.') }
        else miss(TIPS[id] ?? 'Tryck Lägg till del.')
        return
      case 'laggtill':
        if (id === 'val-omrade') { setL({ ...l, vy: 'karta' }); tips('Kartan', 'Tryck ut förrådets hörn på kartan, minst tre.') }
        else miss(TIPS[id] ?? 'Välj Område.')
        return
      case 'karta':
        if (id === 'karta') {
          const horn = Math.min(l.horn + 1, HORN.length)
          setL({ ...l, horn })
          tips(`${horn} hörn`, horn >= 3 ? 'Området går att stänga. Tryck Skapa del, eller ett hörn till om du vill.' : 'Fortsätt, minst tre hörn behövs.')
        } else if (id === 'skapa-del') {
          if (l.horn < 3) miss('Det behövs minst tre hörn. Tryck på kartan där förrådets hörn är.')
          else { setL({ ...l, vy: 'namn' }); tips('Namnge området', 'Skriv Förrådet och spara.') }
        } else if (id === 'angra') { setL({ ...l, horn: Math.max(0, l.horn - 1) }); tips('Hörnet borttaget', 'Tryck ut hörnet igen på kartan.') }
        else miss(TIPS[id] ?? 'Tryck ut hörnen på kartan och tryck Skapa del.')
        return
      case 'namn':
        if (id === 'namnfalt') { setL({ ...l, namn: true }); tips('Förrådet', 'Tryck Spara.') }
        else if (id === 'spara-namn') {
          if (!l.namn) miss('Skriv namnet först, tryck i fältet.')
          else { setL({ ...l, vy: 'redigera' }); tips('Delen är skapad', 'Del 1 Förrådet är öppen. Lägg in betningen med den gröna knappen.') }
        } else miss(TIPS[id] ?? 'Skriv namnet och tryck Spara.')
        return
      case 'redigera':
        if (id === 'ny-handelse') { setL({ ...l, vy: 'handelse' }); tips('Ny händelse', 'Del 1 Förrådet är förvald. Välj vad du har gjort.') }
        else miss(TIPS[id] ?? 'Tryck Ny händelse.')
        return
      case 'handelse':
        if (id.startsWith('typ-')) {
          const typ = id.replace('typ-', '') as Typ
          setL({ ...l, typ })
          if (typ === 'betning') tips('Betning', 'Rubriken blev Betning. Tryck Spara i rapporten.')
          else miss(typ === 'avvikelse' ? 'Avvikelse är för sådant kunden behöver åtgärda. Du har lagt ut bete, alltså Betning.' : 'Du har lagt ut bete. Välj Betning.')
        } else if (id === 'spara-handelse') {
          if (!l.typ) miss('Välj vad du har gjort först.')
          else if (l.typ !== 'betning') miss('Uppdraget var en betning. Välj Betning innan du sparar.')
          else {
            setL({ ...l, vy: 'klart' })
            setSvar({
              typ: 'ok',
              titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
              text: `Rapporten har nu del 1 Förrådet med en betning. Allt sparas medan du arbetar, och rapporten finns kvar på ärendet.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
            })
          }
        } else miss(TIPS[id] ?? 'Välj Betning och tryck Spara i rapporten.')
        return
      default:
    }
  }

  const framsteg = { arende: 0, ny: 1, delar: 2, laggtill: 3, karta: 4, namn: 5, redigera: 5, handelse: 6, klart: 7 }[l.vy]
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
