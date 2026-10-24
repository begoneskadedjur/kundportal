// src/pages/shared/intranet/guider/guide-rapportera-tillbud.tsx
// Guidemodul: Rapportera ett tillbud, en avvikelse eller en olycka (tekniker, nya
// arbetsvyn, telefon och dator). Omskriven 2026-10-24, slugen behålls för läsloggen.
// Källor: NyTeknikerLayout (den gula knappen "Rapportera tillbud, avvikelse eller olycka"
// i sidhuvudet, går till /technician/tillbud-avvikelser), IncidentsPage (rubriken
// Tillbud & Avvikelser, Rapportera händelse, typerna Oj! Tillbud, Aj! Olycka, Hmm
// Avvikelse med texterna ur INCIDENT_TYPE_CONFIG, påminnelsen om Arbetsmiljöverket vid
// Olycka, Vad har hänt?, Vad har ni redan gjort?, När inträffade händelsen?, Rapportör,
// Berörda anställda, Koppla till ärende, Avbryt, Skicka rapport, "Tillbud rapporterad",
// status Ny). Påhittade kunder och kollegor.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { INCIDENT_TYPE_CONFIG, ALL_INCIDENT_TYPES, type IncidentType } from '../../../../types/caseIncidents'
import { Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { IdagSida, Punkt, Rulla, UNDER_IDAG, gorMk, ingenMk, type Mk, type Tryck } from './_nyvy_min_dag'

const NAMN = 'Anna Exempel'
const TEXT = 'Stegen gled på det blöta golvet i lagret hos Exempel AB. Jag tog emot mig, ingen skadades.'

interface Vy {
  sida: 'start' | 'lista' | 'form' | 'skickad'
  typ: IncidentType
  text?: boolean
  koppla?: boolean
}

const KORT_FARG: Record<IncidentType, string> = {
  tillbud: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  olycka: 'border-red-500/40 bg-red-500/10 text-red-400',
  avvikelse: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
}

function Lista({ ny, mk, tryck }: { ny: boolean; mk: Mk; tryck?: Tryck }) {
  const rader = [
    ...(ny ? [{ typ: 'tillbud' as IncidentType, text: 'Stegen gled på det blöta golvet i lagret hos Exempel AB.', datum: '2026-10-26', status: 'Ny', ton: 'gul' as const }] : []),
    { typ: 'avvikelse' as IncidentType, text: 'Betesstationer saknades vid lastkajen hos Brf Exempelgården.', datum: '2026-10-12', status: 'Åtgärdad', ton: 'gron' as const },
  ]
  return (
    <div className="grid gap-2">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-[#fff]"><Icon name="rapport.avvikelse" size={20} className="h-4 w-4" /></span>
        <p className="text-[14px] font-bold text-white">Tillbud & Avvikelser</p>
      </div>
      <div className="flex gap-1.5">
        <Markor markor={mk('rapportera')}>
          <button type="button" onClick={() => tryck?.('rapportera')} className="flex h-8 items-center gap-1 rounded-lg bg-[#20c58f] px-2.5 text-[11.5px] font-medium text-[#fff]">
            <Icon name="allman.plus" size={16} className="h-3.5 w-3.5" />Rapportera händelse
          </button>
        </Markor>
        <span className="flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-[11.5px] text-white"><Icon name="allman.aterstall" size={16} className="h-3.5 w-3.5" />Uppdatera</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        {rader.map((r, i) => (
          <div key={i} className="grid gap-0.5 border-b border-slate-700/60 px-2 py-1.5 last:border-b-0">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${KORT_FARG[r.typ].split(' ').pop()}`}>{INCIDENT_TYPE_CONFIG[r.typ].label}</span>
              <Punkt ton={r.ton}>{r.status}</Punkt>
            </div>
            <span className="truncate text-[11px] text-slate-300">{r.text}</span>
            <span className="text-[9.5px] text-slate-500">{r.datum} · {NAMN}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Formular({ vy, mk, tryck }: { vy: Vy; mk: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const kanSkicka = !!vy.text
  const falt = 'w-full rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-left text-[11px]'
  const etikett = 'mb-0.5 block text-[10px] font-medium text-slate-400'
  return (
    <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/50 p-2.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[11.5px] font-semibold text-white"><Icon name="rapport.avvikelse" size={16} className="h-3.5 w-3.5 text-amber-400" />Rapportera händelse</p>
        <Icon name="allman.stang" size={16} className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div className={`grid gap-1.5 ${enhet === 'dator' ? 'grid-cols-3' : ''}`}>
        {ALL_INCIDENT_TYPES.map(t => {
          const c = INCIDENT_TYPE_CONFIG[t]
          const vald = vy.typ === t
          return (
            <Markor key={t} markor={mk(`typ:${t}`)} block>
              <button type="button" onClick={() => tryck?.(`typ:${t}`)}
                className={`w-full rounded-lg border p-1.5 text-left ${vald ? KORT_FARG[t] : 'border-slate-700 bg-slate-800 text-slate-300'}`}>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[13px] font-extrabold leading-none">{c.exclamation}</span>
                  <span className="text-[11px] font-semibold">{c.label}</span>
                </span>
                <span className="block text-[9.5px] leading-snug text-slate-500">{c.description}</span>
              </button>
            </Markor>
          )
        })}
      </div>
      {vy.typ === 'olycka' && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-1.5 text-[9.5px] text-red-300">Vid allvarlig olycka eller allvarligt tillbud ska arbetsgivaren utan dröjsmål anmäla till Arbetsmiljöverket. anmalarbetsskada.se</p>
      )}
      <div>
        <span className={etikett}>Vad har hänt? <span className="text-red-400">*</span></span>
        <Markor markor={mk('vad')} block>
          <button type="button" onClick={() => tryck?.('vad')} className={`${falt} min-h-[44px] ${vy.text ? 'text-white' : 'text-slate-500'}`}>
            {vy.text ? TEXT : 'Beskriv händelsen: vad hände, var och hur?'}
          </button>
        </Markor>
      </div>
      <div>
        <span className={etikett}>Vad har ni redan gjort? <span className="text-slate-600">(valfritt)</span></span>
        <span className={`${falt} block text-slate-500`}>T.ex. sanerat platsen, uppsökt vårdcentral, kontaktat kund...</span>
      </div>
      <div className={`grid gap-1.5 ${enhet === 'dator' ? 'grid-cols-2' : ''}`}>
        <div><span className={etikett}>När inträffade händelsen?</span><span className={`${falt} block text-white`}>2026-10-26 07:30</span></div>
        <div><span className={etikett}>Rapportör</span><span className={`${falt} block text-slate-400`}>{NAMN}</span></div>
      </div>
      <div>
        <span className={etikett}>Berörda anställda <span className="text-red-400">*</span></span>
        <span className="inline-flex rounded-md border border-slate-600 bg-slate-700/50 px-1.5 py-0.5 text-[10.5px] text-white">{NAMN}</span>
        <span className={`${falt} mt-1 block text-slate-500`}>Lägg till anställd...</span>
      </div>
      <div>
        <span className={etikett}>Koppla till ärende <span className="text-slate-600">(valfritt)</span></span>
        <Markor markor={mk('koppla')} block>
          <button type="button" onClick={() => tryck?.('koppla')} className={`${falt} flex items-center gap-1 ${vy.koppla ? 'text-white' : 'text-slate-500'}`}>
            <Icon name="allman.sok" size={16} className="h-3 w-3 text-slate-500" />{vy.koppla ? 'BE-0001340 Exempel AB' : 'Sök bland dina ärenden...'}
          </button>
        </Markor>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-700/50 pt-1.5">
        <span className="px-2 text-[11px] text-slate-400">Avbryt</span>
        <Markor markor={mk('skicka')}>
          <button type="button" onClick={() => tryck?.('skicka')} aria-disabled={!kanSkicka}
            className={`rounded-lg bg-[#20c58f] px-3 py-1.5 text-[11.5px] font-medium text-[#fff] ${kanSkicka ? '' : 'opacity-50'}`}>Skicka rapport</button>
        </Markor>
      </div>
    </div>
  )
}

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const mk = markor ? gorMk(markor) : ingenMk
  if (vy.sida === 'start') {
    return <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor}><IdagSida /></NySkarm>
  }
  return (
    <NySkarm sida="tillbud" titel="Tillbud och avvikelser" onRam={tryck} markor={markor}
      over={vy.sida === 'skickad' ? <Notis text="Tillbud rapporterad" /> : undefined}>
      <Rulla>{vy.sida === 'form' ? <Formular vy={vy} mk={mk} tryck={tryck} /> : <Lista ny={vy.sida === 'skickad'} mk={mk} tryck={tryck} />}</Rulla>
    </NySkarm>
  )
}

const STEG: { vy: Vy; mal: string }[] = [
  { vy: { sida: 'start', typ: 'tillbud' }, mal: 'tillbud' },
  { vy: { sida: 'lista', typ: 'tillbud' }, mal: 'rapportera' },
  { vy: { sida: 'form', typ: 'tillbud' }, mal: 'typ:tillbud' },
  { vy: { sida: 'form', typ: 'tillbud' }, mal: 'vad' },
  { vy: { sida: 'form', typ: 'tillbud', text: true }, mal: 'koppla' },
  { vy: { sida: 'form', typ: 'tillbud', text: true, koppla: true }, mal: 'skicka' },
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
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Stegen gled på det blöta golvet hos Exempel AB. Du tog emot dig och ingen skadades. Rapportera det.' }
  const [svar, setSvar] = useState<OvningSvar>(start)

  const tryck = (mal: string) => {
    if (vy.sida === 'start') {
      if (mal === 'tillbud') {
        setVy({ ...vy, sida: 'lista' }); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Rätt knapp', text: 'Sidan Tillbud och avvikelser är öppen. Starta en ny rapport.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: 'Leta efter den gula varningsknappen uppe till höger. Den finns på varje sida.' })
      return
    }
    if (vy.sida === 'lista') {
      if (mal === 'rapportera') {
        setVy({ ...vy, sida: 'form' }); setFramsteg(2)
        setSvar({ typ: 'tips', titel: 'Formuläret är öppet', text: 'Välj typ och beskriv vad som hände.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte den', text: 'Tryck på den gröna knappen Rapportera händelse.' })
      return
    }
    if (vy.sida === 'form') {
      if (mal.startsWith('typ:')) {
        const t = mal.slice(4) as IncidentType
        setVy({ ...vy, typ: t })
        setSvar(t === 'tillbud'
          ? { typ: 'tips', titel: 'Tillbud', text: 'Det kunde ha gått illa men ingen skadades. Beskriv nu vad som hände.' }
          : { typ: 'fel', titel: t === 'olycka' ? 'Ingen skadades' : 'Mer än en avvikelse', text: t === 'olycka' ? 'En olycka är när någon skadas. Här skadades ingen, så det är ett tillbud.' : 'Det kunde ha gått illa. Det är ett tillbud, inte en avvikelse från rutinen.' })
        return
      }
      if (mal === 'vad') {
        setVy({ ...vy, text: true }); setFramsteg(3)
        setSvar({ typ: 'tips', titel: 'Beskrivningen är skriven', text: 'Ditt namn står redan under Berörda anställda. Skicka rapporten.' })
        return
      }
      if (mal === 'koppla') {
        setVy({ ...vy, koppla: true })
        setSvar({ typ: 'tips', titel: 'Kopplad', text: 'Kopplingen är valfri. Skicka nu rapporten.' })
        return
      }
      if (mal === 'skicka') {
        if (!vy.text) { setSvar({ typ: 'fel', titel: 'Knappen är grå', text: 'Skicka rapport går inte förrän Vad har hänt? är ifyllt.' }); return }
        if (vy.typ !== 'tillbud') { setSvar({ typ: 'fel', titel: 'Kolla typen', text: 'Ingen skadades och det kunde ha gått illa. Välj Oj! Tillbud innan du skickar.' }); return }
        setVy({ ...vy, sida: 'skickad' }); setFramsteg(4)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Det står Tillbud rapporterad. Rapporten ligger överst i listan med status Ny, och de som tar emot tillbud får en notis och ett mejl.' })
      }
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
