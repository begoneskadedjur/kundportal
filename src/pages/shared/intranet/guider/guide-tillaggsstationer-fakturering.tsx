// src/pages/shared/intranet/guider/guide-tillaggsstationer-fakturering.tsx
// Guidemodul: Besluta och fakturera tilläggsstationer (admin och koordinator, dator).
// Uppdaterad 2026-11-02 efter 3.110 till 3.114.3 (avtalsåret på avtalsdag).
// Etiketterna följer notisen ({N} att göra på avtalskartan · kund, addon_pending_refresh_notifications),
// ContractWorkList (N att göra på avtalskartan, N tillägg att besluta, Tillägg att besluta,
// instruktionen ur addonDecideInstruction, Tillägg utöver avtalet, Ingår i premien),
// ContractMapSection (Alla tillägg beslutade, Fakturaunderlaget uppdateras vid nästa period.,
// Tillbaka till Kräver åtgärd, toasten efter beslut), ContractSettingsDrawer (Innehåll och
// utrustning, Klart på det här avtalet, Tilläggen faktureras), AddonCoveragePanel (Tilläggsstationer,
// betald till och med, pro rata väntar, Registrera Fortnox-faktura, Efterskänk) och AddonDropPrompt
// (Besluta tillägg, Vad teknikern satte ut, kr per år, Arbetstid för att hantera tilläggen,
// Teknikerns förslag vid, Per år, Hur ska tillägget faktureras?, Besluta). Exemplet har
// Tilläggsregler Följer premien, årspremie och avtalsdag 30 juni. Påhittad kund, priser ur
// Automatisk prislista, belopp räknade med portalens egna funktioner (addonEconomics).

