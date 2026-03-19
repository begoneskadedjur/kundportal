import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import {
  DollarSign, Calendar, AlertCircle, AlertTriangle,
  ChevronDown, ChevronUp, FileSignature, Sparkles, Target, RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import MonthlyOverviewList from '../../components/technician/MonthlyOverviewList'
import MonthlyCommissionModal from '../../components/technician/MonthlyCommissionModal'
import TodayScheduleCard from '../../components/technician/dashboard/TodayScheduleCard'
import ActionRequiredList from '../../components/technician/dashboard/ActionRequiredList'
import { supabase } from '../../lib/supabase'

// ─── Types ─────────────────────────────────────

interface TechnicianCase {
  id: string
  clickup_task_id: string
  case_number?: string
  title: string
  status: string
  priority?: string
  case_type: 'private' | 'business' | 'contract'
  created_date: string
  start_date?: string
  due_date?: string
  completed_date?: string
  commission_amount?: number
  case_price?: number
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  adress?: any
  foretag?: string
  org_nr?: string
  skadedjur?: string
  description?: string
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip'
  personnummer?: string
  material_cost?: number
  time_spent_minutes?: number
  work_started_at?: string
  primary_assignee_id?: string | null
  primary_assignee_name?: string | null
  assignee_name?: string
  r_rot_rut?: string
  r_fastighetsbeteckning?: string
  r_arbetskostnad?: number
  r_material_utrustning?: string
  r_servicebil?: string
  rapport?: string
  filer?: any
  reklamation?: string
  avvikelser_tillbud_olyckor?: string
  annat_skadedjur?: string
  skicka_bokningsbekraftelse?: string
}

interface DashboardData {
  stats: {
    total_commission_ytd: number
    total_cases_ytd: number
    avg_commission_per_case: number
    current_month_commission: number
    pending_cases: number
    completed_cases_this_month: number
    technician_name?: string
    technician_email?: string
  }
  monthly_data: Array<{
    month: string
    month_display: string
    total_commission: number
    case_count: number
    avg_commission_per_case: number
  }>
  pending_cases: Array<any>
}

// ─── Helpers ───────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 10) return 'God morgon'
  if (h < 17) return 'God eftermiddag'
  return 'God kväll'
}

