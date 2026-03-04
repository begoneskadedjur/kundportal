import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { motion } from 'framer-motion'
import {
  CalendarDays, Users, PieChart, Wrench, AlertTriangle,
  Search, FileSignature, Sparkles, ArrowRight,
  Clock, FileX, CalendarX, ChevronRight
} from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

// Existing components
import KpiCaseListModal from '../../components/admin/coordinator/KpiCaseListModal'
import GeographicOverview from '../../components/admin/coordinator/GeographicOverview'
import EventLogCard from '../../components/shared/EventLogCard'
import GlobalCoordinatorChat from '../../components/coordinator/GlobalCoordinatorChat'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import StaggeredGrid from '../../components/shared/StaggeredGrid'

// New dashboard components
import AlertsBanner from '../../components/coordinator/dashboard/AlertsBanner'
import type { AlertItem } from '../../components/coordinator/dashboard/AlertsBanner'
import TechnicianUtilizationCard from '../../components/coordinator/dashboard/TechnicianUtilizationCard'
import OfferPipelineSnapshot from '../../components/coordinator/dashboard/OfferPipelineSnapshot'

// Hooks (all real data)
import { usePendingCases } from '../../hooks/usePendingCases'
import { useTechnicianUtilization } from '../../hooks/useCoordinatorAnalytics'
import { useOfferStats } from '../../hooks/useOfferStats'

// Services
import { getExpiringContracts, type ExpiringContract } from '../../services/economicsService'

// Types
import { BeGoneCaseRow, Technician } from '../../types/database'

// ============================================================
// HELPERS
// ============================================================

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 10) return 'God morgon'
  if (hour < 17) return 'God eftermiddag'
  return 'God kväll'
}

function formatSwedishDate(): string {
  return new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ============================================================
// QUICK ACTION CARD (inline, following admin pattern)
// ============================================================

function QuickActionCard({ icon: Icon, label, description, to }: {
  icon: React.ElementType; label: string; description: string; to: string
}) {
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600 hover:bg-slate-800/60 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <Icon className="w-4 h-4 text-[#20c58f]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-slate-500 truncate">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] transition-colors" />
        </div>
      </motion.div>
    </Link>
  )
}

// ============================================================
// MAIN DASHBOARD
// ============================================================

