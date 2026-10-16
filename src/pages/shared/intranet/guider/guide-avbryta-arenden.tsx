// src/pages/shared/intranet/guider/guide-avbryta-arenden.tsx
// Guidemodul: Avbryt eller ta bort ett ärende (tekniker, telefon).
// EditCaseModal: pratbubblan (Öppna kommunikation) öppnar CommunicationSlidePanel med
// CommentInput (Skriv en kommentar... (använd @ för att nämna någon)). Radera längst ner till
// vänster öppnar DeleteCaseConfirmDialog (Ta bort ärende, Ta bort). caseDeleteService.deleteCase
// sätter status Borttaget, toasten är "Ärendet har tagits bort". Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { ArendeHuvud, Notis, OvningRam, Rad, Kort, Status, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ArendeIkoner, ArendeInnehall, KommPanel, TaBortArk, TelefonFot, gorMk, type ArendeData, type Kommentar, type Mk, type Tryck } from './_arenden'

type Vy = 'arende' | 'komm' | 'tabort' | 'klart'
interface Lage { vy: Vy; utkast: boolean; skickad: boolean }

const ARENDE: ArendeData = {
  nr: 'BE-0001234',
  status: 'Bokad',
  kund: 'Familjen Exempel · Exempelvägen 4, Södertälje',
  beskrivning: 'Råttor i källaren, spår vid tvättstugan.',
  tid: 'Tisdag 2026-10-20, 09:00 till 10:00',
}
const TEXT = 'Kunden avbokade per telefon 2026-10-19. Inga råttor kvar.'
const KOMMENTAR: Kommentar = { av: 'Anna Exempel', text: TEXT, nar: 'nyss' }

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'klart') {
    return (
      <Telefon>
        <div className="border-b border-slate-700 px-3.5 py-3"><p className="text-sm font-semibold text-white">Mina ärenden</p></div>
        <Kort titel="Exempel AB" ikon="arende.arende"><Rad v="Möss · onsdag 2026-10-21, 08:00" /></Kort>
        <Kort titel="Brf Exempelgården" ikon="arende.arende"><Rad v="Silverfisk · torsdag 2026-10-22, 10:00" /></Kort>
        <Notis text="Ärendet har tagits bort" />
      </Telefon>
    )
  }
  return (
    <Telefon>
      <ArendeHuvud nr={ARENDE.nr} status={<Status text={ARENDE.status} />} kund={ARENDE.kund}
        ikoner={<ArendeIkoner mk={mk} tryck={tryck} />} />
      <ArendeInnehall a={ARENDE} tryck={tryck} />
      <TelefonFot mk={mk} tryck={tryck} />
      {l.vy === 'komm' && <KommPanel mobil kommentarer={l.skickad ? [KOMMENTAR] : []} utkast={l.utkast && !l.skickad ? TEXT : ''} mk={mk} tryck={tryck} />}
      {l.vy === 'tabort' && <TaBortArk titel={ARENDE.nr} mk={mk} tryck={tryck} />}
    </Telefon>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'arende', utkast: false, skickad: false }, markera: 'komm' },
  { lage: { vy: 'komm', utkast: true, skickad: false }, markera: 'skicka' },
  { lage: { vy: 'komm', utkast: true, skickad: true }, markera: 'stang-komm' },
  { lage: { vy: 'arende', utkast: true, skickad: true }, markera: 'radera' },
  { lage: { vy: 'tabort', utkast: true, skickad: true }, markera: 'tabort' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'arende', utkast: false, skickad: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Skriv först i ärendet varför det avbryts. Leta upp knappen för kommentarer uppe till höger.' }

const TIPS: Record<string, string> = {
  fotspar: 'Fotspåren bokar återbesök. Kunden har avbokat, så inget nytt besök ska bokas.',
  historik: 'Klockan visar gamla besök. Kommentaren skriver du i pratbubblan.',
  flik: 'Flikarna byter vy i ärendet. Kommentaren skriver du i pratbubblan uppe till höger.',
  spara: 'Spara ändringar sparar ärendet som det är. Det tar inte bort något.',
  'avbryt-arende': 'Avbryt stänger ärendet utan att något händer.',
  'avbryt-tabort': 'Avbryt stänger rutan och ärendet ligger kvar.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'komm') {
      if (id === 'skriv') { setL({ ...l, utkast: true }); tips('Texten är skriven', 'Tryck på den gröna pilen för att skicka.') }
      else if (id === 'skicka') {
        if (!l.utkast) miss('Skriv först varför ärendet avbryts.')
        else if (l.skickad) miss('Kommentaren är redan skickad. Stäng panelen med krysset.')
        else { setL({ ...l, skickad: true }); tips('Kommentaren är sparad', 'Kontoret ser nu varför ärendet avbröts. Stäng panelen med krysset.') }
      } else if (id === 'stang-komm') {
        setL({ ...l, vy: 'arende' })
        if (l.skickad) tips('Panelen är stängd', 'Ta nu bort ärendet. Knappen finns längst ner till vänster.')
        else miss('Du stängde utan att skicka. Öppna pratbubblan igen och skriv varför.')
      } else miss('Skriv i fältet längst ner och skicka.')
    } else if (l.vy === 'arende') {
      if (id === 'komm') { setL({ ...l, vy: 'komm' }); tips('Kommunikation', l.skickad ? 'Kommentaren finns redan. Stäng panelen.' : 'Tryck i fältet längst ner och skriv varför ärendet avbryts.') }
      else if (id === 'radera') {
        if (!l.skickad) miss('Skriv först varför ärendet avbryts, i pratbubblan uppe till höger. Då vet kontoret vad som hände.')
        else { setL({ ...l, vy: 'tabort' }); tips('Rutan Ta bort ärende', 'Läs texten. All data behålls. Tryck Ta bort.') }
      } else miss(TIPS[id] ?? (l.skickad ? 'Radera finns längst ner till vänster.' : 'Leta efter pratbubblan uppe till höger.'))
    } else {
      if (id === 'tabort') {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Ärendet har status Borttaget och döljs från alla vyer. Kommentaren, bilderna och historiken finns kvar, så kontoret ser varför det avbröts.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'avbryt-tabort') { setL({ ...l, vy: 'arende' }); miss(TIPS[id]) }
      else miss('Tryck Ta bort i rutan.')
    }
  }

  const framsteg = l.vy === 'klart' ? 5 : l.vy === 'tabort' ? 4 : l.skickad ? (l.vy === 'arende' ? 3 : 2) : l.vy === 'komm' ? 1 : 0
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
