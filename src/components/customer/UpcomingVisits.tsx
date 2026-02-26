// src/components/customer/UpcomingVisits.tsx
import React, { useState, useEffect } from 'react'
import { Calendar, Clock, User, MapPin, Phone, AlertCircle, ClipboardCheck } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'

interface Visit {
  id: string
  case_id: string
  case_number: string
  case_title: string
  visit_date: string
  technician_name?: string
  technician_phone?: string
  work_description?: string
  status: string
  estimated_duration?: string
  location?: string
  source?: 'clickup' | 'inspection'
}

interface UpcomingVisitsProps {
  customer: {
    id: string
    company_name: string
  }
  refreshTrigger?: boolean
}

const UpcomingVisits: React.FC<UpcomingVisitsProps> = ({ customer, refreshTrigger }) => {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUpcomingVisits()
  }, [customer.id, refreshTrigger])

  const fetchUpcomingVisits = async () => {
    try {
      setLoading(true)
      setError(null)

      const allVisits: Visit[] = []

      // 1. Hämta schemalagda inspektionssessioner från Supabase
      try {
        const { data: inspectionSessions } = await supabase
          .from('station_inspection_sessions')
          .select(`
            id, scheduled_at, scheduled_end, status, notes,
            technician:technicians(name, phone)
          `)
          .eq('customer_id', customer.id)
          .in('status', ['scheduled', 'in_progress'])
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(10)

        if (inspectionSessions) {
          for (const session of inspectionSessions) {
            const tech = session.technician as any
            const durationMs = session.scheduled_end && session.scheduled_at
              ? new Date(session.scheduled_end).getTime() - new Date(session.scheduled_at).getTime()
              : 0
            const durationMin = Math.round(durationMs / 60000)

            allVisits.push({
              id: `inspection-${session.id}`,
              case_id: session.id,
              case_number: 'Kontroll',
              case_title: 'Stationskontroll',
              visit_date: session.scheduled_at,
              technician_name: tech?.name || 'Ej tilldelad',
              technician_phone: tech?.phone || undefined,
              work_description: session.notes || undefined,
              status: session.status === 'in_progress' ? 'Pågår' : 'Schemalagd',
              estimated_duration: durationMin > 0 ? `${durationMin} min` : undefined,
              location: customer.company_name,
              source: 'inspection'
            })
          }
        }
      } catch (err) {
        console.error('Error fetching inspection sessions:', err)
      }

      // 2. Hämta ärenden från ClickUp
      try {
        const { data: customerData } = await supabase
          .from('customers')
          .select('clickup_list_id')
          .eq('id', customer.id)
          .single()

        if (customerData?.clickup_list_id) {
          const response = await fetch(`/api/clickup-tasks?list_id=${customerData.clickup_list_id}`)

          if (response.ok) {
            const data = await response.json()
            const tasks = data.tasks || []

            const upcomingTasks = tasks.filter((task: any) => {
              if (!task.due_date) return false
              const dueDate = new Date(parseInt(task.due_date))
              const now = new Date()
              const status = task.status?.status?.toLowerCase() || ''
              return dueDate >= now &&
                     !['genomfört', 'genomförd', 'avslutad', 'klar', 'complete', 'closed'].includes(status)
            })

            for (const task of upcomingTasks) {
              allVisits.push({
                id: `visit-${task.id}`,
                case_id: task.id,
                case_number: task.custom_id || `#${task.id.slice(-6)}`,
                case_title: task.name,
                visit_date: new Date(parseInt(task.due_date)).toISOString(),
                technician_name: task.assignees?.[0]?.username || 'Ej tilldelad',
                technician_phone: undefined,
                work_description: task.description,
                status: task.status?.status || 'Schemalagd',
                estimated_duration: '2-4 timmar',
                location: task.custom_fields?.find((f: any) => f.name?.toLowerCase().includes('adress'))?.value || customer.company_name,
                source: 'clickup'
              })
            }
          }
        }
      } catch (err) {
        console.error('Error fetching ClickUp visits:', err)
      }

      // Sortera efter datum (närmast först) och begränsa
      allVisits.sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())

      if (allVisits.length === 0 && !error) {
        setVisits([])
      } else {
        setVisits(allVisits.slice(0, 5))
      }
    } catch (error) {
      console.error('Error fetching visits:', error)
      setError('Kunde inte hämta kommande besök')
      setVisits([])
    } finally {
      setLoading(false)
    }
  }

  // Formatera datum och tid
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    let dateText = ''
    if (date.toDateString() === today.toDateString()) {
      dateText = 'Idag'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateText = 'Imorgon'
    } else if (date < nextWeek) {
      dateText = date.toLocaleDateString('sv-SE', { weekday: 'long' })
    } else {
      dateText = date.toLocaleDateString('sv-SE', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }

    const timeText = date.toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit'
    })

    return { dateText, timeText }
  }

  // Få färg baserat på hur nära besöket är
  const getVisitUrgency = (dateString: string) => {
    const visitDate = new Date(dateString)
    const now = new Date()
    const diffHours = (visitDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (diffHours <= 24) {
      return {
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/30',
        urgency: 'Inom 24h'
      }
    } else if (diffHours <= 72) {
      return {
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30',
        urgency: 'Inom 3 dagar'
      }
    } else {
      return {
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/30',
        urgency: 'Schemalagt'
      }
    }
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
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Kommande Besök</h3>
            <p className="text-slate-400 text-sm">
              {visits.length > 0 
                ? `${visits.length} schemalagda ${visits.length === 1 ? 'besök' : 'besök'}`
                : 'Inga schemalagda besök'
              }
            </p>
          </div>
        </div>
        
        {visits.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = `/customer/schedule`}
            className="flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Schema
          </Button>
        )}
      </div>

      {/* Visits List */}
      <div className="space-y-3">
        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-400">{error}</p>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={fetchUpcomingVisits}
              className="mt-3"
            >
              Försök igen
            </Button>
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
            <h4 className="text-white font-medium mb-2">Inga schemalagda besök</h4>
            <p className="text-slate-400 text-sm mb-4">
              Du har för närvarande inga bokade besök från BeGone.
            </p>
            <p className="text-slate-500 text-xs">
              Besök schemaläggs automatiskt när era ärenden hanteras av våra tekniker.
            </p>
          </div>
        ) : (
          visits.map((visit) => {
            const { dateText, timeText } = formatDateTime(visit.visit_date)
            const urgency = getVisitUrgency(visit.visit_date)
            
            return (
              <div
                key={visit.id}
                className={`group p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:scale-[1.02] ${urgency.bgColor} ${urgency.borderColor} hover:${urgency.borderColor.replace('/30', '/50')}`}
              >
                {/* Visit Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {visit.source === 'inspection' && (
                        <ClipboardCheck className="w-3.5 h-3.5 text-teal-400" />
                      )}
                      <span className="text-slate-400 text-sm font-mono">
                        {visit.case_number}
                      </span>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${urgency.color} bg-current/20`}>
                        {urgency.urgency}
                      </div>
                    </div>
                    <h4 className="text-white font-medium group-hover:text-slate-100 transition-colors truncate">
                      {visit.case_title}
                    </h4>
                  </div>
                </div>

                {/* DateTime Info */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${urgency.color}`} />
                    <span className={`text-sm font-medium ${urgency.color}`}>
                      {dateText}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">
                      {timeText}
                    </span>
                  </div>
                </div>

                {/* Visit Details */}
                <div className="space-y-2">
                  {visit.technician_name && visit.technician_name !== 'Ej tilldelad' && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <User className="w-4 h-4" />
                      <span>Tekniker: {visit.technician_name}</span>
                    </div>
                  )}

                  {visit.location && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">
                        {typeof visit.location === 'object' && visit.location?.formatted_address
                          ? visit.location.formatted_address
                          : typeof visit.location === 'string' 
                          ? visit.location 
                          : customer.company_name
                        }
                      </span>
                    </div>
                  )}

                  {visit.estimated_duration && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span>Uppskattad tid: {visit.estimated_duration}</span>
                    </div>
                  )}
                </div>

                {/* Work Description Preview */}
                {visit.work_description && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {visit.work_description.length > 100 
                        ? visit.work_description.substring(0, 100) + '...'
                        : visit.work_description
                      }
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

export default UpcomingVisits