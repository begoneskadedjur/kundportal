// src/components/admin/leads/LeadDetailModal.tsx - Detailed lead view with all related components

import React, { useState, useEffect } from 'react'
import { Eye, Edit3, Star, TrendingUp, Users, Phone, Mail, Building, Calendar, FileText, Globe, MapPin, Briefcase, Factory } from 'lucide-react'
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
  LeadTechnician,
  LeadWithRelations,
  calculateLeadScore,
  getLeadQuality,
  LEAD_STATUS_DISPLAY,
  LEAD_PRIORITY_DISPLAY,
  getPriorityLabel,
  getPriorityColor
} from '../../../types/database'

import LeadContactsManager from './LeadContactsManager'
import LeadCommentsSystem from './LeadCommentsSystem'
import LeadTimeline from './LeadTimeline'
import LeadTagsManager from './LeadTagsManager'
import LeadTechnicianManager from './LeadTechnicianManager'
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
  const [assignedTechnicians, setAssignedTechnicians] = useState<LeadTechnician[]>([])
  const [technician, setTechnician] = useState<string | null>(null)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (lead && isOpen) {
      setCurrentLead(lead)
      // Pass lead directly to avoid race condition with state update
      fetchLeadDetailsForLead(lead)
      
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
            // Remove setTimeout delay for immediate updates
            fetchLeadDetails()
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
            // Remove setTimeout delay for immediate updates
            fetchLeadDetails()
          }
        )
        .subscribe()

      const eventsSubscription = supabase
        .channel(`lead_events_${lead.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'lead_events',
            filter: `lead_id=eq.${lead.id}`
          },
          () => {
            // Remove setTimeout delay for immediate updates
            fetchLeadDetails()
          }
        )
        .subscribe()

      const leadSubscription = supabase
        .channel(`leads_${lead.id}`)
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'leads',
            filter: `id=eq.${lead.id}`
          },
          () => {
            // Remove setTimeout delay for immediate updates
            fetchLeadDetails()
          }
        )
        .subscribe()

      const technicianSubscription = supabase
        .channel(`lead_technicians_${lead.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'lead_technicians',
            filter: `lead_id=eq.${lead.id}`
          },
          () => {
            // Remove setTimeout delay for immediate updates
            fetchLeadDetails()
          }
        )
        .subscribe()
        
      return () => {
        contactsSubscription.unsubscribe()
        commentsSubscription.unsubscribe()
        eventsSubscription.unsubscribe()
        leadSubscription.unsubscribe()
        technicianSubscription.unsubscribe()
      }
    }
  }, [lead, isOpen])

  // Refresh current lead data when lead prop changes
  useEffect(() => {
    if (lead && lead.id === currentLead?.id) {
      setCurrentLead(lead)
    }
  }, [lead, currentLead])

  const fetchLeadDetailsForLead = async (leadToFetch: Lead) => {
    if (!leadToFetch) return

    try {
      setLoading(true)

      // Fetch all data in parallel for better performance and consistency
      const [contactsResponse, commentsResponse, eventsResponse, technicianAssignmentsResponse, technicianResponse] = await Promise.allSettled([
        supabase
          .from('lead_contacts')
          .select('*')
          .eq('lead_id', leadToFetch.id)
          .order('is_primary', { ascending: false }),
        
        supabase
          .from('lead_comments')
          .select(`
            *,
            created_by_profile:profiles!lead_comments_created_by_fkey(display_name, email)
          `)
          .eq('lead_id', leadToFetch.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('lead_events')
          .select(`
            *,
            created_by_profile:profiles!lead_events_created_by_fkey(display_name, email)
          `)
          .eq('lead_id', leadToFetch.id)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('lead_technicians')
          .select(`
            *,
            technicians:technician_id(
              id,
              name,
              email,
              direct_phone
            )
          `)
          .eq('lead_id', leadToFetch.id)
          .order('is_primary', { ascending: false }),
        
        leadToFetch.assigned_to 
          ? supabase
              .from('technicians')
              .select('name')
              .eq('id', leadToFetch.assigned_to)
              .single()
          : Promise.resolve({ data: null, error: null })
      ])

      // Process contacts with error handling
      if (contactsResponse.status === 'fulfilled' && !contactsResponse.value.error) {
        setContacts(contactsResponse.value.data || [])
      } else {
        console.error('Error fetching contacts:', contactsResponse.status === 'rejected' ? contactsResponse.reason : contactsResponse.value.error)
        setContacts([]) // Ensure we clear stale data
      }

      // Process comments with error handling
      if (commentsResponse.status === 'fulfilled' && !commentsResponse.value.error) {
        setComments(commentsResponse.value.data || [])
      } else {
        console.error('Error fetching comments:', commentsResponse.status === 'rejected' ? commentsResponse.reason : commentsResponse.value.error)
        setComments([]) // Ensure we clear stale data
      }

      // Process events with error handling
      if (eventsResponse.status === 'fulfilled' && !eventsResponse.value.error) {
        setEvents(eventsResponse.value.data || [])
      } else {
        console.error('Error fetching events:', eventsResponse.status === 'rejected' ? eventsResponse.reason : eventsResponse.value.error)
        setEvents([]) // Ensure we clear stale data
      }

      // Process technician assignments with error handling
      if (technicianAssignmentsResponse.status === 'fulfilled' && !technicianAssignmentsResponse.value.error) {
        setAssignedTechnicians(technicianAssignmentsResponse.value.data || [])
      } else {
        console.error('Error fetching technician assignments:', technicianAssignmentsResponse.status === 'rejected' ? technicianAssignmentsResponse.reason : technicianAssignmentsResponse.value.error)
        setAssignedTechnicians([]) // Ensure we clear stale data
      }

      // Process technician with error handling
      if (technicianResponse.status === 'fulfilled' && !technicianResponse.value.error && technicianResponse.value.data) {
        setTechnician(technicianResponse.value.data.name)
      } else {
        setTechnician(null)
      }

    } catch (err) {
      console.error('Error fetching lead details:', err)
      toast.error('Kunde inte ladda lead-detaljer')
      // Clear all data to prevent displaying stale information
      setContacts([])
      setComments([])
      setEvents([])
      setAssignedTechnicians([])
      setTechnician(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchLeadDetails = () => {
    if (currentLead) {
      fetchLeadDetailsForLead(currentLead)
    }
  }

  const handleClose = () => {
    onClose()
    setContacts([])
    setComments([])
    setEvents([])
    setAssignedTechnicians([])
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
    if (!dateString) return 'Ej angivet'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Ogiltigt datum'
    return date.toLocaleDateString('sv-SE', {
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
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="full"
        title={
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-400" />
            <span>{currentLead.company_name}</span>
          </div>
        }
        subtitle={currentLead.contact_person}
        headerActions={
          <Button
            onClick={() => setShowEditModal(true)}
            className=""
            size="sm"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Redigera
          </Button>
        }
      >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="p-5">
              {/* Lead Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Status & Priority */}
                <Card className="p-4 bg-slate-800/40 border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Status & Prioritet</h3>
                  <div className="space-y-3">
                    <div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.badgeClass}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    {currentLead.priority && (
                      <div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium border ${LEAD_PRIORITY_DISPLAY[currentLead.priority!]?.badgeClass || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                          <Star className="w-3 h-3 mr-1" />
                          {getPriorityLabel(currentLead.priority)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Lead Score */}
                <Card className="p-4 bg-slate-800/40 border-slate-700/50">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Lead Score</h3>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-white">{leadScore}/100</div>
                    <div className={`text-sm px-2 py-1 rounded font-medium ${leadQuality.bgColor}`}>
                      {leadQuality.label}
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${leadQuality.barColor}`}
                        style={{ width: `${leadScore}%` }}
                      ></div>
                    </div>
                  </div>
                </Card>

                {/* Value & Probability */}
                <Card className="p-4 bg-slate-800/40 border-slate-700/50">
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
              <Card className="p-4 bg-slate-800/40 border-slate-700/50 mb-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  BANT-kvalificering
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-lg border ${currentLead.budget_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/30 border-slate-600/40'}`}>
                    <div className="text-sm font-medium text-slate-300">Budget</div>
                    <div className={currentLead.budget_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.budget_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.authority_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/30 border-slate-600/40'}`}>
                    <div className="text-sm font-medium text-slate-300">Befogenhet</div>
                    <div className={currentLead.authority_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.authority_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.needs_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/30 border-slate-600/40'}`}>
                    <div className="text-sm font-medium text-slate-300">Behov</div>
                    <div className={currentLead.needs_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.needs_confirmed ? 'Bekräftat' : 'Ej bekräftat'}
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${currentLead.timeline_confirmed ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/30 border-slate-600/40'}`}>
                    <div className="text-sm font-medium text-slate-300">Tidslinje</div>
                    <div className={currentLead.timeline_confirmed ? 'text-green-400' : 'text-slate-400'}>
                      {currentLead.timeline_confirmed ? 'Bekräftad' : 'Ej bekräftad'}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Customer Information + Timeline (merged) */}
              {(currentLead.phone_number || currentLead.email || currentLead.organization_number || currentLead.business_type || currentLead.problem_type || currentLead.company_size || currentLead.website || currentLead.address || currentLead.business_description || currentLead.sni07_label || currentLead.source || currentLead.decision_maker || currentLead.contract_with || currentLead.contact_date || currentLead.follow_up_date || currentLead.quote_provided_date || currentLead.contact_method) && (
                <Card className="p-4 bg-slate-800/40 border-slate-700/50 mb-4">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-400" />
                    Kunduppgifter
                  </h3>

                  {/* Basic Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-4">
                    {currentLead.phone_number && (
                      <div>
                        <div className="text-slate-300 font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          Telefon
                        </div>
                        <div className="text-white">{currentLead.phone_number}</div>
                      </div>
                    )}
                    {currentLead.email && (
                      <div>
                        <div className="text-slate-300 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          E-post
                        </div>
                        <div className="text-white">{currentLead.email}</div>
                      </div>
                    )}
                    {currentLead.organization_number && (
                      <div>
                        <div className="text-slate-300 font-medium">Org.nr</div>
                        <div className="text-white">{currentLead.organization_number}</div>
                      </div>
                    )}
                    {currentLead.business_type && (
                      <div>
                        <div className="text-slate-300 font-medium flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          Verksamhet
                        </div>
                        <div className="text-white">{currentLead.business_type}</div>
                      </div>
                    )}
                    {currentLead.problem_type && (
                      <div>
                        <div className="text-slate-300 font-medium">Problem</div>
                        <div className="text-white">{currentLead.problem_type}</div>
                      </div>
                    )}
                    {currentLead.company_size && (
                      <div>
                        <div className="text-slate-300 font-medium">Företagsstorlek</div>
                        <div className="text-white capitalize">{currentLead.company_size}</div>
                      </div>
                    )}
                    {currentLead.website && (
                      <div>
                        <div className="text-slate-300 font-medium flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          Webbplats
                        </div>
                        <div className="text-white">
                          <a href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-blue-400 hover:text-blue-300 transition-colors">
                            {currentLead.website}
                          </a>
                        </div>
                      </div>
                    )}
                    {currentLead.address && (
                      <div>
                        <div className="text-slate-300 font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Adress
                        </div>
                        <div className="text-white">{currentLead.address}</div>
                      </div>
                    )}
                  </div>

                  {/* Business Description */}
                  {currentLead.business_description && (
                    <div className="mb-4">
                      <div className="text-slate-300 font-medium mb-2">Verksamhetsbeskrivning</div>
                      <div className="text-white bg-slate-800/30 rounded-lg p-3 border border-slate-700/40 whitespace-pre-wrap">
                        {currentLead.business_description}
                      </div>
                    </div>
                  )}

                  {/* SNI Classification */}
                  {currentLead.sni07_label && (
                    <div className="mb-4">
                      <div className="text-slate-300 font-medium mb-2 flex items-center gap-1">
                        <Factory className="w-4 h-4" />
                        SNI-kod (Branschklassning)
                      </div>
                      <div className="text-white bg-slate-800/30 rounded-lg p-3 border border-slate-700/40 space-y-1">
                        {currentLead.sni07_label.split(/(?=\d{5}\s)/).filter(sni => sni.trim()).map((sni, index) => (
                          <div key={index} className="text-sm leading-relaxed border-l-2 border-blue-400/30 pl-3">
                            {sni.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Customer Info */}
                  {(currentLead.source || currentLead.decision_maker) && (
                    <div className="mb-4">
                      <div className="text-slate-300 font-medium mb-2">Övrig information</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {currentLead.source && (
                          <div>
                            <div className="text-slate-300 font-medium">Källa</div>
                            <div className="text-white">{currentLead.source}</div>
                          </div>
                        )}
                        {currentLead.decision_maker && (
                          <div>
                            <div className="text-slate-300 font-medium">Beslutsfattare</div>
                            <div className="text-white">{currentLead.decision_maker}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timeline & Dates (merged into this card) */}
                  {(currentLead.contact_date || currentLead.follow_up_date || currentLead.quote_provided_date || currentLead.contact_method) && (
                    <div className="border-t border-slate-700/50 pt-3 mt-3">
                      <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        Tidslinje & Datum
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        {currentLead.contact_date && (
                          <div>
                            <div className="text-slate-300 font-medium">Kontaktdatum</div>
                            <div className="text-white">{formatDate(currentLead.contact_date)}</div>
                          </div>
                        )}
                        {currentLead.follow_up_date && (
                          <div>
                            <div className="text-slate-300 font-medium">Uppföljning</div>
                            <div className="text-white">{formatDate(currentLead.follow_up_date)}</div>
                          </div>
                        )}
                        {currentLead.quote_provided_date && (
                          <div>
                            <div className="text-slate-300 font-medium">Offert skickad</div>
                            <div className="text-white">{formatDate(currentLead.quote_provided_date)}</div>
                          </div>
                        )}
                        {currentLead.contact_method && (
                          <div>
                            <div className="text-slate-300 font-medium">Kontaktmetod</div>
                            <div className="text-white capitalize">
                              {currentLead.contact_method === 'mail' ? 'E-post' :
                               currentLead.contact_method === 'phone' ? 'Telefon' :
                               currentLead.contact_method === 'visit' ? 'Besök' : currentLead.contact_method}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Contract Information + Notes (merged) */}
              {(currentLead.contract_status !== null || currentLead.contract_end_date || currentLead.interested_in_quote !== null || currentLead.procurement !== null || currentLead.contract_with || assignedTechnicians.length > 0 || technician || currentLead.notes) && (
                <Card className="p-4 bg-slate-800/40 border-slate-700/50 mb-4">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    Avtalsinfo
                  </h3>

                  {/* Contract Status Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                    {currentLead.contract_status !== null && (
                      <div>
                        <div className="text-slate-300 font-medium">Befintligt avtal hos kunden</div>
                        <div className={`font-medium ${currentLead.contract_status ? 'text-green-400' : 'text-red-400'}`}>
                          {currentLead.contract_status ? 'Ja' : 'Nej'}
                        </div>
                      </div>
                    )}

                    {currentLead.contract_with && (
                      <div>
                        <div className="text-slate-300 font-medium">Nuvarande leverantör</div>
                        <div className="text-white">{currentLead.contract_with}</div>
                      </div>
                    )}

                    {currentLead.contract_end_date && (
                      <div>
                        <div className="text-slate-300 font-medium">Avtal löper ut</div>
                        <div className="text-white">{formatDate(currentLead.contract_end_date)}</div>
                      </div>
                    )}
                  </div>

                  {/* Quote & Procurement Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                    {currentLead.interested_in_quote !== null && (
                      <div>
                        <div className="text-slate-300 font-medium">Intresserad av offert</div>
                        <div className={`font-medium ${currentLead.interested_in_quote ? 'text-green-400' : 'text-red-400'}`}>
                          {currentLead.interested_in_quote ? 'Ja' : 'Nej'}
                        </div>
                      </div>
                    )}

                    {currentLead.procurement !== null && (
                      <div>
                        <div className="text-slate-300 font-medium">Upphandling</div>
                        <div className={`font-medium ${currentLead.procurement ? 'text-green-400' : 'text-slate-400'}`}>
                          {currentLead.procurement ? 'Ja' : 'Nej'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assigned Colleagues Section */}
                  {(assignedTechnicians.length > 0 || technician) && (
                    <div className="mb-4">
                      <div className="text-slate-300 font-medium mb-2">Tilldelade kollegor</div>
                      <div className="space-y-2">
                        {assignedTechnicians.map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-2 border border-slate-700/40">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-7 h-7 bg-green-600/10 rounded-full">
                                <Users className="w-3.5 h-3.5 text-green-400" />
                              </div>
                              <div>
                                <div className="text-white font-medium text-sm">
                                  {assignment.technicians?.name || 'Okänd tekniker'}
                                </div>
                                {assignment.technicians?.email && (
                                  <div className="text-slate-400 text-xs">{assignment.technicians.email}</div>
                                )}
                              </div>
                            </div>
                            {assignment.is_primary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Primär
                              </span>
                            )}
                          </div>
                        ))}

                        {assignedTechnicians.length === 0 && technician && (
                          <div className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-2 border border-slate-700/40">
                            <div className="flex items-center justify-center w-7 h-7 bg-green-600/10 rounded-full">
                              <Users className="w-3.5 h-3.5 text-green-400" />
                            </div>
                            <div className="text-white font-medium text-sm">{technician}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes (merged into this card) */}
                  {currentLead.notes && (
                    <div className="border-t border-slate-700/50 pt-3 mt-3">
                      <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-green-400" />
                        Anteckningar
                      </h4>
                      <div className="text-sm">
                        <div className="text-white whitespace-pre-wrap bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
                          {currentLead.notes}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Management Components */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <LeadTechnicianManager
                    leadId={currentLead.id}
                    assignedTechnicians={assignedTechnicians}
                    onTechniciansChange={fetchLeadDetails}
                  />
                  
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
                <div className="space-y-4">
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