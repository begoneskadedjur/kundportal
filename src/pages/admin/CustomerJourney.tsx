import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  GitBranch, CalendarCheck, FileText, CheckCircle, XCircle,
  Receipt, BadgeCheck, XOctagon, ClipboardList, RefreshCw,
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus } from '../../types/database'
import { formatCurrency } from '../../utils/formatters'
import CustomerJourneyFunnel from '../../components/admin/sales/CustomerJourneyFunnel'
import FunnelStageDetail from '../../components/admin/sales/FunnelStageDetail'

// ─── Types ───────────────────────────────────────────────

export interface JourneyCaseRow {
  id: string
  title: string
  status: string
  kontaktperson: string | null
  telefon_kontaktperson: string | null
  pris: number | null
  start_date: string | null
  completed_date: string | null
  created_at: string
  skadedjur: string | null
  case_type: 'private' | 'business'
  company_name?: string | null
  contractStatus?: string | null
  invoiceStatus?: string | null
}

export interface JourneyStage {
  id: string
  label: string
  count: number
  totalValue: number
  cases: JourneyCaseRow[]
  percentage: number
  icon: React.ElementType
  color: string
  bgColor: string
  textColor: string
}

interface ContractInfo { status: string; type: string }
interface InvoiceInfo { status: string }

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

// Statuses that imply the case has been booked (passed the "Öppen" stage)
const BOOKED_OR_LATER = new Set([
  'Bokad', 'Bokat', 'Offert skickad', 'Offert signerad - boka in',
  'Återbesök', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5',
  'Generera saneringsrapport', 'Avslutat',
])

function getStartDate(period: Period): string {
  const now = new Date()
  if (period === 'ytd') return `${now.getFullYear()}-01-01`
  const months = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
  const d = new Date(now)
  d.setMonth(d.getMonth() - months[period])
  return d.toISOString().slice(0, 10)
}

// ─── Component ───────────────────────────────────────────

