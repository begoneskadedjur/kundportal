// src/components/organisation/TrafficLightAggregatedView.tsx
import React, { useState, useEffect } from 'react'
import { Building2, AlertTriangle, Check, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import TrafficLightBadge from './TrafficLightBadge'

interface SiteData {
  siteId: string
  siteName: string
  region?: string
  totalCases: number
  criticalCases: number
  warningCases: number
  okCases: number
  unacknowledgedRecommendations: number
  worstPestLevel: number | null
  worstProblemRating: number | null
  lastAssessment: string | null
}

interface TrafficLightAggregatedViewProps {
  organizationId?: string
  siteIds?: string[]
  userRole?: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const TrafficLightAggregatedView: React.FC<TrafficLightAggregatedViewProps> = ({
  organizationId,
  siteIds,
  userRole = 'verksamhetschef'
}) => {
  const [sitesData, setSitesData] = useState<SiteData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAggregatedData()

    // Set up real-time subscription
    const subscription = supabase
      .channel('aggregated-traffic-lights')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases'
        },
        () => {
          fetchAggregatedData()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [organizationId, siteIds])

  const fetchAggregatedData = async () => {
    try {
      setLoading(true)

      // Bestäm vilka customer IDs vi ska hämta data för
      let customerIds: string[] = []
      
      if (siteIds && siteIds.length > 0) {
        customerIds = siteIds
      } else if (organizationId) {
        // Hämta alla sites för organisationen
        const { data: sites, error: sitesError } = await supabase
          .from('customers')
          .select('id, company_name, address')
          .eq('organization_id', organizationId)
          .eq('is_multisite', true)

        if (sitesError) throw sitesError
        
        if (sites) {
          customerIds = sites.map(s => s.id)
        }
      }

      if (customerIds.length === 0) {
        setSitesData([])
        setLoading(false)
        return
      }

      // Hämta cases och aggregera per site
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select(`
          customer_id,
          pest_level,
          problem_rating,
          recommendations,
          recommendations_acknowledged,
          assessment_date,
          status
        `)
        .in('customer_id', customerIds)

      if (casesError) throw casesError

      // Hämta customer info
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, company_name, address, region')
        .in('id', customerIds)

      if (customersError) throw customersError

      // Aggregera data per site
      const aggregatedData: SiteData[] = customers.map(customer => {
        const siteCases = cases.filter(c => c.customer_id === customer.id)
        
        // Räkna cases per status
        let criticalCases = 0
        let warningCases = 0
        let okCases = 0
        let unacknowledgedRecommendations = 0
        let worstPestLevel: number | null = null
        let worstProblemRating: number | null = null
        let lastAssessment: string | null = null

        siteCases.forEach(caseItem => {
          // Beräkna trafikljusstatus
          const pest = caseItem.pest_level ?? -1
          const problem = caseItem.problem_rating ?? -1
          
          if (pest >= 3 || problem >= 4) {
            criticalCases++
          } else if (pest === 2 || problem === 3) {
            warningCases++
          } else if (pest >= 0 || problem >= 0) {
            okCases++
          }

          // Uppdatera värsta nivåer
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

          // Räkna obekräftade rekommendationer
          if (caseItem.recommendations && !caseItem.recommendations_acknowledged) {
            unacknowledgedRecommendations++
          }

          // Uppdatera senaste bedömning
          if (caseItem.assessment_date) {
            if (!lastAssessment || new Date(caseItem.assessment_date) > new Date(lastAssessment)) {
              lastAssessment = caseItem.assessment_date
            }
          }
        })

        return {
          siteId: customer.id,
          siteName: customer.company_name,
          region: customer.region,
          totalCases: siteCases.length,
          criticalCases,
          warningCases,
          okCases,
          unacknowledgedRecommendations,
          worstPestLevel,
          worstProblemRating,
          lastAssessment
        }
      })

      // Förbättrad sortering efter kritikalitet och urgency
      aggregatedData.sort((a, b) => {
        // Prioritera enheter med kritiska cases
        if (a.criticalCases !== b.criticalCases) return b.criticalCases - a.criticalCases
        
        // Sedan enheter med obekräftade rekommendationer
        if (a.unacknowledgedRecommendations !== b.unacknowledgedRecommendations) {
          return b.unacknowledgedRecommendations - a.unacknowledgedRecommendations
        }
        
        // Sedan varningar
        if (a.warningCases !== b.warningCases) return b.warningCases - a.warningCases
        
        // Senast OK-cases
        return b.okCases - a.okCases
      })

      setSitesData(aggregatedData)
    } catch (error) {
      console.error('Error fetching aggregated data:', error)
      setSitesData([])
    } finally {
      setLoading(false)
    }
  }

  const toggleSiteExpansion = (siteId: string) => {
    const newExpanded = new Set(expandedSites)
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId)
    } else {
      newExpanded.add(siteId)
    }
    setExpandedSites(newExpanded)
  }

  // Beräkna totala siffror
  const totals = sitesData.reduce((acc, site) => ({
    sites: acc.sites + 1,
    critical: acc.critical + site.criticalCases,
    warning: acc.warning + site.warningCases,
    ok: acc.ok + site.okCases,
    unacknowledged: acc.unacknowledged + site.unacknowledgedRecommendations
  }), { sites: 0, critical: 0, warning: 0, ok: 0, unacknowledged: 0 })

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner text="Laddar översikt..." />
        </div>
      </Card>
    )
  }

  if (sitesData.length === 0) {
    return (
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
        <div className="text-center py-8">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Inga enheter att visa</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Översiktsstatistik */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Enheter</p>
              <p className="text-2xl font-bold text-white">{totals.sites}</p>
            </div>
            <Building2 className="w-8 h-8 text-purple-400" />
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Kritiska</p>
              <p className="text-2xl font-bold text-red-400">{totals.critical}</p>
            </div>
            <span className="text-2xl">🔴</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Varningar</p>
              <p className="text-2xl font-bold text-yellow-400">{totals.warning}</p>
            </div>
            <span className="text-2xl">🟡</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">OK</p>
              <p className="text-2xl font-bold text-green-400">{totals.ok}</p>
            </div>
            <span className="text-2xl">🟢</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Obekräftade</p>
              <p className="text-2xl font-bold text-amber-400">{totals.unacknowledged}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
        </Card>
      </div>

      {/* Detaljerad lista per enhet */}
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700">
        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              {userRole === 'verksamhetschef' && 'Ärendebedömningar - Alla enheter'}
              {userRole === 'regionchef' && 'Ärendebedömningar - Din region'}
              {userRole === 'platsansvarig' && 'Ärendebedömningar - Din enhet'}
            </h3>
            <p className="text-sm text-slate-400">
              Tekniska bedömningar per ärende - varje färg representerar situationen vid specifika besök
            </p>
          </div>

          <div className="space-y-3">
            {sitesData.map(site => {
              const isExpanded = expandedSites.has(site.siteId)
              
              return (
                <div
                  key={site.siteId}
                  className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden transition-all duration-200"
                >
                  <div
                    onClick={() => toggleSiteExpansion(site.siteId)}
                    className="p-4 cursor-pointer hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrafficLightBadge
                          pestLevel={site.worstPestLevel}
                          problemRating={site.worstProblemRating}
                          size="medium"
                          showTooltip={false}
                        />
                        <div>
                          <h4 className="font-medium text-white">{site.siteName}</h4>
                          {site.region && (
                            <p className="text-xs text-slate-400">Region: {site.region}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {site.unacknowledgedRecommendations > 0 && (
                          <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-2 py-1 text-amber-400 text-xs">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            {site.unacknowledgedRecommendations} obekräftad{site.unacknowledgedRecommendations !== 1 ? 'e' : ''}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-sm">
                          {site.criticalCases > 0 && (
                            <span className="text-red-400">🔴 {site.criticalCases}</span>
                          )}
                          {site.warningCases > 0 && (
                            <span className="text-yellow-400">🟡 {site.warningCases}</span>
                          )}
                          {site.okCases > 0 && (
                            <span className="text-green-400">🟢 {site.okCases}</span>
                          )}
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanderad information */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        <div className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-1">Totalt ärenden</p>
                          <p className="text-lg font-bold text-white">{site.totalCases}</p>
                        </div>
                        
                        {site.worstPestLevel !== null && (
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Värsta skadedjursnivå</p>
                            <p className="text-lg font-bold text-white">Nivå {site.worstPestLevel}</p>
                          </div>
                        )}
                        
                        {site.worstProblemRating !== null && (
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Värsta problembild</p>
                            <p className="text-lg font-bold text-white">{site.worstProblemRating}/5</p>
                          </div>
                        )}
                        
                        {site.lastAssessment && (
                          <div className="bg-slate-900/50 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">Senaste bedömning</p>
                            <p className="text-sm font-medium text-white">
                              {new Date(site.lastAssessment).toLocaleDateString('sv-SE')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default TrafficLightAggregatedView