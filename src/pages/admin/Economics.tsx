// src/pages/admin/Economics.tsx - FIXAD med svenska översättningar, månadsgrafer och tooltip-fix
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, DollarSign, TrendingUp, Clock, Target, BarChart3,
  Calendar, AlertTriangle, PieChart, ArrowUp, ArrowDown,
  Eye, Download, Activity, Users, Building2,
  Calculator, Coins, Receipt, ChevronDown, ChevronUp, Info, Zap,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { statisticsService } from '../../services/statisticsService'
import { supabase } from '../../lib/supabase'
import type { DashboardStats, YearlyRevenueProjection, ARRStats } from '../../services/statisticsService'

// Tooltip Component - FIXAD
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
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-800 border border-slate-600 rounded-lg shadow-lg -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full whitespace-normal max-w-xs w-max">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  )
}

// 🆕 Monthly Chart Component (Modifierad för att hantera båda typerna)
const MonthlyChart = ({
  title,
  data,
  currentYear,
  onYearChange,
  type = 'contracts'
}: {
  title: string
  data: Array<{ month: string, value: number }>
  currentYear: number
  onYearChange: (year: number) => void
  type: 'contracts' | 'revenue'
}) => {
  const formatValue = (amount: number) => {
    if (type === 'revenue') {
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount)
    }
    return amount.toString()
  }

  const maxValue = Math.max(...data.map(d => d.value), 1) // Sätt 1 som minimum för att undvika division med noll
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ]

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-green-500" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onYearChange(currentYear - 1)}
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <span className="text-white font-medium px-3">{currentYear}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onYearChange(currentYear + 1)}
            disabled={currentYear >= new Date().getFullYear()}
            className="text-slate-400 hover:text-white disabled:opacity-50"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="h-64 flex items-end justify-between gap-2 mb-4">
        {data.map((monthData, index) => {
          const height = maxValue > 0 ? (monthData.value / maxValue) * 200 : 0
          return (
            <div key={index} className="flex flex-col items-center flex-1 group">
              <div 
                className="relative w-full rounded-t-lg transition-all duration-300 group-hover:opacity-80"
                style={{ 
                  height: `${height}px`, 
                  minHeight: monthData.value > 0 ? '4px' : '0px',
                  backgroundColor: type === 'contracts' ? '#22c55e' : '#3b82f6' // green-500 or blue-500
                }}
              >
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-800 text-white text-xs px-2 py-1 rounded">
                  {formatValue(monthData.value)}
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">{monthNames[index]}</div>
            </div>
          )
        })}
      </div>
      
      <div className="pt-4 border-t border-slate-700 text-sm">
        <span className="text-slate-400">Total {currentYear}:</span>
        <span className={`ml-2 font-medium ${type === 'contracts' ? 'text-green-400' : 'text-blue-400'}`}>
          {formatValue(data.reduce((sum, d) => sum + d.value, 0))}
        </span>
      </div>
    </Card>
  )
}

// Metric Card med Tooltip
const MetricCard = ({
  title, value, subtitle, icon: Icon, color, tooltip, growth, className = ""
}: {
  title: string; value: string | number; subtitle?: string; icon: any; color: string; tooltip: string; growth?: number; className?: string;
}) => {
  const getGrowthColor = (value: number) => value >= 0 ? 'text-green-400' : 'text-red-400'
  const getGrowthIcon = (value: number) => value >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />

  return (
    <Tooltip content={tooltip}>
      <Card className={`hover:bg-slate-800/50 transition-colors cursor-help ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium text-${color}-400`}>{title}</p>
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
          <Icon className={`w-8 h-8 text-${color}-500`} />
        </div>
      </Card>
    </Tooltip>
  )
}

