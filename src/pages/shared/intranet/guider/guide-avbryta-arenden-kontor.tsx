// src/pages/shared/intranet/guider/guide-avbryta-arenden-kontor.tsx
// Guidemodul: Avbryt eller ta bort ett ärende (admin och koordinator, dator).
// Samma flöde som teknikerns i EditCaseModal, men ärendet öppnas från schemat.
// Efter Ta bort tar schemat bort besöket direkt (onDeleted → handleCaseDeleted). Borttaget är
// dolt i schemats standardfilter (DEFAULT_ACTIVE_STATUSES) och syns bara om man kryssar i
// Borttaget under Filter. Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { Dator, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ArendeDator, KommPanel, SchemaHuvud, SchemaRutnat, TaBortArk, gorMk, type ArendeData, type Besok, type Kommentar, type Mk, type TeknikerRad, type Tryck } from './_arenden'

type Vy = 'schema' | 'arende' | 'komm' | 'tabort' | 'klart'
interface Lage { vy: Vy; utkast: boolean; skickad: boolean }

const RADER: TeknikerRad[] = [
  { id: 'anna', namn: 'Anna Exempel' },
  { id: 'erik', namn: 'Erik Exempel' },
  { id: 'sara', namn: 'Sara Exempel' },
]
const BESOK: Besok[] = [
  { id: 'fam', kund: 'Familjen Exempel', fran: 9, till: 10, rad: 'anna' },
  { id: 'b2', kund: 'Exempel AB', fran: 13, till: 14.5, rad: 'anna' },
  { id: 'b3', kund: 'Brf Exempelgården', fran: 10, till: 12, rad: 'erik' },
]
const ARENDE: ArendeData = {
  nr: 'BE-0001234',
  status: 'Bokad',
  kund: 'Familjen Exempel · Exempelvägen 4, Södertälje',
  beskrivning: 'Råttor i källaren, spår vid tvättstugan.',
  tid: 'Tisdag 2026-10-20, 09:00 till 10:00',
}
const TEXT = 'Kunden ringde och avbokade 2026-10-19. Vill inte boka ny tid.'
const KOMMENTAR: Kommentar = { av: 'Koordinatorn', text: TEXT, nar: 'nyss' }

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'schema' || l.vy === 'klart') {
    return (
      <Dator adress="koordinator › schema">
        <SchemaHuvud datum="tisdag 20 oktober 2026" mk={mk} tryck={tryck} />
        <SchemaRutnat rader={RADER} besok={l.vy === 'klart' ? BESOK.filter(b => b.id !== 'fam') : BESOK} mk={mk} tryck={tryck} />
        {l.vy === 'klart' && <Notis text="Ärendet har tagits bort" />}
      </Dator>
    )
  }
  return (
    <Dator adress="koordinator › schema">
      <ArendeDator a={ARENDE} mk={mk} tryck={tryck}>
        {l.vy === 'komm' && <KommPanel kommentarer={l.skickad ? [KOMMENTAR] : []} utkast={l.utkast && !l.skickad ? TEXT : ''} mk={mk} tryck={tryck} />}
        {l.vy === 'tabort' && <TaBortArk titel={ARENDE.nr} mk={mk} tryck={tryck} />}
      </ArendeDator>
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'schema', utkast: false, skickad: false }, markera: 'besok:fam' },
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

const START: Lage = { vy: 'schema', utkast: false, skickad: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Familjen Exempel har ringt och avbokat. Öppna deras ärende i schemat.' }

const TIPS: Record<string, string> = {
  fotspar: 'Fotspåren bokar återbesök. Kunden har avbokat, så inget nytt besök ska bokas.',
  historik: 'Klockan visar gamla besök. Kommentaren skriver du i pratbubblan.',
  flik: 'Flikarna byter vy i ärendet. Kommentaren skriver du i pratbubblan uppe till höger.',
  spara: 'Spara ändringar sparar ärendet som det är. Det tar inte bort något.',
  'avbryt-arende': 'Avbryt stänger ärendet utan att något händer.',
  'avbryt-tabort': 'Avbryt stänger rutan och ärendet ligger kvar.',
  nytt: 'Nytt ärende skapar ett ärende. Du ska ta bort ett.',
  filter: 'Filtret ändrar bara vad schemat visar. Ärendet finns kvar.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'schema') {
      if (id === 'besok:fam') { setL({ ...l, vy: 'arende' }); tips('Ärendet är öppet', 'Skriv först varför det avbryts. Leta upp pratbubblan uppe till höger.') }
      else if (id.startsWith('drag:')) tips('Du drar ett besök', 'Här ska inget flyttas. Tryck på besöket i stället.')
      else if (id.startsWith('besok:')) miss('Det är en annan kund. Familjen Exempel ligger hos Anna 09:00.')
      else miss(TIPS[id] ?? 'Tryck på Familjen Exempels besök hos Anna 09:00.')
    } else if (l.vy === 'komm') {
      if (id === 'skriv') { setL({ ...l, utkast: true }); tips('Texten är skriven', 'Tryck Skicka.') }
      else if (id === 'skicka') {
        if (!l.utkast) miss('Skriv först varför ärendet avbryts.')
        else if (l.skickad) miss('Kommentaren är redan skickad. Stäng panelen med krysset.')
        else { setL({ ...l, skickad: true }); tips('Kommentaren är sparad', 'Stäng panelen med krysset.') }
      } else if (id === 'stang-komm') {
        setL({ ...l, vy: 'arende' })
        if (l.skickad) tips('Panelen är stängd', 'Ta nu bort ärendet. Knappen finns längst ner till vänster.')
        else miss('Du stängde utan att skicka. Öppna pratbubblan igen och skriv varför.')
      } else miss('Skriv i fältet längst ner i panelen och skicka.')
    } else if (l.vy === 'arende') {
      if (id === 'komm') { setL({ ...l, vy: 'komm' }); tips('Kommunikation', l.skickad ? 'Kommentaren finns redan. Stäng panelen.' : 'Tryck i fältet längst ner och skriv varför ärendet avbryts.') }
      else if (id === 'radera') {
        if (!l.skickad) miss('Skriv först varför ärendet avbryts, i pratbubblan uppe till höger. Kommentaren finns kvar efteråt.')
        else { setL({ ...l, vy: 'tabort' }); tips('Rutan Ta bort ärende', 'All data behålls. Tryck Ta bort.') }
      } else miss(TIPS[id] ?? (l.skickad ? 'Radera finns längst ner till vänster.' : 'Leta efter pratbubblan uppe till höger.'))
    } else {
      if (id === 'tabort') {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Ärendet har status Borttaget och besöket är borta ur schemat direkt. Kommentaren och historiken finns kvar.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      } else if (id === 'avbryt-tabort') { setL({ ...l, vy: 'arende' }); miss(TIPS[id]) }
      else miss('Tryck Ta bort i rutan.')
    }
  }

  const framsteg = l.vy === 'klart' ? 6 : l.vy === 'tabort' ? 5 : l.skickad ? (l.vy === 'arende' ? 4 : 3) : l.vy === 'komm' ? 2 : l.vy === 'arende' ? 1 : 0
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
