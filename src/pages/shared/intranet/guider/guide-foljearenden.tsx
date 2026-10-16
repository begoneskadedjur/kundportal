// src/pages/shared/intranet/guider/guide-foljearenden.tsx
// Guidemodul: Skapa ett följeärende (tekniker, telefon).
// EditCaseModal: fotspåren (Boka återbesök eller skapa nytt ärende) syns bara i privat- och
// företagsärenden som inte själva är följeärenden (canCreateFollowUp). Vad vill du göra? ›
// Skapa nytt ärende › Skadedjurstyp * › Skapa nytt ärende. Toasten är "Följeärende skapat för
// <skadedjur>!" och det nya ärendet visas med raden "Detta är ett följeärende".
// Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { ArendeHuvud, Notis, OvningRam, Status, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ArendeIkoner, ArendeInnehall, FoljeArk, TelefonFot, ValArk, gorMk, type ArendeData, type Mk, type Tryck } from './_arenden'

type Vy = 'arende' | 'val' | 'folje' | 'klart'
interface Lage { vy: Vy; lista: boolean; djur: string | null }

const URSPRUNG: ArendeData = {
  nr: 'BE-0001234',
  status: 'Bokad',
  kund: 'Familjen Exempel · Exempelvägen 4, Södertälje',
  beskrivning: 'Råttor i källaren, spår vid tvättstugan.',
  tid: 'Tisdag 2026-10-20, 09:00 till 10:00',
}
const nyttArende = (djur: string): ArendeData => ({
  ...URSPRUNG,
  beskrivning: `Följeärende från ursprungsärende. Nytt skadedjursproblem: ${djur}`,
  foljearende: true,
})

function Skarm({ l, mk, tryck }: { l: Lage; mk: Mk; tryck: Tryck }) {
  const klar = l.vy === 'klart'
  const a = klar && l.djur ? nyttArende(l.djur) : URSPRUNG
  return (
    <Telefon>
      <ArendeHuvud nr={a.nr} status={<Status text={a.status} />} kund={a.kund}
        ikoner={<ArendeIkoner mk={mk} tryck={tryck} fotspar={!klar} />} />
      <ArendeInnehall a={a} tryck={tryck} />
      <TelefonFot mk={mk} tryck={tryck} />
      {l.vy === 'val' && <ValArk mk={mk} tryck={tryck} />}
      {l.vy === 'folje' && <FoljeArk valt={l.djur} listaOppen={l.lista} mk={mk} tryck={tryck} />}
      {klar && l.djur && <Notis text={`Följeärende skapat för ${l.djur}!`} />}
    </Telefon>
  )
}

// ─── Visning ───

const VISNING: { lage: Lage; markera: string }[] = [
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

const START: Lage = { vy: 'arende', lista: false, djur: null }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i råttärendet. Leta upp knappen för nytt ärende uppe till höger.' }

const TIPS: Record<string, string> = {
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
    if (l.vy === 'arende') {
      if (id === 'fotspar') { setL({ ...l, vy: 'val' }); tips('Bra', 'Getingarna är ett nytt problem hos samma kund. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Leta efter fotspåren uppe till höger.')
    } else if (l.vy === 'val') {
      if (id === 'val-nytt') { setL({ ...l, vy: 'folje' }); tips('Rätt val', 'Kund, adress och tid kopieras. Välj skadedjurstyp.') }
      else miss(TIPS[id] ?? 'Välj det som gäller ett annat skadedjur.')
    } else {
      if (id === 'skadedjur') { setL({ ...l, lista: !l.lista }); tips('Listan är öppen', 'Välj skadedjuret du hittade.') }
      else if (id.startsWith('djur-')) {
        const djur = id.slice(5)
        setL({ ...l, lista: false, djur })
        if (djur === 'Getingar') tips('Getingar är valt', 'Tryck Skapa nytt ärende.')
        else if (djur === 'Råttor') miss('Råttorna har redan ett ärende, det du står i. Välj det nya skadedjuret.')
        else miss(`Du valde ${djur}. Du hittade ett getingbo.`)
      } else if (id === 'skapa-folje') {
        if (!l.djur) miss('Knappen fungerar först när du har valt skadedjurstyp.')
        else if (l.djur !== 'Getingar') miss('Byt till Getingar först. Det var det du hittade.')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Ett nytt ärende för getingarna är skapat hos Familjen Exempel, med samma adress, tid och tekniker som råttärendet. Det har status Bokad, eget pris och egen arbetstid.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj skadedjurstyp och skapa ärendet.')
    }
  }

  const framsteg = l.vy === 'arende' ? 0 : l.vy === 'val' ? 1 : l.vy === 'klart' ? 4 : l.djur ? 3 : 2
  return (
    <OvningRam framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={() => undefined} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
