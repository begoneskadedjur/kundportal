// src/pages/shared/intranet/guider/guide-tillaggsstationer.tsx
// Guidemodul: Sätt ut en tilläggsstation (tekniker, nya arbetsvyn, telefon och dator).
// Slugen behålls för länkar och läsloggen.
// Etiketterna följer NyKundStationer (Placera ny station, Karta, Lista, Planritning,
// Schema), AddStationWizard (Välj typ, Utomhus), EtableringsFlode (Placera station
// utomhus, Stationen är placerad), EquipmentPlacementForm (Tillägg utöver avtal med
// texten om årspremien, Skapa placering), AddonModelPicker (Betalas, per år, per månad,
// per kontroll, Kräver att kunden har ett avtal i avtalskartan, pris saknas) med
// ADDON_BILLING_MODEL_HELP, useEtableringsflode (toasten Utrustning placerad!) och
// ChangeStationTypeSheet (Byt stationstyp, Byt till X, Tidigare kontroller står kvar
// som X). Kontrollerat 2026-10-24. Påhittad kund, inga priser visas.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import {
  KundSida, PlaceraUtomhus, Placerad, TYPER, Toast, ValjTyp,
  type Betalas, type Placering, type Stn, type TypNyckel,
} from './_nyvy_stationer'

type Vy = 'kund' | 'typ' | 'form' | 'placerad'

interface Lage {
  vy: Vy
  p: Placering
  toast: string | null
}

const KUND = 'Brf Exempelgården'
const STATIONER: Stn[] = [
  { nr: 1, typ: TYPER.betong, x: 18, y: 28 },
  { nr: 2, typ: TYPER.betong, x: 32, y: 82 },
  { nr: 3, typ: TYPER.betong, x: 64, y: 55 },
  { nr: 4, typ: TYPER.mekanisk, x: 86, y: 28 },
]

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const stationer = l.vy === 'placerad' ? [...STATIONER, { nr: 5, typ: TYPER.betong, x: 50, y: 20, tillagg: true }] : STATIONER
  return (
    <NySkarm sida="stationer" titel="Stationer" under="3 kunder, 26 stationer" onRam={tryck}
      over={<>
        {l.vy === 'typ' && <ValjTyp kund={KUND} tryck={tryck} markera={markera} nr={nr} />}
        {l.vy === 'form' && <PlaceraUtomhus kund={KUND} p={l.p} tryck={tryck} markera={markera} nr={nr} />}
        {l.vy === 'placerad' && <Placerad kund={KUND} antal={1} tryck={tryck} markera={markera} nr={nr} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <KundSida kund={KUND} adress="Exempelvägen 3, Gävle" stationer={stationer} tryck={tryck} markera={markera} nr={nr} />
    </NySkarm>
  )
}

// ─── Visning ───

const TOM: Placering = { typ: null, tillagg: false, betalas: null, gps: false, fel: null, placerade: 0 }
const BAS: Lage = { vy: 'kund', p: TOM, toast: null }
const MED: Placering = { ...TOM, typ: 'betong' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'placera-ny' },
  { lage: { ...BAS, vy: 'typ' }, markera: 'utomhus' },
  { lage: { ...BAS, vy: 'form' }, markera: 'typ-betong' },
  { lage: { ...BAS, vy: 'form', p: MED }, markera: 'tillagg' },
  { lage: { ...BAS, vy: 'form', p: { ...MED, tillagg: true } }, markera: 'betalas-per år' },
  { lage: { ...BAS, vy: 'form', p: { ...MED, tillagg: true, betalas: 'per år' } }, markera: 'gps' },
  { lage: { ...BAS, vy: 'form', p: { ...MED, tillagg: true, betalas: 'per år', gps: true } }, markera: 'skapa' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: en betongstation per månad ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${KUND} vill ha en betongstation till vid soprummet, utöver avtalet. De betalar per månad. Du står på kundens sida.` }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte riktigt', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'placerad') return
    if (l.vy === 'kund') {
      if (id === 'placera-ny') { setL({ ...l, vy: 'typ' }); tips('Kunden är vald', 'Soprummet ligger ute. Var ska stationen stå?') }
      else if (id.startsWith('stn:')) miss('Där öppnas en befintlig station. Den nya placerar du med Placera ny station.')
      else miss('Tryck Placera ny station under kunduppgifterna.')
      return
    }
    if (l.vy === 'typ') {
      if (id === 'utomhus') { setL({ ...l, vy: 'form' }); tips('Placera station utomhus', 'Välj typen först.') }
      else miss('Soprummet ligger ute. Välj Utomhus.')
      return
    }
    const p = l.p
    if (id.startsWith('typ-')) {
      const k = id.slice(4) as TypNyckel
      setL({ ...l, p: { ...p, typ: k, fel: null } })
      if (k === 'betong') tips('Betongstation vald', 'Kunden betalar för den utöver avtalet. Markera det.')
      else miss('Kunden ville ha en betongstation. Välj Betongstation.')
    } else if (id === 'tillagg') {
      setL({ ...l, p: { ...p, tillagg: !p.tillagg, betalas: p.tillagg ? null : p.betalas } })
      if (!p.tillagg) tips('Tillägg utöver avtal', 'Välj hur kunden betalar under Betalas.')
    } else if (id.startsWith('betalas-')) {
      const b = id.slice(8) as Betalas
      setL({ ...l, p: { ...p, betalas: b } })
      if (b === 'per månad') tips('Per månad', 'Faktureras månadsvis, årspriset delat med tolv. Hämta positionen.')
      else miss(`Kunden ville betala per månad, inte ${b}.`)
    } else if (id === 'gps' || id === 'karta') {
      setL({ ...l, p: { ...p, gps: true, fel: null } })
      tips('Positionen är hämtad', 'Kontrollera valen och tryck Skapa placering.')
    } else if (id === 'skapa') {
      if (p.typ !== 'betong') miss('Välj Betongstation under Utrustningstyp först.')
      else if (!p.tillagg) miss('Stationen ingår inte i avtalet. Bocka i Tillägg utöver avtal, annars faktureras den inte.')
      else if (p.betalas !== 'per månad') miss('Välj per månad under Betalas.')
      else if (!p.gps) { setL({ ...l, p: { ...p, fel: 'GPS-position krävs. Tryck på Hämta GPS.' } }); miss('Portalen sparar inte utan position. Tryck Hämta GPS först.') }
      else {
        setL({ ...l, vy: 'placerad', toast: 'Utrustning placerad!' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Betongstationen står som tillägg utöver avtal, per månad. Den faktureras månadsvis med priset ur kundens prislista. Avtalets stationer påverkas inte.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
      }
    } else if (id === 'form-stang' || id === 'avbryt') {
      miss('Krysset och Avbryt avslutar placeringen. Placera stationen först.')
    } else miss('Välj typ, bocka i Tillägg utöver avtal, välj per månad, hämta GPS och tryck Skapa placering.')
  }

  const p = l.p
  const framsteg = l.vy === 'kund' ? 0 : l.vy === 'typ' ? 1 : l.vy === 'placerad' ? 7
    : 2 + (p.typ === 'betong' ? 1 : 0) + (p.tillagg ? 1 : 0) + (p.betalas === 'per månad' ? 1 : 0) + (p.gps ? 1 : 0)
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
