// src/pages/shared/intranet/guider/guide-tillaggsstationer-fakturering.tsx
// Guidemodul: Besluta och fakturera tilläggsstationer (admin och koordinator, dator).
// Etiketterna följer notisen (Tillägg att besluta · kund), ContractMapSection
// (N tillägg att besluta, Öppna § 5, Alla tillägg beslutade, Tillbaka till Kräver åtgärd),
// ContractSettingsDrawer (Innehåll och utrustning, Att besluta, Lägg till i avtalet,
// Tillägg utöver avtalet) och AddonDropPrompt (Besluta tillägg, Vad teknikern satte ut,
// kr per år, Arbetstid för att hantera tilläggen, Teknikerns förslag vid, Per år,
// Hur ska tillägget faktureras?, Besluta). Påhittad kund, priser ur Automatisk prislista.

import { useState } from 'react'
import {
  Dator, DatorSida, Knapprad, Markor, Notis, OvningRam, PKnapp, Rad,
  type MarkorProps, type OvningSvar,
} from '../skarmkit'
import type { GuideModul } from './registry'
import { StationPunkt, TYPER } from './_stationer'

type Vy = 'notis' | 'karta' | 'panel' | 'beslut' | 'klart'
type Lage = { vy: Vy; timmar: number; lage: 'separate' | 'included' }

const MENY = ['Öppna schema', 'Ärenden', 'Rondering & Schema', 'Befintliga kunder']
const STATIONER = 2 * 3600

const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

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
  const arbete = l.timmar * 1016
  const beslutat = l.vy === 'klart'
  return (
    <Dator adress="koordinator › befintliga-kunder › Exempel AB">
      <div className="relative h-[470px]">
        <DatorSida meny={MENY} aktiv="Befintliga kunder" titel="Exempel AB · Avtalskarta">
          {!beslutat ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-amber-200">2 tillägg att besluta · {kr(STATIONER)}/år</p>
                <p className="text-[11px] text-amber-200/80">Tekniker har satt ut stationer utöver avtalet. Bestäm per rad om de ska faktureras som tillägg eller bakas in i premien.</p>
                <p className="text-[11px] text-amber-200/70">Avtal 1 av 1 · 2 här</p>
              </div>
              <Markor markor={mk(markera, 'oppna5', nr)}>
                <button type="button" onClick={() => tryck('oppna5')} className="rounded-md bg-[#20c58f] px-3 py-1 text-[12px] font-semibold text-[#0b1220]">Öppna § 5</button>
              </Markor>
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#20c58f]/35 bg-[#20c58f]/5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-white">Alla tillägg beslutade</p>
                <p className="text-[11px] text-slate-400">{kr(STATIONER + arbete)}/år på 1 avtal. Fakturaunderlaget uppdateras vid nästa period.</p>
              </div>
              <button type="button" onClick={() => tryck('tillbaka')} className="rounded-md border border-slate-600 px-3 py-1 text-[12px] text-slate-200">Tillbaka till Kräver åtgärd</button>
            </div>
          )}
          <div className="grid gap-1.5 rounded-xl border border-slate-600 bg-slate-100 p-3 text-slate-800 sm:w-2/3" onClick={() => tryck('papper')}>
            <p className="text-[12px] font-bold">Serviceavtal Exempel AB</p>
            <p className="text-[10.5px]">§ 3 Uppföljning: 12 besök per år</p>
            <p className="text-[10.5px]">§ 4 Utrustning: 6 betongstationer</p>
            <p className="text-[10.5px]">§ 5 Tillägg utöver avtalet</p>
            <p className="text-[10.5px]">§ 7 Årspremie: 18 000 kr</p>
          </div>
        </DatorSida>

        {/* Notisen */}
        {l.vy === 'notis' && (
          <div className="absolute right-3 top-3 z-20 w-72 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl">
            <p className="px-1 pb-1 text-[11px] font-semibold text-slate-400">Notiser</p>
            <Markor markor={mk(markera, 'notis', nr)} block>
              <button type="button" onClick={() => tryck('notis')} className="grid w-full gap-0.5 rounded-lg bg-slate-800/70 p-2 text-left">
                <span className="text-[12px] font-semibold text-white">Tillägg att besluta · Exempel AB</span>
                <span className="text-[11px] text-slate-400">2 tilläggsstationer på 1 avtal väntar på beslut om fakturering, 7 200 kr/år.</span>
              </button>
            </Markor>
            <button type="button" onClick={() => tryck('annan-notis')} className="mt-1 grid w-full gap-0.5 rounded-lg p-2 text-left">
              <span className="text-[12px] text-slate-300">Ny ticket från Anna Exempel</span>
            </button>
          </div>
        )}

        {/* Panelen § 5 */}
        {(l.vy === 'panel' || l.vy === 'beslut') && (
          <div className="absolute inset-y-0 right-0 z-20 w-[290px] max-w-full border-l border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <p className="mb-2 text-[12.5px] font-semibold text-white">Innehåll och utrustning</p>
            <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-amber-400">Att besluta · 1</p>
              <p className="mb-1.5 text-[12px] text-white">2 st Mekanisk fälla · Exempel AB Lager · per år</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => tryck('i-avtalet')} className="rounded-md border border-slate-600 px-2.5 py-1 text-[11.5px] text-slate-200">Lägg till i avtalet</button>
                <Markor markor={mk(markera, 'utover', nr)}>
                  <button type="button" onClick={() => tryck('utover')} className="rounded-md bg-[#20c58f] px-2.5 py-1 text-[11.5px] font-semibold text-[#0b1220]">Tillägg utöver avtalet</button>
                </Markor>
              </div>
            </div>
          </div>
        )}

        {/* Besluta tillägg */}
        {l.vy === 'beslut' && (
          <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/50 p-3">
            <div className="grid w-full max-w-[440px] gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl" role="dialog" aria-label="Besluta tillägg">
              <div>
                <p className="text-sm font-semibold text-slate-100">Besluta tillägg</p>
                <p className="text-[11px] text-slate-400">Exempel AB Lager · Serviceavtal Exempel AB</p>
              </div>
              <div className="grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
                <p className="text-[11px] font-medium text-slate-400">Vad teknikern satte ut</p>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <StationPunkt typ={TYPER.mekanisk} storlek={16} />
                  <span className="flex-1 text-slate-200">Mekanisk fälla</span>
                  <span className="text-slate-300">2 st</span>
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 text-slate-200">3600</span>
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
                  <span className="text-slate-400">h × 1 016 kr</span>
                  <span className="w-16 text-right text-slate-100">{kr(arbete)}</span>
                </div>
                <Rad v={<span className="font-medium text-slate-300">Per år</span>} h={kr(STATIONER + arbete)} />
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-800/30 p-2.5">
                <p className="text-[11px] font-medium text-slate-400">Hur ska tillägget faktureras?</p>
                <Radio pa={l.lage === 'separate'} titel="Tillägg utöver avtalet" text="Egen faktura i samband med avtalets årsfaktura, första 1 jan 2027. Premien och avtalets innehåll rörs inte." onClick={() => tryck('lage-separate')} />
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
          <Notis text={`2 st tilläggsstationer ligger nu som tillägg utöver Serviceavtal Exempel AB, ${kr(STATIONER + arbete)} per år på egen faktura.`} />
        )}
      </div>
    </Dator>
  )
}

