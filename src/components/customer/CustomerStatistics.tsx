// src/components/customer/CustomerStatistics.tsx - Comprehensive Customer Statistics Dashboard
import React, { useEffect, useState, useMemo } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts'
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Target, 
  Download,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Bug,
  MapPin,
  CreditCard
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus, getCustomerStatusDisplay } from '../../types/database'
import { formatCurrency } from '../../utils/formatters'
import { 
  exportStatisticsToPDF, 
  exportStatisticsToCSV,
  getSeasonalTrends,
  calculateServiceMetrics 
} from '../../utils/statisticsUtils'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import StatisticsLoadingState from './StatisticsLoadingState'

interface CustomerStatisticsProps {
  customer: {
    id: string
    company_name: string
    annual_value: number | null
  }
}

interface CaseData {
  id: string
  title: string
  status: string
  pest_type: string | null
  price: number | null
  created_at: string
  scheduled_start: string | null
  scheduled_end: string | null
  completed_date: string | null
  address: string | null
}

type TimePeriod = '30d' | '3m' | '6m' | '1y' | 'all'

interface StatCard {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red'
}

interface ChartData {
  name: string
  value: number
  count?: number
  color?: string
}

const CustomerStatistics: React.FC<CustomerStatisticsProps> = ({ customer }) => {
  const [cases, setCases] = useState<CaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1y')
  const [animatedValues, setAnimatedValues] = useState<{ [key: string]: number }>({})
  const [pdfLoading, setPdfLoading] = useState(false)

  // Fetch cases data
  useEffect(() => {
    const fetchCasesData = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('cases')
          .select(`
            id,
            title,
            status,
            pest_type,
            price,
            created_at,
            scheduled_start,
            scheduled_end,
            completed_date,
            address
          `)
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setCases(data || [])
      } catch (error) {
        console.error('Error fetching cases:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCasesData()
  }, [customer.id])

  // Filter cases by time period
  const filteredCases = useMemo(() => {
    if (selectedPeriod === 'all') return cases

    const now = new Date()
    const periodMap = {
      '30d': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365
    }

    const daysBack = periodMap[selectedPeriod]
    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))

    return cases.filter(caseItem => {
      const caseDate = new Date(caseItem.created_at || caseItem.scheduled_start || '')
      return caseDate >= cutoffDate
    })
  }, [cases, selectedPeriod])

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalCases = filteredCases.length
    const completedCases = filteredCases.filter(c => isCompletedStatus(c.status)).length
    const activeCases = totalCases - completedCases
    const completionRate = totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0

    // Calculate total cost
    const totalCost = filteredCases
      .filter(c => c.price && c.price > 0)
      .reduce((sum, c) => sum + (c.price || 0), 0)

    // Calculate average response time (days between created and scheduled)
    const casesWithBothDates = filteredCases.filter(c => 
      c.created_at && c.scheduled_start
    )
    
    const avgResponseTime = casesWithBothDates.length > 0 
      ? Math.round(
          casesWithBothDates.reduce((sum, c) => {
            const created = new Date(c.created_at)
            const scheduled = new Date(c.scheduled_start!)
            const diffDays = (scheduled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
            return sum + diffDays
          }, 0) / casesWithBothDates.length
        )
      : 0

    // Most common pest types
    const pestTypeCounts = filteredCases.reduce((acc, c) => {
      const pestType = c.pest_type || 'Okänt'
      acc[pestType] = (acc[pestType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topPestType = Object.entries(pestTypeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Ingen data'

    return {
      totalCases,
      completedCases,
      activeCases,
      completionRate,
      totalCost,
      avgResponseTime,
      topPestType,
      pestTypeCounts
    }
  }, [filteredCases])

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const statusCounts = filteredCases.reduce((acc, c) => {
      const displayStatus = getCustomerStatusDisplay(c.status)
      acc[displayStatus] = (acc[displayStatus] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const colors = [
      '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
    ]

    return Object.entries(statusCounts).map(([status, count], index) => ({
      name: status,
      value: count,
      color: colors[index % colors.length]
    }))
  }, [filteredCases])

  // Monthly trend data for line chart
  const monthlyTrendData = useMemo(() => {
    const monthlyData = filteredCases.reduce((acc, c) => {
      const date = new Date(c.created_at || c.scheduled_start || '')
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!acc[monthKey]) {
        acc[monthKey] = { created: 0, completed: 0 }
      }
      
      acc[monthKey].created++
      if (isCompletedStatus(c.status)) {
        acc[monthKey].completed++
      }
      
      return acc
    }, {} as Record<string, { created: number, completed: number }>)

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' }),
        skapade: data.created,
        avslutade: data.completed
      }))
  }, [filteredCases])

  // Pest type data for bar chart
  const pestTypeData = useMemo(() => {
    return Object.entries(statistics.pestTypeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([type, count]) => ({
        name: type,
        värde: count
      }))
  }, [statistics.pestTypeCounts])

  // Animate values on mount
  useEffect(() => {
    const duration = 1500
    const steps = 60
    const stepDuration = duration / steps
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      
      setAnimatedValues({
        totalCases: Math.floor(statistics.totalCases * easeOutQuart),
        completedCases: Math.floor(statistics.completedCases * easeOutQuart),
        completionRate: Math.floor(statistics.completionRate * easeOutQuart),
        totalCost: Math.floor(statistics.totalCost * easeOutQuart),
        avgResponseTime: Math.floor(statistics.avgResponseTime * easeOutQuart)
      })

      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [statistics])

  const periodOptions = [
    { value: '30d', label: 'Senaste 30 dagarna' },
    { value: '3m', label: 'Senaste 3 månaderna' },
    { value: '6m', label: 'Senaste 6 månaderna' },
    { value: '1y', label: 'Senaste året' },
    { value: 'all', label: 'Hela tiden' }
  ]

  const statCards: StatCard[] = [
    {
      title: 'Totalt antal ärenden',
      value: animatedValues.totalCases || 0,
      subtitle: selectedPeriod === 'all' ? 'Hela tiden' : periodOptions.find(p => p.value === selectedPeriod)?.label,
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'blue'
    },
    {
      title: 'Avslutningsgrad',
      value: `${animatedValues.completionRate || 0}%`,
      subtitle: `${animatedValues.completedCases || 0} av ${statistics.totalCases} avslutade`,
      icon: <CheckCircle className="w-5 h-5" />,
      trend: statistics.completionRate >= 80 ? 'up' : statistics.completionRate >= 60 ? 'stable' : 'down',
      color: 'emerald'
    },
    {
      title: 'Aktiva ärenden',
      value: statistics.activeCases,
      subtitle: statistics.activeCases === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <Activity className="w-5 h-5" />,
      color: 'purple'
    },
    {
      title: 'Genomsnittlig responstid',
      value: `${animatedValues.avgResponseTime || 0} dagar`,
      subtitle: 'Från registrering till schemaläggning',
      icon: <Clock className="w-5 h-5" />,
      trend: statistics.avgResponseTime <= 3 ? 'up' : statistics.avgResponseTime <= 7 ? 'stable' : 'down',
      color: 'amber'
    },
    {
      title: 'Vanligaste skadedjur',
      value: statistics.topPestType,
      subtitle: `${statistics.pestTypeCounts[statistics.topPestType] || 0} ärenden`,
      icon: <Bug className="w-5 h-5" />,
      color: 'red'
    },
    {
      title: 'Total kostnad',
      value: formatCurrency(animatedValues.totalCost || 0),
      subtitle: 'Genomsnitt per ärende',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'emerald'
    }
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: 'text-emerald-500',
        hover: 'hover:border-emerald-500/40',
        glow: 'hover:shadow-emerald-500/10'
      },
      blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: 'text-blue-500',
        hover: 'hover:border-blue-500/40',
        glow: 'hover:shadow-blue-500/10'
      },
      purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        icon: 'text-purple-500',
        hover: 'hover:border-purple-500/40',
        glow: 'hover:shadow-purple-500/10'
      },
      amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: 'text-amber-500',
        hover: 'hover:border-amber-500/40',
        glow: 'hover:shadow-amber-500/10'
      },
      red: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: 'text-red-500',
        hover: 'hover:border-red-500/40',
        glow: 'hover:shadow-red-500/10'
      }
    }
    return colors[color as keyof typeof colors] || colors.emerald
  }

  const exportToPDF = async () => {
    try {
      setPdfLoading(true)
      console.log('Starting PDF export...', { customer, cases: filteredCases.length, statistics, period: selectedPeriod })
      await exportStatisticsToPDF(customer, filteredCases, statistics, selectedPeriod)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Kunde inte generera PDF. Se konsolen för mer information.')
    } finally {
      setPdfLoading(false)
    }
  }

  const exportToCSV = () => {
    exportStatisticsToCSV(customer, filteredCases, selectedPeriod)
  }

  if (loading) {
    return <StatisticsLoadingState />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-purple-400" />
                Statistik & Insikter
              </h1>
              <p className="text-slate-400 mt-1">
                Omfattande analys av era serviceärenden och trends
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Time Period Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
                  className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {periodOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={exportToPDF}
                  variant="secondary"
                  className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                  disabled={pdfLoading}
                >
                  {pdfLoading ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      Genererar...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </>
                  )}
                </Button>
                <Button
                  onClick={exportToCSV}
                  variant="secondary"
                  className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((card, index) => {
            const colors = getColorClasses(card.color)
            
            return (
              <div
                key={card.title}
                className={`
                  relative group bg-slate-800/50 backdrop-blur border ${colors.border} 
                  rounded-xl p-6 transition-all duration-300 ${colors.hover} 
                  hover:shadow-lg ${colors.glow} hover:-translate-y-1
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute inset-0 ${colors.bg} rounded-xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
                
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
                      <div className={colors.icon}>{card.icon}</div>
                    </div>
                    
                    {card.trend && (
                      <div className={`flex items-center gap-1 text-xs ${
                        card.trend === 'up' ? 'text-green-400' : 
                        card.trend === 'down' ? 'text-red-400' : 
                        'text-slate-400'
                      }`}>
                        {card.trend === 'up' && (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {card.trendValue && <span>{card.trendValue}</span>}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-slate-400 text-sm font-medium mb-2">{card.title}</p>
                  
                  <p className="text-2xl font-bold text-white mb-1 font-mono">
                    {card.value}
                  </p>
                  
                  {card.subtitle && (
                    <p className="text-xs text-slate-500">{card.subtitle}</p>
                  )}
                </div>

                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.bg} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
              </div>
            )
          })}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Status Distribution - Pie Chart */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <PieChartIcon className="w-5 h-5 text-blue-400" />
              Ärendestatus Fördelning
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-slate-300 truncate">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Trends - Line Chart */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Månatliga Trends
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="skapade"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorCreated)"
                    name="Skapade"
                  />
                  <Area
                    type="monotone"
                    dataKey="avslutade"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                    name="Avslutade"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pest Type Distribution - Bar Chart */}
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <Bug className="w-5 h-5 text-green-400" />
              Vanligaste Skadedjur
            </h3>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pestTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar dataKey="värde" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {pestTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${(index * 60) % 360}, 70%, 50%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerStatistics