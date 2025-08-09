// src/components/customer/ServiceExcellenceDashboard.tsx - Premium KPI Cards
import React, { useEffect, useState } from 'react'
import { TrendingUp, Calendar, CreditCard, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
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

  // Fetch active cases count
  useEffect(() => {
    const fetchActiveCases = async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('status')
          .eq('customer_id', customer.id)
        
        if (error) throw error
        
        // Count cases that are not completed
        const activeCount = data?.filter(caseItem => !isCompletedStatus(caseItem.status)).length || 0
        setActiveCasesCount(activeCount)
      } catch (error) {
        console.error('Error fetching active cases:', error)
        setActiveCasesCount(0)
      }
    }

    fetchActiveCases()
  }, [customer.id])

  // Animate numbers on mount
  useEffect(() => {
    const annualValue = customer.annual_value || 0
    const duration = 1500 // 1.5 seconds
    const steps = 60
    const stepDuration = duration / steps
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep++
      const progress = currentStep / steps
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      
      setAnimatedValues({
        annual: Math.floor(annualValue * easeOutQuart),
        quality: Math.floor(92 * easeOutQuart),
        cases: Math.floor(activeCasesCount * easeOutQuart),
        visits: Math.floor(12 * easeOutQuart) // Placeholder
      })

      if (currentStep >= steps) {
        clearInterval(interval)
      }
    }, stepDuration)

    return () => clearInterval(interval)
  }, [customer.annual_value, activeCasesCount])

  const kpiCards: KpiCard[] = [
    {
      title: 'Service Quality Score',
      value: `${animatedValues.quality || 0}%`,
      subtitle: 'Excellent performance',
      icon: <TrendingUp className="w-5 h-5" />,
      trend: 'up',
      trendValue: '+2%',
      color: 'emerald'
    },
    {
      title: 'Årspremie',
      value: formatCurrency(animatedValues.annual || 0),
      subtitle: customer.contract_type || 'Premium avtal',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'blue'
    },
    {
      title: 'Aktiva ärenden',
      value: activeCasesCount,
      subtitle: activeCasesCount === 1 ? 'Aktivt ärende' : 'Aktiva ärenden',
      icon: <CheckCircle className="w-5 h-5" />,
      trend: activeCasesCount > 0 ? 'stable' : undefined,
      color: 'purple'
    },
    {
      title: 'Nästa besök',
      value: 'Ej schemalagt',
      subtitle: 'Kontakta för bokning',
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