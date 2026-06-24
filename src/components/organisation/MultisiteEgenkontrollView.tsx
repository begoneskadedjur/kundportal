// src/components/organisation/MultisiteEgenkontrollView.tsx
// Egenkontroll-redovisning för regionalkundens portal.
// Summa per region (granskade stationer + avvikelser) → klick på station ger
// full svarslista med alla svarstyper. Scopas via sites (kundens åtkomst).

import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle, Calendar, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  EgenkontrollService,
  type EgenkontrollQuestion,
  type EgenkontrollStationReview,
} from '../../services/egenkontrollService'
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

interface RegionEgenkontroll {
  site: SiteOption
  caseId: string | null
  scheduledStart: string | null
  reviews: EgenkontrollStationReview[]
  questions: EgenkontrollQuestion[]
  reviewedStations: number
  deviations: number
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '–'

export default function MultisiteEgenkontrollView({ selectedSiteId, sites }: Props) {
  const [loading, setLoading] = useState(true)
  const [regions, setRegions] = useState<RegionEgenkontroll[]>([])
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null)
  const [expandedStation, setExpandedStation] = useState<string | null>(null)
  const [stationNames, setStationNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const siteIds = selectedSiteId === 'all' ? sites.map(s => s.id) : [selectedSiteId]
      if (siteIds.length === 0) { setRegions([]); setLoading(false); return }

      // Senaste egenkontroll-ärende per region (scopat till kundens regioner)
      const { data: cases } = await supabase
        .from('cases')
        .select('id, customer_id, scheduled_start')
        .eq('service_type', 'egenkontroll_trafikkontoret')
        .in('customer_id', siteIds)
        .order('scheduled_start', { ascending: false })

      const latestPerSite = new Map<string, { id: string; scheduled_start: string | null }>()
      for (const c of (cases ?? [])) {
        if (!latestPerSite.has(c.customer_id)) latestPerSite.set(c.customer_id, { id: c.id, scheduled_start: c.scheduled_start })
      }

      // Mall per region (en gång per region — undvik N+1)
      const result: RegionEgenkontroll[] = await Promise.all(
        siteIds.map(async (siteId) => {
          const site = sites.find(s => s.id === siteId) || { id: siteId, site_name: 'Okänd region' }
          const latest = latestPerSite.get(siteId)
          if (!latest) {
            return { site, caseId: null, scheduledStart: null, reviews: [], questions: [], reviewedStations: 0, deviations: 0 }
          }
          const [reviews, template] = await Promise.all([
            EgenkontrollService.getReviews(latest.id),
            EgenkontrollService.getTemplateForCustomer(siteId),
          ])
          const questions = (template?.questions ?? []).filter(q => q.active)
          // En station räknas som "granskad" om den har minst ett svar
          const reviewedStations = reviews.filter(r => Object.keys(r.answers).length > 0).length
          const deviations = reviews.reduce((sum, r) => sum + EgenkontrollService.countFailed(r, questions), 0)
          return { site, caseId: latest.id, scheduledStart: latest.scheduled_start, reviews, questions, reviewedStations, deviations }
        })
      )

      setRegions(result)

      // Hämta stationsnamn för visning
      const allStationIds = result.flatMap(r => r.reviews.map(rv => rv.station_id))
      if (allStationIds.length > 0) {
        const { data: stations } = await supabase
          .from('indoor_stations')
          .select('id, name')
          .in('id', allStationIds)
        // Fallback: även outdoor (equipment) — men håll det enkelt, namn via map
        const names: Record<string, string> = {}
        for (const s of (stations ?? [])) names[s.id] = s.name || s.id
        setStationNames(names)
      }
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

  const regionsWithData = regions.filter(r => r.caseId !== null)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Egenkontroll</h2>
      </div>

      {regionsWithData.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga egenkontroller genomförda ännu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {regionsWithData.map(region => {
            const isExpanded = expandedRegion === region.site.id
            return (
              <div key={region.site.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                {/* Region-header (summa) */}
                <button
                  onClick={() => setExpandedRegion(isExpanded ? null : region.site.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-white flex-1">{region.site.site_name}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" /> {fmtDate(region.scheduledStart)}
                  </span>
                  <span className="text-sm text-slate-300">{region.reviewedStations} granskade</span>
                  {region.deviations > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                      {region.deviations} avvikelser
                    </span>
                  )}
                </button>

                {/* Stationer */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 divide-y divide-slate-800/50">
                    {region.reviews.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">Inga granskade stationer.</p>
                    ) : region.reviews.map(rev => {
                      const stKey = `${region.site.id}-${rev.station_id}`
                      const stExpanded = expandedStation === stKey
                      const failed = EgenkontrollService.countFailed(rev, region.questions)
                      return (
                        <div key={rev.station_id}>
                          <button
                            onClick={() => setExpandedStation(stExpanded ? null : stKey)}
                            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-700/20 transition-colors text-left"
                          >
                            {stExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                            <span className="text-sm text-slate-200 flex-1">{stationNames[rev.station_id] || 'Station'}</span>
                            {failed > 0
                              ? <span className="text-xs text-red-400">{failed} avvikelse{failed > 1 ? 'r' : ''}</span>
                              : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                          </button>

                          {/* Full svarslista — alla svarstyper */}
                          {stExpanded && (
                            <div className="px-6 pb-3 pt-1 space-y-1.5 bg-slate-900/30">
                              {region.questions.map(q => {
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
                                // värdetyper → badge + text
                                let display: string | null = null
                                if (q.answer_type === 'percent') display = a?.value_percent != null ? `${a.value_percent}%` : null
                                else if (q.answer_type === 'text' || q.answer_type === 'choice') display = a?.value_text || null
                                else if (q.answer_type === 'number') display = a?.value_number != null ? `${a.value_number}${q.unit ? ' ' + q.unit : ''}` : null
                                else if (q.answer_type === 'rating') display = a?.value_number != null ? `${a.value_number}/${q.scale_max ?? 5}` : null
                                return (
                                  <div key={q.id} className="flex items-start gap-2 text-xs">
                                    <span className={`font-mono px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 max-w-[160px] truncate ${display ? 'bg-slate-700/50 text-slate-200' : 'bg-slate-800/50 text-slate-600'}`}>
                                      {display ?? '—'}
                                    </span>
                                    <span className={display ? 'text-slate-300' : 'text-slate-500'}>{q.question_text}</span>
                                  </div>
                                )
                              })}
                              {rev.note && (
                                <p className="text-xs text-amber-300 italic mt-2">"{rev.note}"</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
