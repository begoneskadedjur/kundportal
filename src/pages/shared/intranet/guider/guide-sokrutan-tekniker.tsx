// src/pages/shared/intranet/guider/guide-sokrutan-tekniker.tsx
// Guidemodul: Hitta ett ärende eller en kund med sökrutan (tekniker, nya arbetsvyn,
// telefon och dator). Omskriven 2026-10-24 för nya vyn, slugen behålls för läsloggen.
// Källor: NyTeknikerLayout (förstoringsglaset i telefonens sidhuvud, sökfältet "Sök kund,
// adress eller ärende" med Ctrl+K på datorn), GlobalSearch (platshållaren "Sök ärende,
// kund, org.nr, telefon eller sida", Stäng i telefonen, Esc på datorn, "tolkas som ...",
// "Skriv minst två tecken.", "Inga träffar för ...") och searchModel (teknikerns åtgärder
// Skapa offert, Skapa avtal, Rapportera tillbud, Mitt schema; kunden med Öppna stationsvyn,
// Skapa offert, Skapa avtal; "Skapa offert för <kund>"; ärendet öppnas i Mina ärenden).
// Söklådan ritas med SokLada i _sok.tsx. Påhittade kunder.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { SCOPE_TEXT, SokLada, type SokGrupp } from './_sok'
import { ArendeFramme, IDAG, IdagSida, UNDER_IDAG, type Tryck } from './_nyvy_min_dag'

const TELEFON = '070-123 45 67'

const ATGARDER: SokGrupp = { key: 'actions', rader: [
  { id: 'a-offert', ikon: 'atgard', ton: 'atgard', titel: 'Skapa offert', meta: 'Öppnar offertguiden', typ: 'Åtgärd', val: ['Öppna'] },
  { id: 'a-avtal', ikon: 'atgard', ton: 'atgard', titel: 'Skapa avtal', meta: 'Öppnar avtalsguiden', typ: 'Åtgärd', val: ['Öppna'] },
  { id: 'a-tillbud', ikon: 'atgard', ton: 'atgard', titel: 'Rapportera tillbud', meta: 'Tillbud, avvikelse eller olycka', typ: 'Åtgärd', val: ['Öppna'] },
  { id: 'a-schema', ikon: 'atgard', ton: 'atgard', titel: 'Mitt schema', meta: 'Dina bokade besök', typ: 'Åtgärd', val: ['Öppna'] },
] }

/** Tom söklåda första gången: Senast öppnade och de fasta åtgärderna */
const TOM: SokGrupp[] = [
  { key: 'recent', rader: [
    { id: 'senast-ab', ikon: 'arende-avtal', ton: 'arende', titel: 'Exempel AB', nr: 'BE-0001190', meta: '2026-10-26 10:30 · Kontrollbesök', typ: 'Avtalsärende', val: ['Öppna', 'Stationsvy'] },
  ] },
  ATGARDER,
]

/** Tom söklåda efter att ärendet öppnats: det ligger överst under Senast öppnade */
const TOM_EFTER: SokGrupp[] = [
  { key: 'recent', rader: [
    { id: 'senast-fam', ikon: 'arende', ton: 'arende', titel: 'Familjen Exempel', nr: 'BE-0001234', meta: '2026-10-27 10:00 · Råttor', typ: 'Ärende', val: ['Öppna'] },
    TOM[0].rader[0],
  ] },
  ATGARDER,
]

/** Träffar på telefonnumret: två ärenden hos samma kund, det bokade först */
const TRAFFAR: SokGrupp[] = [
  { key: 'cases', rader: [
    { id: 'bokat', ikon: 'arende', ton: 'arende', titel: 'Familjen Exempel', nr: 'BE-0001234', status: { text: 'Återbesök', ton: 'info' }, meta: '2026-10-27 10:00 · Råttor', typ: 'Ärende', val: ['Öppna'] },
    { id: 'gammalt', ikon: 'arende', ton: 'arende', titel: 'Familjen Exempel', nr: 'BE-0000987', status: { text: 'Avslutat', ton: 'ok' }, meta: '2026-06-15 · Getingar', typ: 'Ärende', val: ['Öppna'] },
  ] },
]

/** Träffar på kundens namn: ärendet, kunden och åtgärderna för kunden */
const KUND: SokGrupp[] = [
  { key: 'cases', rader: [
    { id: 'ab-arende', ikon: 'arende-avtal', ton: 'arende', titel: 'Exempel AB', nr: 'BE-0001190', status: { text: 'Bokad', ton: 'info' }, meta: '2026-10-26 10:30 · Kontrollbesök', typ: 'Avtalsärende', val: ['Öppna', 'Stationsvy'] },
  ] },
  { key: 'customers', rader: [
    { id: 'ab-kund', ikon: 'kund-foretag', ton: 'kund', titel: 'Exempel AB', meta: '556000-0000 · kundnr 1042', typ: 'Stationsvy', val: ['Öppna stationsvyn', 'Skapa offert', 'Skapa avtal'] },
  ] },
  { key: 'actions', rader: [
    { id: 'ab-offert', ikon: 'atgard', ton: 'atgard', titel: 'Skapa offert för Exempel AB', meta: 'Öppnar offertguiden med kunden ifylld', typ: 'Åtgärd', val: ['Öppna'] },
    { id: 'ab-avtal', ikon: 'atgard', ton: 'atgard', titel: 'Skapa avtal för Exempel AB', meta: 'Öppnar avtalsguiden med kunden ifylld', typ: 'Åtgärd', val: ['Öppna'] },
  ] },
]

