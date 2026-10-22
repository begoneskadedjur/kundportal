// src/components/technician/ny/schema/DagTidslinje.tsx
// En dag som tidslinje: besöken i tidsordning med körtid mellan, lediga stunder
// ("Ledigt 10:30 till 13:00") och frånvaro. I telefonen fälls valt besök ut med
// Navigera, Ring och Öppna. På datorn markeras det och visas i sidopanelen.

import type { ReactNode } from 'react'
import { Icon } from '../../../icons/Icon'
import { BesokKnappar, StatusPunkt } from '../besokUi'
import { TYP_IKON } from '../besokTyp'
import type { WorkSchedule } from '../../../../types/database'
import type { Restid } from '../../../../services/restidService'
import { TYP_ETIKETT, klockslag, ortUrAdress, type DagBesok } from '../../../../services/teknikerDagService'
import {
  arbetstid, dagRubrik, franvaroForDag, kollegor, luckor, schemaStatus, varaktighet, visaStationer, type Franvaro,
} from './schemaLogik'
import { ArbetsTid } from './SchemaDelar'
import { kortidText } from './useKortid'

interface Props {
  dag: string
  idag: string
  nu: Date
  /** Besöken som syns med filtret, i tidsordning */
  besok: DagBesok[]
  /** Alla dagens besök, för luckorna */
  alla: DagBesok[]
  ws: WorkSchedule | null
  franvaro: Franvaro[]
  valdNyckel: string | null
  nastaNyckel: string | null
  onValj: (nyckel: string) => void
  onOppna: (b: DagBesok) => void
  kortid: Map<string, Restid | null>
  /** Körtid från bilen eller telefonen till dagens första besök */
  forstaRad?: ReactNode
  stationer: Map<string, number>
  minId: string | null
  /** Telefon: valt besök fälls ut i listan. Dator: valt besök visas i sidopanelen. */
  fallUtVald: boolean
}

type Rad =
  | { slag: 'besok'; t: number; b: DagBesok }
  | { slag: 'lucka'; t: number; start: Date; slut: Date }
  | { slag: 'franvaro'; t: number; start: Date; slut: Date; orsak: string | null }

/** "Solna, 18 stationer, arbetat 52 min" */
function Underrad({ b, antal }: { b: DagBesok; antal?: number }) {
  const delar: ReactNode[] = []
  const ort = ortUrAdress(b.adress)
  if (ort) delar.push(ort)
  if (visaStationer(b) && antal) delar.push(`${antal} stationer`)
  if ((b.typ === 'private' || b.typ === 'business') && b.skadedjur) delar.push(b.skadedjur.toLowerCase())
  const tid = <ArbetsTid key="tid" b={b} />
  if (b.arbeteStartat || b.arbetadeMinuter > 0) delar.push(tid)
  if (delar.length === 0) return null
  return (
    <span className="text-[13px] text-slate-400">
      {delar.map((d, i) => <span key={i}>{i > 0 && ', '}{d}</span>)}
    </span>
  )
}

function TidKolumn({ b, svag }: { b: DagBesok; svag: boolean }) {
  return (
    <span className="flex flex-col pt-3">
      <span className={`font-mono text-[15px] font-bold ${svag ? 'text-slate-400' : 'text-white'}`}>{klockslag(b.start) || '--:--'}</span>
      {b.slut && <span className="font-mono text-xs text-slate-500">{klockslag(b.slut)}</span>}
    </span>
  )
}

