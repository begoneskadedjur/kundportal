// src/components/shared/CaseIncidentsSection.tsx
// Sektion för att logga och visa tillbud & avvikelser i EditCaseModal

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Plus, X, Clock, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import toast from 'react-hot-toast'
import type { CaseIncident, IncidentType } from '../../types/caseIncidents'
import { INCIDENT_TYPE_CONFIG } from '../../types/caseIncidents'

interface CaseIncidentsSectionProps {
  caseId: string
  caseType: 'private' | 'business'
  technicianId: string | null
  technicianName: string | null
  reportedById: string | null
  reportedByName: string
}

export default function CaseIncidentsSection({
  caseId,
  caseType,
  technicianId,
  technicianName,
  reportedById,
  reportedByName
}: CaseIncidentsSectionProps) {
  const [incidents, setIncidents] = useState<CaseIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<{
    type: IncidentType
    description: string
  }>({
    type: 'tillbud',
    description: ''
  })

  const fetchIncidents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('case_incidents')
        .select('*')
        .eq('case_id', caseId)
        .eq('case_type', caseType)
        .order('occurred_at', { ascending: false })

      if (error) throw error
      setIncidents(data || [])
    } catch (err) {
      console.error('Error fetching incidents:', err)
    } finally {
      setLoading(false)
    }
  }, [caseId, caseType])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      toast.error('Beskrivning krävs')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('case_incidents')
        .insert({
          case_id: caseId,
          case_type: caseType,
          type: formData.type,
          description: formData.description.trim(),
          occurred_at: new Date().toISOString(),
          reported_by_id: reportedById,
          reported_by_name: reportedByName,
          technician_id: technicianId,
          technician_name: technicianName
        })

      if (error) throw error

      // Skicka notis till alla incidentmottagare
      try {
        const { data: recipients } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('incident_recipient', true)

        if (recipients?.length) {
          const typeLabel = INCIDENT_TYPE_CONFIG[formData.type].label
          const notifications = recipients
            .filter(r => r.id !== reportedById) // Exkludera avsändaren
            .map(r => ({
              recipient_id: r.id,
              case_id: caseId,
              case_type: caseType,
              title: `Ny ${typeLabel.toLowerCase()}`,
              preview: formData.description.trim().slice(0, 200),
              sender_name: reportedByName,
              sender_id: reportedById,
              is_read: false,
              source_comment_id: null,
              case_title: technicianName ? `Tekniker: ${technicianName}` : null
            }))

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
          }
        }
      } catch (notifErr) {
        console.error('Error sending incident notifications:', notifErr)
        // Fortsätt ändå — incidenten är sparad
      }

      toast.success(`${INCIDENT_TYPE_CONFIG[formData.type].label} rapporterad`)
      setFormData({ type: 'tillbud', description: '' })
      setShowForm(false)
      fetchIncidents()
    } catch (err) {
      console.error('Error creating incident:', err)
      toast.error('Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_incidents')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Borttagen')
      fetchIncidents()
    } catch (err) {
      console.error('Error deleting incident:', err)
      toast.error('Kunde inte ta bort')
    }
  }

  return (
    <div className="pt-3 border-t border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Tillbud & Avvikelser
          {incidents.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
              {incidents.length}
            </span>
          )}
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Rapportera
          </button>
        )}
      </div>

      {/* Formulär */}
      {showForm && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl mb-2 space-y-2">
          {/* Typ-väljare */}
          <div className="flex gap-2">
            {(Object.keys(INCIDENT_TYPE_CONFIG) as IncidentType[]).map(type => {
              const config = INCIDENT_TYPE_CONFIG[type]
              const isSelected = formData.type === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type }))}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    isSelected
                      ? `${config.bgColor} ${config.color} ${config.borderColor}`
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {config.label}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-slate-500">
            {INCIDENT_TYPE_CONFIG[formData.type].description}
          </p>

          {/* Beskrivning */}
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            placeholder="Beskriv händelsen..."
            className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] transition-colors resize-none"
          />

          {/* Auto-ifyllda fält */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date().toLocaleDateString('sv-SE')} {new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {technicianName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {technicianName}
              </span>
            )}
          </div>

          {/* Knappar */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setFormData({ type: 'tillbud', description: '' }) }}
              className="text-xs"
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              loading={saving}
              disabled={saving || !formData.description.trim()}
              className="text-xs"
            >
              Spara
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-xs text-slate-500">Laddar...</p>
      ) : incidents.length === 0 && !showForm ? (
        <p className="text-xs text-slate-500 italic">Inga tillbud eller avvikelser rapporterade</p>
      ) : (
        <div className="space-y-1.5">
          {incidents.map(incident => {
            const config = INCIDENT_TYPE_CONFIG[incident.type as IncidentType]
            return (
              <div key={incident.id} className="flex items-start gap-2 px-2 py-1.5 bg-slate-800/20 border border-slate-700/50 rounded-lg">
                <span className={`px-1.5 py-0.5 text-xs rounded ${config.bgColor} ${config.color} flex-shrink-0 mt-0.5`}>
                  {config.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{incident.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>{new Date(incident.occurred_at).toLocaleDateString('sv-SE')} {new Date(incident.occurred_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                    {incident.technician_name && <span>· {incident.technician_name}</span>}
                    <span>· {incident.reported_by_name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(incident.id)}
                  className="p-0.5 text-slate-600 hover:text-red-400 flex-shrink-0"
                  title="Ta bort"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