const RevenueBreakdownTable = ({
  technicianRevenue, totalARR, totalCaseRevenue
}: {
  technicianRevenue: Array<{ name: string; contracts: number; contractRevenue: number; caseRevenue: number; totalRevenue: number; averageContractValue: number; }>;
  totalARR: number; totalCaseRevenue: number;
}) => {
  const [expanded, setExpanded] = useState(false)
  const formatCurrency = (amount: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  return (
    <Card className="bg-blue-500/10 border-blue-500/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-500" />
          Spårbar Intäktsfördelning per Tekniker
        </h2>
        {technicianRevenue.length > 5 && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-blue-400 hover:text-blue-300">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <h3 className="text-green-400 font-medium mb-2">Total ARR (Avtal)</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalARR)}</p>
        </div>
        <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-lg p-4">
          <h3 className="text-cyan-400 font-medium mb-2">Total Ärende-intäkter</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalCaseRevenue)}</p>
        </div>
        <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
          <h3 className="text-purple-400 font-medium mb-2">Total Kombinerad</h3>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalARR + totalCaseRevenue)}</p>
        </div>
      </div>

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
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-slate-600'}`}>
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
            <tr className="border-t-2 border-slate-600 bg-slate-800/50">
              <td className="py-3 px-2 text-white font-bold">TOTALT</td>
              <td className="py-3 px-2 text-right text-white font-bold">{technicianRevenue.reduce((s, t) => s + t.contracts, 0)}</td>
              <td className="py-3 px-2 text-right text-green-400 font-bold">{formatCurrency(totalARR)}</td>
              <td className="py-3 px-2 text-right text-cyan-400 font-bold">{formatCurrency(totalCaseRevenue)}</td>
              <td className="py-3 px-2 text-right text-purple-400 font-bold">{formatCurrency(totalARR + totalCaseRevenue)}</td>
              <td className="py-3 px-2 text-right text-slate-300 font-bold">
                  {formatCurrency((totalARR + totalCaseRevenue) / (technicianRevenue.reduce((s, t) => s + t.contracts, 0) || 1))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {technicianRevenue.length > 5 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-blue-400 hover:text-blue-300">
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
  const [selectedPeriod, setSelectedPeriod] = useState<'30' | '90' | '365' | '5years'>('365')
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [technicianRevenue, setTechnicianRevenue] = useState<any[]>([])

  // 🆕 State för de nya graferna
  const [contractsChartYear, setContractsChartYear] = useState(new Date().getFullYear())
  const [caseRevenueChartYear, setCaseRevenueChartYear] = useState(new Date().getFullYear())
  const [contractsChartData, setContractsChartData] = useState<Array<{ month: string, value: number }>>([])
  const [caseRevenueChartData, setCaseRevenueChartData] = useState<Array<{ month: string, value: number }>>([])

  // Hämta allmän data
  useEffect(() => {
    fetchEconomicData()
  }, [selectedPeriod])

  // Hämta grafdata när år ändras
  useEffect(() => {
    fetchChartData(contractsChartYear, caseRevenueChartYear)
  }, [contractsChartYear, caseRevenueChartYear])

  const fetchEconomicData = async () => {
    setLoading(true)
    setError(null)
    try {
      const period = selectedPeriod === '30' ? 30 : selectedPeriod === '90' ? 90 : 365
      const [stats, techRevenue] = await Promise.all([
        statisticsService.getDashboardStats(period),
        getTechnicianRevenueData()
      ])
      
      setDashboardStats(stats)
      setTechnicianRevenue(techRevenue)
    } catch (error: any) {
      console.error('Error fetching economic data:', error)
      setError(error.message || 'Kunde inte hämta ekonomisk data')
    } finally {
      setLoading(false)
    }
  }

  // 🆕 Hämta data för båda graferna
  const fetchChartData = async (contractsYear: number, caseRevenueYear: number) => {
    try {
      const [contractsData, caseRevenueData] = await Promise.all([
        getYearlyContractChartData(contractsYear),
        getYearlyCaseRevenueChartData(caseRevenueYear)
      ]);
      setContractsChartData(contractsData);
      setCaseRevenueChartData(caseRevenueData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Sätt tom data vid fel
      const emptyData = Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}`, value: 0 }));
      setContractsChartData(emptyData);
      setCaseRevenueChartData(emptyData);
    }
  };

  // 🆕 Hämta data för ANTAL NYA KONTRAKT per månad
  const getYearlyContractChartData = async (year: number) => {
    const { data, error } = await supabase
      .from('customers')
      .select('created_at')
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lt('created_at', `${year + 1}-01-01T00:00:00.000Z`)

    if (error) throw error;
    
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleDateString('sv-SE', { month: 'short' }),
      value: 0
    }));

    data?.forEach(customer => {
      const monthIndex = new Date(customer.created_at).getMonth();
      monthlyData[monthIndex].value += 1;
    });

    return monthlyData;
  }

  // 🆕 Hämta data för ÄRENDE-INTÄKTER per månad
  const getYearlyCaseRevenueChartData = async (year: number) => {
    const { data, error } = await supabase
      .from('cases')
      .select('completed_date, price')
      .not('price', 'is', null)
      .gt('price', 0)
      .not('completed_date', 'is', null)
      .gte('completed_date', `${year}-01-01T00:00:00.000Z`)
      .lt('completed_date', `${year + 1}-01-01T00:00:00.000Z`)

    if (error) throw error;
    
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(year, i).toLocaleDateString('sv-SE', { month: 'short' }),
      value: 0
    }));

    data?.forEach(caseItem => {
      const monthIndex = new Date(caseItem.completed_date!).getMonth();
      monthlyData[monthIndex].value += caseItem.price || 0;
    });

    return monthlyData;
  }

  const getTechnicianRevenueData = async () => {
    // (Denna funktion från din originalkod är bra, återanvänds här)
    const { data: customers, error: customersError } = await supabase.from('customers').select('id, assigned_account_manager, annual_premium').eq('is_active', true).not('assigned_account_manager', 'is', null)
    if (customersError) throw customersError
    const { data: cases, error: casesError } = await supabase.from('cases').select('customer_id, price').not('price', 'is', null).gt('price', 0)
    if (casesError) throw casesError

    const techMap = new Map<string, { contracts: number; contractRevenue: number; caseRevenue: number; customerIds: string[] }>()
    customers?.forEach(c => {
      const techEmail = c.assigned_account_manager!
      const current = techMap.get(techEmail) || { contracts: 0, contractRevenue: 0, caseRevenue: 0, customerIds: [] }
      current.contracts++
      current.contractRevenue += c.annual_premium || 0
      current.customerIds.push(c.id)
      techMap.set(techEmail, current)
    })
    cases?.forEach(cs => {
      for (const [techEmail, data] of techMap.entries()) {
        if (data.customerIds.includes(cs.customer_id)) {
          data.caseRevenue += cs.price || 0
          techMap.set(techEmail, data)
        }
      }
    })
    return Array.from(techMap.entries()).map(([email, data]) => {
      const totalRevenue = data.contractRevenue + data.caseRevenue
      const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      return { name, ...data, totalRevenue, averageContractValue: Math.round(data.contracts > 0 ? totalRevenue / data.contracts : 0) }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

  const exportEconomicReport = async () => {
    try {
      const period = selectedPeriod === '30' ? 30 : selectedPeriod === '90' ? 90 : 365
      const reportType = selectedPeriod === '5years' ? 'yearly' : 'arr'
      const csvData = await statisticsService.exportReport(reportType, period)
      
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `begone-ekonomisk-rapport-${reportType}-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (loading || !dashboardStats) {
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
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Tillbaka
              </Button>
              <h1 className="text-xl font-bold text-white">Ekonomisk Översikt</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={exportEconomicReport} className="text-slate-400 hover:text-white">
                <Download className="w-4 h-4 mr-2" />
                Exportera
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchEconomicData} disabled={loading} className="text-slate-400 hover:text-white">
                <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <Card className="bg-red-500/10 border-red-500/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="text-red-400 font-medium">Fel vid hämtning av data</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard title="ARR (Avtal)" value={formatCurrency(arr.currentARR)} subtitle="Återkommande avtalsintäkter" icon={DollarSign} color="green" growth={arr.monthlyGrowth} tooltip="Total årlig återkommande intäkt från alla aktiva avtal." className="bg-green-500/10 border-green-500/20" />
          <MetricCard title="Ärende-intäkter" value={formatCurrency(arr.additionalCaseRevenue)} subtitle="Extra debiteringar" icon={Receipt} color="cyan" tooltip="Ytterligare intäkter från individuella ärenden utöver ordinarie avtal." className="bg-cyan-500/10 border-cyan-500/20" />
          <MetricCard title="Total Intäkt" value={formatCurrency(arr.totalRevenue)} subtitle="ARR + Ärenden" icon={Calculator} color="purple" tooltip="Total intäkt från både avtal och ärenden." className="bg-purple-500/10 border-purple-500/20" />
          <MetricCard title="MRR" value={formatCurrency(arr.monthlyRecurringRevenue)} subtitle="Månatlig återkommande intäkt" icon={Calendar} color="blue" tooltip="Monthly Recurring Revenue (ARR / 12)." />
          <MetricCard title="⌀ Ärendepris" value={formatCurrency(arr.averageCasePrice)} subtitle={`${arr.paidCasesThisMonth} betalda ärenden denna månad`} icon={Coins} color="orange" tooltip="Genomsnittligt pris för debiterade ärenden." />
        </div>

        <RevenueBreakdownTable technicianRevenue={technicianRevenue} totalARR={arr.currentARR} totalCaseRevenue={arr.additionalCaseRevenue} />

        {/* 🆕 NYA GRAFER */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <MonthlyChart
            title="Nya Avtal per Månad"
            data={contractsChartData}
            currentYear={contractsChartYear}
            onYearChange={setContractsChartYear}
            type="contracts"
          />
          <MonthlyChart
            title="Ärende-intäkter per Månad"
            data={caseRevenueChartData}
            currentYear={caseRevenueChartYear}
            onYearChange={setCaseRevenueChartYear}
            type="revenue"
          />
        </div>

        {yearlyRevenue && yearlyRevenue.length > 0 && (
          <Card className="bg-purple-500/10 border-purple-500/20">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-purple-500" />5-års Faktiska Utfall & Prognoser
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {yearlyRevenue.map((year, index) => (
                <div key={year.year} className={`rounded-lg p-4 border`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{year.yearLabel}</span>
                    <span className="text-xs">{year.confidence === 'high' ? '🟢 Faktisk' : year.confidence === 'medium' ? '🟡 Sannolik' : '🟠 Prognos'}</span>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{formatCurrency(year.totalRevenue)}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Avtal:</span><span className="text-green-400">{formatCurrency(year.contractRevenue)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Ärenden:</span><span className="text-cyan-400">{formatCurrency(year.estimatedCaseRevenue)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-yellow-500" />
            Kommande Avtalsförnyelser
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm font-medium">Inom 3 månader</p>
              <p className="text-2xl font-bold text-white">{arr.contractsExpiring3Months}</p>
              <p className="text-xs text-slate-400">Avtal</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <p className="text-orange-400 text-sm font-medium">Inom 6 månader</p>
              <p className="text-2xl font-bold text-white">{arr.contractsExpiring6Months}</p>
              <p className="text-xs text-slate-400">Avtal</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-yellow-400 text-sm font-medium">Inom 12 månader</p>
              <p className="text-2xl font-bold text-white">{arr.contractsExpiring12Months}</p>
              <p className="text-xs text-slate-400">Avtal</p>
            </div>
          </div>
        </Card>

        <Card>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <Target className="w-5 h-5 text-green-500" />
                Ekonomiska Nyckeltal
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">ARR per Kund</p><p className="text-white font-medium text-lg">{formatCurrency(arr.averageARRPerCustomer)}</p></div>
                <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Churn Rate</p><p className={`font-medium text-lg ${arr.churnRate > 5 ? 'text-red-400' : 'text-green-400'}`}>{arr.churnRate.toFixed(1)}%</p></div>
                <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Retention Rate</p><p className={`font-medium text-lg ${arr.retentionRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>{arr.retentionRate.toFixed(1)}%</p></div>
                <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Net Revenue Retention</p><p className={`font-medium text-lg ${arr.netRevenueRetention >= 100 ? 'text-green-400' : 'text-red-400'}`}>{arr.netRevenueRetention.toFixed(1)}%</p></div>
            </div>
        </Card>

        <div className="mt-8 flex items-center justify-between text-xs text-slate-500">
          <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-green-500" />
            <span>100% verklig data från databas</span>
          </div>
        </div>

      </main>
    </div>
  )
}