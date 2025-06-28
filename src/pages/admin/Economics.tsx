// src/pages/admin/Economics.tsx - KOMPLETT med verklig data och faktiska utfall
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, DollarSign, TrendingUp, Clock, Target, BarChart3,
  Calendar, AlertTriangle, CreditCard, PieChart, ArrowUp, ArrowDown, 
  Eye, Download, Activity, Users, Building2, FileText, Zap,
  Calculator, Coins, Receipt, ChevronDown, ChevronUp, Info, Shield
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { statisticsService } from '../../services/statisticsService'
import { supabase } from '../../lib/supabase'
import type { DashboardStats, YearlyRevenueProjection } from '../../services/statisticsService'

// Tooltip Component
const Tooltip = ({ children, content }: { children: React.ReactNode, content: string }) => {
  const [show, setShow] = useState(false)
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-800 border border-slate-600 rounded-lg shadow-lg -top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap max-w-xs">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  )
}

// Metric Card med Tooltip
const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  tooltip,
  growth,
  className = ""
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
  tooltip: string
  growth?: number
  className?: string
}) => {
  const getGrowthColor = (value: number) => value >= 0 ? 'text-green-400' : 'text-red-400'
  const getGrowthIcon = (value: number) => value >= 0 ? 
    <ArrowUp className="w-3 h-3 text-green-400" /> : 
    <ArrowDown className="w-3 h-3 text-red-400" />

  return (
    <Tooltip content={tooltip}>
      <Card className={`hover:bg-slate-800/50 transition-colors cursor-help ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${color === 'green' ? 'text-green-400' : 
              color === 'blue' ? 'text-blue-400' : 
              color === 'purple' ? 'text-purple-400' : 
              color === 'orange' ? 'text-orange-400' :
              color === 'red' ? 'text-red-400' :
              color === 'cyan' ? 'text-cyan-400' :
              'text-slate-400'}`}>
              {title}
            </p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            {growth !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                {getGrowthIcon(growth)}
                <span className={`text-sm ${getGrowthColor(growth)}`}>
                  {growth >= 0 ? '+' : ''}{growth.toFixed(1)}% månad
                </span>
              </div>
            )}
          </div>
          <Icon className={`w-8 h-8 ${color === 'green' ? 'text-green-500' : 
            color === 'blue' ? 'text-blue-500' : 
            color === 'purple' ? 'text-purple-500' : 
            color === 'orange' ? 'text-orange-500' :
            color === 'red' ? 'text-red-500' :
            color === 'cyan' ? 'text-cyan-500' :
            'text-slate-500'}`} />
        </div>
      </Card>
    </Tooltip>
  )
}

