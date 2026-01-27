// src/components/customer/ServiceExcellenceDashboard.tsx - Premium KPI Cards
import React, { useEffect, useState } from 'react'
import { Calendar, CheckCircle, ClipboardCheck, Briefcase } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isCompletedStatus } from '../../types/database'

interface ServiceExcellenceDashboardProps {
  customer: {
    id: string
    annual_value: number | null
    contract_type: string | null
    contract_start_date: string | null
  }
}

interface KpiCard {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color: 'emerald' | 'blue' | 'purple' | 'amber'
}

const ServiceExcellenceDashboard: React.FC<ServiceExcellenceDashboardProps> = ({ customer }) => {
  const [animatedValues, setAnimatedValues] = useState<{ [key: string]: number }>({})
  const [activeCasesCount, setActiveCasesCount] = useState<number>(0)
  const [completedInspectionsCount, setCompletedInspectionsCount] = useState<number>(0)
  const [nextInspection, setNextInspection] = useState<string | null>(null)
  const [nextVisit, setNextVisit] = useState<string | null>(null)

  // Fetch active cases count, completed inspections and next scheduled visits
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch cases
        const { data: casesData, error: casesError } = await supabase
          .from('cases')
          .select('status, scheduled_start, scheduled_end, service_type')
          .eq('customer_id', customer.id)

        if (casesError) throw casesError

        // Count active cases - EXCLUDE inspection type (INS-ärenden)
        const activeCount = casesData?.filter(caseItem =>
          !isCompletedStatus(caseItem.status) &&
          caseItem.service_type !== 'inspection'
        ).length || 0
        setActiveCasesCount(activeCount)

        // Find next scheduled inspection (service_type = 'inspection')
        const upcomingInspections = casesData
          ?.filter(caseItem => caseItem.scheduled_start && caseItem.service_type === 'inspection')
          ?.map(caseItem => ({
            start: new Date(caseItem.scheduled_start!),
            end: caseItem.scheduled_end ? new Date(caseItem.scheduled_end) : null
          }))
          ?.filter(visit => visit.start > new Date())
          ?.sort((a, b) => a.start.getTime() - b.start.getTime())

        if (upcomingInspections && upcomingInspections.length > 0) {
          const nextInspData = upcomingInspections[0]
          setNextInspection(JSON.stringify({
            start: nextInspData.start.toISOString(),
            end: nextInspData.end?.toISOString() || null
          }))
        } else {
          setNextInspection(null)
        }

        // Find next scheduled visit (non-inspection)
        const upcomingVisits = casesData
          ?.filter(caseItem => caseItem.scheduled_start && caseItem.service_type !== 'inspection')
          ?.map(caseItem => ({
            start: new Date(caseItem.scheduled_start!),
            end: caseItem.scheduled_end ? new Date(caseItem.scheduled_end) : null
          }))
          ?.filter(visit => visit.start > new Date())
          ?.sort((a, b) => a.start.getTime() - b.start.getTime())

        if (upcomingVisits && upcomingVisits.length > 0) {
          const nextVisitData = upcomingVisits[0]
          setNextVisit(JSON.stringify({
            start: nextVisitData.start.toISOString(),
            end: nextVisitData.end?.toISOString() || null
          }))
        } else {
          setNextVisit(null)
        }

        // Fetch completed inspections count from station_inspection_sessions
        const inspectionCaseIds = casesData?.filter(c => c.service_type === 'inspection').map(c => c.id) || []
        const { count: inspCount, error: inspError } = inspectionCaseIds.length > 0
          ? await supabase
              .from('station_inspection_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'completed')
              .in('case_id', inspectionCaseIds)
          : { count: 0, error: null }

        // Alternative: count via cases table
        const { data: inspSessions, error: sessError } = await supabase
          .from('station_inspection_sessions')
          .select(`
            id,
            status,
            case:cases!inner(customer_id)
          `)
          .eq('status', 'completed')
          .eq('cases.customer_id', customer.id)

        if (!sessError && inspSessions) {
          setCompletedInspectionsCount(inspSessions.length)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setActiveCasesCount(0)
        setCompletedInspectionsCount(0)
        setNextInspection(null)
        setNextVisit(null)
      }
    }

    fetchData()
  }, [customer.id])

  // Animate numbers on mount
  useEffect(() => {
    const duration = 1500 // 1.5 seconds
    const steps = 60
    const stepDuration = duration / steps
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      setAnimatedValues({
        inspections: Math.floor(completedInspectionsCount * easeOutQuart),
        cases: Math.floor(activeCasesCount * easeOutQuart)
      })

      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [activeCasesCount, completedInspectionsCount])

  const formatNextVisitDate = (dateString: string | null) => {
    if (!dateString) return { value: 'Ej schemalagt', subtitle: 'Kontakta för bokning' }
    
    try {
      const visitData = JSON.parse(dateString)
      const startDate = new Date(visitData.start)
      const endDate = visitData.end ? new Date(visitData.end) : null
      const now = new Date()
      const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // Format time range
      const startTime = startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      const endTime = endDate ? endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : null
      const timeRange = endTime ? `${startTime}-${endTime}` : startTime
      
      if (diffDays === 0) {
        return { value: 'Idag', subtitle: timeRange }
      } else if (diffDays === 1) {
        return { value: 'Imorgon', subtitle: timeRange }
      } else if (diffDays < 7) {
        const dateStr = startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
        return { 
          value: `${dateStr}`, 
          subtitle: timeRange
        }
      } else {
        const dateStr = startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
        return { 
          value: dateStr, 
          subtitle: timeRange
        }
      }
    } catch (error) {
      // Fallback for invalid JSON
      return { value: 'Ej schemalagt', subtitle: 'Kontakta för bokning' }
    }
  }

  const nextInspectionDisplay = formatNextVisitDate(nextInspection)
  const nextVisitDisplay = formatNextVisitDate(nextVisit)

  const kpiCards: KpiCard[] = [
    {
      title: 'Genomförda kontroller',
      value: animatedValues.inspections || completedInspectionsCount,
      subtitle: completedInspectionsCount === 1 ? 'Stationskontroll' : 'Stationskontroller',
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'emerald'
    },
    {
      title: 'Nästa kontroll',
      value: nextInspectionDisplay.value,
      subtitle: nextInspectionDisplay.subtitle,
      icon: <ClipboardCheck className="w-5 h-5" />,
      color: 'blue'
    },
    {
      title: 'Aktiva ärenden',
      value: activeCasesCount,
      subtitle: activeCasesCount === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <Briefcase className="w-5 h-5" />,
      trend: activeCasesCount > 0 ? 'stable' : undefined,
      color: 'purple'
    },
    {
      title: 'Nästa besök',
      value: nextVisitDisplay.value,
      subtitle: nextVisitDisplay.subtitle,
      icon: <Calendar className="w-5 h-5" />,
      color: 'amber'
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
      }
    }
    return colors[color as keyof typeof colors] || colors.emerald
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
  )
}

export default ServiceExcellenceDashboard