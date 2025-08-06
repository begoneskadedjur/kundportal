// 📁 src/pages/technician/TechnicianDashboard.tsx - FIXAD FÖR PROFILE DATA

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  DollarSign, FileText, ClipboardList, Calendar, 
  TrendingUp, Award, Clock, AlertCircle,
  Plus, Eye, ArrowRight, ChevronDown, ChevronUp, Info, Briefcase
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'
import EditCaseModal from '../../components/admin/technicians/EditCaseModal'
import { PageHeader } from '../../components/shared'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import StaggeredGrid from '../../components/shared/StaggeredGrid'
import EnhancedSkeleton from '../../components/shared/EnhancedSkeleton'
import InteractiveRevenueChart from '../../components/shared/InteractiveRevenueChart'
import VisualTimeline from '../../components/shared/VisualTimeline'
import RecentCasesList from '../../components/technician/RecentCasesList'
import MonthlyOverviewList from '../../components/technician/MonthlyOverviewList'
import MonthlyCommissionModal from '../../components/technician/MonthlyCommissionModal'

const formatAddress = (address: any): string => {
  if (!address) return 'Saknas';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } }
  return 'Okänt format';
};

// Interface för EditCaseModal compatibility - KOMPLETT med alla fält
interface TechnicianCase {
  id: string;
  clickup_task_id: string;
  case_number?: string;
  title: string;
  status: string;
  priority?: string;
  case_type: 'private' | 'business' | 'contract';
  created_date: string;
  start_date?: string;
  due_date?: string;
  completed_date?: string;
  commission_amount?: number;
  case_price?: number;
  kontaktperson?: string;
  telefon_kontaktperson?: string;
  e_post_kontaktperson?: string;
  adress?: any;
  foretag?: string;
  org_nr?: string;
  skadedjur?: string;
  description?: string;
  clickup_url?: string;
  assignee_name?: string;
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
  personnummer?: string;
  material_cost?: number;
  time_spent_minutes?: number;
  work_started_at?: string;
  // ROT/RUT fält
  r_rot_rut?: string;
  r_fastighetsbeteckning?: string;
  r_arbetskostnad?: number;
  r_material_utrustning?: string;
  r_servicebil?: string;
  // Rapport
  rapport?: string;
  // Övriga fält från databas
  priority?: string;
  case_number?: string;
  billing_status?: 'pending' | 'sent' | 'paid' | 'skip';
  filer?: any;
  reklamation?: string;
  avvikelser_tillbud_olyckor?: string;
  annat_skadedjur?: string;
  skicka_bokningsbekraftelse?: string;
}

interface DashboardData {
  stats: {
    total_commission_ytd: number;
    total_cases_ytd: number;
    avg_commission_per_case: number;
    current_month_commission: number;
    pending_cases: number;
    completed_cases_this_month: number;
    technician_name?: string;
    technician_email?: string;
  }
  monthly_data: Array<{
    month: string;
    month_display: string;
    total_commission: number;
    case_count: number;
    avg_commission_per_case: number;
  }>
  recent_cases: Array<{
    id: string;
    clickup_task_id: string;
    title: string;
    status: string;
    case_type: 'private' | 'business';
    completed_date?: string;
    commission_amount?: number;
  }>
  pending_cases: Array<{
    id: string;
    clickup_task_id: string;
    title: string;  
    status: string;
    case_type: 'private' | 'business';
    created_at: string;
    kontaktperson?: string;
    foretag?: string;
    adress?: string;
  }>
}

