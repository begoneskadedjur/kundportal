// 📁 src/pages/admin/AdminDashboard.tsx - KORRIGERAD MED UPPDATERAD UTLOGGNINGSFUNKTION

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  BarChart3,
  Calendar,
  Building2,
  User,
  Shield,
  LogOut,
  Wrench,
  Star,
  Target,
  UserCheck,
  Wallet,
  Settings,
  Package,
  MapPin,
  AlertCircle,
  UserPlus,
  Receipt
} from 'lucide-react'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'
import { PageHeader } from '../../components/shared'
import AdminKpiCard from '../../components/admin/AdminKpiCard'
import AdminDashboardCard from '../../components/admin/AdminDashboardCard'
import AdminKpiModal from '../../components/admin/AdminKpiModal'
import EnhancedKpiCard from '../../components/shared/EnhancedKpiCard'
import EnhancedSkeleton from '../../components/shared/EnhancedSkeleton'
import QuickActionBar from '../../components/shared/QuickActionBar'
import InteractiveRevenueChart from '../../components/shared/InteractiveRevenueChart'
import VisualTimeline from '../../components/shared/VisualTimeline'
import StaggeredGrid from '../../components/shared/StaggeredGrid'
import LiveStatusIndicator from '../../components/shared/LiveStatusIndicator'

interface DashboardStats {
  totalCustomers: number
  totalCases: number
  totalPrivateCases: number
  totalBusinessCases: number
  totalRevenue: number
  activeTechnicians: number
  pendingCases: number
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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'customers' | 'revenue' | 'cases' | 'technicians'>('customers')
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Hämta parallella queries för bättre prestanda
      // Get today's date for absence filtering
      const today = new Date().toISOString().split('T')[0]

