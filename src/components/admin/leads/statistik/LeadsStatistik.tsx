// src/components/admin/leads/statistik/LeadsStatistik.tsx
// Fliken Statistik på Leads-sidan (etapp 6, ersätter /admin/leadsstatistik). Allt räknas i databasen
// (RPC lead_statistik): admin och koordinator ser alla leads, övriga det de äger, har tipsat om eller
// fått delat med sig. Periodväljare och ägarfilter står i adressen (period, pfran, ptill, sagare).
// Platt statistik i samma stil som kedjan i Leads (Webb) och sidan Marknad: inga KPI-kort, inga piller.
//
// Innehåll: perioden i korthet, pipeline just nu per steg och ägare, vunnen årspremie per månad
// (nytt avtal och utökning), månadstabell, kedjan per källa eller ursprung, tid i steg och ledtid,
// förlustorsaker, hygien per ägare (försenat, saknar nästa steg, kontaktade inom 2 arbetsdagar) och
// tips per tipsare. Kedjan, hygienen och tipsen kan exporteras till CSV.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DateField from '../../../ui/DateField'
import { Icon } from '../../../icons/Icon'
import { LeadService } from '../../../../services/leadService'
import {
  FORLUSTORSAK_ETIKETT,
  STAGE_ETIKETT,
  STAGE_FARG,
  type LeadPerson,
  type LeadStatistik as LeadStatistikData,
  type LeadStatHygien,
} from '../../../../types/leads'
import { Sektion, Tomt } from '../../marknad/MarknadUi'
import { kr, tal } from '../../marknad/marknadFormat'
import { useDiagramFarger } from '../../marknad/useDiagramFarger'
import { andelText, laddaNerCsv } from '../../webLeads/statistik/statistikData'
import { Andelsstapel } from '../../webLeads/statistik/StatistikUi'
import LeadsStatistikKedja from './LeadsStatistikKedja'
import {
  LEAD_PERIODER,
  ROLL_ETIKETT,
  STANDARD_PERIOD,
  dagarText,
  leadPeriodFor,
  manadText,
  type LeadPeriod,
} from './leadsStatistikFormat'

const GILTIGA = new Set<string>(LEAD_PERIODER.map(([v]) => v))
const DATUM = /^\d{4}-\d{2}-\d{2}$/
const FALT = 'h-9 px-3 bg-slate-800 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'

const TH = 'px-2 py-2 font-medium whitespace-nowrap text-right'
const TH_V = 'px-2 py-2 font-medium whitespace-nowrap text-left'
const TD = 'px-2 py-2 text-right tabular-nums whitespace-nowrap'

const nollKlass = (n: number, stark = false) => (n ? (stark ? 'text-white font-medium' : 'text-slate-200') : 'text-slate-600')

function Punkt({ farg }: { farg: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${farg}`} aria-hidden="true" />
}

function ExportKnapp({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
    >
      <Icon name="allman.ladda-ner" size={16} /> Exportera CSV
    </button>
  )
}

/** Platt nyckeltal: etikett över värde, ingen ram. */
function Matt({ etikett, varde, under, dampad }: { etikett: string; varde: ReactNode; under?: ReactNode; dampad?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{etikett}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${dampad ? 'text-slate-500' : 'text-white'}`}>{varde}</dd>
      {under && <dd className="text-xs text-slate-400">{under}</dd>}
    </div>
  )
}

function TipsRuta({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const summa = payload.reduce((s, p) => s + (Number(p.value) || 0), 0)
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-slate-300 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-white">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}</span>
          <span className="ml-auto pl-3 tabular-nums">{kr(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex gap-2 mt-1 pt-1 border-t border-slate-700 text-white">
          <span className="text-slate-300">Totalt</span>
          <span className="ml-auto pl-3 tabular-nums">{kr(summa)}</span>
        </div>
      )}
    </div>
  )
}

