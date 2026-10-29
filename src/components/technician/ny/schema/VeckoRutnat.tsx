// src/components/technician/ny/schema/VeckoRutnat.tsx
// Veckan på datorn: kolumner måndag till söndag, rader för klockslagen (07 till 17,
// längre om något besök ligger utanför) och besöken placerade i tid. Överst i varje
// kolumn står belastningen i klartext. Lediga dagar och helger är grå, frånvaro randig,
// nu-linjen syns idag. Mellan besöken står körtiden när den gått att räkna.

import type { CSSProperties } from 'react'
import { Icon } from '../../../icons/Icon'
import { TYP_IKON } from '../besokTyp'
import type { WorkSchedule } from '../../../../types/database'
import type { Restid } from '../../../../services/restidService'
import { TYP_ETIKETT, klockslag, ortUrAdress, veckodag, type DagBesok } from '../../../../services/teknikerDagService'
import {
  arLedigDag, arbetstid, bokadeText, dagNummer, dagRubrik, franvaroForDag, luckor, minuterIDag, schemaStatus,
  veckodagKort, visaStationer, type Belastning, type Franvaro,
} from './schemaLogik'
import { BelastningText, PUNKT_FARG, TON_TEXT } from './SchemaDelar'
import { kortidKort, kortidText } from './useKortid'
import { franvaroTyp } from '../../../../utils/franvaroTyper'

/** Frånvarotypens ikon i typens färg */
function FranvaroIkon({ orsak }: { orsak: string | null | undefined }) {
  return (
    <span className="flex-none" style={{ color: orsak ? franvaroTyp(orsak).farg : undefined }}>
      <Icon name={orsak ? franvaroTyp(orsak).ikon : 'allman.kalender'} size={16} />
    </span>
  )
}

const TIMME_PX = 64

interface Props {
  dagar: string[]
  idag: string
  nu: Date
  besokPerDag: Map<string, DagBesok[]>
  allaPerDag: Map<string, DagBesok[]>
  ws: WorkSchedule | null
  franvaro: Franvaro[]
  belastningFor: (dag: string) => Belastning
  valdNyckel: string | null
  onValj: (b: DagBesok) => void
  onVisaDag: (dag: string) => void
  kortid: Map<string, Restid | null>
  stationer: Map<string, number>
}

interface Placerad {
  b: DagBesok
  topp: number
  hojd: number
  spar: number
  antalSpar: number
}

/** Lägg besök som överlappar bredvid varandra */
function placera(besok: DagBesok[], startMin: number, slutMin: number): Placerad[] {
  const ut: Placerad[] = []
  const lista = besok.filter(b => b.start).map(b => {
    const s = Math.max(startMin, minuterIDag(b.start as Date))
    const e0 = b.slut && b.slut > (b.start as Date) ? minuterIDag(b.slut) : s + 60
    const e = Math.min(slutMin, e0 <= s ? s + 30 : e0)
    return { b, s, e }
  }).sort((a, z) => a.s - z.s)

  let grupp: { b: DagBesok; s: number; e: number; spar: number }[] = []
  let gruppSlut = -1
  const tomGrupp = () => {
    const antal = Math.max(1, ...grupp.map(g => g.spar + 1))
    for (const g of grupp) {
      ut.push({ b: g.b, topp: (g.s - startMin) * TIMME_PX / 60, hojd: Math.max(28, (g.e - g.s) * TIMME_PX / 60 - 4), spar: g.spar, antalSpar: antal })
    }
    grupp = []
  }
  const sparSlut: number[] = []
  for (const x of lista) {
    if (x.s >= gruppSlut && grupp.length) { tomGrupp(); sparSlut.length = 0 }
    let spar = sparSlut.findIndex(e => e <= x.s)
    if (spar < 0) { spar = sparSlut.length; sparSlut.push(x.e) } else sparSlut[spar] = x.e
    grupp.push({ ...x, spar })
    gruppSlut = Math.max(gruppSlut, x.e)
  }
  if (grupp.length) tomGrupp()
  return ut
}

