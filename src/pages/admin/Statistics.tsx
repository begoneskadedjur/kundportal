// src/pages/admin/Statistics.tsx - Dedikerad statistik-sida för ARR & Tekniker
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  ArrowLeft, DollarSign, TrendingUp, Clock, Target, BarChart3, Activity, 
  Wrench, Star, Users, FileText, Calendar, AlertTriangle, UserCheck,
  CreditCard, PieChart, ArrowUp, ArrowDown, Settings, Eye, Download
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

type ARRStats = {
  currentARR: number
  monthlyGrowth: number
  upcomingRenewals: number
  pipelineARR: number
  averageARRPerCustomer: number
  contractsExpiring3Months: number
  contractsExpiring6Months: number
  totalContractValue: number
  monthlyRecurringRevenue: number
  churnRate: number
}

type TechnicianStats = {
  activeTechnicians: number
  totalTechnicians: number
  activeCases: number
  averageCasesPerTechnician: number
  capacityUtilization: number
  urgentCases: number
  completedCasesThisMonth: number
  averageResolutionTime: number
  firstVisitSuccessRate: number
  overdueCases: number
}

type ARRByBusinessType = {
  business_type: string
  arr: number
  customer_count: number
}

export default function Statistics() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  
  const [arrStats, setARRStats] = useState<ARRStats>({
    currentARR: 0,
    monthlyGrowth: 0,
    upcomingRenewals: 0,
    pipelineARR: 0,
    averageARRPerCustomer: 0,
    contractsExpiring3Months: 0,
    contractsExpiring6Months: 0,
    totalContractValue: 0,
    monthlyRecurringRevenue: 0,
    churnRate: 0
  })
  
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats>({
    activeTechnicians: 0,
    totalTechnicians: 0,
    activeCases: 0,
    averageCasesPerTechnician: 0,
    capacityUtilization: 0,
    urgentCases: 0,
    completedCasesThisMonth: 0,
    averageResolutionTime: 0,
    firstVisitSuccessRate: 0,
    overdueCases: 0
  })
  
  const [arrByBusinessType, setARRByBusinessType] = useState<ARRByBusinessType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | '365'>('30')

  useEffect(() => {
    fetchAllStats()
  }, [selectedPeriod])

  const fetchAllStats = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        fetchARRStats(),
        fetchTechnicianStats(),
        fetchARRByBusinessType()
      ])
    } catch (error: any) {
      console.error('💥 Stats fetch failed:', error)
      setError(error.message || 'Kunde inte hämta statistik')
    } finally {
      setLoading(false)
    }
  }

  const fetchARRStats = async () => {
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id, is_active, annual_premium, total_contract_value,
        contract_start_date, contract_length_months, business_type,
        created_at
      `)
    
    if (error) throw error
    
    const activeCustomers = (customers || []).filter(c => c.is_active)
    
    // Beräkna nuvarande ARR
    const currentARR = activeCustomers.reduce((sum, customer) => 
      sum + (customer.annual_premium || 0), 0
    )
    
    // Beräkna genomsnittlig ARR per kund
    const averageARRPerCustomer = activeCustomers.length > 0 
      ? currentARR / activeCustomers.length 
      : 0
    
    // Beräkna MRR (Monthly Recurring Revenue)
    const monthlyRecurringRevenue = currentARR / 12
    
    // Beräkna total contract value
    const totalContractValue = activeCustomers.reduce((sum, customer) => 
      sum + (customer.total_contract_value || 0), 0
    )
    
    // Beräkna avtal som löper ut inom 3 och 6 månader
    const now = new Date()
    const in3Months = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const in6Months = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    
    let contractsExpiring3Months = 0
    let contractsExpiring6Months = 0
    let upcomingRenewals = 0
    
    activeCustomers.forEach(customer => {
      if (customer.contract_start_date && customer.contract_length_months) {
        const startDate = new Date(customer.contract_start_date)
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + customer.contract_length_months)
        
        if (endDate <= in3Months && endDate > now) {
          contractsExpiring3Months++
          upcomingRenewals += customer.annual_premium || 0
        } else if (endDate <= in6Months && endDate > now) {
          contractsExpiring6Months++
        }
      }
    })
    
    // Simulerade värden för demo
    const monthlyGrowth = (Math.random() - 0.2) * 15 // -3% till +12%
    const pipelineARR = currentARR * 0.15 // 15% av nuvarande ARR som pipeline
    const churnRate = Math.random() * 5 // 0-5%
    
    setARRStats({
      currentARR,
      monthlyGrowth,
      upcomingRenewals,
      pipelineARR,
      averageARRPerCustomer,
      contractsExpiring3Months,
      contractsExpiring6Months,
      totalContractValue,
      monthlyRecurringRevenue,
      churnRate
    })
  }

  const fetchTechnicianStats = async () => {
    // Hämta tekniker-data
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, is_active')
    
    if (techError) throw techError
    
    // Hämta ärenden-data
    const { data: cases, error: casesError } = await supabase
      .from('cases')
      .select('id, status, priority, created_at, completed_date, scheduled_date')
    
    if (casesError) throw casesError
    
    const activeTechnicians = (technicians || []).filter(t => t.is_active).length
    const totalTechnicians = (technicians || []).length
    
    const allCases = cases || []
    const activeCases = allCases.filter(c => 
      c.status === 'in_progress' || c.status === 'pending'
    ).length
    
    const urgentCases = allCases.filter(c => 
      c.priority === 'urgent' && (c.status === 'in_progress' || c.status === 'pending')
    ).length
    
    // Beräkna ärenden per tekniker
    const averageCasesPerTechnician = activeTechnicians > 0 
      ? activeCases / activeTechnicians 
      : 0
    
    // Beräkna completed cases this month
    const thisMonth = new Date()
    thisMonth.setDate(1)
    const completedCasesThisMonth = allCases.filter(c => 
      c.status === 'completed' && 
      c.completed_date && 
      new Date(c.completed_date) >= thisMonth
    ).length
    
    // Beräkna överdue cases
    const now = new Date()
    const overdueCases = allCases.filter(c => 
      c.scheduled_date && 
      new Date(c.scheduled_date) < now && 
      (c.status === 'pending' || c.status === 'in_progress')
    ).length
    
    // Simulerade värden för mer avancerad statistik
    const capacityUtilization = Math.min(95, 60 + Math.random() * 30) // 60-90%
    const averageResolutionTime = 2.5 + Math.random() * 2 // 2.5-4.5 dagar
    const firstVisitSuccessRate = 75 + Math.random() * 20 // 75-95%
    
    setTechnicianStats({
      activeTechnicians,
      totalTechnicians,
      activeCases,
      averageCasesPerTechnician,
      capacityUtilization,
      urgentCases,
      completedCasesThisMonth,
      averageResolutionTime,
      firstVisitSuccessRate,
      overdueCases
    })
  }

  const fetchARRByBusinessType = async () => {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('business_type, annual_premium')
      .eq('is_active', true)
    
    if (error) throw error
    
    const businessTypeMap = new Map<string, { arr: number, count: number }>()
    
    customers?.forEach(customer => {
      const type = customer.business_type || 'Annat'
      const current = businessTypeMap.get(type) || { arr: 0, count: 0 }
      businessTypeMap.set(type, {
        arr: current.arr + (customer.annual_premium || 0),
        count: current.count + 1
      })
    })
    
    const result = Array.from(businessTypeMap.entries()).map(([business_type, data]) => ({
      business_type,
      arr: data.arr,
      customer_count: data.count
    })).sort((a, b) => b.arr - a.arr)
    
    setARRByBusinessType(result)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getGrowthIcon = (value: number) => {
    return value >= 0 ? 
      <ArrowUp className="w-3 h-3 text-green-400" /> : 
      <ArrowDown className="w-3 h-3 text-red-400" />
  }

  const getGrowthColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400'
  }

  const exportData = () => {
    // Enkel CSV export för demo
    const csvData = [
      'Metric,Value',
      `Current ARR,${arrStats.currentARR}`,
      `Monthly Growth,${arrStats.monthlyGrowth.toFixed(2)}%`,
      `Active Technicians,${technicianStats.activeTechnicians}`,
      `Capacity Utilization,${technicianStats.capacityUtilization.toFixed(1)}%`,
      // ... fler rader
    ].join('\n')
    
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('hidden', '')
    a.setAttribute('href', url)
    a.setAttribute('download', `begone-statistics-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tillbaka till Dashboard
              </Button>
              
              <div className="h-6 w-px bg-slate-600" />
              
              <h1 className="text-xl font-bold text-white">Avancerad Statistik</h1>
              
              {/* Period Selector */}
              <div className="flex items-center space-x-2 ml-8">
                <span className="text-sm text-slate-400">Period:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as '30' | '90' | '365')}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="30">Senaste 30 dagarna</option>
                  <option value="90">Senaste 90 dagarna</option>
                  <option value="365">Senaste året</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={exportData}
                className="text-slate-400 hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAllStats}
                disabled={loading}
                className="text-slate-400 hover:text-white"
              >
                <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Uppdaterar...' : 'Uppdatera'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

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
                  onClick={fetchAllStats}
                  className="mt-2"
                >
                  Försök igen
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ARR & Tekniker Statistics - Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          
          {/* ARR & Economic Statistics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-500" />
                ARR & Ekonomisk Statistik
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/customers')}
                className="text-slate-400 hover:text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Visa kunder
              </Button>
            </div>

            {/* ARR Main Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-green-500/10 border-green-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">Nuvarande ARR</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : formatCurrency(arrStats.currentARR)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {getGrowthIcon(arrStats.monthlyGrowth)}
                      <span className={`text-sm ${getGrowthColor(arrStats.monthlyGrowth)}`}>
                        {formatPercentage(arrStats.monthlyGrowth)} denna månad
                      </span>
                    </div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">MRR (Månatlig)</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : formatCurrency(arrStats.monthlyRecurringRevenue)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Genomsnitt per månad
                    </p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Genomsnitt ARR/kund</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : formatCurrency(arrStats.averageARRPerCustomer)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Per aktiv kund
                    </p>
                  </div>
                  <Target className="w-8 h-8 text-purple-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pipeline ARR</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : formatCurrency(arrStats.pipelineARR)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Förväntad intäkt
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-orange-500" />
                </div>
              </Card>
            </div>

            {/* Contract Renewal Alerts */}
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-white">Avtalsförnyelser</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 text-sm">Löper ut inom 3 månader</p>
                  <p className="text-xl font-bold text-yellow-400">
                    {loading ? '-' : arrStats.contractsExpiring3Months}
                  </p>
                  <p className="text-xs text-slate-500">
                    ARR: {formatCurrency(arrStats.upcomingRenewals)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Löper ut inom 6 månader</p>
                  <p className="text-xl font-bold text-orange-400">
                    {loading ? '-' : arrStats.contractsExpiring6Months}
                  </p>
                  <p className="text-xs text-slate-500">
                    Kräver uppmärksamhet
                  </p>
                </div>
              </div>
            </Card>

            {/* ARR by Business Type */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <PieChart className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-white">ARR per Verksamhetstyp</h3>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {loading ? (
                  <p className="text-slate-400">Laddar...</p>
                ) : (
                  arrByBusinessType.slice(0, 6).map((item, index) => (
                    <div key={item.business_type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${
                          index === 0 ? 'from-green-400 to-green-600' :
                          index === 1 ? 'from-blue-400 to-blue-600' :
                          index === 2 ? 'from-purple-400 to-purple-600' :
                          index === 3 ? 'from-orange-400 to-orange-600' :
                          index === 4 ? 'from-pink-400 to-pink-600' :
                          'from-gray-400 to-gray-600'
                        }`} />
                        <span className="text-white text-sm">{item.business_type}</span>
                        <span className="text-slate-400 text-xs">({item.customer_count})</span>
                      </div>
                      <span className="text-white font-medium">
                        {formatCurrency(item.arr)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Technician Statistics */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-6 h-6 text-blue-500" />
                Tekniker-statistik
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/technicians')}
                className="text-slate-400 hover:text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Hantera tekniker
              </Button>
            </div>

            {/* Technician Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-blue-500/10 border-blue-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm font-medium">Aktiva Tekniker</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : `${technicianStats.activeTechnicians}/${technicianStats.totalTechnicians}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {((technicianStats.activeTechnicians / technicianStats.totalTechnicians) * 100).toFixed(0)}% aktiva
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Kapacitetsutnyttjande</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : `${technicianStats.capacityUtilization.toFixed(0)}%`}
                    </p>
                    <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${technicianStats.capacityUtilization}%` }}
                      />
                    </div>
                  </div>
                  <Activity className="w-8 h-8 text-green-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pågående Ärenden</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : technicianStats.activeCases}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      ⌀ {technicianStats.averageCasesPerTechnician.toFixed(1)} per tekniker
                    </p>
                  </div>
                  <FileText className="w-8 h-8 text-purple-500" />
                </div>
              </Card>

              <Card className="bg-red-500/10 border-red-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400 text-sm font-medium">Akuta Ärenden</p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '-' : technicianStats.urgentCases}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Kräver omedelbar åtgärd
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </Card>
            </div>

            {/* Performance Metrics */}
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-white">Prestanda & Kvalitet</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-400 text-sm">Första besöks-success</p>
                    <p className="text-xl font-bold text-white">
                      {loading ? '-' : `${technicianStats.firstVisitSuccessRate.toFixed(0)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Genomsnittlig lösningstid</p>
                    <p className="text-xl font-bold text-white">
                      {loading ? '-' : `${technicianStats.averageResolutionTime.toFixed(1)} dagar`}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-slate-400 text-sm">Avslutade denna månad</p>
                    <p className="text-xl font-bold text-white">
                      {loading ? '-' : technicianStats.completedCasesThisMonth}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Försenade ärenden</p>
                    <p className="text-xl font-bold text-white">
                      {loading ? '-' : technicianStats.overdueCases}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border-green-500/20">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-white">Snabbåtgärder</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={() => navigate('/admin/customers/new')}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Lägg till ny kund
                </Button>
                <Button
                  onClick={() => navigate('/admin/technicians')}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Hantera tekniker
                </Button>
                <Button
                  onClick={() => navigate('/admin/customers')}
                  className="w-full justify-start"
                  variant="secondary"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Hantera avtal
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Additional Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Economic Health Score */}
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-white">Ekonomisk Hälsa</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Total Contract Value</span>
                <span className="text-white font-medium">
                  {loading ? '-' : formatCurrency(arrStats.totalContractValue)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Churn Rate</span>
                <span className={`font-medium ${arrStats.churnRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
                  {loading ? '-' : `${arrStats.churnRate.toFixed(1)}%`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  {arrStats.churnRate <= 3 ? '✅ Utmärkt kundretention' :
                   arrStats.churnRate <= 5 ? '⚠️ Acceptabel kundretention' :
                   '🚨 Hög kundförlust - åtgärd krävs'}
                </p>
              </div>
            </div>
          </Card>

          {/* Team Efficiency */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Team-effektivitet</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Produktivitet</span>
                <span className="text-white font-medium">
                  {loading ? '-' : `${(technicianStats.capacityUtilization).toFixed(0)}%`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Kvalitetsindex</span>
                <span className="text-white font-medium">
                  {loading ? '-' : `${technicianStats.firstVisitSuccessRate.toFixed(0)}%`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  {technicianStats.capacityUtilization >= 85 ? '✅ Optimal kapacitetsutnyttjande' :
                   technicianStats.capacityUtilization >= 70 ? '⚠️ God kapacitetsutnyttjande' :
                   '🚨 Låg kapacitetsutnyttjande'}
                </p>
              </div>
            </div>
          </Card>

          {/* Growth Opportunities */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-white">Tillväxtmöjligheter</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Pipeline Value</span>
                <span className="text-white font-medium">
                  {loading ? '-' : formatCurrency(arrStats.pipelineARR)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Potential ARR Increase</span>
                <span className="text-green-400 font-medium">
                  {loading ? '-' : `+${((arrStats.pipelineARR / arrStats.currentARR) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500">
                  📈 Fokusera på avtalsförnyelser inom 3 månader för bästa ROI
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Summary and Actions */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={fetchAllStats}
              variant="secondary"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Uppdaterar...' : 'Uppdatera statistik'}
            </Button>
            
            <span className="text-xs text-slate-500">
              Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportData}
              className="text-slate-400 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportera rapport
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/customers')}
              className="text-slate-400 hover:text-white"
            >
              <Eye className="w-4 h-4 mr-2" />
              Detaljvy
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}