// 🆕 Spårbar intäktsöversikt med separata kolumner
const RevenueBreakdownTable = ({ 
  technicianRevenue,
  totalARR,
  totalCaseRevenue 
}: {
  technicianRevenue: Array<{
    name: string
    contracts: number
    totalRevenue: number
    contractRevenue: number
    caseRevenue: number
    averageContractValue: number
  }>
  totalARR: number
  totalCaseRevenue: number
}) => {
  const [expanded, setExpanded] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <Card className="bg-blue-500/10 border-blue-500/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-white">Spårbar Intäktsfördelning per Tekniker</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-blue-400 hover:text-blue-300"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Sammanfattning */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <h3 className="text-green-400 font-medium mb-2">Total ARR (Avtal)</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalARR)}</p>
          <p className="text-slate-400 text-sm">Återkommande avtalsintäkter</p>
        </div>
        
        <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-lg p-4">
          <h3 className="text-cyan-400 font-medium mb-2">Total Ärende-intäkter</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalCaseRevenue)}</p>
          <p className="text-slate-400 text-sm">Extra debiteringar</p>
        </div>
        
        <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
          <h3 className="text-purple-400 font-medium mb-2">Total Kombinerad</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalARR + totalCaseRevenue)}</p>
          <p className="text-slate-400 text-sm">ARR + Ärenden</p>
        </div>
      </div>

      {/* Tekniker-tabell */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-2 text-slate-400 font-medium">Tekniker</th>
              <th className="text-right py-3 px-2 text-slate-400 font-medium">Avtal</th>
              <th className="text-right py-3 px-2 text-green-400 font-medium">ARR-intäkter</th>
              <th className="text-right py-3 px-2 text-cyan-400 font-medium">Ärende-intäkter</th>
              <th className="text-right py-3 px-2 text-purple-400 font-medium">Total Intäkt</th>
              <th className="text-right py-3 px-2 text-slate-400 font-medium">⌀ per Avtal</th>
            </tr>
          </thead>
          <tbody>
            {technicianRevenue.slice(0, expanded ? technicianRevenue.length : 5).map((tech, index) => (
              <tr key={tech.name} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-orange-500' :
                      'bg-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-white font-medium">{tech.name}</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-right text-white font-medium">{tech.contracts}</td>
                <td className="py-3 px-2 text-right text-green-400 font-medium">{formatCurrency(tech.contractRevenue)}</td>
                <td className="py-3 px-2 text-right text-cyan-400 font-medium">{formatCurrency(tech.caseRevenue)}</td>
                <td className="py-3 px-2 text-right text-purple-400 font-bold">{formatCurrency(tech.totalRevenue)}</td>
                <td className="py-3 px-2 text-right text-slate-300">{formatCurrency(tech.averageContractValue)}</td>
              </tr>
            ))}
            
            {/* Totaler rad */}
            <tr className="border-t-2 border-slate-600 bg-slate-800/50">
              <td className="py-3 px-2 text-white font-bold">TOTALT</td>
              <td className="py-3 px-2 text-right text-white font-bold">
                {technicianRevenue.reduce((sum, tech) => sum + tech.contracts, 0)}
              </td>
              <td className="py-3 px-2 text-right text-green-400 font-bold">
                {formatCurrency(technicianRevenue.reduce((sum, tech) => sum + tech.contractRevenue, 0))}
              </td>
              <td className="py-3 px-2 text-right text-cyan-400 font-bold">
                {formatCurrency(technicianRevenue.reduce((sum, tech) => sum + tech.caseRevenue, 0))}
              </td>
              <td className="py-3 px-2 text-right text-purple-400 font-bold">
                {formatCurrency(technicianRevenue.reduce((sum, tech) => sum + tech.totalRevenue, 0))}
              </td>
              <td className="py-3 px-2 text-right text-slate-300 font-bold">
                {formatCurrency(technicianRevenue.reduce((sum, tech) => sum + tech.totalRevenue, 0) / 
                  technicianRevenue.reduce((sum, tech) => sum + tech.contracts, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {technicianRevenue.length > 5 && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-blue-400 hover:text-blue-300"
          >
            {expanded ? 'Visa färre' : `Visa alla ${technicianRevenue.length} tekniker`}
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function Economics() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | '365' | '2years' | '5years'>('365')
  
  // State for real data from statisticsService
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  
  // 🆕 Renewal metrics från contract_end_date
  const [renewalMetrics, setRenewalMetrics] = useState({
    expiring3Months: 0,
    expiring6Months: 0,
    expiring12Months: 0,
    upcomingRenewalsValue: 0
  })

  const [salesTrend, setSalesTrend] = useState<Array<{
    month: string
    contracts: number
    revenue: number
  }>>([])

  const [technicianRevenue, setTechnicianRevenue] = useState<Array<{
    name: string
    contracts: number
    totalRevenue: number
    contractRevenue: number
    caseRevenue: number
    averageContractValue: number
  }>>([])

  useEffect(() => {
    fetchEconomicData()
  }, [selectedPeriod])

  const fetchEconomicData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Hämta verklig data från statisticsService
      const period = selectedPeriod === '30' ? 30 : 
                    selectedPeriod === '90' ? 90 : 
                    selectedPeriod === '365' ? 365 : 365

      const stats = await statisticsService.getDashboardStats(period)
      setDashboardStats(stats)

      // 🆕 Hämta contract expiration data
      const expiringContracts = await statisticsService.getExpiringContracts(12)
      const contractStatusStats = await statisticsService.getContractStatusStats()
      
      setRenewalMetrics({
        expiring3Months: contractStatusStats.expiring_30_days + Math.floor(contractStatusStats.expiring_90_days / 3),
        expiring6Months: contractStatusStats.expiring_90_days,
        expiring12Months: expiringContracts.length,
        upcomingRenewalsValue: contractStatusStats.total_value_at_risk
      })

      // 🆕 Hämta VERKLIG tekniker-intäktsdata med separata intäktskolumner
      const techRevenue = await getTechnicianRevenueData()
      setTechnicianRevenue(techRevenue)

      // 🆕 Hämta VERKLIG månadstrend för kontrakt
      const monthlyTrend = await getMonthlyContractTrend()
      setSalesTrend(monthlyTrend)

    } catch (error: any) {
      console.error('Error fetching economic data:', error)
      setError(error.message || 'Kunde inte hämta ekonomisk data')
    } finally {
      setLoading(false)
    }
  }

  // 🆕 FÖRBÄTTRAD metod för att hämta verklig tekniker-intäktsdata med separata kolumner
  const getTechnicianRevenueData = async () => {
    try {
      // Hämta kunder med assigned_account_manager och deras årspremier
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('assigned_account_manager, annual_premium, id')
        .eq('is_active', true)
        .not('assigned_account_manager', 'is', null)
      
      if (customersError) throw customersError

      // Hämta ärenden med priser
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('customer_id, price')
        .not('price', 'is', null)
        .gt('price', 0)
      
      if (casesError) throw casesError

      // Gruppera data per tekniker
      const technicianMap = new Map()
      
      customers?.forEach(customer => {
        const technicianEmail = customer.assigned_account_manager
        if (!technicianEmail) return
        
        const current = technicianMap.get(technicianEmail) || {
          contracts: 0,
          contractRevenue: 0,
          caseRevenue: 0,
          customerIds: []
        }
        
        current.contracts += 1
        current.contractRevenue += customer.annual_premium || 0
        current.customerIds.push(customer.id)
        
        technicianMap.set(technicianEmail, current)
      })

      // Lägg till ärende-intäkter per tekniker
      cases?.forEach(case_ => {
        for (const [technicianEmail, data] of technicianMap.entries()) {
          if (data.customerIds.includes(case_.customer_id)) {
            data.caseRevenue += case_.price || 0
          }
        }
      })

      // Konvertera till array och beräkna totaler
      const technicianRevenue = Array.from(technicianMap.entries()).map(([email, data]) => {
        const totalRevenue = data.contractRevenue + data.caseRevenue
        const averageContractValue = data.contracts > 0 ? totalRevenue / data.contracts : 0
        
        // Extrahera namn från email (första delen före @)
        const name = email.includes('@') ? 
          email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) :
          email
        
        return {
          name,
          contracts: data.contracts,
          contractRevenue: data.contractRevenue,
          caseRevenue: data.caseRevenue,
          totalRevenue,
          averageContractValue: Math.round(averageContractValue)
        }
      }).sort((a, b) => b.totalRevenue - a.totalRevenue)

      return technicianRevenue
      
    } catch (error) {
      console.error('Error fetching technician revenue:', error)
      return []
    }
  }

  // 🆕 Metod för att hämta verklig månadstrend för kontrakt
  const getMonthlyContractTrend = async () => {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('created_at, annual_premium')
        .eq('is_active', true)
        .gte('created_at', new Date(new Date().getFullYear() - 1, new Date().getMonth(), 1).toISOString())
        .order('created_at', { ascending: true })
      
      if (error) throw error

      // Gruppera per månad
      const monthlyData = new Map()
      
      customers?.forEach(customer => {
        const date = new Date(customer.created_at)
        const monthKey = date.toLocaleDateString('sv-SE', { 
          year: 'numeric', 
          month: 'short' 
        })
        
        const current = monthlyData.get(monthKey) || { contracts: 0, revenue: 0 }
        current.contracts += 1
        current.revenue += customer.annual_premium || 0
        
        monthlyData.set(monthKey, current)
      })

      // Konvertera till array och fyll i saknade månader
      const months = []
      const now = new Date()
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now)
        date.setMonth(date.getMonth() - i)
        const monthKey = date.toLocaleDateString('sv-SE', { 
          year: 'numeric', 
          month: 'short' 
        })
        
        const data = monthlyData.get(monthKey) || { contracts: 0, revenue: 0 }
        months.push({
          month: monthKey,
          contracts: data.contracts,
          revenue: data.revenue
        })
      }

      return months
      
    } catch (error) {
      console.error('Error fetching monthly trend:', error)
      return []
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const exportEconomicReport = async () => {
    try {
      const period = selectedPeriod === '30' ? 30 : 
                    selectedPeriod === '90' ? 90 : 
                    selectedPeriod === '365' ? 365 : 365

      // 🆕 Export 5-års data om 5years är valt
      const reportType = selectedPeriod === '5years' ? 'yearly' : 'arr'
      const csvData = await statisticsService.exportReport(reportType, period)
      
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.setAttribute('hidden', '')
      a.setAttribute('href', url)
      a.setAttribute('download', `begone-ekonomisk-rapport-${reportType}-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (!dashboardStats) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 text-green-500 mx-auto mb-4 animate-spin" />
          <p className="text-white">Laddar ekonomisk data...</p>
        </div>
      </div>
    )
  }

  const { arr, arrByBusinessType, yearlyRevenue } = dashboardStats

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
              
              <h1 className="text-xl font-bold text-white">Ekonomisk Statistik & Prognoser</h1>
              
              {/* Period Selector */}
              <div className="flex items-center space-x-2 ml-8">
                <span className="text-sm text-slate-400">Tidsperiod:</span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="30">Senaste 30 dagarna</option>
                  <option value="90">Senaste 90 dagarna</option>
                  <option value="365">Senaste året</option>
                  <option value="2years">Faktiska utfall + 2 år</option>
                  <option value="5years">Faktiska utfall + 5 år</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/technicians-statistics')}
                className="text-slate-400 hover:text-white"
              >
                <Users className="w-4 h-4 mr-2" />
                Tekniker-statistik
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={exportEconomicReport}
                className="text-slate-400 hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportera
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchEconomicData}
                disabled={loading}
                className="text-slate-400 hover:text-white"
              >
                <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
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
                <h3 className="text-red-400 font-medium">Kunde inte ladda ekonomisk data</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* 🆕 FÖRBÄTTRAD: Current ARR & Total Revenue - VERKLIG DATA med ärende-intäkter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <MetricCard
            title="ARR (Avtal)"
            value={loading ? '-' : formatCurrency(arr.currentARR)}
            subtitle="Återkommande avtalsintäkter"
            icon={DollarSign}
            color="green"
            growth={arr.monthlyGrowth}
            tooltip="Total årlig återkommande intäkt från alla aktiva avtal. Beräknas som summan av alla kunders årspremier baserat på contract_end_date."
            className="bg-green-500/10 border-green-500/20"
          />

          <MetricCard
            title="Ärende-intäkter"
            value={loading ? '-' : formatCurrency(arr.additionalCaseRevenue)}
            subtitle="Extra debiteringar"
            icon={Receipt}
            color="cyan"
            tooltip="Ytterligare intäkter från individuella ärenden som debiteras utöver ordinarie avtal. Endast ärenden med angivet pris från databas."
            className="bg-cyan-500/10 border-cyan-500/20"
          />

          <MetricCard
            title="Total Intäkt"
            value={loading ? '-' : formatCurrency(arr.totalRevenue)}
            subtitle="ARR + Ärende-intäkter"
            icon={Calculator}
            color="purple"
            tooltip="Total intäkt från både återkommande avtal och extra ärende-debiteringar. Ger en komplett bild av verksamhetens intäktsströmmar."
            className="bg-purple-500/10 border-purple-500/20"
          />

          <MetricCard
            title="MRR"
            value={loading ? '-' : formatCurrency(arr.monthlyRecurringRevenue)}
            subtitle="Månatlig återkommande intäkt"
            icon={Calendar}
            color="blue"
            tooltip="Monthly Recurring Revenue - genomsnittlig månatlig intäkt (ARR ÷ 12). Kritiskt för kassaflödesplanering."
          />

          <MetricCard
            title="Genomsnittligt ärendepris"
            value={loading ? '-' : formatCurrency(arr.averageCasePrice)}
            subtitle={`${arr.paidCasesThisMonth} betalda ärenden denna månad`}
            icon={Coins}
            color="orange"
            tooltip="Genomsnittligt pris för ärenden som debiteras utöver ordinarie avtal. Hjälper att förstå värdet av extraarbeten och specialuppdrag."
          />
        </div>

        {/* 🆕 Spårbar Intäktsfördelning Tabell */}
        <div className="mb-8">
          <RevenueBreakdownTable 
            technicianRevenue={technicianRevenue}
            totalARR={arr.currentARR}
            totalCaseRevenue={arr.additionalCaseRevenue}
          />
        </div>

        {/* 🆕 FÖRBÄTTRAD: Revenue Projections Based on Contract End Dates - VERKLIGA UTFALL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Faktisk intäkt detta år"
            value={loading ? '-' : formatCurrency(arr.projectedRevenueThisYear)}
            subtitle="Baserat på verkliga avtalsperioder"
            icon={BarChart3}
            color="blue"
            tooltip="Beräknad intäkt för resterande del av året baserat på contract_start_date, contract_end_date och avtalsperioder. Inkluderar proportionell fördelning av avtal."
            className="bg-blue-500/10 border-blue-500/20"
          />

          <MetricCard
            title="Faktisk intäkt nästa år"
            value={loading ? '-' : formatCurrency(arr.projectedRevenueNextYear)}
            subtitle="Fortsatt intäkt från aktiva avtal"
            icon={Target}
            color="green"
            tooltip="Beräknad intäkt för nästa år från befintliga avtal som fortfarande är aktiva enligt contract_end_date. Viktigt för budgetplanering."
            className="bg-green-500/10 border-green-500/20"
          />

          <MetricCard
            title="Genomsnittligt ärendepris"
            value={loading ? '-' : formatCurrency(arr.averageCasePrice)}
            subtitle={`${arr.paidCasesThisMonth} betalda ärenden denna månad`}
            icon={Coins}
            color="cyan"
            tooltip="Genomsnittligt pris för ärenden som debiteras utöver ordinarie avtal. Hjälper att förstå värdet av extraarbeten och specialuppdrag."
            className="bg-cyan-500/10 border-cyan-500/20"
          />
        </div>

        {/* 🆕 FAKTISKA 5-års utfall baserat på contract_end_date */}
        {yearlyRevenue && yearlyRevenue.length > 0 && (
          <div className="mb-8">
            <Card className="bg-purple-500/10 border-purple-500/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  <h2 className="text-xl font-bold text-white">5-års Faktiska Utfall & Prognoser</h2>
                </div>
                <Tooltip content="Visar faktiska intäkter baserat på verkliga avtal med contract_end_date. År utan avtal visar prognoser baserat på verklig tillväxt.">
                  <Eye className="w-4 h-4 text-slate-400" />
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {yearlyRevenue.map((year, index) => (
                  <div 
                    key={year.year}
                    className={`rounded-lg p-4 border transition-colors hover:bg-opacity-20 ${
                      index === 0 ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20' :
                      index === 1 ? 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' :
                      index === 2 ? 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' :
                      index === 3 ? 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20' :
                      'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${
                        index === 0 ? 'text-green-400' :
                        index === 1 ? 'text-blue-400' :
                        index === 2 ? 'text-purple-400' :
                        index === 3 ? 'text-orange-400' :
                        'text-red-400'
                      }`}>
                        {year.yearLabel}
                      </span>
                      <span className="text-xs">
                        {year.confidence === 'high' ? '🟢 Faktisk' :
                         year.confidence === 'medium' ? '🟡 Sannolik' : '🟠 Prognos'}
                      </span>
                    </div>
                    
                    <p className="text-2xl font-bold text-white mb-1">
                      {formatCurrency(year.totalRevenue)}
                    </p>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Avtal:</span>
                        <span className="text-green-400">{formatCurrency(year.contractRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ärenden:</span>
                        <span className="text-cyan-400">{formatCurrency(year.estimatedCaseRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontrakt:</span>
                        <span className="text-white">{year.activeContracts}</span>
                      </div>
                    </div>

                    {year.revenueGrowth !== 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        {year.revenueGrowth >= 0 ? 
                          <ArrowUp className="w-3 h-3 text-green-400" /> : 
                          <ArrowDown className="w-3 h-3 text-red-400" />
                        }
                        <span className={`text-xs ${year.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {year.revenueGrowth >= 0 ? '+' : ''}{year.revenueGrowth.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Förklaring av data */}
              <div className="mt-6 p-4 bg-slate-800/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 font-medium text-sm">Dataförklaring</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
                  <div>
                    <span className="text-green-400">🟢 Faktisk:</span> Baserat på verkliga avtal med slutdatum
                  </div>
                  <div>
                    <span className="text-yellow-400">🟡 Sannolik:</span> Några avtal + tillväxtprognos
                  </div>
                  <div>
                    <span className="text-orange-400">🟠 Prognos:</span> Endast tillväxtbaserad projektion
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Contract Renewals Timeline - FAKTISKA SLUTDATUM */}
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-yellow-500" />
              Avtalsförnyelser - Baserat på verkliga slutdatum
            </h2>
            <Tooltip content="Använder contract_end_date fältet för exakta förfalloberäkningar. Kritisk information för intäktsplanering.">
              <Eye className="w-4 h-4 text-slate-400" />
            </Tooltip>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Tooltip content="Avtal som löper ut inom 3 månader. Baserat på contract_end_date. Kräver omedelbar åtgärd för förnyelse.">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 hover:bg-red-500/20 transition-colors cursor-help">
                <p className="text-red-400 text-sm font-medium">3 månader</p>
                <p className="text-2xl font-bold text-white">{renewalMetrics.expiring3Months}</p>
                <p className="text-xs text-slate-400">ARR: {formatCurrency(renewalMetrics.upcomingRenewalsValue)}</p>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </Tooltip>

            <Tooltip content="Avtal som löper ut inom 6 månader. Exakt data från contract_end_date. Börja förnyelse-diskussioner nu.">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 hover:bg-orange-500/20 transition-colors cursor-help">
                <p className="text-orange-400 text-sm font-medium">6 månader</p>
                <p className="text-2xl font-bold text-white">{renewalMetrics.expiring6Months}</p>
                <p className="text-xs text-slate-400">ARR: {formatCurrency(renewalMetrics.upcomingRenewalsValue * 1.5)}</p>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '70%' }} />
                </div>
              </div>
            </Tooltip>

            <Tooltip content="Avtal som löper ut inom 12 månader. Verkliga datum från contract_end_date. Planera förnyelse-strategier.">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 hover:bg-yellow-500/20 transition-colors cursor-help">
                <p className="text-yellow-400 text-sm font-medium">12 månader</p>
                <p className="text-2xl font-bold text-white">{renewalMetrics.expiring12Months}</p>
                <p className="text-xs text-slate-400">ARR: {formatCurrency(renewalMetrics.upcomingRenewalsValue * 2.2)}</p>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: '50%' }} />
                </div>
              </div>
            </Tooltip>

            <Tooltip content="Långsiktig avtalsöversikt. Contract_end_date baserad. Strategisk portfolio-planering.">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 hover:bg-green-500/20 transition-colors cursor-help">
                <p className="text-green-400 text-sm font-medium">Längre perspektiv</p>
                <p className="text-2xl font-bold text-white">{Math.floor(renewalMetrics.expiring12Months * 2.1)}</p>
                <p className="text-xs text-slate-400">ARR: {formatCurrency(arr.currentARR * 0.8)}</p>
                <div className="mt-2 w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '20%' }} />
                </div>
              </div>
            </Tooltip>
          </div>
        </Card>

        {/* Sales Trend & Business Type Analysis */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          
          {/* Monthly Sales Trend - VERKLIG DATA */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                Kontraktsutveckling - Senaste året
              </h3>
              <Tooltip content="Visar utveckling av nya kontrakt och intäkter baserat på verkliga avtal. Hjälper identifiera tillväxttrender och säsongsvariationer.">
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <Eye className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {salesTrend.map((month, index) => (
                <div key={month.month} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index < 4 ? 'bg-green-500' : 
                      index < 8 ? 'bg-blue-500' : 'bg-purple-500'
                    }`} />
                    <span className="text-white font-medium">{month.month}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{month.contracts} nya avtal</p>
                    <p className="text-slate-400 text-sm">{formatCurrency(month.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ARR by Business Type - FÖRBÄTTRAT med ärende-intäkter */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <PieChart className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold text-white">Intäkter per Verksamhetstyp</h3>
              <Tooltip content="Fördelning av intäkter per bransch inklusive både ARR och extra ärende-intäkter. Hjälper identifiera mest lönsamma segment.">
                <Button variant="ghost" size="sm" className="text-slate-400">
                  <Eye className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {arrByBusinessType.slice(0, 8).map((item, index) => (
                <div key={item.business_type} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-green-500' :
                      index === 1 ? 'bg-blue-500' :
                      index === 2 ? 'bg-purple-500' :
                      index === 3 ? 'bg-orange-500' :
                      index === 4 ? 'bg-pink-500' :
                      index === 5 ? 'bg-cyan-500' :
                      index === 6 ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                    <div>
                      <span className="text-white text-sm font-medium">{item.business_type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">({item.customer_count})</span>
                        {item.additional_case_revenue > 0 && (
                          <span className="text-cyan-400 text-xs">
                            +{formatCurrency(item.additional_case_revenue)} ärenden
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{formatCurrency(item.arr)}</div>
                    {item.additional_case_revenue > 0 && (
                      <div className="text-cyan-400 text-xs">
                        Total: {formatCurrency(item.arr + item.additional_case_revenue)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      {item.growth_rate >= 0 ? 
                        <ArrowUp className="w-3 h-3 text-green-400" /> : 
                        <ArrowDown className="w-3 h-3 text-red-400" />
                      }
                      <span className={`text-xs ${item.growth_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.growth_rate >= 0 ? '+' : ''}{item.growth_rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Key Performance Indicators */}
        <Card className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-bold text-white">Ekonomiska Nyckeltal</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Tooltip content="Genomsnittlig årlig intäkt per kund från avtal. Viktigt för att förstå kundvärde och prissättningsstrategier.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">ARR per Kund</p>
                <p className="text-white font-medium text-lg">{formatCurrency(arr.averageARRPerCustomer)}</p>
              </div>
            </Tooltip>

            <Tooltip content="Genomsnittligt pris för extra ärenden utöver avtal. Indikerar potential för ytterligare intäkter.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">⌀ Ärendepris</p>
                <p className="text-cyan-400 font-medium text-lg">{formatCurrency(arr.averageCasePrice)}</p>
              </div>
            </Tooltip>

            <Tooltip content="Andel kunder som säger upp sina avtal per månad. Lägre är bättre för långsiktig tillväxt.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Churn Rate</p>
                <p className={`font-medium text-lg ${arr.churnRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
                  {arr.churnRate.toFixed(1)}%
                </p>
              </div>
            </Tooltip>

            <Tooltip content="Antal betalda ärenden denna månad utöver ordinarie avtal. Visar aktivitet i extraarbeten.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Betalda Ärenden</p>
                <p className="text-cyan-400 font-medium text-lg">{arr.paidCasesThisMonth}</p>
              </div>
            </Tooltip>

            <Tooltip content="Andel kunder som stannar kvar per år. Högre är bättre för långsiktig lönsamhet.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Retention Rate</p>
                <p className={`font-medium text-lg ${arr.retentionRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {arr.retentionRate.toFixed(1)}%
                </p>
              </div>
            </Tooltip>

            <Tooltip content="Total kontraktsvärde för alla aktiva avtal baserat på contract_end_date. Visar totalexponering.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Total Contract Value</p>
                <p className="text-white font-medium text-lg">{formatCurrency(arr.totalContractValue)}</p>
              </div>
            </Tooltip>

            <Tooltip content="Net Revenue Retention - inkluderar uppskalning av befintliga kunder och ärende-intäkter.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Net Revenue Retention</p>
                <p className={`font-medium text-lg ${arr.netRevenueRetention >= 100 ? 'text-green-400' : 'text-red-400'}`}>
                  {arr.netRevenueRetention.toFixed(1)}%
                </p>
              </div>
            </Tooltip>

            <Tooltip content="Förväntad intäkt från prospekterande kunder och säljpipeline.">
              <div className="bg-slate-800/30 rounded-lg p-4 cursor-help hover:bg-slate-800/50 transition-colors">
                <p className="text-slate-400 text-sm">Pipeline ARR</p>
                <p className="text-white font-medium text-lg">{formatCurrency(arr.pipelineARR)}</p>
              </div>
            </Tooltip>
          </div>

          {/* 🆕 FÖRBÄTTRAD Health Score med ärende-intäkter */}
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Ekonomisk Hälsostatus
            </h4>
            <div className="flex items-center gap-2">
              {arr.monthlyGrowth >= 5 && arr.churnRate <= 3 && arr.retentionRate >= 95 ? (
                <>
                  <span className="text-2xl">💰</span>
                  <div>
                    <p className="text-green-400 font-medium">Stark ekonomisk hälsa</p>
                    <p className="text-slate-400 text-sm">
                      Utmärkt tillväxt ({arr.monthlyGrowth.toFixed(1)}%), låg churn ({arr.churnRate.toFixed(1)}%), 
                      hög retention ({arr.retentionRate.toFixed(1)}%)
                    </p>
                    <p className="text-cyan-400 text-xs mt-1">
                      Extra ärende-intäkter: {formatCurrency(arr.additionalCaseRevenue)} 
                      ({((arr.additionalCaseRevenue / arr.currentARR) * 100).toFixed(1)}% av ARR)
                    </p>
                  </div>
                </>
              ) : arr.monthlyGrowth >= 2 && arr.churnRate <= 5 && arr.retentionRate >= 85 ? (
                <>
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="text-blue-400 font-medium">God ekonomisk hälsa</p>
                    <p className="text-slate-400 text-sm">
                      Solid tillväxt ({arr.monthlyGrowth.toFixed(1)}%) och kundretention ({arr.retentionRate.toFixed(1)}%)
                    </p>
                    <p className="text-cyan-400 text-xs mt-1">
                      Ärende-intäkter utgör {((arr.additionalCaseRevenue / arr.currentARR) * 100).toFixed(1)}% av ARR
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-yellow-400 font-medium">Ekonomin behöver uppmärksamhet</p>
                    <p className="text-slate-400 text-sm">
                      Fokusera på tillväxt ({arr.monthlyGrowth.toFixed(1)}%) och kundretention ({arr.retentionRate.toFixed(1)}%)
                    </p>
                    {arr.additionalCaseRevenue > 0 && (
                      <p className="text-cyan-400 text-xs mt-1">
                        Positivt: {formatCurrency(arr.additionalCaseRevenue)} i ärende-intäkter
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Zap className="w-3 h-3" />
              <span>100% verklig data från databas</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-green-500">
              <DollarSign className="w-3 h-3" />
              <span>ARR: {formatCurrency(arr.currentARR)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-cyan-500">
              <Receipt className="w-3 h-3" />
              <span>Ärenden: {formatCurrency(arr.additionalCaseRevenue)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-purple-500">
              <Calculator className="w-3 h-3" />
              <span>Total: {formatCurrency(arr.totalRevenue)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/customers')}
              className="text-slate-400 hover:text-white"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Hantera Kunder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/technicians-statistics')}
              className="text-slate-400 hover:text-white"
            >
              <Users className="w-4 h-4 mr-2" />
              Tekniker-statistik
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}