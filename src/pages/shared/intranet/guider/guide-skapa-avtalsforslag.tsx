// src/pages/shared/intranet/guider/guide-skapa-avtalsforslag.tsx
// Guidemodul: Skapa och skicka ett avtalsförslag (tekniker, nya arbetsvyn, telefon och dator).
//
// Efterbildning av Skapa > Vad vill du göra? > Avtal eller offert (/technician/oneflow) och
// OneflowContractCreator i avtalsläget. Skärmarna för stegen ligger i _avtalsforslag.tsx och
// delas med kontorets guide. Visningen kopplar en befintlig kund med enheter (Kundgrupp hoppas
// över), övningen lägger upp en ny kund och väljer kundgrupp. Påhittade kunder, inget skickas.

import { useState, type ReactNode } from 'react'
import { Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { SkapaArket, ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'
import {
  AVTAL_BAS, AVTAL_KOPPLAD, AVTAL_ORDNING, AvtalWizard, NY, ORG, PREMIE, avtalOvningTryck, type AvtalLage,
} from './_avtalsforslag'

function Idag({ over, onRam, markor }: { over?: ReactNode; onRam: (m: string) => void; markor?: { pa: boolean; nr: number; mal: string } }) {
  return (
    <NySkarm sida="idag" titel="Idag" under="Onsdag 28 oktober, 3 besök" onRam={onRam} markor={markor} over={over}>
      <NyGrupp titel="Dagens rutt" antal={3}>
        <NyRad titel={ORG.namn} tid="08:00" under="Avtal, råttor" status="Bokad" />
        <NyRad titel={NY.namn} tid="10:30" under="Möss i soprummet" status="Bokad" />
        <NyRad titel="Familjen Exempel" tid="13:00" status="Bokad" />
      </NyGrupp>
    </NySkarm>
  )
}

function Skarm({ l, mk, tryck }: { l: AvtalLage; mk: Mk; tryck: Tryck }) {
  if (l.vy === 'start' || l.vy === 'ark') {
    return <Idag onRam={tryck} over={l.vy === 'ark' ? <SkapaArket tryck={tryck} mk={mk} /> : undefined} />
  }
  return (
    <NySkarm sida="avtal" titel="Avtal och offerter" onRam={tryck}
      over={l.vy === 'klart' ? <Notis text="Avtalet är skickat" /> : undefined}>
      <AvtalWizard l={l} tryck={tryck} mk={mk} />
    </NySkarm>
  )
}

// --- Visning: befintlig kund med enheter ---

const MOTPART: AvtalLage = { ...AVTAL_BAS, mall: AVTAL_KOPPLAD.mall, vy: 'motpart' }

const VISNING: { lage: AvtalLage; markera: string }[] = [
  { lage: AVTAL_BAS, markera: 'skapa-knapp' },
  { lage: { ...AVTAL_BAS, vy: 'ark' }, markera: 'skapa:Avtal eller offert' },
  { lage: { ...MOTPART, sok: 'traff' }, markera: 'koppla' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'motpart', omf: null }, markera: 'omf:alla' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'innehall' }, markera: 'nasta' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'granska' }, markera: 'skapa-pdf' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'pdf' }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const skapaMal = enhet === 'dator' ? 'skapa' : 'nav:Skapa'
  if (v.markera === 'skapa-knapp') {
    return <Idag markor={{ pa: true, nr: steg + 1, mal: skapaMal }} onRam={m => { if (m === skapaMal) onNasta() }} />
  }
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning: ny kund ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${NY.namn} vill ha löpande kontroll mot gnagare, ${PREMIE} per år. Föreningen är inte kund än. Skapa avtalsförslaget och skicka det. Börja med Skapa.` }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<AvtalLage>(AVTAL_BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'start') {
      if (id === 'nav:Skapa' || id === 'skapa') { setL({ ...l, vy: 'ark' }); setSvar({ typ: 'tips', titel: 'Vad vill du göra?', text: 'Välj Avtal eller offert.' }) }
      else miss(enhet === 'dator' ? 'Skapa är den gröna knappen uppe i sidhuvudet.' : 'Skapa är den gröna knappen mitt i bottenmenyn.')
      return
    }
    if (l.vy === 'ark') {
      if (id === 'skapa:Avtal eller offert') { setL({ ...l, vy: 'dokument' }); setSvar({ typ: 'tips', titel: 'Skapa avtal eller offert är öppen', text: 'Avtalsförslag är förvalt. Tryck Nästa.' }) }
      else miss('Avtalsförslaget skapar du med Avtal eller offert, överst i rutan.')
      return
    }
    const r = avtalOvningTryck(l, id, fel)
    if (!r) return
    if (r.miss) { miss(r.svar.text); return }
    if (r.lage) setL(r.lage)
    setSvar(r.svar)
  }

  const framsteg = Math.max(0, AVTAL_ORDNING.indexOf(l.vy) - 1)
  return (
    <OvningRam framsteg={framsteg} totalt={AVTAL_ORDNING.length - 2} svar={svar} onBorjaOm={() => { setL(AVTAL_BAS); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
