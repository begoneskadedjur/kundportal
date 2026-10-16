// src/pages/shared/intranet/guider/guide-rapportera-tillbud-kontor.tsx
// Guidemodul: Rapportera ett tillbud, en avvikelse eller en olycka (admin och koordinator, dator).
// Etiketterna kommer från CoordinatorSidebar (gula knappen ReportIncidentButton, Planering ›
// Tillbud & Avvikelser) och IncidentsPage (Rapportera händelse, Oj! Aj! Hmm, Vad har hänt?,
// När inträffade händelsen?, Berörda anställda, Lägg till anställd..., Skicka rapport,
// Avvikelse rapporterad). På kontoret är ingen förvald som berörd. Påhittade namn, ingenting sparas.

import { useState } from 'react'
import { Dator, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { KontorSida, SidRubrik, TillbudFormular, TillbudRad, TillbudRubrik, type TillbudTyp } from './_allmant'

type Vy = 'oversikt' | 'sida' | 'form' | 'klart'

interface Lage {
  vy: Vy
  typ: TillbudTyp
  text: boolean
  val: string
  berorda: string[]
}

const BESKRIVNING = 'Brf Exempelgården ringde. Det bokade besöket i dag 10:00 blev aldrig av och ingen hörde av sig.'
const LABEL: Record<TillbudTyp, string> = { tillbud: 'Tillbud', olycka: 'Olycka', avvikelse: 'Avvikelse' }

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const sidan = l.vy !== 'oversikt'
  return (
    <div className="w-[600px] max-w-full">
      <Dator adress={sidan ? 'koordinator › tillbud-avvikelser' : 'koordinator › dashboard'}>
        <KontorSida sida={sidan ? 'Tillbud & Avvikelser' : 'Översikt'} aktivPost={sidan ? 'Tillbud & Avvikelser' : 'Översikt'} tryck={tryck} markera={markera} nr={nr}>
          {!sidan && <>
            <SidRubrik titel="Översikt" />
            <p className="text-[12px] text-slate-400">Koordinatorns startsida.</p>
          </>}
          {sidan && <>
            <TillbudRubrik tryck={tryck} markera={markera} nr={nr} />
            {l.vy === 'form' && (
              <div className="mb-2">
                <TillbudFormular dator typ={l.typ} beskrivning={l.text ? BESKRIVNING : ''} berorda={l.berorda} kontorVal={l.val}
                  tryck={tryck} markera={markera} nr={nr} />
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
              {l.vy === 'klart' && <TillbudRad typ={l.typ} status="Ny" text={BESKRIVNING} datum="2026-10-16 09:45" />}
              <TillbudRad typ="tillbud" status="Under utredning" text="Halkade i trappan vid lagret." datum="2026-10-02 07:30" onClick={() => tryck('rad')} />
            </div>
          </>}
        </KontorSida>
        {l.vy === 'klart' && <Notis text={`${LABEL[l.typ]} rapporterad`} />}
      </Dator>
    </div>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const START: Lage = { vy: 'oversikt', typ: 'tillbud', text: false, val: '', berorda: [] }
const FORM: Lage = { ...START, vy: 'form' }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: START, markera: 'gul' },
  { lage: { ...START, vy: 'sida' }, markera: 'ny' },
  { lage: FORM, markera: 'typ-avvikelse' },
  { lage: { ...FORM, typ: 'avvikelse' }, markera: 'beskrivning' },
  { lage: { ...FORM, typ: 'avvikelse', text: true, val: 'Erik Exempel' }, markera: 'lagg-till' },
  { lage: { ...FORM, typ: 'avvikelse', text: true, berorda: ['Erik Exempel'] }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Översikt. Hitta vägen till rapporteringen.' }

const TIPS: Record<string, string> = {
  cta: 'Öppna schema öppnar planeringen. Rapporten gör du med den gula knappen.',
  notis: 'Klockan öppnar dina tickets. Rapporten gör du med den gula knappen.',
  sok: 'Sök letar efter ärenden och kunder. Rapporten gör du med den gula knappen.',
  intranat: 'Intranätet har policyerna. Själva rapporten gör du med den gula knappen.',
  uppdateringar: 'Uppdateringar visar nyheter. Tryck på den gula knappen.',
  'mitt-konto': 'Mitt konto är dina uppgifter. Tryck på den gula knappen.',
  rad: 'Det är en äldre rapport. Gör en ny med Rapportera händelse.',
  exportera: 'Tryck Rapportera händelse.',
  nar: 'Tiden är satt till nu. Ändra den om samtalet kom tidigare.',
  avbryt: 'Avbryt stänger formuläret och allt du skrivit försvinner. Fortsätt i stället.',
  stang: 'Krysset stänger formuläret och allt du skrivit försvinner. Fortsätt i stället.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'oversikt') {
      if (id === 'gul' || id === 'post-Tillbud & Avvikelser') { setL({ ...l, vy: 'sida' }); tips('Tillbud & Avvikelser', 'Gör en ny rapport.') }
      else if (id.startsWith('post-') || id.startsWith('grupp-')) miss('Det är en annan sida. Tryck på den gula knappen överst i menyn.')
      else miss(TIPS[id] ?? 'Tryck på den gula knappen överst i menyn.')
      return
    }
    if (l.vy === 'sida') {
      if (id === 'ny') { setL({ ...l, vy: 'form' }); tips('Formuläret är öppet', 'Ingen skadades och inget var nära att gå illa. Kunden fick inte det vi lovat. Välj rätt typ.') }
      else miss(TIPS[id] ?? 'Tryck Rapportera händelse.')
      return
    }
    if (id.startsWith('typ-')) {
      const typ = id.slice(4) as TillbudTyp
      setL({ ...l, typ })
      if (typ === 'avvikelse') tips('Hmm Avvikelse', 'Rätt. Något avvek från det kunden blev lovad. Beskriv vad som hände.')
      else if (typ === 'olycka') miss('Aj! Olycka är när någon skadades. Här skadades ingen.')
      else miss('Oj! Tillbud är när det var nära att någon skadades. Här handlar det om ett uteblivet besök.')
    } else if (id === 'beskrivning') { setL({ ...l, text: true }); tips('Beskrivningen är skriven', 'Ange nu vem det gäller under Berörda anställda.') }
    else if (id === 'valj-anstalld') { setL({ ...l, val: 'Erik Exempel' }); tips('Erik Exempel är vald', 'Tryck på plus för att lägga till honom.') }
    else if (id === 'lagg-till') {
      if (!l.val) miss('Välj en anställd i listan Lägg till anställd... först.')
      else { setL({ ...l, val: '', berorda: ['Erik Exempel'] }); tips('Erik är berörd', l.text ? 'Allt som krävs är ifyllt. Skicka rapporten.' : 'Skriv också vad som hände.') }
    } else if (id === 'skicka') {
      if (!l.text) miss('Knappen fungerar först när Vad har hänt? är ifyllt.')
      else if (!l.berorda.length) miss('Knappen fungerar först när minst en berörd anställd är tillagd. Välj Erik och tryck på plus.')
      else if (l.typ !== 'avvikelse') miss('Kontrollera typen. Ingen skadades, kunden fick inte det vi lovat.')
      else {
        setL({ ...l, vy: 'klart' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Det står Avvikelse rapporterad. Rapporten ligger överst med status Ny, och de som tar emot avvikelser fick en notis och ett mejl. Erik ser rapporten eftersom han är berörd.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Välj typ, beskriv, lägg till Erik och skicka.')
  }

  const framsteg = l.vy === 'oversikt' ? 0 : l.vy === 'sida' ? 1 : l.vy === 'klart' ? 6 : 2 + (l.typ === 'avvikelse' ? 1 : 0) + (l.text ? 1 : 0) + (l.berorda.length ? 1 : 0)
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
