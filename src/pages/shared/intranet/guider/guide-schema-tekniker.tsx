// src/pages/shared/intranet/guider/guide-schema-tekniker.tsx
// Guidemodul: Se ditt schema som dag, vecka och månad (tekniker, telefon och dator).
// Ny teknikerslug: guide-schemavyn är kontorets guide och lämnas orörd.
// Källor: NySchema.tsx (telefonen börjar på Dag, datorn på Vecka; sökfältet "Sök kund,
// adress eller ärendenummer"; Filter, Statistik, Uppdatera), schema/SchemaDelar (Dag, Vecka,
// Månad), VeckoRemsa (Idag-knappen, sammanfattningen "5 av 8 timmar bokade idag."),
// DagTidslinje (Ledigt 09:00 till 10:00, "14 min körning", utfällt besök med Navigera, Ring
// och Öppna), VeckoRutnat ("5 av 8 tim bokade"), ValtBesok (Öppna ärendet), ManadKalender,
// SchemaListor (träffar per dag, Visa dagen, Rensa) och schemaLogik (Plats kvar, Nästan
// fullt, Fullt, Inte klarmarkerat). Påhittade kunder, vecka 44 2026.

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { TYP_IKON } from '../../../../components/technician/ny/besokTyp'
import type { BesokTyp } from '../../../../services/teknikerDagService'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { ArendeFramme, IdagSida, Mal, MerSida, Punkt, Rulla, UNDER_IDAG, gorMk, ingenMk, type ExBesok, type Mk, type Tryck } from './_nyvy_min_dag'

// ─── Exempelveckan ─────────────────────────────────

type Niva = 'lag' | 'hog' | 'full' | 'tom' | 'ledig'
const NIVA: Record<Niva, { text: string; ton: 'gron' | 'gul' | 'rod' | 'gra' }> = {
  lag: { text: 'Plats kvar', ton: 'gron' }, hog: { text: 'Nästan fullt', ton: 'gul' }, full: { text: 'Fullt', ton: 'rod' },
  tom: { text: 'Inget bokat', ton: 'gra' }, ledig: { text: 'Ledig', ton: 'gra' },
}
const PUNKTFARG: Record<'gron' | 'gul' | 'rod' | 'gra', string> = { gron: 'bg-[#20c58f]', gul: 'bg-amber-500', rod: 'bg-red-500', gra: 'bg-slate-500' }

interface Dag { id: string; kort: string; nr: number; rubrik: string; bokade: number; niva: Niva }
const VECKA: Dag[] = [
  { id: '26', kort: 'Mån', nr: 26, rubrik: 'Måndag 26 oktober', bokade: 5, niva: 'lag' },
  { id: '27', kort: 'Tis', nr: 27, rubrik: 'Tisdag 27 oktober', bokade: 2, niva: 'lag' },
  { id: '28', kort: 'Ons', nr: 28, rubrik: 'Onsdag 28 oktober', bokade: 7.5, niva: 'full' },
  { id: '29', kort: 'Tor', nr: 29, rubrik: 'Torsdag 29 oktober', bokade: 2, niva: 'lag' },
  { id: '30', kort: 'Fre', nr: 30, rubrik: 'Fredag 30 oktober', bokade: 0, niva: 'tom' },
  { id: '31', kort: 'Lör', nr: 31, rubrik: 'Lördag 31 oktober', bokade: 0, niva: 'ledig' },
  { id: '1', kort: 'Sön', nr: 1, rubrik: 'Söndag 1 november', bokade: 0, niva: 'ledig' },
]

interface SBesok extends ExBesok { dag: string; fran: number; till: number; tidSlut: string }
const b = (dag: string, id: string, tid: string, tidSlut: string, fran: number, till: number, kund: string, typ: BesokTyp, beskr: string, adress: string, nr: string, status = 'Bokad'): SBesok =>
  ({ dag, id, tid, slut: tidSlut, tidSlut, fran, till, kund, typ, beskr, adress, ort: '', nr, status, telefon: '070-123 45 67' })

