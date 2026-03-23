import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trash2, DollarSign, PhoneOff, CheckCircle, CalendarX,
  PhoneMissed, Copy, MoreHorizontal, HelpCircle, RefreshCw,
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../utils/formatters'
import { getAvailableTechnicians } from '../../services/commissionService'
import type { TechnicianFilter } from '../../types/commission'
import type { JourneyCaseRow, JourneyStage } from './CustomerJourney'
import CommissionTechnicianFilter from '../../components/admin/commissions/CommissionTechnicianFilter'
import ClosedCasesFunnelChart from '../../components/admin/sales/ClosedCasesFunnelChart'
import FunnelStageDetail from '../../components/admin/sales/FunnelStageDetail'

// ─── Constants ───────────────────────────────────────────

type Period = '1m' | '3m' | '6m' | '12m' | 'ytd'
type CaseTypeFilter = 'all' | 'private' | 'business'

const PERIODS: { key: Period; label: string }[] = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
  { key: 'ytd', label: 'YTD' },
]

const CASE_TYPE_FILTERS: { key: CaseTypeFilter; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'private', label: 'Privat' },
  { key: 'business', label: 'Företag' },
]

function getStartDate(period: Period): string {
  const now = new Date()
  if (period === 'ytd') return `${now.getFullYear()}-01-01`
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
  const d = new Date(now)
  d.setMonth(d.getMonth() - months[period])
  return d.toISOString().slice(0, 10)
}

// ─── Close reason config ─────────────────────────────────

interface ReasonConfig {
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
  textColor: string
}

