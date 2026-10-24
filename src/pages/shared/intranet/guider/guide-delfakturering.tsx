// src/pages/shared/intranet/guider/guide-delfakturering.tsx
// Guidemodul: Delfakturera ett ärende (tekniker, nya arbetsvyn, telefon och dator).
// Delfakturan är kryssrutan Skapa delfaktura för nuvarande tjänster i RevisitModal, som
// nya vyn öppnar från steget Klart › Bara besöket › Boka återbesök. Rutan visas när
// ärendet har ofakturerade rader (annars "Inga ofakturerade tjänster på ärendet") och är
// grå när ärendet har ett anpassat pris för hela jobbet. Raderna visas exkl. moms med
// Totalt (exkl. moms). Företagskund i exemplet, påhittad, inget sparas.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import { ArendeRam, AterbesokRuta, KlartInnehall, Notis, RapportInnehall, type AterbesokLage } from './_nyvy_arendet'
import type { GuideModul } from './registry'

const KUNDEN = 'Brf Exempelgården · Exempelgatan 2, Södertälje'
const ARENDE = 'BE-0001240'
const RADER: [string, number][] = [['Råttbekämpning, första besöket', 1800], ['Tätning av ventil', 950]]

type Vy = 'rapport' | 'klart' | 'dialog' | 'bokat'
interface Lage { vy: Vy; val: 'hela' | 'besok'; a: AterbesokLage }

const A0: AterbesokLage = { steg: 1, datum: true, langd: 60, manuellt: false, tid: null, anteckning: false, delfaktura: false, rader: RADER }

function Skarm({ l, markera, nr, tryck }: { l: Lage; markera?: string; nr: number; tryck: (id: string) => void }) {
  const bokat = l.vy === 'bokat'
  return (
    <ArendeRam aktivt={l.vy === 'rapport' ? 'rapport' : 'klart'} markera={markera} nr={nr} tryck={tryck} kund={KUNDEN} arendeNr={ARENDE}
      status={bokat ? 'Återbesök' : 'Bokad'} statusFarg={bokat ? 'bg-teal-400' : undefined}
      over={l.vy === 'dialog' ? <AterbesokRuta a={l.a} markera={markera} nr={nr} tryck={tryck} />
        : bokat ? <Notis text={l.a.delfaktura ? 'Återbesök bokat och delfaktura INV-202610-10042 skapad!' : 'Återbesök bokat!'} /> : undefined}>
      {l.vy === 'rapport'
        ? <RapportInnehall nr={nr} tryck={tryck} skrivet skickad />
        : <KlartInnehall k={{ hinder: [], val: l.val, provisionText: 'Underlaget 2 750 kr exkl. moms är under gränsen för provision (4 000 kr), ingen provision registreras.' }} markera={markera} nr={nr} tryck={tryck} />}
    </ArendeRam>
  )
}

// ─── Visning ───

const VISNING: { l: Lage; markera: string }[] = [
  { l: { vy: 'rapport', val: 'hela', a: A0 }, markera: 'steg:klart' },
  { l: { vy: 'klart', val: 'hela', a: A0 }, markera: 'besok' },
  { l: { vy: 'klart', val: 'besok', a: A0 }, markera: 'boka' },
  { l: { vy: 'dialog', val: 'besok', a: A0 }, markera: 'visa' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, steg: 2 } }, markera: 'tid:08:00' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, steg: 2, tid: '08:00' } }, markera: 'delfaktura' },
  { l: { vy: 'dialog', val: 'besok', a: { ...A0, steg: 2, tid: '08:00', delfaktura: true } }, markera: 'boka-ok' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.l} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const START: Lage = { vy: 'rapport', val: 'hela', a: { ...A0, datum: false } }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Brf Exempelgården ska få faktura för det som är gjort nu. Du kommer tillbaka tisdag 2026-10-27 kl 08:00. Gå till steget Klart.' }

