// src/pages/shared/intranet/guider/_rotrut.tsx
// Delade skärmar för guiderna Skapa en ROT- eller RUT-offert (3.127.0), för
// tekniker (guide-rot-rut-offert-tekniker) och kontor (guide-rot-rut-offert-kontor).
//
// Efterbildning av OneflowContractCreator med ROT-mallen: steget Mall
// (Offertförslag ROT (Privatperson)), steget Tjänster i ROT-läget
// (CaseServiceSelector: Avser, Arbetskostnad, Material och utrustning,
// Servicebil, Övriga kostnader, interna kostnader med ROT/Inget på arbetstiden,
// fälten Fastighetsbeteckning och Personnummer, listan Kvar innan du kan gå
// vidare), Granska och Oneflows PDF. Påhittad kund: Familjen Exempel.
// Texterna och knappnamnen följer src/constants/rotRutHjalp.ts.

import type { ReactNode } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, Notis, type OvningSvar } from '../skarmkit'
import type { Mk, Tryck } from './_nyvy_salja'

export type RotVy = 'mall' | 'tjanster' | 'granska' | 'pdf' | 'klart'

export interface RotLage {
  vy: RotVy
  /** ROT vald på arbetstiden */
  rot: boolean
  fastighet: boolean
  pnr: boolean
}

export const ROT_START: RotLage = { vy: 'mall', rot: false, fastighet: false, pnr: false }
export const ROT_ORDNING: RotVy[] = ['mall', 'tjanster', 'granska', 'pdf', 'klart']

export const ROT_TIMMAR = 10
const ARBETE = '12 000 kr'
const MATERIAL = '2 000 kr'
const BIL = '500 kr'
const TOTALT = '14 500 kr'
const AVDRAG = '3 600 kr'
const ATT_BETALA = '10 900 kr'

const klar = (l: RotLage) => l.rot && l.fastighet && l.pnr

function Kvar({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <Icon name={ok ? 'allman.bock' : 'allman.saknas'} size={16} className={ok ? 'text-[#20c58f]' : 'text-amber-400'} />
      <span className={ok ? 'text-slate-400' : 'text-white'}>{text}</span>
    </span>
  )
}

function Rad({ namn, belopp, under, gron, children }: { namn: string; belopp: string; under?: string; gron?: boolean; children?: ReactNode }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${gron ? 'border-[#20c58f]/30 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-800/40'}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] font-medium text-white">{namn}</span>
        <span className="inline-grid h-4 w-4 place-items-center rounded-full border border-slate-500 text-slate-400"><Icon name="allman.info" size={16} className="h-2.5 w-2.5" /></span>
        <span className="ml-auto text-[11.5px] font-semibold text-white tabular-nums">{belopp}</span>
      </div>
      {under && <p className="text-[10px] text-slate-500">{under}</p>}
      {children}
    </div>
  )
}