import { useState } from 'react'
import {
  Dator, DatorSida, Knapprad, Markor, Notis, OvningRam, PKnapp, Rad,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { Icon } from '../../../../components/icons/Icon'
import { formatDateShortSv, monthsLabel, timelineForProposal } from '../../../../shared/addonEconomics'
import { addonDecideInstruction } from '../../../../shared/contractWorkItems'
import { StationPunkt, TYPER } from './_stationer'

type Vy = 'notis' | 'karta' | 'beslut' | 'klart'
type Lage = { vy: Vy; timmar: number; lage: 'separate' | 'included' }

const MENY = ['Öppna schema', 'Ärenden', 'Rondering & Schema', 'Befintliga kunder']
const ENHET = 'Exempel AB Lager'
const AVTAL = 'Serviceavtal Exempel AB'
const PRIS = 3600
const TIMPRIS = 1016
const ANTAL = 2
const STATIONER = ANTAL * PRIS
const BESLUT_DAG = '2026-11-02'
const AVTALSDAG = '2027-06-30'

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`

/** Det som faktureras nu på etableringsärendet, samma räkning som Besluta tillägg */
function forstaPerioden(timmar: number) {
  const st = timelineForProposal({ fromDate: BESLUT_DAG, startDate: AVTALSDAG, perUnitAnnual: PRIS, quantityNow: ANTAL, unit: 'station', model: 'per_year' })
  const arb = timelineForProposal({ fromDate: BESLUT_DAG, startDate: AVTALSDAG, perUnitAnnual: TIMPRIS, quantityNow: timmar, quantityAnnual: timmar, unit: 'timme' })
  return { total: st.totalNow + arb.totalNow, months: st.months }
}

function Radio({ pa, titel, text, onClick }: { pa: boolean; titel: string; text: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={pa} onClick={onClick} className="flex items-start gap-2 text-left">
      <span className={`mt-[3px] h-3.5 w-3.5 flex-none rounded-full border-2 ${pa ? 'border-[#20c58f] bg-[#20c58f]' : 'border-slate-500'}`} aria-hidden />
      <span className="text-[11.5px]">
        <span className="block font-medium text-slate-100">{titel}</span>
        <span className="block text-slate-400">{text}</span>
      </span>
    </button>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const arbete = l.timmar * TIMPRIS
  const beslutat = l.vy === 'klart'
  const forsta = forstaPerioden(l.timmar)
  return (
    <Dator adress="koordinator › befintliga-kunder › Exempel AB">
      <div className="relative h-[500px]">
        <DatorSida meny={MENY} aktiv="Befintliga kunder" titel="Exempel AB · Avtalskarta">
          {!beslutat ? (
            <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
              <div className="flex flex-wrap items-baseline gap-x-3 px-3 pb-1.5 pt-2">
                <span className="text-[12.5px] font-semibold text-amber-200">1 att göra på avtalskartan</span>
                <span className="text-[11px] text-amber-200/80">{ANTAL} tillägg att besluta · {kr(STATIONER)}/år</span>
              </div>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-amber-500/15 px-3 py-2">
                <Icon name="kund.beslut" size={20} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                    <span>Tillägg att besluta</span>
                    <span className="truncate font-normal text-slate-400">· {ENHET}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-200">{addonDecideInstruction(ANTAL, ENHET, true)}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-400">{AVTAL}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Markor markor={mk(markera, 'utover', nr)}>
                    <button type="button" onClick={() => tryck('utover')} className="rounded-md bg-[#20c58f] px-3 py-1 text-[11.5px] font-semibold text-white">Tillägg utöver avtalet</button>
                  </Markor>
                  <button type="button" onClick={() => tryck('i-premien')} className="rounded-md border border-slate-600 px-3 py-1 text-[11.5px] text-slate-200">Ingår i premien</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#20c58f]/35 bg-[#20c58f]/5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white">Alla tillägg beslutade</p>
                <p className="text-[11px] text-slate-400">{kr(STATIONER)}/år på 1 avtal. Fakturaunderlaget uppdateras vid nästa period.</p>
              </div>
              <button type="button" onClick={() => tryck('tillbaka')} className="rounded-md border border-slate-600 px-3 py-1 text-[12px] text-slate-200">Tillbaka till Kräver åtgärd</button>
            </div>
          )}
          <div className="grid gap-1.5 rounded-xl border border-slate-600 bg-slate-100 p-3 text-slate-800 sm:w-1/2" onClick={() => tryck('papper')}>
            <p className="text-[12px] font-bold">{AVTAL}</p>
            <p className="text-[10.5px]">§ 1 Omfattning: Exempel AB Kontor, {ENHET}</p>
            <p className="text-[10.5px]">§ 3 Uppföljning: 12 besök per år</p>
            <p className="text-[10.5px]">§ 5 Utrustning: 6 betongstationer</p>
            <p className="text-[10.5px]">§ 6 Årspremie: 18 000 kr, avtalsdag 30 juni</p>
          </div>
        </DatorSida>

        {/* Notisen */}
        {l.vy === 'notis' && (
          <div className="absolute right-3 top-3 z-20 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
            <p className="px-1 pb-1 text-[11px] font-semibold text-slate-400">Notiser</p>
            <Markor markor={mk(markera, 'notis', nr)} block>
              <button type="button" onClick={() => tryck('notis')} className="grid w-full gap-0.5 rounded-lg bg-slate-800/70 p-2 text-left">
                <span className="text-[12px] font-semibold text-white">1 att göra på avtalskartan · Exempel AB</span>
                <span className="text-[11px] text-slate-400">{addonDecideInstruction(ANTAL, ENHET, true)}</span>
              </button>
            </Markor>
            <button type="button" onClick={() => tryck('annan-notis')} className="mt-1 grid w-full gap-0.5 rounded-lg p-2 text-left">
              <span className="text-[12px] text-slate-300">Anna Exempel nämnde dig</span>
            </button>
          </div>
        )}

        {/* Panelen Innehåll och utrustning */}
        {(l.vy === 'beslut' || l.vy === 'klart') && (
          <div className="absolute inset-y-0 right-0 z-20 w-[300px] max-w-full overflow-y-auto border-l border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <p className="mb-2 text-[12.5px] font-semibold text-white">Innehåll och utrustning</p>
            {!beslutat ? (
              <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-amber-400">Att besluta · 1</p>
                <p className="text-[12px] text-white">{ANTAL} st Mekanisk fälla · {ENHET} · per år</p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#20c58f]/35 bg-[#20c58f]/5 px-3 py-2.5">
                <p className="text-[12.5px] font-semibold text-white">Klart på det här avtalet</p>
                <p className="text-[11.5px] text-slate-400">{ANTAL} tillägg · {kr(STATIONER)}/år beslutat</p>
              </div>
            )}
            <div className="mt-3 border-t border-slate-700 pt-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tilläggsstationer, betald till och med</p>
              <p className="mb-1 text-[12px] font-semibold text-white">{ENHET}</p>
              <Markor markor={mk(markera, 'betald', nr)} block>
                <button type="button" onClick={() => tryck('betald')} className="w-full divide-y divide-slate-700/60 border-y border-slate-700/60 text-left">
                  {['Mekanisk fälla 7', 'Mekanisk fälla 8'].map(s => (
                    <span key={s} className="flex items-center gap-2 py-1.5 text-[11.5px]">
                      <span className="min-w-0 flex-1 truncate text-slate-200">{s}</span>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${beslutat ? 'bg-slate-500' : 'bg-amber-400'}`} aria-hidden />
                      <span className={beslutat ? 'text-slate-400' : 'text-amber-300'}>{beslutat ? 'pro rata väntar' : 'väntar på beslut'}</span>
                    </span>
                  ))}
                </button>
              </Markor>
            </div>
            <div className="mt-3 border-t border-slate-700 pt-2.5">
              <p className="mb-1 text-[11.5px] font-semibold text-slate-200">Tilläggen faktureras</p>
              <p className="text-[11px] text-slate-300">Med premiens perioder, en faktura per enhetens referenskod. Utan premie årsvis på avtalsdagen. Tilläggen löper med avtalet och slutar när avtalet slutar.</p>
            </div>
          </div>
        )}

        {/* Besluta tillägg */}
        {l.vy === 'beslut' && (
          <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/50 p-3">
            <div className="grid w-full max-w-[450px] gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl" role="dialog" aria-label="Besluta tillägg">
              <div>
                <p className="text-sm font-semibold text-slate-100">Besluta tillägg</p>
                <p className="text-[11px] text-slate-400">{ENHET} · {AVTAL}</p>
              </div>
              <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
                <p className="text-[11px] font-medium text-slate-400">Vad teknikern satte ut</p>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <StationPunkt typ={TYPER.mekanisk} storlek={16} />
                  <span className="flex-1 text-slate-200">Mekanisk fälla</span>
                  <span className="text-slate-300">{ANTAL} st</span>
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 text-slate-200">{PRIS}</span>
                  <span className="text-slate-400">kr per år</span>
                  <span className="w-16 text-right text-slate-100">{kr(STATIONER)}</span>
                </div>
                <div className="flex items-center gap-2 border-t border-slate-700/50 pt-1.5 text-[11.5px]">
                  <span className="flex-1">
                    <span className="block text-slate-200">Arbetstid för att hantera tilläggen</span>
                    <span className="block text-[10.5px] text-slate-500">Teknikerns förslag vid BE-0004512</span>
                  </span>
                  <Markor markor={mk(markera, 'timmar', nr)}>
                    <button type="button" onClick={() => tryck('timmar')} className="rounded-md border border-slate-700 bg-slate-800 px-1.5 text-slate-200">{l.timmar}</button>
                  </Markor>
                  <span className="text-slate-400">h × 1 016</span>
                  <span className="w-16 text-right text-slate-100">{kr(arbete)}</span>
                </div>
                <Rad v={<span className="font-medium text-slate-300">Per år</span>} h={kr(STATIONER + arbete)} />
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
                <p className="text-[11px] font-medium text-slate-400">Hur ska tillägget faktureras?</p>
                <Radio pa={l.lage === 'separate'} titel="Tillägg utöver avtalet"
                  text={`Egen faktura i samband med avtalets årsfaktura, första ${formatDateShortSv(AVTALSDAG)}. Nu faktureras ${kr(forsta.total)} för ${monthsLabel(forsta.months)} på etableringsärendet.`}
                  onClick={() => tryck('lage-separate')} />
                <Radio pa={l.lage === 'included'} titel="Lägg till i avtalet" text={`Årspremien höjs med ${kr(STATIONER + arbete)}, från 18 000 till ${kr(18000 + STATIONER + arbete)}, och faktureras med avtalet.`} onClick={() => tryck('lage-included')} />
              </div>
              <Knapprad>
                <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
                <PKnapp prim onClick={() => tryck('besluta')} markor={mk(markera, 'besluta', nr)}>Besluta</PKnapp>
              </Knapprad>
            </div>
          </div>
        )}

        {beslutat && (
          <Notis text={`${ANTAL} st tilläggsstationer ligger nu som tillägg utöver ${AVTAL}, ${kr(STATIONER + arbete)} per år på egen faktura.`} />
        )}
      </div>
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'notis', timmar: 1, lage: 'separate' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'notis' },
  { lage: { ...BAS, vy: 'karta' }, markera: 'utover' },
  { lage: { ...BAS, vy: 'beslut' }, markera: 'timmar' },
  { lage: { ...BAS, vy: 'beslut', timmar: 2 }, markera: 'besluta' },
  { lage: { ...BAS, vy: 'klart', timmar: 2 }, markera: 'betald' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du har fått en notis om Exempel AB. Öppna den.' }

const TIPS: Record<string, string> = {
  'annan-notis': 'Det är en fråga från Anna Exempel. Notisen om avtalskartan ligger överst.',
  papper: 'Pappret visar avtalet. Det du ska göra står i arbetslistan överst.',
  'i-premien': 'Ingår i premien höjer årspremien. Uppdraget var att fakturera fällorna som tillägg utöver avtalet.',
  'lage-included': 'Lägg till i avtalet höjer premien. Uppdraget var tillägg utöver avtalet.',
  avbryt: 'Avbryt stänger rutan utan beslut. Raden ligger då kvar i arbetslistan och ingen pro rata skapas.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'klart') return
    if (l.vy === 'notis') {
      if (id === 'notis') { setL({ ...l, vy: 'karta' }); tips('Arbetslistan', 'Raden säger vad som väntar och på vilken enhet. Välj hur fällorna ska faktureras.') }
      else miss(TIPS[id] ?? 'Tryck på notisen 1 att göra på avtalskartan.')
    } else if (l.vy === 'karta') {
      if (id === 'utover') { setL({ ...l, vy: 'beslut' }); tips('Besluta tillägg', 'Teknikern föreslog 1 timme. Ni kom överens om 2 timmar per år med kunden.') }
      else miss(TIPS[id] ?? 'Tryck Tillägg utöver avtalet på raden Tillägg att besluta.')
    } else if (l.vy === 'beslut') {
      if (id === 'timmar') { setL({ ...l, timmar: l.timmar === 2 ? 1 : 2 }); tips(l.timmar === 2 ? 'Tillbaka till 1 timme' : '2 timmar', l.timmar === 2 ? 'Uppdraget var 2 timmar.' : `Arbetstiden blir ${kr(2 * TIMPRIS)} per år. Kontrollera faktureringssättet och besluta.`) }
      else if (id === 'lage-separate') { setL({ ...l, lage: 'separate' }); tips('Tillägg utöver avtalet', 'Det är rätt val.') }
      else if (id === 'lage-included') { setL({ ...l, lage: 'included' }); miss(TIPS[id]) }
      else if (id === 'besluta') {
        if (l.timmar !== 2) miss('Arbetstiden står fortfarande på teknikerns förslag. Ändra till 2 timmar först.')
        else if (l.lage !== 'separate') miss('Välj Tillägg utöver avtalet under Hur ska tillägget faktureras?')
        else {
          setL({ ...l, vy: 'klart' })
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Fällorna och 2 timmar per år ligger nu som tillägg utöver avtalet, ${kr(STATIONER + 2 * TIMPRIS)} per år. Premien är orörd. Pro rata fram till avtalsdagen ${AVTALSDAG} läggs nu på etableringsärendet, därför står det pro rata väntar vid stationerna.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Ändra timmarna och tryck Besluta.')
    }
  }

  const framsteg = l.vy === 'notis' ? 0 : l.vy === 'karta' ? 1 : l.vy === 'beslut' ? (l.timmar === 2 ? 3 : 2) : 4
  return (
    <OvningRam bred framsteg={framsteg} totalt={4} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