export default function CustomerJourney() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('3m')
  const [caseTypeFilter, setCaseTypeFilter] = useState<CaseTypeFilter>('all')
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const [cases, setCases] = useState<JourneyCaseRow[]>([])
  const [contractMap, setContractMap] = useState<Map<string, ContractInfo>>(new Map())
  const [invoiceMap, setInvoiceMap] = useState<Map<string, InvoiceInfo>>(new Map())

  // ─── Fetch ───────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const startDate = getStartDate(period)

    try {
      const selectFields = 'id, title, status, kontaktperson, telefon_kontaktperson, pris, start_date, completed_date, created_at, skadedjur'

      const [privateRes, businessRes] = await Promise.allSettled([
        supabase.from('private_cases').select(selectFields).gte('created_at', startDate).is('deleted_at', null),
        supabase.from('business_cases').select(`${selectFields}, company_name`).gte('created_at', startDate).is('deleted_at', null),
      ])

      const allCases: JourneyCaseRow[] = [
        ...(privateRes.status === 'fulfilled' ? privateRes.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'private' as const, pris: c.pris ?? null,
        })),
        ...(businessRes.status === 'fulfilled' ? businessRes.value.data || [] : []).map((c: any) => ({
          ...c, case_type: 'business' as const, pris: c.pris ?? null,
        })),
      ]

      setCases(allCases)

      // Batch supplementary
      const caseIds = allCases.map(c => c.id)
      if (caseIds.length > 0) {
        const [contractsRes, invoicesRes] = await Promise.allSettled([
          supabase.from('contracts').select('source_id, status, type').in('source_id', caseIds),
          supabase.from('invoices').select('case_id, status').in('case_id', caseIds).neq('status', 'cancelled'),
        ])

        const cMap = new Map<string, ContractInfo>()
        const contractPrio: Record<string, number> = { signed: 5, active: 4, pending: 3, overdue: 2, declined: 1, ended: 0 }
        if (contractsRes.status === 'fulfilled') {
          for (const c of contractsRes.value.data || []) {
            if (!c.source_id) continue
            const existing = cMap.get(c.source_id)
            if (!existing || (contractPrio[c.status] || 0) > (contractPrio[existing.status] || 0)) {
              cMap.set(c.source_id, { status: c.status, type: c.type })
            }
          }
        }
        setContractMap(cMap)

        const iMap = new Map<string, InvoiceInfo>()
        const invPrio: Record<string, number> = { paid: 5, sent: 4, ready: 3, pending_approval: 2, draft: 1 }
        if (invoicesRes.status === 'fulfilled') {
          for (const inv of invoicesRes.value.data || []) {
            if (!inv.case_id) continue
            const existing = iMap.get(inv.case_id)
            if (!existing || (invPrio[inv.status] || 0) > (invPrio[existing.status] || 0)) {
              iMap.set(inv.case_id, { status: inv.status })
            }
          }
        }
        setInvoiceMap(iMap)
      } else {
        setContractMap(new Map())
        setInvoiceMap(new Map())
      }
    } catch {
      // silently fail, show empty state
    } finally {
      setLoading(false)
    }
  }, [period])

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

    // Classify each case
    const created = filteredCases
    const booked = filteredCases.filter(c => BOOKED_OR_LATER.has(c.status))
    const offerSent = filteredCases.filter(c => {
      const contract = contractMap.get(c.id)
      return contract || c.status === 'Offert skickad' || c.status === 'Offert signerad - boka in'
    })
    const accepted = filteredCases.filter(c => {
      const contract = contractMap.get(c.id)
      return (contract && contract.status === 'signed') ||
        c.status === 'Offert signerad - boka in' ||
        (BOOKED_OR_LATER.has(c.status) && contract?.status === 'signed')
    })
    const declined = filteredCases.filter(c => {
      const contract = contractMap.get(c.id)
      return contract && (contract.status === 'declined' || contract.status === 'overdue')
    })
    const completed = filteredCases.filter(c => c.status === 'Avslutat')
    const closed = filteredCases.filter(c => c.status === 'Stängt - slasklogg')
    const invoiced = filteredCases.filter(c => invoiceMap.has(c.id))
    const paid = filteredCases.filter(c => invoiceMap.get(c.id)?.status === 'paid')

    const sumValue = (arr: JourneyCaseRow[]) => arr.reduce((s, c) => s + (c.pris || 0), 0)
    const pct = (arr: JourneyCaseRow[]) => total > 0 ? Math.round((arr.length / total) * 100) : 0

    // Enrich with contract/invoice status for display
    const enrich = (arr: JourneyCaseRow[]): JourneyCaseRow[] =>
      arr.map(c => ({
        ...c,
        contractStatus: contractMap.get(c.id)?.status || null,
        invoiceStatus: invoiceMap.get(c.id)?.status || null,
      }))

    return [
      { id: 'created', label: 'Skapade ärenden', count: created.length, totalValue: sumValue(created), cases: enrich(created), percentage: 100, icon: ClipboardList, color: 'slate', bgColor: 'bg-slate-500/20', textColor: 'text-slate-400' },
      { id: 'booked', label: 'Bokade', count: booked.length, totalValue: sumValue(booked), cases: enrich(booked), percentage: pct(booked), icon: CalendarCheck, color: 'amber', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
      { id: 'offer_sent', label: 'Offert skickad', count: offerSent.length, totalValue: sumValue(offerSent), cases: enrich(offerSent), percentage: pct(offerSent), icon: FileText, color: 'teal', bgColor: 'bg-teal-500/20', textColor: 'text-teal-400' },
      { id: 'accepted', label: 'Accepterad', count: accepted.length, totalValue: sumValue(accepted), cases: enrich(accepted), percentage: pct(accepted), icon: CheckCircle, color: 'green', bgColor: 'bg-[#20c58f]/20', textColor: 'text-[#20c58f]' },
      { id: 'declined', label: 'Nekad / Utgången', count: declined.length, totalValue: sumValue(declined), cases: enrich(declined), percentage: pct(declined), icon: XCircle, color: 'red', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
      { id: 'completed', label: 'Utfört arbete', count: completed.length, totalValue: sumValue(completed), cases: enrich(completed), percentage: pct(completed), icon: CheckCircle, color: 'emerald', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
      { id: 'closed', label: 'Stängda', count: closed.length, totalValue: sumValue(closed), cases: enrich(closed), percentage: pct(closed), icon: XOctagon, color: 'red', bgColor: 'bg-red-500/20', textColor: 'text-red-400' },
      { id: 'invoiced', label: 'Fakturerat', count: invoiced.length, totalValue: sumValue(invoiced), cases: enrich(invoiced), percentage: pct(invoiced), icon: Receipt, color: 'blue', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
      { id: 'paid', label: 'Betalt', count: paid.length, totalValue: sumValue(paid), cases: enrich(paid), percentage: pct(paid), icon: BadgeCheck, color: 'emerald', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-400' },
    ]
  }, [filteredCases, contractMap, invoiceMap])

  // ─── KPIs ───────────────────────────────────────

  const kpis = useMemo(() => {
    const total = stages.find(s => s.id === 'created')?.count || 0
    const completedCount = stages.find(s => s.id === 'completed')?.count || 0
    const paidCount = stages.find(s => s.id === 'paid')?.count || 0
    const totalValue = stages.find(s => s.id === 'created')?.totalValue || 0
    const convRate = total > 0 ? Math.round((completedCount / total) * 100) : 0
    const avgOrder = completedCount > 0
      ? Math.round((stages.find(s => s.id === 'completed')?.totalValue || 0) / completedCount)
      : 0

    return { total, convRate, paidCount, totalValue, avgOrder }
  }, [stages])

  const selectedStage = stages.find(s => s.id === selectedStageId) || null

  // ─── Render ─────────────────────────────────────

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#20c58f]" />
            Kundresa
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Visualisering av kundflödet från ärende till betalning</p>
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
        {/* Period */}
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

        {/* Case type */}
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
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner />
          <p className="text-slate-400 mt-4">Laddar kundresa...</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Totalt skapade', value: kpis.total.toString(), color: 'text-white' },
              { label: 'Konvertering → Avslutat', value: `${kpis.convRate}%`, color: 'text-[#20c58f]' },
              { label: 'Snittorder (avslutat)', value: formatCurrency(kpis.avgOrder), color: 'text-blue-400' },
              { label: 'Total pipeline-värde', value: formatCurrency(kpis.totalValue), color: 'text-amber-400' },
            ].map(kpi => (
              <div key={kpi.label} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className={`text-xl font-bold ${kpi.color} mt-0.5`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Funnel */}
          {stages.length > 0 ? (
            <CustomerJourneyFunnel
              stages={stages}
              selectedStageId={selectedStageId}
              onSelectStage={id => setSelectedStageId(prev => prev === id ? null : id)}
            />
          ) : (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-medium">Inga ärenden i vald period</p>
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
