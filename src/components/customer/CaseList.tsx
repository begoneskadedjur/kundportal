// src/components/customer/CaseList.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, AlertCircle, Eye, FileText, Flag, User, ClipboardCheck } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import CaseDetailsModal from './CaseDetailsModal'

function getStatusLabel(status: string, revisitCount?: number): string {
  if (status === 'open') return 'Öppen'
  if (status === 'Återbesök') {
    const visitNumber = (revisitCount ?? 0) + 1
    return visitNumber > 1 ? `Återbesök ${visitNumber}` : 'Återbesök'
  }
  const labels: Record<string, string> = {
    'Öppen': 'Öppen',
    'Bokad': 'Bokad',
    'Avslutat': 'Genomförd',
    'Borttaget': 'Avbokat',
    'Offert skickad': 'Offert skickad',
    'Offert signerad - boka in': 'Offert signerad',
    'Bomkörning': 'Bomkörning',
    'Ombokning': 'Ombokning',
    'Reklamation': 'Reklamation',
  }
  return labels[status] ?? status
}

const SERVICE_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  inspection: { label: 'Servicebesök', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  establishment: { label: 'Etablering', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  acute: { label: 'Akut', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  service: { label: 'Service', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
}

interface Case {
  id: string
  case_number: string
  title: string
  status: string
  priority: string
  pest_type: string
  location_details: string
  description: string
  clickup_task_id: string
  scheduled_date: string | null
  completed_date: string | null
  created_at: string
  updated_at: string
  service_type?: string | null
  primary_technician_name?: string | null
  inspected_outdoor_stations?: number | null
  total_outdoor_stations?: number | null
  inspected_indoor_stations?: number | null
  total_indoor_stations?: number | null
}

export default function CaseList() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [revisitCounts, setRevisitCounts] = useState<Record<string, number>>({})
  const { profile } = useAuth()

  useEffect(() => {
    if (profile?.customer_id) {
      fetchCases()
    }
  }, [profile])

  const fetchCases = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', profile?.customer_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const fetchedCases = data || []
      setCases(fetchedCases)

      // Hämta återbesöksantal för ärenden med status 'Återbesök'
      const revisitCaseIds = fetchedCases
        .filter(c => c.status === 'Återbesök')
        .map(c => c.id)

      if (revisitCaseIds.length > 0) {
        const { data: logData } = await supabase
          .from('case_updates_log')
          .select('case_id')
          .in('case_id', revisitCaseIds)
          .eq('update_type', 'revisit_scheduled')

        const counts: Record<string, number> = {}
        for (const row of logData || []) {
          counts[row.case_id] = (counts[row.case_id] || 0) + 1
        }
        setRevisitCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
      setError('Kunde inte ladda ärenden')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string): string => {
    if (status === 'open' || status === 'Öppen') return 'text-blue-400 bg-blue-400/20'
    if (status === 'Bokad') return 'text-yellow-400 bg-yellow-400/20'
    if (status === 'Avslutat') return 'text-green-400 bg-green-400/20'
    if (status === 'Borttaget') return 'text-gray-400 bg-gray-400/20'
    if (status === 'Återbesök') return 'text-purple-400 bg-purple-400/20'
    if (status === 'Offert skickad' || status === 'Offert signerad - boka in') return 'text-orange-400 bg-orange-400/20'
    if (status === 'Reklamation') return 'text-red-400 bg-red-400/20'
    return 'text-slate-400 bg-slate-400/20'
  }

  const getPriorityColor = (priority: string) => {
    const priorityColors: { [key: string]: string } = {
      'urgent': 'text-red-400',
      'high': 'text-orange-400',
      'normal': 'text-blue-400',
      'low': 'text-gray-400'
    }
    return priorityColors[priority.toLowerCase()] || 'text-gray-400'
  }

  // UPPDATERAD FUNKTION MED TRANSPARENT BAKGRUND:
  const getPriorityDisplay = (priority: string | null) => {
    if (!priority) return null
    
    const priorityLower = priority.toLowerCase()
    
    // Prioritetskonfiguration med ClickUps färger
    const config = {
      'urgent': { 
        text: 'Akut', 
        color: '#f87171',
        flagColor: 'text-red-500',
        borderColor: 'border-red-500/50',
        textColor: 'text-red-400'
      },
      'high': { 
        text: 'Hög', 
        color: '#fb923c',
        flagColor: 'text-orange-500',
        borderColor: 'border-orange-500/50',
        textColor: 'text-orange-400'
      },
      'normal': { 
        text: 'Normal', 
        color: '#60a5fa',
        flagColor: 'text-blue-500',
        borderColor: 'border-blue-500/50',
        textColor: 'text-blue-400'
      },
      'low': { 
        text: 'Låg', 
        color: '#9ca3af',
        flagColor: 'text-gray-500',
        borderColor: 'border-gray-500/50',
        textColor: 'text-gray-400'
      }
    }
    
    const priorityConfig = config[priorityLower] || config['normal']
    
    return (
      <span 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.borderColor} ${priorityConfig.textColor} bg-transparent`}
      >
        <Flag className={`w-3 h-3 ${priorityConfig.flagColor}`} fill="currentColor" />
        <span>{priorityConfig.text}</span>
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-400">
        <AlertCircle className="w-5 h-5 mr-2" />
        {error}
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <Card className="text-center py-12">
        <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Inga ärenden</h3>
        <p className="text-slate-400">Du har inga registrerade ärenden än.</p>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {cases.map((case_) => {
          const serviceTypeCfg = case_.service_type ? SERVICE_TYPE_LABELS[case_.service_type] : null
          const totalStations = (case_.total_outdoor_stations || 0) + (case_.total_indoor_stations || 0)
          const inspectedStations = (case_.inspected_outdoor_stations || 0) + (case_.inspected_indoor_stations || 0)
          const showProgress = case_.service_type === 'inspection' && totalStations > 0

          return (
            <Card key={case_.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Vänster: Titel + ärendenummer + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {case_.title}
                    </h3>
                    {case_.case_number && (
                      <span className="text-xs text-slate-500 shrink-0">#{case_.case_number}</span>
                    )}
                    {serviceTypeCfg && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${serviceTypeCfg.cls}`}>
                        {serviceTypeCfg.label}
                      </span>
                    )}
                    {case_.pest_type && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-400">
                        {case_.pest_type}
                      </span>
                    )}
                  </div>

                  {/* Meta-rad */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
                      {getStatusLabel(case_.status, revisitCounts[case_.id])}
                    </span>

                    {case_.priority && getPriorityDisplay(case_.priority)}

                    {showProgress && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <ClipboardCheck className="w-3 h-3" />
                        {inspectedStations}/{totalStations}
                        {inspectedStations === totalStations && totalStations > 0 && (
                          <span className="text-green-400">✓</span>
                        )}
                      </span>
                    )}

                    {case_.primary_technician_name && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <User className="w-3 h-3" />
                        {case_.primary_technician_name}
                      </span>
                    )}

                    {(case_.completed_date || case_.scheduled_date || case_.created_at) && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {case_.completed_date
                          ? formatDate(case_.completed_date)
                          : case_.scheduled_date
                          ? formatDate(case_.scheduled_date)
                          : formatDate(case_.created_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Höger: Visa-knapp */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCase(case_)}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Visa
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Modal för ärendedetaljer */}
      {selectedCase && (
        <CaseDetailsModal
          caseId={selectedCase.id}
          clickupTaskId={selectedCase.clickup_task_id}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </>
  )
}