function getDateString(): string {
  return new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Component ─────────────────────────────────

export default function TechnicianDashboard() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()

  const technicianId = profile?.technician_id
  const technicianData = profile?.technicians
  const displayName = technicianData?.name || profile?.display_name || 'Tekniker'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [showCommHistory, setShowCommHistory] = useState(false)

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<any | null>(null)
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)

  // Leads summary
  const [leadsSummary, setLeadsSummary] = useState<{ active: number; followupsToday: number }>({ active: 0, followupsToday: 0 })

  useEffect(() => {
    if (profile && !isTechnician) {
      navigate('/login', { replace: true })
    }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && technicianId) {
      fetchDashboardData()
      fetchLeadsSummary()
    }
  }, [isTechnician, technicianId])

  const fetchDashboardData = async () => {
    if (!technicianId) return
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/technician/dashboard?technician_id=${technicianId}`)
      if (!response.ok) throw new Error(`API Error: ${response.status}`)
      const dashboardData = await response.json()
      setData(dashboardData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const fetchLeadsSummary = async () => {
    if (!technicianId) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: leads } = await supabase
        .from('leads')
        .select('id, status, follow_up_date')
        .eq('assigned_to', technicianId)
        .in('status', ['new', 'contacted', 'meeting_booked', 'offer_sent', 'negotiation'])

      if (leads) {
        const followupsToday = leads.filter(l => l.follow_up_date && l.follow_up_date.slice(0, 10) === today).length
        setLeadsSummary({ active: leads.length, followupsToday })
      }
    } catch {
      // silent
    }
  }

  // ─── Modal handlers ──────────────────────────

  const handleOpenCase = (pendingCase: any) => {
    const tc: TechnicianCase = {
      id: pendingCase.id,
      clickup_task_id: pendingCase.clickup_task_id,
      title: pendingCase.title,
      status: pendingCase.status,
      case_type: pendingCase.case_type,
      created_date: pendingCase.created_at,
      description: pendingCase.description,
      kontaktperson: pendingCase.kontaktperson,
      telefon_kontaktperson: pendingCase.telefon_kontaktperson,
      e_post_kontaktperson: pendingCase.e_post_kontaktperson,
      skadedjur: pendingCase.skadedjur,
      personnummer: pendingCase.personnummer,
      org_nr: pendingCase.org_nr,
      foretag: pendingCase.foretag,
      adress: pendingCase.adress,
      case_price: pendingCase.pris,
      material_cost: pendingCase.material_cost,
      time_spent_minutes: pendingCase.time_spent_minutes,
      work_started_at: pendingCase.work_started_at,
      start_date: pendingCase.start_date,
      due_date: pendingCase.due_date,
      primary_assignee_id: pendingCase.primary_assignee_id || technicianId,
      primary_assignee_name: pendingCase.primary_assignee_name || displayName,
      assignee_name: pendingCase.assignee_name || displayName,
      r_rot_rut: pendingCase.r_rot_rut,
      r_fastighetsbeteckning: pendingCase.r_fastighetsbeteckning,
      r_arbetskostnad: pendingCase.r_arbetskostnad,
      r_material_utrustning: pendingCase.r_material_utrustning,
      r_servicebil: pendingCase.r_servicebil,
      rapport: pendingCase.rapport,
      priority: pendingCase.priority,
      case_number: pendingCase.case_number,
      billing_status: pendingCase.billing_status,
    }
    setSelectedCase(tc)
    setIsEditModalOpen(true)
  }

  const handleUpdateSuccess = (updatedCase?: Partial<TechnicianCase>) => {
    if (!updatedCase && selectedCase && data) {
      setData(prev => prev ? {
        ...prev,
        pending_cases: prev.pending_cases.filter(c => c.id !== selectedCase.id),
      } : prev)
      setIsEditModalOpen(false)
      setSelectedCase(null)
      return
    }
    if (updatedCase && selectedCase) {
      setSelectedCase(prev => prev ? { ...prev, ...updatedCase } : prev)
    }
  }

  // ─── Render ──────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-1" />
          <div className="h-4 w-32 bg-slate-800/60 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-48 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-28 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
            <div className="h-28 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Problem med att ladda data</h2>
        <p className="text-slate-400 text-sm mb-4 text-center">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-[#20c58f] text-white rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
        >
          Försök igen
        </button>
      </div>
    )
  }

  if (!data) return null

  const pendingCases = data.pending_cases || []

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-4">

      {/* ─── Section 0: Greeting ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">
            {getGreeting()}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-sm text-slate-400 capitalize">{getDateString()}</p>

          {/* Status pills */}
          <div className="flex items-center gap-2 mt-2">
            {data.stats.pending_cases > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-full">
                {data.stats.pending_cases} att hantera
              </span>
            )}
            {leadsSummary.active > 0 && (
              <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 text-xs font-medium rounded-full">
                {leadsSummary.active} leads
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { fetchDashboardData(); fetchLeadsSummary() }}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Section 1: Today's Schedule ─── */}
      {technicianId && <TodayScheduleCard technicianId={technicianId} />}

      {/* ─── Section 2: Action Required ─── */}
      <ActionRequiredList cases={pendingCases} onCaseClick={handleOpenCase} />

      {/* ─── Section 3: Commission KPIs ─── */}
      <div className="grid grid-cols-2 gap-3">
        <EnhancedKpiCard
          title="Provision denna månad"
          value={data.stats.current_month_commission}
          icon={Calendar}
          suffix=" kr"
          decimals={0}
          trend={(() => {
            const curr = data.monthly_data[0]
            const prev = data.monthly_data[1]
            if (!curr || !prev || prev.total_commission === 0) return 'neutral'
            return curr.total_commission > prev.total_commission ? 'up' : 'down'
          })()}
          trendValue={(() => {
            const curr = data.monthly_data[0]
            const prev = data.monthly_data[1]
            if (!curr || !prev || prev.total_commission === 0) return ''
            const change = ((curr.total_commission - prev.total_commission) / prev.total_commission) * 100
            return `${change >= 0 ? '+' : ''}${Math.round(change)}%`
          })()}
          customContent={
            <p className="text-slate-500 text-xs">{data.stats.completed_cases_this_month} avslutade</p>
          }
        />
        <EnhancedKpiCard
          title="Provision i år"
          value={data.stats.total_commission_ytd}
          icon={DollarSign}
          suffix=" kr"
          decimals={0}
          trend="neutral"
          trendValue={`${data.stats.total_cases_ytd} ärenden`}
        />
      </div>

      {/* ─── Section 4: Quick Actions ─── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Skapa avtal', icon: FileSignature, path: '/technician/oneflow', color: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15' },
          { label: 'AI Assistent', icon: Sparkles, path: '/technician/team-chat', color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
          { label: 'Rapportera tillbud', icon: AlertTriangle, path: '/technician/tillbud-avvikelser', color: 'text-amber-400', bg: 'bg-amber-500/15' },
        ].map(a => (
          <Link
            key={a.path}
            to={a.path}
            className="flex flex-col items-center gap-1.5 p-3 bg-slate-800/30 border border-slate-700 rounded-xl hover:bg-slate-800/50 hover:border-slate-600 transition-all"
          >
            <div className={`w-9 h-9 rounded-lg ${a.bg} flex items-center justify-center`}>
              <a.icon className={`w-4 h-4 ${a.color}`} />
            </div>
            <span className="text-xs font-medium text-slate-300 text-center leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* ─── Section 5: Leads Strip ─── */}
      {leadsSummary.active > 0 && (
        <Link
          to="/technician/leads"
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
            leadsSummary.followupsToday > 0
              ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
              : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Target className={`w-4 h-4 ${leadsSummary.followupsToday > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="text-sm text-slate-300">
              {leadsSummary.active} aktiva leads
              {leadsSummary.followupsToday > 0 && (
                <>
                  <span className="text-slate-600 mx-1">|</span>
                  <span className="text-amber-400 font-medium">{leadsSummary.followupsToday} uppföljning idag</span>
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-[#20c58f] font-medium">Visa alla</span>
        </Link>
      )}

      {/* ─── Section 6: Commission History (collapsed) ─── */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl">
        <button
          type="button"
          onClick={() => setShowCommHistory(!showCommHistory)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#20c58f]" />
            <span className="text-sm font-semibold text-white">Provisionshistorik</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {formatCurrency(data.stats.total_commission_ytd)} YTD
            </span>
            {showCommHistory
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </button>

        <AnimatePresence>
          {showCommHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 border-t border-slate-700/50">
                <MonthlyOverviewList
                  months={data.monthly_data}
                  onMonthClick={(month: any) => { setSelectedMonth(month); setShowMonthlyModal(true) }}
                  maxItems={3}
                />
                <Link
                  to="/technician/commissions"
                  className="block text-center text-xs text-[#20c58f] font-medium mt-2 hover:underline"
                >
                  Visa alla provisioner
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Modals ─── */}
      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedCase(null) }}
        onSuccess={handleUpdateSuccess}
        caseData={selectedCase}
      />
      <MonthlyCommissionModal
        isOpen={showMonthlyModal}
        onClose={() => { setShowMonthlyModal(false); setSelectedMonth(null) }}
        month={selectedMonth}
        technicianId={technicianId || ''}
        onCaseClick={(caseItem) => {
          const fullCase = data?.pending_cases?.find((c: any) => c.id === caseItem.id)
          if (fullCase) handleOpenCase(fullCase)
          setShowMonthlyModal(false)
          setSelectedMonth(null)
        }}
      />
    </div>
  )
}
