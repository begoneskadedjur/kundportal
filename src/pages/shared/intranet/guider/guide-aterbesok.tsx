// src/pages/shared/intranet/guider/guide-aterbesok.tsx
// Guidemodul: Boka ett återbesök (tekniker, nya arbetsvyn, telefon och dator).
// Vägen i nya vyn: steget Klart › Bara besöket › Boka återbesök (KlartSteg med
// onBaraBesoket i EditCaseModal, finns inte i följeärenden: canCreateFollowUp).
// Dialogen är RevisitModal: Datum för återbesök *, Besökslängd (30 min, 1 tim, 1.5 tim,
// 2 tim), Visa förslag →, Smarta förslag / Ange tid manuellt, Anteckning (valfritt),
// Boka återbesök. Helger går inte att välja (filterDate). Påhittad kund, inget sparas.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import { ArendeRam, AterbesokRuta, KlartInnehall, Notis, RapportInnehall, type AterbesokLage } from './_nyvy_arendet'
import type { GuideModul } from './registry'

type Vy = 'rapport' | 'klart' | 'dialog' | 'bokat'
interface Lage { vy: Vy; val: 'hela' | 'besok'; a: AterbesokLage }

const A0: AterbesokLage = { steg: 1, datum: false, langd: 60, manuellt: false, tid: null, anteckning: false, delfaktura: false, rader: [['Råttor, sanering', 3500]] }

function Skarm({ l, markera, nr, tryck }: { l: Lage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const bokat = l.vy === 'bokat'
  return (
    <ArendeRam aktivt={l.vy === 'rapport' ? 'rapport' : 'klart'} markera={markera} nr={nr} tryck={tryck}
      status={bokat ? 'Återbesök' : 'Bokad'} statusFarg={bokat ? 'bg-teal-400' : undefined}
      over={l.vy === 'dialog' ? <AterbesokRuta a={l.a} markera={markera} nr={nr} tryck={tryck} /> : bokat ? <Notis text="Återbesök bokat!" /> : undefined}>
      {l.vy === 'rapport'
        ? <RapportInnehall nr={nr} tryck={tryck} skrivet skickad />
        : <KlartInnehall k={{ hinder: [], val: l.val, provisionText: 'Underlaget 3 500 kr exkl. moms är under gränsen för provision (4 000 kr), ingen provision registreras.' }} markera={markera} nr={nr} tryck={tryck} />}
    </ArendeRam>
  )
}

// ─── Visning ───

const VISNING: { l: Lage; markera: string }[] = [
  { l: { vy: 'rapport', val: 'hela', a: A0 }, markera: 'steg:klart' },
  { l: { vy: 'klart', val: 'hela', a: A0 }, markera: 'besok' },
  { l: { vy: 'klart', val: 'besok', a: A0 }, markera: 'boka' },
  { l: { vy: 'dialog', val: 'besok', a: A0 }, markera: 'datum' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, datum: true } }, markera: 'visa' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, datum: true, steg: 2 } }, markera: 'tid:08:00' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, datum: true, steg: 2, tid: '08:00' } }, markera: 'boka-ok' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.l} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'rapport', val: 'hela', a: A0 }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Rapporten är skickad. Du ska tillbaka till Familjen Exempel tisdag 2026-10-27 kl 10:30, en och en halv timme. Gå till steget där du väljer vad som är klart.' }

