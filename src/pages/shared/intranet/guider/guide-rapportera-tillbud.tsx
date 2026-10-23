// src/pages/shared/intranet/guider/guide-rapportera-tillbud.tsx
// Guidemodul: Rapportera ett tillbud, en avvikelse eller en olycka (tekniker, telefon).
// Etiketterna kommer från TechnicianMobileNav (Mer, gula knappen ReportIncidentButton),
// TechnicianDashboard (snabbknappen Rapportera tillbud/olycka) och IncidentsPage
// (Tillbud & Avvikelser, Rapportera händelse, Oj! Aj! Hmm, Vad har hänt?, När inträffade
// händelsen?, Berörda anställda, Skicka rapport, Tillbud rapporterad). Teknikern står redan
// med som berörd. Påhittade namn, ingenting sparas.

import { useState } from 'react'
import { Kort, Markor, Notis, OvningRam, Rad, Telefon, type OvningSvar } from '../skarmkit'
import { Icon } from '../../../../components/icons/Icon'
import type { GuideModul } from './registry'
import { TeknikerBotten, TeknikerHuvud, TeknikerMeny, TillbudFormular, TillbudRad, TillbudRubrik, SidRubrik, mk, type TillbudTyp } from './_allmant'

type Vy = 'hem' | 'meny' | 'sida' | 'form' | 'klart'

interface Lage {
  vy: Vy
  oppen?: string
  typ: TillbudTyp
  text: boolean
}

