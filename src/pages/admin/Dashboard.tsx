// 📁 src/pages/admin/AdminDashboard.tsx - MED FÖRSÄLJNINGSMÖJLIGHETER KNAPP
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
  Settings,
  Building2,
  User,
  Shield,
  LogOut,
  Wrench,
  Star,
  Target
} from 'lucide-react'

import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency } from '../../utils/formatters'

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
        recentActivity: [] // Kan implementeras senare
      }

      setStats(dashboardStats)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
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
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-400">Välkommen tillbaka, {user?.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logga ut
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

          {/* Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Kundhantering */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/customers')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Kundhantering</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Hantera avtalskunder, skapa nya listor och skicka inbjudningar
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {stats?.totalCustomers} aktiva kunder
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Ekonomisk Översikt */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/economics')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Ekonomisk Översikt</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Intäktsanalys, trender och ekonomiska insights
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {formatCurrency(stats?.totalRevenue || 0)} total intäkt
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* 🆕 Försäljningsmöjligheter */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/sales-opportunities')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Target className="w-8 h-8 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Försäljningsmöjligheter</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Identifiera potentiella avtalskunder från BeGone-ärenden
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Analys av återkommande kunder
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tekniker Statistik */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/technicians')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Wrench className="w-8 h-8 text-orange-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Tekniker Statistik</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Prestanda, ranking och arbetstider för tekniker
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {stats?.activeTechnicians} aktiva tekniker
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Fakturering */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/billing')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <FileText className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Fakturering</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Hantera fakturering för avslutade BeGone-ärenden
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      {(stats?.totalPrivateCases || 0) + (stats?.totalBusinessCases || 0)} ärenden
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* System Inställningar */}
            <Card className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/settings')}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-500/20 rounded-xl flex items-center justify-center">
                  <Settings className="w-8 h-8 text-slate-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Inställningar</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Systemkonfiguration och användarhantering
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Konfigurationer
                    </span>
                    <Button size="sm" variant="secondary">Öppna</Button>
                  </div>
                </div>
              </div>
            </Card>
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
      </main>
    </div>
  )
}

export default AdminDashboard