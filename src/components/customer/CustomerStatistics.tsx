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
  CreditCard,
  AlertTriangle,
  Crosshair
} from 'lucide-react'
import EquipmentStatisticsSection from './EquipmentStatisticsSection'
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
import TooltipWrapper from '../ui/TooltipWrapper'
import toast from 'react-hot-toast'

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
  pest_level: number | null
  problem_rating: number | null
  time_spent_minutes: number | null
  recommendations: string | null
  recommendations_acknowledged: boolean | null
}

type TimePeriod = '30d' | '3m' | '6m' | '1y' | 'all'
type StatisticsTab = 'cases' | 'equipment'

interface StatCard {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red'
  tooltip?: string
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
  const [activeTab, setActiveTab] = useState<StatisticsTab>('cases')

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
            address,
            pest_level,
            problem_rating,
            time_spent_minutes,
            recommendations,
            recommendations_acknowledged
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

    // Calculate total cost and average
    const totalCost = filteredCases
      .filter(c => c.price && c.price > 0)
      .reduce((sum, c) => sum + (c.price || 0), 0)
    
    const avgCostPerCase = totalCases > 0 ? Math.round(totalCost / totalCases) : 0

    // Critical cases (pest_level = 3 OR problem_rating >= 4)
    const criticalCases = filteredCases.filter(c => 
      c.pest_level === 3 || (c.problem_rating && c.problem_rating >= 4)
    ).length

