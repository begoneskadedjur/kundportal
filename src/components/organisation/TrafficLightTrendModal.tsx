// src/components/organisation/TrafficLightTrendModal.tsx - Huvudmodal för trafikljus trendanalys
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { X, Calendar, Filter, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../shared/LoadingSpinner'
import TrendChart from './TrendChart'
import MetricExplanation from './MetricExplanation'
import TrendSummary from '../shared/TrendSummary'

interface TrendDataPoint {
  date: string
  value: number
  displayDate: string
}

interface CaseData {
  id: string
  assessment_date: string
  pest_level: number | null
  problem_rating: number | null
  customer_id: string
  site_name?: string
}

interface TrafficLightTrendModalProps {
  isOpen: boolean
  onClose: () => void
  customerId?: string
  siteIds?: string[]
  userRole: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
  title?: string
}

const TrafficLightTrendModal: React.FC<TrafficLightTrendModalProps> = ({
  isOpen,
  onClose,
  customerId,
  siteIds = [],
  userRole,
  title
}) => {
  // Early return om modal inte är öppen för att undvika all logik
  if (!isOpen) return null

  // Ref för att tracka om komponenten är mounted
  const isMountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<CaseData[]>([])
  const [pestLevelData, setPestLevelData] = useState<TrendDataPoint[]>([])
  const [problemRatingData, setProblemRatingData] = useState<TrendDataPoint[]>([])
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y'>('3m')
  
  // Aggregerad statistik
  const [currentStats, setCurrentStats] = useState({
    currentPestLevel: null as number | null,
    currentProblemRating: null as number | null,
    pestLevelTrend: null as 'up' | 'down' | 'stable' | null,
    problemRatingTrend: null as 'up' | 'down' | 'stable' | null,
    totalCases: 0,
    criticalCases: 0,
    warningCases: 0,
    okCases: 0,
    unacknowledgedCount: 0,
    lastAssessment: null as string | null
  })

  // Stabilisera customer IDs med robust validering - använd useRef för att undvika ny array-referens
  const stableCustomerIdsRef = useRef<string[]>([])
  const stableCustomerIds = useMemo(() => {
    let newIds: string[] = []
    
    // Robust validering för customerId
    if (customerId && typeof customerId === 'string' && customerId.trim()) {
      newIds = [customerId.trim()]
    } 
    // Robust validering för siteIds array
    else if (Array.isArray(siteIds) && siteIds.length > 0) {
      newIds = siteIds.filter(id => id && typeof id === 'string' && id.trim())
    }
    
    // Returnera samma array-referens om innehållet är identiskt
    if (stableCustomerIdsRef.current.length === newIds.length && 
        stableCustomerIdsRef.current.every((id, index) => id === newIds[index])) {
      return stableCustomerIdsRef.current
    }
    
    stableCustomerIdsRef.current = newIds
    return newIds
  }, [customerId, siteIds])

  // Memoized fetchTrendData för att undvika onödiga re-renders
  const fetchTrendData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Använd stabiliserade customer IDs
      if (stableCustomerIds.length === 0) {
        console.warn('Inga customer IDs angivna för trenddata')
        if (isMountedRef.current) {
          setLoading(false)
        }
        return
      }

      // Debug log inuti funktionen för att undvika objektskapande vid render
      console.log('Fetching trend data for:', { stableCustomerIds, userRole })

      // Beräkna datumområde
      const endDate = new Date()
      const startDate = new Date()
      switch (timeRange) {
        case '3m':
          startDate.setMonth(endDate.getMonth() - 3)
          break
        case '6m':
          startDate.setMonth(endDate.getMonth() - 6)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }

      // Hämta data från Supabase
      const { data: cases, error } = await supabase
        .from('cases')
        .select(`
          id,
          assessment_date,
          pest_level,
          problem_rating,
          customer_id,
          recommendations,
          recommendations_acknowledged,
          customers!inner(site_name)
        `)
        .in('customer_id', stableCustomerIds)
        .gte('assessment_date', startDate.toISOString())
        .not('assessment_date', 'is', null)
        .order('assessment_date', { ascending: true })

      if (error) {
        console.error('Error fetching trend data:', error)
        throw error
      }

      console.log(`Fetched ${cases?.length || 0} cases for trend analysis`)

      if (!cases || cases.length === 0) {
        console.log('No cases found, setting empty state')
        if (isMountedRef.current) {
          setRawData([])
          setPestLevelData([])
          setProblemRatingData([])
          setCurrentStats({
            currentPestLevel: null,
            currentProblemRating: null,
            pestLevelTrend: null,
            problemRatingTrend: null,
            totalCases: 0,
            criticalCases: 0,
            warningCases: 0,
            okCases: 0,
            unacknowledgedCount: 0,
            lastAssessment: null
          })
          setLoading(false)
        }
        return
      }

      // Processera rådata
      const processedData: CaseData[] = cases.map(caseItem => ({
        id: caseItem.id,
        assessment_date: caseItem.assessment_date,
        pest_level: caseItem.pest_level,
        problem_rating: caseItem.problem_rating,
        customer_id: caseItem.customer_id,
        site_name: (caseItem.customers as any)?.site_name || 'Okänd enhet'
      }))

      // Kontrollera att komponenten fortfarande är mounted innan state updates
      if (!isMountedRef.current) return

      setRawData(processedData)

      // Skapa trenddata för skadedjursnivå
      const pestLevelTrends = processedData
        .filter(item => item.pest_level !== null)
        .map(item => ({
          date: item.assessment_date,
          value: item.pest_level!,
          displayDate: new Date(item.assessment_date).toLocaleDateString('sv-SE', {
            month: 'short',
            day: 'numeric'
          })
        }))

      // Skapa trenddata för övergripande problembild  
      const problemRatingTrends = processedData
        .filter(item => item.problem_rating !== null)
        .map(item => ({
          date: item.assessment_date,
          value: item.problem_rating!,
          displayDate: new Date(item.assessment_date).toLocaleDateString('sv-SE', {
            month: 'short', 
            day: 'numeric'
          })
        }))

      if (isMountedRef.current) {
        setPestLevelData(pestLevelTrends)
        setProblemRatingData(problemRatingTrends)

        // Beräkna aktuell statistik
        calculateCurrentStats(processedData, pestLevelTrends, problemRatingTrends)
      }

    } catch (error) {
      console.error('Error fetching trend data:', error)
      // Sätt till tom state vid fel, endast om mounted
      if (isMountedRef.current) {
        setRawData([])
        setPestLevelData([])
        setProblemRatingData([])
        setCurrentStats({
          currentPestLevel: null,
          currentProblemRating: null,
          pestLevelTrend: null,
          problemRatingTrend: null,
          totalCases: 0,
          criticalCases: 0,
          warningCases: 0,
          okCases: 0,
          unacknowledgedCount: 0,
          lastAssessment: null
        })
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [stableCustomerIds, timeRange]) // Endast nödvändiga dependencies

  // Cleanup effect för att tracka mount status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // UseEffect med förbättrade guards
  useEffect(() => {
    // Tidig exit om modal inte är öppen eller ingen data att hämta
    if (stableCustomerIds.length === 0) {
      console.log('No customer IDs available, skipping fetch')
      return
    }
    
    fetchTrendData()
  }, [stableCustomerIds, timeRange, fetchTrendData])

  const calculateCurrentStats = (
    data: CaseData[], 
    pestTrends: TrendDataPoint[], 
    problemTrends: TrendDataPoint[]
  ) => {
    // Aktuella värden (senaste bedömningen)
    const latestPestLevel = pestTrends.length > 0 ? pestTrends[pestTrends.length - 1].value : null
    const latestProblemRating = problemTrends.length > 0 ? problemTrends[problemTrends.length - 1].value : null

    // Trendberäkningar
    const pestLevelTrend = calculateTrend(pestTrends)
    const problemRatingTrend = calculateTrend(problemTrends)

    // Ärendekategorisering
    const casesWithAssessments = data.filter(c => 
      c.pest_level !== null && c.problem_rating !== null
    )
    
    const criticalCases = casesWithAssessments.filter(c => 
      c.pest_level! >= 3 || c.problem_rating! >= 4
    ).length
    
    const warningCases = casesWithAssessments.filter(c => 
      c.pest_level === 2 || c.problem_rating === 3
    ).length
    
    const okCases = casesWithAssessments.filter(c => 
      (c.pest_level! >= 0 && c.pest_level! <= 1) || 
      (c.problem_rating! >= 1 && c.problem_rating! <= 2)
    ).length

    // Senaste bedömning
    const lastAssessment = data.length > 0 
      ? data.reduce((latest, current) => 
          new Date(current.assessment_date) > new Date(latest.assessment_date) ? current : latest
        ).assessment_date
      : null

    setCurrentStats({
      currentPestLevel: latestPestLevel,
      currentProblemRating: latestProblemRating,
      pestLevelTrend,
      problemRatingTrend,
      totalCases: casesWithAssessments.length,
      criticalCases,
      warningCases, 
      okCases,
      unacknowledgedCount: 0, // Skulle behöva hämtas separat
      lastAssessment
    })
  }

  const calculateTrend = (trends: TrendDataPoint[]): 'up' | 'down' | 'stable' | null => {
    if (trends.length < 2) return null
    
    const recent = trends.slice(-3) // Senaste 3 mätningarna
    if (recent.length < 2) return null
    
    const first = recent[0].value
    const last = recent[recent.length - 1].value
    
    if (last > first) return 'up'
    if (last < first) return 'down'
    return 'stable'
  }

  const getModalTitle = () => {
    if (title) return title
    
    switch (userRole) {
      case 'platsansvarig':
        return 'Trendanalys för din enhet'
      case 'regionchef':
        return 'Regional trendanalys'
      case 'verksamhetschef':
        return 'Organisatorisk trendanalys'
      default:
        return 'Trafikljus trendanalys'
    }
  }

  // Enkel early return om inga customer IDs finns (låt parent hantera logiken)
  if (stableCustomerIds.length === 0) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-700 w-full max-w-7xl max-h-[95vh] overflow-hidden">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  📈 {getModalTitle()}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Historisk utveckling av tekniska bedömningar och trender
                </p>
              </div>
              
              {/* Tidsspann-väljare */}
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
                {[
                  { key: '3m', label: '3 mån' },
                  { key: '6m', label: '6 mån' },
                  { key: '1y', label: '1 år' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTimeRange(key as '3m' | '6m' | '1y')}
                    className={`px-3 py-1 rounded text-sm transition-all ${
                      timeRange === key
                        ? 'bg-purple-600 text-[#fff]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner text="Laddar trenddata..." />
              </div>
            ) : (
              <div className="space-y-8">
                
                {/* Sammanfattning */}
                <TrendSummary
                  currentPestLevel={currentStats.currentPestLevel}
                  currentProblemRating={currentStats.currentProblemRating}
                  pestLevelTrend={currentStats.pestLevelTrend}
                  problemRatingTrend={currentStats.problemRatingTrend}
                  totalCases={currentStats.totalCases}
                  criticalCases={currentStats.criticalCases}
                  warningCases={currentStats.warningCases}
                  okCases={currentStats.okCases}
                  unacknowledgedCount={currentStats.unacknowledgedCount}
                  lastAssessment={currentStats.lastAssessment}
                />

                {/* Trendgrafer - 50/50 split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Skadedjursnivå */}
                  <div className="bg-slate-800/30 rounded-lg p-6">
                    <TrendChart
                      data={pestLevelData}
                      metric="pestLevel"
                      title="Skadedjursnivå (0-3)"
                      currentValue={currentStats.currentPestLevel ?? undefined}
                      height={300}
                    />
                  </div>

                  {/* Övergripande problembild */}
                  <div className="bg-slate-800/30 rounded-lg p-6">
                    <TrendChart
                      data={problemRatingData}
                      metric="problemRating"
                      title="Övergripande Problembild (1-5)"
                      currentValue={currentStats.currentProblemRating ?? undefined}
                      height={300}
                    />
                  </div>
                </div>

                {/* Förbättrade förklaringar */}
                <MetricExplanation 
                  showBothMetrics={true}
                  compact={false}
                />

                {/* Information om datakälla */}
                <div className="bg-slate-800/20 border border-slate-700/50 rounded-lg p-4 text-center">
                  <p className="text-slate-400 text-sm">
                    Data baseras på {rawData.length} bedömningar från {
                      userRole === 'platsansvarig' ? 'din enhet' :
                      userRole === 'regionchef' ? 'enheter under ditt regionansvar' :
                      'alla enheter i organisationen'
                    } under de senaste {
                      timeRange === '3m' ? '3 månaderna' :
                      timeRange === '6m' ? '6 månaderna' : 
                      'året'
                    }.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default TrafficLightTrendModal