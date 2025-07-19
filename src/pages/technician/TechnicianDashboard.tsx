// 📁 src/pages/technician/TechnicianDashboard.tsx - FULLSTÄNDIGT FIXAD
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  DollarSign, FileText, ClipboardList, Calendar, 
  TrendingUp, Award, CheckCircle, Clock, AlertCircle,
  ExternalLink, Plus, Eye, ArrowRight
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { formatCurrency, formatDate } from '../../utils/formatters'

// Interfaces
interface TechnicianCommission {
  month: string
  month_display: string
  total_commission: number
  case_count: number
  avg_commission_per_case: number
}

interface TechnicianCase {
  id: string
  clickup_task_id: string
  title: string
  status: string
  case_type: 'private' | 'business' | 'contract'
  completed_date?: string
  commission_amount?: number
  priority?: string
  assignee_name?: string
}

interface DashboardStats {
  total_commission_ytd: number
  total_cases_ytd: number
  avg_commission_per_case: number
  current_month_commission: number
  pending_cases: number
  completed_cases_this_month: number
  technician_name?: string
  technician_email?: string
}

export default function TechnicianDashboard() {
  const { user, profile, technician, isTechnician } = useAuth() // ✅ FIXAD: isTechnician (inte isTechniker)
  const navigate = useNavigate()
  
  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    total_commission_ytd: 0,
    total_cases_ytd: 0,
    avg_commission_per_case: 0,
    current_month_commission: 0,
    pending_cases: 0,
    completed_cases_this_month: 0
  })
  const [monthlyCommissions, setMonthlyCommissions] = useState<TechnicianCommission[]>([])
  const [recentCases, setRecentCases] = useState<TechnicianCase[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  // 🔍 DEBUG: Logga AuthContext state
  useEffect(() => {
    console.log('🔍 TechnicianDashboard AuthContext Debug:')
    console.log('- isTechnician:', isTechnician)
    console.log('- technician object:', technician)
    console.log('- technician.id:', technician?.id)
    console.log('- profile:', profile)
    console.log('- profile.technician_id:', profile?.technician_id)
    console.log('- profile.role:', profile?.role)
  }, [isTechnician, technician, profile])

  // Säkerhetskontroll - omdirigera om inte tekniker
  useEffect(() => {
    if (!isTechnician || !technician?.id) {
      console.log('❌ Inte en tekniker, omdirigerar...', { isTechnician, technician })
      navigate('/login', { replace: true })
      return
    }
  }, [isTechnician, technician, navigate])

  // Hämta tekniker-specifik data
  useEffect(() => {
    if (isTechnician && technician?.id) {
      console.log('✅ Hämtar data för tekniker:', technician.id)
      fetchTechnicianData()
    }
  }, [isTechnician, technician?.id])

  const fetchTechnicianData = async () => {
    if (!technician?.id) {
      console.error('❌ Ingen tekniker-ID tillgänglig')
      setError('Ingen tekniker-ID hittades')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching data for technician:', technician.id)
      
      // ✅ KORRIGERADE API-ANROP med rätt error handling
      const [statsResponse, commissionsResponse, casesResponse] = await Promise.all([
        fetch(`/api/technician/stats?technician_id=${technician.id}`),
        fetch(`/api/technician/commissions?technician_id=${technician.id}`),
        fetch(`/api/technician/cases?technician_id=${technician.id}&limit=10`)
      ])

      // Hantera stats
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
        console.log('✅ Stats loaded:', statsData)
      } else {
        const errorText = await statsResponse.text()
        console.error('❌ Stats API error:', statsResponse.status, errorText)
      }

      // ✅ FIXAD: Hantera commissions API response structure
      if (commissionsResponse.ok) {
        const commissionsData = await commissionsResponse.json()
        // API returnerar { monthly_data: [...], stats: {...} }
        setMonthlyCommissions(commissionsData.monthly_data || [])
        console.log('✅ Commissions loaded:', commissionsData.monthly_data?.length || 0, 'months')
        
        // Uppdatera även stats om det finns i commission response
        if (commissionsData.stats) {
          setStats(prev => ({
            ...prev,
            total_commission_ytd: commissionsData.stats.total_ytd || prev.total_commission_ytd,
            total_cases_ytd: commissionsData.stats.total_cases_ytd || prev.total_cases_ytd,
            avg_commission_per_case: commissionsData.stats.avg_per_case || prev.avg_commission_per_case
          }))
        }
      } else {
        const errorText = await commissionsResponse.text()
        console.error('❌ Commissions API error:', commissionsResponse.status, errorText)
      }

      // ✅ FIXAD: Hantera cases API response structure
      if (casesResponse.ok) {
        const casesData = await casesResponse.json()
        // API returnerar { cases: [...], stats: {...} }
        setRecentCases(casesData.cases || [])
        console.log('✅ Cases loaded:', casesData.cases?.length || 0, 'cases')
        
        // Uppdatera stats från cases om tillgängligt
        if (casesData.stats) {
          setStats(prev => ({
            ...prev,
            pending_cases: casesData.stats.pending_cases || prev.pending_cases,
            completed_cases_this_month: casesData.stats.completed_cases || prev.completed_cases_this_month
          }))
        }
      } else {
        const errorText = await casesResponse.text()
        console.error('❌ Cases API error:', casesResponse.status, errorText)
      }

    } catch (error) {
      console.error('💥 Error fetching technician data:', error)
      setError('Kunde inte hämta tekniker-data')
    } finally {
      setLoading(false)
    }
  }

  // Navigeringsfunktioner
  const goToCommissions = () => navigate('/technician/commissions')
  const goToCases = () => navigate('/technician/cases')  
  const goToOneflow = () => navigate('/admin/oneflow-contract-creator')

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Problem med att ladda data</h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <div className="space-y-2">
              <Button onClick={fetchTechnicianData} className="w-full">
                Försök igen
              </Button>
              
              {/* 🔍 DEBUG INFO */}
              <div className="mt-4 p-3 bg-slate-800 rounded text-left text-xs">
                <p className="text-slate-300 mb-1">Debug info:</p>
                <p className="text-slate-400">Tekniker ID: {technician?.id || 'Saknas'}</p>
                <p className="text-slate-400">isTechnician: {isTechnician ? 'Ja' : 'Nej'}</p>
                <p className="text-slate-400">Profile role: {profile?.role || 'Okänd'}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // ✅ FIXAD: Säker currentMonthData access
  const currentMonthData = monthlyCommissions.find(m => m.month === selectedMonth)
  const displayName = technician?.name || profile?.display_name || 'Tekniker'

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Välkommen, {displayName}! 👷‍♂️
              </h1>
              <p className="text-slate-400 mt-1">
                Din personliga översikt över provisioner, ärenden och verktyg
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tekniker ID: {technician?.id} • Email: {technician?.email || profile?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={goToOneflow}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa Avtal
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 🔍 DEBUG-sektion för att visa rådata */}
        <Card className="p-4 mb-6 bg-blue-500/10 border-blue-500/30">
          <div className="text-xs">
            <p className="text-blue-400 font-medium mb-2">🔍 Debug Info</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
              <div>
                <p className="text-slate-400">Stats:</p>
                <p>YTD Commission: {formatCurrency(stats.total_commission_ytd)}</p>
                <p>YTD Cases: {stats.total_cases_ytd}</p>
                <p>Pending: {stats.pending_cases}</p>
              </div>
              <div>
                <p className="text-slate-400">Monthly Data:</p>
                <p>Antal månader: {monthlyCommissions.length}</p>
                <p>Current month: {selectedMonth}</p>
                <p>Current data: {currentMonthData ? 'Finns' : 'Saknas'}</p>
              </div>
              <div>
                <p className="text-slate-400">Recent Cases:</p>
                <p>Antal cases: {recentCases.length}</p>
                <p>Tekniker ID: {technician?.id}</p>
                <p>isTechnician: {isTechnician ? 'Ja' : 'Nej'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Provision i år */}
          <Card className="p-6 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Total Provision i år</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(stats.total_commission_ytd)}
                </p>
                <p className="text-green-300 text-xs mt-1">
                  {stats.total_cases_ytd} ärenden
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </Card>

          {/* Denna månad */}
          <Card className="p-6 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Denna månad</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(currentMonthData?.total_commission || stats.current_month_commission)}
                </p>
                <p className="text-blue-300 text-xs mt-1">
                  {currentMonthData?.case_count || stats.completed_cases_this_month} avslutade
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </Card>

          {/* Snitt per ärende */}
          <Card className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm font-medium">Snitt per ärende</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(stats.avg_commission_per_case)}
                </p>
                <p className="text-purple-300 text-xs mt-1">
                  Genomsnittlig provision
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </Card>

          {/* Pågående ärenden */}
          <Card className="p-6 bg-gradient-to-br from-orange-500/20 to-red-600/20 border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-sm font-medium">Pågående ärenden</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.pending_cases}
                </p>
                <p className="text-orange-300 text-xs mt-1">
                  Kräver uppmärksamhet
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Månadsöversikt & Senaste ärenden */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Månadsöversikt */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Månadsöversikt
              </h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={goToCommissions}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Visa alla
              </Button>
            </div>

            {/* Månadsväljare */}
            {monthlyCommissions.length > 0 && (
              <div className="mb-4">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                >
                  {monthlyCommissions.map(month => (
                    <option key={month.month} value={month.month}>
                      {month.month_display}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Månadsdata */}
            {currentMonthData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Provision</p>
                    <p className="text-xl font-bold text-green-400">
                      {formatCurrency(currentMonthData.total_commission)}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm">Ärenden</p>
                    <p className="text-xl font-bold text-blue-400">
                      {currentMonthData.case_count}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Snitt per ärende</p>
                  <p className="text-lg font-semibold text-purple-400">
                    {formatCurrency(currentMonthData.avg_commission_per_case)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-400">
                  {monthlyCommissions.length === 0 ? 'Ingen provisionsdata ännu' : 'Ingen data för vald månad'}
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Månader tillgängliga: {monthlyCommissions.length}
                </div>
              </div>
            )}
          </Card>

          {/* Senaste ärenden */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                Senaste ärenden
              </h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={goToCases}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Visa alla
              </Button>
            </div>

            <div className="space-y-3">
              {recentCases.length > 0 ? (
                recentCases.slice(0, 5).map(case_ => (
                  <div 
                    key={case_.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-white text-sm truncate">
                          {case_.title}
                        </p>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          case_.status?.toLowerCase() === 'avslutat' || case_.status?.toLowerCase() === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {case_.status}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs">
                        {case_.case_type === 'private' ? 'Privat' : case_.case_type === 'business' ? 'Företag' : 'Avtal'}
                        {case_.completed_date && ` • ${formatDate(case_.completed_date)}`}
                      </p>
                    </div>
                    {case_.commission_amount && case_.commission_amount > 0 && (
                      <div className="text-right">
                        <p className="text-green-400 font-medium text-sm">
                          {formatCurrency(case_.commission_amount)}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">Inga ärenden att visa</p>
                  <div className="mt-2 text-xs text-slate-500">
                    Cases hämtade: {recentCases.length}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Snabbåtgärder */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Snabbåtgärder
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Skapa Avtal */}
            <button
              onClick={goToOneflow}
              className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-lg hover:from-green-500/30 hover:to-emerald-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                  <FileText className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">Skapa Oneflow Avtal</p>
                  <p className="text-green-300 text-sm">Generera nya kontrakt</p>
                </div>
                <ArrowRight className="w-4 h-4 text-green-400 ml-auto" />
              </div>
            </button>

            {/* Visa Provisioner */}
            <button
              onClick={goToCommissions}
              className="p-4 bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-lg hover:from-blue-500/30 hover:to-cyan-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">Mina Provisioner</p>
                  <p className="text-blue-300 text-sm">Månadsöversikt & detaljer</p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 ml-auto" />
              </div>
            </button>

            {/* Mina Ärenden */}
            <button
              onClick={goToCases}
              className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-pink-600/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">Mina Ärenden</p>
                  <p className="text-purple-300 text-sm">ClickUp integration</p>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400 ml-auto" />
              </div>
            </button>
          </div>
        </Card>
      </main>
    </div>
  )
}