export function DagTidslinje(p: Props) {
  const at = arbetstid(p.dag, p.ws)
  const fv = franvaroForDag(p.dag, p.franvaro, p.ws)
  const passerad = p.dag < p.idag

  const rader: Rad[] = p.besok.map(b => ({ slag: 'besok' as const, t: b.start?.getTime() ?? Number.MAX_SAFE_INTEGER, b }))
  if (!passerad) {
    for (const l of luckor(p.dag, p.alla, p.ws, p.franvaro)) {
      if (p.dag === p.idag && l.slut <= p.nu) continue
      rader.push({ slag: 'lucka', t: l.start.getTime(), start: l.start, slut: l.slut })
    }
  }
  if (!fv.heldag) {
    for (const f of fv.block) rader.push({ slag: 'franvaro', t: f.start.getTime(), start: f.start, slut: f.slut, orsak: f.orsak })
  }
  // Vid samma starttid kommer frånvaro och lucka före besöket
  const ordning = { franvaro: 0, lucka: 1, besok: 2 }
  rader.sort((a, b) => a.t - b.t || ordning[a.slag] - ordning[b.slag])

  let forstaBesok = true

  return (
    <section aria-labelledby={`dag-${p.dag}`} className="space-y-2">
      <h2 id={`dag-${p.dag}`} className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name="falt.idag" size={20} className="text-slate-400" />
        <span className="flex-1">{dagRubrik(p.dag)}{p.dag === p.idag ? ', idag' : ''}</span>
        <span className="text-[13px] font-medium text-slate-400">
          {at ? `${at.startText} till ${at.slutText}` : 'Ledig dag'}
        </span>
      </h2>

      {fv.heldag && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border border-slate-700 bg-[repeating-linear-gradient(135deg,var(--color-slate-800)_0,var(--color-slate-800)_6px,var(--color-slate-700)_6px,var(--color-slate-700)_7px)] text-slate-300">
          <Icon name="allman.kalender" size={20} />
          <span className="text-sm font-semibold">Frånvaro hela dagen{fv.block[0]?.orsak ? `, ${fv.block[0].orsak.toLowerCase()}` : ''}</span>
        </div>
      )}

      {p.besok.length === 0 && (
        <p className="px-3.5 py-4 rounded-2xl border border-dashed border-slate-700 text-sm text-slate-400">
          {at ? 'Inga besök den här dagen.' : 'Ledig dag enligt ditt arbetsschema. Inga besök.'}
        </p>
      )}

      <ol className="space-y-1.5">
        {rader.map(r => {
          if (r.slag === 'lucka') {
            const min = (r.slut.getTime() - r.start.getTime()) / 60_000
            return (
              <li key={`l${r.t}`} className="grid grid-cols-[48px_1fr] gap-2.5">
                <span className="pt-3 font-mono text-[13px] text-slate-500">{klockslag(r.start)}</span>
                <div className="px-3.5 py-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-slate-500 text-slate-300">
                  <Icon name="allman.klocka" size={20} className="flex-shrink-0" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-white">Ledigt {klockslag(r.start)} till {klockslag(r.slut)}</span>
                    <span className="text-[13px] text-slate-400">{varaktighet(min)} utan besök</span>
                  </span>
                </div>
              </li>
            )
          }
          if (r.slag === 'franvaro') {
            return (
              <li key={`f${r.t}`} className="grid grid-cols-[48px_1fr] gap-2.5">
                <span className="pt-3 font-mono text-[13px] text-slate-500">{klockslag(r.start)}</span>
                <div className="px-3.5 py-3 flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-[repeating-linear-gradient(135deg,var(--color-slate-800)_0,var(--color-slate-800)_6px,var(--color-slate-700)_6px,var(--color-slate-700)_7px)] text-slate-300">
                  <Icon name="allman.kalender" size={20} className="flex-shrink-0" />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">Frånvaro {klockslag(r.start)} till {klockslag(r.slut)}</span>
                    {r.orsak && <span className="text-[13px] text-slate-400">{r.orsak}</span>}
                  </span>
                </div>
              </li>
            )
          }

          const b = r.b
          const forsta = forstaBesok
          forstaBesok = false
          const kortid = p.kortid.get(b.nyckel)
          const vald = p.valdNyckel === b.nyckel
          const arNasta = p.nastaNyckel === b.nyckel
          const st = schemaStatus(b, p.idag)
          const statusText = arNasta && !b.avslutad ? `${st.text}, nästa` : st.text
          const antal = b.customerId ? p.stationer.get(b.customerId) : undefined
          const med = kollegor(b, p.minId)
          const korRad = forsta ? p.forstaRad : kortid ? (
            <p className="min-h-[36px] flex items-center gap-2 pl-3.5 border-l-2 border-dashed border-slate-600 text-[13px] text-slate-400">
              <Icon name="falt.bil" size={16} />
              {kortidText(kortid)}
            </p>
          ) : null

          return [
            korRad && (
              <li key={`k${b.nyckel}`} className="grid grid-cols-[48px_1fr] gap-2.5">
                <span aria-hidden="true" />
                <div>{korRad}</div>
              </li>
            ),
            <li key={b.nyckel} className="grid grid-cols-[48px_1fr] gap-2.5">
              <TidKolumn b={b} svag={b.avslutad} />
              {vald && p.fallUtVald ? (
                <article aria-labelledby={`valt-${b.id}`} className="p-3.5 space-y-2.5 rounded-2xl border-2 border-[#20c58f] bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
                      <Icon name={TYP_IKON[b.typ]} size={16} />
                      {TYP_ETIKETT[b.typ]}
                    </span>
                    <StatusPunkt ton={st.ton}>{statusText}</StatusPunkt>
                  </div>
                  <div>
                    <h3 id={`valt-${b.id}`} className="text-[17px] font-semibold text-white">{b.kund}</h3>
                    <p className="text-sm text-slate-400">{b.adress || 'Adress saknas i ärendet'}</p>
                  </div>
                  <ul className="space-y-1.5 text-[13px] text-slate-300">
                    {visaStationer(b) && !!antal && (
                      <li className="flex items-center gap-2">
                        <Icon name="arende.station" size={16} className="text-slate-400" />
                        {antal} stationer{b.typ === 'inspection' ? ' att kontrollera' : ''}
                      </li>
                    )}
                    {(b.typ === 'private' || b.typ === 'business') && b.skadedjur && (
                      <li className="flex items-center gap-2">
                        <Icon name="arende.arende" size={16} className="text-slate-400" />
                        {b.skadedjur}
                      </li>
                    )}
                    {b.kontaktperson && (
                      <li className="flex items-center gap-2">
                        <Icon name="rapport.person" size={16} className="text-slate-400" />
                        {b.kontaktperson}, kontaktperson
                      </li>
                    )}
                    {med.length > 0 && (
                      <li className="flex items-center gap-2">
                        <Icon name="bokning.team" size={16} className="text-slate-400" />
                        Med {med.join(' och ')}
                      </li>
                    )}
                    {(b.arbeteStartat || b.arbetadeMinuter > 0) && (
                      <li className="flex items-center gap-2">
                        <Icon name="allman.klocka" size={16} className="text-slate-400" />
                        <ArbetsTid b={b} />
                      </li>
                    )}
                  </ul>
                  {b.arendenummer && <p className="font-mono text-xs text-slate-400">{b.arendenummer}</p>}
                  <BesokKnappar besok={b} onOppna={() => p.onOppna(b)} />
                </article>
              ) : (
                <button
                  type="button"
                  aria-expanded={p.fallUtVald ? false : undefined}
                  aria-pressed={p.fallUtVald ? undefined : vald}
                  onClick={() => p.onValj(b.nyckel)}
                  className={`w-full text-left px-3.5 py-3 flex flex-col gap-1 rounded-2xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                    vald ? 'border-2 border-[#20c58f] bg-slate-900' : b.avslutad ? 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-700/60 bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1.5 text-[13px] font-medium ${b.avslutad ? 'text-slate-400' : 'text-slate-300'}`}>
                      <Icon name={TYP_IKON[b.typ]} size={16} />
                      {TYP_ETIKETT[b.typ]}
                    </span>
                    <StatusPunkt ton={st.ton}>{statusText}</StatusPunkt>
                  </span>
                  <span className={`text-[15px] font-semibold ${b.avslutad ? 'text-slate-300' : 'text-white'}`}>{b.kund}</span>
                  <Underrad b={b} antal={antal} />
                  {med.length > 0 && (
                    <span className="flex items-center gap-1.5 text-[13px] text-slate-400">
                      <Icon name="bokning.team" size={16} />
                      Med {med.join(' och ')}
                    </span>
                  )}
                </button>
              )}
            </li>,
          ]
        })}
      </ol>
    </section>
  )
}

export default DagTidslinje