type Vy = 'start' | 'tom' | 'traff' | 'arende' | 'tom-efter' | 'kund'

const FAMILJEN = { ...IDAG[0], tid: '10:00', status: 'Återbesök' }

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const mk = (id: string) => (markor && markor.mal === id ? markor : undefined)
  const lada = (fraga: string, grupper: SokGrupp[], tolkas?: 'phone' | 'text') => (
    <SokLada mobil={enhet === 'mobil'} fraga={fraga} tolkas={tolkas} grupper={grupper} tryck={tryck} mk={mk} scope={SCOPE_TEXT.technician} />
  )
  if (vy === 'arende') {
    return (
      <NySkarm sida="arenden" titel="Mina ärenden" under="6 att ta hand om nu" onRam={tryck} markor={markor}
        over={<ArendeFramme b={FAMILJEN} markor={markor} tryck={tryck} />}>
        <IdagSida />
      </NySkarm>
    )
  }
  const over = vy === 'tom' ? lada('', TOM)
    : vy === 'tom-efter' ? lada('', TOM_EFTER)
    : vy === 'traff' ? lada(TELEFON, TRAFFAR, 'phone')
    : vy === 'kund' ? lada('Exempel AB', KUND, 'text')
    : undefined
  return (
    <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor} over={over}>
      <IdagSida />
    </NySkarm>
  )
}

const STEG: { vy: Vy; mal: string }[] = [
  { vy: 'start', mal: 'sok' },
  { vy: 'tom', mal: 'falt' },
  { vy: 'traff', mal: 'rad:bokat' },
  { vy: 'arende', mal: 'stang' },
  { vy: 'start', mal: 'sok' },
  { vy: 'tom-efter', mal: 'falt' },
  { vy: 'kund', mal: 'rad:ab-offert' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const s = STEG[Math.min(steg, STEG.length - 1)]
  return <Skarm vy={s.vy} markor={{ pa: true, nr: steg + 1, mal: s.mal }} tryck={m => { if (m === s.mal) onNasta() }} />
}

// Övningen: kunden ringer från ett nummer, hitta ärendet
function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>('start')
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `Familjen Exempel ringer från ${TELEFON} och frågar om besöket imorgon. Hitta ärendet.` }
  const [svar, setSvar] = useState<OvningSvar>(start)

  const tryck = (mal: string) => {
    if (vy === 'start') {
      if (mal === 'sok') {
        setVy('tom'); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Sökrutan är öppen', text: 'Tryck i fältet och skriv det du vet om kunden.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: enhet === 'dator' ? 'Sökfältet står överst på sidan, eller tryck Ctrl+K.' : 'Förstoringsglaset står uppe till höger.' })
      return
    }
    if (vy === 'tom') {
      if (mal === 'falt') {
        setVy('traff'); setFramsteg(2)
        setSvar({ typ: 'tips', titel: 'Numret är inskrivet', text: 'Det står tolkas som telefonnummer. Två ärenden har numret. Vilket gäller besöket imorgon?' })
        return
      }
      if (mal === 'stang') { setVy('start'); setFramsteg(0); setSvar({ typ: 'fel', titel: 'Stängd', text: 'Sökrutan stängdes. Öppna den igen.' }); return }
      setSvar({ typ: 'fel', titel: 'Skriv först', text: 'Det kunden ringde från är telefonnumret. Tryck i fältet och skriv det.' })
      return
    }
    if (vy === 'traff') {
      if (mal === 'rad:bokat' || mal === 'val:bokat:Öppna') {
        setVy('arende'); setFramsteg(3)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Ärendet BE-0001234 öppnades, återbesöket imorgon 10:00. Nästa gång ligger det överst under Senast öppnade.' })
        return
      }
      if (mal === 'rad:gammalt' || mal === 'val:gammalt:Öppna') {
        setSvar({ typ: 'fel', titel: 'Fel ärende', text: 'Det ärendet är avslutat sedan i juni. Kunden frågar om besöket imorgon, det med status Återbesök.' })
        return
      }
      if (mal === 'stang') { setVy('start'); setFramsteg(0); setSvar({ typ: 'fel', titel: 'Stängd', text: 'Sökrutan stängdes. Öppna den igen.' }); return }
      setSvar({ typ: 'fel', titel: 'Tryck på träffen', text: 'Tryck på raden med ärendet för att öppna det.' })
    }
  }
  const borjaOm = () => { setVy('start'); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
