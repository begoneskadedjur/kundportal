import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle,
  FileSignature, Sparkles, Target, RefreshCw, Wallet, LayoutDashboard,
  Calendar, ClipboardList, FileText,
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'
import TodayScheduleCard from '../../components/technician/dashboard/TodayScheduleCard'
import CaseSummaryCard from '../../components/technician/dashboard/CaseSummaryCard'
import OfferSummaryCard from '../../components/technician/dashboard/OfferSummaryCard'
import { supabase } from '../../lib/supabase'

// ─── Types ─────────────────────────────────────

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

  // Leads summary
  const [leadsSummary, setLeadsSummary] = useState<{ active: number; followupsToday: number }>({ active: 0, followupsToday: 0 })

  // KPI counts
  const [todayCount, setTodayCount] = useState(0)
  const [offerCount, setOfferCount] = useState(0)

  useEffect(() => {
    if (profile && !isTechnician) {
      navigate('/login', { replace: true })
    }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && technicianId) {
      fetchDashboardData()
      fetchLeadsSummary()
      fetchKpiCounts()
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

  const fetchKpiCounts = async () => {
    if (!technicianId) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = tomorrow.toISOString().slice(0, 10)

      // Today's case count
      const [privToday, bizToday] = await Promise.allSettled([
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', today).lt('start_date', tomorrowStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', today).lt('start_date', tomorrowStr)
          .is('deleted_at', null)
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
      ])
      setTodayCount(
        (privToday.status === 'fulfilled' ? privToday.value.count || 0 : 0) +
        (bizToday.status === 'fulfilled' ? bizToday.value.count || 0 : 0)
      )

      // Active offers count (pending + overdue)
      const techEmail = profile?.technicians?.email
      if (techEmail) {
        const { count: offerCnt } = await supabase
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .eq('begone_employee_email', techEmail)
          .in('status', ['pending', 'overdue'])
        setOfferCount(offerCnt || 0)
      }
    } catch {
      // silent
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 sm:py-6 space-y-4">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {getGreeting()}, {displayName.split(' ')[0]}
            </h1>
            <p className="text-slate-400 text-sm capitalize">{getDateString()}</p>
          </div>
        </div>
        <button
          onClick={() => { fetchDashboardData(); fetchLeadsSummary(); fetchKpiCounts() }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Uppdatera
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Idag', value: todayCount, icon: Calendar, color: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15' },
          { label: 'Att göra', value: data.stats.pending_cases, icon: ClipboardList, color: 'text-amber-400', bg: 'bg-amber-500/15' },
          { label: 'Offerter', value: offerCount, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/15' },
          { label: 'Leads', value: leadsSummary.active, icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/15' },
        ].map(kpi => (
          <div key={kpi.label} className="flex flex-col items-center gap-1 py-2 bg-slate-800/30 border border-slate-700 rounded-xl">
            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            <span className="text-lg font-bold text-white">{kpi.value}</span>
            <span className="text-[10px] text-slate-400 font-medium">{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* ─── Section 1: Today's Schedule ─── */}
      {technicianId && <TodayScheduleCard technicianId={technicianId} />}

      {/* ─── Section 2: Case Summary ─── */}
      {technicianId && <CaseSummaryCard technicianId={technicianId} />}

      {/* ─── Section 3: Provisions-strip ─── */}
      <Link
        to="/technician/commissions"
        className="flex items-center justify-between px-3 py-2.5 bg-slate-800/30 border border-slate-700 rounded-xl hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#20c58f]" />
          <span className="text-sm text-slate-300">
            {formatCurrency(data.stats.current_month_commission)} denna månad
            <span className="text-slate-600 mx-1">|</span>
            {formatCurrency(data.stats.total_commission_ytd)} i år
          </span>
        </div>
        <span className="text-xs text-[#20c58f] font-medium">Visa detaljer</span>
      </Link>

      {/* ─── Section 3b: Offer Summary ─── */}
      <OfferSummaryCard technicianEmail={data.stats.technician_email} />

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

    </div>
  )
}
