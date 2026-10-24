// src/pages/shared/intranet/guider/guide-rapportera-tillbud-kontor.tsx
// Guidemodul: Rapportera ett tillbud, en avvikelse eller en olycka (admin, koordinator
// och säljare, dator). Omskriven 2026-10-24 efter den nya sidan. Etiketterna kommer från
// CoordinatorSidebar (gula knappen ReportIncidentButton, Planering › Tillbud och avvikelser)
// och IncidentsPage med components/tillbud (flikarna Rapportera, Mina rapporter och
// Registret, formuläret i fyra steg, Välj den det gäller, Skicka rapport, "Avvikelsen är
// rapporterad", grupperna Nya och Under utredning, rapporten med Status och Spara).
// På kontoret är ingen förvald som berörd. Påhittade namn, ingenting sparas.

import { useState } from 'react'
import type { IncidentType } from '../../../../types/caseIncidents'
import { Dator, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { KontorSida, SidRubrik, mk as mkAllman } from './_allmant'
import type { Mk } from './_nyvy_min_dag'
import { TillbudFlikar, TillbudForm, TillbudHuvud, TillbudLista, TillbudRapport, TillbudTack, type ExGrupp, type ExRapport, type Lage } from './_tillbud'

type Vy = 'oversikt' | 'form' | 'tack' | 'register' | 'rapport'

interface Tillstand {
  vy: Vy
  typ: IncidentType
  text: boolean
  berorda: string[]
}

const BESKRIVNING = 'Brf Exempelgården ringde. Det bokade besöket i dag 10:00 blev aldrig av och ingen hörde av sig.'
const MENYPOST = 'Tillbud och avvikelser'

const NY: ExRapport = { id: 'ny', typ: 'avvikelse', status: 'ny', text: BESKRIVNING, datum: '2026-10-26 09:45', berorda: 'Erik Exempel' }
const UTREDS: ExRapport = { id: 'utreds', typ: 'tillbud', status: 'under_utredning', text: 'Halkade i trappan vid lagret.', datum: '2026-10-02 07:30', berorda: 'Lisa Exempel' }

function registerGrupper(medNy: boolean): ExGrupp[] {
  return [
    { rubrik: 'Nya', beskr: 'Ingen har börjat utreda dem. Tryck på en rapport för att utreda och åtgärda.', ikon: 'falt.attgora', ikonFarg: 'text-amber-500', rader: medNy ? [NY] : [] },
    { rubrik: 'Under utredning', beskr: 'Orsaken utreds.', ikon: 'tillbud.utredning', ikonFarg: 'text-sky-400', rader: [UTREDS] },
    { rubrik: 'Avslutade', beskr: 'Klara rapporter, senaste först.', ikon: 'falt.klart', rader: [], hopfalld: true },
  ]
}

function Skarm({ l, tryck, markera, nr }: { l: Tillstand; tryck: (id: string) => void; markera?: string; nr: number }) {
  const mk: Mk = id => mkAllman(markera, id, nr)
  const sidan = l.vy !== 'oversikt'
  const skickad = l.vy === 'tack' || l.vy === 'register' || l.vy === 'rapport'
  const lage: Lage = l.vy === 'register' || l.vy === 'rapport' ? 'register' : 'rapportera'
  return (
    <div className="w-[640px] max-w-full">
      <Dator adress={sidan ? 'koordinator › tillbud-avvikelser' : 'koordinator › dashboard'}>
        <KontorSida sida={sidan ? MENYPOST : 'Översikt'} aktivPost={sidan ? MENYPOST : 'Översikt'} tryck={tryck} markera={markera} nr={nr}>
          {!sidan && <>
            <SidRubrik titel="Översikt" />
            <p className="text-[12px] text-slate-400">Koordinatorns startsida.</p>
          </>}
          {sidan && <>
            <TillbudHuvud rubrik attHantera={skickad ? 1 : 0} />
            <TillbudFlikar aktiv={lage} mina={skickad ? 1 : 0} register={skickad ? 2 : 1} mk={mk} tryck={tryck} />
            {l.vy === 'form' && (
              <TillbudForm dator v={{ typ: l.typ, text: l.text ? BESKRIVNING : undefined, berorda: l.berorda }} mk={mk} tryck={tryck} />
            )}
            {l.vy === 'tack' && <TillbudTack typ={l.typ} mk={mk} tryck={tryck} />}
            {(l.vy === 'register' || l.vy === 'rapport') && (
              <div className="grid grid-cols-2 gap-2">
                <TillbudLista grupper={registerGrupper(true)} vald={l.vy === 'rapport' ? 'ny' : undefined} mk={mk} tryck={tryck} />
                {l.vy === 'rapport'
                  ? <TillbudRapport r={NY} hantera mk={mk} tryck={tryck} />
                  : <p className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-[10.5px] text-slate-400">Välj en rapport i listan för att se och utreda den.</p>}
              </div>
            )}
          </>}
        </KontorSida>
        {l.vy === 'tack' && <Notis text={l.typ === 'avvikelse' ? 'Avvikelsen är rapporterad' : l.typ === 'olycka' ? 'Olyckan är rapporterad' : 'Tillbudet är rapporterat'} />}
      </Dator>
    </div>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const START: Tillstand = { vy: 'oversikt', typ: 'tillbud', text: false, berorda: [] }
const FORM: Tillstand = { ...START, vy: 'form' }
const KLAR: Tillstand = { ...FORM, typ: 'avvikelse', text: true, berorda: ['Erik Exempel'] }

const VISNING: { lage: Tillstand; markera: string }[] = [
  { lage: START, markera: 'gul' },
  { lage: FORM, markera: 'typ:avvikelse' },
  { lage: { ...FORM, typ: 'avvikelse' }, markera: 'vad' },
  { lage: { ...FORM, typ: 'avvikelse', text: true }, markera: 'berord' },
  { lage: KLAR, markera: 'skicka' },
  { lage: { ...KLAR, vy: 'tack' }, markera: 'flik:register' },
  { lage: { ...KLAR, vy: 'register' }, markera: 'rad:ny' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Översikt. Hitta vägen till rapporteringen.' }

const TIPS: Record<string, string> = {
  cta: 'Öppna schema öppnar planeringen. Rapporten gör du med den gula knappen.',
  notis: 'Klockan öppnar notiserna. Rapporten gör du med den gula knappen.',
  sok: 'Sök letar efter ärenden och kunder. Rapporten gör du med den gula knappen.',
  intranat: 'Intranätet har policyerna. Själva rapporten gör du med den gula knappen.',
  uppdateringar: 'Uppdateringar visar nyheter. Tryck på den gula knappen.',
  'mitt-konto': 'Mitt konto är dina uppgifter. Tryck på den gula knappen.',
  'flik:mina': 'Mina rapporter visar det du redan har skickat. Rapportera den nya händelsen i formuläret.',
  'flik:register': 'Registret visar alla rapporter av de typer du tar emot. Rapportera den nya händelsen i formuläret.',
  'sok-arende': 'Kopplingen till ett ärende är valfri. Välj typ, beskriv, lägg till Erik och skicka.',
  tom: 'Töm formuläret tar bort allt du skrivit. Fortsätt i stället.',
}

function Ovning() {
  const [l, setL] = useState<Tillstand>(START)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'tack') return
    if (l.vy === 'oversikt') {
      if (id === 'gul' || id === `post-${MENYPOST}`) { setL({ ...l, vy: 'form' }); tips('Tillbud och avvikelser', 'Sidan öppnas på Rapportera. Ingen skadades och inget var nära att gå illa. Kunden fick inte det vi lovat. Välj rätt typ.') }
      else if (id.startsWith('post-') || id.startsWith('grupp-')) miss('Det är en annan sida. Tryck på den gula knappen överst i menyn.')
      else miss(TIPS[id] ?? 'Tryck på den gula knappen överst i menyn.')
      return
    }
    if (id.startsWith('typ:')) {
      const typ = id.slice(4) as IncidentType
      setL({ ...l, typ })
      if (typ === 'avvikelse') tips('Hmm Avvikelse', 'Rätt. Något avvek från det kunden blev lovad. Beskriv vad som hände.')
      else if (typ === 'olycka') miss('Aj! Olycka är när någon skadades. Här skadades ingen.')
      else miss('Oj! Tillbud är när det var nära att någon skadades. Här handlar det om ett uteblivet besök.')
    } else if (id === 'vad') { setL({ ...l, text: true }); tips('Beskrivningen är skriven', 'Ange nu vem det gäller under Berörda anställda.') }
    else if (id === 'berord') {
      if (l.berorda.length) tips('Erik är redan med', 'Fler behövs inte. Skicka rapporten.')
      else { setL({ ...l, berorda: ['Erik Exempel'] }); tips('Erik är berörd', l.text ? 'Allt som krävs är ifyllt. Skicka rapporten.' : 'Skriv också vad som hände.') }
    } else if (id === 'skicka') {
      if (!l.text) miss('Knappen fungerar först när Vad har hänt? är ifyllt. Under knappen står vad som saknas.')
      else if (!l.berorda.length) miss('Knappen fungerar först när minst en berörd anställd är tillagd. Välj Erik i Välj den det gäller.')
      else if (l.typ !== 'avvikelse') miss('Kontrollera typen. Ingen skadades, kunden fick inte det vi lovat.')
      else {
        setL({ ...l, vy: 'tack' })
        setSvar({
          typ: 'ok',
          titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
          text: `Det står Avvikelsen är rapporterad. De som tar emot avvikelser fick en notis och ett mejl, och Erik ser rapporten under Mina rapporter eftersom han är berörd.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
        })
      }
    } else miss(TIPS[id] ?? 'Välj typ, beskriv, lägg till Erik och skicka.')
  }

  const framsteg = l.vy === 'oversikt' ? 0 : l.vy === 'tack' ? 5 : 1 + (l.typ === 'avvikelse' ? 1 : 0) + (l.text ? 1 : 0) + (l.berorda.length ? 1 : 0)
  return (
    <OvningRam bred framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(START); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
