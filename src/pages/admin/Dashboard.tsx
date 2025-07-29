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
  Settings
} from 'lucide-react'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'
import { PageHeader } from '../../components/shared'

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
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Hämta parallella queries för bättre prestanda
      const [
        customersResult,
        casesResult,
        privateCasesResult,
        businessCasesResult,
        techniciansResult
      ] = await Promise.all([
        supabase.from('customers').select('id, annual_premium').eq('is_active', true),
        supabase.from('cases').select('id, price').not('completed_date', 'is', null),
        supabase.from('private_cases').select('id, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('business_cases').select('id, pris').eq('status', 'Avslutat').not('pris', 'is', null),
        supabase.from('technicians').select('id, name').eq('is_active', true)
      ])

      if (customersResult.error) throw customersResult.error
      if (casesResult.error) throw casesResult.error
      if (privateCasesResult.error) throw privateCasesResult.error
      if (businessCasesResult.error) throw businessCasesResult.error
      if (techniciansResult.error) throw techniciansResult.error

      // Beräkna total revenue
      const contractRevenue = customersResult.data?.reduce((sum, c) => sum + (c.annual_premium || 0), 0) || 0
      const caseRevenue = casesResult.data?.reduce((sum, c) => sum + (c.price || 0), 0) || 0
      const privateRevenue = privateCasesResult.data?.reduce((sum, c) => sum + (c.pris || 0), 0) || 0
      const businessRevenue = businessCasesResult.data?.reduce((sum, c) => sum + (c.pris * 1.25 || 0), 0) || 0

      const totalRevenue = contractRevenue + caseRevenue + privateRevenue + businessRevenue

      // Räkna pågående ärenden
      const [activeCasesResult] = await Promise.all([
        supabase.from('cases').select('id').is('completed_date', null)
      ])

      const dashboardStats: DashboardStats = {
        totalCustomers: customersResult.data?.length || 0,
        totalCases: casesResult.data?.length || 0,
        totalPrivateCases: privateCasesResult.data?.length || 0,
        totalBusinessCases: businessCasesResult.data?.length || 0,
        totalRevenue,
        activeTechnicians: techniciansResult.data?.length || 0,
        pendingCases: activeCasesResult.data?.length || 0,
        recentActivity: []
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <div className="text-red-400 mb-4">Fel vid laddning av dashboard</div>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button onClick={fetchDashboardStats}>Försök igen</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Admin Dashboard" 
          showBackButton={false}
        />

        {/* Main Content */}
        <div className="space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Avtalskunder</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalCustomers || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Intäkt</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalRevenue || 0)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">BeGone Ärenden</p>
                  <p className="text-2xl font-bold text-white">
                    {(stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Aktiva Tekniker</p>
                  <p className="text-2xl font-bold text-white">{stats?.activeTechnicians || 0}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* 📱 Navigation Grid - Sorterade efter funktionalitet som appar */}
          <div className="space-y-6">
            
            {/* 👥 KUNDHANTERING */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Kundhantering
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Hantera Kunder */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/customers')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-blue-300 transition-colors">Hantera Kunder</h3>
                      <p className="text-xs text-slate-400">Avtalskunder & ClickUp-listor</p>
                      <p className="text-xs text-slate-500 mt-1">{stats?.totalCustomers} aktiva kunder</p>
                    </div>
                  </div>
                </Card>

                {/* Försäljningsmöjligheter */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/sales-opportunities')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-purple-300 transition-colors">Försäljningsmöjligheter</h3>
                      <p className="text-xs text-slate-400">Potentiella avtalskunder</p>
                      <p className="text-xs text-slate-500 mt-1">BeGone → Avtal</p>
                    </div>
                  </div>
                </Card>

                {/* Ny Kund */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/customers/new')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                      <Building2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-green-300 transition-colors">Lägg till Kund</h3>
                      <p className="text-xs text-slate-400">Skapa ny avtalskund</p>
                      <p className="text-xs text-slate-500 mt-1">Automatisk ClickUp-lista</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* 🔧 TEKNIKER & PERSONAL */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-400" />
                Tekniker & Personal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Tekniker Statistik */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/technicians')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
                      <BarChart3 className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-orange-300 transition-colors">Tekniker Statistik</h3>
                      <p className="text-xs text-slate-400">Prestanda & ranking</p>
                      <p className="text-xs text-slate-500 mt-1">{stats?.activeTechnicians} aktiva tekniker</p>
                    </div>
                  </div>
                </Card>

                {/* Hantera Tekniker */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/technician-management')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                      <UserCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-blue-300 transition-colors">Hantera Tekniker</h3>
                      <p className="text-xs text-slate-400">CRUD & administration</p>
                      <p className="text-xs text-slate-500 mt-1">Lägg till/redigera personal</p>
                    </div>
                  </div>
                </Card>

                {/* Provisioner */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/commissions')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                      <Wallet className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-yellow-300 transition-colors">Provisioner</h3>
                      <p className="text-xs text-slate-400">Beräkna & hantera</p>
                      <p className="text-xs text-slate-500 mt-1">Tekniker-commissionsystem</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* 🆕 ONEFLOW & AVTAL */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Oneflow & Avtal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Skapa Kontrakt */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/oneflow-contract-creator')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                      <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-indigo-300 transition-colors">Skapa Kontrakt</h3>
                      <p className="text-xs text-slate-400">Oneflow-avtal för signering</p>
                      <p className="text-xs text-slate-500 mt-1">6 tillgängliga mallar</p>
                    </div>
                  </div>
                </Card>

                {/* Övervaka Avtal */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/oneflow-diagnostics')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/30 transition-colors">
                      <BarChart3 className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-cyan-300 transition-colors">Övervaka Avtal</h3>
                      <p className="text-xs text-slate-400">Status & diagnostik</p>
                      <p className="text-xs text-slate-500 mt-1">Webhook logs & analys</p>
                    </div>
                  </div>
                </Card>

                {/* Avtalsstatus (Kommande) */}
                <Card className="p-4 bg-slate-800/30 border-dashed border-slate-600">
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-400">Avtalsstatus</h3>
                      <p className="text-xs text-slate-500">Signering & uppföljning</p>
                      <p className="text-xs text-slate-600 mt-1">Under utveckling</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* 💰 EKONOMI & FAKTURERING */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Ekonomi & Fakturering
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Ekonomisk Översikt */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/economics')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-green-300 transition-colors">Ekonomisk Översikt</h3>
                      <p className="text-xs text-slate-400">Intäktsanalys & KPI</p>
                      <p className="text-xs text-slate-500 mt-1">{formatCurrency(stats?.totalRevenue || 0)} total</p>
                    </div>
                  </div>
                </Card>

                {/* Fakturering */}
                <Card className="p-4 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer group" onClick={() => navigate('/admin/billing')}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                      <FileText className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white group-hover:text-yellow-300 transition-colors">Fakturering</h3>
                      <p className="text-xs text-slate-400">BeGone-ärenden</p>
                      <p className="text-xs text-slate-500 mt-1">{(stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)} ärenden</p>
                    </div>
                  </div>
                </Card>

                {/* Placeholder för framtida ekonomifunktioner */}
                <Card className="p-4 bg-slate-800/30 border-dashed border-slate-600">
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-12 h-12 bg-slate-500/20 rounded-xl flex items-center justify-center">
                      <Settings className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-400">Kommande funktioner</h3>
                      <p className="text-xs text-slate-500">Fler ekonomiverktyg</p>
                      <p className="text-xs text-slate-600 mt-1">Under utveckling</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Recent Activity */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Senaste Aktivitet
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">System uppdaterat</p>
                    <p className="text-xs text-slate-400">Senaste synkronisering från ClickUp</p>
                  </div>
                  <span className="text-xs text-slate-500">Just nu</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-white">Dashboard laddat</p>
                    <p className="text-xs text-slate-400">Alla komponenter aktiva</p>
                  </div>
                  <span className="text-xs text-slate-500">Nu</span>
                </div>
              </div>
            </Card>

            {/* System Status */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                System Status
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Database</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Online</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">ClickUp Integration</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Synkroniserad</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Webhook Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Aktiv</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">API Endpoints</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-green-400">Tillgängliga</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard