// src/components/organisation/MultisiteEgenkontrollView.tsx
// Egenkontroll-redovisning för regionalkundens portal — löpande historik.
// Region → kontrolltillfälle (tidslinje, senaste först) → station → svar.
// Avvikelser framhävs överst. Alla 6 svarstyper renderas pedagogiskt.

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle,
  Calendar, MapPin, User, AlertTriangle, Star,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  EgenkontrollService,
  type EgenkontrollQuestion,
  type EgenkontrollStationReview,
} from '../../services/egenkontrollService'
import { formatDistanceToNow } from '../../utils/dateUtils'
import LoadingSpinner from '../shared/LoadingSpinner'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface Props {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  organizationName?: string
}

// Ett kontrolltillfälle = ett egenkontroll-ärende
interface Occasion {
  caseId: string
  scheduledStart: string | null
  reviews: EgenkontrollStationReview[]
  reviewedStations: number
  deviations: number
}

interface RegionHistory {
  site: SiteOption
  occasions: Occasion[] // senaste först
  totalDeviations: number
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '–'

const relTime = (s: string | null) => (s ? formatDistanceToNow(new Date(s)) : '')

export default function MultisiteEgenkontrollView({ selectedSiteId, sites }: Props) {
  const [loading, setLoading] = useState(true)
  const [regions, setRegions] = useState<RegionHistory[]>([])
  const [questions, setQuestions] = useState<EgenkontrollQuestion[]>([])
  const [stationNames, setStationNames] = useState<Record<string, { label: string; location: string | null }>>({})
  const [expandedOccasion, setExpandedOccasion] = useState<string | null>(null)
  const [expandedStation, setExpandedStation] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const siteIds = selectedSiteId === 'all' ? sites.map(s => s.id) : [selectedSiteId]
      if (siteIds.length === 0) { setRegions([]); setLoading(false); return }

      // 1+2+3 parallellt: alla ärenden, stationsnamn (equipment_placements), mall (en gång per org)
      const [casesRes, placementsRes, template] = await Promise.all([
        supabase.from('cases')
          .select('id, customer_id, scheduled_start')
          .eq('service_type', 'egenkontroll_trafikkontoret')
          .in('customer_id', siteIds)
          .order('scheduled_start', { ascending: false }),
        supabase.from('equipment_placements')
          .select('id, serial_number, comment')
          .in('customer_id', siteIds),
        EgenkontrollService.getTemplateForCustomer(siteIds[0]),
      ])

      const activeQuestions = (template?.questions ?? []).filter(q => q.active)
      setQuestions(activeQuestions)

      const names: Record<string, { label: string; location: string | null }> = {}
      for (const p of (placementsRes.data ?? []) as any[]) {
        names[p.id] = {
          label: p.serial_number ? `#${p.serial_number}` : 'Station',
          location: p.comment || null,
        }
      }
      setStationNames(names)

      // 4. batch-reviews för alla ärenden
      const cases = casesRes.data ?? []
      const reviewsByCase = await EgenkontrollService.getReviewsForCases(cases.map((c: any) => c.id))

      // 5. gruppera per region → occasions
      const result: RegionHistory[] = siteIds.map(siteId => {
        const site = sites.find(s => s.id === siteId) || { id: siteId, site_name: 'Okänd region' }
        const siteCases = cases.filter((c: any) => c.customer_id === siteId)
        const occasions: Occasion[] = siteCases.map((c: any) => {
          const reviews = reviewsByCase.get(c.id) ?? []
          const reviewedStations = reviews.filter(r => Object.keys(r.answers).length > 0).length
          const deviations = reviews.reduce((s, r) => s + EgenkontrollService.countFailed(r, activeQuestions), 0)
          return { caseId: c.id, scheduledStart: c.scheduled_start, reviews, reviewedStations, deviations }
        })
        return { site, occasions, totalDeviations: occasions.reduce((s, o) => s + o.deviations, 0) }
      })

      setRegions(result)
      // Auto-expandera senaste tillfället i första regionen med data
      const firstWithData = result.find(r => r.occasions.length > 0)
      if (firstWithData) setExpandedOccasion(`${firstWithData.site.id}-${firstWithData.occasions[0].caseId}`)
    } catch (e) {
      console.error('Kunde inte ladda egenkontroll:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, sites])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
  }

  const regionsWithData = regions.filter(r => r.occasions.length > 0)
  const totalOccasions = regionsWithData.reduce((s, r) => s + r.occasions.length, 0)

  // Aktuella avvikelser (senaste tillfället per region som har avvikelser)
  const currentDeviations = regionsWithData
    .map(r => ({ region: r.site.site_name, occ: r.occasions[0] }))
    .filter(x => x.occ && x.occ.deviations > 0)

  // Senaste kontrolldatum totalt
  const lastDate = regionsWithData
    .flatMap(r => r.occasions.map(o => o.scheduledStart))
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null

  const stationLabel = (id: string) => stationNames[id]?.label || 'Station'
  const stationLoc = (id: string) => stationNames[id]?.location || null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#20c58f]" />
          <h2 className="text-lg font-semibold text-white">Egenkontroll</h2>
        </div>
        {totalOccasions > 0 && (
          <span className="text-xs text-slate-400">
            {totalOccasions} {totalOccasions === 1 ? 'kontroll' : 'kontroller'}
            {lastDate && <> · senaste {relTime(lastDate)}</>}
          </span>
        )}
      </div>

      {/* Aktuella avvikelser — överst, det viktigaste för kunden */}
      {currentDeviations.length > 0 && (
        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-300">
              Aktuella avvikelser ({currentDeviations.reduce((s, d) => s + d.occ.deviations, 0)})
            </h3>
          </div>
          <div className="space-y-1.5">
            {currentDeviations.map(({ region, occ }) =>
              occ.reviews
                .filter(r => EgenkontrollService.countFailed(r, questions) > 0)
                .map(r => (
                  <div key={r.id} className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-200">{region} · {stationLabel(r.station_id)}</span>
                      {stationLoc(r.station_id) && <span className="text-slate-500"> · {stationLoc(r.station_id)}</span>}
                      {r.note && <span className="text-amber-300 italic"> — "{r.note}"</span>}
                    </div>
                    <span className="text-slate-500 flex-shrink-0">{relTime(occ.scheduledStart)}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Regioner med tidslinje */}
      {regionsWithData.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga egenkontroller genomförda ännu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {regionsWithData.map(region => (
            <div key={region.site.id} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              {/* Region-rubrik */}
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#20c58f]" />
                <span className="font-medium text-white flex-1">{region.site.site_name}</span>
                <span className="text-xs text-slate-400">
                  {region.occasions.length} {region.occasions.length === 1 ? 'kontroll' : 'kontroller'}
                </span>
                {region.totalDeviations > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                    {region.totalDeviations} avvikelser
                  </span>
                )}
              </div>

              {/* Tidslinje av kontrolltillfällen */}
              <div className="space-y-2 pl-1">
                {region.occasions.map((occ, idx) => {
                  const occKey = `${region.site.id}-${occ.caseId}`
                  const occExpanded = expandedOccasion === occKey
                  const isLatest = idx === 0
                  const allOk = occ.deviations === 0
                  return (
                    <div key={occ.caseId} className="relative pl-5">
                      {/* Tidslinje-prick + linje */}
                      <span className={`absolute left-0 top-2 w-2.5 h-2.5 rounded-full border-2 ${
                        isLatest ? 'bg-[#20c58f] border-[#20c58f]' : 'bg-slate-700 border-slate-600'
                      }`} />
                      {idx < region.occasions.length - 1 && (
                        <span className="absolute left-[4px] top-5 bottom-[-8px] w-0.5 bg-slate-700/60" />
                      )}

                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
                        {/* Tillfälle-header (alltid synlig sammanfattning) */}
                        <button
                          onClick={() => setExpandedOccasion(occExpanded ? null : occKey)}
                          className="w-full px-3 py-2.5 hover:bg-slate-700/20 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            {occExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm font-medium text-white">{fmtDate(occ.scheduledStart)}</span>
                            <span className="text-xs text-slate-500">{relTime(occ.scheduledStart)}</span>
                            <div className="flex-1" />
                            {allOk ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle className="w-3.5 h-3.5" /> Allt godkänt
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                                {occ.deviations} {occ.deviations === 1 ? 'avvikelse' : 'avvikelser'}
                              </span>
                            )}
                          </div>
                          {/* Resultatstapel */}
                          <div className="flex items-center gap-2 mt-2 ml-6">
                            <div className="flex gap-0.5 flex-wrap">
                              {occ.reviews.map(r => {
                                const failed = EgenkontrollService.countFailed(r, questions) > 0
                                const hasAnswers = Object.keys(r.answers).length > 0
                                return (
                                  <span key={r.id} className={`w-2.5 h-2.5 rounded-sm ${
                                    !hasAnswers ? 'bg-slate-700' : failed ? 'bg-red-400' : 'bg-emerald-400'
                                  }`} title={stationLabel(r.station_id)} />
                                )
                              })}
                            </div>
                            <span className="text-xs text-slate-400">{occ.reviewedStations} granskade</span>
                          </div>
                        </button>

                        {/* Stationer (expanderat) */}
                        {occExpanded && (
                          <div className="border-t border-slate-700/50 divide-y divide-slate-800/50">
                            {occ.reviews.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-slate-500">Inga granskade stationer.</p>
                            ) : (
                              // Avvikelse-stationer först
                              [...occ.reviews]
                                .sort((a, b) => EgenkontrollService.countFailed(b, questions) - EgenkontrollService.countFailed(a, questions))
                                .map(rev => {
                                  const stKey = `${occKey}-${rev.station_id}`
                                  const stExpanded = expandedStation === stKey
                                  const failed = EgenkontrollService.countFailed(rev, questions)
                                  const hasAnswers = Object.keys(rev.answers).length > 0
                                  return (
                                    <div key={rev.station_id}>
                                      <button
                                        onClick={() => setExpandedStation(stExpanded ? null : stKey)}
                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/20 transition-colors text-left"
                                      >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                          !hasAnswers ? 'bg-slate-600' : failed > 0 ? 'bg-red-400' : 'bg-emerald-400'
                                        }`} />
                                        {stExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm text-slate-200">{stationLabel(rev.station_id)}</span>
                                          {stationLoc(rev.station_id) && <span className="text-xs text-slate-500"> · {stationLoc(rev.station_id)}</span>}
                                        </div>
                                        {failed > 0
                                          ? <span className="text-xs text-red-400 flex-shrink-0">{failed} avvikelse{failed > 1 ? 'r' : ''}</span>
                                          : hasAnswers ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <span className="text-xs text-slate-600">ej granskad</span>}
                                      </button>

                                      {/* Svarslista (alla typer) */}
                                      {stExpanded && (
                                        <div className="px-6 pb-3 pt-1 space-y-1.5 bg-slate-900/30">
                                          {questions.map(q => {
                                            const a = rev.answers[q.id]
                                            if (q.answer_type === 'yes_no') {
                                              const v = a?.value_bool ?? null
                                              return (
                                                <div key={q.id} className="flex items-start gap-2 text-xs">
                                                  {v === true && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />}
                                                  {v === false && <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />}
                                                  {v === null && <AlertCircle className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />}
                                                  <span className={v === true ? 'text-slate-300' : v === false ? 'text-red-300' : 'text-slate-500'}>{q.question_text}</span>
                                                </div>
                                              )
                                            }
                                            if (q.answer_type === 'percent') {
                                              const pct = a?.value_percent ?? null
                                              return (
                                                <div key={q.id} className="text-xs">
                                                  <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-slate-300">{q.question_text}</span>
                                                    <span className="text-slate-400 font-mono">{pct != null ? `${pct}%` : '—'}</span>
                                                  </div>
                                                  {pct != null && (
                                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                      <div className="h-full bg-[#20c58f] rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            }
                                            if (q.answer_type === 'rating') {
                                              const val = a?.value_number ?? null
                                              const max = q.scale_max ?? 5
                                              return (
                                                <div key={q.id} className="flex items-center justify-between text-xs">
                                                  <span className="text-slate-300">{q.question_text}</span>
                                                  <span className="flex items-center gap-0.5">
                                                    {Array.from({ length: max }, (_, i) => i + 1).map(n => (
                                                      <Star key={n} className={`w-3.5 h-3.5 ${val != null && n <= val ? 'text-[#20c58f] fill-[#20c58f]' : 'text-slate-600'}`} />
                                                    ))}
                                                  </span>
                                                </div>
                                              )
                                            }
                                            // number / choice / text → badge
                                            let display: string | null = null
                                            if (q.answer_type === 'number') display = a?.value_number != null ? `${a.value_number}${q.unit ? ' ' + q.unit : ''}` : null
                                            else display = a?.value_text || null // choice + text
                                            return (
                                              <div key={q.id} className="flex items-start gap-2 text-xs">
                                                <span className={`font-mono px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 max-w-[160px] truncate ${display ? 'bg-slate-700/50 text-slate-200' : 'bg-slate-800/50 text-slate-600'}`}>
                                                  {display ?? '—'}
                                                </span>
                                                <span className={display ? 'text-slate-300' : 'text-slate-500'}>{q.question_text}</span>
                                              </div>
                                            )
                                          })}
                                          {rev.note && <p className="text-xs text-amber-300 italic mt-2">"{rev.note}"</p>}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