// ─── Visning ───

const BAS: Lage = { vy: 'notis', timmar: 1, lage: 'separate' }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'notis' },
  { lage: { ...BAS, vy: 'karta' }, markera: 'oppna5' },
  { lage: { ...BAS, vy: 'panel' }, markera: 'utover' },
  { lage: { ...BAS, vy: 'beslut' }, markera: 'timmar' },
  { lage: { ...BAS, vy: 'beslut', timmar: 2 }, markera: 'besluta' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du har fått en notis om tillägg hos Exempel AB. Öppna den.' }

const TIPS: Record<string, string> = {
  'annan-notis': 'Det är en ticket. Notisen om tillägget ligger överst.',
  papper: 'Pappret visar avtalet. Beslutet tar du via remsan överst.',
  'i-avtalet': 'Lägg till i avtalet höjer premien. Uppdraget var att fakturera fällorna som tillägg utöver avtalet.',
  'lage-included': 'Lägg till i avtalet höjer premien. Uppdraget var tillägg utöver avtalet.',
  avbryt: 'Avbryt stänger rutan utan beslut. Kunden ligger då kvar under Kräver åtgärd.',
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
      if (id === 'notis') { setL({ ...l, vy: 'karta' }); tips('Avtalskartan', 'Den gula remsan visar vad som väntar. Öppna beslutet.') }
      else miss(TIPS[id] ?? 'Tryck på notisen Tillägg att besluta.')
    } else if (l.vy === 'karta') {
      if (id === 'oppna5') { setL({ ...l, vy: 'panel' }); tips('Raden att besluta', '2 mekaniska fällor per år på lagret. Hur ska de faktureras?') }
      else miss(TIPS[id] ?? 'Tryck Öppna § 5 i den gula remsan.')
    } else if (l.vy === 'panel') {
      if (id === 'utover') { setL({ ...l, vy: 'beslut' }); tips('Besluta tillägg', 'Teknikern föreslog 1 timme. Ni kom överens om 2 timmar per år med kunden.') }
      else miss(TIPS[id] ?? 'Tryck Tillägg utöver avtalet.')
    } else if (l.vy === 'beslut') {
      if (id === 'timmar') { setL({ ...l, timmar: l.timmar === 2 ? 1 : 2 }); tips(l.timmar === 2 ? 'Tillbaka till 1 timme' : '2 timmar', l.timmar === 2 ? 'Uppdraget var 2 timmar.' : `Arbetstiden blir ${kr(2 * 1016)} per år. Kontrollera faktureringssättet och besluta.`) }
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
            text: `Fällorna och 2 timmar per år ligger nu som tillägg utöver avtalet, ${kr(STATIONER + 2 * 1016)} per år på en egen faktura i samband med årsfakturan. Premien är orörd och kunden försvinner från Kräver åtgärd.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else miss(TIPS[id] ?? 'Ändra timmarna och tryck Besluta.')
    }
  }

  const framsteg = l.vy === 'notis' ? 0 : l.vy === 'karta' ? 1 : l.vy === 'panel' ? 2 : l.vy === 'beslut' ? (l.timmar === 2 ? 4 : 3) : 5
  return (
    <OvningRam bred framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}


export default { Visning, Ovning } satisfies GuideModul
