// src/pages/shared/intranet/guider/guide-fakturering.tsx
// Guidemodul: Stäng ärendet eller bara besöket (tekniker, nya arbetsvyn, telefon och dator).
// Steget Klart i EditCaseModal (KlartSteg): Kontrollera innan du stänger kör
// kontrolleraAvslut (arendeAvslutService) och visar hindren med Gå till steget <namn>.
// Hindret i exemplet är rotrut-fastighet: "Fastighetsbeteckning krävs för ROT/RUT på: ...".
// ROT-raden heter Skadedjurstekniker timpris (tjänst 135, used_for_addon_labour).
// Stäng hela ärendet: Sparar ärendet..., Kontrollerar ärendet..., Stänger ärendet...
// Exemplet 3 750 kr inkl. moms ger ingen provision (under 4 000 kr exkl. moms), därför
// toasten "Ärendet avslutat och faktura genererad!".

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import { ArendeRam, KlartInnehall, Notis, PrisInnehall, type KlartLage, type PrisLage } from './_nyvy_arendet'
import type { GuideModul } from './registry'

const HINDER = { text: 'Fastighetsbeteckning krävs för ROT/RUT på: Skadedjurstekniker timpris.', steg: 'Pris och fakturering' }

type Vy = 'pris' | 'klart' | 'avslutat'
interface Lage { vy: Vy; fastighet: boolean; fel: boolean; val: 'hela' | 'besok'; notis?: string }

function prisLage(l: Lage): PrisLage {
  return {
    rader: [{ namn: 'Tätning av ventil', pris: 3750 }],
    delning: { arbete: 2500, timmar: 2, typ: 'ROT' },
    fastighet: l.fastighet ? 'Exempelby 1:23' : null,
    fastighetFel: l.fel,
    marginal: '28,6%', marginalFarg: 'text-yellow-400',
  }
}

function Skarm({ l, markera, nr, tryck }: { l: Lage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const k: KlartLage = { hinder: l.fastighet ? [] : [HINDER], val: l.val, avslutat: l.vy === 'avslutat' }
  return (
    <ArendeRam aktivt={l.vy === 'pris' ? 'pris' : 'klart'} markera={markera} nr={nr} tryck={tryck}
      status={l.vy === 'avslutat' ? 'Avslutat' : 'Bokad'} statusFarg={l.vy === 'avslutat' ? 'bg-[#20c58f]' : undefined}
      over={l.notis ? <Notis text={l.notis} /> : undefined}>
      {l.vy === 'pris'
        ? <PrisInnehall l={prisLage(l)} markera={markera} nr={nr} tryck={tryck} />
        : <KlartInnehall k={k} markera={markera} nr={nr} tryck={tryck} />}
    </ArendeRam>
  )
}

// ─── Visning ───

const VISNING: { l: Lage; markera: string }[] = [
  { l: { vy: 'pris', fastighet: false, fel: false, val: 'hela' }, markera: 'steg:klart' },
  { l: { vy: 'klart', fastighet: false, fel: false, val: 'hela' }, markera: `gatill:${HINDER.steg}` },
  { l: { vy: 'pris', fastighet: false, fel: true, val: 'hela' }, markera: 'fastighet' },
  { l: { vy: 'pris', fastighet: true, fel: true, val: 'hela' }, markera: 'steg:klart' },
  { l: { vy: 'klart', fastighet: true, fel: false, val: 'hela' }, markera: 'hela' },
  { l: { vy: 'klart', fastighet: true, fel: false, val: 'hela' }, markera: 'stang-hela' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.l} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'pris', fastighet: false, fel: false, val: 'hela' }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Jobbet hos Familjen Exempel är klart och raderna är ifyllda. Gå till steget där du stänger ärendet.' }

const TIPS: Record<string, string> = {
  besok: 'Bara besöket är för när du ska tillbaka. Jobbet är klart, så hela ärendet ska stängas.',
  'spara-utan': 'Spara utan att stänga sparar men låter ärendet stå öppet. Uppdraget var att stänga det.',
  lead: 'Skapa lead är för ett tips om avtal eller mer arbete. Det behövs inte här.',
  boka: 'Det bokar ett återbesök. Jobbet är klart.',
  verktyg: 'Ärendets verktyg behövs inte. Allt finns i steget Klart.',
  flikvy: 'Alla uppgifter behövs inte. Stanna i stegen.',
  stang: 'Krysset stänger bara rutan. Ärendet är kvar öppet.',
  delaupp: 'Uppdelningen är redan gjord. Fyll i fastighetsbeteckningen.',
  prisguide: 'Priset är rätt. Det som saknas är fastighetsbeteckningen.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(START)
  const [besokt, setBesokt] = useState(false)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'avslutat') return
    if (l.vy === 'pris') {
      if (id === 'steg:klart' || id === 'nasta') {
        setL({ ...l, vy: 'klart', fel: false }); setBesokt(true)
        tips(l.fastighet ? 'Inget saknas' : 'Något saknas', l.fastighet ? 'Det står Inget saknas enligt det som är sparat. Kontrollera valet och stäng.' : 'Läs vad som saknas och gå dit med knappen.')
      } else if (id === 'fastighet') {
        if (!besokt) miss('Gå först till steget Klart och se vad kontrollen säger.')
        else { setL({ ...l, fastighet: true }); tips('Ifyllt', 'Exempelby 1:23 är sparat på raden. Gå tillbaka till Klart.') }
      } else miss(TIPS[id] ?? (besokt ? 'Fyll i Fastighetsbeteckning * under raden med ROT.' : 'Tryck på ikonen Klart längst till höger i stegraden.'))
      return
    }
    // klart
    if (id === `gatill:${HINDER.steg}`) { setL({ ...l, vy: 'pris', fel: true }); tips('Rätt steg', 'Fältet Fastighetsbeteckning * är rött. Fyll i Exempelby 1:23.') }
    else if (id === 'hela') { setL({ ...l, val: 'hela' }); tips('Hela ärendet', 'Hela ärendet är valt. Läs Det här händer när du stänger.') }
    else if (id === 'stang-hela') {
      if (!l.fastighet) miss('1 sak saknas innan ärendet kan stängas. Knappen sparar och kontrollerar, men stänger inte förrän fastighetsbeteckningen finns.')
      else if (l.val !== 'hela') miss('Välj Hela ärendet först.')
      else {
        setL({ ...l, vy: 'avslutat', notis: 'Ärendet avslutat och faktura genererad!' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Ärendet är avslutat med avslutsdatum. Fakturan på 3 750 kr går vidare till godkännande och Fortnox, kunden får inget direkt. Ingen provision, underlaget 3 000 kr exkl. moms är under 4 000 kr.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}.` : ''}` })
      }
    } else if (id === 'besok') { setL({ ...l, val: 'besok' }); miss(TIPS.besok) }
    else miss(TIPS[id] ?? 'Läs Kontrollera innan du stänger överst i steget.')
  }

  const framsteg = l.vy === 'avslutat' ? 4 : l.fastighet ? (l.vy === 'klart' ? 3 : 2) : besokt ? 1 : 0
  return (
    <OvningRam framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(START); setBesokt(false); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} nr={0} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
