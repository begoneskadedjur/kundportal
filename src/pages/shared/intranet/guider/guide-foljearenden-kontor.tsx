// src/pages/shared/intranet/guider/guide-foljearenden-kontor.tsx
// Guidemodul: Skapa ett följeärende (admin och koordinator, dator).
// Samma flöde som för teknikern i EditCaseModal, men ärendet öppnas från schemat
// (CoordinatorSchedule). Efter Skapa nytt ärende stängs ärendet och schemat laddas om
// (handleUpdateSuccess), så det nya ärendet ligger på samma tid och tekniker som det första.
// Följeärendet får ett eget BE-nummer (CaseNumberService, samma väg som nya ärenden), och
// toasten är "Följeärende <nummer> skapat för <skadedjur>!".
// Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { Dator, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ArendeDator, FoljeArk, SchemaHuvud, SchemaRutnat, ValArk, gorMk, type ArendeData, type Besok, type Mk, type TeknikerRad, type Tryck } from './_arenden'

type Vy = 'schema' | 'arende' | 'val' | 'folje' | 'klart'
interface Lage { vy: Vy; lista: boolean; djur: string | null }

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

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'arende' || l.vy === 'val' || l.vy === 'folje') {
    return (
      <Dator adress="koordinator › schema">
        <ArendeDator a={ARENDE} mk={mk} tryck={tryck}>
          {l.vy === 'val' && <ValArk mk={mk} tryck={tryck} />}
          {l.vy === 'folje' && <FoljeArk valt={l.djur} listaOppen={l.lista} mk={mk} tryck={tryck} />}
        </ArendeDator>
      </Dator>
    )
  }
  const klar = l.vy === 'klart'
  const besok: Besok[] = klar
    ? [
        { ...BESOK[0], lane: 0 },
        { id: 'ny', kund: `Familjen Exempel · ${l.djur ?? ''}`, fran: 9, till: 10, rad: 'anna', lane: 1, farg: 'border-[#20c58f] bg-[#20c58f]/20' },
        ...BESOK.slice(1),
      ]
    : BESOK
  return (
    <Dator adress="koordinator › schema">
      <SchemaHuvud datum="tisdag 20 oktober 2026" mk={mk} tryck={tryck} />
      <SchemaRutnat rader={RADER} besok={besok} mk={mk} tryck={tryck} />
      {klar && l.djur && <Notis text={`Följeärende BE-0001235 skapat för ${l.djur}!`} />}
    </Dator>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { vy: 'schema', lista: false, djur: null }, markera: 'besok:fam' },
  { lage: { vy: 'arende', lista: false, djur: null }, markera: 'fotspar' },
  { lage: { vy: 'val', lista: false, djur: null }, markera: 'val-nytt' },
  { lage: { vy: 'folje', lista: false, djur: null }, markera: 'skadedjur' },
  { lage: { vy: 'folje', lista: false, djur: 'Getingar' }, markera: 'skapa-folje' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={gorMk(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'schema', lista: false, djur: null }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Familjen Exempel har ringt om getingar. Öppna deras råttärende i schemat.' }

const TIPS: Record<string, string> = {
  nytt: 'Nytt ärende fungerar också, men då får du fylla i kunden igen. Ett följeärende kopierar kund, adress och tid från råttärendet.',
  historik: 'Klockan är ärendehistoriken. Där skapar du inget nytt ärende.',
  komm: 'Pratbubblan är för kommentarer. Det nya ärendet skapar du med fotspåren.',
  flik: 'Flikarna byter vy i ärendet. Leta efter fotspåren uppe till höger.',
  radera: 'Radera tar bort råttärendet. Det ska vara kvar.',
  spara: 'Spara ändringar sparar råttärendet. Du ska skapa ett nytt.',
  'avbryt-arende': 'Avbryt stänger ärendet. Leta efter fotspåren uppe till höger.',
  'val-aterbesok': 'Återbesök är för samma problem, alltså råttorna. Getingarna är ett nytt problem.',
  'val-duplicera': 'Duplicera gör en kopia av råttärendet. Välj det som gäller ett annat skadedjur.',
  'val-avbryt': 'Avbryt stänger rutan. Välj i stället det som passar ett nytt skadedjur.',
  'avbryt-folje': 'Avbryt stänger rutan och inget ärende skapas.',
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
      if (id === 'besok:fam') { setL({ ...l, vy: 'arende' }); tips('Ärendet är öppet', 'Leta upp knappen för nytt ärende uppe till höger.') }
      else if (id.startsWith('drag:')) tips('Du drar ett besök', 'Här ska inget flyttas. Tryck på besöket i stället.')
      else if (id.startsWith('besok:')) miss('Det är en annan kund. Familjen Exempel ligger hos Anna 09:00.')
      else miss(TIPS[id] ?? 'Tryck på Familjen Exempels besök hos Anna 09:00.')
    } else if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Getingarna är ett nytt problem hos samma kund. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-nytt') { setL({ ...l, vy: 'folje' }); tips('Rätt val', 'Kund, adress och tid kopieras. Välj skadedjurstyp.') }
      else miss(TIPS[id] ?? 'Välj det som gäller ett annat skadedjur.')
    } else {
      if (id === 'skadedjur') { setL({ ...l, lista: !l.lista }); tips('Listan är öppen', 'Välj skadedjuret kunden ringde om.') }
      else if (id.startsWith('djur-')) {
        const djur = id.slice(5)
        setL({ ...l, lista: false, djur })
        if (djur === 'Getingar') tips('Getingar är valt', 'Tryck Skapa nytt ärende.')
        else if (djur === 'Råttor') miss('Råttorna har redan ett ärende. Välj det nya skadedjuret.')
        else miss(`Du valde ${djur}. Kunden ringde om getingar.`)
      } else if (id === 'skapa-folje') {
        if (!l.djur) miss('Knappen fungerar först när du har valt skadedjurstyp.')
        else if (l.djur !== 'Getingar') miss('Byt till Getingar först.')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Getingärendet har fått eget ärendenummer, BE-0001235, och ligger hos Anna på samma tid som råttärendet. Vill du boka det en annan tid öppnar du det nya ärendet och ändrar tiden.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj skadedjurstyp och skapa ärendet.')
    }
  }

  const framsteg = l.vy === 'schema' ? 0 : l.vy === 'arende' ? 1 : l.vy === 'val' ? 2 : l.vy === 'klart' ? 5 : l.djur ? 4 : 3
  return (
    <OvningRam bred framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