export default function TechnicianDashboard() {
  const { profile, isTechnician } = useAuth()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [showPendingCases, setShowPendingCases] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<TechnicianCase | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<any | null>(null)
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)

  // ✅ FIXAD: Använd profile data istället för technician prop
  const technicianId = profile?.technician_id
  const technicianData = profile?.technicians
  const displayName = technicianData?.name || profile?.display_name || 'Tekniker'

  useEffect(() => {
    if (profile && !isTechnician) {
      navigate('/login', { replace: true })
      return
    }
  }, [isTechnician, profile, navigate])

  useEffect(() => {
    if (isTechnician && technicianId) {
      fetchDashboardData()
    }
  }, [isTechnician, technicianId])

  // Modal handlers
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedCase(null)
  }

  const handleUpdateSuccess = () => {
    // Refetch dashboard data efter uppdatering
    fetchDashboardData()
  }

  const handleMonthClick = (month: any) => {
    setSelectedMonth(month);
    setShowMonthlyModal(true);
  }

  const handleCloseMonthlyModal = () => {
    setShowMonthlyModal(false);
    setSelectedMonth(null);
  }

  const handleOpenCase = (pendingCase: any) => {
    // Konvertera pending case till TechnicianCase format med ALLA fält
    const technicianCase: TechnicianCase = {
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
      // ROT/RUT fält (bara för privatpersoner)
      r_rot_rut: pendingCase.r_rot_rut,
      r_fastighetsbeteckning: pendingCase.r_fastighetsbeteckning,
      r_arbetskostnad: pendingCase.r_arbetskostnad,
      r_material_utrustning: pendingCase.r_material_utrustning,
      r_servicebil: pendingCase.r_servicebil,
      // Rapport
      rapport: pendingCase.rapport,
      // Övriga fält
      priority: pendingCase.priority,
      case_number: pendingCase.case_number,
      billing_status: pendingCase.billing_status,
    }
    setSelectedCase(technicianCase)
    setIsEditModalOpen(true)
  }

  const fetchDashboardData = async () => {
    if (!technicianId) {
      setError('Ingen tekniker-ID tillgänglig');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/technician/dashboard?technician_id=${technicianId}`)
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`)
      }
      const dashboardData = await response.json()
      setData(dashboardData)
    } catch (error) {
      console.error('💥 Error fetching dashboard data:', error)
      setError(error instanceof Error ? error.message : 'Ett oväntat fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader 
            title="Laddar..."
            showBackButton={false}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <EnhancedSkeleton variant="kpi" count={4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EnhancedSkeleton variant="card" className="h-64" />
            <EnhancedSkeleton variant="card" className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda data</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} className="w-full">
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }
  
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8">
          <p className="text-slate-400">Ingen data tillgänglig</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader 
          title="Tekniker Dashboard"
          subtitle={`${displayName} • ${data.stats.pending_cases} pågående ärenden`}
          icon={Briefcase}
          iconColor="text-purple-400"
          showBackButton={false}
          rightContent={
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Clock className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('sv-SE')}</span>
            </div>
          }
        />

        <StaggeredGrid 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          staggerDelay={0.1}
          initialDelay={0}
        >
          <EnhancedKpiCard
            title="Total Provision i år"
            value={data.stats.total_commission_ytd}
            icon={DollarSign}
            prefix=""
            suffix=" kr"
            decimals={0}
            trend={(() => {
              const currentYearTotal = data.stats.total_commission_ytd;
              const monthsInYear = new Date().getMonth() + 1; // Current month number
              const averageMonthly = data.monthly_data.length > 0 ? 
                data.monthly_data.reduce((sum, month) => sum + month.total_commission, 0) / data.monthly_data.length : 0;
              return currentYearTotal > (averageMonthly * monthsInYear * 0.8) ? "up" : "down";
            })()}
            trendValue={(() => {
              const monthsInYear = new Date().getMonth() + 1;
              const expectedTotal = data.monthly_data.length > 0 ? 
                (data.monthly_data.reduce((sum, month) => sum + month.total_commission, 0) / data.monthly_data.length) * monthsInYear : 0;
              if (expectedTotal === 0) return "→";
              const change = ((data.stats.total_commission_ytd - expectedTotal) / expectedTotal) * 100;
              return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
            })()}
            trendExplanation={(() => {
              const monthsInYear = new Date().getMonth() + 1;
              const avgMonthly = data.monthly_data.length > 0 ? 
                data.monthly_data.reduce((sum, month) => sum + month.total_commission, 0) / data.monthly_data.length : 0;
              const expectedTotal = avgMonthly * monthsInYear;
              
              return {
                currentMonth: "Aktuell total",
                currentValue: data.stats.total_commission_ytd,
                previousMonth: "Förväntad total",
                previousValue: expectedTotal,
                suffix: " kr"
              };
            })()}
            trendExplanationMode="mobile-friendly"
            customContent={
              <p className="text-green-300 text-xs">{data.stats.total_cases_ytd} ärenden</p>
            }
          />
          
          <EnhancedKpiCard
            title="Provision denna månad"
            value={data.stats.current_month_commission}
            icon={Calendar}
            prefix=""
            suffix=" kr"
            decimals={0}
            trend={(() => {
              const currentMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!currentMonth || !previousMonth || previousMonth.total_commission === 0) {
                return "neutral";
              }
              
              return currentMonth.total_commission > previousMonth.total_commission ? "up" : "down";
            })()}
            trendValue={(() => {
              const currentMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!currentMonth || !previousMonth || previousMonth.total_commission === 0) {
                return "→";
              }
              
              const change = ((currentMonth.total_commission - previousMonth.total_commission) / previousMonth.total_commission) * 100;
              return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
            })()}
            trendExplanation={(() => {
              const currentMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!currentMonth || !previousMonth) return undefined;
              
              return {
                currentMonth: currentMonth.month_display,
                currentValue: currentMonth.total_commission,
                previousMonth: previousMonth.month_display,
                previousValue: previousMonth.total_commission,
                suffix: " kr"
              };
            })()}
            trendExplanationMode="mobile-friendly"
            customContent={
              <p className="text-blue-300 text-xs">{data.stats.completed_cases_this_month} avslutade ärenden</p>
            }
          />

          <EnhancedKpiCard
            title="Snitt provision per ärende"
            value={data.stats.avg_commission_per_case}
            icon={TrendingUp}
            prefix=""
            suffix=" kr"
            decimals={0}
            trend={(() => {
              // Use first two months from monthly_data (already sorted by date desc)
              const latestMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!latestMonth || !previousMonth || previousMonth.avg_commission_per_case === 0) {
                return "neutral";
              }
              
              return latestMonth.avg_commission_per_case > previousMonth.avg_commission_per_case ? "up" : "down";
            })()}
            trendValue={(() => {
              // Calculate percentage change using first two months
              const latestMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!latestMonth || !previousMonth || previousMonth.avg_commission_per_case === 0) {
                return "→";
              }
              
              const change = ((latestMonth.avg_commission_per_case - previousMonth.avg_commission_per_case) / previousMonth.avg_commission_per_case) * 100;
              return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
            })()}
            trendExplanation={(() => {
              const latestMonth = data.monthly_data[0];
              const previousMonth = data.monthly_data[1];
              
              if (!latestMonth || !previousMonth) return undefined;
              
              return {
                currentMonth: latestMonth.month_display,
                currentValue: latestMonth.avg_commission_per_case,
                previousMonth: previousMonth.month_display,
                previousValue: previousMonth.avg_commission_per_case,
                suffix: ' kr'
              };
            })()}
            trendExplanationMode="mobile-friendly"
            customContent={
              <p className="text-purple-300 text-xs">Genomsnittlig provision</p>
            }
          />

          <EnhancedKpiCard
            title="Pågående ärenden"
            value={data.stats.pending_cases}
            icon={Clock}
            onClick={() => setShowPendingCases(!showPendingCases)}
            trend={data.stats.pending_cases > 5 ? "down" : "up"}
            trendValue={data.stats.pending_cases > 5 ? "Många" : "Få"}
            customContent={
              <div className="flex items-center justify-between">
                <p className="text-orange-300 text-xs">Klicka för att se alla</p>
                {showPendingCases ? (
                  <ChevronUp className="w-4 h-4 text-orange-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-orange-400" />
                )}
              </div>
            }
          />
        </StaggeredGrid>


        <AnimatePresence>
          {showPendingCases && data.pending_cases && data.pending_cases.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-orange-500" />
                    Pågående ärenden ({data.pending_cases.length})
                  </h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowPendingCases(false)}
                    className="flex items-center gap-2"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Dölj
                  </Button>
                </div>
                <div className="space-y-3">
                  {data.pending_cases.map((case_, index) => (
                    <motion.div
                      key={case_.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors cursor-pointer"
                      onClick={() => handleOpenCase(case_)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-white text-sm truncate">{case_.title}</p>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                            {case_.status}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-600/50 text-slate-300">
                            {case_.case_type === 'private' ? 'Privat' : 'Företag'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-400 text-xs">
                          {case_.kontaktperson && (
                            <span>👤 {case_.kontaktperson}</span>
                          )}
                          {case_.foretag && (
                            <span>🏢 {case_.foretag}</span>
                          )}
                          {case_.adress && (
                            <span>📍 {formatAddress(case_.adress)}</span>
                          )}
                          <span>📅 {formatDate(case_.created_at)}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-500" />Månadsöversikt</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/technician/commissions')} className="flex items-center gap-2"><Eye className="w-4 h-4" />Visa alla</Button>
            </div>
            <MonthlyOverviewList
              months={data.monthly_data}
              onMonthClick={handleMonthClick}
              maxItems={3}
            />
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-blue-500" />Senaste ärenden</h2>
              <Button variant="outline" size="sm" onClick={() => navigate('/technician/cases')} className="flex items-center gap-2"><Eye className="w-4 h-4" />Visa alla</Button>
            </div>
            <RecentCasesList
              cases={data.recent_cases.slice(0, 5).map((case_) => ({
                id: case_.id,
                title: case_.title,
                status: case_.status,
                case_type: case_.case_type,
                commission_amount: case_.commission_amount,
                completed_date: case_.completed_date
              }))}
              onCaseClick={(caseItem) => {
                // Transform to TechnicianCase format for EditCaseModal
                const fullCase = data.recent_cases.find(c => c.id === caseItem.id);
                if (fullCase) {
                  handleOpenCase(fullCase);
                }
              }}
              maxItems={5}
            />
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-500" />Snabbåtgärder</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/technician/schedule')}
              className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-pink-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 10 }}
                  className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30 transition-colors"
                >
                  <Calendar className="w-5 h-5 text-purple-400" />
                </motion.div>
                <div className="text-left"><p className="font-medium text-white">Mitt Schema</p><p className="text-purple-300 text-sm">Kalenderöversikt</p></div>
                <ArrowRight className="w-4 h-4 text-purple-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/technician/cases')}
              className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-lg hover:from-blue-500/30 hover:to-cyan-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 10 }}
                  className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors"
                >
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </motion.div>
                <div className="text-left"><p className="font-medium text-white">Mina Ärenden</p><p className="text-blue-300 text-sm">Lista & detaljer</p></div>
                <ArrowRight className="w-4 h-4 text-blue-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/technician/commissions')}
              className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-lg hover:from-green-500/30 hover:to-emerald-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 10 }}
                  className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/30 transition-colors"
                >
                  <DollarSign className="w-5 h-5 text-green-400" />
                </motion.div>
                <div className="text-left"><p className="font-medium text-white">Mina Provisioner</p><p className="text-green-300 text-sm">Månadsöversikt</p></div>
                <ArrowRight className="w-4 h-4 text-green-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/technician/oneflow-contract-creator')}
              className="p-4 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-indigo-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 10 }}
                  className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30 transition-colors"
                >
                  <FileText className="w-5 h-5 text-purple-400" />
                </motion.div>
                <div className="text-left"><p className="font-medium text-white">Avtal & Offerter</p><p className="text-purple-300 text-sm">Skapa serviceavtal</p></div>
                <ArrowRight className="w-4 h-4 text-purple-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

          </div>
        </Card>

        <EditCaseModal 
          isOpen={isEditModalOpen} 
          onClose={handleCloseEditModal} 
          onSuccess={handleUpdateSuccess} 
          caseData={selectedCase} 
        />

        <MonthlyCommissionModal
          isOpen={showMonthlyModal}
          onClose={handleCloseMonthlyModal}
          month={selectedMonth}
          technicianId={technicianId || ''}
          onCaseClick={(caseItem) => {
            // Convert case to TechnicianCase format if needed
            const fullCase = data?.recent_cases.find(c => c.id === caseItem.id);
            if (fullCase) {
              handleOpenCase(fullCase);
            }
            handleCloseMonthlyModal();
          }}
        />
      </div>
    </div>
  )
}