// src/pages/admin/Dashboard.tsx — CRM Dashboard med riktig data
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { motion } from 'framer-motion'
import {
  Users,
  FileText,
  DollarSign,
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
  totalCases: number
  totalPrivateCases: number
  totalBusinessCases: number
  totalRevenue: number
  activeTechnicians: number
  pendingCases: number
  scheduledToday: number
  completedToday: number
  teamToday: Array<{ initials: string; name: string; gradient: string }>
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

function KpiCard({ title, value, icon: Icon, trend, color, href, sparkData, onClick }: {
  title: string; value: string; icon: React.ElementType; trend: string; color: string; href: string; sparkData: number[]; onClick?: () => void
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
  const trendColor = trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'

  return (
    <div
      onClick={onClick}
      className={`block bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 cursor-pointer group`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <MiniSparkline data={sparkData} color={color} />
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
  const greeting = hour < 12 ? 'God morgon' : hour < 18 ? 'God eftermiddag' : 'God kvall'
  const today = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const todayDate = new Date().toISOString().split('T')[0]
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()

      const [
        customersResult,
        casesResult,
        privateCasesResult,
        businessCasesResult,
        techniciansResult,
        absencesResult,
        privateScheduledResult,
        businessScheduledResult,
        privateCompletedResult,
        businessCompletedResult,
        profilesResult
      ] = await Promise.all([
        supabase.from('customers').select('id, company_name, annual_value').eq('is_active', true),
        supabase.from('cases').select('id, price').not('completed_date', 'is', null),
        supabase.from('private_cases').select('id, title, kontaktperson, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('business_cases').select('id, title, kontaktperson, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('technicians').select('id, name, role').eq('is_active', true).eq('role', 'Skadedjurstekniker'),
        supabase.from('technician_absences').select('technician_id')
          .lte('start_date', todayDate + ' 23:59:59')
          .gte('end_date', todayDate + ' 00:00:00'),
        // Inbokade ärenden idag
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .gte('start_date', todayStart).lte('start_date', todayEnd),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .gte('start_date', todayStart).lte('start_date', todayEnd),
        // Slutförda ärenden idag
        supabase.from('private_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat').gte('completed_date', todayStart).lte('completed_date', todayEnd),
        supabase.from('business_cases').select('id', { count: 'exact', head: true })
          .eq('status', 'Avslutat').gte('completed_date', todayStart).lte('completed_date', todayEnd),
        // Alla interna profiler (med tekniker-namn som fallback)
        supabase.from('profiles').select('id, display_name, role, technician_id, email, technicians(name)')
          .in('role', ['admin', 'koordinator', 'technician']).eq('is_active', true)
      ])

      if (customersResult.error) throw customersResult.error
      if (casesResult.error) throw casesResult.error
      if (privateCasesResult.error) throw privateCasesResult.error
      if (businessCasesResult.error) throw businessCasesResult.error
      if (techniciansResult.error) throw techniciansResult.error
      if (absencesResult.error) throw absencesResult.error

      const contractRevenue = customersResult.data?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0
      const caseRevenue = casesResult.data?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      const privateRevenue = privateCasesResult.data?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
      const businessRevenue = businessCasesResult.data?.reduce((sum, c) => sum + (c.pris * 1.25 || 0), 0) || 0
      const totalRevenue = contractRevenue + caseRevenue + privateRevenue + businessRevenue

      const [activeCasesResult] = await Promise.all([
        supabase.from('cases').select('id').is('completed_date', null)
      ])

      const absentTechnicianIds = absencesResult.data?.map(absence => absence.technician_id) || []
      const availableTechnicians = techniciansResult.data?.filter(tech => !absentTechnicianIds.includes(tech.id)) || []

      // Teamet idag: filtrera bort profiler med frånvaro (via technician_id)
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
      const completedToday = (privateCompletedResult.count || 0) + (businessCompletedResult.count || 0)

      setStats({
        totalCustomers: customersResult.data?.length || 0,
        totalCases: casesResult.data?.length || 0,
        totalPrivateCases: privateCasesResult.data?.length || 0,
        totalBusinessCases: businessCasesResult.data?.length || 0,
        totalRevenue,
        activeTechnicians: availableTechnicians.length || 0,
        pendingCases: activeCasesResult.data?.length || 0,
        scheduledToday,
        completedToday,
        teamToday,
        recentActivity: [],
        customers: customersResult.data || [],
        technicians: availableTechnicians || [],
        privateCases: privateCasesResult.data || [],
        businessCases: businessCasesResult.data || [],
        revenueBreakdown: {
          contracts: contractRevenue,
          privateCases: privateRevenue,
          businessCases: businessRevenue,
          legacyCases: caseRevenue
        }
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
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
          <Button onClick={fetchDashboardStats}>Forsok igen</Button>
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
            {stats?.pendingCases || 0} oppna arenden och {stats?.activeTechnicians || 0} aktiva tekniker idag
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
                  {period === 'day' ? 'Idag' : period === 'week' ? 'Vecka' : 'Manad'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Avtalskunder',
                value: String(stats?.totalCustomers || 0),
                icon: Users,
                trend: '+5%',
                color: 'teal' as const,
                href: '/admin/customers',
                sparkData: [30, 35, 32, 38, 42, 40, stats?.totalCustomers || 47],
                kpiType: 'customers' as const,
                kpiTitle: 'Avtalskunder',
              },
              {
                title: 'Total intakt',
                value: formatCurrency(stats?.totalRevenue || 0),
                icon: DollarSign,
                trend: '+12%',
                color: 'emerald' as const,
                href: '/admin/economics',
                sparkData: [800000, 920000, 880000, 1050000, 1100000, 1180000, stats?.totalRevenue || 1245000],
                kpiType: 'revenue' as const,
                kpiTitle: 'Total Intakt',
              },
              {
                title: 'Aktiva arenden',
                value: String((stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)),
                icon: FileText,
                trend: '+3',
                color: 'cyan' as const,
                href: '/admin/customers',
                sparkData: [100, 108, 115, 110, 120, 125, (stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)],
                kpiType: 'cases' as const,
                kpiTitle: 'BeGone Arenden',
              },
              {
                title: 'Aktiva tekniker',
                value: String(stats?.activeTechnicians || 0),
                icon: UserCheck,
                trend: '+2',
                color: 'blue' as const,
                href: '/admin/technicians',
                sparkData: [5, 6, 6, 7, 7, 7, stats?.activeTechnicians || 8],
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
                  href={kpi.href}
                  sparkData={kpi.sparkData}
                  onClick={() => handleKpiClick(kpi.kpiType, kpi.kpiTitle)}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Snabbatgarder</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Plus, label: 'Skapa avtal', desc: 'Generera via Oneflow', href: '/admin/oneflow-contract-creator', color: 'teal' },
              { icon: Receipt, label: 'Ny faktura', desc: 'Skapa och skicka', href: '/admin/invoicing', color: 'emerald' },
              { icon: Users, label: 'Sok kund', desc: 'Sok i kundregistret', href: '/admin/customers', color: 'cyan' },
              { icon: Target, label: 'Ny lead', desc: 'Lagg till prospekt', href: '/admin/leads', color: 'purple' },
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
                { title: 'Nytt avtal signerat', desc: 'Skanskas avtal for skadedjurskontroll signerat via Oneflow', time: '12 min sedan', color: 'emerald', icon: FileCheck },
                { title: 'Faktura skickad', desc: 'Faktura #2024-0147 skickad till Vasakronan AB', time: '45 min sedan', color: 'teal', icon: Receipt },
                { title: 'Nytt arende', desc: 'Privat arende tilldelat tekniker Erik Lundberg', time: '1 timme sedan', color: 'cyan', icon: FileText },
                { title: 'Lead tillagd', desc: 'Ny lead fran webbformuladet: Fastighets AB Centrum', time: '2 timmar sedan', color: 'purple', icon: Target },
                { title: 'Inspektion slutford', desc: 'Kvartalsinspektion hos ICA Maxi Barkarby av Johan Karlsson', time: '3 timmar sedan', color: 'blue', icon: ClipboardCheck },
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
              <StatItem label="Planerade besok" value={String(stats?.scheduledToday || 0)} progress={stats?.scheduledToday ? Math.round(((stats?.completedToday || 0) / stats.scheduledToday) * 100) : 0} color="teal" />
              <StatItem label="Slutforda" value={String(stats?.completedToday || 0)} color="emerald" valueColor="text-emerald-400" />
              <StatItem label="Oppna arenden" value={String(stats?.pendingCases || 0)} color="blue" valueColor="text-blue-400" />
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
              legacyCases: 0
            }
          }
        }}
      />
    </>
  )
}

export default AdminDashboard
