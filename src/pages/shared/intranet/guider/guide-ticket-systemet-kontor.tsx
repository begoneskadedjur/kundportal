// src/pages/shared/intranet/guider/guide-ticket-systemet-kontor.tsx
// Guidemodul: Ta hand om tickets till kontoret (admin och koordinator, dator).
// Sidan hette Tickets fram till 2026-10-23 (3.89.0). Slugen behålls så att länkar fungerar.
// Efterbildning av coordinatorNavConfig (Planering › Tickets), InternAdministration
// (Min inkorg och Alla, filtren Till, Från, Ärendetyp, Status och Bara olästa, sammanfattningen
// "1 till en roll utan svar, 1 väntar på en person, 0 besvarade men inte klara"), kontorets
// grupper i Alla (Till en roll eller alla, ingen har svarat, Väntar på en person, Besvarade,
// inte klara, Klara, Anteckningar utan mottagare) och TradVy (Jag tar den med toasten
// "Tråden väntar nu på dig", Svar till Erik, Skicka svar med toasten "Svaret skickades").
// Statustexterna följer fragorLogik.analysKontor. Påhittade namn, ingenting skickas.

import { useState } from 'react'
import { Dator, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { gorMk, type Mk, type Tryck } from './_arenden'
import { KontorSida } from './_allmant'
import {
  Grupp, Knapp, LageFlikar, Namn, SidHuvud, SokRuta, Trad, TradRad, UnderGrupp,
  type ArendeKort, type Deltagare, type Inlagg, type RadData,
} from './_fragor'

type Vy = 'arenden' | 'min' | 'alla' | 'tagen' | 'skriven' | 'svarad'

const ERIK_FRAGA = 'Kunden vill flytta besöket till fredag. Kan någon boka om?'
const SARA_FRAGA = 'Kan du ringa Brf Exempelgården i dag?'
const MITT_SVAR = 'Jag bokar om till fredag 08:00 och ringer kunden.'

const ARENDE_ERIK: ArendeKort = {
  kund: 'Familjen Exempel', nummer: 'BE-0001234',
  rad: 'Råttor, Exempelvägen 4, Södertälje', info: 'Privat, bokat 2026-10-23 13:00 hos Erik, bokad',
}
const ARENDE_SARA: ArendeKort = {
  kund: 'Brf Exempelgården', nummer: 'BE-0001240',
  rad: 'Myror, Exempelgatan 2, Huddinge', info: 'Företag, inte bokat',
}

const SARA_RAD = (status: string): RadData => ({
  id: 'rad-sara', amne: SARA_FRAGA, ton: 'bla', status, tid: '09:30', kund: 'Brf Exempelgården',
  franTill: 'Sara till dig', motpart: 'Sara Exempel', nummer: 'BE-0001240',
})

function erikRad(vy: Vy): RadData {
  const bas = { id: 'rad-erik', amne: ERIK_FRAGA, kund: 'Familjen Exempel', franTill: 'Erik till koordinatorerna', motpart: 'Erik Exempel', nummer: 'BE-0001234' }
  if (vy === 'min') return { ...bas, ton: 'gra', status: 'För kännedom, till koordinatorerna', tid: '09:35', olast: true }
  if (vy === 'alla') return { ...bas, ton: 'bla', status: 'Väntat 40 minuter', tid: '09:35', olast: true }
  if (vy === 'svarad') return { ...bas, ton: 'gron', status: 'Anna svarade 10:16', tid: '10:16', citat: MITT_SVAR }
  return { ...bas, ton: 'bla', status: 'Väntar på dig sedan 10:15', tid: '10:15', citat: 'Jag tar den.' }
}

// ─── Listan ───

function Filter({ tryck }: { tryck: Tryck }) {
  const val: [string, string, string][] = [['filter-till', 'Till', 'Alla mottagare'], ['filter-fran', 'Från', 'Alla'], ['filter-typ', 'Ärendetyp', 'Alla'], ['filter-status', 'Status', 'Öppna']]
  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {val.map(([id, etikett, varde]) => (
        <label key={id} className="grid gap-0.5 text-[10px] text-slate-400">
          {etikett}
          <button type="button" onClick={() => tryck(id)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-left text-[10.5px] text-white">{varde}</button>
        </label>
      ))}
      <button type="button" onClick={() => tryck('filter-olasta')} className="flex items-center gap-1 py-1 text-[10.5px] text-slate-200">
        <span aria-hidden className="h-3 w-3 rounded border border-slate-500" />Bara olästa
      </button>
    </div>
  )
}

function Lista({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  if (vy === 'min') {
    return <>
      <Grupp ikon="falt.attgora" farg="text-amber-500" rubrik="Väntar på dig" antal={1} text="Någon har frågat dig något eller svarat på din fråga.">
        <UnderGrupp rubrik="Frågor till dig" antal={1} />
        <TradRad dator vald r={{ ...SARA_RAD('Sara väntar på ditt svar sedan 09:30'), nummer: undefined }} mk={mk} tryck={tryck} />
      </Grupp>
      <Grupp ikon="falt.vantar" rubrik="Du väntar på svar" antal={0} text="Du har frågat. Svaret hamnar under Väntar på dig." />
      <Grupp ikon="dok.omnamnd" rubrik="Omnämnd, för kännedom" antal={1} text="Skickat till en grupp du hör till, eller trådar du är med i där inget väntar på dig.">
        <TradRad dator r={{ ...erikRad('min'), nummer: undefined }} mk={mk} tryck={tryck} />
      </Grupp>
      <Grupp ikon="falt.klart" farg="text-[#20c58f]" rubrik="Klara" antal={12} hopfalld id="grupp-klara" mk={mk} tryck={tryck}
        text="Markerade som klara, senast klara först. Ett nytt svar öppnar tråden igen." />
    </>
  }
  const erik = erikRad(vy)
  const roll = vy === 'alla' ? [erik] : []
  const person = vy === 'tagen' || vy === 'skriven' ? [erik, SARA_RAD('Väntar på dig sedan 09:30')] : [SARA_RAD('Väntar på dig sedan 09:30')]
  const besvarad = vy === 'svarad' ? [erik] : []
  return <>
    <Grupp ikon="dok.omnamnd" farg="text-amber-500" rubrik="Till en roll eller alla, ingen har svarat" antal={roll.length}
      text="Skickat till admin, koordinatorerna, alla tekniker eller alla. Svara eller välj Jag tar den.">
      {roll.map(r => <TradRad key={r.id} dator vald r={r} mk={mk} tryck={tryck} />)}
    </Grupp>
    <Grupp ikon="falt.vantar" rubrik="Väntar på en person" antal={person.length} text="En namngiven kollega är tillfrågad och har inte svarat.">
      {person.map(r => <TradRad key={r.id} dator vald={r.id === 'rad-erik'} r={r} mk={mk} tryck={tryck} />)}
    </Grupp>
    <Grupp ikon="dok.konversation" rubrik="Besvarade, inte klara" antal={besvarad.length} text="Någon har svarat. Den som frågade markerar som klar.">
      {besvarad.map(r => <TradRad key={r.id} dator vald r={r} mk={mk} tryck={tryck} />)}
    </Grupp>
    <Grupp ikon="falt.klart" farg="text-[#20c58f]" rubrik="Klara" antal={12} hopfalld id="grupp-klara" mk={mk} tryck={tryck}
      text="Markerade som klara, alla, senast klara först." />
    <Grupp ikon="allman.anteckning" rubrik="Anteckningar utan mottagare" antal={3} hopfalld id="grupp-anteckning" mk={mk} tryck={tryck}
      text="Noteringar i ärenden, till exempel fakturanummer. Ingen väntar på svar." />
  </>
}

// ─── Tråden till höger ───

function SarasTrad({ mk, tryck }: { mk: Mk; tryck: Tryck }) {
  return (
    <Trad
      amne={SARA_FRAGA} ton="bla" status="Sara väntar på ditt svar sedan 09:30"
      knappar={<Knapp id="klar" ikon="allman.bock" prim mk={mk} tryck={tryck}>Markera som klar</Knapp>}
      hjalp arende={ARENDE_SARA}
      med={[
        { namn: 'Sara Exempel', beskrivning: 'Admin, startade tråden', ton: 'gra', lage: 'Väntar på svar' },
        { namn: 'Du', beskrivning: 'Tillfrågad', ton: 'bla', lage: 'Väntar på dig' },
      ]}
      inlagg={[{ id: 's1', namn: 'Sara Exempel', roll: 'admin', tid: '2026-10-23 09:30', text: <><Namn>@Anna Exempel</Namn> {SARA_FRAGA}</> }]}
      svar={{ etikett: 'Svar till Sara', text: '', hint: 'Ctrl + Enter skickar' }}
      mk={mk} tryck={tryck}
    />
  )
}

function EriksTrad({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const tagen = vy !== 'alla'
  const svarad = vy === 'svarad'
  const med: Deltagare[] = [{ namn: 'Erik Exempel', beskrivning: 'Tekniker, startade tråden', ton: 'gra', lage: tagen ? undefined : 'Väntar på svar' }]
  if (tagen) med.push({ namn: 'Du', beskrivning: 'Tog den', ton: svarad ? 'gron' : 'bla', lage: svarad ? 'Har svarat' : 'Väntar på dig' })
  med.push({ namn: 'Koordinatorerna', beskrivning: 'Grupp', grupp: true, ton: tagen ? 'gron' : 'gra', lage: tagen ? 'Någon har svarat' : 'Ingen har svarat' })
  const inlagg: Inlagg[] = [{ id: 'e1', namn: 'Erik Exempel', roll: 'tekniker', tid: '2026-10-23 09:35', text: <><Namn>@koordinator</Namn> {ERIK_FRAGA}</> }]
  if (tagen) inlagg.push({ id: 'e2', namn: 'Anna Exempel', egen: true, tid: '2026-10-23 10:15', text: 'Jag tar den.' })
  if (svarad) inlagg.push({ id: 'e3', namn: 'Anna Exempel', egen: true, tid: '2026-10-23 10:16', text: MITT_SVAR })
  return (
    <Trad
      amne={ERIK_FRAGA}
      ton={svarad ? 'gron' : 'bla'}
      status={svarad ? 'Anna svarade 10:16' : tagen ? 'Väntar på dig sedan 10:15' : 'Väntat 40 minuter'}
      knappar={<>
        {!tagen && <Knapp id="ta-den" ikon="allman.hand" mk={mk} tryck={tryck}>Jag tar den</Knapp>}
        <Knapp id="klar" ikon="allman.bock" prim mk={mk} tryck={tryck}>Markera som klar</Knapp>
      </>}
      hjalp arende={ARENDE_ERIK} med={med} inlagg={inlagg}
      svar={{ etikett: 'Svar till Erik', text: vy === 'skriven' ? MITT_SVAR : '', hint: tagen ? 'Ctrl + Enter skickar' : 'Jag tar den gör tråden din' }}
      mk={mk} tryck={tryck}
    />
  )
}

// ─── Skärmen ───

const NOTIS: Partial<Record<Vy, string>> = { tagen: 'Tråden väntar nu på dig', svarad: 'Svaret skickades' }

function Skarm({ vy, markera, nr, tryck }: { vy: Vy; markera?: string; nr: number; tryck: Tryck }) {
  const mk = gorMk(markera, nr)
  const pa = vy !== 'arenden'
  const siffra = vy === 'tagen' || vy === 'skriven' ? 2 : 1
  const allaText = vy === 'alla' ? '1 till en roll utan svar, 1 väntar på en person, 0 besvarade men inte klara'
    : vy === 'svarad' ? '0 till en roll utan svar, 1 väntar på en person, 1 besvarade men inte klara'
    : '0 till en roll utan svar, 2 väntar på en person, 0 besvarade men inte klara'
  return (
    <Dator adress={pa ? 'koordinator › tickets' : 'koordinator › arenden'}>
      <KontorSida sida={pa ? 'Tickets' : 'Ärenden'} aktivPost={pa ? 'Tickets' : 'Ärenden'} siffra={siffra} tryck={tryck} markera={markera} nr={nr}>
        {!pa ? (
          <div className="grid gap-2">
            <p className="text-[15px] font-bold text-white">Ärenden</p>
            <p className="text-[11px] text-slate-400">Du arbetar i Ärenden. Frågorna till kontoret ligger på en egen sida.</p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <SidHuvud dator vantar={siffra} jagVantar={0} alla={vy === 'min' ? undefined : allaText} mk={mk} tryck={tryck} />
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 content-start gap-2.5">
                <LageFlikar alla={vy !== 'min'} mk={mk} tryck={tryck} />
                <SokRuta tryck={tryck} />
                {vy !== 'min' && <Filter tryck={tryck} />}
                <Lista vy={vy} mk={mk} tryck={tryck} />
              </div>
              <div className="min-w-0">
                {vy === 'min' ? <SarasTrad mk={mk} tryck={tryck} /> : <EriksTrad vy={vy} mk={mk} tryck={tryck} />}
              </div>
            </div>
          </div>
        )}
        {NOTIS[vy] && <Notis text={NOTIS[vy]!} />}
      </KontorSida>
    </Dator>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arenden', markera: 'post-Tickets' },
  { vy: 'min', markera: 'flik-alla' },
  { vy: 'alla', markera: 'ta-den' },
  { vy: 'tagen', markera: 'svar-falt' },
  { vy: 'skriven', markera: 'skicka-svar' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i Ärenden. Teknikern Erik har frågat koordinatorerna om ett besök. Hitta frågan, ta den och svara Erik.' }

const TIPS: Record<string, string> = {
  cta: 'Öppna schema öppnar planeringen.',
  gul: 'Den gula knappen är för tillbud, avvikelser och olyckor.',
  sok: 'Sök i systemet letar efter ärenden och kunder.',
  'sok-sida': 'Sökrutan letar bland trådarna. Eriks fråga syns redan.',
  intranat: 'Intranätet har handboken och policyerna.',
  uppdateringar: 'Uppdateringar visar nyheter i portalen.',
  'mitt-konto': 'Mitt konto är dina uppgifter.',
  'logga-ut': 'Då loggas du ut.',
  ny: 'Ny ticket skriver en ny fråga. Här ska du svara på Eriks.',
  'rad-sara': 'Saras fråga är till dig personligen och ligger kvar. Uppdraget gäller Eriks fråga till koordinatorerna.',
  'grupp-klara': 'Klara är trådar som redan är avslutade.',
  'grupp-anteckning': 'Anteckningar utan mottagare är noteringar i ärenden. Ingen väntar på svar.',
  'filter-till': 'Filtren behövs inte nu. Eriks fråga syns redan.',
  'filter-fran': 'Filtren behövs inte nu. Eriks fråga syns redan.',
  'filter-typ': 'Filtren behövs inte nu. Eriks fråga syns redan.',
  'filter-status': 'Filtren behövs inte nu. Eriks fråga syns redan.',
  'filter-olasta': 'Filtren behövs inte nu. Eriks fråga syns redan.',
  'oppna-arende': 'Öppna ärendet visar hela ärendet. Ta frågan och svara först.',
  'visa-komm': 'Visa i ärendets kommunikation visar samma tråd i ärendet. Du svarar lika gärna här.',
  'ta-bild': 'En bild behövs inte i svaret.',
  'valj-fil': 'En fil behövs inte i svaret.',
  'namn-knapp': 'Du behöver inte nämna någon. Svaret går till Erik ändå.',
}

const FRAMSTEG: Record<Vy, number> = { arenden: 0, min: 1, alla: 2, tagen: 3, skriven: 4, svarad: 5 }

function Ovning() {
  const [vy, setVy] = useState<Vy>('arenden')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); tips(titel, text) }
  const annars = (id: string, rad: string) => miss(TIPS[id] ? `${TIPS[id]} ${rad}` : rad)

  const tryck = (id: string) => {
    if (vy === 'svarad') return
    switch (vy) {
      case 'arenden':
        if (id === 'post-Tickets' || id === 'notis') ga('min', 'Min inkorg', 'Sidan öppnas på Min inkorg. Eriks fråga till koordinatorerna ligger under Omnämnd, för kännedom. Byt till Alla för att se alla frågor som väntar på kontoret.')
        else if (id.startsWith('post-') || id.startsWith('grupp-')) miss('Tickets ligger i menyn under Planering, eller bakom klockan uppe till höger.')
        else annars(id, 'Tryck Tickets i menyn under Planering.')
        break
      case 'min':
        if (id === 'flik-alla') ga('alla', 'Alla', 'Eriks fråga ligger överst under Till en roll eller alla, ingen har svarat, och är öppen till höger. Ta den, så vet de andra koordinatorerna att du svarar.')
        else if (id === 'rad-erik') tips('Det går också', 'Men i Alla ser du alla frågor till en roll som ingen har tagit. Tryck Alla.')
        else if (id === 'flik-min') tips('Du står i Min inkorg', 'Tryck Alla.')
        else if (id === 'klar') miss('Markera som klar avslutar Saras tråd. Uppdraget gäller Eriks fråga. Tryck Alla.')
        else if (id === 'svar-falt' || id === 'skicka-svar') miss('Rutan svarar Sara. Uppdraget gäller Eriks fråga. Tryck Alla.')
        else annars(id, 'Tryck Alla ovanför sökrutan.')
        break
      case 'alla':
        if (id === 'ta-den') ga('tagen', 'Tråden väntar nu på dig', 'Under Vem är med står du nu med Tog den, och tråden flyttade till Väntar på en person. Tryck i rutan Svar till Erik och skriv svaret.')
        else if (id === 'rad-erik') tips('Eriks fråga är redan öppen', 'Tryck Jag tar den till höger.')
        else if (id === 'flik-min') miss('Min inkorg visar det som kräver något av dig. Stanna i Alla och tryck Jag tar den.')
        else if (id === 'klar') miss('Markera som klar avslutar tråden utan att Erik får svar. Ta den och svara först.')
        else if (id === 'svar-falt' || id === 'skicka-svar') miss('Svara gärna, men ta den först. Då vet de andra koordinatorerna att du har den.')
        else annars(id, 'Tryck Jag tar den.')
        break
      case 'tagen':
        if (id === 'svar-falt') ga('skriven', 'Svaret är skrivet', 'Tryck Skicka svar.')
        else if (id === 'skicka-svar') miss('Rutan är tom. Skriv svaret först.')
        else if (id === 'klar') miss('Svara Erik först. Den som frågade markerar som klar.')
        else annars(id, 'Tryck i rutan Svar till Erik och skriv svaret.')
        break
      case 'skriven':
        if (id === 'skicka-svar') {
          setVy('svarad')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Du tog Eriks fråga och svarade honom. Tråden ligger under Besvarade, inte klara, och Erik får svaret under Svar till dig. Han markerar den som klar när han har läst.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        } else if (id === 'svar-falt') tips('Svaret står redan där', 'Tryck Skicka svar.')
        else if (id === 'klar') miss('Skicka svaret först, annars får Erik inget svar.')
        else annars(id, 'Tryck Skicka svar.')
        break
    }
  }

  return (
    <OvningRam bred framsteg={FRAMSTEG[vy]} totalt={5} svar={svar} onBorjaOm={() => { setVy('arenden'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} nr={0} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
