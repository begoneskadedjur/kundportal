// src/pages/shared/intranet/guider/guide-utfora-arende.tsx
// Guidemodul: Gör ett besök steg för steg (tekniker, nya arbetsvyn, telefon och dator).
// Flödet följer EditCaseModal i stegläget (stegKonfig 'privat': Framme, Arbetet, Foton och
// preparat, Rapport, Pris och fakturering, Klart). Den gröna knappen i Framme heter
// Jag är framme för den som är tilldelad (startaTidVidFramme), annars Vidare till arbetet.
// Påhittad kund, ingenting sparas.

import { useState } from 'react'
import { OvningRam, type OvningSvar } from '../skarmkit'
import { useGuideEnhet } from '../skarmkit/nyvy'
import {
  ArbeteInnehall, ArendeRam, FlikVy, FotonInnehall, FrammeInnehall, IdagSkarm, PrisInnehall, RapportInnehall, VerktygArk, type PrisLage,
} from './_nyvy_arendet'
import type { GuideModul } from './registry'

type Vy = 'idag' | 'framme' | 'arbete' | 'foton' | 'rapport' | 'pris'

interface Lage { vy: Vy; bilder: number; skrivet: boolean; skickad: boolean }

const PRIS: PrisLage = { rader: [{ namn: 'Råttor, sanering', pris: 4375 }], marginal: '41,7%' }

