// src/pages/admin/Dashboard.tsx — CRM Dashboard med riktig data
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { motion } from 'framer-motion'
import {
  Users,
  FileText,
  Coins,
  UserCheck,
  Receipt,
  Target,
  Plus,
  ArrowRight,
  Calendar,
  Clock,
  FileCheck,
  ClipboardCheck,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'
import AdminKpiModal from '../../components/admin/AdminKpiModal'

// ============================================================
// TYPES
// ============================================================

interface DashboardStats {
  totalCustomers: number
  totalRevenue: number
  completedCasesPeriod: number
  completedCasesTrend: string
  activeTechnicians: number
  pendingCases: number
  scheduledToday: number
  completedToday: number
  teamToday: Array<{ initials: string; name: string; gradient: string }>
  absentToday: Array<{ name: string; reason: string }>
  revenueTrend: string
  sparkRevenue: number[]
  sparkCases: number[]
  sparkCustomers: number[]
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
  customers?: any[]
  technicians?: any[]
  privateCases?: any[]
  businessCases?: any[]
  revenueBreakdown?: {
    contracts: number
    privateCases: number
    businessCases: number
    legacyCases: number
    contractBilling: number
    caseBilling: number
  }
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80
  const h = 28
  const padding = 2
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2)
    const y = h - padding - ((v - min) / range) * (h - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const colorMap: Record<string, string> = {
    teal: '#2dd4bf',
    emerald: '#34d399',
    cyan: '#22d3ee',
    blue: '#60a5fa',
  }

  return (
    <svg width={w} height={h} className="mt-2 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color] || '#2dd4bf'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KpiCard({ title, value, icon: Icon, trend, color, sparkData, onClick }: {
  title: string; value: string; icon: React.ElementType; trend: string; color: string; sparkData?: number[]; onClick?: () => void
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  }
  const iconColorMap: Record<string, string> = {
    teal: 'text-teal-400',
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
  }
  const trendColor = trend.startsWith('+') ? 'text-emerald-400' : trend.startsWith('-') ? 'text-red-400' : 'text-slate-400'

  return (
    <div
      onClick={onClick}
      className={`block bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 cursor-pointer group`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        {trend && <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sparkData && sparkData.length > 1 && <MiniSparkline data={sparkData} color={color} />}
      <p className="text-sm text-slate-400 mt-2">{title}</p>
    </div>
  )
}

function QuickActionCard({ icon: Icon, label, desc, href, color }: {
  icon: React.ElementType; label: string; desc: string; href: string; color: string
}) {
  const iconBgMap: Record<string, string> = {
    teal: 'bg-teal-500/15 text-teal-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    purple: 'bg-purple-500/15 text-purple-400',
  }
  return (
    <Link
      to={href}
      className="group flex flex-col bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 hover:border-teal-500/30 hover:bg-slate-800/60 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBgMap[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  )
}

function ActivityItem({ title, desc, time, color, icon: Icon }: {
  title: string; desc: string; time: string; color: string; icon: React.ElementType
}) {
  const bgColorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    teal: 'bg-teal-500/15 text-teal-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    purple: 'bg-purple-500/15 text-purple-400',
    blue: 'bg-blue-500/15 text-blue-400',
  }
  return (
    <div className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-700/20 cursor-pointer transition-colors">
      <div className={`w-8 h-8 rounded-full ${bgColorMap[color]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
        <p className="text-xs text-slate-500 mt-1">{time}</p>
      </div>
    </div>
  )
}

function StatItem({ label, value, total, progress, color, valueColor }: {
  label: string; value: string; total?: number; progress?: number; color: string; valueColor?: string
}) {
  const barColorMap: Record<string, string> = {
    emerald: 'bg-emerald-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    teal: 'bg-teal-400',
    slate: 'bg-slate-500',
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`text-sm font-semibold ${valueColor || 'text-white'}`}>
          {value}{total ? `/${total}` : ''}
        </span>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 bg-slate-700/50 rounded-full mt-1.5">
          <div
            className={`h-1.5 rounded-full ${barColorMap[color]} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}


// ============================================================
// SPARKLINE HELPERS
// ============================================================

function buildDailyArray(
  items: Array<{ date: string; value: number }>,
  days: number,
  now: Date,
): number[] {
  const result = new Array(days).fill(0)
  for (const item of items) {
    const d = new Date(item.date)
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const idx = days - 1 - diffDays
    if (idx >= 0 && idx < days) {
      result[idx] += item.value
    }
  }
  return result
}

function buildCumulativeCustomers(
  totalCustomers: number,
  newCustomers: Array<{ date: string }>,
  days: number,
  now: Date,
): number[] {
  // Räkna nya kunder per dag, sedan subtrahera bakåt från total
  const newPerDay = new Array(days).fill(0)
  for (const c of newCustomers) {
    const d = new Date(c.date)
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const idx = days - 1 - diffDays
    if (idx >= 0 && idx < days) {
      newPerDay[idx]++
    }
  }
  // Bygg kumulativ: sista dagen = total, gå bakåt
  const result = new Array(days).fill(0)
  result[days - 1] = totalCustomers
  for (let i = days - 2; i >= 0; i--) {
    result[i] = result[i + 1] - newPerDay[i + 1]
  }
  return result
}


// ============================================================
// MAIN COMPONENT
// ============================================================

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'customers' | 'revenue' | 'cases' | 'technicians'>('customers')
  const [modalTitle, setModalTitle] = useState('')
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('week')

  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Admin'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'God morgon' : hour < 18 ? 'God eftermiddag' : 'God kväll'
  const today = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardStats(timePeriod)
  }, [timePeriod])

  const fetchDashboardStats = async (period: 'day' | 'week' | 'month' = 'month') => {
    try {
      // Första laddningen: visa spinner. Periodbyte: subtil refresh.
      if (!stats) setLoading(true)
      else setRefreshing(true)
      setError(null)

      const now = new Date()
      const todayDate = now.toISOString().split('T')[0]
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

      // Sparkline: senaste 7 dagarna
      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      const sevenDaysAgoISO = sevenDaysAgo.toISOString()

      // Beräkna periodstart och föregående period
      const periodStart = new Date(now)
      const prevPeriodStart = new Date(now)
      const prevPeriodEnd = new Date(now)

      if (period === 'day') {
        periodStart.setHours(0, 0, 0, 0)
        prevPeriodStart.setDate(prevPeriodStart.getDate() - 1)
        prevPeriodStart.setHours(0, 0, 0, 0)
        prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1)
        prevPeriodEnd.setHours(23, 59, 59, 999)
      } else if (period === 'week') {
        const dayOfWeek = periodStart.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Måndag = start
        periodStart.setDate(periodStart.getDate() - diff)
        periodStart.setHours(0, 0, 0, 0)
        prevPeriodStart.setDate(periodStart.getDate() - 7)
        prevPeriodStart.setHours(0, 0, 0, 0)
        prevPeriodEnd.setDate(periodStart.getDate() - 1)
        prevPeriodEnd.setHours(23, 59, 59, 999)
      } else {
        periodStart.setDate(1)
        periodStart.setHours(0, 0, 0, 0)
        prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1)
        prevPeriodStart.setDate(1)
        prevPeriodStart.setHours(0, 0, 0, 0)
        prevPeriodEnd.setDate(0) // Sista dagen föregående månad
        prevPeriodEnd.setHours(23, 59, 59, 999)
      }
      const periodStartISO = periodStart.toISOString()
      const prevStartISO = prevPeriodStart.toISOString()
      const prevEndISO = prevPeriodEnd.toISOString()

      const [
        customersResult,
        techniciansResult,
        absencesResult,
        profilesResult,
        // Öppna ärenden (ögonblicksbild)
        privateActiveResult,
        businessActiveResult,
        // Inbokade/slutförda idag
        privateScheduledResult,
        businessScheduledResult,
        privateCompletedTodayResult,
        businessCompletedTodayResult,
        // Genomförda ärenden denna period (gamla systemet)
        privatePeriodResult,
        businessPeriodResult,
        casesPeriodResult,
        // Genomförda ärenden föregående period (count)
        privatePrevCountResult,
        businessPrevCountResult,
        casesPrevCountResult,
        // Intäkt föregående period
        privatePrevResult,
        businessPrevResult,
        casesPrevResult,
        // Nya billing-systemet (denna period)
        contractBillingResult,
        caseBillingResult,
        // Nya billing-systemet (föregående period)
        contractBillingPrevResult,
        caseBillingPrevResult,
        // Sparkline: avslutade ärenden senaste 7 dagar
        privateSparkResult,
        businessSparkResult,
        casesSparkResult,
        // Sparkline: nya kunder senaste 7 dagar
        customersSparkResult,
      ] = await Promise.all([
        supabase.from('customers').select('id, company_name, annual_value').eq('is_active', true),
        supabase.from('technicians').select('id, name, role').eq('is_active', true).eq('role', 'Skadedjurstekniker'),
        supabase.from('technician_absences').select('technician_id, reason, technicians(name)')
          .lte('start_date', todayEnd)
          .gte('end_date', todayStart),
        supabase.from('profiles').select('id, display_name, role, technician_id, email, technicians(name)')
          .in('role', ['admin', 'koordinator', 'technician']).eq('is_active', true),
        // Öppna ärenden
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("Avslutat","Stängt - slasklogg")'),
        // Inbokade idag
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .gte('start_date', todayStart).lte('start_date', todayEnd),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .gte('start_date', todayStart).lte('start_date', todayEnd),
        // Slutförda idag
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat').gte('completed_date', todayStart).lte('completed_date', todayEnd),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat').gte('completed_date', todayStart).lte('completed_date', todayEnd),
        // Genomförda denna period (med pris för intäkt)
        supabase.from('private_cases').select('id, title, kontaktperson, pris, completed_date')
          .eq('status', 'Avslutat').gte('completed_date', periodStartISO),
        supabase.from('business_cases').select('id, title, kontaktperson, pris, completed_date')
          .eq('status', 'Avslutat').gte('completed_date', periodStartISO),
        supabase.from('cases').select('id, price, completed_date')
          .not('completed_date', 'is', null)
          .gte('completed_date', periodStartISO),
        // Genomförda föregående period (count)
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat')
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat')
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        supabase.from('cases').select('id', { count: 'exact', head: true })
          .not('completed_date', 'is', null)
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        // Intäkt föregående period
        supabase.from('private_cases').select('pris')
          .eq('status', 'Avslutat').not('pris', 'is', null)
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        supabase.from('business_cases').select('pris')
          .eq('status', 'Avslutat').not('pris', 'is', null)
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        supabase.from('cases').select('price')
          .not('completed_date', 'is', null).not('price', 'is', null)
          .gte('completed_date', prevStartISO).lte('completed_date', prevEndISO),
        // Nya billing denna period
        supabase.from('contract_billing_items').select('total_price')
          .in('status', ['invoiced', 'paid'])
          .gte('billing_period_start', periodStartISO),
        supabase.from('case_billing_items').select('total_price')
          .eq('status', 'billed')
          .gte('created_at', periodStartISO),
        // Nya billing föregående period
        supabase.from('contract_billing_items').select('total_price')
          .in('status', ['invoiced', 'paid'])
          .gte('billing_period_start', prevStartISO).lte('billing_period_start', prevEndISO),
        supabase.from('case_billing_items').select('total_price')
          .eq('status', 'billed')
          .gte('created_at', prevStartISO).lte('created_at', prevEndISO),
        // Sparkline: avslutade ärenden senaste 7 dagar (med pris och datum)
        supabase.from('private_cases').select('completed_date, pris')
          .eq('status', 'Avslutat').not('completed_date', 'is', null)
          .gte('completed_date', sevenDaysAgoISO),
        supabase.from('business_cases').select('completed_date, pris')
          .eq('status', 'Avslutat').not('completed_date', 'is', null)
          .gte('completed_date', sevenDaysAgoISO),
        supabase.from('cases').select('completed_date, price')
          .not('completed_date', 'is', null)
          .gte('completed_date', sevenDaysAgoISO),
        // Sparkline: nya kunder senaste 7 dagar
        supabase.from('customers').select('created_at')
          .eq('is_active', true)
          .gte('created_at', sevenDaysAgoISO),
      ])

      if (customersResult.error) throw customersResult.error
      if (techniciansResult.error) throw techniciansResult.error

      // Intäkt denna period
      const privateRevenue = privatePeriodResult.data?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
      const businessRevenue = businessPeriodResult.data?.reduce((sum, c) => sum + ((c.pris || 0) * 1.25), 0) || 0
      const caseRevenue = casesPeriodResult.data?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      const contractBillingRevenue = contractBillingResult.data?.reduce((sum, c) => sum + (c.total_price || 0), 0) || 0
      const caseBillingRevenue = caseBillingResult.data?.reduce((sum, c) => sum + (c.total_price || 0), 0) || 0
      const totalRevenue = privateRevenue + businessRevenue + caseRevenue + contractBillingRevenue + caseBillingRevenue

      // Intäkt föregående period
      const prevPrivateRevenue = privatePrevResult.data?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
      const prevBusinessRevenue = businessPrevResult.data?.reduce((sum, c) => sum + ((c.pris || 0) * 1.25), 0) || 0
      const prevCaseRevenue = casesPrevResult.data?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      const prevContractBilling = contractBillingPrevResult.data?.reduce((sum, c) => sum + (c.total_price || 0), 0) || 0
      const prevCaseBilling = caseBillingPrevResult.data?.reduce((sum, c) => sum + (c.total_price || 0), 0) || 0
      const prevTotalRevenue = prevPrivateRevenue + prevBusinessRevenue + prevCaseRevenue + prevContractBilling + prevCaseBilling

      // Trendberäkning
      const calcTrend = (current: number, previous: number): string => {
        if (previous === 0) return current > 0 ? '+100%' : '0%'
        const pct = Math.round(((current - previous) / previous) * 100)
        return pct >= 0 ? `+${pct}%` : `${pct}%`
      }
      const revenueTrend = calcTrend(totalRevenue, prevTotalRevenue)

      // Genomförda ärenden denna period
      const completedCasesPeriod = (privatePeriodResult.data?.length || 0)
        + (businessPeriodResult.data?.length || 0)
        + (casesPeriodResult.data?.length || 0)

      // Genomförda ärenden föregående period
      const prevCompletedCases = (privatePrevCountResult.count || 0)
        + (businessPrevCountResult.count || 0)
        + (casesPrevCountResult.count || 0)
      const completedCasesTrend = calcTrend(completedCasesPeriod, prevCompletedCases)

      // Öppna ärenden (ögonblicksbild)
      const pendingCases = (privateActiveResult.count || 0) + (businessActiveResult.count || 0)

      // Kontraktsintäkt (för breakdown)
      const contractRevenue = customersResult.data?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0

      const absentTechnicianIds = absencesResult.data?.map(absence => absence.technician_id) || []
      const availableTechnicians = techniciansResult.data?.filter(tech => !absentTechnicianIds.includes(tech.id)) || []

      // Frånvarande idag
      const absentToday = (absencesResult.data || []).map(a => ({
        name: (a as any).technicians?.name || 'Okänd',
        reason: a.reason || 'Frånvarande',
      }))

      // Teamet idag
      const gradients = [
        'from-blue-500 to-cyan-500',
        'from-purple-500 to-pink-500',
        'from-teal-500 to-emerald-500',
        'from-amber-500 to-orange-500',
        'from-rose-500 to-red-500',
        'from-indigo-500 to-violet-500',
        'from-emerald-500 to-lime-500',
        'from-sky-500 to-blue-500',
      ]
      const teamToday = (profilesResult.data || [])
        .filter(p => !p.technician_id || !absentTechnicianIds.includes(p.technician_id))
        .map((p, i) => {
          const name = p.display_name
            || (p as any).technicians?.name
            || p.email?.split('@')[0]
            || 'Okänd'
          const parts = name.split(' ')
          const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase()
          return { initials, name, gradient: gradients[i % gradients.length] }
        })

      const scheduledToday = (privateScheduledResult.count || 0) + (businessScheduledResult.count || 0)
      const completedToday = (privateCompletedTodayResult.count || 0) + (businessCompletedTodayResult.count || 0)

      // Sparkline-data: daglig intäkt och antal avslutade senaste 7 dagar
      const sparkNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const allSparkItems = [
        ...(privateSparkResult.data || []).map(c => ({
          date: c.completed_date!,
          revenue: c.pris || 0,
        })),
        ...(businessSparkResult.data || []).map(c => ({
          date: c.completed_date!,
          revenue: (c.pris || 0) * 1.25,
        })),
        ...(casesSparkResult.data || []).map(c => ({
          date: c.completed_date!,
          revenue: c.price || 0,
        })),
      ]

      const sparkRevenue = buildDailyArray(
        allSparkItems.map(i => ({ date: i.date, value: i.revenue })),
        7, sparkNow
      )
      const sparkCases = buildDailyArray(
        allSparkItems.map(i => ({ date: i.date, value: 1 })),
        7, sparkNow
      )

      const totalCustomers = customersResult.data?.length || 0
      const sparkCustomers = buildCumulativeCustomers(
        totalCustomers,
        (customersSparkResult.data || []).map(c => ({ date: c.created_at })),
        7, sparkNow
      )

      setStats({
        totalCustomers,
        totalRevenue,
        completedCasesPeriod,
        completedCasesTrend,
        activeTechnicians: availableTechnicians.length || 0,
        pendingCases,
        scheduledToday,
        completedToday,
        teamToday,
        absentToday,
        revenueTrend,
        sparkRevenue,
        sparkCases,
        sparkCustomers,
        recentActivity: [],
        customers: customersResult.data || [],
        technicians: availableTechnicians || [],
        privateCases: privatePeriodResult.data || [],
        businessCases: businessPeriodResult.data || [],
        revenueBreakdown: {
          contracts: contractRevenue,
          privateCases: privateRevenue,
          businessCases: businessRevenue,
          legacyCases: caseRevenue,
          contractBilling: contractBillingRevenue,
          caseBilling: caseBillingRevenue,
        }
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleKpiClick = (type: 'customers' | 'revenue' | 'cases' | 'technicians', title: string) => {
    setModalType(type)
    setModalTitle(title)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner text="Laddar dashboard..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="p-8 max-w-md backdrop-blur-sm bg-slate-800/70 border border-slate-700/50 rounded-2xl shadow-2xl text-center">
          <div className="text-red-400 mb-4">Fel vid laddning av dashboard</div>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => fetchDashboardStats(timePeriod)}>Försök igen</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {greeting}, <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">{userName}</span>
          </h1>
          <p className="text-base text-slate-400 mt-1 capitalize">{today}</p>
          <p className="text-sm text-slate-500 mt-1">
            {stats?.pendingCases || 0} öppna ärenden och {stats?.activeTechnicians || 0} aktiva tekniker idag
          </p>
        </motion.div>

        {/* Time period selector + KPI Cards */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Nyckeltal</h2>
            <div className="inline-flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
              {(['day', 'week', 'month'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`text-xs px-3 py-1 rounded-md transition-all duration-200 ${
                    timePeriod === period
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {period === 'day' ? 'Idag' : period === 'week' ? 'Vecka' : 'Månad'}
                </button>
              ))}
            </div>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity duration-300 ${refreshing ? 'opacity-60' : ''}`}>
            {[
              {
                title: 'Avtalskunder',
                value: String(stats?.totalCustomers || 0),
                icon: Users,
                trend: '',
                color: 'teal' as const,
                sparkData: stats?.sparkCustomers,
                kpiType: 'customers' as const,
                kpiTitle: 'Avtalskunder',
              },
              {
                title: timePeriod === 'day' ? 'Intäkt idag' : timePeriod === 'week' ? 'Intäkt veckan' : 'Intäkt månaden',
                value: formatCurrency(stats?.totalRevenue || 0),
                icon: Coins,
                trend: stats?.revenueTrend || '',
                color: 'emerald' as const,
                sparkData: stats?.sparkRevenue,
                kpiType: 'revenue' as const,
                kpiTitle: 'Intäkt',
              },
              {
                title: timePeriod === 'day' ? 'Genomförda idag' : timePeriod === 'week' ? 'Genomförda veckan' : 'Genomförda månaden',
                value: String(stats?.completedCasesPeriod || 0),
                icon: FileCheck,
                trend: stats?.completedCasesTrend || '',
                color: 'cyan' as const,
                sparkData: stats?.sparkCases,
                kpiType: 'cases' as const,
                kpiTitle: 'Genomförda ärenden',
              },
              {
                title: 'Aktiva tekniker',
                value: String(stats?.activeTechnicians || 0),
                icon: UserCheck,
                trend: '',
                color: 'blue' as const,
                sparkData: undefined,
                kpiType: 'technicians' as const,
                kpiTitle: 'Aktiva Tekniker',
              },
            ].map((kpi, index) => (
              <motion.div
                key={kpi.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + index * 0.06 }}
              >
                <KpiCard
                  title={kpi.title}
                  value={kpi.value}
                  icon={kpi.icon}
                  trend={kpi.trend}
                  color={kpi.color}
                  sparkData={kpi.sparkData}
                  onClick={() => handleKpiClick(kpi.kpiType, kpi.kpiTitle)}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Snabbåtgärder</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Plus, label: 'Skapa avtal', desc: 'Generera via Oneflow', href: '/admin/oneflow-contract-creator', color: 'teal' },
              { icon: Receipt, label: 'Ny faktura', desc: 'Skapa och skicka', href: '/admin/invoicing', color: 'emerald' },
              { icon: Users, label: 'Sök kund', desc: 'Sök i kundregistret', href: '/admin/customers', color: 'cyan' },
              { icon: Target, label: 'Ny lead', desc: 'Lägg till prospekt', href: '/admin/leads', color: 'purple' },
            ].map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 + index * 0.06 }}
              >
                <QuickActionCard {...action} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Activity & Today panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <motion.div
            className="lg:col-span-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.5 }}
          >
            <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-400" />
              Senaste aktivitet
            </h3>
            <div className="space-y-1">
              {[
                { title: 'Nytt avtal signerat', desc: 'Skanskas avtal för skadedjurskontroll signerat via Oneflow', time: '12 min sedan', color: 'emerald', icon: FileCheck },
                { title: 'Faktura skickad', desc: 'Faktura #2024-0147 skickad till Vasakronan AB', time: '45 min sedan', color: 'teal', icon: Receipt },
                { title: 'Nytt ärende', desc: 'Privat ärende tilldelat tekniker Erik Lundberg', time: '1 timme sedan', color: 'cyan', icon: FileText },
                { title: 'Lead tillagd', desc: 'Ny lead från webbformuläret: Fastighets AB Centrum', time: '2 timmar sedan', color: 'purple', icon: Target },
                { title: 'Inspektion slutförd', desc: 'Kvartalsinspektion hos ICA Maxi Barkarby av Johan Karlsson', time: '3 timmar sedan', color: 'blue', icon: ClipboardCheck },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 + index * 0.06 }}
                >
                  <ActivityItem {...item} />
                </motion.div>
              ))}
            </div>
            <Link to="/admin/customers" className="flex items-center gap-1 mt-4 text-sm text-teal-400 hover:text-teal-300 transition-colors">
              Visa all aktivitet
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Today panel */}
          <motion.div
            className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.55 }}
          >
            <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-400" />
              Idag
            </h3>
            <div className="space-y-4">
              <StatItem label="Planerade besök" value={String(stats?.scheduledToday || 0)} progress={stats?.scheduledToday ? Math.round(((stats?.completedToday || 0) / stats.scheduledToday) * 100) : 0} color="teal" />
              <StatItem label="Slutförda" value={String(stats?.completedToday || 0)} color="emerald" valueColor="text-emerald-400" />
              <StatItem label="Öppna ärenden" value={String(stats?.pendingCases || 0)} color="blue" valueColor="text-blue-400" />
              <StatItem label="Aktiva tekniker" value={String(stats?.activeTechnicians || 0)} color="teal" valueColor="text-teal-400" />
            </div>

            {/* Team avatars */}
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-400 mb-3">Teamet idag</h4>
              <div className="flex items-center flex-wrap gap-y-1">
                {(stats?.teamToday || []).map((member, i) => (
                  <div
                    key={member.name}
                    className={`w-8 h-8 rounded-full border-2 border-slate-800 bg-gradient-to-br ${member.gradient} flex items-center justify-center ${i > 0 ? '-ml-2' : ''}`}
                    title={member.name}
                  >
                    <span className="text-[10px] text-white font-bold">{member.initials}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Frånvarande */}
            {stats?.absentToday && stats.absentToday.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-400 mb-2">Frånvarande</h4>
                <div className="space-y-1.5">
                  {stats.absentToday.map(person => (
                    <div key={person.name} className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{person.name}</span>
                      <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">{person.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </div>
      </div>

      {/* KPI Modal */}
      <AdminKpiModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        kpiType={modalType}
        data={{
          customers: stats?.customers,
          technicians: stats?.technicians,
          cases: [...(stats?.privateCases || []), ...(stats?.businessCases || [])],
          revenue: {
            total: stats?.totalRevenue || 0,
            breakdown: stats?.revenueBreakdown || {
              contracts: 0,
              privateCases: 0,
              businessCases: 0,
              legacyCases: 0,
              contractBilling: 0,
              caseBilling: 0,
            }
          }
        }}
      />
    </>
  )
}

export default AdminDashboard
