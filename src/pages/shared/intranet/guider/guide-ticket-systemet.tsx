// src/pages/shared/intranet/guider/guide-ticket-systemet.tsx
// Guidemodul: Skicka en ticket till en kollega (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls så att länkar och läsloggen fungerar.
//
// Efterbildning av InternAdministration i nya vyn (rubriken Tickets i sidhuvudet,
// "X väntar på dig, du väntar på svar i Y", Ny ticket, sökrutan, grupperna Väntar på dig
// med Frågor till dig och Svar till dig, Du väntar på svar, Omnämnd, för kännedom, Klara).
// Telefon (under 1024 px): listan, och tråden som egen vy med Tickets tillbaka.
// Dator: listan till vänster och tråden till höger, den första tråden väljs själv.
// NyFragaDialog (Ny ticket) och TradVy (Markera som klar, toasten "Markerad som klar",
// Nytt sedan du läste, Läst av). Klockan uppe till höger går till Tickets.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { gorMk, type Mk, type Tryck } from './_arenden'
import { Grupp, Knapp, Namn, SokRuta, Trad, TradRad, UnderGrupp, type Inlagg, type RadData } from './_fragor'
import { KUND, NR, NyTicketDialog, type NyTicketLage } from './_nyvy_tickets'

type Vy = 'lista' | 'd-vem' | 'd-arende' | 'd-text' | 'd-klar' | 'skickad' | 'lista-svar' | 'trad-svar' | 'klar'

const FRAGA = 'Vill kunden ha kvittot på mejl?'
const ANNA_SVAR = 'Ja, till kund@exempel.se. Skicka det i dag.'

const RAD_VANTAR: RadData = {
  id: 'rad', amne: FRAGA, ton: 'gra', status: 'Väntar på Anna sedan 10:12',
  tid: '10:12', kund: KUND, franTill: 'Du till Anna', motpart: 'Anna Exempel',
}
const RAD_SVAR: RadData = {
  id: 'rad', amne: FRAGA, ton: 'gron', status: 'Anna svarade 10:40, läs och markera som klar',
  citat: ANNA_SVAR, tid: '10:40', kund: KUND, franTill: 'Du till Anna', motpart: 'Anna Exempel', olast: true,
}

const DIALOG: Record<'d-vem' | 'd-arende' | 'd-text' | 'd-klar', NyTicketLage> = {
  'd-vem': { typ: 'personer', anna: false, koordinator: false, arende: false, text: '', fran: 1 },
  'd-arende': { typ: 'personer', anna: true, koordinator: false, arende: false, text: '', fran: 2 },
  'd-text': { typ: 'personer', anna: true, koordinator: false, arende: true, text: '', fran: 2 },
  'd-klar': { typ: 'personer', anna: true, koordinator: false, arende: true, text: FRAGA, fran: 3 },
}

function antalFor(vy: Vy) {
  const svar = vy === 'lista-svar' || vy === 'trad-svar'
  const vantar = vy === 'skickad'
  return { vantar: svar ? 1 : 0, jagVantar: vantar ? 1 : 0, klocka: svar || vy === 'skickad' ? 1 : 0 }
}

// ─── Listan ───

function Lista({ vy, dator, mk, tryck }: { vy: Vy; dator: boolean; mk: Mk; tryck: Tryck }) {
  const { vantar, jagVantar } = antalFor(vy)
  const svar = vy === 'lista-svar' || vy === 'trad-svar'
  const klar = vy === 'klar'
  const vald = dator && (vy === 'skickad' || svar || klar)
  return (
    <div className="grid content-start gap-2.5">
      <div className={`flex gap-2 ${dator ? 'items-start justify-between' : 'flex-col'}`}>
        <p className="text-[11px] text-slate-300">
          <strong className={`font-semibold ${vantar > 0 ? 'text-amber-500' : 'text-slate-200'}`}>{vantar} väntar på dig</strong>, du väntar på svar i {jagVantar}
        </p>
        <Knapp id="ny" ikon="allman.plus" prim full={!dator} mk={mk} tryck={tryck}>Ny ticket</Knapp>
      </div>
      <SokRuta tryck={tryck} />
      <Grupp ikon="falt.attgora" farg="text-amber-500" rubrik="Väntar på dig" antal={vantar} text="Någon har frågat dig något eller svarat på din fråga.">
        {svar && <><UnderGrupp rubrik="Svar till dig" antal={1} /><TradRad r={RAD_SVAR} vald={vald} dator={dator} mk={mk} tryck={tryck} /></>}
      </Grupp>
      <Grupp ikon="falt.vantar" rubrik="Du väntar på svar" antal={jagVantar} text="Du har frågat. Svaret hamnar under Väntar på dig.">
        {vy === 'skickad' && <TradRad r={RAD_VANTAR} vald={vald} dator={dator} mk={mk} tryck={tryck} />}
      </Grupp>
      <Grupp ikon="dok.omnamnd" rubrik="Omnämnd, för kännedom" antal={0} text="Skickat till en grupp du hör till, eller trådar du är med i där inget väntar på dig." />
      <Grupp ikon="falt.klart" farg="text-[#20c58f]" rubrik="Klara" antal={klar ? 5 : 4} hopfalld id="grupp-klara" mk={mk} tryck={tryck}
        text="Markerade som klara, senast klara först. Ett nytt svar öppnar tråden igen." />
    </div>
  )
}

