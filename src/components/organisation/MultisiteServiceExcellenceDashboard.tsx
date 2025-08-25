// src/components/organisation/MultisiteServiceExcellenceDashboard.tsx - Premium KPI Cards for Multisite Organizations
import React, { useEffect, useState, useMemo } from 'react'
import { TrendingUp, Calendar, CreditCard, CheckCircle, Building, Users, AlertTriangle, Target, Bug } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus } from '../../types/database'
import { OrganizationSite } from '../../types/multisite'

interface MultisiteServiceExcellenceDashboardProps {
  sites: OrganizationSite[]
  selectedSiteIds: string[] // 'all' eller specifika site IDs  
  organizationName: string
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

interface KpiCard {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red'
}

const MultisiteServiceExcellenceDashboard: React.FC<MultisiteServiceExcellenceDashboardProps> = ({ 
  sites, 
  selectedSiteIds, 
  organizationName,
  userRoleType 
}) => {
  const [animatedValues, setAnimatedValues] = useState<{ [key: string]: number }>({})
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0)
  const [nextVisit, setNextVisit] = useState<string | null>(null)
  const [organizationMetrics, setOrganizationMetrics] = useState<any>({})
  const [hasAnimated, setHasAnimated] = useState(false)

  // Determine which sites to analyze
  const analyzedSites = selectedSiteIds.includes('all') 
    ? sites 
    : sites.filter(site => selectedSiteIds.includes(site.id))

  // Create stable site IDs for dependencies
  const analyzedSiteIds = useMemo(() => analyzedSites.map(s => s.id).sort().join(','), [analyzedSites])

  // Fetch organization-level data
  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (analyzedSites.length === 0) return

      try {
        // Get customer IDs from analyzed sites
        const customerIds = analyzedSites
          .map(site => site.customer_id)
          .filter(Boolean)
        
        
        if (customerIds.length === 0) {
          // No customer IDs found - set defaults to show no active cases
          setActiveCasesCount(0)
          setNextVisit(null)
          setOrganizationMetrics({
            totalRevenue: 0,
            completionRate: 0,
            qualityScore: 0,
            criticalCases: 0,
            totalCases: 0,
            completedCases: 0,
            topPestType: 'Ingen data',
            topPestCount: 0
          })
          return
        }

        // Fetch cases data for all analyzed sites
        const { data, error } = await supabase
          .from('cases')
          .select('status, scheduled_start, scheduled_end, price, pest_level, problem_rating, created_at, customer_id, pest_type')
          .in('customer_id', customerIds)
        
        if (error) throw error
        
        // Count active cases across all sites
        const activeCount = data?.filter(caseItem => !isCompletedStatus(caseItem.status)).length || 0
        setActiveCasesCount(activeCount)

        // Find next scheduled visit across all sites
        const upcomingVisits = data
          ?.filter(caseItem => caseItem.scheduled_start)
          ?.map(caseItem => ({ 
            start: new Date(caseItem.scheduled_start!), 
            end: caseItem.scheduled_end ? new Date(caseItem.scheduled_end) : null,
            customer_id: caseItem.customer_id
          }))
          ?.filter(visit => visit.start > new Date())
          ?.sort((a, b) => a.start.getTime() - b.start.getTime())

        if (upcomingVisits && upcomingVisits.length > 0) {
          const nextVisitData = upcomingVisits[0]
          const site = analyzedSites.find(s => s.customer_id === nextVisitData.customer_id)
          setNextVisit(JSON.stringify({ 
            start: nextVisitData.start.toISOString(), 
            end: nextVisitData.end?.toISOString() || null,
            siteName: site?.site_name || 'Okänd enhet'
          }))
        } else {
          setNextVisit(null)
        }

        // Calculate organization metrics
        const totalRevenue = data?.filter(c => c.price && c.price > 0)
          .reduce((sum, c) => sum + (c.price || 0), 0) || 0
        
        const completedCases = data?.filter(c => isCompletedStatus(c.status)).length || 0
        const totalCases = data?.length || 0
        const completionRate = totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
        
        const criticalCases = data?.filter(c => 
          c.pest_level === 3 || (c.problem_rating && c.problem_rating >= 4)
        ).length || 0

        // Calculate top pest type
        const pestTypeCounts = data?.reduce((acc, c) => {
          const pestType = c.pest_type || 'Okänt'
          acc[pestType] = (acc[pestType] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        // Filter out "Okänt" and get the top actual pest type
        const knownPests = Object.entries(pestTypeCounts)
          .filter(([pestType]) => pestType !== 'Okänt')
          .sort(([,a], [,b]) => b - a)

        let topPestType: string
        let topPestCount: number

        if (knownPests.length > 0) {
          // Use the most common known pest
          topPestType = knownPests[0][0]
          topPestCount = knownPests[0][1]
        } else {
          // If only "Okänt" exists, check if we have any data at all
          const unknownCount = pestTypeCounts['Okänt'] || 0
          if (unknownCount > 0) {
            topPestType = 'Ej specificerat'
            topPestCount = unknownCount
          } else {
            topPestType = 'Ingen data'
            topPestCount = 0
          }
        }

        // Calculate average service quality score (based on completion rate and low critical cases)
        const qualityScore = Math.max(0, Math.min(100, 
          Math.round(completionRate * 0.7 + (100 - Math.min(criticalCases * 10, 100)) * 0.3)
        ))

        setOrganizationMetrics({
          totalRevenue,
          completionRate,
          qualityScore,
          criticalCases,
          totalCases,
          completedCases,
          topPestType,
          topPestCount
        })

      } catch (error) {
        console.error('Error fetching organization data:', error)
      }
    }

    fetchOrganizationData()
  }, [analyzedSiteIds])