const TIPS: Record<string, string> = {
  hela: 'Hela ärendet stänger ärendet. Du ska tillbaka, så välj Bara besöket.',
  'stang-hela': 'Det stänger hela ärendet. Du ska tillbaka.',
  'spara-utan': 'Spara utan att stänga gör ingen faktura och bokar inget.',
  lead: 'Skapa lead är för tips om avtal eller mer arbete.',
  'tid:10:30': 'Du kommer tillbaka kl 08:00.',
  'tid:13:30': 'Du kommer tillbaka kl 08:00.',
  manuellt: 'Det går också, men 08:00 finns bland förslagen.',
  avbryt: 'Avbryt stänger dialogen. Fortsätt i stället.',
  'stang-aterbesok': 'Krysset stänger dialogen. Fortsätt i stället.',
  anteckning: 'En anteckning är bra, men uppdraget handlar om fakturan.',
  'byt-datum': 'Datumet är rätt.',
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
      if (id === 'steg:klart') { setL({ ...l, vy: 'klart' }); tips('Klart', 'Ärendet ska fortsätta med ett återbesök.') }
      else miss(TIPS[id] ?? 'Tryck på ikonen Klart längst till höger i stegraden.')
      return
    }
    if (l.vy === 'klart') {
      if (id === 'besok') { setL({ ...l, val: 'besok' }); tips('Bara besöket', 'Delfakturan är en kryssruta i återbesöksdialogen. Öppna den.') }
      else if (id === 'boka' && l.val === 'besok') { setL({ ...l, vy: 'dialog' }); tips('Boka återbesök', 'Välj tisdag 27 oktober och visa förslagen.') }
      else miss(TIPS[id] ?? 'Välj Bara besöket.')
      return
    }
    if (a.steg === 1) {
      if (id === 'datum') { setA({ datum: true }); tips('Datum valt', 'Tryck Visa förslag →.') }
      else if (id === 'visa') {
        if (!a.datum) miss('Knappen fungerar först när du har valt datum.')
        else { setA({ steg: 2 }); tips('Förslagen', 'Välj 08:00. Delfakturan finns längre ner.') }
      } else if (id.startsWith('langd:')) { setA({ langd: Number(id.split(':')[1]) as AterbesokLage['langd'] }); tips('Längd vald', 'Längden spelar ingen roll för fakturan. Välj datum och visa förslagen.') }
      else miss(TIPS[id] ?? 'Välj datum under Datum för återbesök *.')
      return
    }
    if (id === 'tid:08:00') { setA({ tid: '08:00' }); tips('08:00', a.delfaktura ? 'Tryck Boka återbesök.' : 'Kunden ska faktureras nu. Vad kryssar du i?') }
    else if (id === 'delfaktura') {
      const pa = !a.delfaktura
      setA({ delfaktura: pa })
      tips(pa ? 'Delfakturan är med' : 'Bortkryssad', pa ? `Du ser raderna och Totalt (exkl. moms) 2 750 kr.${a.tid ? ' Tryck Boka återbesök.' : ' Välj tid också.'}` : 'Uppdraget var att fakturera nu.')
    } else if (id === 'boka-ok') {
      if (!a.tid) miss('Välj en tid först.')
      else if (!a.delfaktura) miss('Kunden ska faktureras nu. Kryssa i Skapa delfaktura för nuvarande tjänster.')
      else {
        setL({ ...l, vy: 'bokat' })
        setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Återbesöket är bokat och delfakturan på 2 750 kr exkl. moms är skapad. Den går vidare till godkännande och Fortnox, kunden får inget direkt. Raderna är fakturerade och borta från ärendet, så nästa besök börjar från noll.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}.` : ''}` })
      }
    } else miss(TIPS[id] ?? 'Välj tid, kryssa i delfakturan och boka.')
  }

  const framsteg = l.vy === 'rapport' ? 0 : l.vy === 'klart' ? (l.val === 'besok' ? 2 : 1) : l.vy === 'bokat' ? 7
    : a.steg === 1 ? 3 : 4 + (a.tid ? 1 : 0) + (a.delfaktura ? 1 : 0)
  return (
    <OvningRam framsteg={framsteg} totalt={7} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} nr={0} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
