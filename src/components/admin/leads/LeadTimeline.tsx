// src/components/admin/leads/LeadTimeline.tsx - Component for displaying lead event timeline

import React, { useState, useEffect } from 'react'
import { 
  Clock, 
  Plus, 
  RotateCcw, 
  Phone, 
  Calendar, 
  FileText, 
  StickyNote,
  User,
  Circle,
  CheckCircle,
  AlertCircle,
  ChevronDown
} from 'lucide-react'
import { formatSwedishDateTime, formatSwedishRelativeTime } from '../../../utils/swedishDateFormat'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { 
  LeadEvent, 
  LeadEventInsert, 
  EventType,
  EVENT_TYPE_DISPLAY 
} from '../../../types/database'

interface LeadTimelineProps {
  leadId: string
  events: LeadEvent[]
  onEventsChange: () => void
}

interface EventFormData {
  event_type: EventType
  title: string
  description: string
  data: any
}

const LeadTimeline: React.FC<LeadTimelineProps> = ({ 
  leadId, 
  events, 
  onEventsChange 
}) => {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [visibleEventCount, setVisibleEventCount] = useState(5)
  
  const INITIAL_EVENT_COUNT = 5
  const LOAD_MORE_BATCH_SIZE = 5

  // Real-time subscription för lead events
  useEffect(() => {
    const subscription = supabase
      .channel(`lead_events_${leadId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'lead_events',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          onEventsChange() // Trigger parent refresh
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [leadId, onEventsChange])
  
  const [formData, setFormData] = useState<EventFormData>({
    event_type: 'note_added',
    title: '',
    description: '',
    data: null
  })

  const resetForm = () => {
    setFormData({
      event_type: 'note_added',
      title: '',
      description: '',
      data: null
    })
    setShowForm(false)
    setErrors({})
  }

  const handleInputChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Titel är obligatorisk'
    }

    // Description is optional according to database schema (nullable)
    // No validation needed for description

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      console.log('Validation failed')
      return
    }
    
    if (!profile?.id) {
      console.error('No profile ID found', { user, profile })
      toast.error('Du måste vara inloggad för att lägga till händelser')
      return
    }

    try {
      setLoading(true)

      const insertData: LeadEventInsert = {
        lead_id: leadId,
        event_type: formData.event_type,
        title: formData.title.trim(),
        description: formData.description.trim() || null, // Ensure empty string becomes null
        event_date: null, // Set to null for manual events, could be made configurable
        data: formData.data,
        created_by: profile.id
      }

      const { error } = await supabase
        .from('lead_events')
        .insert(insertData)

      if (error) {
        console.error('Supabase error saving event:', error)
        throw new Error(error.message || 'Kunde inte spara händelse')
      }

      toast.success('Händelse tillagd i timeline')
      resetForm()
      onEventsChange()

    } catch (err) {
      console.error('Error saving event:', err)
      
      // More specific error handling
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Ett oväntat fel inträffade vid sparande av händelse'
        
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Okänt datum'
    
    const date = new Date(dateString)
    
    // Kontrollera om datumet är giltigt
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString)
      return 'Ogiltigt datum'
    }
    
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    // Visa relativ tid för händelser inom 24 timmar
    if (diffInHours < 24 && diffInHours >= 0) {
      return formatSwedishRelativeTime(dateString)
    }
    
    // Visa svenskt datumformat för äldre händelser
    return formatSwedishDateTime(dateString)
  }

  const getEventTypeIcon = (type: EventType) => {
    const display = EVENT_TYPE_DISPLAY[type]
    const iconName = display.icon
    
    switch (iconName) {
      case 'RotateCcw': return <RotateCcw className="w-4 h-4" />
      case 'Phone': return <Phone className="w-4 h-4" />
      case 'Calendar': return <Calendar className="w-4 h-4" />
      case 'FileText': return <FileText className="w-4 h-4" />
      case 'Clock': return <Clock className="w-4 h-4" />
      case 'StickyNote': return <StickyNote className="w-4 h-4" />
      default: return <Circle className="w-4 h-4" />
    }
  }

  // Sort events by date (newest first) and apply pagination
  const allSortedEvents = [...events].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  
  const visibleEvents = allSortedEvents.slice(0, visibleEventCount)
  const remainingEventCount = allSortedEvents.length - visibleEventCount
  const hasMoreEvents = remainingEventCount > 0
  
  const loadMoreEvents = () => {
    const newVisibleCount = Math.min(
      visibleEventCount + LOAD_MORE_BATCH_SIZE, 
      allSortedEvents.length
    )
    setVisibleEventCount(newVisibleCount)
  }
  
  // Reset visible count when events change (new events added)
  useEffect(() => {
    if (allSortedEvents.length > 0 && visibleEventCount < INITIAL_EVENT_COUNT) {
      setVisibleEventCount(INITIAL_EVENT_COUNT)
    }
  }, [allSortedEvents.length])

  return (
    <Card className="p-6 bg-slate-800/40 border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          Händelser ({allSortedEvents.length} totalt)
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className=""
        >
          <Plus className="w-4 h-4 mr-2" />
          Lägg till händelse
        </Button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <Card className="p-4 bg-slate-800/30 border-slate-700/40 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-white flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Ny händelse
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Händelsetyp
              </label>
              <select
                value={formData.event_type}
                onChange={(e) => handleInputChange('event_type', e.target.value as EventType)}
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              >
                {Object.entries(EVENT_TYPE_DISPLAY).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Kort sammanfattning av händelsen..."
                className={`w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 ${
                  errors.title ? 'border-red-500' : ''
                }`}
              />
              {errors.title && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Detaljerad beskrivning av vad som hände..."
                rows={3}
                className={`w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none ${
                  errors.description ? 'border-red-500' : ''
                }`}
              />
              {errors.description && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={loading}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className=""
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Sparar...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Lägg till händelse
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Timeline */}
      {allSortedEvents.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-600"></div>
          
          <div className="space-y-6">
            {visibleEvents.map((event, index) => (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${EVENT_TYPE_DISPLAY[event.event_type].iconClass}`}>
                  {getEventTypeIcon(event.event_type)}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0 pb-6">
                  <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/40">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${EVENT_TYPE_DISPLAY[event.event_type].badgeClass}`}>
                          {EVENT_TYPE_DISPLAY[event.event_type].label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {formatDate(event.created_at)}
                      </div>
                    </div>
                    
                    {event.title && (
                      <h4 className="text-slate-100 font-medium mb-2">
                        {event.title}
                      </h4>
                    )}
                    
                    {event.description && (
                      <p className="text-slate-300 mb-2">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="w-3 h-3" />
                      {event.created_by_profile?.display_name || 
                       event.created_by_profile?.technicians?.name ||
                       event.created_by_profile?.email ||
                       'Systemhändelse'}
                    </div>
                    
                    {(() => {
                      // Filter out technical metadata and show only user-relevant data
                      const getUserRelevantData = (data: any) => {
                        if (!data || typeof data !== 'object') return null;
                        
                        const relevantData: any = {};
                        
                        // Include specific fields that are useful for users
                        const userRelevantFields = [
                          'notes', 'comment_content', 'contact_name', 'contact_email', 
                          'contact_phone', 'technician_name', 'tag_added', 'tag_removed',
                          'updated_fields', 'new_status_label', 'old_status_label',
                          'new_priority_label', 'old_priority_label'
                        ];
                        
                        userRelevantFields.forEach(field => {
                          if (data[field] && data[field] !== null && data[field] !== '') {
                            relevantData[field] = data[field];
                          }
                        });
                        
                        // Special handling for arrays
                        if (data.updated_fields && Array.isArray(data.updated_fields) && data.updated_fields.length > 0) {
                          relevantData.updated_fields = data.updated_fields;
                        }
                        
                        return Object.keys(relevantData).length > 0 ? relevantData : null;
                      };
                      
                      const relevantData = getUserRelevantData(event.data);
                      
                      return relevantData && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="text-xs text-slate-400 mb-2">Detaljer:</div>
                          <div className="space-y-1">
                            {Object.entries(relevantData).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="text-slate-400 capitalize">
                                  {key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')}:
                                </span>
                                <span className="text-slate-300 ml-2">
                                  {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Events Button */}
          {hasMoreEvents && (
            <div className="mt-6">
              <button 
                onClick={loadMoreEvents}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 hover:text-slate-200 hover:bg-slate-800/80 transition-colors duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Visa {Math.min(LOAD_MORE_BATCH_SIZE, remainingEventCount)} äldre händelser</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    ({remainingEventCount} fler händelser)
                  </span>
                  <ChevronDown className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
            </div>
          )}

          {/* Completion indicator when all events are loaded */}
          {!hasMoreEvents && allSortedEvents.length > INITIAL_EVENT_COUNT && (
            <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Alla händelser visas</span>
            </div>
          )}

          {/* Timeline end marker */}
          <div className="relative flex items-start gap-4 mt-6">
            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/30 border-2 border-slate-700/40">
              <CheckCircle className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-500 italic">
                Lead skapad
              </div>
            </div>
          </div>
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Inga händelser i timeline än</p>
            <p className="text-slate-500 text-sm">Klicka på "Lägg till händelse" för att börja dokumentera utvecklingen av detta lead</p>
          </div>
        )
      )}
    </Card>
  )
}

export default LeadTimeline