  // Animate numbers on mount (only once or when data significantly changes)
  useEffect(() => {
    if (hasAnimated && organizationMetrics.totalRevenue !== undefined) {
      // If already animated and data exists, set values directly without animation
      setAnimatedValues({
        revenue: organizationMetrics.totalRevenue || 0,
        quality: organizationMetrics.qualityScore || 0,
        cases: activeCasesCount,
        sites: analyzedSites.length,
        completion: organizationMetrics.completionRate || 0
      })
      return
    }

    const totalRevenue = organizationMetrics.totalRevenue || 0
    const qualityScore = organizationMetrics.qualityScore || 0
    
    if (totalRevenue === 0 && qualityScore === 0 && activeCasesCount === 0) {
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
        revenue: Math.floor(totalRevenue * easeOutQuart),
        quality: Math.floor(qualityScore * easeOutQuart),
        cases: Math.floor(activeCasesCount * easeOutQuart),
        sites: Math.floor(analyzedSites.length * easeOutQuart),
        completion: Math.floor((organizationMetrics.completionRate || 0) * easeOutQuart)
      })

      if (currentStep >= steps) {
        clearInterval(interval)
        setHasAnimated(true)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [organizationMetrics, activeCasesCount, analyzedSites.length, hasAnimated])

  // Reset animation when analyzed sites change (using stable comparison)
  useEffect(() => {
    setHasAnimated(false)
  }, [analyzedSiteIds])

  const formatNextVisitDate = (dateString: string | null) => {
    if (!dateString) return { value: 'Ej bokat', subtitle: 'Ingen tid schemalagd' }
    
    try {
      const visitData = JSON.parse(dateString)
      const startDate = new Date(visitData.start)
      const endDate = visitData.end ? new Date(visitData.end) : null
      const now = new Date()
      const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      const startTime = startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      const endTime = endDate ? endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : null
      const timeRange = endTime ? `${startTime}-${endTime}` : startTime
      
      if (diffDays === 0) {
        return { value: 'Idag', subtitle: `${timeRange} @ ${visitData.siteName}` }
      } else if (diffDays === 1) {
        return { value: 'Imorgon', subtitle: `${timeRange} @ ${visitData.siteName}` }
      } else if (diffDays < 7) {
        const dateStr = startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
        return { 
          value: `${dateStr}`, 
          subtitle: `${timeRange} @ ${visitData.siteName}`
        }
      } else {
        const dateStr = startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
        return { 
          value: dateStr, 
          subtitle: `${timeRange} @ ${visitData.siteName}`
        }
      }
    } catch (error) {
      return { value: 'Ej schemalagt', subtitle: 'Kontakta för bokning' }
    }
  }

  const nextVisitDisplay = formatNextVisitDate(nextVisit)

  const getRoleBasedTitle = () => {
    switch (userRoleType) {
      case 'verksamhetschef': return 'Verksamhetsöversikt'
      case 'regionchef': return 'Regionöversikt'
      case 'platsansvarig': return 'Enhetsöversikt'
      default: return 'Översikt'
    }
  }

  const getRoleBasedSubtitle = () => {
    const sitesText = analyzedSites.length === 1 ? '1 enhet' : `${analyzedSites.length} enheter`
    switch (userRoleType) {
      case 'verksamhetschef': return `Prestanda över alla ${sitesText} i organisationen`
      case 'regionchef': return `Prestanda över ${sitesText} i din region`
      case 'platsansvarig': return `Prestanda för din enhet`
      default: return `Prestanda över ${sitesText}`
    }
  }

  const kpiCards: KpiCard[] = [
    {
      title: 'Service Quality Score',
      value: `${animatedValues.quality || 0}%`,
      subtitle: organizationMetrics.qualityScore >= 90 ? 'Utmärkt' : 
                organizationMetrics.qualityScore >= 80 ? 'Mycket bra' : 
                organizationMetrics.qualityScore >= 70 ? 'Bra' : 'Förbättring krävs',
      icon: <TrendingUp className="w-5 h-5" />,
      trend: organizationMetrics.qualityScore >= 85 ? 'up' : 
             organizationMetrics.qualityScore >= 70 ? 'stable' : 'down',
      trendValue: organizationMetrics.qualityScore >= 85 ? 'Utmärkt' : 
                  organizationMetrics.qualityScore >= 70 ? 'Bra' : 'Kan förbättras',
      color: organizationMetrics.qualityScore >= 85 ? 'emerald' : 
             organizationMetrics.qualityScore >= 70 ? 'blue' : 'amber'
    },
    {
      title: 'Servicekostnader',
      value: formatCurrency(animatedValues.revenue || 0),
      subtitle: 'Kostnader utöver avtalet',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'emerald'
    },
    {
      title: userRoleType === 'platsansvarig' && sites.length === 1 ? 'Min enhet' : 'Aktiva enheter',
      value: userRoleType === 'platsansvarig' && sites.length === 1 ? 'Aktiv' : (animatedValues.sites || 0),
      subtitle: userRoleType === 'platsansvarig' && sites.length === 1 
        ? `${sites[0]?.site_name || 'Enhet'}` 
        : `av ${sites.length} totala enheter`,
      icon: <Building className="w-5 h-5" />,
      color: 'blue'
    },
    {
      title: 'Avslutningsgrad',
      value: `${animatedValues.completion || 0}%`,
      subtitle: `${organizationMetrics.completedCases || 0} av ${organizationMetrics.totalCases || 0} avslutade`,
      icon: <CheckCircle className="w-5 h-5" />,
      trend: (organizationMetrics.completionRate || 0) >= 80 ? 'up' : 'stable',
      color: (organizationMetrics.completionRate || 0) >= 80 ? 'emerald' : 'blue'
    },
    {
      title: 'Aktiva ärenden',
      value: animatedValues.cases || 0,
      subtitle: (animatedValues.cases || 0) === 0 ? 'Inga pågående ärenden' : 
                (animatedValues.cases || 0) === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <Target className="w-5 h-5" />,
      trend: activeCasesCount <= 5 ? 'up' : activeCasesCount <= 15 ? 'stable' : 'down',
      color: 'purple'
    },
    {
      title: 'Nästa besök',
      value: nextVisitDisplay.value,
      subtitle: nextVisitDisplay.subtitle,
      icon: <Calendar className="w-5 h-5" />,
      color: 'amber'
    },
    {
      title: 'Vanligaste skadedjur',
      value: organizationMetrics.topPestType || 'Ingen data',
      subtitle: organizationMetrics.topPestCount > 0 ? `${organizationMetrics.topPestCount} ärenden` : 'Inga registrerade skadedjur',
      icon: <Bug className="w-5 h-5" />,
      color: 'red'
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-900/30 via-blue-900/20 to-emerald-900/30 rounded-2xl p-6 border border-purple-700/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {getRoleBasedTitle()}
            </h2>
            <p className="text-purple-200">
              {getRoleBasedSubtitle()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {organizationName}
              </div>
              <div className="text-sm text-purple-300">
                {userRoleType.charAt(0).toUpperCase() + userRoleType.slice(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
        {kpiCards.map((card, index) => {
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
              {/* Background gradient effect */}
              <div className={`absolute inset-0 ${colors.bg} rounded-xl opacity-50 group-hover:opacity-70 transition-opacity`}></div>
              
              {/* Content */}
              <div className="relative">
                {/* Icon and Trend */}
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
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                      {card.trend === 'down' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                      )}
                      {card.trendValue && <span>{card.trendValue}</span>}
                    </div>
                  )}
                </div>
                
                {/* Title */}
                <p className="text-slate-400 text-sm font-medium mb-2">{card.title}</p>
                
                {/* Value */}
                <p className="text-2xl font-bold text-white mb-1 font-mono">
                  {card.value}
                </p>
                
                {/* Subtitle */}
                {card.subtitle && (
                  <p className="text-xs text-slate-500">{card.subtitle}</p>
                )}
              </div>

              {/* Hover effect line */}
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${colors.bg} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
            </div>
          )
        })}
      </div>

      {/* Quick Stats Summary */}
      <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-400">
            Sammanfattning: 
            <span className="text-white ml-2">
              {organizationMetrics.totalCases || 0} totala ärenden
            </span>
            {organizationMetrics.criticalCases > 0 && (
              <>
                <span className="mx-2">•</span>
                <span className="text-red-400">
                  {organizationMetrics.criticalCases} kritiska situationer
                </span>
              </>
            )}
          </div>
          <div className="text-slate-500 text-xs">
            Uppdaterad: {new Date().toLocaleString('sv-SE')}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MultisiteServiceExcellenceDashboard