// src/components/organisation/TrafficLightAlertPanel.tsx - Alert panel för kritiska trafikljusbedömningar
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Clock, TrendingDown, ChevronRight, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import TrafficLightBadge from './TrafficLightBadge'

interface AlertItem {
  siteId: string
  siteName: string
  region?: string
  alertType: 'critical' | 'worsening' | 'unacknowledged'
  caseCount: number
  worstPestLevel: number | null
  worstProblemRating: number | null
  lastAssessment: string | null
  unacknowledgedCount: number
  details: string
}

interface TrafficLightAlertPanelProps {
  siteIds: string[]
  userRole?: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  onAlertClick?: (siteId: string) => void
}

const TrafficLightAlertPanel: React.FC<TrafficLightAlertPanelProps> = ({
  siteIds,
  userRole = 'verksamhetschef',
  onAlertClick
}) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlerts()

    // Set up real-time subscription
    const subscription = supabase
      .channel('traffic-light-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases'
        },
        () => {
          fetchAlerts()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [siteIds])

  const fetchAlerts = async () => {
    try {
      setLoading(true)

      if (siteIds.length === 0) {
        setAlerts([])
        return
      }

      // Hämta cases med trafikljusdata
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select(`
          customer_id,
          pest_level,
          problem_rating,
          recommendations,
          recommendations_acknowledged,
          assessment_date,
          status,
          created_at
        `)
        .in('customer_id', siteIds)
        .not('pest_level', 'is', null)
        .not('problem_rating', 'is', null)

      if (casesError) throw casesError

      // Hämta customer info
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, company_name, region')
        .in('id', siteIds)

      if (customersError) throw customersError

      // Analysera data per site för alerts
      const alertItems: AlertItem[] = []

      customers.forEach(customer => {
        const siteCases = cases.filter(c => c.customer_id === customer.id)
        
        if (siteCases.length === 0) return

        // Räkna kritiska cases
        const criticalCases = siteCases.filter(c => 
          (c.pest_level !== null && c.pest_level >= 3) || 
          (c.problem_rating !== null && c.problem_rating >= 4)
        )

        // Räkna obekräftade rekommendationer
        const unacknowledgedCases = siteCases.filter(c => 
          c.recommendations && !c.recommendations_acknowledged
        )

        // Hitta värsta nivåer
        let worstPestLevel: number | null = null
        let worstProblemRating: number | null = null
        let lastAssessment: string | null = null

        siteCases.forEach(c => {
          if (c.pest_level !== null && (worstPestLevel === null || c.pest_level > worstPestLevel)) {
            worstPestLevel = c.pest_level
          }
          if (c.problem_rating !== null && (worstProblemRating === null || c.problem_rating > worstProblemRating)) {
            worstProblemRating = c.problem_rating
          }
          if (c.assessment_date && (!lastAssessment || new Date(c.assessment_date) > new Date(lastAssessment))) {
            lastAssessment = c.assessment_date
          }
        })

        // Skapa alerts baserat på kritikalitet
        if (criticalCases.length > 0) {
          alertItems.push({
            siteId: customer.id,
            siteName: customer.company_name,
            region: customer.region,
            alertType: 'critical',
            caseCount: criticalCases.length,
            worstPestLevel,
            worstProblemRating,
            lastAssessment,
            unacknowledgedCount: unacknowledgedCases.length,
            details: `${criticalCases.length} kritisk${criticalCases.length !== 1 ? 'a' : 't'} ärende${criticalCases.length !== 1 ? 'n' : ''} kräver omedelbar åtgärd`
          })
        } else if (unacknowledgedCases.length > 0) {
          alertItems.push({
            siteId: customer.id,
            siteName: customer.company_name,
            region: customer.region,
            alertType: 'unacknowledged',
            caseCount: unacknowledgedCases.length,
            worstPestLevel,
            worstProblemRating,
            lastAssessment,
            unacknowledgedCount: unacknowledgedCases.length,
            details: `${unacknowledgedCases.length} rekommendation${unacknowledgedCases.length !== 1 ? 'er' : ''} inväntar bekräftelse`
          })
        }
      })

      // Sortera alerts efter prioritet
      alertItems.sort((a, b) => {
        const priority = { critical: 3, worsening: 2, unacknowledged: 1 }
        const priorityA = priority[a.alertType]
        const priorityB = priority[b.alertType]
        
        if (priorityA !== priorityB) return priorityB - priorityA
        return b.caseCount - a.caseCount
      })

      setAlerts(alertItems)
    } catch (error) {
      console.error('Error fetching alerts:', error)
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  const getAlertStyle = (alertType: AlertItem['alertType']) => {
    switch (alertType) {
      case 'critical':
        return {
          container: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
          icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
          iconBg: 'bg-red-500/20',
          text: 'text-red-400'
        }
      case 'worsening':
        return {
          container: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15',
          icon: <TrendingDown className="w-5 h-5 text-orange-400" />,
          iconBg: 'bg-orange-500/20',
          text: 'text-orange-400'
        }
      case 'unacknowledged':
        return {
          container: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15',
          icon: <Clock className="w-5 h-5 text-amber-400" />,
          iconBg: 'bg-amber-500/20',
          text: 'text-amber-400'
        }
    }
  }

  const formatLastAssessment = (dateString: string | null) => {
    if (!dateString) return 'Ej bedömt'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Igår'
    if (diffDays < 7) return `${diffDays} dagar sedan`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} veckor sedan`
    return date.toLocaleDateString('sv-SE')
  }

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-red-900/20 to-amber-900/20 border-red-700/50 p-4">
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner text="Kontrollerar akuta situationer..." size="small" />
        </div>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border-green-700/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Eye className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-green-400">Allt ser bra ut</h3>
            <p className="text-sm text-green-300/80">
              Inga kritiska situationer eller obekräftade rekommendationer just nu
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-r from-red-900/20 to-amber-900/20 border-red-700/50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Kräver uppmärksamhet</h3>
            <p className="text-sm text-slate-400">
              {alerts.length} enhet{alerts.length !== 1 ? 'er' : ''} behöver granskas
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map(alert => {
            const style = getAlertStyle(alert.alertType)
            
            return (
              <div
                key={alert.siteId}
                onClick={() => onAlertClick?.(alert.siteId)}
                className={`
                  p-4 rounded-lg border transition-all duration-200 cursor-pointer
                  ${style.container}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 ${style.iconBg} rounded-lg flex items-center justify-center`}>
                      {style.icon}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{alert.siteName}</h4>
                        {alert.region && (
                          <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">
                            {alert.region}
                          </span>
                        )}
                        <TrafficLightBadge
                          pestLevel={alert.worstPestLevel}
                          problemRating={alert.worstProblemRating}
                          size="small"
                          showTooltip={false}
                        />
                      </div>
                      <p className={`text-sm ${style.text} mb-1`}>
                        {alert.details}
                      </p>
                      <p className="text-xs text-slate-500">
                        Senaste bedömning: {formatLastAssessment(alert.lastAssessment)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.unacknowledgedCount > 0 && (
                      <div className="bg-amber-500/20 border border-amber-500/50 rounded px-2 py-1 text-xs text-amber-400">
                        {alert.unacknowledgedCount} obekräftad{alert.unacknowledgedCount !== 1 ? 'e' : ''}
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default TrafficLightAlertPanel