const BESKRIVNING = 'Stegen gled på det blöta golvet i källaren hos Exempel AB. Jag tog emot mig, ingen skadades.'
const LABEL: Record<TillbudTyp, string> = { tillbud: 'Tillbud', olycka: 'Olycka', avvikelse: 'Avvikelse' }

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  return (
    <Telefon>
      <TeknikerHuvud tryck={tryck} nr={nr} />

      {(l.vy === 'hem' || l.vy === 'meny') && (
        <div className="p-3">
          <SidRubrik titel="God morgon, Erik" under="fredag 16 oktober" />
          <Kort titel="Dagens schema" ikon="allman.kalender"><Rad v="08:00 Exempel AB" /></Kort>
          <div className="m-2.5 grid grid-cols-3 gap-1.5">
            {['Skapa avtal', 'AI Assistent'].map(t => (
              <button key={t} type="button" onClick={() => tryck('snabb-annan')} className="rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[10px] font-medium text-slate-300">{t}</button>
            ))}
            <Markor markor={mk(markera, 'snabb', nr)} block>
              <button type="button" onClick={() => tryck('snabb')} className="flex w-full flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/30 p-2 text-[10px] font-medium leading-tight text-slate-300">
                <Icon name="rapport.avvikelse" size={16} className="text-amber-400" />
                Rapportera tillbud/olycka
              </button>
            </Markor>
          </div>
        </div>
      )}

      {(l.vy === 'sida' || l.vy === 'klart') && (
        <div className="p-3">
          <TillbudRubrik tryck={tryck} markera={markera} nr={nr} />
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
            {l.vy === 'klart' && <TillbudRad typ={l.typ} status="Ny" text={BESKRIVNING} datum="2026-10-16 09:45" />}
            <TillbudRad typ="avvikelse" status="Avslutad" text="Spill av preparat i bilen." datum="2026-09-02 14:10" onClick={() => tryck('rad')} />
          </div>
        </div>
      )}

      {l.vy === 'form' && (
        <div className="p-2">
          <TillbudFormular typ={l.typ} beskrivning={l.text ? BESKRIVNING : ''} berorda={['Erik Exempel']} kontorVal=""
            tryck={tryck} markera={markera} nr={nr} />
        </div>
      )}

      <TeknikerBotten tryck={tryck} markera={markera} nr={nr} aktiv={l.vy === 'hem' ? 'hem' : undefined} />
      {l.vy === 'meny' && <TeknikerMeny tryck={tryck} markera={markera} nr={nr} oppen={l.oppen} />}
      {l.vy === 'klart' && <Notis text={`${LABEL[l.typ]} rapporterad`} />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const START: Lage = { vy: 'hem', typ: 'tillbud', text: false }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: START, markera: 'mer' },
  { lage: { ...START, vy: 'meny' }, markera: 'gul' },
  { lage: { ...START, vy: 'sida' }, markera: 'ny' },
  { lage: { ...START, vy: 'form' }, markera: 'typ-tillbud' },
  { lage: { ...START, vy: 'form' }, markera: 'beskrivning' },
  { lage: { ...START, vy: 'form', text: true }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Översikt. Hitta vägen till rapporteringen.' }

const TIPS: Record<string, string> = {
  hem: 'Du står redan på Översikt. Öppna menyn med Mer, eller använd snabbknappen.',
  arenden: 'Rapporten skrivs inte i ärendet. Öppna menyn med Mer.',
  schema: 'Schemat visar dina besök. Öppna menyn med Mer.',
  provision: 'Provision visar din provision. Öppna menyn med Mer.',
  notis: 'Klockan öppnar Frågor och uppdrag. Rapporten skriver du på sidan Tillbud & Avvikelser.',
  sok: 'Sök letar efter ärenden och kunder. Öppna menyn med Mer.',
  'snabb-annan': 'Den snabbknappen gör något annat. Leta efter Rapportera tillbud/olycka.',
  intranat: 'Intranätet har policyerna. Själva rapporten skickar du med den gula knappen.',
  uppdateringar: 'Uppdateringar visar nyheter. Tryck på den gula knappen.',
  'mitt-konto': 'Mitt konto är dina uppgifter. Tryck på den gula knappen.',
  utanfor: 'Trycker du bredvid stängs menyn. Tryck på den gula knappen.',
  rad: 'Det är en gammal rapport. Gör en ny med Rapportera händelse.',
  exportera: 'Tryck Rapportera händelse.',
  nar: 'Tiden är redan satt till nu. Ändra bara om det hände tidigare.',
  'valj-anstalld': 'Du står redan med som berörd. Lägg bara till fler om någon mer var med.',
  'lagg-till': 'Du står redan med som berörd. Lägg bara till fler om någon mer var med.',
  avbryt: 'Avbryt stänger formuläret och allt du skrivit försvinner. Fortsätt i stället.',
  stang: 'Krysset stänger formuläret och allt du skrivit försvinner. Fortsätt i stället.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const tillSida = () => { setL({ ...l, vy: 'sida' }); tips('Tillbud & Avvikelser', 'Här ser du dina egna rapporter. Gör en ny.') }

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'hem') {
      if (id === 'mer' || id === 'meny') { setL({ ...l, vy: 'meny' }); tips('Menyn är öppen', 'Leta efter den gula knappen.') }
      else if (id === 'snabb') tillSida()
      else miss(TIPS[id] ?? 'Tryck på Mer längst ner till höger.')
    } else if (l.vy === 'meny') {
      if (id === 'gul' || id === 'post-Tillbud & Avvikelser') tillSida()
      else if (id.startsWith('grupp-')) { const g = id.slice(6); setL({ ...l, oppen: l.oppen === g ? undefined : g }); tips(g, 'Den gula knappen längre ner går snabbare.') }
      else miss(TIPS[id] ?? 'Tryck på den gula knappen Rapportera tillbud, avvikelse eller olycka.')
    } else if (l.vy === 'sida') {
      if (id === 'ny') { setL({ ...l, vy: 'form' }); tips('Formuläret är öppet', 'Vad hände? Ingen skadades, men det kunde ha gått illa. Välj rätt typ.') }
      else miss(TIPS[id] ?? 'Tryck Rapportera händelse.')
    } else {
      if (id.startsWith('typ-')) {
        const typ = id.slice(4) as TillbudTyp
        setL({ ...l, typ })
        if (typ === 'tillbud') tips('Oj! Tillbud', 'Rätt. Det kunde ha gått illa, men ingen skadades. Beskriv nu vad som hände.')
        else if (typ === 'olycka') miss('Aj! Olycka är när någon skadades. Ingen skadades här.')
        else miss('Hmm Avvikelse är när en rutin eller ett krav inte följs. Här var det nära att gå illa.')
      } else if (id === 'beskrivning') { setL({ ...l, text: true }); tips('Beskrivningen är skriven', 'Vad hände, var och hur. Skicka rapporten.') }
      else if (id === 'skicka') {
        if (!l.text) miss('Knappen fungerar först när Vad har hänt? är ifyllt.')
        else if (l.typ !== 'tillbud') miss('Kontrollera typen. Ingen skadades, men det kunde ha gått illa.')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Det står Tillbud rapporterad. Rapporten ligger överst i listan med status Ny, och de som tar emot tillbud fick en notis och ett mejl.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Välj typ, beskriv och skicka.')
    }
  }

  const framsteg = l.vy === 'hem' ? 0 : l.vy === 'meny' ? 1 : l.vy === 'sida' ? 2 : l.vy === 'klart' ? 5 : l.text ? 4 : 3
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