export default function CoordinatorDashboard() {
  const { profile } = useAuth()

  // --- Core KPI state (existing pattern, unchanged logic) ---
  const [kpiData, setKpiData] = useState({
    unplanned: 0,
    scheduledToday: 0,
    activeTechnicians: '0/0' as string | number,
    completedWeek: 0,
  })
  // Trend comparison state
  const [prevUnplanned, setPrevUnplanned] = useState<number | null>(null)
  const [prevCompletedWeek, setPrevCompletedWeek] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state (existing)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalData, setModalData] = useState<{
    title: string
    cases: BeGoneCaseRow[]
    technicians?: Technician[]
    absences?: any[]
    kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians'
  }>({ title: '', cases: [], technicians: [], absences: [], kpiType: 'unplanned' })

  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([])
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([])
  const [currentAbsences, setCurrentAbsences] = useState<any[]>([])

  // --- New hooks (all real data) ---
  const { urgentCount, oldRequestsCount } = usePendingCases()
  const { data: utilizationData, loading: utilizationLoading } = useTechnicianUtilization()
  const { stats: offerStats, loading: offerLoading } = useOfferStats()

  // Expiring contracts state
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([])

  // Alert banner state (dismissible)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  // --- Fetch all dashboard data ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)

        const today = new Date()
        const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()
        const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString()

        const weekAgo = new Date()
        weekAgo.setDate(new Date().getDate() - 7)
        const weekAgoStart = new Date(weekAgo.setHours(0, 0, 0, 0)).toISOString()

        // Previous period for trend comparison
        const twoWeeksAgo = new Date()
        twoWeeksAgo.setDate(new Date().getDate() - 14)
        const twoWeeksAgoStart = new Date(twoWeeksAgo.setHours(0, 0, 0, 0)).toISOString()

        const todayDateString = new Date().toISOString().split('T')[0]
        const unplannedStatuses = ['Öppen', 'Offert signerad - boka in']

        const [
          unplannedPrivate,
          unplannedBusiness,
          scheduledPrivate,
          scheduledBusiness,
          completedPrivate,
          completedBusiness,
          techniciansResult,
          absenceResult,
          allPrivateCases,
          allBusinessCases,
          // Trend: previous week
          prevCompletedPrivate,
          prevCompletedBusiness,
          // Expiring contracts
          expiringContractsResult,
        ] = await Promise.all([
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).in('status', unplannedStatuses),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).in('status', unplannedStatuses),
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).gte('start_date', todayStart).lte('start_date', todayEnd),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).gte('start_date', todayStart).lte('start_date', todayEnd),
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).gte('completed_date', weekAgoStart),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).gte('completed_date', weekAgoStart),
          supabase.from('technicians').select('*').eq('is_active', true).eq('role', 'Skadedjurstekniker'),
          supabase.from('technician_absences').select('*')
            .lte('start_date', todayDateString + ' 23:59:59')
            .gte('end_date', todayDateString + ' 00:00:00'),
          supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
          supabase.from('business_cases').select('*').order('created_at', { ascending: false }),
          // Previous 7 days (for trend): completed between 14 and 7 days ago
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).gte('completed_date', twoWeeksAgoStart).lt('completed_date', weekAgoStart),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).gte('completed_date', twoWeeksAgoStart).lt('completed_date', weekAgoStart),
          // Expiring contracts
          getExpiringContracts().catch(() => [] as ExpiringContract[]),
        ])

        const errors = [
          unplannedPrivate.error, unplannedBusiness.error,
          scheduledPrivate.error, scheduledBusiness.error,
          completedPrivate.error, completedBusiness.error,
          techniciansResult.error, absenceResult.error,
          allPrivateCases.error, allBusinessCases.error,
          prevCompletedPrivate.error, prevCompletedBusiness.error,
        ].filter(Boolean)

        if (errors.length > 0) {
          throw new Error(errors.map(e => e!.message).join(', '))
        }

        const combinedCases = [
          ...(allPrivateCases.data || []).map(c => ({ ...c, case_type: 'private' as const })),
          ...(allBusinessCases.data || []).map(c => ({ ...c, case_type: 'business' as const }))
        ]

        setAllCases(combinedCases as BeGoneCaseRow[])
        setAllTechnicians(techniciansResult.data || [])
        setCurrentAbsences(absenceResult.data || [])

        const totalUnplanned = (unplannedPrivate.count ?? 0) + (unplannedBusiness.count ?? 0)
        const totalScheduledToday = (scheduledPrivate.count ?? 0) + (scheduledBusiness.count ?? 0)
        const totalCompletedWeek = (completedPrivate.count ?? 0) + (completedBusiness.count ?? 0)

        const allSkadedjurstekniker = techniciansResult.data || []
        const absences = absenceResult.data || []
        const absentTechnicianIds = absences.map(a => a.technician_id)
        const availableTechnicians = allSkadedjurstekniker.filter(tech => !absentTechnicianIds.includes(tech.id))

        setKpiData({
          unplanned: totalUnplanned,
          scheduledToday: totalScheduledToday,
          activeTechnicians: `${availableTechnicians.length}/${allSkadedjurstekniker.length}`,
          completedWeek: totalCompletedWeek,
        })

        // Trend data (previous period)
        const prevCompleted = (prevCompletedPrivate.count ?? 0) + (prevCompletedBusiness.count ?? 0)
        setPrevCompletedWeek(prevCompleted)
        // We'll use the current unplanned count as "snapshot" — no previous value for unplanned makes sense
        setPrevUnplanned(null)

        // Expiring contracts
        setExpiringContracts(expiringContractsResult as ExpiringContract[])
      } catch (err: any) {
        console.error('Fel vid hämtning av dashboard-data:', err.message)
        setError('Kunde inte ladda dashboard-data.')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // --- Derived data ---
  const casesToBookIn = allCases.filter(c => c.status === 'Offert signerad - boka in')
  const latestToBookIn = casesToBookIn.slice(0, 5)

  // Trend calculations (only from real data)
  const completedTrend = prevCompletedWeek !== null && prevCompletedWeek > 0
    ? { trend: kpiData.completedWeek >= prevCompletedWeek ? 'up' as const : 'down' as const,
        value: `${Math.round(((kpiData.completedWeek - prevCompletedWeek) / prevCompletedWeek) * 100)}%` }
    : null

  // --- Alert items (all from real data sources) ---
  const allAlerts: AlertItem[] = [
    ...(urgentCount > 0 ? [{
      id: 'urgent-cases',
      type: 'error' as const,
      icon: AlertTriangle,
      label: `${urgentCount} brådskande ärenden`,
    }] : []),
    ...(oldRequestsCount > 0 ? [{
      id: 'old-requests',
      type: 'warning' as const,
      icon: Clock,
      label: `${oldRequestsCount} ärenden väntar > 24h`,
    }] : []),
    ...(offerStats && offerStats.overdue > 0 ? [{
      id: 'overdue-offers',
      type: 'error' as const,
      icon: FileX,
      label: `${offerStats.overdue} offerter förfallna`,
    }] : []),
    ...(expiringContracts.length > 0 ? [{
      id: 'expiring-contracts',
      type: 'warning' as const,
      icon: CalendarX,
      label: `${expiringContracts.length} kontrakt löper ut snart`,
    }] : []),
  ].filter(a => !dismissedAlerts.has(a.id))

  const handleDismissAlert = (id: string) => {
    setDismissedAlerts(prev => new Set(prev).add(id))
  }

  // --- KPI card click handlers (existing logic) ---
  const getUnplannedCases = () => allCases.filter(c => ['Öppen', 'Offert signerad - boka in'].includes(c.status))

  const getScheduledTodayCases = () => {
    const today = new Date()
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString()
    return allCases.filter(c => c.start_date && c.start_date >= todayStart && c.start_date <= todayEnd)
  }

  const getCompletedWeekCases = () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStart = new Date(weekAgo.setHours(0, 0, 0, 0)).toISOString()
    return allCases.filter(c => c.completed_date && c.completed_date >= weekAgoStart)
  }

  const handleKpiCardClick = (kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians') => {
    let title = ''
    let cases: BeGoneCaseRow[] = []
    let technicians: Technician[] | undefined = undefined
    let absences: any[] | undefined = undefined

    switch (kpiType) {
      case 'unplanned':
        title = 'Oplanerade Ärenden'
        cases = getUnplannedCases()
        break
      case 'scheduled':
        title = 'Schemalagda Idag'
        cases = getScheduledTodayCases()
        break
      case 'completed':
        title = 'Avslutade (7 dagar)'
        cases = getCompletedWeekCases()
        break
      case 'technicians':
        title = 'Tekniker Status'
        technicians = allTechnicians
        absences = currentAbsences
        break
    }

    setModalData({ title, cases, technicians, absences, kpiType })
    setIsModalOpen(true)
  }

  // --- Available technician count for greeting ---
  const availableCount = typeof kpiData.activeTechnicians === 'string'
    ? kpiData.activeTechnicians.split('/')[0]
    : kpiData.activeTechnicians

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 text-white space-y-6">

      {/* === A. Welcome Header === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {profile?.display_name?.split(' ')[0] || 'Koordinator'}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          <span className="capitalize">{formatSwedishDate()}</span>
          {!loading && (
            <span className="ml-2 text-slate-500">
              · {kpiData.unplanned} att boka in · {kpiData.scheduledToday} besök idag · {availableCount} tekniker tillgängliga
            </span>
          )}
        </p>
      </motion.div>

      {/* === B. Alerts Banner (conditional) === */}
      {allAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <AlertsBanner alerts={allAlerts} onDismiss={handleDismissAlert} />
        </motion.div>
      )}

      {/* === C. KPI Cards (Enhanced) === */}
      {error ? (
        <div className="bg-red-900/20 border border-red-500/30 text-red-300 p-4 rounded-lg flex items-center gap-4">
          <AlertTriangle className="w-6 h-6" />
          <div>
            <p className="font-bold">Ett fel uppstod</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : (
        <StaggeredGrid
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          staggerDelay={0.08}
          initialDelay={0.15}
        >
          <EnhancedKpiCard
            title="Oplanerade Ärenden"
            value={loading ? 0 : kpiData.unplanned}
            icon={Wrench}
            onClick={() => handleKpiCardClick('unplanned')}
            isNumeric={true}
          />
          <EnhancedKpiCard
            title="Schemalagda Idag"
            value={loading ? 0 : kpiData.scheduledToday}
            icon={CalendarDays}
            onClick={() => handleKpiCardClick('scheduled')}
            isNumeric={true}
          />
          <EnhancedKpiCard
            title="Aktiva Tekniker"
            value={loading ? '...' : kpiData.activeTechnicians}
            icon={Users}
            onClick={() => handleKpiCardClick('technicians')}
            isNumeric={false}
          />
          <EnhancedKpiCard
            title="Avslutade (7 dagar)"
            value={loading ? 0 : kpiData.completedWeek}
            icon={PieChart}
            onClick={() => handleKpiCardClick('completed')}
            isNumeric={true}
            trend={completedTrend?.trend}
            trendValue={completedTrend?.value}
          />
        </StaggeredGrid>
      )}

      {/* === D. Quick Actions === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <QuickActionCard
          icon={CalendarDays}
          label="Schemalägg ärende"
          description="Öppna schemakalendern"
          to="/koordinator/schema"
        />
        <QuickActionCard
          icon={Search}
          label="Sök ärenden"
          description="Hitta specifikt ärende"
          to="/koordinator/sok-arenden"
        />
        <QuickActionCard
          icon={FileSignature}
          label="Offertuppföljning"
          description="Pipeline och förfallna"
          to="/koordinator/offertuppfoljning"
        />
        <QuickActionCard
          icon={Sparkles}
          label="Bokningsassistent"
          description="AI-optimerad inbokning"
          to="/koordinator/booking-assistant"
        />
      </motion.div>

      {/* === E. Insights Row (2 columns) === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* E1: Signed offers awaiting booking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
                <FileSignature className="w-4 h-4 text-[#20c58f]" />
              </div>
              <h3 className="text-sm font-semibold text-white">Att boka in</h3>
            </div>
            <span className="text-2xl font-bold text-white">{casesToBookIn.length}</span>
          </div>

          {loading ? (
            <div className="text-sm text-slate-500">Laddar...</div>
          ) : latestToBookIn.length === 0 ? (
            <p className="text-sm text-slate-500">Inga signerade offerter väntar på bokning</p>
          ) : (
            <div className="space-y-2">
              {latestToBookIn.map((c) => {
                const daysSinceSigned = c.completed_date
                  ? Math.floor((Date.now() - new Date(c.completed_date).getTime()) / (1000 * 60 * 60 * 24))
                  : null
                return (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{c.title || 'Utan titel'}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.kontaktperson || c.adress || '—'}
                      </p>
                    </div>
                    {daysSinceSigned !== null && daysSinceSigned >= 0 && (
                      <span className={`text-xs ml-2 flex-shrink-0 ${daysSinceSigned > 7 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {daysSinceSigned}d sedan
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {casesToBookIn.length > 5 && (
            <Link
              to="/koordinator/schema"
              className="mt-3 flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
            >
              Visa alla {casesToBookIn.length} ärenden
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </motion.div>

        {/* E2: Technician Utilization */}
        <TechnicianUtilizationCard data={utilizationData} loading={utilizationLoading} />
      </div>

      {/* === F. Main Content (Map + Offer Pipeline) === */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7">
          <GeographicOverview />
        </div>
        <div className="lg:col-span-5">
          <OfferPipelineSnapshot stats={offerStats} loading={offerLoading} />
        </div>
      </div>

      {/* === G. Expiring Contracts + Event Log === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* G1: Expiring Contracts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
              <CalendarX className="w-4 h-4 text-[#20c58f]" />
            </div>
            <h3 className="text-sm font-semibold text-white">Utgående kontrakt</h3>
            {expiringContracts.length > 0 && (
              <span className="ml-auto text-xs text-slate-500">{expiringContracts.length} st</span>
            )}
          </div>

          {expiringContracts.length === 0 ? (
            <p className="text-sm text-slate-500">Inga kontrakt löper ut inom 90 dagar</p>
          ) : (
            <div className="space-y-2">
              {expiringContracts.slice(0, 5).map((contract) => {
                const riskColors = {
                  high: 'border-l-red-500 bg-red-500/5',
                  medium: 'border-l-amber-500 bg-amber-500/5',
                  low: 'border-l-slate-600',
                }
                const riskTextColors = {
                  high: 'text-red-400',
                  medium: 'text-amber-400',
                  low: 'text-slate-400',
                }
                return (
                  <div
                    key={contract.customer_id}
                    className={`border-l-2 rounded-r-lg px-3 py-2 ${riskColors[contract.risk_level]}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white truncate">{contract.company_name}</p>
                      <span className={`text-xs flex-shrink-0 ml-2 ${riskTextColors[contract.risk_level]}`}>
                        {contract.months_remaining <= 1 ? '<1 mån' : `${contract.months_remaining} mån`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-slate-500">{contract.assigned_account_manager}</span>
                      <span className="text-xs text-slate-400">{formatCurrency(contract.annual_value)}/år</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {expiringContracts.length > 5 && (
            <Link
              to="/koordinator/befintliga-kunder"
              className="mt-3 flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
            >
              Visa alla
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </motion.div>

        {/* G2: Event Log (compact) */}
        <EventLogCard maxEntries={5} />
      </div>

      {/* KPI Case List Modal (existing) */}
      <KpiCaseListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalData.title}
        cases={modalData.cases}
        technicians={modalData.technicians}
        absences={modalData.absences}
        kpiType={modalData.kpiType}
      />

      {/* Global Coordinator Chat (existing, enriched context) */}
      <GlobalCoordinatorChat
        currentPage="dashboard"
        contextData={{
          kpiData,
          recentCases: allCases.slice(0, 20),
          offerStats,
          expiringContractsCount: expiringContracts.length,
          casesToBookIn: casesToBookIn.length,
        }}
      />
    </div>
  )
}
