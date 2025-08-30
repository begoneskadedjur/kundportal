// src/components/admin/leads/LeadTechnicianManager.tsx - Component for managing lead technician assignments

import React, { useState, useEffect } from 'react'
import { Users, Plus, X, Star, Clock, AlertCircle } from 'lucide-react'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { 
  LeadTechnician, 
  LeadTechnicianInsert, 
  LeadTechnicianUpdate, 
  Technician 
} from '../../../types/database'

interface LeadTechnicianManagerProps {
  leadId: string
  assignedTechnicians: LeadTechnician[]
  onTechniciansChange: () => void
}

const LeadTechnicianManager: React.FC<LeadTechnicianManagerProps> = ({ 
  leadId, 
  assignedTechnicians, 
  onTechniciansChange 
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')

  // DEBUG: Log state changes for troubleshooting
  useEffect(() => {
    console.log('LeadTechnicianManager DEBUG:', {
      showAddForm,
      availableTechnicians: availableTechnicians.length,
      assignedTechnicians: assignedTechnicians.length,
      unassignedCount: availableTechnicians.filter(tech => 
        !assignedTechnicians.some(assigned => assigned.technician_id === tech.id)
      ).length
    })
  }, [showAddForm, availableTechnicians, assignedTechnicians])

  // Real-time subscription for lead technicians
  // Note: Disabled to prevent conflicts with add operations
  // The parent component will handle refreshes manually after operations
  useEffect(() => {
    // Subscription disabled to prevent auto-refresh conflicts during add operations
    // Manual refresh is triggered via onTechniciansChange callback after successful operations
    return () => {
      // Cleanup function (no subscription to unsubscribe)
    }
  }, [leadId, onTechniciansChange])

  // Fetch available technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      console.log('Fetching available technicians...')
      try {
        const { data, error } = await supabase
          .from('technicians')
          .select('id, name, email, is_active')
          .eq('is_active', true)
          .order('name')

        if (error) {
          console.error('Error fetching technicians:', error)
          throw error
        }
        
        console.log('Fetched technicians:', data?.length || 0, 'technicians')
        setAvailableTechnicians(data || [])
      } catch (error) {
        console.error('Error fetching technicians:', error)
        toast.error('Kunde inte hämta tillgängliga kollegor')
      }
    }

    fetchTechnicians()
  }, [])

  // Filter out already assigned technicians
  const unassignedTechnicians = availableTechnicians.filter(tech => 
    !assignedTechnicians.some(assigned => assigned.technician_id === tech.id)
  )
  
  // DEBUG: Log filtering logic
  useEffect(() => {
    console.log('FILTERING DEBUG:', {
      availableTechnicians: availableTechnicians.map(t => ({id: t.id, name: t.name})),
      assignedTechnicians: assignedTechnicians.map(t => ({id: t.id, technician_id: t.technician_id})),
      unassignedTechnicians: unassignedTechnicians.map(t => ({id: t.id, name: t.name}))
    })
  }, [availableTechnicians, assignedTechnicians, unassignedTechnicians])

  const handleAddTechnician = async () => {
    console.log('handleAddTechnician called:', { selectedTechnicianId, userId: user?.id, leadId })
    
    if (!selectedTechnicianId || !user?.id) {
      console.error('Missing required data:', { selectedTechnicianId, userId: user?.id, leadId })
      toast.error('Saknade data för att lägga till kollega')
      return
    }

    try {
      setLoading(true)
      console.log('Starting technician insert...')

      const insertData: LeadTechnicianInsert = {
        lead_id: leadId,
        technician_id: selectedTechnicianId,
        is_primary: assignedTechnicians.length === 0, // First technician becomes primary
        assigned_by: user.id,
        notes: assignmentNotes.trim() || null
      }

      console.log('Insert data:', insertData)

      const { error, data } = await supabase
        .from('lead_technicians')
        .insert(insertData)
        .select()

      if (error) {
        console.error('Supabase insert error:', error)
        throw error
      }

      console.log('Technician added successfully:', data)
      toast.success('Kollega tillagd')
      
      // Reset form
      setSelectedTechnicianId('')
      setAssignmentNotes('')
      setShowAddForm(false)
      
      // Trigger parent refresh
      onTechniciansChange()

    } catch (err) {
      console.error('Error adding technician:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte lägga till kollega')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTechnician = async (assignmentId: string) => {
    if (!window.confirm('Är du säker på att du vill ta bort denna kollega-tilldelning?')) {
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('lead_technicians')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      toast.success('Kollega borttagen')
      onTechniciansChange()

    } catch (err) {
      console.error('Error removing technician:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort kollega')
    } finally {
      setLoading(false)
    }
  }

  const handleSetPrimary = async (assignmentId: string) => {
    try {
      setLoading(true)

      const updateData: LeadTechnicianUpdate = {
        is_primary: true
      }

      const { error } = await supabase
        .from('lead_technicians')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) throw error

      toast.success('Primär kollega uppdaterad')
      onTechniciansChange()

    } catch (err) {
      console.error('Error setting primary technician:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte uppdatera primär kollega')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" />
          Tilldelade kollegor ({assignedTechnicians.length})
        </h3>
        <Button
          onClick={() => {
            console.log('ADD KOLLEGA CLICKED:', { 
              currentShowAddForm: showAddForm, 
              willBe: !showAddForm,
              unassignedCount: unassignedTechnicians.length,
              buttonDisabled: unassignedTechnicians.length === 0
            })
            setShowAddForm(prev => {
              const newValue = !prev
              console.log('setShowAddForm called:', { prev, newValue })
              return newValue
            })
          }}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={unassignedTechnicians.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Lägg till kollega {unassignedTechnicians.length === 0 && '(Ingen tillgänglig)'}
        </Button>
      </div>

      {/* DEBUG: Show state info */}
      <div className="mb-4 p-2 bg-red-900/20 border border-red-500/20 rounded text-xs text-red-300">
        DEBUG: showAddForm={showAddForm.toString()}, available={availableTechnicians.length}, unassigned={unassignedTechnicians.length}
      </div>

      {/* Add Technician Form */}
      {showAddForm && (
        <Card className="p-4 bg-slate-700/30 border-slate-600/50 mb-6">
          <h4 className="font-medium text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Tilldela ny kollega
          </h4>

          {unassignedTechnicians.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-slate-400">Alla tillgängliga kollegor är redan tilldelade</p>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="ghost"
                className="mt-2"
              >
                Stäng
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Välj kollega ({unassignedTechnicians.length} tillgängliga)
                </label>
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => {
                    console.log('Technician selected:', e.target.value)
                    setSelectedTechnicianId(e.target.value)
                  }}
                  className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                >
                  <option value="">Välj kollega...</option>
                  {unassignedTechnicians.map(tech => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email})
                    </option>
                  ))}
                </select>
              </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Anteckningar (valfritt)
              </label>
              <textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Anledning till tilldelning, specialområde, etc..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
              />
            </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-600/30">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    console.log('Cancel clicked, resetting form')
                    setShowAddForm(false)
                    setSelectedTechnicianId('')
                    setAssignmentNotes('')
                  }}
                  disabled={loading}
                >
                  Avbryt
                </Button>
                <Button
                  onClick={() => {
                    console.log('Add technician clicked:', { selectedTechnicianId, loading })
                    handleAddTechnician()
                  }}
                  disabled={loading || !selectedTechnicianId}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Lägger till...
                    </>
                  ) : (
                    'Lägg till kollega'
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Assigned Technicians List */}
      {assignedTechnicians.length > 0 ? (
        <div className="space-y-4">
          {assignedTechnicians.map((assignment) => {
            const technician = availableTechnicians.find(t => t.id === assignment.technician_id)
            
            return (
              <div
                key={assignment.id}
                className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${assignment.is_primary ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                      {assignment.is_primary ? (
                        <Star className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <Users className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {technician?.name || 'Okänd kollega'}
                        </span>
                        {assignment.is_primary && (
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                            Primär
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Tilldelad {formatDate(assignment.assigned_at)}
                        </div>
                        {technician?.email && (
                          <span>{technician.email}</span>
                        )}
                      </div>

                      {assignment.notes && (
                        <div className="text-sm text-slate-300 bg-slate-600/20 rounded p-2 mt-2">
                          {assignment.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!assignment.is_primary && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetPrimary(assignment.id)}
                        disabled={loading}
                        className="text-yellow-400 hover:text-yellow-300"
                        title="Gör till primär kollega"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveTechnician(assignment.id)}
                      disabled={loading}
                      className="text-red-400 hover:text-red-300"
                      title="Ta bort tilldelning"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !showAddForm && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Inga kollegor tilldelade än</p>
            <p className="text-slate-500 text-sm">
              {unassignedTechnicians.length > 0 
                ? 'Klicka på "Lägg till kollega" för att tilldela första kollegan'
                : 'Alla tillgängliga kollegor är redan tilldelade'
              }
            </p>
          </div>
        )
      )}

      {unassignedTechnicians.length === 0 && assignedTechnicians.length > 0 && (
        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            Alla tillgängliga kollegor är redan tilldelade till detta lead
          </div>
        </div>
      )}
    </Card>
  )
}

export default LeadTechnicianManager