function Skarm({ l, markera, nr, tryck, lager }: { l: Lage; markera?: string; nr: number; tryck: (id: string) => void; lager?: 'verktyg' | 'flikvy' | null }) {
  if (l.vy === 'idag') return <IdagSkarm markera={markera} nr={nr} tryck={tryck} />
  const aktivt = l.vy === 'pris' ? 'pris' : l.vy
  return (
    <ArendeRam aktivt={aktivt} markera={markera} nr={nr} tryck={tryck}
      nastaText={l.vy === 'framme' ? 'Jag är framme' : undefined}
      over={lager === 'verktyg' ? <VerktygArk nr={nr} tryck={tryck} /> : lager === 'flikvy' ? <FlikVy nr={nr} tryck={tryck} /> : undefined}>
      {l.vy === 'framme' && <FrammeInnehall markera={markera} nr={nr} tryck={tryck} />}
      {l.vy === 'arbete' && <ArbeteInnehall markera={markera} nr={nr} tryck={tryck} />}
      {l.vy === 'foton' && <FotonInnehall markera={markera} nr={nr} tryck={tryck} bilder={l.bilder} />}
      {l.vy === 'rapport' && <RapportInnehall markera={markera} nr={nr} tryck={tryck} skrivet={l.skrivet} skickad={l.skickad} />}
      {l.vy === 'pris' && <PrisInnehall l={PRIS} markera={markera} nr={nr} tryck={tryck} />}
    </ArendeRam>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { l: Lage; markera: string }[] = [
  { l: { vy: 'idag', bilder: 0, skrivet: false, skickad: false }, markera: 'oppna' },
  { l: { vy: 'framme', bilder: 0, skrivet: false, skickad: false }, markera: 'nasta' },
  { l: { vy: 'arbete', bilder: 0, skrivet: false, skickad: false }, markera: 'nasta' },
  { l: { vy: 'foton', bilder: 2, skrivet: false, skickad: false }, markera: 'nasta' },
  { l: { vy: 'rapport', bilder: 2, skrivet: true, skickad: false }, markera: 'skicka-kund' },
  { l: { vy: 'rapport', bilder: 2, skrivet: true, skickad: true }, markera: 'nasta' },
  { l: { vy: 'pris', bilder: 2, skrivet: true, skickad: true }, markera: 'nasta' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.l} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera || (v.markera === 'oppna' && id === 'rad')) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const START: Lage = { vy: 'idag', bilder: 0, skrivet: false, skickad: false }
const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du har parkerat utanför hos Familjen Exempel. Öppna ärendet.' }

const TIPS: Record<string, string> = {
  navigera: 'Navigera öppnar vägbeskrivningen. Du är redan framme, öppna ärendet i stället.',
  ring: 'Ring ringer kontaktpersonen. Uppdraget var att öppna ärendet.',
  rad2: 'Det är nästa kund. Familjen Exempel är Nästa uppdrag.',
  rad3: 'Det är en senare kund. Familjen Exempel är Nästa uppdrag.',
  kartor: 'Öppna i kartor ger vägbeskrivningen. Du står redan på plats.',
  kontakt: 'Kontaktuppgifterna stämmer. Tryck på den gröna knappen när du är på plats.',
  adress: 'Adressen stämmer. Tryck på den gröna knappen när du är på plats.',
  stang: 'Krysset stänger ärendet. Du är mitt i besöket.',
  tillbaka: 'Tillbaka går till steget före. Du ska framåt.',
  beskrivning: 'Beskrivningen stämmer. Gå vidare med den gröna knappen.',
  tjanst: 'Tjänsten är redan vald. Gå vidare med den gröna knappen.',
  preparat: 'Inga preparat användes den här gången. Fotografera ventilen.',
  ladda: 'Ladda ned ger dig PDF:en. Kunden ska få rapporten med e-post.',
  'skicka-tekniker': 'Det skickar rapporten till ansvarig tekniker. Kunden ska ha den.',
  specialrapport: 'Plustecknet skapar en specialrapport. Här räcker saneringsrapporten.',
  prisguide: 'Prisguiden behövs inte nu. Uppdraget slutar när du har kommit till Pris och fakturering.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(START)
  const [klar, setKlar] = useState(false)
  const [lager, setLager] = useState<'verktyg' | 'flikvy' | null>(null)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (lager === 'verktyg') {
      setLager(null)
      if (id === 'stang-verktyg') tips('Tillbaka i steget', 'Ärendets verktyg har allt som inte är en del av stegen. Fortsätt med den gröna knappen.')
      else if (id === 'verktyg:alla-uppgifter') { setLager('flikvy'); tips('Alla uppgifter', 'Här är den vanliga flikvyn. Tryck på ikonen uppe till höger för att komma tillbaka till stegen.') }
      else miss('Det valet behövs inte nu. Arket är stängt, fortsätt med den gröna knappen.')
      return
    }
    if (lager === 'flikvy') {
      if (id === 'tillbaka-steg') { setLager(null); tips('Tillbaka i stegen', 'Du är tillbaka där du var. Fortsätt med den gröna knappen.') }
      else miss('Tryck på ikonen Tillbaka till stegen uppe till höger.')
      return
    }
    if (id === 'verktyg' && l.vy !== 'idag') { setLager('verktyg'); tips('Ärendets verktyg', 'Rapporter, avtal och offert, återbesök, kontakt och mer. Stäng arket med krysset när du har tittat.'); return }
    if (id === 'flikvy' && l.vy !== 'idag') { setLager('flikvy'); tips('Alla uppgifter', 'Den vanliga flikvyn med Ärende, Utförande och Ekonomi. Tryck på ikonen uppe till höger för att komma tillbaka till stegen.'); return }
    if (id.startsWith('steg:')) { miss('Du kan hoppa mellan stegen med ikonerna, men gör dem i ordning nu. Använd den gröna knappen längst ner.'); return }
    switch (l.vy) {
      case 'idag':
        if (id === 'oppna' || id === 'rad') { setL({ ...l, vy: 'framme' }); tips('Ärendet är öppet', 'Du är i steget Framme. Kontakten och adressen stämmer. Tala om att du är på plats.') }
        else miss(TIPS[id] ?? 'Familjen Exempel står under Nästa uppdrag. Tryck Öppna.')
        return
      case 'framme':
        if (id === 'nasta') { setL({ ...l, vy: 'arbete' }); tips('Du är framme', 'Arbetstiden räknas nu i bakgrunden. Du är i Arbetet. Läs uppdraget och gå vidare.') }
        else miss(TIPS[id] ?? 'Tryck på den gröna knappen Jag är framme längst ner.')
        return
      case 'arbete':
        if (id === 'nasta') { setL({ ...l, vy: 'foton' }); tips('Arbetet är gjort', 'Fotografera ventilen som kunden behöver täta.') }
        else miss(TIPS[id] ?? 'Gå vidare med den gröna knappen längst ner.')
        return
      case 'foton':
        if (id === 'bilder') { setL({ ...l, bilder: l.bilder + 1 }); tips('Bilden är med', 'Den sparas när du går vidare. Gå vidare till rapporten.') }
        else if (id === 'nasta') {
          if (l.bilder === 0) miss('Ventilen ska fotograferas först. Tryck Lägg till bilder under Bilder.')
          else { setL({ ...l, vy: 'rapport' }); tips('Rapporten', 'Skriv vad du gjorde i Saneringsrapport.') }
        } else miss(TIPS[id] ?? 'Tryck Lägg till bilder under Bilder.')
        return
      case 'rapport':
        if (id === 'rapporttext') { setL({ ...l, skrivet: true }); tips('Rapporten är skriven', 'Skicka den nu till kunden.') }
        else if (id === 'skicka-kund') {
          if (!l.skrivet) miss('Rapporten är tom. Skriv i Saneringsrapport först.')
          else { setL({ ...l, skickad: true }); tips('Skickad', 'Det står Rapport skickad till Familjen Exempel! Gå vidare till Pris och fakturering.') }
        } else if (id === 'nasta') {
          if (!l.skickad) miss('Kunden ska få rapporten. Den skickas inte av sig själv.')
          else {
            setL({ ...l, vy: 'pris' }); setKlar(true)
            setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Du har gått från Framme till Pris och fakturering. Bilden och rapporten sparades på vägen, och kunden har fått rapporten.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
          }
        } else miss(TIPS[id] ?? 'Skicka rapporten med Skicka till Familjen Exempel.')
        return
      default:
    }
  }

  const ordning: Record<Vy, number> = { idag: 0, framme: 1, arbete: 2, foton: 3, rapport: 5, pris: 8 }
  const framsteg = Math.min(8, ordning[l.vy] + (l.vy === 'foton' && l.bilder > 0 ? 1 : 0) + (l.vy === 'rapport' ? (l.skrivet ? 1 : 0) + (l.skickad ? 1 : 0) : 0))
  return (
    <OvningRam framsteg={framsteg} totalt={8} svar={svar} onBorjaOm={() => { setL(START); setKlar(false); setLager(null); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} nr={0} tryck={tryck} lager={lager} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