const BESOK: SBesok[] = [
  b('26', 'm1', '08:00', '09:30', 8, 9.5, 'Familjen Exempel', 'private', 'Privat, råttor', 'Exempelvägen 4, Södertälje', 'BE-0001234'),
  b('26', 'm2', '10:30', '12:00', 10.5, 12, 'Exempel AB', 'inspection', 'Kontrollbesök', 'Industrivägen 12, Södertälje', 'BE-0001190'),
  b('26', 'm3', '13:00', '15:00', 13, 15, 'Brf Exempelgården', 'establishment', 'Etablering', 'Gårdsvägen 3, Nykvarn', 'BE-0001301'),
  b('27', 't1', '08:00', '09:00', 8, 9, 'Brf Exempelgården', 'inspection', 'Kontrollbesök', 'Gårdsvägen 3, Nykvarn', 'BE-0001302'),
  b('27', 't2', '10:00', '11:00', 10, 11, 'Familjen Exempel', 'private', 'Privat, råttor', 'Exempelvägen 4, Södertälje', 'BE-0001234', 'Återbesök'),
  b('28', 'o1', '08:00', '10:30', 8, 10.5, 'Exempel AB', 'routine', 'Rutinbesök', 'Industrivägen 12, Södertälje', 'BE-0001311'),
  b('28', 'o2', '11:00', '13:30', 11, 13.5, 'Brf Exempelgården', 'contract_extra', 'Extrabesök', 'Gårdsvägen 3, Nykvarn', 'BE-0001315'),
  b('28', 'o3', '13:30', '16:00', 13.5, 16, 'Familjen Exempel', 'private', 'Privat, möss', 'Exempelvägen 4, Södertälje', 'BE-0001320'),
  b('29', 'r1', '09:00', '11:00', 9, 11, 'Brf Exempelgården', 'inspection', 'Kontrollbesök', 'Gårdsvägen 3, Nykvarn', 'BE-0001330'),
]
const paDag = (dag: string) => BESOK.filter(x => x.dag === dag)
const tim = (h: number) => String(h).replace('.', ',')
const TYP_NAMN: Partial<Record<BesokTyp, string>> = { private: 'Privat', inspection: 'Kontrollbesök', establishment: 'Etablering', routine: 'Rutinbesök', contract_extra: 'Extrabesök' }

// ─── Delar ─────────────────────────────────────────

type Lage = 'dag' | 'vecka' | 'manad'

function VyVal({ lage, mk, tryck }: { lage: Lage; mk: Mk; tryck?: Tryck }) {
  const val: { id: Lage; text: string; ikon: IconName }[] = [
    { id: 'dag', text: 'Dag', ikon: 'falt.idag' }, { id: 'vecka', text: 'Vecka', ikon: 'falt.vecka' }, { id: 'manad', text: 'Månad', ikon: 'falt.manad' },
  ]
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-slate-800 p-0.5">
      {val.map(v => (
        <Markor key={v.id} markor={mk(`vy:${v.id}`)} block>
          <button type="button" onClick={() => tryck?.(`vy:${v.id}`)}
            className={`flex h-7 w-full items-center justify-center gap-1 rounded-md px-1.5 text-[11px] ${lage === v.id ? 'border border-slate-600 bg-slate-900 font-semibold text-white' : 'border border-transparent text-slate-300'}`}>
            <Icon name={v.ikon} size={16} className="h-3.5 w-3.5" />{v.text}
          </button>
        </Markor>
      ))}
    </div>
  )
}

function SokFalt({ text, mk, tryck, bred = false }: { text?: string; mk: Mk; tryck?: Tryck; bred?: boolean }) {
  return (
    <Markor markor={mk('sok')} block>
      <button type="button" onClick={() => tryck?.('sok')}
        className={`flex h-8 ${bred ? 'w-full' : 'w-full'} items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-left text-[11px] ${text ? 'text-white' : 'text-slate-500'}`}>
        <Icon name="allman.sok" size={16} className="h-3.5 w-3.5 flex-none text-slate-500" />
        <span className="truncate">{text || 'Sök kund, adress eller ärendenummer'}</span>
      </button>
    </Markor>
  )
}

function IkonRuta({ ikon, etikett, id, mk, tryck }: { ikon: IconName; etikett: string; id: string; mk: Mk; tryck?: Tryck }) {
  return (
    <Markor markor={mk(id)}>
      <button type="button" onClick={() => tryck?.(id)} aria-label={etikett} title={etikett}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300">
        <Icon name={ikon} size={16} />
      </button>
    </Markor>
  )
}

