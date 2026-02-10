// src/components/admin/leads/LeadContactsManager.tsx - Component for managing lead contacts

import React, { useState, useEffect } from 'react'
import { Users, Plus, Edit3, Trash2, Mail, Phone, User, AlertCircle, Star, Crown } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { LeadContact, LeadContactInsert, LeadContactUpdate } from '../../../types/database'

interface LeadContactsManagerProps {
  leadId: string
  contacts: LeadContact[]
  onContactsChange: () => void
}

interface ContactFormData {
  name: string
  title: string
  phone: string
  email: string
  is_primary: boolean
  notes: string
}

const LeadContactsManager: React.FC<LeadContactsManagerProps> = ({ 
  leadId, 
  contacts, 
  onContactsChange 
}) => {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<LeadContact | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Real-time subscription för lead contacts
  useEffect(() => {
    const subscription = supabase
      .channel(`lead_contacts_${leadId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'lead_contacts',
          filter: `lead_id=eq.${leadId}`
        },
        (payload) => {
          onContactsChange() // Trigger parent refresh
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [leadId, onContactsChange])
  
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    title: '',
    phone: '',
    email: '',
    is_primary: false,
    notes: ''
  })

  useEffect(() => {
    if (editingContact) {
      setFormData({
        name: editingContact.name || '',
        title: editingContact.title || '',
        phone: editingContact.phone || '',
        email: editingContact.email || '',
        is_primary: editingContact.is_primary || false,
        notes: editingContact.notes || ''
      })
      setShowForm(true)
    }
  }, [editingContact])

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      phone: '',
      email: '',
      is_primary: false,
      notes: ''
    })
    setEditingContact(null)
    setShowForm(false)
    setErrors({})
  }

  const handleInputChange = (field: keyof ContactFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Namn är obligatoriskt'
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ogiltig e-postadress'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    if (!profile?.id && !user?.id) {
      toast.error('Användarsession saknas - logga in igen')
      return
    }

    try {
      setLoading(true)

      // Clean data
      const cleanData = { ...formData }
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key as keyof typeof cleanData] === '') {
          cleanData[key as keyof typeof cleanData] = null
        }
      })

      if (editingContact) {
        // Update existing contact
        const updateData: LeadContactUpdate = {
          ...cleanData,
          updated_by: profile?.id || user.id
        } as LeadContactUpdate
        
        const { error } = await supabase
          .from('lead_contacts')
          .update(updateData)
          .eq('id', editingContact.id)

        if (error) throw error
        
        // Log automatic event for contact update
        try {
          await supabase
            .from('lead_events')
            .insert({
              lead_id: leadId,
              event_type: 'updated',
              title: `Kontaktperson uppdaterad: ${cleanData.name}`,
              description: `Kontaktperson "${cleanData.name}" har uppdaterats`,
              data: {
                contact_name: cleanData.name,
                contact_email: cleanData.email,
                contact_phone: cleanData.phone,
                is_primary: cleanData.is_primary,
                action: 'updated'
              },
              created_by: profile?.id || user.id
            })
        } catch (eventError) {
          console.warn('Could not log contact update event:', eventError)
        }
        
        toast.success('Kontaktperson uppdaterad')
      } else {
        // Create new contact
        const insertData: LeadContactInsert = {
          ...cleanData,
          lead_id: leadId,
          created_by: profile?.id || user.id,
          updated_by: profile?.id || user.id
        } as LeadContactInsert

        const { error } = await supabase
          .from('lead_contacts')
          .insert(insertData)

        if (error) throw error
        
        // Log automatic event for contact creation
        try {
          await supabase
            .from('lead_events')
            .insert({
              lead_id: leadId,
              event_type: 'created',
              title: `Ny kontaktperson tillagd: ${cleanData.name}`,
              description: `Ny kontaktperson "${cleanData.name}" tillagd`,
              data: {
                contact_name: cleanData.name,
                contact_email: cleanData.email,
                contact_phone: cleanData.phone,
                is_primary: cleanData.is_primary,
                action: 'added'
              },
              created_by: profile?.id || user.id
            })
        } catch (eventError) {
          console.warn('Could not log contact creation event:', eventError)
        }
        
        toast.success('Kontaktperson tillagd')
      }

      resetForm()
      onContactsChange()

    } catch (err) {
      console.error('Error saving contact:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara kontaktperson')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (contact: LeadContact) => {
    if (!window.confirm(`Är du säker på att du vill ta bort ${contact.name}?`)) {
      return
    }

    if (!profile?.id && !user?.id) {
      toast.error('Användarsession saknas - logga in igen')
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('lead_contacts')
        .delete()
        .eq('id', contact.id)

      if (error) throw error

      // Log automatic event for contact deletion
      try {
        await supabase
          .from('lead_events')
          .insert({
            lead_id: leadId,
            event_type: 'updated',
            title: `Kontaktperson borttagen: ${contact.name}`,
            description: `Kontaktperson "${contact.name}" har tagits bort`,
            data: {
              contact_name: contact.name,
              contact_email: contact.email,
              contact_phone: contact.phone,
              is_primary: contact.is_primary,
              action: 'deleted'
            },
            created_by: profile?.id || user?.id
          })
      } catch (eventError) {
        console.warn('Could not log contact deletion event:', eventError)
      }

      toast.success('Kontaktperson borttagen')
      onContactsChange()

    } catch (err) {
      console.error('Error deleting contact:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort kontaktperson')
    } finally {
      setLoading(false)
    }
  }

  // Separate primary and secondary contacts
  const primaryContact = contacts.find(contact => contact.is_primary)
  const secondaryContacts = contacts.filter(contact => !contact.is_primary)

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Users className="w-4 h-4 text-green-400" />
          Kontaktpersoner ({contacts.length})
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Lägg till
        </Button>
      </div>

      {/* Primary Contact Section */}
      {primaryContact && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Huvudkontakt</h4>
          </div>
          <div className="px-3 py-2 bg-gradient-to-r from-[#20c58f]/15 to-[#20c58f]/5 rounded-lg border border-[#20c58f]/30">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-white text-sm">{primaryContact.name}</h4>
                  <span className="px-2 py-0.5 text-xs bg-[#20c58f]/20 text-emerald-300 rounded-full border border-[#20c58f]/40 font-medium">
                    PRIMÄR KONTAKT
                  </span>
                </div>
                {primaryContact.title && (
                  <p className="text-emerald-200 mt-1">{primaryContact.title}</p>
                )}
                <div className="flex items-center gap-4 mt-1.5 text-sm">
                  {primaryContact.email && (
                    <div className="flex items-center gap-2 text-emerald-200">
                      <Mail className="w-4 h-4" />
                      <a href={`mailto:${primaryContact.email}`} className="hover:text-white">
                        {primaryContact.email}
                      </a>
                    </div>
                  )}
                  {primaryContact.phone && (
                    <div className="flex items-center gap-2 text-emerald-200">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${primaryContact.phone}`} className="hover:text-white">
                        {primaryContact.phone}
                      </a>
                    </div>
                  )}
                </div>
                {primaryContact.notes && (
                  <p className="text-emerald-200/80 text-sm mt-2 italic">{primaryContact.notes}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingContact(primaryContact)}
                  disabled={loading}
                  className="text-emerald-300 hover:text-white hover:bg-[#20c58f]/20"
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Contacts List */}
      {secondaryContacts.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Ytterligare kontakter ({secondaryContacts.length})
            </h4>
          </div>
          <div className="space-y-2">
            {secondaryContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/40"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{contact.name}</h4>
                  </div>
                  {contact.title && (
                    <p className="text-sm text-slate-400">{contact.title}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingContact(contact)}
                    disabled={loading}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(contact)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show message if no contacts */}
      {contacts.length === 0 && (
        <div className="text-center py-4">
          <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Inga kontaktpersoner tillagda. Klicka "Lägg till" för att börja.</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white flex items-center gap-2">
                <User className="w-4 h-4" />
                {editingContact ? 'Redigera kontaktperson' : 'Ny kontaktperson'}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Namn *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Kontaktpersonens namn"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Titel
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="t.ex. VD, Inköpschef"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Telefon
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="07X-XXX XX XX"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  E-post
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="kontakt@företag.se"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => handleInputChange('is_primary', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-green-600 focus:ring-green-500"
                />
                Primär kontaktperson
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Anteckningar
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Ytterligare information om kontaktpersonen..."
                rows={2}
                className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
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
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {editingContact ? 'Uppdaterar...' : 'Skapar...'}
                  </>
                ) : (
                  <>
                    {editingContact ? 'Uppdatera' : 'Lägg till'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {contacts.length === 0 && !showForm && (
        <div className="text-center py-4">
          <Users className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Inga kontaktpersoner tillagda. Klicka "Lägg till" för att börja.</p>
        </div>
      )}
    </div>
  )
}

export default LeadContactsManager