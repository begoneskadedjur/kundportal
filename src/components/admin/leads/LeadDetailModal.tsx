// src/components/admin/leads/LeadDetailModal.tsx - Detailed lead view with all related components

import React, { useState, useEffect } from 'react'
import { Eye, Edit3, X, Star, TrendingUp, Users, MessageSquare, Clock, Tag } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { 
  Lead, 
  LeadContact, 
  LeadComment, 
  LeadEvent,
  LeadWithRelations,
  calculateLeadScore,
  getLeadQuality,
  LEAD_STATUS_DISPLAY,
  getPriorityLabel,
  getPriorityColor
} from '../../../types/database'

import LeadContactsManager from './LeadContactsManager'
import LeadCommentsSystem from './LeadCommentsSystem'
import LeadTimeline from './LeadTimeline'
import LeadTagsManager from './LeadTagsManager'
import EditLeadModal from './EditLeadModal'

interface LeadDetailModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ 
  lead, 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [contacts, setContacts] = useState<LeadContact[]>([])
  const [comments, setComments] = useState<LeadComment[]>([])
  const [events, setEvents] = useState<LeadEvent[]>([])
  const [technician, setTechnician] = useState<string | null>(null)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (lead && isOpen) {
      setCurrentLead(lead)
      fetchLeadDetails()
      
      // Set up real-time subscriptions for lead details
      const contactsSubscription = supabase
        .channel(`lead_contacts_${lead.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'lead_contacts',
            filter: `lead_id=eq.${lead.id}`
          },
          () => {
            setTimeout(() => {
              fetchLeadDetails()
            }, 500)
          }
        )
        .subscribe()
      
      const commentsSubscription = supabase
        .channel(`lead_comments_${lead.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'lead_comments',
            filter: `lead_id=eq.${lead.id}`
          },
          () => {
            setTimeout(() => {
              fetchLeadDetails()
            }, 500)
          }
        )
        .subscribe()
        
      return () => {
        contactsSubscription.unsubscribe()
        commentsSubscription.unsubscribe()
      }
    }
  }, [lead, isOpen])

  // Refresh current lead data when lead prop changes
  useEffect(() => {
    if (lead && lead.id === currentLead?.id) {
      setCurrentLead(lead)
    }
  }, [lead, currentLead])

  const fetchLeadDetails = async () => {
    if (!currentLead) return

    try {
      setLoading(true)

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', currentLead.id)
        .order('is_primary', { ascending: false })

      if (contactsError) throw contactsError

      // Fetch comments with profile info
      const { data: commentsData, error: commentsError } = await supabase
        .from('lead_comments')
        .select(`
          *,
          created_by_profile:profiles!lead_comments_created_by_fkey(display_name, email)
        `)
        .eq('lead_id', currentLead.id)
        .order('created_at', { ascending: false })

      if (commentsError) throw commentsError

      // Fetch events with profile info
      const { data: eventsData, error: eventsError } = await supabase
        .from('lead_events')
        .select(`
          *,
          created_by_profile:profiles!lead_events_created_by_fkey(display_name, email)
        `)
        .eq('lead_id', currentLead.id)
        .order('created_at', { ascending: false })

      if (eventsError) throw eventsError

      // Fetch technician name if assigned
      if (currentLead.assigned_to) {
        const { data: techData, error: techError } = await supabase
          .from('technicians')
          .select('name')
          .eq('id', currentLead.assigned_to)
          .single()

        if (!techError && techData) {
          setTechnician(techData.name)
        }
      }

      setContacts(contactsData || [])
      setComments(commentsData || [])
      setEvents(eventsData || [])

    } catch (err) {
      console.error('Error fetching lead details:', err)
      toast.error('Kunde inte ladda lead-detaljer')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onClose()
    setContacts([])
    setComments([])
    setEvents([])
    setTechnician(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (!currentLead) return null

  const leadScore = calculateLeadScore(currentLead)
  const leadQuality = getLeadQuality(leadScore)
  const statusConfig = LEAD_STATUS_DISPLAY[currentLead.status]

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="full">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-600/10 rounded-lg">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentLead.company_name}</h2>
                <p className="text-slate-400">{currentLead.contact_person}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowEditModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Redigera
              </Button>
              <Button
                onClick={handleClose}
                variant="ghost"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Lead Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Status & Priority */}
                <Card className="p-4 bg-slate-800/50 border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Status & Prioritet</h3>
                  <div className="space-y-3">
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${statusConfig.color}/10 text-${statusConfig.color} border border-${statusConfig.color}/20`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    {currentLead.priority && (
                      <div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-${getPriorityColor(currentLead.priority)}/10 text-${getPriorityColor(currentLead.priority)} border border-${getPriorityColor(currentLead.priority)}/20`}>
                          <Star className="w-3 h-3 mr-1" />
                          {getPriorityLabel(currentLead.priority)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Lead Score */}
                <Card className="p-4 bg-slate-800/50 border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Lead Score</h3>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-white">{leadScore}/100</div>
                    <div className={`text-sm px-2 py-1 rounded ${leadQuality.bgColor}`}>
                      <span className={`text-${leadQuality.color} font-medium`}>
                        {leadQuality.label}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full bg-${leadQuality.color}`}
                        style={{ width: `${leadScore}%` }}
                      ></div>
                    </div>
                  </div>
                </Card>

                {/* Value & Probability */}
                <Card className="p-4 bg-slate-800/50 border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Affärsvärde</h3>
                  <div className="space-y-2">
                    <div className="text-lg font-semibold text-white">
                      {currentLead.estimated_value ? formatCurrency(currentLead.estimated_value) : 'Ej angivet'}
                    </div>
                    {currentLead.probability && (
                      <div className="text-sm text-slate-400">
                        {currentLead.probability}% sannolikhet
                      </div>
                    )}
                    {currentLead.closing_date_estimate && (
                      <div className="text-sm text-slate-400">
                        Förväntat: {formatDate(currentLead.closing_date_estimate)}
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* BANT Kvalificering */}
              <Card className="p-4 bg-slate-800/50 border-slate-700/50 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  BANT-kvalificering
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-3 rounded-lg border ${currentLead.budget_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
                    <div className="text-sm font-medium text-slate-300">Budget</div>
                    <div className={currentLead.budget_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.budget_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.authority_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
                    <div className="text-sm font-medium text-slate-300">Befogenhet</div>
                    <div className={currentLead.authority_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.authority_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.needs_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
                    <div className="text-sm font-medium text-slate-300">Behov</div>
                    <div className={currentLead.needs_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.needs_confirmed ? 'Bekräftat' : 'Ej bekräftat'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.timeline_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-700/30 border-slate-600/30'}`}>
                    <div className="text-sm font-medium text-slate-300">Tidslinje</div>
                    <div className={currentLead.timeline_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.timeline_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Additional Info */}
              {(currentLead.source || currentLead.decision_maker || currentLead.competitor || currentLead.contract_with || technician) && (
                <Card className="p-4 bg-slate-800/50 border-slate-700/50 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Ytterligare Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    {currentLead.source && (
                      <div>
                        <div className="text-slate-300 font-medium">Källa</div>
                        <div className="text-white">{currentLead.source}</div>
                      </div>
                    )}
                    {technician && (
                      <div>
                        <div className="text-slate-300 font-medium">Tilldelad kollega</div>
                        <div className="text-white">{technician}</div>
                      </div>
                    )}
                    {currentLead.decision_maker && (
                      <div>
                        <div className="text-slate-300 font-medium">Beslutsfattare</div>
                        <div className="text-white">{currentLead.decision_maker}</div>
                      </div>
                    )}
                    {currentLead.contract_with && (
                      <div>
                        <div className="text-slate-300 font-medium">Konkurrent</div>
                        <div className="text-white">{currentLead.contract_with}</div>
                      </div>
                    )}
                    {currentLead.competitor && (
                      <div>
                        <div className="text-slate-300 font-medium">Avtalsdetaljer</div>
                        <div className="text-white">{currentLead.competitor}</div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Management Components */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  <LeadContactsManager
                    leadId={currentLead.id}
                    contacts={contacts}
                    onContactsChange={fetchLeadDetails}
                  />
                  
                  <LeadTagsManager
                    leadId={currentLead.id}
                    tags={currentLead.tags || []}
                    onTagsChange={() => {
                      fetchLeadDetails()
                      onSuccess() // Refresh main list
                    }}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <LeadCommentsSystem
                    leadId={currentLead.id}
                    comments={comments}
                    onCommentsChange={fetchLeadDetails}
                  />
                  
                  <LeadTimeline
                    leadId={currentLead.id}
                    events={events}
                    onEventsChange={fetchLeadDetails}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <EditLeadModal
        lead={currentLead}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={async () => {
          setShowEditModal(false)
          
          // Refresh the lead details first
          await fetchLeadDetails()
          
          // Trigger parent refresh which will update the lead prop
          onSuccess()
        }}
      />
    </>
  )
}

export default LeadDetailModal