const RANDIG = 'bg-[repeating-linear-gradient(135deg,var(--color-slate-800)_0,var(--color-slate-800)_6px,var(--color-slate-700)_6px,var(--color-slate-700)_7px)]'

export function VeckoRutnat(p: Props) {
  // Tidsfönstret: 07 till 17, utökat om arbetstiden eller något besök ligger utanför
  let startH = 7
  let slutH = 17
  for (const dag of p.dagar) {
    const at = arbetstid(dag, p.ws)
    if (at && p.ws) {
      startH = Math.min(startH, Math.floor(minuterIDag(at.start) / 60))
      slutH = Math.max(slutH, Math.ceil(minuterIDag(at.slut) / 60))
    }
    for (const b of p.besokPerDag.get(dag) ?? []) {
      if (b.start) startH = Math.min(startH, Math.floor(minuterIDag(b.start) / 60))
      const e = b.slut ?? b.start
      if (e && b.start && e > b.start) {
        const m = minuterIDag(e)
        slutH = Math.max(slutH, m === 0 ? 24 : Math.ceil(m / 60))
      }
    }
  }
  const startMin = startH * 60
  const slutMin = slutH * 60
  const hojd = (slutH - startH) * TIMME_PX
  const pos = (d: Date) => (Math.min(slutMin, Math.max(startMin, minuterIDag(d))) - startMin) * TIMME_PX / 60

  const smal = (dag: string) => arLedigDag(dag, p.ws) && (p.besokPerDag.get(dag)?.length ?? 0) === 0
  const kolumner = `48px ${p.dagar.map(d => (smal(d) ? '52px' : 'minmax(0,1fr)')).join(' ')}`
  const linjer: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--color-slate-700) 0, var(--color-slate-700) 1px, transparent 1px, transparent ${TIMME_PX}px)`,
  }
  const nuMin = minuterIDag(p.nu)
  const visaNu = p.dagar.includes(p.idag) && nuMin >= startMin && nuMin <= slutMin
  const nuTopp = (nuMin - startMin) * TIMME_PX / 60

  return (
    <div role="grid" aria-label={`Veckan ${dagRubrik(p.dagar[0])} till ${dagRubrik(p.dagar[6])}`} data-genomgang="schema-vecka" className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
      <div role="row" className="grid border-b border-slate-700/60" style={{ gridTemplateColumns: kolumner }}>
        <div aria-hidden="true" />
        {p.dagar.map(dag => {
          const b = p.belastningFor(dag)
          const arIdag = dag === p.idag
          const rubrik = `${veckodagKort(dag)} ${dagNummer(dag)}`
          if (smal(dag)) {
            return (
              <div key={dag} role="columnheader" className="px-1.5 py-2.5 flex flex-col gap-0.5 text-slate-400">
                <span className="text-sm font-semibold">{rubrik}</span>
                <span className="text-xs">Ledig</span>
              </div>
            )
          }
          return (
            <div key={dag} role="columnheader" className={arIdag ? 'bg-[#20c58f]/10' : ''}>
              <button
                type="button"
                onClick={() => p.onVisaDag(dag)}
                aria-label={`Visa ${dagRubrik(dag).toLowerCase()} som dag`}
                className="w-full h-full text-left px-2 py-2.5 flex flex-col gap-0.5 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]"
              >
                <span className="flex items-baseline justify-between gap-1">
                  <span className={`text-sm font-semibold ${arIdag ? 'text-[#20c58f]' : 'text-white'}`}>{rubrik}</span>
                  {arIdag && <span className="text-xs font-semibold text-[#20c58f]">Idag</span>}
                </span>
                <BelastningText b={b} className="text-xs" />
                {b.niva !== 'ledig' && b.niva !== 'franvaro' && <span className="text-xs text-slate-300">{bokadeText(b)}</span>}
                <span className="text-xs text-slate-400">{b.antal} besök</span>
              </button>
            </div>
          )
        })}
      </div>

      <div role="row" className="grid pt-2 pb-3" style={{ gridTemplateColumns: kolumner }}>
        <div aria-hidden="true" className="relative" style={{ height: hojd }}>
          {Array.from({ length: slutH - startH }, (_, i) => (
            <span key={i} className="absolute right-2 font-mono text-[11px] text-slate-500" style={{ top: i * TIMME_PX - 7 }}>
              {String(startH + i).padStart(2, '0')}:00
            </span>
          ))}
          {visaNu && (
            <span className="absolute right-1 px-1 rounded bg-[#20c58f] text-[#04281c] font-mono text-[10px] font-bold" style={{ top: nuTopp - 8 }}>
              {klockslag(p.nu)}
            </span>
          )}
        </div>

        {p.dagar.map(dag => {
          const synliga = p.besokPerDag.get(dag) ?? []
          const fv = franvaroForDag(dag, p.franvaro, p.ws)
          const ledig = arLedigDag(dag, p.ws)
          const helg = veckodag(dag) >= 6
          const framat = dag >= p.idag
          const placerade = placera(synliga, startMin, slutMin)

          // Luckor på minst en timme, från idag och framåt
          const dagensLuckor = framat
            ? luckor(dag, p.allaPerDag.get(dag) ?? [], p.ws, p.franvaro, 60).filter(l => dag !== p.idag || l.slut > p.nu)
            : []
          const kortidILucka = new Set<string>()
          const luckBlock = dagensLuckor.map(l => {
            const nasta = synliga.find(b => b.start && Math.abs(b.start.getTime() - l.slut.getTime()) < 60_000)
            const k = nasta ? p.kortid.get(nasta.nyckel) : null
            if (nasta && k) kortidILucka.add(nasta.nyckel)
            return { l, k }
          })

          return (
            <div
              key={dag}
              role="gridcell"
              aria-label={`${dagRubrik(dag)}${ledig ? ', ledig' : ''}`}
              className={`relative border-l border-slate-700/60 ${ledig || helg ? 'bg-slate-800/50' : ''} ${dag === p.idag ? 'bg-[#20c58f]/[0.03]' : ''}`}
              style={{ ...linjer, height: hojd }}
            >
              {fv.heldag ? (
                <div className={`absolute inset-1 rounded-lg border border-slate-700 p-2 text-slate-300 ${RANDIG}`}>
                  <span className="flex items-center gap-1 text-xs font-semibold"><FranvaroIkon orsak={fv.block[0]?.orsak} />{fv.block[0]?.rubrik || 'Frånvaro'}</span>
                  {fv.block[0]?.orsak && <span className="block text-xs text-slate-400">{franvaroTyp(fv.block[0].orsak).kort}</span>}
                </div>
              ) : fv.block.map((f, i) => (
                <div key={`f${i}`} className={`absolute left-1 right-1 rounded-lg border border-slate-700 p-2 overflow-hidden text-slate-300 ${RANDIG}`} style={{ top: pos(f.start), height: Math.max(24, pos(f.slut) - pos(f.start)) }}>
                  <span className="flex items-center gap-1 text-xs font-semibold"><FranvaroIkon orsak={f.orsak} /><span className="truncate">{f.rubrik || (f.orsak ? franvaroTyp(f.orsak).kort : 'Frånvaro')}</span></span>
                  <span className="block text-xs text-slate-400">{klockslag(f.start)} till {klockslag(f.slut)}</span>
                </div>
              ))}

              {luckBlock.map(({ l, k }) => (
                <div key={`l${l.start.getTime()}`} className="absolute left-1 right-1 rounded-lg border border-dashed border-slate-500 bg-slate-900/60 p-2 overflow-hidden text-slate-300" style={{ top: pos(l.start) + 2, height: Math.max(24, pos(l.slut) - pos(l.start) - 4) }}>
                  <span className="flex items-center gap-1 text-xs font-semibold text-white"><Icon name="allman.klocka" size={16} />Ledigt {klockslag(l.start)} till {klockslag(l.slut)}</span>
                  {k && <span className="block text-xs text-slate-400">{kortidText(k)} till nästa</span>}
                </div>
              ))}

              {/* Körtid i mellanrummet mellan två besök */}
              {framat && synliga.map((b, i) => {
                if (i === 0 || kortidILucka.has(b.nyckel)) return null
                const k = p.kortid.get(b.nyckel)
                const forra = synliga[i - 1]
                if (!k || !b.start) return null
                const fran = forra.slut ?? forra.start
                if (!fran) return null
                const topp = pos(fran)
                const h = pos(b.start) - topp
                if (h < 16) return null
                return (
                  <span key={`k${b.nyckel}`} className="absolute left-1 right-1 flex items-center justify-center gap-1 text-[11px] text-slate-400" style={{ top: topp, height: h }}>
                    <Icon name="falt.bil" size={16} />{kortidKort(k)}
                  </span>
                )
              })}

              {placerade.map(({ b, topp, hojd: h, spar, antalSpar }) => {
                const st = schemaStatus(b, p.idag)
                const vald = p.valdNyckel === b.nyckel
                const ort = ortUrAdress(b.adress)
                const antal = b.customerId ? p.stationer.get(b.customerId) : undefined
                const detalj = [TYP_ETIKETT[b.typ], ort, visaStationer(b) && antal ? `${antal} stationer` : ''].filter(Boolean).join(', ')
                const bredd = 100 / antalSpar
                return (
                  <button
                    key={b.nyckel}
                    type="button"
                    onClick={() => p.onValj(b)}
                    aria-pressed={vald}
                    aria-label={`${klockslag(b.start)}${b.slut ? ` till ${klockslag(b.slut)}` : ''}, ${detalj}, ${b.kund}, ${st.text}`}
                    className={`absolute box-border overflow-hidden text-left px-2 py-1 flex flex-col gap-px rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                      vald ? 'z-10 border-2 border-[#20c58f] bg-slate-900'
                        : b.avslutad ? 'border border-slate-700/60 bg-slate-800 text-slate-300 hover:border-slate-500'
                        : 'border border-slate-600 bg-slate-900 hover:border-slate-400'
                    }`}
                    style={{ top: topp + 2, height: h, left: `calc(${spar * bredd}% + 4px)`, width: `calc(${bredd}% - 8px)` }}
                  >
                    <span className="flex items-center justify-between gap-1 leading-tight">
                      <span className={`font-mono text-xs font-bold ${b.avslutad ? 'text-slate-400' : 'text-white'}`}>{klockslag(b.start)}</span>
                      <span className="flex text-slate-400"><Icon name={TYP_IKON[b.typ]} size={16} title={TYP_ETIKETT[b.typ]} /></span>
                    </span>
                    <span className={`text-[13px] font-semibold leading-tight truncate ${b.avslutad ? 'text-slate-300' : 'text-white'}`}>{b.kund}</span>
                    {h >= 84 && <span className="text-xs leading-tight text-slate-400 truncate">{detalj}</span>}
                    {h >= 56 && (
                      <span className="leading-tight whitespace-nowrap overflow-hidden">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${TON_TEXT[st.ton]}`}>
                          <span aria-hidden="true" className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${PUNKT_FARG[st.ton]}`} />
                          {st.text}
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}

              {dag === p.idag && visaNu && (
                <>
                  <span aria-hidden="true" className="absolute left-0 right-0 h-0.5 bg-[#20c58f] z-20 pointer-events-none" style={{ top: nuTopp }} />
                  <span aria-hidden="true" className="absolute -left-1 w-2 h-2 rounded-full bg-[#20c58f] z-20 pointer-events-none" style={{ top: nuTopp - 3 }} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VeckoRutnat
