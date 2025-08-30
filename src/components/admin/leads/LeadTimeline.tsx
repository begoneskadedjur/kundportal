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
  AlertCircle
} from 'lucide-react'
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
  description: string
  metadata: any
}

const LeadTimeline: React.FC<LeadTimelineProps> = ({ 
  leadId, 
  events, 
  onEventsChange 
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<EventFormData>({
    event_type: 'note_added',
    description: '',
    metadata: null
  })

  const resetForm = () => {
    setFormData({
      event_type: 'note_added',
      description: '',
      metadata: null
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

    if (!formData.description.trim()) {
      newErrors.description = 'Beskrivning är obligatorisk'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !user?.id) return

    try {
      setLoading(true)

      const insertData: LeadEventInsert = {
        lead_id: leadId,
        event_type: formData.event_type,
        description: formData.description,
        metadata: formData.metadata,
        created_by: user.id
      }

      const { error } = await supabase
        .from('lead_events')
        .insert(insertData)

      if (error) throw error

      toast.success('Händelse tillagd i timeline')
      resetForm()
      onEventsChange()

    } catch (err) {
      console.error('Error saving event:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara händelse')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just nu'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min sedan`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} h sedan`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} d sedan`
    
    return date.toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  // Sort events by date (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          Händelsetimeline ({events.length})
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Lägg till händelse
        </Button>
      </div>

      {/* Add Event Form */}
      {showForm && (
        <Card className="p-4 bg-slate-700/30 border-slate-600/50 mb-6">
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
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
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
                Beskrivning *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Beskriv vad som hände..."
                rows={3}
                className={`w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none ${
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

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-600/30">
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
                className="bg-purple-600 hover:bg-purple-700 text-white"
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
      {sortedEvents.length > 0 ? (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-600"></div>
          
          <div className="space-y-6">
            {sortedEvents.map((event, index) => (
              <div key={event.id} className="relative flex items-start gap-4">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-${EVENT_TYPE_DISPLAY[event.event_type].color}/10 border-2 border-${EVENT_TYPE_DISPLAY[event.event_type].color}/30`}>
                  <div className={`text-${EVENT_TYPE_DISPLAY[event.event_type].color}`}>
                    {getEventTypeIcon(event.event_type)}
                  </div>
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0 pb-6">
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full bg-${EVENT_TYPE_DISPLAY[event.event_type].color}/20 text-${EVENT_TYPE_DISPLAY[event.event_type].color}`}>
                          {EVENT_TYPE_DISPLAY[event.event_type].label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {formatDate(event.created_at)}
                      </div>
                    </div>
                    
                    <p className="text-slate-200 mb-2">
                      {event.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <User className="w-3 h-3" />
                      {event.created_by_profile?.display_name || 'Systemhändelse'}
                    </div>
                    
                    {event.metadata && (
                      <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-400 mb-1">Metadata:</div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline end marker */}
          <div className="relative flex items-start gap-4 mt-6">
            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-slate-700/30 border-2 border-slate-600/30">
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