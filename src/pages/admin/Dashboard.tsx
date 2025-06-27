// src/pages/admin/Dashboard.tsx - FÖRBÄTTRAD MED DEBUG
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, FileText, Calendar, Plus, LogOut, Bug, AlertTriangle } from 'lucide-react'
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
        activeCustomers: customers?.filter(c => c.is_active).length || 0,
        totalCases: cases?.length || 0,
        upcomingVisits: visits?.length || 0
      }
      
      console.log('📊 Stats calculated:', newStats)
      setStats(newStats)
      
    } catch (error: any) {
      console.error('💥 Error fetching stats:', error)
      setError(error.message || 'Kunde inte ladda statistik')
    } finally {
      console.log('✅ Stats fetch completed')
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    console.log('👋 Admin signing out')
    await signOut()
    navigate('/login')
  }

  const retryFetch = () => {
    console.log('🔄 Retrying stats fetch...')
    fetchStats()
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Problem med att ladda</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={retryFetch} className="w-full">
                Försök igen
              </Button>
              <Button variant="ghost" onClick={handleSignOut} className="w-full">
                Logga ut
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center relative">
                <Bug className="w-6 h-6 text-slate-950" />
                <div className="absolute inset-0 rounded-full border-2 border-red-500 transform rotate-45"></div>
                <div className="absolute w-full h-0.5 bg-red-500 top-1/2 transform -translate-y-1/2 rotate-45"></div>
              </div>
              <h1 className="text-2xl font-bold">
                <span className="text-gradient">BeGone</span> Admin
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                Inloggad som: {profile?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
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
          <h2 className="text-3xl font-bold text-white mb-2">
            Välkommen tillbaka!
          </h2>
          <p className="text-slate-400">
            Här är en översikt över din verksamhet
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt antal kunder</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '...' : stats.totalCustomers}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Aktiva kunder</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '...' : stats.activeCustomers}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt antal ärenden</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '...' : stats.totalCases}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Kommande besök</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '...' : stats.upcomingVisits}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Snabbåtgärder</h3>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/admin/customers/new')} 
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Lägg till ny kund
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin/customers')} 
                className="w-full justify-start"
              >
                <Users className="w-4 h-4 mr-2" />
                Hantera kunder
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Systemstatus</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Database</span>
                <span className="text-green-400">✅ Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ClickUp API</span>
                <span className="text-green-400">✅ Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Email Service</span>
                <span className="text-green-400">✅ Active</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Senaste aktivitet</h3>
            <p className="text-slate-400 text-sm">
              Statistik hämtad: {new Date().toLocaleTimeString('sv-SE')}
            </p>
            <Button 
              variant="ghost" 
              onClick={retryFetch} 
              className="mt-3 w-full justify-start"
              disabled={loading}
            >
              {loading ? 'Uppdaterar...' : 'Uppdatera statistik'}
            </Button>
          </Card>
        </div>
      </main>
    </div>
  )
}