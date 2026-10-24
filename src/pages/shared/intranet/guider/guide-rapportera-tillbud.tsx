// src/pages/shared/intranet/guider/guide-rapportera-tillbud.tsx
// Guidemodul: Rapportera ett tillbud, en avvikelse eller en olycka (tekniker, nya
// arbetsvyn, telefon och dator). Omskriven 2026-10-24 efter den nya sidan, slugen
// behålls för läsloggen. Källor: NyTeknikerLayout (gula knappen i sidhuvudet, går till
// /technician/tillbud-avvikelser), IncidentsPage och components/tillbud (flikarna
// Rapportera och Mina rapporter, formuläret i fyra steg, Dina besök i går och i dag,
// Skicka rapport, "Tillbudet är rapporterat", Se mina rapporter, grupperna Pågår och
// Avslutade, rapporten med Hanteringen). Påhittade kunder och kollegor.

import { useState } from 'react'
import type { IncidentType } from '../../../../types/caseIncidents'
import { Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { IdagSida, Rulla, UNDER_IDAG, gorMk, ingenMk, type Mk, type Tryck } from './_nyvy_min_dag'
import { TillbudFlikar, TillbudForm, TillbudLista, TillbudRapport, TillbudTack, type ExGrupp, type ExRapport } from './_tillbud'

const NAMN = 'Anna Exempel'
const TEXT = 'Stegen gled på det blöta golvet i lagret hos Exempel AB. Jag tog emot mig, ingen skadades.'
const FORSLAG = [
  { kund: 'Exempel AB', rad: '2026-10-26 07:00, råttor, Exempelgatan 4' },
  { kund: 'Familjen Exempel', rad: '2026-10-25 13:00, getingar' },
]

const NY: ExRapport = { id: 'ny', typ: 'tillbud', status: 'ny', text: 'Stegen gled på det blöta golvet i lagret hos Exempel AB.', datum: '2026-10-26 07:30', berorda: NAMN }
const GAMMAL: ExRapport = { id: 'gammal', typ: 'avvikelse', status: 'atgardad', text: 'Betesstationer saknades vid lastkajen hos Brf Exempelgården.', datum: '2026-10-12 09:15', berorda: NAMN, atgard: 'Nya stationer monterade, kontrollrundan uppdaterad.', ansvarig: 'Erik Exempel' }

function grupper(medNy: boolean): ExGrupp[] {
  return [
    { rubrik: 'Pågår', beskr: 'Rapporter som väntar på utredning, utreds eller följs upp.', ikon: 'tillbud.utredning', ikonFarg: 'text-amber-500', rader: medNy ? [NY, GAMMAL] : [GAMMAL] },
    { rubrik: 'Avslutade', beskr: 'Utredda och uppföljda rapporter.', ikon: 'falt.klart', rader: [], hopfalld: true },
  ]
}

interface Vy {
  sida: 'start' | 'form' | 'tack' | 'mina' | 'rapport'
  typ: IncidentType
  text?: boolean
  koppla?: boolean
}

function Sida({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const dator = enhet === 'dator'
  const skickad = vy.sida !== 'form'
  const lage = vy.sida === 'form' || vy.sida === 'tack' ? 'rapportera' : 'mina'
  return (
    <div>
      {!(vy.sida === 'rapport' && !dator) && (
        <TillbudFlikar aktiv={lage} mina={skickad ? 2 : 1} mk={mk} tryck={tryck} />
      )}
      {vy.sida === 'form' && (
        <TillbudForm v={{ typ: vy.typ, text: vy.text ? TEXT : undefined, koppla: vy.koppla ? 'Exempel AB BE-0001340' : undefined, berorda: [NAMN], tekniker: true }}
          dator={dator} mk={mk} tryck={tryck} forslag={FORSLAG} />
      )}
      {vy.sida === 'tack' && <TillbudTack typ={vy.typ} mk={mk} tryck={tryck} />}
      {vy.sida === 'mina' && (
        <div className={dator ? 'grid grid-cols-2 gap-2' : ''}>
          <TillbudLista grupper={grupper(true)} mk={mk} tryck={tryck} />
          {dator && <p className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-[10.5px] text-slate-400">Välj en rapport i listan för att se den och hur långt den kommit.</p>}
        </div>
      )}
      {vy.sida === 'rapport' && (
        dator ? (
          <div className="grid grid-cols-2 gap-2">
            <TillbudLista grupper={grupper(true)} vald="ny" mk={mk} tryck={tryck} />
            <TillbudRapport r={NY} mk={mk} tryck={tryck} />
          </div>
        ) : <TillbudRapport r={NY} tillbaka mk={mk} tryck={tryck} />
      )}
    </div>
  )
}

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const mk = markor ? gorMk(markor) : ingenMk
  if (vy.sida === 'start') {
    return <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor}><IdagSida /></NySkarm>
  }
  const under = vy.sida === 'form' ? '1 rapport pågår' : '2 rapporter pågår'
  return (
    <NySkarm sida="tillbud" titel="Tillbud och avvikelser" under={under} onRam={tryck} markor={markor}
      over={vy.sida === 'tack' ? <Notis text="Tillbudet är rapporterat" /> : undefined}>
      <Rulla><Sida vy={vy} mk={mk} tryck={tryck} /></Rulla>
    </NySkarm>
  )
}

const FORM: Vy = { sida: 'form', typ: 'tillbud' }

const STEG: { vy: Vy; mal: string }[] = [
  { vy: { sida: 'start', typ: 'tillbud' }, mal: 'tillbud' },
  { vy: FORM, mal: 'typ:tillbud' },
  { vy: FORM, mal: 'vad' },
  { vy: { ...FORM, text: true }, mal: 'bilder' },
  { vy: { ...FORM, text: true }, mal: 'forslag' },
  { vy: { ...FORM, text: true, koppla: true }, mal: 'skicka' },
  { vy: { sida: 'tack', typ: 'tillbud' }, mal: 'se-mina' },
  { vy: { sida: 'mina', typ: 'tillbud' }, mal: 'rad:ny' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const s = STEG[Math.min(steg, STEG.length - 1)]
  return <Skarm vy={s.vy} markor={{ pa: true, nr: steg + 1, mal: s.mal }} tryck={m => { if (m === s.mal) onNasta() }} />
}

// Övningen: stegen gled, ingen skadades
function Ovning() {
  const enhet = useGuideEnhet()
  const startVy: Vy = { sida: 'start', typ: 'tillbud' }
  const [vy, setVy] = useState<Vy>(startVy)
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Stegen gled på det blöta golvet hos Exempel AB. Du tog emot dig och ingen skadades. Rapportera det och kontrollera sedan att rapporten kom fram.' }
  const [svar, setSvar] = useState<OvningSvar>(start)
  const fel = (titel: string, text: string) => setSvar({ typ: 'fel', titel, text })
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (mal: string) => {
    if (vy.sida === 'start') {
      if (mal === 'tillbud') { setVy(FORM); setFramsteg(1); tips('Formuläret är öppet', 'Sidan öppnas på Rapportera. Välj typ och beskriv vad som hände.') }
      else fel('Inte där', 'Leta efter den gula varningsknappen uppe till höger. Den finns på varje sida.')
      return
    }
    if (vy.sida === 'form') {
      if (mal.startsWith('typ:')) {
        const t = mal.slice(4) as IncidentType
        setVy({ ...vy, typ: t })
        if (t === 'tillbud') tips('Oj! Tillbud', 'Det kunde ha gått illa men ingen skadades. Beskriv nu vad som hände.')
        else if (t === 'olycka') fel('Ingen skadades', 'Aj! Olycka är när någon skadas. Här skadades ingen, så det är ett tillbud.')
        else fel('Mer än en avvikelse', 'Det kunde ha gått illa. Det är ett tillbud, inte en avvikelse från rutinen.')
        return
      }
      if (mal === 'vad') { setVy({ ...vy, text: true }); setFramsteg(2); tips('Beskrivningen är skriven', 'Du står redan som berörd och tiden är satt till nu. Koppla gärna besöket hos Exempel AB, och skicka.') ; return }
      if (mal === 'forslag' || mal === 'sok-arende') { setVy({ ...vy, koppla: true }); tips('Kopplad', 'Besöket hos Exempel AB är kopplat. Kopplingen är valfri. Skicka nu rapporten.'); return }
      if (mal.startsWith('forslag:')) { fel('Fel besök', 'Det hände hos Exempel AB. Välj det besöket, eller skicka utan koppling.'); return }
      if (mal === 'bilder') { tips('Bilder', 'Här fotar eller väljer du bilder, högst sex. I övningen behövs inga. Skicka när beskrivningen är skriven.'); return }
      if (mal === 'berord') { tips('Berörda anställda', 'Du står redan med. Lägg bara till fler om fler var med. Här var du ensam.'); return }
      if (mal === 'tom') { setVy(FORM); setFramsteg(1); fel('Formuläret tömdes', 'Töm formuläret tar bort allt du skrivit. Skriv i Vad har hänt? igen.'); return }
      if (mal === 'skicka') {
        if (!vy.text) { fel('Knappen är grå', 'Skicka rapport går inte förrän Vad har hänt? är ifyllt. Under knappen står vad som saknas.'); return }
        if (vy.typ !== 'tillbud') { fel('Kolla typen', 'Ingen skadades och det kunde ha gått illa. Välj Oj! Tillbud innan du skickar.'); return }
        setVy({ sida: 'tack', typ: 'tillbud' }); setFramsteg(3)
        tips('Skickat', 'Det står Tillbudet är rapporterat. Kontrollera nu att rapporten finns bland dina rapporter.')
        return
      }
      tips('Fortsätt i formuläret', 'Välj typ, skriv vad som hände och tryck Skicka rapport.')
      return
    }
    if (vy.sida === 'tack') {
      if (mal === 'se-mina' || mal === 'flik:mina') {
        setVy({ sida: 'mina', typ: 'tillbud' }); setFramsteg(4)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Rapporten ligger under Pågår med status Ny. De som tar emot tillbud har fått en notis och ett mejl. Statusen ändras när de utreder den.' })
      } else if (mal === 'en-till') fel('Inte nu', 'Rapportera en till öppnar ett tomt formulär. Tryck Se mina rapporter för att se rapporten du skickade.')
      else fel('Inte där', 'Tryck Se mina rapporter.')
    }
  }
  const borjaOm = () => { setVy(startVy); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
