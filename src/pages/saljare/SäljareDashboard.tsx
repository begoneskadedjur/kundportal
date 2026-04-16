// src/pages/saljare/SäljareDashboard.tsx
// Startsida för säljare — fokuserad på leads och försäljningspipeline
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  User,
  Calendar,
  Target,
  TrendingUp,
  ChevronRight,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import StaggeredGrid from '../../components/shared/StaggeredGrid'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { LEAD_STATUS_DISPLAY, type Lead, type LeadStatus } from '../../types/database'

interface DashboardStats {
  myActiveLeads: number
  totalLeads: number
  leadsThisWeek: number
  followUpsToday: number
  conversionRate: number
}

interface PipelineCount {
  status: LeadStatus
  count: number
}

export default function SäljareDashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    myActiveLeads: 0,
    totalLeads: 0,
    leadsThisWeek: 0,
    followUpsToday: 0,
    conversionRate: 0,
  })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [followUps, setFollowUps] = useState<Lead[]>([])
  const [pipeline, setPipeline] = useState<PipelineCount[]>([])

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData()
    }
  }, [profile?.id])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString()

      // Hämta alla leads parallellt
      const [allLeadsRes, recentRes, followUpsRes] = await Promise.all([
        supabase.from('leads').select('id, status, assigned_to'),
        supabase
          .from('leads')
          .select('*')
          .not('status', 'in', '(red_lost)')
          .order('updated_at', { ascending: false })
          .limit(10),
        supabase
          .from('leads')
          .select('id, company_name, follow_up_date, status, contact_person')
          .lte('follow_up_date', todayStr)
          .not('status', 'in', '(red_lost,green_deal)')
          .order('follow_up_date', { ascending: true })
          .limit(8),
      ])

      const allLeads = allLeadsRes.data || []
      const activeStatuses: LeadStatus[] = ['blue_cold', 'yellow_warm', 'orange_hot']
      const myActive = allLeads.filter(
        l => l.assigned_to === profile?.user_id && activeStatuses.includes(l.status as LeadStatus)
      ).length

      // Leads skapade denna vecka
      const { count: weekCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgoStr)

      const total = allLeads.length
      const deals = allLeads.filter(l => l.status === 'green_deal').length
      const convRate = total > 0 ? Math.round((deals / total) * 100) : 0

      setStats({
        myActiveLeads: myActive,
        totalLeads: total,
        leadsThisWeek: weekCount || 0,
        followUpsToday: (followUpsRes.data || []).length,
        conversionRate: convRate,
      })

      setRecentLeads(recentRes.data || [])
      setFollowUps(followUpsRes.data || [])

      // Pipeline-räknare per status
      const pipelineMap: Record<string, number> = {}
      for (const lead of allLeads) {
        pipelineMap[lead.status] = (pipelineMap[lead.status] || 0) + 1
      }
      const pipelineOrder: LeadStatus[] = ['blue_cold', 'yellow_warm', 'orange_hot', 'green_deal', 'red_lost']
      setPipeline(
        pipelineOrder
          .filter(s => pipelineMap[s])
          .map(s => ({ status: s, count: pipelineMap[s] }))
      )
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner text="Laddar dashboard..." />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Välkommen, {profile?.display_name || profile?.email?.split('@')[0]}
        </h1>
        <p className="text-slate-400 text-sm mt-1">Här är en översikt av dina leads och försäljningsaktiviteter.</p>
      </div>

      {/* KPI Cards */}
      <StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedKpiCard
          title="Mina aktiva leads"
          value={stats.myActiveLeads}
          icon={User}
          trend="neutral"
          trendValue={`av ${stats.totalLeads} totalt`}
          delay={0}
        />
        <EnhancedKpiCard
          title="Leads denna vecka"
          value={stats.leadsThisWeek}
          icon={Calendar}
          trend="up"
          trendValue="nya leads"
          delay={0.1}
        />
        <EnhancedKpiCard
          title="Uppföljningar idag"
          value={stats.followUpsToday}
          icon={Target}
          trend={stats.followUpsToday > 0 ? 'up' : 'neutral'}
          trendValue="att genomföra"
          delay={0.2}
        />
        <EnhancedKpiCard
          title="Konverteringsgrad"
          value={stats.conversionRate}
          suffix="%"
          icon={TrendingUp}
          trend={stats.conversionRate > 10 ? 'up' : stats.conversionRate > 5 ? 'neutral' : 'down'}
          trendValue="affärsavslut"
          delay={0.3}
        />
      </StaggeredGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Senaste leads */}
        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-400" />
              Senaste leads
            </h2>
            <Link
              to="/saljare/leads"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
            >
              Visa alla <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Inga leads hittades</p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map(lead => {
                const statusInfo = LEAD_STATUS_DISPLAY[lead.status as LeadStatus]
                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{lead.company_name}</p>
                      <p className="text-xs text-slate-400 truncate">{lead.contact_person}</p>
                    </div>
                    <span
                      className={`ml-3 flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusInfo?.badgeClass || 'bg-slate-700 text-slate-300 border-slate-600'}`}
                    >
                      {statusInfo?.label || lead.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Höger kolumn: Pipeline + Uppföljningar */}
        <div className="space-y-4">
          {/* Pipeline-status */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              Pipeline
            </h2>
            {pipeline.length === 0 ? (
              <p className="text-slate-500 text-sm py-2 text-center">Inga leads</p>
            ) : (
              <div className="space-y-2">
                {pipeline.map(({ status, count }) => {
                  const info = LEAD_STATUS_DISPLAY[status]
                  const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-300 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full bg-${info?.color || 'slate-500'}`} />
                          {info?.label || status}
                        </span>
                        <span className="text-xs font-medium text-slate-400">{count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-${info?.color || 'teal-500'} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kommande uppföljningar */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-400" />
              Uppföljningar
            </h2>
            {followUps.length === 0 ? (
              <p className="text-slate-500 text-sm py-2 text-center">Inga uppföljningar idag</p>
            ) : (
              <div className="space-y-2">
                {followUps.map(lead => (
                  <div key={lead.id} className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{lead.company_name}</p>
                      <p className="text-xs text-slate-400">
                        {lead.follow_up_date
                          ? new Date(lead.follow_up_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
                          : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {followUps.length > 0 && (
              <Link
                to="/saljare/leads"
                className="mt-3 flex items-center justify-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                Visa alla leads <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