function Remsa({ vald, mk, tryck }: { vald: string; mk: Mk; tryck?: Tryck }) {
  const d = VECKA.find(x => x.id === vald) ?? VECKA[0]
  const vilken = d.id === '26' ? 'idag' : d.rubrik.toLowerCase()
  const lucka = d.id === '26' ? ' Plats kvar mellan 09:30 och 10:30.' : d.id === '27' ? ' Plats kvar mellan 09:00 och 10:00.' : d.id === '29' ? ' Plats kvar mellan 08:00 och 09:00.' : d.niva === 'full' ? ' Dagen är full.' : ''
  return (
    <section className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <Icon name="allman.chevron-vanster" size={16} className="text-slate-400" />
        <p className="flex-1 text-center text-[11.5px] font-semibold text-white">Vecka 44, 26 okt till 1 nov</p>
        <Icon name="allman.chevron" size={16} className="text-slate-400" />
        <span className="flex h-7 items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-1.5 text-[10.5px] font-semibold text-white"><Icon name="falt.idag" size={16} className="h-3 w-3" />Idag</span>
      </div>
      <ol className="grid grid-cols-7 gap-0.5">
        {VECKA.map(x => {
          const arVald = x.id === vald
          const ledig = x.niva === 'ledig'
          return (
            <li key={x.id}>
              <Markor markor={mk(`remsa:${x.id}`)} block>
                <button type="button" onClick={() => tryck?.(`remsa:${x.id}`)}
                  className={`flex min-h-[50px] w-full flex-col items-center justify-center rounded-lg border ${arVald ? 'border-[#20c58f] bg-[#20c58f] text-[#04281c]' : ledig ? 'border-dashed border-slate-600 text-slate-400' : x.id === '26' ? 'border-[#20c58f]/60 bg-slate-900 text-white' : 'border-slate-700/60 bg-slate-900 text-white'}`}>
                  <span className={`text-[9.5px] ${arVald ? 'font-semibold' : 'text-slate-400'}`}>{x.id === '26' ? 'Idag' : x.kort}</span>
                  <span className="text-[12.5px] font-bold">{x.nr}</span>
                  {ledig
                    ? <span className="text-[8.5px]">Ledig</span>
                    : <span className="flex items-center gap-0.5 text-[9.5px]">{x.niva !== 'tom' && <span className={`h-1.5 w-1.5 rounded-full ${arVald ? 'bg-[#04281c]' : PUNKTFARG[NIVA[x.niva].ton]}`} />}{paDag(x.id).length}</span>}
                </button>
              </Markor>
            </li>
          )
        })}
      </ol>
      <p className="flex items-start gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 px-2 py-1.5 text-[10.5px] text-slate-300">
        <span className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${PUNKTFARG[NIVA[d.niva].ton]}`} />
        <span><strong className="text-white">{tim(d.bokade)} av 8 timmar bokade {vilken}.</strong>{lucka}</span>
      </p>
    </section>
  )
}

/** Dagen som tidslinje. Telefon: valt besök fälls ut. Mål: besok:<id> och knapparna med prefix valt- */
function Tidslinje({ dag, vald, mk, tryck, fallUt }: { dag: string; vald: string | null; mk: Mk; tryck?: Tryck; fallUt: boolean }) {
  const d = VECKA.find(x => x.id === dag) ?? VECKA[0]
  const lista = paDag(dag)
  const rader: ReactNode[] = []
  lista.forEach((x, i) => {
    const forra = lista[i - 1]
    if (forra && x.fran - forra.till >= 0.5) {
      rader.push(
        <li key={`l${x.id}`} className="grid grid-cols-[34px_1fr] gap-1.5">
          <span className="pt-1.5 font-mono text-[10px] text-slate-500">{forra.tidSlut}</span>
          <div className="rounded-lg border border-dashed border-slate-500 px-2 py-1.5 text-slate-300">
            <span className="block text-[11px] font-semibold text-white">Ledigt {forra.tidSlut} till {x.tid}</span>
            <span className="text-[10px] text-slate-400">{tim(x.fran - forra.till)} tim utan besök</span>
          </div>
        </li>,
      )
    }
    if (forra) {
      rader.push(
        <li key={`k${x.id}`} className="grid grid-cols-[34px_1fr] gap-1.5">
          <span aria-hidden />
          <p className="flex items-center gap-1 border-l-2 border-dashed border-slate-600 py-0.5 pl-2 text-[10px] text-slate-400"><Icon name="falt.bil" size={16} className="h-3 w-3" />14 min körning</p>
        </li>,
      )
    }
    const arVald = vald === x.id
    rader.push(
      <li key={x.id} className="grid grid-cols-[34px_1fr] gap-1.5">
        <span className="flex flex-col pt-1"><span className="font-mono text-[11.5px] font-bold text-white">{x.tid}</span><span className="font-mono text-[9.5px] text-slate-500">{x.tidSlut}</span></span>
        {arVald && fallUt ? (
          <article className="grid gap-1.5 rounded-lg border-2 border-[#20c58f] bg-slate-900 p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 text-[10.5px] text-slate-300"><Icon name={TYP_IKON[x.typ]} size={16} className="h-3 w-3" />{TYP_NAMN[x.typ]}</span>
              <Punkt ton="bla">{x.status}</Punkt>
            </div>
            <div><p className="text-[12.5px] font-semibold text-white">{x.kund}</p><p className="text-[10.5px] text-slate-400">{x.adress}</p></div>
            <p className="font-mono text-[9.5px] text-slate-400">{x.nr}</p>
            <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-1">
              {([['navigera', 'Navigera', 'falt.navigera'], ['ring', 'Ring', 'kontakt.telefon'], ['oppna', 'Öppna', 'arende.arende']] as const).map(([id, t, ik], j) => (
                <Markor key={id} markor={mk(`valt-${id}`)} block>
                  <button type="button" onClick={() => tryck?.(`valt-${id}`)} className={`flex h-7 w-full items-center justify-center gap-1 rounded-lg text-[10.5px] font-semibold ${j === 0 ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 text-white'}`}>
                    <Icon name={ik} size={16} className="h-3 w-3" />{t}
                  </button>
                </Markor>
              ))}
            </div>
          </article>
        ) : (
          <Mal id={`besok:${x.id}`} mk={mk} tryck={tryck} className={`grid gap-0.5 rounded-lg border px-2 py-1.5 ${arVald ? 'border-2 border-[#20c58f] bg-slate-900' : 'border-slate-700/60 bg-slate-900'}`}>
            <span className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 text-[10.5px] text-slate-300"><Icon name={TYP_IKON[x.typ]} size={16} className="h-3 w-3" />{TYP_NAMN[x.typ]}</span>
              <Punkt ton="bla">{x.status}</Punkt>
            </span>
            <span className="text-[12px] font-semibold text-white">{x.kund}</span>
          </Mal>
        )}
      </li>,
    )
  })
  return (
    <section className="grid gap-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Icon name="falt.idag" size={16} className="h-3.5 w-3.5 text-slate-400" />{d.rubrik}<span className="text-[10.5px] font-medium text-slate-400">08:00 till 16:00</span></p>
      <ol className="grid gap-1">{rader}</ol>
    </section>
  )
}

