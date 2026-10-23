// src/pages/shared/intranet/guider/guide-ticket-systemet.tsx
// Guidemodul: Fråga en kollega och svara i Frågor och uppdrag (tekniker, telefon).
// Sidan hette Tickets fram till 2026-10-23 (3.89.0). Slugen behålls så att länkar fungerar.
// Efterbildning av TechnicianMobileNav (klockan Notifieringar, Meny), InternAdministration
// ("0 väntar på dig, du väntar på svar i 0", Ny fråga eller uppdrag, grupperna Väntar på dig
// med Svar till dig, Du väntar på svar, Omnämnd, för kännedom och Klara), NyFragaDialog
// (1 Till vem?, En kollega, En roll, Alla, Sök kollega, 2 Om vilket ärende?, Förslag: dina
// ärenden i dag och i morgon, 3 Vad gäller det?, Meddelande, 4 Bild eller fil, Skicka till
// Anna, toasten "Skickat till Anna") och TradVy (Markera som klar, toasten "Markerad som
// klar", Nytt sedan du läste, Läst av). Påhittade namn, ingenting skickas.

import { useState, type ReactNode } from 'react'
import { Markor, Notis, OvningRam, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { gorMk, type Mk, type Tryck } from './_arenden'
import { TeknikerBotten, TeknikerHuvud } from './_allmant'
import { Bokstav, Grupp, Knapp, Namn, SidHuvud, SokRuta, Trad, TradRad, UnderGrupp, type ArendeKort, type Inlagg, type RadData } from './_fragor'
import { Icon } from '../../../../components/icons/Icon'

type Vy = 'lista' | 'd-vem' | 'd-arende' | 'd-text' | 'd-klar' | 'skickad' | 'lista-svar' | 'trad-svar' | 'klar'

const FRAGA = 'Vill kunden ha kvittot på mejl?'
const ANNA_SVAR = 'Ja, till kund@exempel.se. Skicka det i dag.'

const ARENDE: ArendeKort = {
  kund: 'Familjen Exempel', nummer: 'BE-0001234',
  rad: 'Råttor, Exempelvägen 4, Södertälje', info: 'Privat, bokat 2026-10-23 13:00 hos dig, bokad',
}

const RAD_SVAR: RadData = {
  id: 'rad', amne: FRAGA, ton: 'gron', status: 'Anna svarade 10:40, läs och markera som klar',
  citat: ANNA_SVAR, tid: '10:40', kund: 'Familjen Exempel', franTill: 'Du till Anna', motpart: 'Anna Exempel', olast: true,
}

// ─── Listan ───

function Lista({ svar, mk, tryck }: { svar: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <div className="grid content-start gap-2.5 p-2.5">
      <SidHuvud vantar={svar ? 1 : 0} jagVantar={0} mk={mk} tryck={tryck} />
      <SokRuta tryck={tryck} />
      <Grupp ikon="falt.attgora" farg="text-amber-500" rubrik="Väntar på dig" antal={svar ? 1 : 0} text="Någon har frågat dig något eller svarat på din fråga.">
        {svar && <><UnderGrupp rubrik="Svar till dig" antal={1} /><TradRad r={RAD_SVAR} mk={mk} tryck={tryck} /></>}
      </Grupp>
      <Grupp ikon="falt.vantar" rubrik="Du väntar på svar" antal={0} text="Du har frågat. Svaret hamnar under Väntar på dig." />
      <Grupp ikon="dok.omnamnd" rubrik="Omnämnd, för kännedom" antal={0} text="Skickat till en grupp du hör till, eller trådar du är med i där inget väntar på dig." />
      <Grupp ikon="falt.klart" farg="text-[#20c58f]" rubrik="Klara" antal={4} hopfalld id="grupp-klara" mk={mk} tryck={tryck}
        text="Markerade som klara, senast klara först. Ett nytt svar öppnar tråden igen." />
    </div>
  )
}

// ─── Dialogen Ny fråga eller uppdrag ───

function Steg({ n, titel }: { n: number; titel: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
      <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 font-mono text-[10px] text-slate-300">{n}</span>
      {titel}
    </p>
  )
}

function ValKort({ id, ikon, titel, text, aktiv, mk, tryck }: { id: string; ikon: 'rapport.person' | 'dok.omnamnd' | 'allman.foretag'; titel: string; text: string; aktiv?: boolean; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left ${aktiv ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-900'}`}>
        <Icon name={ikon} size={16} className="flex-none text-slate-300" />
        <span><span className="block text-[11px] font-semibold text-white">{titel}</span><span className="block text-[10px] text-slate-400">{text}</span></span>
      </button>
    </Markor>
  )
}

function Rad({ id, namn, under, ikon, mk, tryck }: { id: string; namn: ReactNode; under: string; ikon: ReactNode; mk: Mk; tryck: Tryck }) {
  return (
    <Markor markor={mk(id)} block>
      <button type="button" onClick={() => tryck(id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-800">
        {ikon}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] text-white">{namn}</span>
          <span className="block truncate text-[10px] text-slate-400">{under}</span>
        </span>
      </button>
    </Markor>
  )
}

function Dialog({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const anna = vy !== 'd-vem'
  const arende = vy === 'd-text' || vy === 'd-klar'
  const text = vy === 'd-klar'
  const fran = vy === 'd-vem' ? 1 : vy === 'd-klar' ? 3 : 2
  const kan = anna && arende && text

  const delar: { n: number; innehall: ReactNode }[] = [
    {
      n: 1,
      innehall: <>
        <Steg n={1} titel="Till vem?" />
        <ValKort id="typ-personer" ikon="rapport.person" titel="En kollega" text="En eller flera personer" aktiv mk={mk} tryck={tryck} />
        <ValKort id="typ-roll" ikon="dok.omnamnd" titel="En roll" text="Admin, koordinator eller tekniker" mk={mk} tryck={tryck} />
        <ValKort id="typ-alla" ikon="allman.foretag" titel="Alla" text="För kännedom, 12 personer" mk={mk} tryck={tryck} />
        <button type="button" onClick={() => tryck('sok-kollega')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-left text-[10.5px] text-slate-500">
          <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-400" />Sök kollega
        </button>
        <div className="grid">
          <Rad id="kollega-anna" namn="Anna Exempel" under="Koordinator" ikon={<Bokstav namn="Anna" />} mk={mk} tryck={tryck} />
          <Rad id="kollega-jonas" namn="Jonas Exempel" under="Tekniker" ikon={<Bokstav namn="Jonas" />} mk={mk} tryck={tryck} />
          <Rad id="kollega-sara" namn="Sara Exempel" under="Admin" ikon={<Bokstav namn="Sara" />} mk={mk} tryck={tryck} />
        </div>
      </>,
    },
    {
      n: 2,
      innehall: <>
        <Steg n={2} titel="Om vilket ärende?" />
        <p className="text-[10px] text-slate-400">Tråden sparas i ärendet, så den som öppnar ärendet ser den också. Kunden ser den aldrig.</p>
        {arende ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#20c58f]/40 bg-[#20c58f]/5 px-2 py-1.5">
            <Icon name="arende.privat" size={16} className="flex-none text-slate-300" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-white">Familjen Exempel <span className="font-mono text-[10px] font-normal text-slate-400">BE-0001234</span></span>
              <span className="block truncate text-[10px] text-slate-400">2026-10-23 13:00, Råttor, Exempelvägen 4</span>
            </span>
            <button type="button" onClick={() => tryck('byt-arende')} className="rounded-lg border border-slate-600 px-1.5 py-0.5 text-[10px] text-white">Byt ärende</button>
          </div>
        ) : <>
          <button type="button" onClick={() => tryck('sok-arende')} className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2 py-1 text-left text-[10.5px] text-slate-500">
            <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 text-slate-400" />Sök på ärendenummer, kund eller adress
          </button>
          <p className="text-[10px] text-slate-400">Förslag: dina ärenden i dag och i morgon. Sök för andra.</p>
          <div className="grid gap-1">
            <Rad id="arende-familj" namn={<>Familjen Exempel <span className="font-mono text-[10px] text-slate-400">BE-0001234</span></>} under="2026-10-23 13:00, Råttor, Exempelvägen 4" ikon={<Icon name="arende.privat" size={16} className="flex-none text-slate-400" />} mk={mk} tryck={tryck} />
            <Rad id="arende-brf" namn={<>Brf Exempelgården <span className="font-mono text-[10px] text-slate-400">BE-0001240</span></>} under="2026-10-24 08:00, Myror, Exempelgatan 2" ikon={<Icon name="allman.foretag" size={16} className="flex-none text-slate-400" />} mk={mk} tryck={tryck} />
          </div>
        </>}
      </>,
    },
    {
      n: 3,
      innehall: <>
        <Steg n={3} titel="Vad gäller det?" />
        <p className="text-[10.5px] font-medium text-slate-300">Meddelande</p>
        <Markor markor={mk('meddelande')} block>
          <button type="button" onClick={() => tryck('meddelande')} className={`block min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-left text-[11px] ${text ? 'text-white' : 'text-slate-500'}`}>
            {text ? FRAGA : ' '}
          </button>
        </Markor>
        <p className="text-[10px] text-slate-400">Skriv som om du ringde: vad behöver du, och till när.</p>
      </>,
    },
    {
      n: 4,
      innehall: <>
        <Steg n={4} titel="Bild eller fil" />
        <p className="text-[10px] text-slate-400">Valfritt. Bilder och PDF upp till 5 MB.</p>
        <div className="flex gap-1.5">
          <Knapp id="ta-bild" ikon="allman.foto" mk={mk} tryck={tryck}>Ta bild</Knapp>
          <Knapp id="valj-fil" ikon="rapport.gem" mk={mk} tryck={tryck}>Välj fil</Knapp>
        </div>
      </>,
    },
  ]

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/60">
      <section className="flex max-h-[96%] w-full flex-col rounded-t-2xl border-t border-slate-700 bg-slate-900">
        <header className="flex items-start justify-between gap-2 border-b border-slate-700/60 px-3 pb-2 pt-2.5">
          <div>
            <p className="text-[13px] font-semibold text-white">Ny fråga eller uppdrag</p>
            <p className="text-[10px] text-slate-400">Den du skickar till får en notis och ser tråden under Väntar på dig.</p>
          </div>
          <button type="button" onClick={() => tryck('stang')} aria-label="Stäng" className="p-1 text-slate-400"><Icon name="allman.stang" size={16} /></button>
        </header>
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-hidden px-3 py-2.5">
          {delar.filter(d => d.n >= fran).map(d => <div key={d.n} className="grid gap-1.5">{d.innehall}</div>)}
        </div>
        <footer className="grid gap-1.5 border-t border-slate-700/60 px-3 py-2">
          <p className="text-[10px] text-slate-400">{anna ? 'Anna får en notis direkt.' : 'Välj vem som ska få frågan.'}</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => tryck('avbryt')} className="flex-1 rounded-lg border border-slate-600 px-2 py-1.5 text-[11px] font-medium text-white">Avbryt</button>
            <Markor markor={mk('skicka')}>
              <button type="button" onClick={() => tryck('skicka')} aria-disabled={!kan}
                className={`flex items-center gap-1.5 rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11px] font-semibold text-[#04281c] ${kan ? '' : 'opacity-50'}`}>
                <Icon name="rapport.skicka" size={16} className="h-3.5 w-3.5" />
                {anna ? 'Skicka till Anna' : 'Skicka'}
              </button>
            </Markor>
          </div>
        </footer>
      </section>
    </div>
  )
}

// ─── Tråden ───

function MinTrad({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const svar = vy === 'trad-svar' || vy === 'klar'
  const klar = vy === 'klar'
  const inlagg: Inlagg[] = [
    { id: 'c1', namn: 'Erik Exempel', egen: true, tid: '2026-10-23 10:12', text: <><Namn>@Anna Exempel</Namn> {FRAGA}</>, last: svar ? 'Läst av Anna 10:31' : undefined },
  ]
  if (svar) inlagg.push({ id: 'c2', namn: 'Anna Exempel', roll: 'koordinator', tid: '2026-10-23 10:40', text: ANNA_SVAR })
  return (
    <div className="p-2.5">
      <Trad
        tillbaka
        amne={FRAGA}
        ton={klar ? 'gron' : svar ? 'gron' : 'gra'}
        status={klar ? 'Klar 10:42' : svar ? 'Anna svarade 10:40, läs och markera som klar' : 'Väntar på Anna sedan 10:12'}
        knappar={klar
          ? <Knapp id="oppna-igen" ikon="allman.aterstall" mk={mk} tryck={tryck}>Öppna igen</Knapp>
          : <Knapp id="klar" ikon="allman.bock" prim mk={mk} tryck={tryck}>Markera som klar</Knapp>}
        hjalp={!klar}
        arende={ARENDE}
        med={[
          { namn: 'Du', beskrivning: 'Tekniker, startade tråden', ton: 'gra', lage: svar ? undefined : 'Väntar på svar' },
          { namn: 'Anna Exempel', beskrivning: 'Tillfrågad', ton: svar ? 'gron' : 'gra', lage: svar ? 'Har svarat' : 'Inte svarat än' },
        ]}
        inlagg={inlagg}
        nyttFran={vy === 'trad-svar' ? 'c2' : undefined}
        svar={{ etikett: svar ? 'Svar till Anna' : 'Svar', text: '', hint: '' }}
        mk={mk}
        tryck={tryck}
      />
    </div>
  )
}

function Skarm({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck: Tryck }) {
  const iTrad = vy === 'skickad' || vy === 'trad-svar' || vy === 'klar'
  const listaSvar = vy === 'lista-svar'
  const siffra = listaSvar || vy === 'trad-svar' ? 1 : undefined
  return (
    <Telefon>
      <TeknikerHuvud tryck={tryck} nr={0} siffra={siffra} />
      <div className="absolute bottom-12 left-0 right-0 top-11 overflow-hidden">
        {iTrad ? <MinTrad vy={vy} mk={mk} tryck={tryck} /> : <Lista svar={listaSvar} mk={mk} tryck={tryck} />}
      </div>
      <TeknikerBotten tryck={tryck} nr={0} />
      {vy.startsWith('d-') && <Dialog vy={vy} mk={mk} tryck={tryck} />}
      {vy === 'skickad' && <Notis text="Skickat till Anna" />}
      {vy === 'klar' && <Notis text="Markerad som klar" />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'lista', markera: 'ny' },
  { vy: 'd-vem', markera: 'kollega-anna' },
  { vy: 'd-arende', markera: 'arende-familj' },
  { vy: 'd-text', markera: 'meddelande' },
  { vy: 'd-klar', markera: 'skicka' },
  { vy: 'lista-svar', markera: 'rad' },
  { vy: 'trad-svar', markera: 'klar' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Frågor och uppdrag. Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl.' }

const TIPS: Record<string, string> = {
  notis: 'Klockan öppnar Frågor och uppdrag, och där står du redan.',
  meny: 'Menyn behövs inte nu. Allt du behöver finns på sidan.',
  sok: 'Sök i sidhuvudet letar efter ärenden och kunder. Här ska du skriva en fråga.',
  'sok-sida': 'Sökrutan letar bland dina trådar. Du ska skriva en ny fråga.',
  'grupp-klara': 'Klara är trådar som redan är avslutade.',
  hem: 'Hem tar dig till Översikt. Stanna på Frågor och uppdrag.',
  arenden: 'Ärenden visar dina ärenden. Frågan skriver du här på Frågor och uppdrag.',
  schema: 'Schemat behövs inte nu.',
  provision: 'Provision behövs inte nu.',
  mer: 'Menyn behövs inte nu.',
  'typ-roll': 'En roll går till alla koordinatorer, och då hamnar frågan under Omnämnd, för kännedom hos dem. Uppdraget var att fråga Anna. Välj henne under En kollega.',
  'typ-alla': 'Alla är för kännedom till alla i portalen. Frågan ska bara till Anna.',
  'kollega-jonas': 'Jonas är tekniker. Frågan ska till koordinatorn Anna.',
  'kollega-sara': 'Sara är admin. Frågan ska till koordinatorn Anna.',
  'arende-brf': 'Brf Exempelgården är ett annat ärende. Frågan gäller Familjen Exempel.',
  'ta-bild': 'En bild behövs inte för den här frågan.',
  'valj-fil': 'En fil behövs inte för den här frågan.',
  avbryt: 'Avbryt stänger dialogen och ingenting skickas.',
  stang: 'Krysset stänger dialogen och ingenting skickas.',
  'oppna-arende': 'Öppna ärendet visar hela ärendet. Det behövs inte nu.',
  'visa-komm': 'Visa i ärendets kommunikation visar samma tråd i ärendet. Det behövs inte nu.',
  'namn-knapp': 'Du behöver inte nämna någon mer.',
}

const FRAMSTEG: Record<Vy, number> = { lista: 0, 'd-vem': 1, 'd-arende': 2, 'd-text': 3, 'd-klar': 4, skickad: 5, 'lista-svar': 6, 'trad-svar': 7, klar: 8 }

function Ovning() {
  const [vy, setVy] = useState<Vy>('lista')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); tips(titel, text) }
  const annars = (id: string, rad: string) => miss(TIPS[id] ? `${TIPS[id]} ${rad}` : rad)

  const tryck = (id: string) => {
    if (vy === 'klar') return
    switch (vy) {
      case 'lista':
        if (id === 'ny') ga('d-vem', 'Ny fråga eller uppdrag', 'Dialogen öppnades. Under Till vem? är En kollega valt. Välj Anna.')
        else annars(id, 'Tryck Ny fråga eller uppdrag.')
        break
      case 'd-vem':
        if (id === 'kollega-anna') ga('d-arende', 'Anna är vald', 'Längst ner står Anna får en notis direkt. Välj nu vilket ärende frågan gäller.')
        else if (id === 'typ-personer') tips('En kollega är redan valt', 'Tryck på Anna Exempel i listan.')
        else if (id === 'sok-kollega') tips('Du kan söka', 'Men Anna syns redan i listan. Tryck på henne.')
        else if (id === 'skicka') miss('Knappen är grå. Välj vem som ska få frågan först.')
        else annars(id, 'Tryck på Anna Exempel under Till vem?')
        break
      case 'd-arende':
        if (id === 'arende-familj') ga('d-text', 'Ärendet är valt', 'Familjen Exempel står i en grön ruta. Tryck i rutan Meddelande och skriv frågan.')
        else if (id === 'sok-arende') tips('Du kan söka', 'Men ärendet hos Familjen Exempel syns redan bland förslagen.')
        else if (id === 'skicka') miss('Välj ärendet först. Frågan sparas i ärendet.')
        else annars(id, 'Tryck på Familjen Exempel bland förslagen.')
        break
      case 'd-text':
        if (id === 'meddelande') ga('d-klar', 'Frågan är skriven', 'Nu är knappen Skicka till Anna grön. Tryck på den.')
        else if (id === 'byt-arende') miss('Ärendet är rätt. Skriv frågan i rutan Meddelande.')
        else if (id === 'skicka') miss('Skriv frågan i rutan Meddelande först.')
        else annars(id, 'Tryck i rutan Meddelande och skriv frågan.')
        break
      case 'd-klar':
        if (id === 'skicka') ga('skickad', 'Skickat till Anna', 'Tråden öppnades. Det står Väntar på Anna sedan 10:12. Gå tillbaka till listan med Frågor och uppdrag uppe till vänster.')
        else if (id === 'meddelande') tips('Frågan står redan där', 'Tryck Skicka till Anna.')
        else annars(id, 'Tryck Skicka till Anna.')
        break
      case 'skickad':
        if (id === 'tillbaka') ga('lista-svar', 'En stund senare', 'Anna har svarat. Siffran 1 på klockan visar att något väntar på dig. Öppna tråden under Svar till dig.')
        else if (id === 'klar') miss('Anna har inte svarat än. Vänta på svaret innan du markerar tråden som klar.')
        else if (id === 'svar-falt' || id === 'skicka-svar') miss('Du behöver inte skriva mer nu. Gå tillbaka till listan.')
        else annars(id, 'Tryck Frågor och uppdrag uppe till vänster.')
        break
      case 'lista-svar':
        if (id === 'rad') ga('trad-svar', 'Annas svar', 'Det står under Nytt sedan du läste. Under din fråga står Läst av Anna. Svaret räcker, så avsluta tråden.')
        else if (id === 'ny') miss('Du ska läsa Annas svar, inte skriva en ny fråga. Tryck på tråden under Svar till dig.')
        else annars(id, 'Tryck på tråden under Svar till dig.')
        break
      case 'trad-svar':
        if (id === 'klar') {
          setVy('klar')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Du frågade Anna om ärendet, läste hennes svar och markerade tråden som klar. Den ligger nu under Klara, och siffran på klockan är borta.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        } else if (id === 'svar-falt' || id === 'skicka-svar') miss('Svaret räcker, du behöver inte skriva mer. Tryck Markera som klar.')
        else if (id === 'tillbaka') miss('Tråden ligger kvar under Väntar på dig tills du markerar den som klar.')
        else annars(id, 'Tryck Markera som klar.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={8} svar={svar} onBorjaOm={() => { setVy('lista'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