const TIPS: Record<string, string> = {
  hela: 'Hela ärendet stänger ärendet. Du ska tillbaka, så ärendet ska fortsätta.',
  'stang-hela': 'Det stänger hela ärendet. Välj Bara besöket först.',
  'spara-utan': 'Spara utan att stänga bokar inget återbesök.',
  lead: 'Skapa lead är för tips om avtal eller mer arbete.',
  manuellt: 'Det går också, men 10:30 finns bland förslagen.',
  smarta: 'Smarta förslag är redan valt.',
  'tid:08:00': 'Kunden ville ha 10:30.',
  'tid:13:30': 'Kunden ville ha 10:30.',
  delfaktura: 'Uppdraget sa inget om att fakturera nu. Raderna ligger kvar till nästa gång.',
  avbryt: 'Avbryt stänger dialogen. Fortsätt i stället.',
  'stang-aterbesok': 'Krysset stänger dialogen. Fortsätt i stället.',
  'byt-datum': 'Datumet är rätt, tisdag 27 oktober.',
  verktyg: 'Boka återbesök finns också i Ärendets verktyg, men här går du via steget Klart.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const a = l.a
  const setA = (n: Partial<AterbesokLage>) => setL({ ...l, a: { ...a, ...n } })

  const tryck = (id: string) => {
    if (l.vy === 'bokat') return
    if (l.vy === 'rapport') {
      if (id === 'steg:klart') { setL({ ...l, vy: 'klart' }); tips('Klart', 'Ärendet ska fortsätta. Vilket val passar?') }
      else miss(TIPS[id] ?? 'Tryck på ikonen Klart längst till höger i stegraden.')
      return
    }
    if (l.vy === 'klart') {
      if (id === 'besok') { setL({ ...l, val: 'besok' }); tips('Bara besöket', 'Läs vad som händer och tryck på den gröna knappen.') }
      else if (id === 'boka' && l.val === 'besok') { setL({ ...l, vy: 'dialog' }); tips('Boka återbesök', 'Välj datum och längd.') }
      else miss(TIPS[id] ?? 'Välj Bara besöket.')
      return
    }
    if (a.steg === 1) {
      if (id === 'datum') { setA({ datum: true }); tips('Tisdag 27 oktober', 'Välj nu längden på besöket.') }
      else if (id === 'langd:90') { setA({ langd: 90 }); tips('1.5 tim', a.datum ? 'Tryck Visa förslag →.' : 'Välj datum också.') }
      else if (id.startsWith('langd:')) miss('Besöket ska vara en och en halv timme.')
      else if (id === 'visa') {
        if (!a.datum) miss('Knappen fungerar först när du har valt datum.')
        else if (a.langd !== 90) miss('Välj Besökslängd 1.5 tim först, annars blir förslagen för korta.')
        else { setA({ steg: 2 }); tips('Förslagen', 'Välj den tid kunden ville ha.') }
      } else miss(TIPS[id] ?? 'Välj datum under Datum för återbesök *.')
      return
    }
    if (id === 'tid:10:30') { setA({ tid: '10:30' }); tips('10:30 till 12:00', 'Skriv en anteckning till nästa besök: Kontrollera fällorna i källaren.') }
    else if (id === 'anteckning') { setA({ anteckning: true }); tips('Anteckningen är med', a.tid ? 'Tryck Boka återbesök.' : 'Välj tid också.') }
    else if (id === 'boka-ok') {
      if (!a.tid) miss('Välj en tid först.')
      else if (!a.anteckning) miss('Skriv anteckningen först, så vet du vad som ska göras nästa gång.')
      else {
        setL({ ...l, vy: 'bokat' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Återbesöket är bokat tisdag 2026-10-27 10:30 till 12:00. Ärendet har status Återbesök och står kvar öppet. Raderna ligger kvar till nästa gång.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}.` : ''}` })
      }
    } else miss(TIPS[id] ?? 'Välj tid och skriv anteckningen.')
  }

  const framsteg = l.vy === 'rapport' ? 0 : l.vy === 'klart' ? (l.val === 'besok' ? 2 : 1) : l.vy === 'bokat' ? 9
    : a.steg === 1 ? 3 + (a.datum ? 1 : 0) + (a.langd === 90 ? 1 : 0) : 6 + (a.tid ? 1 : 0) + (a.anteckning ? 1 : 0)
  return (
    <OvningRam framsteg={framsteg} totalt={9} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} nr={0} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