    // Pest types analysis
    const pestTypeCounts = filteredCases.reduce((acc, c) => {
      const pestType = c.pest_type || 'Okänt'
      acc[pestType] = (acc[pestType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topPestType = Object.entries(pestTypeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Ingen data'
    const topPestCount = pestTypeCounts[topPestType] || 0

    // Calculate pest type reduction (compare current period with equivalent previous period)
    let pestReductionText = ''
    if (selectedPeriod !== 'all' && topPestType !== 'Ingen data') {
      // Simplified trend calculation - you could make this more sophisticated
      const currentPeriodCases = filteredCases.filter(c => c.pest_type === topPestType).length
      if (currentPeriodCases > 0) {
        pestReductionText = `(${currentPeriodCases} ärenden denna period)`
      }
    }

    // Recommendations status
    const casesWithRecommendations = filteredCases.filter(c => c.recommendations)
    const acknowledgedRecommendations = casesWithRecommendations.filter(c => c.recommendations_acknowledged).length
    const pendingRecommendations = casesWithRecommendations.length - acknowledgedRecommendations

    // Average working time for completed cases
    const completedWithTime = filteredCases.filter(c => 
      isCompletedStatus(c.status) && c.time_spent_minutes && c.time_spent_minutes > 0
    )
    const avgWorkingTime = completedWithTime.length > 0 
      ? Math.round(completedWithTime.reduce((sum, c) => sum + (c.time_spent_minutes || 0), 0) / completedWithTime.length)
      : 0

    return {
      totalCases,
      completedCases,
      activeCases,
      completionRate,
      totalCost,
      avgCostPerCase,
      criticalCases,
      topPestType,
      topPestCount,
      pestReductionText,
      pestTypeCounts,
      acknowledgedRecommendations,
      pendingRecommendations,
      avgWorkingTime
    }
  }, [filteredCases, selectedPeriod])

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

  // Pest trends over time (monthly)
  const pestTrendsData = useMemo(() => {
    const monthlyPestData = filteredCases.reduce((acc, c) => {
      const date = new Date(c.created_at || c.scheduled_start || '')
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const pestType = c.pest_type || 'Okänt'
      
      if (!acc[monthKey]) {
        acc[monthKey] = {}
      }
      
      acc[monthKey][pestType] = (acc[monthKey][pestType] || 0) + 1
      
      return acc
    }, {} as Record<string, Record<string, number>>)

    // Get top 4 pest types for the chart
    const topPestTypes = Object.entries(statistics.pestTypeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([type]) => type)

    return Object.entries(monthlyPestData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, pests]) => {
        const result: any = {
          month: new Date(month + '-01').toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
        }
        
        topPestTypes.forEach(pestType => {
          result[pestType] = pests[pestType] || 0
        })
        
        return result
      })
  }, [filteredCases, statistics.pestTypeCounts])

  // Technical assessment by pest type
  const pestAssessmentData = useMemo(() => {
    const pestAssessments = filteredCases.reduce((acc, c) => {
      const pestType = c.pest_type || 'Okänt'
      
      if (!acc[pestType]) {
        acc[pestType] = {
          count: 0,
          totalPestLevel: 0,
          totalProblemRating: 0,
          pestLevelCount: 0,
          problemRatingCount: 0
        }
      }
      
      acc[pestType].count++
      
      if (c.pest_level !== null) {
        acc[pestType].totalPestLevel += c.pest_level
        acc[pestType].pestLevelCount++
      }
      
      if (c.problem_rating !== null) {
        acc[pestType].totalProblemRating += c.problem_rating
        acc[pestType].problemRatingCount++
      }
      
      return acc
    }, {} as Record<string, any>)

    return Object.entries(pestAssessments)
      .filter(([, data]) => data.count >= 2) // Only show pest types with at least 2 cases
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 6)
      .map(([pestType, data]) => ({
        name: pestType,
        aktivitetsnivå: data.pestLevelCount > 0 ? (data.totalPestLevel / data.pestLevelCount).toFixed(1) : 0,
        situationsbedömning: data.problemRatingCount > 0 ? (data.totalProblemRating / data.problemRatingCount).toFixed(1) : 0,
        antal: data.count
      }))
  }, [filteredCases])

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
        avgCostPerCase: Math.floor(statistics.avgCostPerCase * easeOutQuart)
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
      color: 'blue',
      tooltip: 'Totala antalet skadedjursärenden som BeGone har hanterat för er under vald tidsperiod'
    },
    {
      title: 'Avslutningsgrad',
      value: `${animatedValues.completionRate || 0}%`,
      subtitle: `${animatedValues.completedCases || 0} av ${statistics.totalCases} avslutade`,
      icon: <CheckCircle className="w-5 h-5" />,
      trend: statistics.completionRate >= 80 ? 'up' : statistics.completionRate >= 60 ? 'stable' : 'down',
      color: 'emerald',
      tooltip: 'Andel ärenden som BeGone har slutfört framgångsrikt. Hög procent visar effektiv problemlösning'
    },
    {
      title: 'Aktiva ärenden',
      value: statistics.activeCases,
      subtitle: statistics.activeCases === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <Activity className="w-5 h-5" />,
      color: 'purple',
      tooltip: 'Ärenden som BeGone arbetar aktivt med just nu. Lågt antal indikerar väl kontrollerad situation'
    },
    {
      title: 'Kritiska situationer',
      value: statistics.criticalCases,
      subtitle: statistics.criticalCases === 0 ? 'Inga kritiska situationer' : 
                 statistics.criticalCases === 1 ? 'Kritisk situation' : 'Kritiska situationer',
      icon: <AlertTriangle className="w-5 h-5" />,
      trend: statistics.criticalCases === 0 ? 'up' : statistics.criticalCases <= 2 ? 'stable' : 'down',
      color: statistics.criticalCases === 0 ? 'emerald' : statistics.criticalCases <= 2 ? 'amber' : 'red',
      tooltip: 'Ärenden med hög aktivitetsnivå (3/3) eller allvarlig situationsbedömning (4-5/5). Noll är målet!'
    },
    {
      title: 'Vanligaste skadedjur',
      value: statistics.topPestType,
      subtitle: statistics.topPestCount > 0 ? `${statistics.topPestCount} ärenden ${statistics.pestReductionText}` : 'Ingen data',
      icon: <Bug className="w-5 h-5" />,
      color: 'red',
      tooltip: 'Det skadedjur som förekommit mest i era lokaler. Hjälper planera förebyggande åtgärder'
    },
    {
      title: 'Genomsnittlig kostnad',
      value: formatCurrency(animatedValues.avgCostPerCase || 0),
      subtitle: 'Per ärende denna period',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'emerald',
      tooltip: 'Genomsnittskostnad per hanterat ärende. Ger översikt över budgetinslag för skadedjurshantering'
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
    // Validera att det finns data att exportera
    if (filteredCases.length === 0) {
      toast.error('Inga ärenden att exportera för vald tidsperiod', {
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#ef4444',
          borderRadius: '8px',
          border: '1px solid #374151'
        }
      })
      return
    }

    try {
      setPdfLoading(true)
      console.log('Starting PDF export...', { customer, cases: filteredCases.length, statistics, period: selectedPeriod })
      await exportStatisticsToPDF(customer, filteredCases, statistics, selectedPeriod)
      
      // Visa success-meddelande efter lyckad export
      toast.success('PDF-rapport genererad och nedladdad!', {
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#10b981',
          borderRadius: '8px',
          border: '1px solid #374151'
        },
        icon: '✅'
      })
    } catch (error) {
      console.error('PDF export failed:', error)
      
      // Visa användarvänligt felmeddelande baserat på feltyp
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Nätverksfel. Kontrollera internetanslutningen och försök igen.', {
            duration: 6000,
            style: {
              background: '#1e293b',
              color: '#ef4444',
              borderRadius: '8px',
              border: '1px solid #374151'
            }
          })
        } else if (error.message.includes('timeout')) {
          toast.error('Tidsgräns överskreds. Försök igen med en kortare tidsperiod.', {
            duration: 6000,
            style: {
              background: '#1e293b',
              color: '#ef4444',
              borderRadius: '8px',
              border: '1px solid #374151'
            }
          })
        } else {
          toast.error('Kunde inte generera PDF. Kontakta support om problemet kvarstår.', {
            duration: 6000,
            style: {
              background: '#1e293b',
              color: '#ef4444',
              borderRadius: '8px',
              border: '1px solid #374151'
            }
          })
        }
      } else {
        toast.error('Ett oväntat fel uppstod. Försök igen senare.', {
          duration: 6000,
          style: {
            background: '#1e293b',
            color: '#ef4444',
            borderRadius: '8px',
            border: '1px solid #374151'
          }
        })
      }
    } finally {
      setPdfLoading(false)
    }
  }

  const exportToCSV = () => {
    // Validera att det finns data att exportera
    if (filteredCases.length === 0) {
      toast.error('Inga ärenden att exportera för vald tidsperiod', {
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#ef4444',
          borderRadius: '8px',
          border: '1px solid #374151'
        }
      })
      return
    }

    try {
      exportStatisticsToCSV(customer, filteredCases, selectedPeriod)
      
      // Visa success-meddelande
      toast.success('CSV-fil nedladdad!', {
        duration: 3000,
        style: {
          background: '#1e293b',
          color: '#10b981',
          borderRadius: '8px',
          border: '1px solid #374151'
        },
        icon: '📊'
      })
    } catch (error) {
      console.error('CSV export failed:', error)
      toast.error('Kunde inte exportera CSV. Försök igen.', {
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#ef4444',
          borderRadius: '8px',
          border: '1px solid #374151'
        }
      })
    }
  }

  if (loading) {
    return <StatisticsLoadingState />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            {/* Title and Controls */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <BarChart3 className="w-7 h-7 text-purple-400" />
                  Statistik & Insikter
                </h1>
                <p className="text-slate-400 mt-1">
                  Omfattande analys av era serviceärenden och utrustning
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

                {/* Export Buttons - Only show for cases tab */}
                {activeTab === 'cases' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={exportToPDF}
                      variant="secondary"
                      className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 transition-all duration-200"
                      disabled={pdfLoading || filteredCases.length === 0}
                      aria-label={pdfLoading ? "Genererar PDF-rapport" : "Ladda ner PDF-rapport"}
                      title={filteredCases.length === 0 ? "Inga ärenden att exportera" : "Exportera statistik som PDF"}
                    >
                      {pdfLoading ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
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
                      className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 transition-all duration-200"
                      disabled={filteredCases.length === 0 || pdfLoading}
                      aria-label="Ladda ner CSV-rapport"
                      title={filteredCases.length === 0 ? "Inga ärenden att exportera" : "Exportera statistik som CSV"}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('cases')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'cases'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Bug className="w-4 h-4" />
                Ärenden
              </button>
              <button
                onClick={() => setActiveTab('equipment')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'equipment'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Crosshair className="w-4 h-4" />
                Utrustning & Mätvärden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Conditional based on active tab */}
      {activeTab === 'cases' ? (
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

            {/* Pest Trends Over Time - Line Chart */}
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
                <Bug className="w-5 h-5 text-green-400" />
                Skadedjurstrender Över Tid
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Visar utvecklingen av olika skadedjurstyper över tid - hjälper identifiera säsongsmönster
              </p>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pestTrendsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                    {Object.entries(statistics.pestTypeCounts)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 4)
                      .map(([pestType], index) => {
                        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']
                        return (
                          <Line
                            key={pestType}
                            type="monotone"
                            dataKey={pestType}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={{ fill: colors[index % colors.length], strokeWidth: 2 }}
                            name={pestType}
                          />
                        )
                      })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Technical Assessment by Pest Type - New Chart */}
          <div className="grid grid-cols-1 gap-8 mt-8">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Teknisk Bedömning per Skadedjur
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Genomsnittlig aktivitetsnivå (0-3) och situationsbedömning (1-5) för olika skadedjurstyper
              </p>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pestAssessmentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 5]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#e2e8f0'
                      }}
                      formatter={(value, name) => {
                        if (name === 'aktivitetsnivå') {
                          return [`${value}/3`, 'Aktivitetsnivå']
                        }
                        if (name === 'situationsbedömning') {
                          return [`${value}/5`, 'Situationsbedömning']
                        }
                        return [value, name]
                      }}
                    />
                    <Bar
                      dataKey="aktivitetsnivå"
                      fill="#f59e0b"
                      name="Aktivitetsnivå (0-3)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="situationsbedömning"
                      fill="#ef4444"
                      name="Situationsbedömning (1-5)"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="text-sm text-slate-300">Aktivitetsnivå (0=Ingen, 3=Hög)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-sm text-slate-300">Situationsbedömning (1=Utmärkt, 5=Kritisk)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EquipmentStatisticsSection
          customerId={customer.id}
          timePeriod={selectedPeriod}
        />
      )}
    </div>
  )
}

export default CustomerStatistics