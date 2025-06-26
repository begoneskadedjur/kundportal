// src/components/customer/CaseList.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, AlertCircle, Eye, FileText, Flag } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import CaseDetailsModal from './CaseDetailsModal'

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
}

export default function CaseList() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
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
      setCases(data || [])
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

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'open': 'text-blue-400 bg-blue-400/20',
      'in_progress': 'text-yellow-400 bg-yellow-400/20',
      'completed': 'text-green-400 bg-green-400/20',
      'closed': 'text-gray-400 bg-gray-400/20',
      'pending': 'text-orange-400 bg-orange-400/20'
    }
    return statusColors[status.toLowerCase()] || 'text-gray-400 bg-gray-400/20'
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
      <div className="space-y-4">
        {cases.map((case_) => (
          <Card key={case_.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {case_.title}
                  </h3>
                  <span className="text-sm text-slate-400">
                    #{case_.case_number}
                  </span>
                </div>

                {/* Status och prioritet */}
                <div className="flex items-center gap-4 mb-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(case_.status)}`}>
                    {case_.status}
                  </span>
                  
                  {/* UPPDATERAD PRIORITETSVISNING: */}
                  {case_.priority && getPriorityDisplay(case_.priority)}

                  {case_.pest_type && (
                    <span className="text-sm text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                      {case_.pest_type}
                    </span>
                  )}
                </div>

                {/* Beskrivning */}
                {case_.description && (
                  <p className="text-slate-300 mb-3 line-clamp-2">
                    {case_.description}
                  </p>
                )}

                {/* Plats */}
                {case_.location_details && (
                  <p className="text-sm text-slate-400 mb-3">
                    📍 {case_.location_details}
                  </p>
                )}

                {/* Datum */}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Skapad: {formatDate(case_.created_at)}</span>
                  </div>
                  
                  {case_.scheduled_date && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>Schemalagd: {formatDate(case_.scheduled_date)}</span>
                    </div>
                  )}
                  
                  {case_.completed_date && (
                    <div className="flex items-center gap-1 text-green-400">
                      <Clock className="w-4 h-4" />
                      <span>Slutförd: {formatDate(case_.completed_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="ml-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedCase(case_)}
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Visa detaljer
                </Button>
              </div>
            </div>
          </Card>
        ))}
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