// ─── Tråden ───

function MinTrad({ vy, dator, mk, tryck }: { vy: Vy; dator: boolean; mk: Mk; tryck: Tryck }) {
  const svar = vy === 'lista-svar' || vy === 'trad-svar' || vy === 'klar'
  const klar = vy === 'klar'
  const inlagg: Inlagg[] = [
    { id: 'c1', namn: 'Du', egen: true, tid: '2026-10-26 10:12', text: <><Namn>@Anna Exempel</Namn> {FRAGA}</>, last: svar ? 'Läst av Anna 10:31' : undefined },
  ]
  if (svar) inlagg.push({ id: 'c2', namn: 'Anna Exempel', roll: 'koordinator', tid: '2026-10-26 10:40', text: ANNA_SVAR })
  return (
    <Trad
      tillbaka={!dator}
      amne={FRAGA}
      ton={svar ? 'gron' : 'gra'}
      status={klar ? 'Klar 10:42' : svar ? 'Anna svarade 10:40, läs och markera som klar' : 'Väntar på Anna sedan 10:12'}
      knappar={klar
        ? <Knapp id="oppna-igen" ikon="allman.aterstall" mk={mk} tryck={tryck}>Öppna igen</Knapp>
        : <Knapp id="klar" ikon="allman.bock" prim mk={mk} tryck={tryck}>Markera som klar</Knapp>}
      hjalp={!klar}
      arende={{ kund: KUND, nummer: NR, rad: 'Råttor, Exempelvägen 4, Södertälje', info: 'Privat, bokat 2026-10-26 08:00 hos dig, bokad' }}
      med={[
        { namn: 'Du', beskrivning: 'Tekniker, startade tråden', ton: 'gra', lage: svar ? undefined : 'Väntar på svar' },
        { namn: 'Anna Exempel', beskrivning: 'Tillfrågad', ton: svar ? 'gron' : 'gra', lage: svar ? 'Har svarat' : 'Inte svarat än' },
      ]}
      inlagg={inlagg}
      nyttFran={vy === 'trad-svar' || (dator && vy === 'lista-svar') ? 'c2' : undefined}
      svar={{ etikett: svar ? 'Svar till Anna' : 'Svar', text: '', hint: '' }}
      mk={mk}
      tryck={tryck}
    />
  )
}

function Skarm({ vy, mk, tryck, ram }: { vy: Vy; mk: Mk; tryck: Tryck; ram?: NyMarkor }) {
  const enhet = useGuideEnhet()
  const dator = enhet === 'dator'
  const { vantar, jagVantar, klocka } = antalFor(vy)
  const iTrad = vy === 'skickad' || vy === 'trad-svar' || vy === 'klar'
  const dialog = vy === 'd-vem' || vy === 'd-arende' || vy === 'd-text' || vy === 'd-klar'
  const tradSyns = dator ? (iTrad || vy === 'lista-svar') : iTrad
  const onRam = (mal: string) => tryck(mal === 'nav:Tickets' ? 'tickets' : mal)

  return (
    <NySkarm sida="tickets" titel="Tickets" under={`${vantar} väntar på dig, du väntar på svar i ${jagVantar}`} tickets={klocka}
      onRam={onRam} markor={ram}
      over={<>
        {dialog && <NyTicketDialog l={DIALOG[vy]} mk={mk} tryck={tryck} />}
        {vy === 'skickad' && <Notis text="Skickat till Anna" />}
        {vy === 'klar' && <Notis text="Markerad som klar" />}
      </>}>
      <div className="h-full overflow-hidden">
        {dator ? (
          <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3">
            <div className="min-w-0 overflow-hidden"><Lista vy={vy} dator mk={mk} tryck={tryck} /></div>
            <div className="min-w-0 overflow-hidden">
              {tradSyns ? <MinTrad vy={vy} dator mk={mk} tryck={tryck} /> : (
                <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-700 text-center">
                  <Icon name="dok.konversation" size={24} className="text-slate-500" />
                  <p className="text-[11px] text-slate-400">Välj en tråd i listan.</p>
                </div>
              )}
            </div>
          </div>
        ) : tradSyns ? <MinTrad vy={vy} dator={false} mk={mk} tryck={tryck} /> : <Lista vy={vy} dator={false} mk={mk} tryck={tryck} />}
      </div>
    </NySkarm>
  )
}

// ─── Visning ───

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

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Tickets. Fråga koordinatorn Anna Exempel om Familjen Exempel vill ha kvittot på mejl.' }

