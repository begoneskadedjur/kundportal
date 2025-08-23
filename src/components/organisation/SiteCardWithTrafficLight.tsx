// src/components/organisation/SiteCardWithTrafficLight.tsx - Site kort med mini-trafikljus status
import React, { useState, useEffect } from 'react'
import { MapPin, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import TrafficLightBadge from './TrafficLightBadge'
import { OrganizationSite } from '../../types/multisite'

interface SiteCardWithTrafficLightProps {
  site: OrganizationSite
  onClick?: () => void
}

interface SiteTrafficLightData {
  worstPestLevel: number | null
  worstProblemRating: number | null
  criticalCases: number
  warningCases: number
  okCases: number
  unacknowledgedCount: number
  lastAssessment: string | null
}

const SiteCardWithTrafficLight: React.FC<SiteCardWithTrafficLightProps> = ({ 
  site, 
  onClick 
}) => {
  const [trafficLightData, setTrafficLightData] = useState<SiteTrafficLightData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrafficLightData()

    // Set up real-time subscription
    const subscription = supabase
      .channel(`site-traffic-light-${site.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `customer_id=eq.${site.id}`
        },
        () => {
          fetchTrafficLightData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [site.id])

  const fetchTrafficLightData = async () => {
    try {
      setLoading(true)

      // Hämta cases med trafikljusdata för denna site
      const { data: cases, error } = await supabase
        .from('cases')
        .select(`
          pest_level,
          problem_rating,
          recommendations,
          recommendations_acknowledged,
          assessment_date
        `)
        .eq('customer_id', site.id)
        .not('pest_level', 'is', null)
        .not('problem_rating', 'is', null)

      if (error) throw error

      if (!cases || cases.length === 0) {
        setTrafficLightData(null)
        return
      }

      // Analysera data
      let worstPestLevel: number | null = null
      let worstProblemRating: number | null = null
      let criticalCases = 0
      let warningCases = 0
      let okCases = 0
      let unacknowledgedCount = 0
      let lastAssessment: string | null = null

      cases.forEach(caseItem => {
        // Hitta värsta nivåer
        if (caseItem.pest_level !== null) {
          if (worstPestLevel === null || caseItem.pest_level > worstPestLevel) {
            worstPestLevel = caseItem.pest_level
          }
        }
        
        if (caseItem.problem_rating !== null) {
          if (worstProblemRating === null || caseItem.problem_rating > worstProblemRating) {
            worstProblemRating = caseItem.problem_rating
          }
        }

        // Räkna status-kategorier
        const pest = caseItem.pest_level ?? -1
        const problem = caseItem.problem_rating ?? -1
        
        if (pest >= 3 || problem >= 4) {
          criticalCases++
        } else if (pest === 2 || problem === 3) {
          warningCases++
        } else if (pest >= 0 || problem >= 0) {
          okCases++
        }

        // Räkna obekräftade rekommendationer
        if (caseItem.recommendations && !caseItem.recommendations_acknowledged) {
          unacknowledgedCount++
        }

        // Uppdatera senaste bedömning
        if (caseItem.assessment_date) {
          if (!lastAssessment || new Date(caseItem.assessment_date) > new Date(lastAssessment)) {
            lastAssessment = caseItem.assessment_date
          }
        }
      })

      setTrafficLightData({
        worstPestLevel,
        worstProblemRating,
        criticalCases,
        warningCases,
        okCases,
        unacknowledgedCount,
        lastAssessment
      })
    } catch (error) {
      console.error('Error fetching traffic light data for site:', error)
      setTrafficLightData(null)
    } finally {
      setLoading(false)
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
    return date.toLocaleDateString('sv-SE')
  }

  return (
    <div 
      className={`
        bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 transition-all duration-200
        ${onClick ? 'cursor-pointer hover:bg-slate-700/40 hover:border-slate-500/50' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-white">{site.site_name}</h4>
            {trafficLightData && !loading && (
              <TrafficLightBadge
                pestLevel={trafficLightData.worstPestLevel}
                problemRating={trafficLightData.worstProblemRating}
                size="small"
                showTooltip={true}
              />
            )}
          </div>
          
          {site.region && (
            <p className="text-sm text-purple-400 mb-1">Region: {site.region}</p>
          )}
          
          {site.address && (
            <p className="text-xs text-slate-500 mb-2">{site.address}</p>
          )}
        </div>
        
        <div className={`px-2 py-1 rounded text-xs ${
          site.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
        }`}>
          {site.is_active ? 'Aktiv' : 'Inaktiv'}
        </div>
      </div>

      {/* Trafikljus sammanfattning */}
      {trafficLightData && !loading && (
        <div className="mb-3 p-2 bg-slate-800/30 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Ärendebedömningar:</span>
            <div className="flex items-center gap-2">
              {trafficLightData.criticalCases > 0 && (
                <span className="text-red-400">🔴 {trafficLightData.criticalCases}</span>
              )}
              {trafficLightData.warningCases > 0 && (
                <span className="text-yellow-400">🟡 {trafficLightData.warningCases}</span>
              )}
              {trafficLightData.okCases > 0 && (
                <span className="text-green-400">🟢 {trafficLightData.okCases}</span>
              )}
              {trafficLightData.criticalCases === 0 && trafficLightData.warningCases === 0 && trafficLightData.okCases === 0 && (
                <span className="text-slate-500">Ej bedömt</span>
              )}
            </div>
          </div>
          
          {trafficLightData.lastAssessment && (
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500">Senaste bedömning:</span>
              <span className="text-slate-400">{formatLastAssessment(trafficLightData.lastAssessment)}</span>
            </div>
          )}
          
          {trafficLightData.unacknowledgedCount > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-amber-400">
              <Clock className="w-3 h-3" />
              <span>{trafficLightData.unacknowledgedCount} obekräftad{trafficLightData.unacknowledgedCount !== 1 ? 'e' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Kontaktinfo */}
      {site.contact_person && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-400">Kontakt: {site.contact_person}</p>
        </div>
      )}
    </div>
  )
}

export default SiteCardWithTrafficLight