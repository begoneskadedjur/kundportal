// src/pages/admin/Dashboard.tsx - UPPDATERAD MED TEKNIKER-LÄNK
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Users, FileText, Calendar, Plus, LogOut, Bug, AlertTriangle, UserCheck, 
  BarChart3, DollarSign, Activity, Wrench
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

type Stats = {
  totalCustomers: number
  activeCustomers: number
  totalCases: number
  upcomingVisits: number
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalCases: 0,
    upcomingVisits: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('📊 AdminDashboard: Component mounted')
    console.log('👤 Current profile:', profile)
    fetchStats()
  }, [])

  const fetchStats = async () => {
    console.log('📊 Starting stats fetch...')
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔗 Testing Supabase connection...')
      
      // Test basic connection först
      const { data: connectionTest, error: connectionError } = await supabase
        .from('customers')
        .select('count', { count: 'exact', head: true })

      if (connectionError) {
        console.error('💥 Supabase connection failed:', connectionError)
        throw new Error(`Database connection failed: ${connectionError.message}`)
      }
      
      console.log('✅ Supabase connection OK')

      // Hämta kundstatistik
      console.log('👥 Fetching customer stats...')
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('is_active')

      if (customersError) {
        console.error('💥 Customers query failed:', customersError)
        throw customersError
      }
      
      console.log('✅ Customers fetched:', customers?.length || 0)

      // Hämta ärenden
      console.log('📋 Fetching cases...')
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id')

      if (casesError) {
        console.error('💥 Cases query failed:', casesError)
        throw casesError
      }
      
      console.log('✅ Cases fetched:', cases?.length || 0)

      // Hämta kommande besök
      console.log('📅 Fetching upcoming visits...')
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('id')
        .gte('visit_date', new Date().toISOString())

      if (visitsError) {
        console.error('💥 Visits query failed:', visitsError)
        throw visitsError
      }
      
      console.log('✅ Visits fetched:', visits?.length || 0)

      const newStats = {
        totalCustomers: customers?.length || 0,
        activeCustomers: customers?.filter(c => c.is_active)?.length || 0,
        totalCases: cases?.length || 0,
        upcomingVisits: visits?.length || 0
      }

      console.log('📊 Final stats:', newStats)
      setStats(newStats)

    } catch (error: any) {
      console.error('💥 Stats fetch failed:', error)
      setError(error.message || 'Kunde inte hämta statistik')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <Bug className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">BeGone Admin</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-400">
                Inloggad som: <span className="text-white">{profile?.email}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logga ut
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Välkommen tillbaka!</h1>
          <p className="text-slate-400">Här är en snabb översikt över din verksamhet</p>
        </div>

        {error && (
          <Card className="mb-8 bg-red-500/10 border-red-500/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="text-red-400 font-medium">Kunde inte ladda statistik</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={fetchStats}
                  className="mt-2"
                >
                  Försök igen
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt antal kunder</p>
                <p className="text-2xl font-bold text-white">{loading ? '-' : stats.totalCustomers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Aktiva kunder</p>
                <p className="text-2xl font-bold text-white">{loading ? '-' : stats.activeCustomers}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt antal ärenden</p>
                <p className="text-2xl font-bold text-white">{loading ? '-' : stats.totalCases}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Kommande besök</p>
                <p className="text-2xl font-bold text-white">{loading ? '-' : stats.upcomingVisits}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Quick Actions & Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Hantering */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Hantering</h3>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                onClick={() => navigate('/admin/customers/new')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Lägg till ny kund
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                onClick={() => navigate('/admin/customers')}
              >
                <Users className="w-4 h-4 mr-2" />
                Hantera kunder
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20 hover:from-blue-500/20 hover:to-cyan-500/20"
                onClick={() => navigate('/admin/technicians')}
              >
                <Wrench className="w-4 h-4 mr-2" />
                Tekniker Performance
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border-orange-500/20 hover:from-orange-500/20 hover:to-yellow-500/20"
                onClick={() => navigate('/admin/billing')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Fakturering
              </Button>
            </div>
          </Card>

          {/* Avancerad Statistik */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Avancerad Statistik</h3>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:from-green-500/20 hover:to-emerald-500/20"
                onClick={() => navigate('/admin/economics')}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Ekonomisk Statistik & ARR
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20"
                onClick={() => navigate('/admin/customers')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Kundanalys & Avtal
              </Button>
            </div>
          </Card>

          {/* Systemstatus */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Systemstatus</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Database</span>
                <span className="flex items-center text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">ClickUp API</span>
                <span className="flex items-center text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Email Service</span>
                <span className="flex items-center text-green-400 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Tekniker Dashboard</span>
                <span className="flex items-center text-blue-400 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                  Ready
                </span>
              </div>
              <div className="pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  Statistik uppdaterad: {new Date().toLocaleTimeString('sv-SE', { 
                    hour: '2-digit', 
                    minute: '2-digit'
                  })}
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchStats}
                  className="mt-2 text-green-400 hover:text-green-300 w-full"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Uppdatera översikt
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}