const TIPS: Record<string, string> = {
  tickets: 'Klockan går till Tickets, och där står du redan.',
  sok: 'Förstoringsglaset söker ärenden och kunder i hela portalen. Här ska du skriva en ny ticket.',
  'sok-sida': 'Sökrutan letar bland dina trådar. Du ska skriva en ny ticket.',
  tillbud: 'Den gula knappen är för tillbud och olyckor.',
  visamig: 'Visa mig hur går igenom sidan. Det behövs inte nu.',
  'grupp-klara': 'Klara är trådar som redan är avslutade.',
  'typ-roll': 'En roll går till alla koordinatorer och hamnar under Omnämnd, för kännedom hos dem. Frågan ska till Anna, så välj henne under En kollega.',
  'typ-alla': 'Alla är för kännedom till alla i portalen. Frågan ska bara till Anna.',
  'kollega-erik': 'Erik är tekniker. Frågan ska till koordinatorn Anna.',
  'arende-brf': 'Brf Exempelgården är ett annat ärende. Frågan gäller Familjen Exempel.',
  'ta-bild': 'En bild behövs inte för den här frågan.',
  'valj-fil': 'En fil behövs inte för den här frågan.',
  avbryt: 'Avbryt stänger rutan och ingenting skickas.',
  stang: 'Krysset stänger rutan och ingenting skickas.',
  'oppna-arende': 'Öppna ärendet visar hela ärendet. Det behövs inte nu.',
  'visa-komm': 'Visa i ärendets kommunikation visar samma tråd i ärendet. Det behövs inte nu.',
  'namn-knapp': 'Du behöver inte nämna någon mer.',
}

const FRAMSTEG: Record<Vy, number> = { lista: 0, 'd-vem': 1, 'd-arende': 2, 'd-text': 3, 'd-klar': 4, skickad: 5, 'lista-svar': 6, 'trad-svar': 7, klar: 8 }

function Ovning() {
  const enhet = useGuideEnhet()
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
        if (id === 'ny') ga('d-vem', 'Ny ticket', `Rutan öppnades ${enhet === 'dator' ? 'mitt på skärmen' : 'nerifrån'}. Under Till vem? är En kollega valt. Välj Anna.`)
        else annars(id, 'Tryck Ny ticket.')
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
        else if (id === 'ta-bort-anna') miss('Anna ska vara kvar. Välj ärendet under Om vilket ärende?')
        else if (id === 'skicka') miss('Välj ärendet först. Tråden sparas i ärendet.')
        else annars(id, 'Tryck på Familjen Exempel bland förslagen.')
        break
      case 'd-text':
        if (id === 'meddelande') ga('d-klar', 'Frågan är skriven', 'Nu är knappen Skicka till Anna grön. Tryck på den.')
        else if (id === 'byt-arende') miss('Ärendet är rätt. Skriv frågan i rutan Meddelande.')
        else if (id === 'skicka') miss('Skriv frågan i rutan Meddelande först.')
        else annars(id, 'Tryck i rutan Meddelande och skriv frågan.')
        break
      case 'd-klar':
        if (id === 'skicka') ga('skickad', 'Skickat till Anna', `Tråden öppnades${enhet === 'dator' ? ' till höger om listan' : ''}. Det står Väntar på Anna sedan 10:12. En stund senare svarar Anna, och klockan uppe till höger visar 1. Tryck på klockan.`)
        else if (id === 'meddelande') tips('Frågan står redan där', 'Tryck Skicka till Anna.')
        else annars(id, 'Tryck Skicka till Anna.')
        break
      case 'skickad':
        if (id === 'tickets') ga('lista-svar', 'Anna har svarat', enhet === 'dator'
          ? 'Tråden ligger under Väntar på dig › Svar till dig och är öppen till höger. Tryck på tråden i listan.'
          : 'Tråden ligger under Väntar på dig › Svar till dig. Tryck på den.')
        else if (id === 'tillbaka') ga('lista-svar', 'Tillbaka i listan', 'Anna har svarat under tiden. Tråden ligger under Väntar på dig › Svar till dig. Tryck på den.')
        else if (id === 'klar') miss('Anna har inte svarat än. Vänta på svaret innan du markerar tråden som klar.')
        else if (id === 'svar-falt' || id === 'skicka-svar') miss('Du behöver inte skriva mer nu. Tryck på klockan uppe till höger.')
        else annars(id, 'Tryck på klockan uppe till höger.')
        break
      case 'lista-svar':
        if (id === 'rad') ga('trad-svar', 'Annas svar', 'Det står under Nytt sedan du läste. Under din fråga står Läst av Anna. Svaret räcker, så avsluta tråden.')
        else if (id === 'klar' && enhet === 'dator') {
          setVy('klar')
          setSvar({ typ: 'ok', titel: 'Klart', text: 'Du markerade tråden som klar direkt i tråden till höger. Den ligger nu under Klara och siffran på klockan är borta.' })
        } else if (id === 'ny') miss('Du ska läsa Annas svar, inte skriva en ny ticket. Tryck på tråden under Svar till dig.')
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
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={8} svar={svar} onBorjaOm={() => { setVy('lista'); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm vy={vy} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
