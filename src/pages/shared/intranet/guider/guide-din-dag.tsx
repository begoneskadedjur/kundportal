// src/pages/shared/intranet/guider/guide-din-dag.tsx
// Guidemodul: Planera dagen med Idag och Karta (tekniker, telefon och dator).
// Källor: NyIdag.tsx (Nästa uppdrag med Navigera, Ring och Öppna, restiden, Dagens rutt
// med Visa på karta, Att göra, Imorgon som går till kartan med ?dag=imorgon), NyKarta.tsx
// (dagväljaren "Idag, 3 stopp" / "Imorgon, 2 stopp", numrerade stopp, valt stopp med
// knapparna) och OppnaArende (ärendet öppnas i stegflödet på Framme, krysset stänger).

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { ArendeFramme, IDAG, IdagSida, KartaSida, UNDER_IDAG, gorMk, type Tryck } from './_nyvy_min_dag'

type Vy =
  | { sida: 'idag' }
  | { sida: 'arende' }
  | { sida: 'karta'; dag: 'idag' | 'imorgon'; vald: number }

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const mk = gorMk(markor)
  if (vy.sida === 'karta') {
    const under = vy.dag === 'idag' ? `Idag, ${IDAG.length} stopp` : 'Imorgon, 2 stopp'
    return (
      <NySkarm sida="karta" titel="Karta" under={under} onRam={tryck} markor={markor}>
        <KartaSida dag={vy.dag} vald={vy.vald} mk={mk} tryck={tryck} />
      </NySkarm>
    )
  }
  return (
    <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor}
      over={vy.sida === 'arende' ? <ArendeFramme b={IDAG[0]} markor={markor} tryck={tryck} /> : undefined}>
      <IdagSida mk={mk} tryck={tryck} />
    </NySkarm>
  )
}

// Varje steg: skärmen där man gör steget, och vad som markeras
const STEG: { vy: Vy; mal: string }[] = [
  { vy: { sida: 'karta', dag: 'idag', vald: 0 }, mal: 'nav:Idag' },
  { vy: { sida: 'idag' }, mal: 'navigera' },
  { vy: { sida: 'idag' }, mal: 'oppna' },
  { vy: { sida: 'arende' }, mal: 'stang' },
  { vy: { sida: 'idag' }, mal: 'imorgon' },
  { vy: { sida: 'karta', dag: 'imorgon', vald: 0 }, mal: 'dag:idag' },
  { vy: { sida: 'karta', dag: 'idag', vald: 0 }, mal: 'stopp:2' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const s = STEG[Math.min(steg, STEG.length - 1)]
  return <Skarm vy={s.vy} markor={{ pa: true, nr: steg + 1, mal: s.mal }} tryck={m => { if (m === s.mal) onNasta() }} />
}

// Övningen: hitta morgondagens besök hos Familjen Exempel på kartan
function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>({ sida: 'idag' })
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Idag. Familjen Exempel undrar när du kommer imorgon. Hitta besöket på kartan.' }
  const [svar, setSvar] = useState<OvningSvar>(start)

  const tryck = (mal: string) => {
    if (vy.sida === 'idag') {
      if (mal === 'imorgon') {
        setVy({ sida: 'karta', dag: 'imorgon', vald: 0 }); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Rätt, morgondagens karta', text: 'Kartan visar morgondagens två stopp. Tryck på Familjen Exempel i listan.' })
        return
      }
      if (mal === 'nav:Karta' || mal === 'karta-lank') {
        setVy({ sida: 'karta', dag: 'idag', vald: 0 })
        setSvar({ typ: 'tips', titel: 'Kartan öppnades', text: 'Den visar dagens stopp. Byt till Imorgon överst på kartan.' })
        return
      }
      if (mal.startsWith('rutt:') || mal === 'oppna') {
        setSvar({ typ: 'fel', titel: 'Det är dagens besök', text: 'Dagens rutt visar idag. Morgondagen står i rutan Imorgon, 2 besök.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: enhet === 'dator' ? 'Leta efter rutan Imorgon, 2 besök till höger, eller öppna Karta i sidomenyn.' : 'Rulla ner till rutan Imorgon, 2 besök, eller tryck Karta längst ner.' })
      return
    }
    if (vy.sida === 'karta') {
      if (mal === 'dag:imorgon') {
        setVy({ sida: 'karta', dag: 'imorgon', vald: 0 }); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Bra', text: 'Nu visar kartan imorgon. Tryck på Familjen Exempel i listan.' })
        return
      }
      if (vy.dag === 'imorgon' && mal === 'stopp:2') {
        setVy({ sida: 'karta', dag: 'imorgon', vald: 1 }); setFramsteg(2)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Familjen Exempel är stopp 2 av 2 imorgon, klockan 10:00. Med Ring kan du ringa och säga det direkt.' })
        return
      }
      if (vy.dag === 'imorgon' && mal === 'stopp:1') {
        setVy({ sida: 'karta', dag: 'imorgon', vald: 0 })
        setSvar({ typ: 'fel', titel: 'Fel stopp', text: 'Stopp 1 är Brf Exempelgården. Familjen Exempel är stopp 2.' })
        return
      }
      if (vy.dag === 'idag') {
        setSvar({ typ: 'fel', titel: 'Det är idag', text: 'Kartan visar dagens stopp. Tryck Imorgon, 2 stopp överst på kartan.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: 'Tryck på Familjen Exempel i listan under kartan.' })
    }
  }
  const borjaOm = () => { setVy({ sida: 'idag' }); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={2} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
