// src/pages/shared/intranet/guider/guide-skapa-avtalsforslag-kontor.tsx
// Guidemodul: Skapa och skicka ett avtalsförslag (admin, koordinator och säljare, dator).
//
// Efterbildning av sidomenyn (coordinatorNavConfig och saljareNavConfig: "Skapa Avtal & Offerter"
// överst, /koordinator/oneflow-contract-creator och /saljare/oneflow-contract-creator) och
// OneflowContractCreator i avtalsläget. Skärmarna för stegen ligger i _avtalsforslag.tsx och
// delas med teknikerns guide. Visningen kopplar en befintlig kund med enheter (Kundgrupp hoppas
// över), övningen lägger upp en ny kund och väljer kundgrupp. Påhittade kunder, inget skickas.

import { useState } from 'react'
import { Dator, Markor, Notis, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { ingenMk, mkFor, type Mk, type Tryck } from './_nyvy_salja'
import {
  AVTAL_BAS, AVTAL_KOPPLAD, AVTAL_ORDNING, AvtalWizard, NY, PREMIE, avtalOvningTryck, type AvtalLage,
} from './_avtalsforslag'

const SKAPA = 'Skapa Avtal & Offerter'
const MENY = ['Översikt', SKAPA, 'Ärenden', 'Befintliga kunder', 'Dokumentsignering', 'Leads (B2B)']

function Skarm({ l, mk, tryck }: { l: AvtalLage; mk: Mk; tryck: Tryck }) {
  const start = l.vy === 'start'
  return (
    <Dator adress={start ? 'koordinator › dashboard' : 'koordinator › oneflow-contract-creator'}>
      <div className="flex min-h-[460px]">
        <nav className="hidden w-40 flex-none border-r border-slate-700 bg-slate-950/40 p-2 sm:block" aria-label="Sidomeny i exemplet">
          <p className="mb-2 px-2 text-[11px] font-bold text-[#20c58f]">BeGone</p>
          {MENY.map(m => (
            <Markor key={m} markor={mk(`nav:${m}`)} block>
              <button type="button" onClick={() => tryck(`nav:${m}`)}
                className={`block w-full truncate rounded-md px-2 py-1 text-left text-[11.5px] ${(start ? m === 'Översikt' : m === SKAPA) ? 'bg-[#20c58f]/15 font-semibold text-[#20c58f]' : 'text-slate-400'}`}>{m}</button>
            </Markor>
          ))}
        </nav>
        <div className="relative min-w-0 flex-1 p-2.5">
          {start ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-white">Översikt</p>
              <div className="grid grid-cols-2 gap-2">
                {['Ärenden idag', 'Att boka in', 'Väntar på signering', 'Nya tips'].map((t, i) => (
                  <div key={t} className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                    <p className="text-[10px] text-slate-400">{t}</p>
                    <p className="text-[15px] font-semibold text-white">{[12, 3, 5, 2][i]}</p>
                  </div>
                ))}
              </div>
              {/* På smal skärm syns inte sidomenyn: länken står då här */}
              <Markor markor={mk(`nav:${SKAPA}`)}>
                <button type="button" onClick={() => tryck(`nav:${SKAPA}`)} className="rounded-lg border border-slate-600 px-2 py-1 text-[11px] text-white sm:hidden">{SKAPA}</button>
              </Markor>
            </div>
          ) : (
            <AvtalWizard l={l} tryck={tryck} mk={mk} />
          )}
          {l.vy === 'klart' && <Notis text="Avtalet är skickat" />}
        </div>
      </div>
    </Dator>
  )
}

// --- Visning: befintlig kund med enheter ---

const MOTPART: AvtalLage = { ...AVTAL_BAS, mall: AVTAL_KOPPLAD.mall, vy: 'motpart' }

const VISNING: { lage: AvtalLage; markera: string }[] = [
  { lage: AVTAL_BAS, markera: `nav:${SKAPA}` },
  { lage: { ...AVTAL_BAS, vy: 'dokument' }, markera: 'nasta' },
  { lage: { ...MOTPART, sok: 'traff' }, markera: 'koppla' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'motpart', omf: null }, markera: 'omf:alla' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'innehall' }, markera: 'nasta' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'granska' }, markera: 'skapa-pdf' },
  { lage: { ...AVTAL_KOPPLAD, vy: 'pdf' }, markera: 'skicka' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} mk={mkFor(v.markera, steg + 1)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning: ny kund ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: `${NY.namn} vill ha löpande kontroll mot gnagare, ${PREMIE} per år. Föreningen är inte kund än. Skapa avtalsförslaget och skicka det. Börja i sidomenyn.` }

function Ovning() {
  const [l, setL] = useState<AvtalLage>(AVTAL_BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (id.startsWith('nav:')) {
      if (l.vy === 'start' && id === `nav:${SKAPA}`) {
        setL({ ...l, vy: 'dokument' })
        setSvar({ typ: 'tips', titel: 'Skapa avtal eller offert är öppen', text: 'Avtalsförslag är förvalt. Tryck Nästa.' })
      } else if (l.vy === 'start') miss(`Avtalsförslaget skapar du under ${SKAPA}, överst i sidomenyn.`)
      else miss('Sidomenyn lämnar Skapa avtal eller offert. Gör klart avtalet först.')
      return
    }
    if (l.vy === 'start') { miss(`Börja i sidomenyn: ${SKAPA}.`); return }
    const r = avtalOvningTryck(l, id, fel)
    if (!r) return
    if (r.miss) { miss(r.svar.text); return }
    if (r.lage) setL(r.lage)
    setSvar(r.svar)
  }

  // Kontoret hoppar över Skapa-rutan: start räknas som steg 0, sedan stegen
  const ordning: AvtalLage['vy'][] = AVTAL_ORDNING.filter(v => v !== 'ark')
  const framsteg = Math.max(0, ordning.indexOf(l.vy))
  return (
    <OvningRam bred framsteg={framsteg} totalt={ordning.length - 1} svar={svar} onBorjaOm={() => { setL(AVTAL_BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