function Manad({ mk, tryck, liten = false }: { mk: Mk; tryck?: Tryck; liten?: boolean }) {
  // Oktober 2026: torsdag 1 oktober, veckorna måndag 28 september till söndag 1 november
  const dagar: { nr: number; id: string; utanfor: boolean }[] = []
  for (let d = 28; d <= 30; d++) dagar.push({ nr: d, id: `s${d}`, utanfor: true })
  for (let d = 1; d <= 31; d++) dagar.push({ nr: d, id: String(d), utanfor: false })
  dagar.push({ nr: 1, id: '1', utanfor: true })
  const antal = (id: string) => paDag(id).length
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900">
      <div className="grid grid-cols-7 border-b border-slate-700/60">
        {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(r => <span key={r} className="py-1 text-center text-[9.5px] text-slate-400">{r}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {dagar.map((d, i) => {
          const helg = i % 7 >= 5
          const n = antal(d.id)
          const v = VECKA.find(x => x.id === d.id)
          return (
            <Markor key={d.id + i} markor={mk(`manad:${d.id}`)} block>
              <button type="button" onClick={() => tryck?.(`manad:${d.id}`)}
                className={`flex w-full flex-col items-center gap-0.5 border-l border-t border-slate-700/60 py-1 ${liten ? 'min-h-[28px]' : 'min-h-[42px]'} ${helg ? 'bg-slate-800/50' : ''} ${d.utanfor ? 'opacity-50' : ''}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] ${d.id === '26' ? 'border border-[#20c58f] font-semibold text-white' : 'text-white'}`}>{d.nr}</span>
                {!liten && n > 0 && v && <span className="flex items-center gap-0.5 text-[9.5px] text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${PUNKTFARG[NIVA[v.niva].ton]}`} />{n}</span>}
                {!liten && helg && !d.utanfor && <span className="text-[8.5px] text-slate-500">Ledig</span>}
              </button>
            </Markor>
          )
        })}
      </div>
    </div>
  )
}

/** Veckan som rutnät på datorn. Mål: besok:<id> och dagrubrik:<id> */
function VeckoRutnat({ vald, mk, tryck }: { vald: string | null; mk: Mk; tryck?: Tryck }) {
  const PX = 26
  const top = (h: number) => (h - 8) * PX
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900">
      <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] border-b border-slate-700/60">
        <span />
        {VECKA.map(d => (
          <Markor key={d.id} markor={mk(`dagrubrik:${d.id}`)} block>
            <button type="button" onClick={() => tryck?.(`dagrubrik:${d.id}`)} className={`flex w-full flex-col items-start border-l border-slate-700/60 px-1 py-1 text-left ${d.niva === 'ledig' ? 'bg-slate-800/50' : ''}`}>
              <span className="flex items-baseline gap-1 text-[10.5px] font-semibold text-white">{d.kort} {d.nr}{d.id === '26' && <span className="text-[9px] text-[#20c58f]">Idag</span>}</span>
              {d.niva === 'ledig' ? <span className="text-[9px] text-slate-400">Ledig</span> : (
                <>
                  <span className="text-[9px] text-slate-300">{tim(d.bokade)} av 8 tim bokade</span>
                  <Punkt ton={NIVA[d.niva].ton}>{NIVA[d.niva].text}</Punkt>
                </>
              )}
            </button>
          </Markor>
        ))}
      </div>
      <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))]" style={{ height: 8 * PX }}>
        <div className="relative">
          {[8, 10, 12, 14].map(h => <span key={h} className="absolute right-1 font-mono text-[8.5px] text-slate-500" style={{ top: top(h) }}>{String(h).padStart(2, '0')}</span>)}
        </div>
        {VECKA.map(d => (
          <div key={d.id} className={`relative border-l border-slate-700/60 ${d.niva === 'ledig' ? 'bg-slate-800/50' : ''}`}>
            {paDag(d.id).map(x => (
              <div key={x.id} className="absolute left-0.5 right-0.5" style={{ top: top(x.fran) + 1, height: (x.till - x.fran) * PX - 2 }}>
                <Markor markor={mk(`besok:${x.id}`)} block>
                  <button type="button" onClick={() => tryck?.(`besok:${x.id}`)} style={{ height: (x.till - x.fran) * PX - 2 }}
                    className={`block w-full overflow-hidden rounded-md border px-1 py-0.5 text-left ${vald === x.id ? 'border-[#20c58f] bg-[#20c58f]/15' : 'border-slate-600 bg-slate-800'}`}>
                    <span className="block font-mono text-[8.5px] text-slate-400">{x.tid}</span>
                    <span className="block truncate text-[9.5px] font-semibold text-white">{x.kund}</span>
                  </button>
                </Markor>
              </div>
            ))}
            {d.id === '30' && <div className="absolute inset-x-0.5 rounded-md border border-dashed border-slate-500 p-0.5 text-[8.5px] text-slate-300" style={{ top: 2, height: 8 * PX - 4 }}>Ledigt 08:00 till 16:00</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Valt besök i datorns sidopanel. Mål: oppna-arendet */
function ValtBesok({ besok, mk, tryck }: { besok: SBesok | null; mk: Mk; tryck?: Tryck }) {
  if (!besok) return <p className="rounded-lg border border-slate-700/60 bg-slate-900 p-2 text-[10.5px] text-slate-400">Välj ett besök i schemat för att se det här.</p>
  const d = VECKA.find(x => x.id === besok.dag)
  return (
    <section className="grid gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 p-2">
      <div className="flex items-baseline justify-between gap-1">
        <p className="font-mono text-[12.5px] font-bold text-white">{besok.tid} till {besok.tidSlut}</p>
        <Punkt ton="bla">{besok.status}</Punkt>
      </div>
      <p className="-mt-1 text-[10px] text-slate-400">{d?.rubrik}</p>
      <div>
        <p className="flex items-center gap-1 text-[10px] text-slate-300"><Icon name={TYP_IKON[besok.typ]} size={16} className="h-3 w-3" />{TYP_NAMN[besok.typ]}</p>
        <p className="text-[12px] font-semibold text-white">{besok.kund}</p>
        <p className="text-[10px] text-slate-400">{besok.adress}</p>
      </div>
      <p className="font-mono text-[9.5px] text-slate-400">{besok.nr}</p>
      <Markor markor={mk('oppna-arendet')} block>
        <button type="button" onClick={() => tryck?.('oppna-arendet')} className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#20c58f] text-[11.5px] font-semibold text-[#04281c]">
          <Icon name="arende.arende" size={16} />Öppna ärendet
        </button>
      </Markor>
      <div className="grid grid-cols-2 gap-1">
        <span className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-600 text-[10.5px] font-semibold text-white"><Icon name="falt.navigera" size={16} className="h-3 w-3" />Navigera</span>
        <span className="flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-600 text-[10.5px] font-semibold text-white"><Icon name="kontakt.telefon" size={16} className="h-3 w-3" />Ring</span>
      </div>
    </section>
  )
}

function SokTraffar({ mk, tryck }: { mk: Mk; tryck?: Tryck }) {
  const traffar = BESOK.filter(x => x.kund === 'Brf Exempelgården')
  const dagar = [...new Set(traffar.map(x => x.dag))]
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-white">{traffar.length} träffar <span className="font-normal text-slate-400">för "Exempelgården"</span></p>
        <Mal id="rensa" mk={mk} tryck={tryck} block={false} className="flex h-7 items-center gap-1 rounded-lg border border-slate-600 px-2 text-[10.5px] font-semibold text-white"><Icon name="allman.stang" size={16} className="h-3 w-3" />Rensa</Mal>
      </div>
      {dagar.map(dag => {
        const d = VECKA.find(x => x.id === dag)
        return (
          <div key={dag} className="grid gap-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-300">{d?.rubrik}{dag === '26' ? ', idag' : ''}</p>
              <Mal id={`visadag:${dag}`} mk={mk} tryck={tryck} block={false} className="px-1 text-[10.5px] font-medium text-[#20c58f]">Visa dagen</Mal>
            </div>
            <ul className="overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900">
              {paDag(dag).filter(x => x.kund === 'Brf Exempelgården').map(x => (
                <li key={x.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-9 font-mono text-[11px] font-semibold text-white">{x.tid}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] text-white">{x.kund}</span><span className="block truncate text-[10px] text-slate-400">{x.beskr}, Nykvarn, {x.nr}</span></span>
                  <Punkt ton="bla">{x.status}</Punkt>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

// ─── Skärmen ───────────────────────────────────────

interface Vy {
  sida: 'start' | 'schema'
  lage: Lage
  dag: string
  vald: string | null
  sok?: boolean
  arende?: boolean
}

function Skarm({ vy, markor, tryck }: { vy: Vy; markor?: NyMarkor; tryck: Tryck }) {
  const enhet = useGuideEnhet()
  const mk = markor ? gorMk(markor) : ingenMk
  if (vy.sida === 'start') {
    return enhet === 'dator'
      ? <NySkarm sida="idag" titel="Idag" under={UNDER_IDAG} onRam={tryck} markor={markor}><IdagSida /></NySkarm>
      : <NySkarm sida="mer" titel="Mer" onRam={tryck} markor={markor}><MerSida mk={mk} tryck={tryck} /></NySkarm>
  }
  const valtBesok = BESOK.find(x => x.id === vy.vald) ?? null
  const dagInfo = VECKA.find(x => x.id === vy.dag) ?? VECKA[0]
  const under = vy.lage === 'dag' ? `${dagInfo.rubrik}, ${paDag(vy.dag).length} besök` : vy.lage === 'vecka' ? 'Vecka 44, 9 besök, 16,5 av 40 arbetstimmar bokade' : 'Oktober 2026'
  const over = vy.arende && valtBesok ? <ArendeFramme b={valtBesok} markor={markor} tryck={tryck} /> : undefined

  if (enhet === 'dator') {
    const rubrik = vy.sok ? 'Sökträffar' : vy.lage === 'dag' ? dagInfo.rubrik : vy.lage === 'vecka' ? 'Vecka 44, 26 oktober till 1 november 2026' : 'Oktober 2026'
    return (
      <NySkarm sida="schema" titel="Schema" under={under} onRam={tryck} markor={markor} over={over}>
        <div className="grid grid-cols-[minmax(0,1fr)_170px] items-start gap-2.5">
          <div className="grid min-w-0 gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <IkonRuta ikon="allman.chevron-vanster" etikett="Förra" id="forra" mk={mk} tryck={tryck} />
              <span className="flex h-8 items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-2 text-[10.5px] font-semibold text-white"><Icon name="falt.idag" size={16} className="h-3 w-3" />Idag</span>
              <IkonRuta ikon="allman.chevron" etikett="Nästa" id="nasta-period" mk={mk} tryck={tryck} />
              <p className="mr-auto truncate pl-1 text-[12px] font-semibold text-white">{rubrik}</p>
              <div className="w-[170px]"><VyVal lage={vy.lage} mk={mk} tryck={tryck} /></div>
            </div>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1"><SokFalt text={vy.sok ? 'Exempelgården' : undefined} mk={mk} tryck={tryck} /></div>
              <span className="text-[10px] text-slate-400">Uppdaterad 07:35</span>
              <IkonRuta ikon="allman.aterstall" etikett="Uppdatera" id="uppdatera" mk={mk} tryck={tryck} />
              <IkonRuta ikon="allman.statistik" etikett="Statistik och rapport" id="statistik" mk={mk} tryck={tryck} />
            </div>
            {vy.sok ? <SokTraffar mk={mk} tryck={tryck} />
              : vy.lage === 'vecka' ? <VeckoRutnat vald={vy.vald} mk={mk} tryck={tryck} />
              : vy.lage === 'manad' ? <Manad mk={mk} tryck={tryck} />
              : <Tidslinje dag={vy.dag} vald={vy.vald} mk={mk} tryck={tryck} fallUt={false} />}
          </div>
          <aside className="grid gap-2">
            <ValtBesok besok={valtBesok} mk={mk} tryck={tryck} />
            <section className="grid gap-1 rounded-lg border border-slate-700/60 bg-slate-900 p-1.5">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold text-white"><Icon name="allman.kalender" size={16} className="h-3 w-3 text-slate-400" />Hoppa till datum</p>
              <Manad mk={ingenMk} liten />
            </section>
            <section className="rounded-lg border border-slate-700/60 bg-slate-900 p-1.5">
              <p className="flex items-center gap-1 text-[10.5px] font-semibold text-white"><Icon name="allman.filter" size={16} className="h-3 w-3 text-slate-400" />Visa</p>
              <p className="text-[9.5px] text-slate-400">Typ av besök och status</p>
            </section>
          </aside>
        </div>
      </NySkarm>
    )
  }

  return (
    <NySkarm sida="schema" titel="Schema" under={under} onRam={tryck} markor={markor} over={over}>
      <Rulla><div className="grid gap-2">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1"><SokFalt text={vy.sok ? 'Exempelgården' : undefined} mk={mk} tryck={tryck} /></div>
          <IkonRuta ikon="allman.filter" etikett="Filter, inga filter valda" id="filter" mk={mk} tryck={tryck} />
          <IkonRuta ikon="allman.statistik" etikett="Statistik och rapport" id="statistik" mk={mk} tryck={tryck} />
        </div>
        {vy.sok ? <SokTraffar mk={mk} tryck={tryck} /> : (
          <>
            <VyVal lage={vy.lage} mk={mk} tryck={tryck} />
            {vy.lage === 'dag' && (
              <>
                <Remsa vald={vy.dag} mk={mk} tryck={tryck} />
                <Tidslinje dag={vy.dag} vald={vy.vald} mk={mk} tryck={tryck} fallUt />
              </>
            )}
            {vy.lage === 'manad' && (
              <>
                <p className="text-center text-[11.5px] font-semibold text-white">Oktober 2026</p>
                <Manad mk={mk} tryck={tryck} />
                <p className="text-[10px] text-slate-400">Siffran är antal besök och punkten hur full dagen är. Tryck på en dag för att se den.</p>
              </>
            )}
            {vy.lage === 'vecka' && (
              <div className="grid gap-1.5">
                {VECKA.slice(0, 4).map(d => (
                  <div key={d.id}>
                    <p className="flex items-center justify-between text-[11.5px] font-semibold text-white">{d.rubrik}{d.id === '26' ? ', idag' : ''}<span className="flex flex-col items-end"><Punkt ton={NIVA[d.niva].ton}>{NIVA[d.niva].text}</Punkt><span className="text-[9.5px] font-normal text-slate-400">{tim(d.bokade)} av 8 tim bokade</span></span></p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div></Rulla>
    </NySkarm>
  )
}

// ─── Visningen ─────────────────────────────────────

const STEG_MOBIL: { vy: Vy; mal: string }[] = [
  { vy: { sida: 'start', lage: 'dag', dag: '26', vald: null }, mal: 'nav:Schema' },
  { vy: { sida: 'schema', lage: 'dag', dag: '26', vald: 'm1' }, mal: 'vy:manad' },
  { vy: { sida: 'schema', lage: 'manad', dag: '26', vald: null }, mal: 'manad:27' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't1' }, mal: 'besok:t2' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2' }, mal: 'valt-oppna' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2' }, mal: 'sok' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2', sok: true }, mal: 'visadag:28' },
]

const STEG_DATOR: { vy: Vy; mal: string }[] = [
  { vy: { sida: 'start', lage: 'vecka', dag: '26', vald: null }, mal: 'nav:Schema' },
  { vy: { sida: 'schema', lage: 'vecka', dag: '26', vald: 'm1' }, mal: 'vy:manad' },
  { vy: { sida: 'schema', lage: 'manad', dag: '26', vald: 'm1' }, mal: 'manad:27' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't1' }, mal: 'besok:t2' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2' }, mal: 'oppna-arendet' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2' }, mal: 'sok' },
  { vy: { sida: 'schema', lage: 'dag', dag: '27', vald: 't2', sok: true }, mal: 'visadag:28' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  const lista = enhet === 'dator' ? STEG_DATOR : STEG_MOBIL
  const s = lista[Math.min(steg, lista.length - 1)]
  return <Skarm vy={s.vy} markor={{ pa: true, nr: steg + 1, mal: s.mal }} tryck={m => { if (m === s.mal) onNasta() }} />
}

// ─── Övningen: öppna torsdagens besök hos Brf Exempelgården ───

function Ovning() {
  const enhet = useGuideEnhet()
  const startVy: Vy = enhet === 'dator'
    ? { sida: 'schema', lage: 'vecka', dag: '26', vald: 'm1' }
    : { sida: 'schema', lage: 'dag', dag: '26', vald: 'm1' }
  const [vy, setVy] = useState<Vy>(startVy)
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Schemat är öppet. Brf Exempelgården har ringt om besöket på torsdag. Öppna besöket.' }
  const [svar, setSvar] = useState<OvningSvar>(start)
  const fel = (text: string) => setSvar({ typ: 'fel', titel: 'Inte riktigt', text })

  const tryck = (mal: string) => {
    if (vy.arende) return
    const oppnat = () => {
      setVy({ ...vy, arende: true }); setFramsteg(3)
      setSvar({ typ: 'ok', titel: 'Klart', text: 'Ärendet för torsdagens kontrollbesök hos Brf Exempelgården är öppet, på steget Framme. Krysset tar dig tillbaka till schemat.' })
    }
    // Torsdagen
    if (mal === 'remsa:29' || mal === 'dagrubrik:29' || mal === 'manad:29') {
      setVy({ sida: 'schema', lage: 'dag', dag: '29', vald: 'r1' }); setFramsteg(1)
      setSvar({ typ: 'tips', titel: 'Torsdag 29 oktober', text: enhet === 'dator' ? 'Besöket står under Valt besök till höger. Öppna ärendet därifrån.' : 'Besöket är redan utfällt. Tryck Öppna.' })
      return
    }
    if (mal === 'besok:r1') {
      setVy({ ...vy, vald: 'r1' }); setFramsteg(2)
      setSvar({ typ: 'tips', titel: 'Rätt besök', text: enhet === 'dator' ? 'Besöket visas under Valt besök. Tryck Öppna ärendet.' : 'Tryck Öppna.' })
      return
    }
    if ((mal === 'valt-oppna' || mal === 'oppna-arendet') && vy.vald === 'r1') { oppnat(); return }
    if (mal === 'valt-oppna' || mal === 'oppna-arendet') { fel('Det besöket är inte på torsdag. Välj torsdagen först.'); return }
    if (mal.startsWith('remsa:') || mal.startsWith('dagrubrik:') || mal.startsWith('manad:')) { fel('Det är fel dag. Torsdag är den 29 oktober.'); return }
    if (mal.startsWith('besok:')) { fel(enhet === 'dator' ? 'Det besöket är inte hos Brf Exempelgården på torsdag. Leta i kolumnen Tor 29.' : 'Det besöket ligger inte på torsdag. Tryck på Tor 29 i veckan överst.'); return }
    if (mal === 'vy:manad') { setVy({ ...vy, lage: 'manad' }); setSvar({ typ: 'tips', titel: 'Månad', text: 'Tryck på 29 i månaden för att öppna torsdagen.' }); return }
    if (mal === 'vy:vecka') { fel(enhet === 'dator' ? 'Du står redan på Vecka. Tryck på besöket i kolumnen Tor 29.' : 'Vecka i telefonen visar listan. Det går snabbare att trycka på Tor 29 i veckan överst under Dag.'); return }
    if (mal === 'vy:dag') { setVy({ ...vy, lage: 'dag' }); setSvar({ typ: 'tips', titel: 'Dag', text: 'Välj torsdagen med pilarna eller i kalendern.' }); return }
    fel(enhet === 'dator' ? 'Torsdagen är kolumnen Tor 29 i veckan. Tryck på besöket där.' : 'Tryck på Tor 29 i veckan överst.')
  }
  const borjaOm = () => { setVy(startVy); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
