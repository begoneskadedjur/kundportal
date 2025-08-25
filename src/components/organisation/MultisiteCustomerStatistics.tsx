// src/components/organisation/MultisiteCustomerStatistics.tsx - Multisite statistics aggregator
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
  Users,
  Building
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus, getCustomerStatusDisplay } from '../../types/database'
import { formatCurrency } from '../../utils/formatters'
import { 
  exportStatisticsToPDF, 
  exportStatisticsToCSV 
} from '../../utils/statisticsUtils'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import StatisticsLoadingState from '../customer/StatisticsLoadingState'
import TooltipWrapper from '../ui/TooltipWrapper'
import toast from 'react-hot-toast'
import { OrganizationSite } from '../../types/multisite'

interface MultisiteCustomerStatisticsProps {
  sites: OrganizationSite[]
  selectedSiteIds: string[] // 'all' eller specifika site IDs
  organizationName: string
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
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
  customer_id: string
  site_name?: string
}

interface SiteStatistics {
  siteId: string
  siteName: string
  totalCases: number
  completedCases: number
  activeCases: number
  criticalCases: number
  avgWorkingTime: number
  totalCost: number
  topPestType: string
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
  tooltip?: string
}

const MultisiteCustomerStatistics: React.FC<MultisiteCustomerStatisticsProps> = ({ 
  sites, 
  selectedSiteIds, 
  organizationName,
  userRoleType 
}) => {
  const [cases, setCases] = useState<CaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1y')
  const [animatedValues, setAnimatedValues] = useState<{ [key: string]: number }>({})
  const [pdfLoading, setPdfLoading] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Determine which sites to analyze
  const analyzedSites = useMemo(() => {
    if (selectedSiteIds.includes('all')) {
      return sites
    }
    return sites.filter(site => selectedSiteIds.includes(site.id))
  }, [sites, selectedSiteIds])

  // Fetch cases data for selected sites
  useEffect(() => {
    const fetchCasesData = async () => {
      if (analyzedSites.length === 0) {
        setCases([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Get customer IDs from analyzed sites
        const customerIds = analyzedSites
          .map(site => site.customer_id)
          .filter(Boolean) // Remove null/undefined
        
        if (customerIds.length === 0) {
          setCases([])
          setLoading(false)
          return
        }

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
            recommendations_acknowledged,
            customer_id
          `)
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Add site information to cases
        const casesWithSiteInfo = (data || []).map(caseItem => {
          const site = analyzedSites.find(s => s.customer_id === caseItem.customer_id)
          return {
            ...caseItem,
            site_name: site?.site_name || 'Okänd enhet'
          }
        })

        setCases(casesWithSiteInfo)
      } catch (error) {
        console.error('Error fetching multisite cases:', error)
        toast.error('Kunde inte ladda ärendedata')
      } finally {
        setLoading(false)
      }
    }

    fetchCasesData()
  }, [analyzedSites])

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

  // Calculate aggregated statistics
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

    // Site-level statistics
    const siteStatistics: SiteStatistics[] = analyzedSites.map(site => {
      const siteCases = filteredCases.filter(c => c.customer_id === site.customer_id)
      const siteCompleted = siteCases.filter(c => isCompletedStatus(c.status))
      const siteCritical = siteCases.filter(c => 
        c.pest_level === 3 || (c.problem_rating && c.problem_rating >= 4)
      )
      
      const siteCompletedWithTime = siteCompleted.filter(c => 
        c.time_spent_minutes && c.time_spent_minutes > 0
      )
      const siteAvgWorkingTime = siteCompletedWithTime.length > 0 
        ? Math.round(siteCompletedWithTime.reduce((sum, c) => sum + (c.time_spent_minutes || 0), 0) / siteCompletedWithTime.length)
        : 0

      const sitePestTypes = siteCases.reduce((acc, c) => {
        const pestType = c.pest_type || 'Okänt'
        acc[pestType] = (acc[pestType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      const siteTopPest = Object.entries(sitePestTypes)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Ingen data'

      const siteTotalCost = siteCases
        .filter(c => c.price && c.price > 0)
        .reduce((sum, c) => sum + (c.price || 0), 0)

      return {
        siteId: site.id,
        siteName: site.site_name,
        totalCases: siteCases.length,
        completedCases: siteCompleted.length,
        activeCases: siteCases.length - siteCompleted.length,
        criticalCases: siteCritical.length,
        avgWorkingTime: siteAvgWorkingTime,
        totalCost: siteTotalCost,
        topPestType: siteTopPest
      }
    })

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
      pestTypeCounts,
      avgWorkingTime,
      siteStatistics,
      analyzedSitesCount: analyzedSites.length
    }
  }, [filteredCases, analyzedSites])

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

  // Site comparison data for bar chart
  const siteComparisonData = useMemo(() => {
    return statistics.siteStatistics
      .sort((a, b) => b.totalCases - a.totalCases)
      .slice(0, 10) // Top 10 sites
      .map(site => ({
        name: site.siteName,
        ärenden: site.totalCases,
        avslutade: site.completedCases,
        kritiska: site.criticalCases
      }))
  }, [statistics.siteStatistics])

  // Prepare pest type data for charts
  const pestTypeData = useMemo(() => {
    return Object.entries(statistics.pestTypeCounts || {})
      .sort(([,a], [,b]) => b - a)
      .map(([name, värde]) => ({ name, värde }))
  }, [statistics.pestTypeCounts])

  // Create pest trends data based on real case data over time
  const pestTrendsData = useMemo(() => {
    if (!statistics.siteStatistics || statistics.siteStatistics.length === 0) return []
    
    // Get all cases from site statistics to create monthly groupings
    const allCases = statistics.siteStatistics.flatMap(site => site.cases || [])
    
    // Group cases by month over the last 6 months
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        monthKey: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        monthLabel: date.toLocaleDateString('sv-SE', { month: 'short' })
      })
    }

    return months.map(({ monthKey, monthLabel }) => {
      const monthCases = allCases.filter(c => {
        if (!c.created_at) return false
        const caseDate = new Date(c.created_at)
        const caseMonthKey = `${caseDate.getFullYear()}-${(caseDate.getMonth() + 1).toString().padStart(2, '0')}`
        return caseMonthKey === monthKey
      })

      const data: any = { month: monthLabel }
      
      // Count cases by pest type for this month
      Object.keys(statistics.pestTypeCounts || {}).forEach(pestType => {
        if (pestType === 'Okänt') return // Skip unknown pests in trends
        data[pestType] = monthCases.filter(c => (c.pest_type || 'Okänt') === pestType).length
      })
      
      return data
    }).filter(monthData => {
      // Only include months that have at least some pest data
      const pestCounts = Object.values(monthData).slice(1) as number[]
      return pestCounts.some(count => count > 0)
    })
  }, [statistics.siteStatistics, statistics.pestTypeCounts])

  // Create health status over time data (replacing pest assessment)
  const healthStatusOverTimeData = useMemo(() => {
    if (!statistics.siteStatistics || statistics.siteStatistics.length === 0) return []
    
    // Get all cases from site statistics to create monthly health trends
    const allCases = statistics.siteStatistics.flatMap(site => site.cases || [])
    
    // Group cases by month over the last 6 months
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        monthKey: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
        monthLabel: date.toLocaleDateString('sv-SE', { month: 'short' })
      })
    }

    return months.map(({ monthKey, monthLabel }) => {
      const monthCases = allCases.filter(c => {
        if (!c.created_at) return false
        const caseDate = new Date(c.created_at)
        const caseMonthKey = `${caseDate.getFullYear()}-${(caseDate.getMonth() + 1).toString().padStart(2, '0')}`
        return caseMonthKey === monthKey
      })

      // Calculate average pest_level and problem_rating for the month
      const casesWithPestLevel = monthCases.filter(c => c.pest_level !== null && c.pest_level !== undefined)
      const casesWithProblemRating = monthCases.filter(c => c.problem_rating !== null && c.problem_rating !== undefined)

      const avgPestLevel = casesWithPestLevel.length > 0 
        ? casesWithPestLevel.reduce((sum, c) => sum + (c.pest_level || 0), 0) / casesWithPestLevel.length
        : 0

      const avgProblemRating = casesWithProblemRating.length > 0
        ? casesWithProblemRating.reduce((sum, c) => sum + (c.problem_rating || 0), 0) / casesWithProblemRating.length
        : 0

      return {
        månad: monthLabel,
        aktivitetsnivå: Math.round(avgPestLevel * 10) / 10, // Round to 1 decimal
        situationsbedömning: Math.round(avgProblemRating * 10) / 10, // Round to 1 decimal
        antalÄrenden: monthCases.length
      }
    }).filter(monthData => monthData.antalÄrenden > 0) // Only include months with cases
  }, [statistics.siteStatistics])

  // Animate values on mount (only once or when period changes)
  useEffect(() => {
    const key = `${selectedPeriod}-${statistics.totalCases}-${statistics.analyzedSitesCount}`
    
    if (hasAnimated && statistics.totalCases !== undefined) {
      // If already animated and data exists, set values directly without animation
      setAnimatedValues({
        totalCases: statistics.totalCases,
        completedCases: statistics.completedCases,
        completionRate: statistics.completionRate,
        avgCostPerCase: statistics.avgCostPerCase,
        criticalCases: statistics.criticalCases,
        analyzedSitesCount: statistics.analyzedSitesCount
      })
      return
    }

    if (statistics.totalCases === 0 && statistics.analyzedSitesCount === 0) {
      // No data to animate
      return
    }

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
        avgCostPerCase: Math.floor(statistics.avgCostPerCase * easeOutQuart),
        criticalCases: Math.floor(statistics.criticalCases * easeOutQuart),
        analyzedSitesCount: Math.floor(statistics.analyzedSitesCount * easeOutQuart)
      })

      if (currentStep >= steps) {
        clearInterval(interval)
        setHasAnimated(true)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [statistics, selectedPeriod, hasAnimated])

  // Reset animation when period changes
  useEffect(() => {
    setHasAnimated(false)
  }, [selectedPeriod])

  const periodOptions = [
    { value: '30d', label: 'Senaste 30 dagarna' },
    { value: '3m', label: 'Senaste 3 månaderna' },
    { value: '6m', label: 'Senaste 6 månaderna' },
    { value: '1y', label: 'Senaste året' },
    { value: 'all', label: 'Hela tiden' }
  ]

  const statCards: StatCard[] = [
    {
      title: userRoleType === 'platsansvarig' ? 'Min enhet' : 'Analyserade enheter',
      value: userRoleType === 'platsansvarig' && sites.length === 1 
        ? 'Inkluderad' 
        : (animatedValues.analyzedSitesCount || 0),
      subtitle: userRoleType === 'platsansvarig' && sites.length === 1
        ? `${sites.find(s => selectedSiteIds.includes(s.id) || selectedSiteIds.includes('all'))?.site_name || 'Enhet'}`
        : `av ${sites.length} totala enheter`,
      icon: <Building className="w-5 h-5" />,
      color: 'purple',
      tooltip: `${userRoleType === 'platsansvarig' ? 'Din enhet är inkluderad i statistikanalysen' : `Antal enheter som ingår i denna statistikanalys. ${userRoleType === 'verksamhetschef' ? 'Du kan se alla enheter' : 'Du ser enheter i din region'}`}`
    },
    {
      title: 'Totalt antal ärenden',
      value: animatedValues.totalCases || 0,
      subtitle: selectedPeriod === 'all' ? 'Hela tiden' : periodOptions.find(p => p.value === selectedPeriod)?.label,
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'blue',
      tooltip: 'Totala antalet skadedjursärenden som BeGone har hanterat för alla analyserade enheter under vald tidsperiod'
    },
    {
      title: 'Avslutningsgrad',
      value: `${animatedValues.completionRate || 0}%`,
      subtitle: `${animatedValues.completedCases || 0} av ${statistics.totalCases} avslutade`,
      icon: <CheckCircle className="w-5 h-5" />,
      trend: statistics.completionRate >= 80 ? 'up' : statistics.completionRate >= 60 ? 'stable' : 'down',
      color: 'emerald',
      tooltip: 'Genomsnittlig andel ärenden som BeGone har slutfört framgångsrikt över alla enheter. Hög procent visar effektiv problemlösning'
    },
    {
      title: 'Aktiva ärenden',
      value: statistics.activeCases,
      subtitle: statistics.activeCases === 0 ? 'Inga pågående ärenden' :
                statistics.activeCases === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <Activity className="w-5 h-5" />,
      color: 'amber',
      tooltip: 'Ärenden som BeGone arbetar aktivt med just nu över alla enheter. Lågt antal indikerar väl kontrollerad situation'
    },
    {
      title: 'Kritiska situationer',
      value: animatedValues.criticalCases || 0,
      subtitle: statistics.criticalCases === 0 ? 'Inga kritiska situationer' : 
                 statistics.criticalCases === 1 ? 'Kritisk situation' : 'Kritiska situationer',
      icon: <AlertTriangle className="w-5 h-5" />,
      trend: statistics.criticalCases === 0 ? 'up' : statistics.criticalCases <= 2 ? 'stable' : 'down',
      color: statistics.criticalCases === 0 ? 'emerald' : statistics.criticalCases <= 2 ? 'amber' : 'red',
      tooltip: 'Ärenden med hög aktivitetsnivå (3/3) eller allvarlig situationsbedömning (4-5/5) över alla enheter. Noll är målet!'
    },
    {
      title: 'Servicekostnad per ärende',
      value: formatCurrency(animatedValues.avgCostPerCase || 0),
      subtitle: 'Genomsnitt utöver avtalet',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'emerald',
      tooltip: 'Genomsnittlig servicekostnad per ärende utöver grundavtalet. Visar kostnader för extra insatser och specialbehandlingar'
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

  if (loading) {
    return <StatisticsLoadingState />
  }

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <label className="text-slate-300">Tidsperiod:</label>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const colors = getColorClasses(card.color)
          
          return (
            <TooltipWrapper key={card.title} content={card.tooltip || ''} position="top">
              <div
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
            </TooltipWrapper>
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

        {/* Monthly Trends - Area Chart */}
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

        {/* Site Comparison - Bar Chart (if multiple sites) */}
        {statistics.siteStatistics.length > 1 && (
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-green-400" />
              Jämförelse mellan enheter
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Visar ärendefördelning och kritiska situationer per enhet - hjälper identifiera enheter som behöver extra uppmärksamhet
            </p>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9ca3af" 
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar 
                    dataKey="ärenden" 
                    fill="#3b82f6" 
                    name="Totalt ärenden"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="avslutade" 
                    fill="#10b981" 
                    name="Avslutade ärenden"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar 
                    dataKey="kritiska" 
                    fill="#ef4444" 
                    name="Kritiska situationer"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-sm text-slate-300">Totalt ärenden</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-slate-300">Avslutade ärenden</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm text-slate-300">Kritiska situationer</span>
              </div>
            </div>
          </div>
        )}

        {/* Pest Type Distribution - Bar Chart (New Addition) */}
        {Object.keys(statistics.pestTypeCounts).length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <Bug className="w-5 h-5 text-red-400" />
              Skadedjursfördelning
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Fördelning av olika skadedjurstyper - hjälper identifiera vanligaste problem
            </p>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pestTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#9ca3af" 
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#e2e8f0'
                    }}
                  />
                  <Bar 
                    dataKey="värde" 
                    fill="#ef4444" 
                    name="Antal ärenden"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Pest Trends Over Time - Line Chart (New Addition) */}
        {pestTrendsData.length > 0 && (
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <Bug className="w-5 h-5 text-green-400" />
              Skadedjurstrender Över Tid
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Visar utvecklingen av olika skadedjurstyper över tid - hjälper identifiera säsongsmönster och trender
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
        )}

        {/* Health Status Over Time - Line Chart (Replacing Technical Assessment) */}
        {healthStatusOverTimeData.length > 0 && (
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Hälsostatus Över Tid
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Utveckling av genomsnittlig aktivitetsnivå (0-3) och situationsbedömning (1-5) över tid
            </p>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthStatusOverTimeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="månad" stroke="#9ca3af" fontSize={12} />
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
                      if (name === 'antalÄrenden') {
                        return [`${value}`, 'Antal ärenden']
                      }
                      return [value, name]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="aktivitetsnivå"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    name="Aktivitetsnivå (0-3)"
                  />
                  <Line
                    type="monotone"
                    dataKey="situationsbedömning"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    name="Situationsbedömning (1-5)"
                  />
                </LineChart>
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
        )}
      </div>
    </div>
  )
}

export default MultisiteCustomerStatistics