// src/components/organisation/TrafficLightCaseList.tsx
import React, { useState, useEffect } from 'react'
import { AlertTriangle, Check, Clock, ChevronRight, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import TrafficLightBadge from './TrafficLightBadge'
import TrafficLightStatusCard from './TrafficLightStatusCard'
import { ClickUpStatus } from '../../types/database'

interface Case {
  id: string
  case_number: string
  title: string
  status: string
  pest_level?: number | null
  problem_rating?: number | null
  recommendations?: string | null
  recommendations_acknowledged?: boolean
  recommendations_acknowledged_at?: string | null
  work_report?: string | null
  pest_type?: string | null
  address?: string | any
  assessment_date?: string | null
  primary_technician_name?: string | null
  scheduled_start?: string | null
}

interface TrafficLightCaseListProps {
  customerId: string
  onCaseUpdate?: () => void
}

const TrafficLightCaseList: React.FC<TrafficLightCaseListProps> = ({ 
  customerId, 
  onCaseUpdate 
}) => {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    fetchCases()

    // Set up real-time subscription
    const subscription = supabase
      .channel('traffic-light-cases')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `customer_id=eq.${customerId}`
        },
        () => {
          fetchCases()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [customerId])

  const fetchCases = async () => {
    try {
      setLoading(true)

      // Hämta alla ärenden för kunden, prioritera de med trafikljusdata
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          pest_level,
          problem_rating,
          recommendations,
          recommendations_acknowledged,
          recommendations_acknowledged_at,
          work_report,
          pest_type,
          address,
          assessment_date,
          primary_technician_name,
          scheduled_start
        `)
        .eq('customer_id', customerId)
        .order('problem_rating', { ascending: false, nullsFirst: false })
        .order('pest_level', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setCases(data || [])
    } catch (error) {
      console.error('Error fetching cases:', error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  // Beräkna trafikljusstatus för ett ärende
  const getTrafficLightStatus = (pestLevel?: number | null, problemRating?: number | null) => {
    if (pestLevel === null && problemRating === null) return null
    if (pestLevel === undefined && problemRating === undefined) return null
    
    const pest = pestLevel ?? -1
    const problem = problemRating ?? -1
    
    if (pest >= 3 || problem >= 4) return 'red'
    if (pest === 2 || problem === 3) return 'yellow'
    if (pest >= 0 || problem >= 0) return 'green'
    return null
  }

  // Sortera ärenden efter kritikalitet
  const sortedCases = [...cases].sort((a, b) => {
    const statusA = getTrafficLightStatus(a.pest_level, a.problem_rating)
    const statusB = getTrafficLightStatus(b.pest_level, b.problem_rating)
    
    const priority = { red: 3, yellow: 2, green: 1, null: 0 }
    const priorityA = priority[statusA as keyof typeof priority] || 0
    const priorityB = priority[statusB as keyof typeof priority] || 0
    
    return priorityB - priorityA
  })

  // Räkna ärenden per status
  const statusCounts = {
    red: sortedCases.filter(c => getTrafficLightStatus(c.pest_level, c.problem_rating) === 'red').length,
    yellow: sortedCases.filter(c => getTrafficLightStatus(c.pest_level, c.problem_rating) === 'yellow').length,
    green: sortedCases.filter(c => getTrafficLightStatus(c.pest_level, c.problem_rating) === 'green').length,
    unacknowledged: sortedCases.filter(c => c.recommendations && !c.recommendations_acknowledged).length
  }

  const handleCaseClick = (caseItem: Case) => {
    setSelectedCase(caseItem)
    setShowDetails(true)
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700 p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner text="Laddar ärenden..." />
        </div>
      </Card>
    )
  }

  if (cases.length === 0) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700 p-6">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Inga ärenden registrerade</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-slate-700">
        <div className="p-6">
          {/* Header med sammanfattning */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Professionell bedömning av era ärenden</h3>
              <p className="text-sm text-slate-400 mb-3">Våra tekniker bedömer situationen vid varje besök</p>
              <div className="flex items-center gap-4 text-sm">
                {statusCounts.red > 0 && (
                  <span className="text-red-400">
                    🔴 {statusCounts.red} kritisk{statusCounts.red !== 1 ? 'a' : ''}
                  </span>
                )}
                {statusCounts.yellow > 0 && (
                  <span className="text-yellow-400">
                    🟡 {statusCounts.yellow} varning{statusCounts.yellow !== 1 ? 'ar' : ''}
                  </span>
                )}
                {statusCounts.green > 0 && (
                  <span className="text-green-400">
                    🟢 {statusCounts.green} ok
                  </span>
                )}
              </div>
            </div>
            {statusCounts.unacknowledged > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-3 py-1 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {statusCounts.unacknowledged} obekräftad{statusCounts.unacknowledged !== 1 ? 'e' : ''}
              </div>
            )}
          </div>

          {/* Förklaring av statussystemet */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6">
            <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Vad betyder bedömningarna?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-lg">🟢</span>
                <div>
                  <p className="font-medium text-green-400">OK - Kontrollerad situation</p>
                  <p className="text-slate-500">Inga eller minimal aktivitet, situationen är under kontroll</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">🟡</span>
                <div>
                  <p className="font-medium text-yellow-400">Varning - Övervakning krävs</p>
                  <p className="text-slate-500">Måttlig aktivitet, kräver uppmärksamhet och uppföljning</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">🔴</span>
                <div>
                  <p className="font-medium text-red-400">Kritisk - Åtgärd krävs</p>
                  <p className="text-slate-500">Hög aktivitet, omedelbar åtgärd rekommenderas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lista med ärenden */}
          <div className="space-y-3">
            {sortedCases.map(caseItem => {
              const trafficLightStatus = getTrafficLightStatus(caseItem.pest_level, caseItem.problem_rating)
              
              return (
                <div
                  key={caseItem.id}
                  onClick={() => handleCaseClick(caseItem)}
                  className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 transition-all duration-200 hover:bg-slate-800/70 hover:scale-[1.01] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {trafficLightStatus && (
                          <TrafficLightBadge
                            pestLevel={caseItem.pest_level}
                            problemRating={caseItem.problem_rating}
                            size="medium"
                          />
                        )}
                        <div>
                          <h4 className="font-medium text-white">
                            {caseItem.case_number} - {caseItem.title}
                          </h4>
                          <p className="text-xs text-slate-400">
                            Status: {caseItem.status}
                            {caseItem.primary_technician_name && (
                              <> • Tekniker: {caseItem.primary_technician_name}</>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Bekräftelsestatus */}
                      {caseItem.recommendations && (
                        <div className="flex items-center gap-2 mt-2">
                          {caseItem.recommendations_acknowledged ? (
                            <div className="flex items-center gap-1 text-xs text-green-400">
                              <Check className="w-3 h-3" />
                              Rekommendationer bekräftade
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-amber-400">
                              <Clock className="w-3 h-3" />
                              Inväntar bekräftelse
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Modal för ärendedetaljer */}
      {showDetails && selectedCase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-700">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Ärendedetaljer</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <TrafficLightStatusCard
                  caseData={selectedCase}
                  isCustomerView={true}
                  onAcknowledgmentUpdate={() => {
                    fetchCases()
                    if (onCaseUpdate) onCaseUpdate()
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default TrafficLightCaseList