const REASON_CONFIG: Record<string, ReasonConfig> = {
  kund_accepterade_inte_pris: { label: 'Accepterade inte kostnadsförslag', icon: DollarSign, color: 'amber', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
  kund_aterkopplade_aldrig: { label: 'Återkopplade aldrig', icon: PhoneOff, color: 'orange', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400' },
  lost_vid_inspektion: { label: 'Löst vid inspektion', icon: CheckCircle, color: 'emerald', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
  kund_avbokade: { label: 'Kund avbokade', icon: CalendarX, color: 'red', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
  kund_ej_narbar: { label: 'Kund ej nåbar', icon: PhoneMissed, color: 'slate', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
  dublett: { label: 'Dublett', icon: Copy, color: 'purple', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400' },
  ovrigt: { label: 'Övrigt', icon: MoreHorizontal, color: 'slate', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
  // Legacy
  kund_avbojt: { label: 'Kund avböjt (äldre)', icon: PhoneOff, color: 'orange', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400' },
  lost_utan_atgard: { label: 'Löst utan åtgärd (äldre)', icon: CheckCircle, color: 'emerald', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
}

const UNKNOWN_REASON: ReasonConfig = { label: 'Okänd anledning', icon: HelpCircle, color: 'slate', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' }

// ─── Component ───────────────────────────────────────────

export default function ClosedCasesFunnel() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('3m')
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseTypeFilter>('all')
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [technicians, setTechnicians] = useState<TechnicianFilter[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianFilter>({ id: 'all', name: 'Alla tekniker' })

  const [cases, setCases] = useState<(JourneyCaseRow & { close_reason: string | null; close_reason_notes: string | null; deleted_at: string })[]>([])

  // ─── Fetch technicians ──────────────────────────

  useEffect(() => {
    getAvailableTechnicians().then(setTechnicians)
  }, [])

  // ─── Fetch ───────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const startDate = getStartDate(period)

    try {
      const selectFields = 'id, title, status, kontaktperson, telefon_kontaktperson, pris, start_date, completed_date, created_at, skadedjur, deleted_at, close_reason, close_reason_notes, deleted_by_technician_name'

      let privateQuery = supabase.from('private_cases').select(selectFields)
        .not('deleted_at', 'is', null)
        .gte('deleted_at', startDate)
      let businessQuery = supabase.from('business_cases').select(`${selectFields}, company_name`)
        .not('deleted_at', 'is', null)
        .gte('deleted_at', startDate)

      if (selectedTechnician.id !== 'all') {
        privateQuery = privateQuery.eq('deleted_by_technician_id', selectedTechnician.id)
        businessQuery = businessQuery.eq('deleted_by_technician_id', selectedTechnician.id)
      }

      const [privateRes, businessRes] = await Promise.allSettled([privateQuery, businessQuery])

      const allCases = [
        ...(privateRes.status === 'fulfilled' ? privateRes.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'private' as const, pris: c.pris ?? null,
        })),
        ...(businessRes.status === 'fulfilled' ? businessRes.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'business' as const, pris: c.pris ?? null,
        })),
      ]

      setCases(allCases)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [period, selectedTechnician.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Filter by case type ────────────────────────

  const filteredCases = useMemo(() => {
    if (caseTypeFilter === 'all') return cases
    return cases.filter(c => c.case_type === caseTypeFilter)
  }, [cases, caseTypeFilter])

  // ─── Build stages ───────────────────────────────

  const stages = useMemo((): JourneyStage[] => {
    const total = filteredCases.length
    if (total === 0) return []

    const sumValue = (arr: JourneyCaseRow[]) => arr.reduce((s, c) => s + (c.pris || 0), 0)

    // Group by close_reason
    const groups = new Map<string, typeof filteredCases>()
    for (const c of filteredCases) {
      const key = c.close_reason || '_unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }

    const reasonStages: JourneyStage[] = []
    for (const [key, casesInGroup] of groups) {
      const config = REASON_CONFIG[key] || UNKNOWN_REASON
      reasonStages.push({
        id: key,
        label: config.label,
        count: casesInGroup.length,
        totalValue: sumValue(casesInGroup),
        cases: casesInGroup as JourneyCaseRow[],
        percentage: Math.round((casesInGroup.length / total) * 100),
        icon: config.icon,
        color: config.color,
        bgColor: config.bgColor,
        textColor: config.textColor,
      })
    }

    const totalStage: JourneyStage = {
      id: 'total',
      label: 'Totalt borttagna ärenden',
      count: total,
      totalValue: sumValue(filteredCases as JourneyCaseRow[]),
      cases: filteredCases as JourneyCaseRow[],
      percentage: 100,
      icon: Trash2,
      color: 'slate',
      bgColor: 'bg-slate-500/20',
      textColor: 'text-slate-400',
    }

    return [totalStage, ...reasonStages]
  }, [filteredCases])

  // ─── KPIs ───────────────────────────────────────

  const kpis = useMemo(() => {
    const total = filteredCases.length
    const totalValue = filteredCases.reduce((s, c) => s + (c.pris || 0), 0)

    const reasonCounts = new Map<string, number>()
    for (const c of filteredCases) {
      const key = c.close_reason || '_unknown'
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1)
    }

    let topReason = '-'
    let topCount = 0
    for (const [key, count] of reasonCounts) {
      if (count > topCount) {
        topCount = count
        topReason = REASON_CONFIG[key]?.label || 'Okänd'
      }
    }

    const topPct = total > 0 ? Math.round((topCount / total) * 100) : 0

    return { total, totalValue, topReason, topPct }
  }, [filteredCases])

  const selectedStage = stages.find(s => s.id === selectedStageId) || null

  // ─── Render ─────────────────────────────────────

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-[#20c58f]" />
            Avslutade ärenden
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Analys av borttagna ärenden och anledningar</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-auto p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-800/30 p-1 rounded-lg">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); setSelectedStageId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-800/30 p-1 rounded-lg">
          {CASE_TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setCaseTypeFilter(f.key); setSelectedStageId(null) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                caseTypeFilter === f.key
                  ? 'bg-[#20c58f] text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {technicians.length > 0 && (
          <CommissionTechnicianFilter
            selectedTechnician={selectedTechnician}
            availableTechnicians={technicians}
            onTechnicianChange={t => { setSelectedTechnician(t); setSelectedStageId(null) }}
            compact
          />
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar avslutade ärenden...</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Totalt borttagna', value: kpis.total.toString(), color: 'text-white' },
              { label: 'Tappat värde', value: formatCurrency(kpis.totalValue), color: 'text-red-400' },
              { label: 'Vanligaste anledning', value: kpis.topReason, color: 'text-amber-400' },
              { label: 'Andel av topp', value: `${kpis.topPct}%`, color: 'text-orange-400' },
            ].map(kpi => (
              <div key={kpi.label} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className={`text-xl font-bold ${kpi.color} mt-0.5 truncate`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Funnel */}
          {stages.length > 0 ? (
            <ClosedCasesFunnelChart
              stages={stages}
              selectedStageId={selectedStageId}
              onSelectStage={id => setSelectedStageId(prev => prev === id ? null : id)}
            />
          ) : (
            <div className="text-center py-16">
              <Trash2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-medium">Inga borttagna ärenden i vald period</p>
              <p className="text-slate-400 text-sm mt-1">Prova att ändra tidsperiod eller ärendetyp</p>
            </div>
          )}

          {/* Stage detail */}
          {selectedStage && (
            <FunnelStageDetail
              stage={selectedStage}
              onClose={() => setSelectedStageId(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