/** Andel kontaktade inom 2 arbetsdagar, med målet 90 %. */
function KontaktAndel({ h }: { h: Pick<LeadStatHygien, 'nya_bedomda' | 'nya_inom'> }) {
  if (!h.nya_bedomda) return <span className="text-slate-600">–</span>
  const andel = h.nya_inom / h.nya_bedomda
  const farg = andel >= 0.9 ? 'bg-[#20c58f]' : andel >= 0.7 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <Punkt farg={farg} />
      <span className="text-slate-200">{andelText(h.nya_inom, h.nya_bedomda)}</span>
      <span className="text-slate-500 text-xs">
        {tal(h.nya_inom)} av {tal(h.nya_bedomda)}
      </span>
    </span>
  )
}

export default function LeadsStatistik({ personal }: { personal: LeadPerson[] }) {
  const [params, setParams] = useSearchParams()
  const f = useDiagramFarger()
  const paramPeriod = params.get('period') ?? ''
  const val: LeadPeriod = GILTIGA.has(paramPeriod) ? (paramPeriod as LeadPeriod) : STANDARD_PERIOD
  const agare = params.get('sagare') || ''

  const { fran, till } = useMemo(() => {
    if (val !== 'egen') return leadPeriodFor(val)
    const pf = params.get('pfran') ?? ''
    const pt = params.get('ptill') ?? ''
    return DATUM.test(pf) && DATUM.test(pt) ? { fran: pf, till: pt } : leadPeriodFor(STANDARD_PERIOD)
  }, [val, params])
  const giltig = fran <= till

  const [data, setData] = useState<LeadStatistikData | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [fel, setFel] = useState<string | null>(null)
  const [nyckel, setNyckel] = useState(0)

  useEffect(() => {
    if (!giltig) return
    let aktiv = true
    const t = window.setTimeout(() => {
      setLaddar(true)
      setFel(null)
      LeadService.statistik(fran, till, agare || null)
        .then((d) => {
          if (aktiv) setData(d)
        })
        .catch((e: Error) => {
          if (aktiv) setFel(e.message || 'Statistiken kunde inte hämtas')
        })
        .finally(() => {
          if (aktiv) setLaddar(false)
        })
    }, 200)
    return () => {
      aktiv = false
      window.clearTimeout(t)
    }
  }, [fran, till, agare, giltig, nyckel])

  // Hämta om när fönstret får fokus igen (samma som listan)
  useEffect(() => {
    const fokus = () => setNyckel((n) => n + 1)
    window.addEventListener('focus', fokus)
    return () => window.removeEventListener('focus', fokus)
  }, [])

  const sattParam = (nycklar: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(nycklar)) {
          if (v) p.set(k, v)
          else p.delete(k)
        }
        return p
      },
      { replace: true },
    )

  const valjPeriod = (v: LeadPeriod) =>
    sattParam({
      period: v === STANDARD_PERIOD ? null : v,
      pfran: v === 'egen' ? fran : null,
      ptill: v === 'egen' ? till : null,
    })

  const agarNamn = agare ? personal.find((p) => p.id === agare)?.namn ?? 'okänd' : ''
  const s = data?.summa
  const avslutade = s ? s.vunna + s.forlorade : 0

  const diagramData = useMemo(
    () => (data?.manader ?? []).map((m) => ({ ...m, etikett: manadText(m.manad, (data?.manader.length ?? 0) <= 12 ? false : true) })),
    [data],
  )
  const harPremie = diagramData.some((m) => m.vunnen_nytt || m.vunnen_utokning)
  const pipelineMax = Math.max(1, ...(data?.pipeline_steg ?? []).map((p) => p.antal))
  const forlustSumma = (data?.forlustorsaker ?? []).reduce((a, r) => a + r.antal, 0)
  const hygienSumma = useMemo(
    () =>
      (data?.hygien ?? []).reduce(
        (a, h) => ({
          oppna: a.oppna + h.oppna,
          forsenade: a.forsenade + h.forsenade,
          saknar_nasta: a.saknar_nasta + h.saknar_nasta,
          nya_bedomda: a.nya_bedomda + h.nya_bedomda,
          nya_inom: a.nya_inom + h.nya_inom,
          nya_sena: a.nya_sena + h.nya_sena,
          nya_ej: a.nya_ej + h.nya_ej,
        }),
        { oppna: 0, forsenade: 0, saknar_nasta: 0, nya_bedomda: 0, nya_inom: 0, nya_sena: 0, nya_ej: 0 },
      ),
    [data],
  )
  const pipelineAgareSumma = useMemo(
    () =>
      (data?.pipeline_agare ?? []).reduce(
        (a, r) => ({
          ny: a.ny + r.ny,
          kontaktad: a.kontaktad + r.kontaktad,
          besok_bokat: a.besok_bokat + r.besok_bokat,
          offert_skickad: a.offert_skickad + r.offert_skickad,
          antal: a.antal + r.antal,
          varde: a.varde + Number(r.varde),
        }),
        { ny: 0, kontaktad: 0, besok_bokat: 0, offert_skickad: 0, antal: 0, varde: 0 },
      ),
    [data],
  )

  const exporteraHygien = () => {
    if (!data) return
    laddaNerCsv(
      `leads-hygien-${fran}-${till}.csv`,
      ['Ägare', 'Öppna', 'Försenat nästa steg', 'Saknar nästa steg', 'Nya bedömda', 'Kontaktade inom 2 arbetsdagar', 'Kontaktade senare', 'Ej kontaktade', 'Andel inom 2 arbetsdagar (%)'],
      data.hygien.map((h) => [
        h.namn,
        h.oppna,
        h.forsenade,
        h.saknar_nasta,
        h.nya_bedomda,
        h.nya_inom,
        h.nya_sena,
        h.nya_ej,
        h.nya_bedomda ? Math.round((h.nya_inom / h.nya_bedomda) * 1000) / 10 : '',
      ]),
    )
  }

  const exporteraTips = () => {
    if (!data) return
    laddaNerCsv(
      `leads-tips-${fran}-${till}.csv`,
      ['Tipsare', 'Roll', 'Tips', 'Pågående', 'Vunna', 'Förlorade', 'Vunnen årspremie (kr)'],
      data.tips.map((t) => [t.namn, ROLL_ETIKETT[t.roll ?? ''] ?? t.roll ?? '', t.tips, t.oppna, t.vunna, t.forlorade, Math.round(Number(t.vunnen_premie))]),
    )
  }

  const periodRad = (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div role="tablist" aria-label="Period" className="flex flex-wrap gap-x-4 border-b border-slate-700 text-sm">
        {LEAD_PERIODER.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={val === v}
            onClick={() => valjPeriod(v)}
            className={`pb-2 -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded-t ${
              val === v ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      {val === 'egen' && (
        <div className="flex items-center gap-2">
          <DateField value={fran} onChange={(v) => v && sattParam({ pfran: v })} className="pl-9 w-36" aria-label="Från" />
          <span className="text-slate-500">till</span>
          <DateField value={till} onChange={(v) => v && sattParam({ ptill: v })} className="pl-9 w-36" aria-label="Till" />
        </div>
      )}
      <select
        aria-label="Ägare"
        className={`${FALT} ${agare ? 'border-[#20c58f]/60 text-white' : 'border-slate-700 text-slate-300'}`}
        value={agare}
        onChange={(e) => sattParam({ sagare: e.target.value || null })}
      >
        <option value="">Alla ägare</option>
        {personal.filter((p) => p.aktiv || p.id === agare).map((p) => (
          <option key={p.id} value={p.id}>{p.namn}</option>
        ))}
      </select>
    </div>
  )

  const info = giltig ? (
    <p className="text-xs text-slate-400">
      {fran} till {till}
      {agare && <>, ägare {agarNamn}</>}
      {data?.behorighet === 'egna' && <>. Statistiken gäller de leads du äger, har tipsat om eller fått delade med dig</>}.
    </p>
  ) : (
    <p className="text-xs text-amber-400">Välj ett giltigt datumintervall: från-datumet ska vara före till-datumet.</p>
  )

  if (!data) {
    return (
      <div className="space-y-4">
        {periodRad}
        {info}
        {fel ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{fel}</div>
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Laddar statistik">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 bg-slate-700/30 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {periodRad}
      {info}
      {fel && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{fel}</div>}

      <div className={`space-y-4 transition-opacity ${laddar ? 'opacity-60' : ''}`}>
        {/* Perioden i korthet */}
        <Sektion titel="Perioden i korthet" under="Skapade och tips räknas på skapandedatum, vunna och förlorade på datumet då leaden avslutades">
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
            <Matt etikett="Skapade leads" varde={tal(s!.skapade)} under={s!.tips ? `varav ${tal(s!.tips)} tips` : 'inga tips'} />
            <Matt etikett="Vunna" varde={tal(s!.vunna)} under={`${tal(s!.forlorade)} förlorade`} />
            <Matt
              etikett="Vinstgrad"
              varde={avslutade ? andelText(s!.vunna, avslutade) : '–'}
              dampad={!avslutade}
              under={avslutade ? `av ${tal(avslutade)} avslutade` : 'inga avslutade'}
            />
            <Matt
              etikett="Vunnen årspremie"
              varde={s!.vunnen_premie ? kr(s!.vunnen_premie) : '–'}
              dampad={!s!.vunnen_premie}
              under={s!.vunnen_utokning ? `${kr(s!.vunnen_utokning)} utökning` : 'nya avtal'}
            />
            <Matt
              etikett="Ledtid till vunnen"
              varde={dagarText(s!.ledtid_vunnen_median)}
              dampad={s!.ledtid_vunnen_median == null}
              under={s!.ledtid_vunnen_antal ? `median av ${tal(s!.ledtid_vunnen_antal)}` : 'inga vunna'}
            />
            <Matt etikett="Pipeline just nu" varde={kr(s!.pipeline)} under={`${tal(s!.oppna)} öppna${s!.parkerade ? `, ${tal(s!.parkerade)} parkerade` : ''}`} />
          </dl>
        </Sektion>

        {/* Pipeline */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 min-w-0">
            <Sektion titel="Pipeline per steg" under="Öppna leads just nu och uppskattad årspremie">
              <ul className="space-y-3">
                {data.pipeline_steg.map((p) => (
                  <li key={p.steg} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Punkt farg={STAGE_FARG[p.steg].punkt} />
                      <span className="text-slate-200 flex-1">{STAGE_ETIKETT[p.steg]}</span>
                      <span className={`tabular-nums ${nollKlass(p.antal, true)}`}>{tal(p.antal)}</span>
                      <span className={`w-28 text-right tabular-nums ${p.varde ? 'text-slate-300' : 'text-slate-600'}`}>{p.varde ? kr(p.varde) : '–'}</span>
                    </div>
                    <div className="mt-1 pl-4">
                      <Andelsstapel andel={p.antal / pipelineMax} farg={STAGE_FARG[p.steg].punkt} />
                    </div>
                  </li>
                ))}
              </ul>
            </Sektion>
          </div>
          <div className="xl:col-span-3 min-w-0">
            <Sektion titel="Pipeline per ägare" under="Öppna leads per steg (parkerade räknas inte) och årspremie">
              {data.pipeline_agare.length === 0 ? (
                <Tomt>Inga öppna leads.</Tomt>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-700">
                        <th scope="col" className={TH_V}>Ägare</th>
                        <th scope="col" className={TH}>Ny</th>
                        <th scope="col" className={TH}>Kontaktad</th>
                        <th scope="col" className={TH}>Besök</th>
                        <th scope="col" className={TH}>Offert</th>
                        <th scope="col" className={TH}>Öppna</th>
                        <th scope="col" className={TH}>Årspremie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pipeline_agare.map((r) => (
                        <tr key={r.profile_id ?? 'ingen'} className="border-b border-slate-700/40 hover:bg-slate-700/10">
                          <td className={`px-2 py-2 ${r.profile_id ? 'text-slate-200' : 'text-amber-300'}`}>{r.namn}</td>
                          <td className={`${TD} ${nollKlass(r.ny)}`}>{tal(r.ny)}</td>
                          <td className={`${TD} ${nollKlass(r.kontaktad)}`}>{tal(r.kontaktad)}</td>
                          <td className={`${TD} ${nollKlass(r.besok_bokat)}`}>{tal(r.besok_bokat)}</td>
                          <td className={`${TD} ${nollKlass(r.offert_skickad)}`}>{tal(r.offert_skickad)}</td>
                          <td className={`${TD} ${nollKlass(r.antal, true)}`}>{tal(r.antal)}</td>
                          <td className={`${TD} ${r.varde ? 'text-slate-200' : 'text-slate-600'}`}>{r.varde ? kr(Number(r.varde)) : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-600 bg-slate-900/30">
                        <th scope="row" className="px-2 py-2 text-left font-semibold text-white">Totalt</th>
                        <td className={`${TD} text-white`}>{tal(pipelineAgareSumma.ny)}</td>
                        <td className={`${TD} text-white`}>{tal(pipelineAgareSumma.kontaktad)}</td>
                        <td className={`${TD} text-white`}>{tal(pipelineAgareSumma.besok_bokat)}</td>
                        <td className={`${TD} text-white`}>{tal(pipelineAgareSumma.offert_skickad)}</td>
                        <td className={`${TD} text-white font-medium`}>{tal(pipelineAgareSumma.antal)}</td>
                        <td className={`${TD} text-white`}>{kr(pipelineAgareSumma.varde)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Sektion>
          </div>
        </div>

        {/* Per månad */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3 min-w-0">
            <Sektion titel="Vunnen årspremie per månad" under="Nya avtal och utökning hos befintliga kunder, staplat. Håll över en stapel för beloppen.">
              {harPremie ? (
                <figure className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diagramData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <CartesianGrid vertical={false} stroke={f.rutnat} strokeDasharray="2 4" />
                      <XAxis dataKey="etikett" tick={{ fontSize: 11, fill: f.axel }} tickLine={false} axisLine={{ stroke: f.rutnat }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: f.axel }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => tal(v)} />
                      <Tooltip cursor={{ fill: f.rutnat, opacity: 0.4 }} content={<TipsRuta />} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="vunnen_nytt" name="Nytt avtal" stackId="p" fill={f.serie1} stroke={f.yta} strokeWidth={1} maxBarSize={36} />
                      <Bar dataKey="vunnen_utokning" name="Utökning" stackId="p" fill={f.serie2} stroke={f.yta} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </figure>
              ) : (
                <Tomt>Ingen vunnen årspremie under perioden.</Tomt>
              )}
            </Sektion>
          </div>
          <div className="xl:col-span-2 min-w-0">
            <Sektion titel="Månad för månad" under="Uppföljningen: tips, skapade, vunna och förlorade">
              <div className="overflow-x-auto -mx-1 max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="text-xs text-slate-400 border-b border-slate-700">
                      <th scope="col" className={TH_V}>Månad</th>
                      <th scope="col" className={TH}>Skapade</th>
                      <th scope="col" className={TH}>Tips</th>
                      <th scope="col" className={TH}>Vunna</th>
                      <th scope="col" className={TH}>Förlorade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.manader].reverse().map((m) => (
                      <tr key={m.manad} className="border-b border-slate-700/40">
                        <td className="px-2 py-1.5 text-slate-200 whitespace-nowrap">{manadText(m.manad)}</td>
                        <td className={`${TD} py-1.5 ${nollKlass(m.skapade)}`}>{tal(m.skapade)}</td>
                        <td className={`${TD} py-1.5 ${nollKlass(m.tips)}`}>{tal(m.tips)}</td>
                        <td className={`${TD} py-1.5 ${nollKlass(m.vunna)}`}>{tal(m.vunna)}</td>
                        <td className={`${TD} py-1.5 ${nollKlass(m.forlorade)}`}>{tal(m.forlorade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sektion>
          </div>
        </div>

        {/* Kedjan */}
        <Sektion titel="Från lead till affär" under="Hela kedjan per källa eller per ursprung. Exportera till CSV för vidare analys.">
          <LeadsStatistikKedja kalla={data.kedja_kalla} ursprung={data.kedja_ursprung} fran={fran} till={till} />
        </Sektion>

        {/* Tid i steg och förlustorsaker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Sektion titel="Tid i steg" under="Hur länge leads låg i varje steg innan de flyttades, för stegbyten under perioden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th scope="col" className={TH_V}>Steg</th>
                  <th scope="col" className={TH}>Byten</th>
                  <th scope="col" className={TH}>Median</th>
                  <th scope="col" className={TH}>75 %</th>
                </tr>
              </thead>
              <tbody>
                {data.tid_i_steg.map((t) => (
                  <tr key={t.steg} className="border-b border-slate-700/40">
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2 text-slate-200">
                        <Punkt farg={STAGE_FARG[t.steg].punkt} />
                        {STAGE_ETIKETT[t.steg]}
                      </span>
                    </td>
                    <td className={`${TD} ${nollKlass(t.antal)}`}>{tal(t.antal)}</td>
                    <td className={`${TD} ${t.median_dagar == null ? 'text-slate-600' : 'text-white font-medium'}`}>{dagarText(t.median_dagar)}</td>
                    <td className={`${TD} ${t.p75_dagar == null ? 'text-slate-600' : 'text-slate-300'}`}>{dagarText(t.p75_dagar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600">
                  <th scope="row" className="px-2 py-2 text-left font-semibold text-white">Ledtid till vunnen</th>
                  <td className={`${TD} text-slate-300`}>{tal(s!.ledtid_vunnen_antal)}</td>
                  <td className={`${TD} text-white font-medium`}>{dagarText(s!.ledtid_vunnen_median)}</td>
                  <td className={TD} />
                </tr>
              </tfoot>
            </table>
            <p className="text-xs text-slate-500 mt-3">Dagar i kalendertid. Ledtiden räknas från att leaden skapades till att den vanns.</p>
          </Sektion>

          <Sektion titel="Förlustorsaker" under="Leads som förlorades under perioden">
            {forlustSumma === 0 ? (
              <Tomt>Inga förlorade leads under perioden.</Tomt>
            ) : (
              <ul className="space-y-3">
                {data.forlustorsaker.map((r) => (
                  <li key={r.orsak} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200 flex-1">{FORLUSTORSAK_ETIKETT[r.orsak] ?? r.orsak}</span>
                      <span className="tabular-nums text-white font-medium">{tal(r.antal)}</span>
                      <span className="w-12 text-right tabular-nums text-slate-400 text-xs">{andelText(r.antal, forlustSumma)}</span>
                    </div>
                    <div className="mt-1">
                      <Andelsstapel andel={r.antal / forlustSumma} farg="bg-slate-400" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Sektion>
        </div>

        {/* Hygien */}
        <Sektion
          titel="Hygien per ägare"
          under="Öppna leads just nu, och hur snabbt nya leads under perioden kontaktades. Mål: minst 90 % inom 2 arbetsdagar, under 10 % försenade."
          hoger={<ExportKnapp onClick={exporteraHygien} disabled={!data.hygien.length} />}
        >
          {data.hygien.length === 0 ? (
            <Tomt>Inga öppna eller nya leads.</Tomt>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th scope="col" className={TH_V}>Ägare</th>
                    <th scope="col" className={TH}>Öppna</th>
                    <th scope="col" className={TH}>Försenat nästa steg</th>
                    <th scope="col" className={TH}>Saknar nästa steg</th>
                    <th scope="col" className={TH}>Kontaktade inom 2 arbetsdagar</th>
                    <th scope="col" className={TH}>Senare</th>
                    <th scope="col" className={TH}>Ej kontaktade</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.hygien, null].map((h) => {
                    const r = h ?? { ...hygienSumma, namn: 'Totalt', profile_id: 'totalt' }
                    const fot = h === null
                    const forsenadAndel = r.oppna ? r.forsenade / r.oppna : 0
                    return (
                      <tr
                        key={r.profile_id ?? 'ingen'}
                        className={fot ? 'border-t border-slate-600 bg-slate-900/30' : 'border-b border-slate-700/40 hover:bg-slate-700/10'}
                      >
                        <td className={`px-2 py-2 ${fot ? 'font-semibold text-white' : r.profile_id ? 'text-slate-200' : 'text-amber-300'}`}>{r.namn}</td>
                        <td className={`${TD} ${nollKlass(r.oppna, true)}`}>{tal(r.oppna)}</td>
                        <td className={TD}>
                          {r.forsenade ? (
                            <span className="inline-flex items-center gap-1.5 justify-end">
                              <Punkt farg={forsenadAndel < 0.1 ? 'bg-[#20c58f]' : 'bg-red-400'} />
                              <span className="text-slate-200">{tal(r.forsenade)}</span>
                              <span className="text-slate-500 text-xs">{andelText(r.forsenade, r.oppna)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={`${TD} ${r.saknar_nasta ? 'text-amber-300' : 'text-slate-600'}`}>{tal(r.saknar_nasta)}</td>
                        <td className={TD}>
                          <KontaktAndel h={r} />
                        </td>
                        <td className={`${TD} ${nollKlass(r.nya_sena)}`}>{tal(r.nya_sena)}</td>
                        <td className={`${TD} ${r.nya_ej ? 'text-red-300' : 'text-slate-600'}`}>{tal(r.nya_ej)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Kontakt räknas när ett samtal, mejl eller möte loggas eller när leaden flyttas från Ny. Två arbetsdagar räknas måndag till fredag
            (helgdagar räknas inte bort). Nya leads vars frist inte gått ut räknas inte förrän de kontaktats. Leads utan känd kontakttidpunkt
            (flyttade från det gamla systemet) räknas inte.
          </p>
        </Sektion>

        {/* Tips */}
        <Sektion
          titel="Tips per tipsare"
          under="Tips som skapades under perioden och hur de har gått"
          hoger={<ExportKnapp onClick={exporteraTips} disabled={!data.tips.length} />}
        >
          {data.tips.length === 0 ? (
            <Tomt>Inga tips under perioden.</Tomt>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th scope="col" className={TH_V}>Tipsare</th>
                    <th scope="col" className={TH}>Tips</th>
                    <th scope="col" className={TH}>Pågående</th>
                    <th scope="col" className={TH}>Vunna</th>
                    <th scope="col" className={TH}>Förlorade</th>
                    <th scope="col" className={TH}>Vunnen årspremie</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tips.map((t) => (
                    <tr key={t.profile_id} className="border-b border-slate-700/40 hover:bg-slate-700/10">
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-2 text-slate-200">
                          <Icon name="lead.tips" size={16} className="text-slate-400" />
                          {t.namn}
                          {t.roll && <span className="text-xs text-slate-500">{ROLL_ETIKETT[t.roll] ?? t.roll}</span>}
                        </span>
                      </td>
                      <td className={`${TD} ${nollKlass(t.tips, true)}`}>{tal(t.tips)}</td>
                      <td className={`${TD} ${nollKlass(t.oppna)}`}>{tal(t.oppna)}</td>
                      <td className={`${TD} ${t.vunna ? 'text-[#20c58f] font-medium' : 'text-slate-600'}`}>{tal(t.vunna)}</td>
                      <td className={`${TD} ${nollKlass(t.forlorade)}`}>{tal(t.forlorade)}</td>
                      <td className={`${TD} ${t.vunnen_premie ? 'text-slate-200' : 'text-slate-600'}`}>{t.vunnen_premie ? kr(Number(t.vunnen_premie)) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sektion>

        <p className="text-xs text-slate-500">
          Årspremien är den uppskattade årspremien på leaden. För vunna leads används avtalets årspremie när leaden är kopplad till ett
          signerat avtal med årsvärde. Vinstgraden är vunna av avslutade (vunna och förlorade) under perioden. Pipeline och hygien visar
          läget just nu oavsett period. Allt i svensk tid.
        </p>
      </div>
    </div>
  )
}
