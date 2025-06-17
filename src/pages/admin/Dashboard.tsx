// src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, FileText, Calendar, Plus, LogOut, Bug } from 'lucide-react'
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

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Hämta kundstatistik
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('is_active')

      if (customersError) throw customersError

      // Hämta ärenden
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id')

      if (casesError) throw casesError

      // Hämta kommande besök
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('id')
        .gte('visit_date', new Date().toISOString())

      if (visitsError) throw visitsError

      setStats({
        totalCustomers: customers?.length || 0,
        activeCustomers: customers?.filter(c => c.is_active).length || 0,
        totalCases: cases?.length || 0,
        upcomingVisits: visits?.length || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
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
                  {loading ? '-' : stats.totalCustomers}
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
                  {loading ? '-' : stats.activeCustomers}
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
                  {loading ? '-' : stats.totalCases}
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
                  {loading ? '-' : stats.upcomingVisits}
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
          <Card 
            className="cursor-pointer hover:border-green-500/50 transition-all"
            onClick={() => navigate('/admin/customers/new')}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Plus className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Lägg till ny kund
                </h3>
                <p className="text-sm text-slate-400">
                  Registrera en ny kund och skapa ClickUp-lista
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="cursor-pointer hover:border-green-500/50 transition-all"
            onClick={() => navigate('/admin/customers')}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Hantera kunder
                </h3>
                <p className="text-sm text-slate-400">
                  Visa och redigera befintliga kunder
                </p>
              </div>
            </div>
          </Card>

          <Card 
            className="cursor-pointer hover:border-green-500/50 transition-all opacity-50"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Rapporter
                </h3>
                <p className="text-sm text-slate-400">
                  Kommer snart...
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}