/** Wizardens innehåll för läget. Ramen (Telefon eller Dator) läggs runt av guiden. */
export function RotWizard({ l, mk, tryck }: { l: RotLage; mk: Mk; tryck: Tryck }) {
  const steg = ['Mall', 'Motpart', 'Tjänster', 'Offertinnehåll', 'Granska']
  const aktivt = l.vy === 'mall' ? 0 : l.vy === 'tjanster' ? 2 : 4
  return (
    <div className="relative grid gap-2 p-2.5 text-slate-200">
      <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
        {steg.map((s, i) => <span key={s} className={i === aktivt ? 'font-semibold text-[#20c58f]' : ''}>{i > 0 ? '› ' : ''}{s}</span>)}
      </div>

      {l.vy === 'mall' && (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold text-white">Välj mall</p>
          {['Offertförslag, Inkl moms (Privatperson)', 'Offertförslag, ROT (Privatperson)', 'Offertförslag, RUT (Privatperson)'].map(m => {
            const id = m.includes('ROT') ? 'mall:rot' : m.includes('RUT') ? 'mall:rut' : 'mall:inkl'
            return (
              <Markor key={m} markor={mk(id)} block>
                <button type="button" onClick={() => tryck(id)} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-[12px] text-white">
                  {m}
                  <span className="block text-[10.5px] text-slate-400">Privatperson{id === 'mall:rot' ? ' · ROT-avdrag' : id === 'mall:rut' ? ' · RUT-avdrag' : ''}</span>
                </button>
              </Markor>
            )
          })}
        </div>
      )}

      {l.vy === 'tjanster' && (
        <div className="grid gap-1.5">
          <p className="rounded-md border border-[#20c58f]/25 bg-[#20c58f]/10 px-2 py-1.5 text-[10.5px] leading-snug">
            Mallen har ROT-avdrag 30 %. Raderna nedan har skapats åt dig.
          </p>
          <p className="text-[10.5px] text-slate-300">Avser: <span className="text-white">Tätning gnagare</span> <span className="text-slate-500">0 kr</span></p>
          <Rad namn="Arbetskostnad" belopp={l.rot ? ARBETE : '0 kr'} under="visas som Arbetskostnad, 1 st" gron />
          <Rad namn="Material och utrustning" belopp={MATERIAL} under="3 interna kostnader" />
          <Rad namn="Servicebil" belopp={BIL} under="Priset skrivs in för hand" />
          <p className="pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Interna kostnader</p>
          <div className="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-white">Arbetstid Privatperson <span className="ml-auto text-slate-400">{ROT_TIMMAR} h</span></div>
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400">
              Ligger på Arbetskostnad
              <span className="ml-auto inline-flex overflow-hidden rounded border border-slate-600">
                <Markor markor={mk('rot')}>
                  <button type="button" onClick={() => tryck('rot')} className={`px-2 py-0.5 font-semibold ${l.rot ? 'bg-[#20c58f] text-[#06281c]' : ''}`}>ROT</button>
                </Markor>
                <button type="button" onClick={() => tryck('inget')} className={`px-2 py-0.5 font-semibold ${!l.rot ? 'bg-slate-600 text-white' : ''}`}>Inget</button>
              </span>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Markor markor={mk('fastighet')} block>
              <button type="button" onClick={() => tryck('fastighet')} className="w-full rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-left text-[11px]">
                <span className="block text-[10px] text-slate-400">Fastighetsbeteckning</span>
                <span className={l.fastighet ? 'text-white' : 'text-slate-500'}>{l.fastighet ? 'Exempelby 1:23' : 'Kommun område 1:23'}</span>
              </button>
            </Markor>
            <Markor markor={mk('pnr')} block>
              <button type="button" onClick={() => tryck('pnr')} className="w-full rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-left text-[11px]">
                <span className="block text-[10px] text-slate-400">Personnummer</span>
                <span className={l.pnr ? 'text-white' : 'text-slate-500'}>{l.pnr ? '19800101-1234' : 'ÅÅÅÅMMDD-XXXX'}</span>
              </button>
            </Markor>
          </div>
          <div className="grid gap-1 rounded-md bg-slate-800/60 p-2">
            <span className="text-[9.5px] uppercase tracking-wide text-slate-400">Kvar innan du kan gå vidare</span>
            <Kvar ok={l.rot} text="Arbetstid med ROT" />
            <Kvar ok text="Alla interna kostnader ligger på en rad" />
            <Kvar ok={l.fastighet} text="Fastighetsbeteckning ifylld" />
            <Kvar ok={l.pnr} text="Personnummer ifyllt" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-300">Att betala efter avdrag: <b className="text-white">{l.rot ? ATT_BETALA : '2 500 kr'}</b></span>
            <Markor markor={mk('nasta')}>
              <button type="button" onClick={() => tryck('nasta')} aria-disabled={!klar(l)} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${klar(l) ? 'bg-[#20c58f] text-[#052e22]' : 'bg-slate-700 text-slate-400'}`}>Nästa</button>
            </Markor>
          </div>
        </div>
      )}

      {l.vy === 'granska' && (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold text-white">Granska offerten</p>
          <p className="text-[10.5px] text-slate-300">Avser: Tätning gnagare</p>
          {[['Arbetskostnad', ARBETE], ['Material och utrustning', MATERIAL], ['Servicebil', BIL], ['Totalt inkl. moms', TOTALT]].map(([n, b]) => (
            <div key={n} className="flex justify-between border-t border-slate-700/60 pt-1 text-[11.5px]"><span>{n}</span><span className="tabular-nums">{b}</span></div>
          ))}
          <div className="flex justify-between text-[11.5px] text-[#20c58f]"><span>ROT-avdrag 30 %</span><span>-{AVDRAG}</span></div>
          <div className="flex justify-between border-t border-slate-600 pt-1 text-[12px] font-semibold text-white"><span>Att betala</span><span>{ATT_BETALA}</span></div>
          <Markor markor={mk('skapa-pdf')} block>
            <button type="button" onClick={() => tryck('skapa-pdf')} className="w-full rounded-lg bg-[#20c58f] px-3 py-2 text-[12px] font-semibold text-[#052e22]">Skapa och visa Oneflows PDF</button>
          </Markor>
        </div>
      )}

      {(l.vy === 'pdf' || l.vy === 'klart') && (
        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold text-white">Så här ser kunden offerten</p>
          <div className="rounded-md bg-white p-2 text-[10.5px] text-slate-800">
            <p className="font-semibold">Avser: Tätning gnagare</p>
            <p>Arbetskostnad {ARBETE} · Material och utrustning {MATERIAL} · Servicebil {BIL}</p>
            <p>Totalt inkl. moms {TOTALT}, ROT-avdrag 30 %: -{AVDRAG}. Att betala: {ATT_BETALA}.</p>
          </div>
          <Markor markor={mk('skicka')} block>
            <button type="button" onClick={() => tryck('skicka')} className="w-full rounded-lg bg-[#20c58f] px-3 py-2 text-[12px] font-semibold text-[#052e22]">Skicka offerten</button>
          </Markor>
        </div>
      )}
      {l.vy === 'klart' && <Notis text="Offerten är skickad" />}
    </div>
  )
}

/** Övningens logik: nytt läge och svar, eller miss med ett konkret tips. */
export function rotOvningTryck(l: RotLage, id: string): { lage?: RotLage; svar: OvningSvar; miss?: boolean } | null {
  const fel = (text: string) => ({ miss: true, svar: { typ: 'fel' as const, titel: 'Inte där', text } })
  switch (l.vy) {
    case 'mall':
      if (id === 'mall:rot') return { lage: { ...l, vy: 'tjanster' }, svar: { typ: 'tips', titel: 'ROT-mallen är vald', text: 'Raderna har skapats åt dig. Arbetstiden ligger redan på Arbetskostnad. Välj ROT på den.' } }
      if (id === 'mall:rut') return fel('Tätning är byggarbete på huset. Det är ROT, inte RUT.')
      return fel('Den mallen har inget avdrag. Välj ROT-mallen.')
    case 'tjanster':
      if (id === 'rot') return { lage: { ...l, rot: true }, svar: { typ: 'tips', titel: 'ROT på arbetstiden', text: `Arbetskostnad fick priset från de ${ROT_TIMMAR} timmarna. Timmarna syns aldrig för kunden. Fyll i fastighetsbeteckningen.` } }
      if (id === 'inget') return fel('Utan avdrag hör arbetstiden inte till Arbetskostnad. Tryck ROT.')
      if (id === 'fastighet') return { lage: { ...l, fastighet: true }, svar: { typ: 'tips', titel: 'Fastigheten är ifylld', text: 'Exempelby 1:23, med kolon. Fyll i personnumret.' } }
      if (id === 'pnr') return { lage: { ...l, pnr: true }, svar: { typ: 'tips', titel: 'Personnumret är ifyllt', text: 'Är listan grön kan du trycka Nästa.' } }
      if (id === 'nasta') {
        if (!klar(l)) return fel('Nästa går inte förrän listan Kvar innan du kan gå vidare är grön. Tryck på det som saknas.')
        return { lage: { ...l, vy: 'granska' }, svar: { typ: 'tips', titel: 'Granska', text: 'Raderna, avdraget och att betala är samma som i Oneflow. Tryck Skapa och visa Oneflows PDF.' } }
      }
      return null
    case 'granska':
      if (id === 'skapa-pdf') return { lage: { ...l, vy: 'pdf' }, svar: { typ: 'tips', titel: 'Oneflows PDF', text: 'Kontrollera raderna. Tryck Skicka offerten.' } }
      return fel('Tryck Skapa och visa Oneflows PDF.')
    case 'pdf':
      if (id === 'skicka') return { lage: { ...l, vy: 'klart' }, svar: { typ: 'ok', titel: 'Klart', text: 'Offerten är skickad. När kunden har godkänt bokas jobbet in, och timmarna och fastigheten följer med till fakturan.' } }
      return fel('Tryck Skicka offerten.')
    default:
      return null
  }
}

/** Visningens steg: läge och det som ska tryckas, samma i båda guiderna. */
export const ROT_VISNING: { lage: RotLage; markera: string }[] = [
  { lage: ROT_START, markera: 'mall:rot' },
  { lage: { ...ROT_START, vy: 'tjanster' }, markera: 'rot' },
  { lage: { ...ROT_START, vy: 'tjanster', rot: true }, markera: 'fastighet' },
  { lage: { ...ROT_START, vy: 'tjanster', rot: true, fastighet: true }, markera: 'pnr' },
  { lage: { vy: 'tjanster', rot: true, fastighet: true, pnr: true }, markera: 'nasta' },
  { lage: { vy: 'granska', rot: true, fastighet: true, pnr: true }, markera: 'skapa-pdf' },
  { lage: { vy: 'pdf', rot: true, fastighet: true, pnr: true }, markera: 'skicka' },
]

export const ROT_BORJA: OvningSvar = {
  typ: 'tips',
  titel: 'Börja här',
  text: 'Familjen Exempel vill täta grunden mot råttor. Du har planerat 10 timmars arbete. Skapa en ROT-offert och skicka den. Börja med mallen.',
}