      const [
        customersResult,
        casesResult,
        privateCasesResult,
        businessCasesResult,
        techniciansResult,
        absencesResult
      ] = await Promise.all([
        supabase.from('customers').select('id, company_name, annual_value').eq('is_active', true),
        supabase.from('cases').select('id, price').not('completed_date', 'is', null),
        supabase.from('private_cases').select('id, title, kontaktperson, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('business_cases').select('id, title, kontaktperson, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('technicians').select('id, name, role').eq('is_active', true).eq('role', 'Skadedjurstekniker'),
        supabase.from('technician_absences').select('technician_id')
          .lte('start_date', today + ' 23:59:59')
          .gte('end_date', today + ' 00:00:00')
      ])

      if (customersResult.error) throw customersResult.error
      if (casesResult.error) throw casesResult.error
      if (privateCasesResult.error) throw privateCasesResult.error
      if (businessCasesResult.error) throw businessCasesResult.error
      if (techniciansResult.error) throw techniciansResult.error
      if (absencesResult.error) throw absencesResult.error

      // Beräkna total revenue
      const contractRevenue = customersResult.data?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0
      const caseRevenue = casesResult.data?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      const privateRevenue = privateCasesResult.data?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
      const businessRevenue = businessCasesResult.data?.reduce((sum, c) => sum + (c.pris * 1.25 || 0), 0) || 0

      const totalRevenue = contractRevenue + caseRevenue + privateRevenue + businessRevenue

      // Räkna pågående ärenden
      const [activeCasesResult] = await Promise.all([
        supabase.from('cases').select('id').is('completed_date', null)
      ])

      // Filter out absent technicians
      const absentTechnicianIds = absencesResult.data?.map(absence => absence.technician_id) || []
      const availableTechnicians = techniciansResult.data?.filter(tech => !absentTechnicianIds.includes(tech.id)) || []

      const dashboardStats: DashboardStats = {
        totalCustomers: customersResult.data?.length || 0,
        totalCases: casesResult.data?.length || 0,
        totalPrivateCases: privateCasesResult.data?.length || 0,
        totalBusinessCases: businessCasesResult.data?.length || 0,
        totalRevenue,
        activeTechnicians: availableTechnicians.length || 0,
        pendingCases: activeCasesResult.data?.length || 0,
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
      }

      setStats(dashboardStats)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  // ✅ KORRIGERAD FUNKTION: Den manuella navigeringen är borttagen.
  // AuthContext kommer nu att sköta omdirigeringen automatiskt.
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const handleKpiClick = (type: 'customers' | 'revenue' | 'cases' | 'technicians', title: string) => {
    setModalType(type)
    setModalTitle(title)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Premium Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#20c58f]/10 via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader 
            title="Admin Dashboard" 
            showBackButton={false}
          />
          
          <div className="space-y-8">
            {/* Enhanced Loading skeleton for KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <EnhancedSkeleton variant="kpi" count={4} />
            </div>
            
            {/* Enhanced Loading skeleton for navigation cards */}
            <div className="space-y-12">
              {[1, 2, 3].map(section => (
                <div key={section}>
                  <EnhancedSkeleton variant="text" className="h-6 w-48 mb-6" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <EnhancedSkeleton variant="card" count={4} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        {/* Premium Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#20c58f]/10 via-transparent to-transparent" />
        
        <div className="relative z-10">
        <Card className="p-8 max-w-md backdrop-blur-sm bg-slate-800/70 border-slate-700/50 shadow-2xl">
          <div className="text-center">
            <div className="text-red-400 mb-4">Fel vid laddning av dashboard</div>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button onClick={fetchDashboardStats}>Försök igen</Button>
          </div>
        </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#20c58f]/10 via-transparent to-transparent" />
      
      <div className="relative z-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Admin Dashboard" 
          showBackButton={false}
        />

        {/* Quick Action Bar */}
        <QuickActionBar />

        {/* Main Content */}
        <div className="space-y-12">
          
          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <EnhancedKpiCard
              title="Avtalskunder"
              value={stats?.totalCustomers || 0}
              icon={Users}
              onClick={() => handleKpiClick('customers', 'Avtalskunder')}
              trend="up"
              trendValue="+5%"
              delay={0}
            />
            
            <EnhancedKpiCard
              title="Total Intäkt"
              value={stats?.totalRevenue || 0}
              icon={DollarSign}
              onClick={() => handleKpiClick('revenue', 'Total Intäkt')}
              prefix=""
              suffix=" kr"
              decimals={0}
              trend="up"
              trendValue="+12%"
              delay={0.1}
            />
            
            <EnhancedKpiCard
              title="BeGone Ärenden"
              value={(stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)}
              icon={FileText}
              onClick={() => handleKpiClick('cases', 'BeGone Ärenden')}
              trend="up"
              trendValue="+3"
              delay={0.2}
            />
            
            <EnhancedKpiCard
              title="Aktiva Tekniker"
              value={stats?.activeTechnicians || 0}
              icon={UserCheck}
              onClick={() => handleKpiClick('technicians', 'Aktiva Tekniker')}
              trend="up"
              trendValue="+2"
              delay={0.3}
            />
          </div>

          {/* Navigation Grid */}
          <div className="space-y-16">
            
            {/* Kommandocentral - Primary Functions */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-4">
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#20c58f]/50" />
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Kommandocentral</span>
                <div className="w-full h-px bg-gradient-to-r from-[#20c58f]/50 to-transparent" />
              </h2>
              <StaggeredGrid 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                staggerDelay={0.08}
                initialDelay={0.2}
              >
                <AdminDashboardCard
                  href="/admin/customers"
                  icon={Users}
                  title="Avtalspipeline - Översikt"
                  description="Avtalskunder & ClickUp-listor"
                  stats={`${stats?.totalCustomers} aktiva kunder`}
                  tag="Pipeline"
                  iconColor="text-[#20c58f]"
                />
                
                <AdminDashboardCard
                  href="/admin/oneflow-contract-creator"
                  icon={FileText}
                  title="Skapa avtalskund & skicka avtal"
                  description="Oneflow-avtal för signering"
                  stats="6 tillgängliga mallar"
                  tag="Skapa"
                  iconColor="text-emerald-400"
                />
                
                <AdminDashboardCard
                  href="/admin/leads"
                  icon={Target}
                  title="Lead Pipeline - Översikt"
                  description="Hantera potentiella kunder"
                  stats="Manuell leadhantering"
                  tag="Pipeline"
                  iconColor="text-purple-400"
                />
                
                <AdminDashboardCard
                  href="/admin/contracts-overview"
                  icon={Receipt}
                  title="Försäljningspipeline - Översikt"
                  description="Alla avtal & offerter"
                  stats="Status & värdeanalys"
                  tag="Pipeline"
                  iconColor="text-emerald-400"
                />
                
                <AdminDashboardCard
                  href="/admin/organisation/register"
                  icon={Building2}
                  title="Lägg upp Multi-Site kund & konton"
                  description="Ny multisite-kund wizard"
                  stats="Steg-för-steg guide"
                  tag="Multisite"
                  iconColor="text-blue-400"
                />
              </StaggeredGrid>
            </div>

            {/* Affärsintelligens - Analytics */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-4">
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#20c58f]/50" />
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Affärsintelligens</span>
                <div className="w-full h-px bg-gradient-to-r from-[#20c58f]/50 to-transparent" />
              </h2>
              <StaggeredGrid 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                staggerDelay={0.08}
                initialDelay={0.6}
              >
                <AdminDashboardCard
                  href="/admin/technicians"
                  icon={BarChart3}
                  title="Tekniker Statistik"
                  description="Prestanda & ranking"
                  stats={`${stats?.activeTechnicians} aktiva tekniker`}
                  tag="Analytics"
                  iconColor="text-blue-400"
                />
                
                <AdminDashboardCard
                  href="/admin/economics"
                  icon={TrendingUp}
                  title="Ekonomisk Översikt"
                  description="Intäktsanalys & KPI"
                  stats={formatCurrency(stats?.totalRevenue || 0)}
                  tag="Rapporter"
                  iconColor="text-green-400"
                />
                
                <AdminDashboardCard
                  href="/admin/billing"
                  icon={DollarSign}
                  title="Fakturering"
                  description="BeGone-ärenden"
                  stats={`${(stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)} ärenden`}
                  tag="Finans"
                  iconColor="text-yellow-400"
                />
                
                <AdminDashboardCard
                  href="/admin/commissions"
                  icon={Wallet}
                  title="Provisioner"
                  description="Beräkna tekniker-provision"
                  tag="Löner"
                  iconColor="text-emerald-400"
                />
              </StaggeredGrid>
            </div>

            {/* Administration - Management Tools */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-4">
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#20c58f]/50" />
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Administration</span>
                <div className="w-full h-px bg-gradient-to-r from-[#20c58f]/50 to-transparent" />
              </h2>
              <StaggeredGrid 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                staggerDelay={0.08}
                initialDelay={1.0}
              >
                <AdminDashboardCard
                  href="/admin/organisation/organizations"
                  icon={Building2}
                  title="Hantera kundkonton & användare"
                  description="Multisite-organisationer & access"
                  stats="0 organisationer"
                  tag="Konton"
                  iconColor="text-purple-400"
                />
                
                <AdminDashboardCard
                  href="/admin/technician-management"
                  icon={UserCheck}
                  title="Hantera Tekniker"
                  description="Lägg till & redigera personal"
                  tag="Personal"
                  iconColor="text-teal-400"
                />
                
                <AdminDashboardCard
                  href="/admin/sales-opportunities"
                  icon={Target}
                  title="Försäljningsmöjligheter"
                  description="Potentiella avtalskunder"
                  stats="BeGone → Avtal"
                  tag="Leads"
                  iconColor="text-emerald-400"
                />
                
                <AdminDashboardCard
                  href="/admin/product-management"
                  icon={Package}
                  title="Produkthantering"
                  description="Skapa & redigera tjänster"
                  stats="Dynamisk prissättning"
                  tag="Katalog"
                  iconColor="text-blue-400"
                />
              </StaggeredGrid>
            </div>

            {/* Systemunderhåll - Moved to bottom with reduced visual weight */}
            <div className="opacity-75">
              <h2 className="text-lg font-medium text-slate-400 mb-6 flex items-center gap-3">
                <div className="w-8 h-px bg-slate-700/50 flex-1" />
                <span className="text-slate-500">Systemunderhåll</span>
                <div className="w-8 h-px bg-slate-700/50 flex-1" />
              </h2>
              <StaggeredGrid 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
                staggerDelay={0.05}
                initialDelay={1.4}
              >
                <AdminDashboardCard
                  href="#"
                  icon={Settings}
                  title="Inställningar"
                  description="Systemkonfiguration"
                  tag="System"
                  iconColor="text-slate-500"
                  className="scale-95 hover:scale-100 transition-transform duration-200"
                />
                
                <AdminDashboardCard
                  href="#"
                  icon={Shield}
                  title="API Status"
                  description="Systemövervakning"
                  stats="Alla system online"
                  tag="Live"
                  iconColor="text-green-500"
                  className="scale-95 hover:scale-100 transition-transform duration-200"
                />
                
                <AdminDashboardCard
                  href="/admin/webhook-config"
                  icon={Wrench}
                  title="Webhook Config"
                  description="OneFlow webhook-inställningar"
                  stats="Events & automation"
                  tag="Config"
                  iconColor="text-slate-500"
                  className="scale-95 hover:scale-100 transition-transform duration-200"
                />
                
                <AdminDashboardCard
                  href="/admin/oneflow-diagnostics"
                  icon={AlertCircle}
                  title="Övervaka Avtal"
                  description="Status & diagnostik"
                  stats="Webhook logs"
                  tag="Debug"
                  iconColor="text-amber-500"
                  className="scale-95 hover:scale-100 transition-transform duration-200"
                />
                
                <AdminDashboardCard
                  href="/admin/customers/new"
                  icon={UserPlus}
                  title="Lägg till Kund"
                  description="Skapa ny avtalskund, ClickUp-integration"
                  stats="Legacy"
                  tag="Legacy"
                  iconColor="text-slate-500"
                  className="scale-95 hover:scale-100 transition-transform duration-200"
                />
              </StaggeredGrid>
            </div>

          </div>

          {/* System Overview */}
          <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <Card className="p-8 h-full backdrop-blur-sm bg-slate-800/70 border-slate-700/50 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-[#20c58f]" />
                  Senaste Aktivitet
                </h3>
                {stats?.recentActivity?.length ? (
                  <VisualTimeline 
                    activities={stats.recentActivity}
                    maxItems={5}
                  />
                ) : (
                  <VisualTimeline 
                    activities={[
                      {
                        id: '1',
                        type: 'system',
                        title: 'System uppdaterat',
                        description: 'Dashboard laddat med senaste data',
                        timestamp: 'Nu'
                      },
                      {
                        id: '2',
                        type: 'success',
                        title: 'ClickUp synkroniserad',
                        description: 'Alla ärenden är uppdaterade',
                        timestamp: '2 min sedan'
                      },
                      {
                        id: '3',
                        type: 'billing',
                        title: 'Fakturaexport slutförd',
                        description: '15 fakturor exporterade till Fortnox',
                        timestamp: '1 timme sedan'
                      }
                    ]}
                    maxItems={5}
                  />
                )}
              </Card>
            </div>

            {/* System Health */}
            <Card className="p-8 backdrop-blur-sm bg-slate-800/70 border-slate-700/50 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#20c58f]" />
                System Status
              </h3>
              <div className="space-y-4">
                <LiveStatusIndicator
                  services={[
                    { 
                      name: 'Database', 
                      status: 'online',
                      responseTime: '< 50ms',
                      description: 'Supabase PostgreSQL'
                    },
                    { 
                      name: 'ClickUp API', 
                      status: 'online',
                      responseTime: '120ms',
                      description: 'Task synchronization'
                    },
                    { 
                      name: 'Webhooks', 
                      status: 'online',
                      description: 'Real-time updates'
                    },
                    { 
                      name: 'Oneflow API', 
                      status: 'online',
                      responseTime: '95ms',
                      description: 'Contract management'
                    }
                  ]}
                />
                <div className="pt-3 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-500">Senaste kontroll</p>
                      <p className="text-xs text-green-400 font-medium">Just nu</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Systemupptid</p>
                      <p className="text-xs text-green-400 font-medium">99.9%</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
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
      </div>
    </div>
  )
}

export default AdminDashboard