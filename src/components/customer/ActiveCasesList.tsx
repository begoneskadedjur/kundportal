// src/components/customer/ActiveCasesList.tsx
import React, { useState, useEffect } from 'react'
import { FileText, Clock, AlertCircle, Eye, Calendar, MapPin, Bug } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'

interface Case {
  id: string
  case_number: string
  title: string
  status: string
  priority: string
  pest_type?: string
  location_details?: string
  description?: string
  scheduled_date?: string
  created_at: string
  assigned_technician_name?: string
}

interface ActiveCasesListProps {
  customer: {
    id: string
    company_name: string
  }
  refreshTrigger?: boolean
}

const ActiveCasesList: React.FC<ActiveCasesListProps> = ({ customer, refreshTrigger }) => {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveCases()
  }, [customer.id, refreshTrigger])

  const fetchActiveCases = async () => {
    try {
      setLoading(true)
      setError(null)

      // Hämta ärenden från ClickUp API via backend
      const response = await fetch(`/api/clickup-tasks?customer_id=${customer.id}`)
      
      if (response.ok) {
        const data = await response.json()
        const tasks = data.tasks || []
        
        // Filtrera endast aktiva ärenden (ej avslutade)
        const activeCases = tasks.filter((task: any) => {
          const status = task.status?.status?.toLowerCase() || ''
          return !['genomfört', 'genomförd', 'avslutad', 'klar', 'complete', 'closed'].includes(status)
        })

        // Mappa till vårt Case interface
        const mappedCases: Case[] = activeCases.map((task: any) => ({
          id: task.id,
          case_number: task.custom_id || `#${task.id.slice(-6)}`,
          title: task.name,
          status: task.status?.status || 'Okänd',
          priority: task.priority?.priority || 'normal',
          pest_type: task.custom_fields?.find((f: any) => f.name?.toLowerCase().includes('skadedjur'))?.value,
          location_details: task.custom_fields?.find((f: any) => f.name?.toLowerCase().includes('plats'))?.value,
          description: task.description,
          scheduled_date: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : undefined,
          created_at: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : new Date().toISOString(),
          assigned_technician_name: task.assignees?.[0]?.username
        }))

        setCases(mappedCases.slice(0, 5)) // Visa max 5 senaste
      } else {
        setCases([])
      }
    } catch (error) {
      console.error('Error fetching cases:', error)
      setError('Kunde inte hämta ärenden')
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  // Få prioritetsfärg
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'hög':
        return 'text-red-500 bg-red-500/20'
      case 'high':
      case 'medium':
      case 'medel':
        return 'text-yellow-500 bg-yellow-500/20'
      case 'low':
      case 'låg':
        return 'text-green-500 bg-green-500/20'
      default:
        return 'text-slate-500 bg-slate-500/20'
    }
  }

  // Få statusfärg
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('open') || statusLower.includes('öppen')) {
      return 'text-blue-500 bg-blue-500/20'
    }
    if (statusLower.includes('progress') || statusLower.includes('bokat') || statusLower.includes('pågående')) {
      return 'text-yellow-500 bg-yellow-500/20'
    }
    if (statusLower.includes('waiting') || statusLower.includes('väntar')) {
      return 'text-orange-500 bg-orange-500/20'
    }
    return 'text-slate-500 bg-slate-500/20'
  }

  // Formatera datum
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Idag'
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Imorgon'
    }
    return date.toLocaleDateString('sv-SE', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    })
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Aktiva Ärenden</h3>
            <p className="text-slate-400 text-sm">
              {cases.length > 0 
                ? `${cases.length} pågående ${cases.length === 1 ? 'ärende' : 'ärenden'}`
                : 'Inga aktiva ärenden'
              }
            </p>
          </div>
        </div>
        
        {cases.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = `/customer/cases`}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Visa alla
          </Button>
        )}
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-400">{error}</p>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={fetchActiveCases}
              className="mt-3"
            >
              Försök igen
            </Button>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-green-500" />
            </div>
            <h4 className="text-white font-medium mb-2">Inga aktiva ärenden</h4>
            <p className="text-slate-400 text-sm mb-4">
              Du har för närvarande inga pågående ärenden hos BeGone.
            </p>
            <p className="text-slate-500 text-xs">
              Behöver du hjälp? Skapa ett nytt ärende via snabbåtgärderna ovan.
            </p>
          </div>
        ) : (
          cases.map((caseItem) => (
            <div
              key={caseItem.id}
              className="group p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 hover:bg-slate-800/70 transition-all duration-200 cursor-pointer"
              onClick={() => {
                // TODO: Öppna case details modal
                console.log('Opening case:', caseItem.id)
              }}
            >
              {/* Case Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-400 text-sm font-mono">
                      {caseItem.case_number}
                    </span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(caseItem.priority)}`}>
                      {caseItem.priority}
                    </div>
                  </div>
                  <h4 className="text-white font-medium group-hover:text-slate-100 transition-colors truncate">
                    {caseItem.title}
                  </h4>
                </div>
                
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                  {caseItem.status}
                </div>
              </div>

              {/* Case Details */}
              <div className="space-y-2">
                {caseItem.pest_type && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Bug className="w-4 h-4" />
                    <span>{caseItem.pest_type}</span>
                  </div>
                )}

                {caseItem.location_details && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{caseItem.location_details}</span>
                  </div>
                )}

                {caseItem.scheduled_date && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Schemalagt: {formatDate(caseItem.scheduled_date)}</span>
                  </div>
                )}

                {caseItem.assigned_technician_name && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>Tekniker: {caseItem.assigned_technician_name}</span>
                  </div>
                )}
              </div>

              {/* Action Hint */}
              <div className="mt-3 pt-3 border-t border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center text-slate-400 text-xs">
                  <span>Klicka för att visa detaljer</span>
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Action */}
      {cases.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => window.location.href = `/customer/cases`}
          >
            Visa alla ärenden ({cases.length}+)
          </Button>
        </div>
      )}
    </Card>
  )
}

export default ActiveCasesList