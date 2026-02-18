// src/components/admin/customers/CustomerContactsModal.tsx
// Kontakthanteringsmodal per kund/organisation

import { useState, useEffect } from 'react'
import { Users, Plus, Edit3, Trash2, Save, X, Search, Building2 } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import type { CustomerContact } from '../../../types/database'
import toast from 'react-hot-toast'

interface ContactFormData {
  name: string
  title: string
  responsibility_area: string
  phone: string
  email: string
  customer_id: string
}

interface CustomerContactsModalProps {
  customerId: string | null
  customerName: string
  isMultisite: boolean
  sites: Array<{ id: string; site_name?: string | null; company_name?: string }>
  isOpen: boolean
  onClose: () => void
}

const emptyForm = (customerId: string): ContactFormData => ({
  name: '',
  title: '',
  responsibility_area: '',
  phone: '',
  email: '',
  customer_id: customerId
})

export default function CustomerContactsModal({
  customerId,
  customerName,
  isMultisite,
  sites,
  isOpen,
  onClose
}: CustomerContactsModalProps) {
  const [contacts, setContacts] = useState<CustomerContact[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null)
  const [formData, setFormData] = useState<ContactFormData>(emptyForm(customerId || ''))
  const [searchTerm, setSearchTerm] = useState('')

  // All customer IDs (main + sites for multisite)
  const allCustomerIds = isMultisite
    ? sites.map(s => s.id)
    : customerId ? [customerId] : []

  // Fetch contacts
  const fetchContacts = async () => {
    if (allCustomerIds.length === 0) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .in('customer_id', allCustomerIds)
        .order('is_primary', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error: any) {
      console.error('Error fetching contacts:', error)
      toast.error('Kunde inte ladda kontakter')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && customerId) {
      fetchContacts()
      setShowForm(false)
      setEditingContact(null)
      setSearchTerm('')
    }
  }, [isOpen, customerId])

  const resetForm = () => {
    setFormData(emptyForm(customerId || ''))
    setEditingContact(null)
    setShowForm(false)
  }

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      title: contact.title || '',
      responsibility_area: contact.responsibility_area || '',
      phone: contact.phone || '',
      email: contact.email || '',
      customer_id: contact.customer_id
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Namn är obligatoriskt')
      return
    }
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        customer_id: formData.customer_id,
        name: formData.name.trim(),
        title: formData.title.trim() || null,
        responsibility_area: formData.responsibility_area.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        updated_by: user?.id || null
      }

      if (editingContact) {
        const { error } = await supabase
          .from('customer_contacts')
          .update(payload)
          .eq('id', editingContact.id)
        if (error) throw error
        toast.success('Kontakt uppdaterad')
      } else {
        const { error } = await supabase
          .from('customer_contacts')
          .insert({ ...payload, created_by: user?.id || null })
        if (error) throw error
        toast.success('Kontakt tillagd')
      }

      resetForm()
      fetchContacts()
    } catch (error: any) {
      console.error('Error saving contact:', error)
      toast.error('Kunde inte spara: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (contact: CustomerContact) => {
    if (!window.confirm(`Ta bort ${contact.name}?`)) return

    try {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contact.id)
      if (error) throw error
      toast.success('Kontakt borttagen')
      fetchContacts()
    } catch (error: any) {
      toast.error('Kunde inte ta bort: ' + error.message)
    }
  }

  if (!isOpen || !customerId) return null

  // Filter contacts by search
  const filtered = contacts.filter(c => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(s) ||
      (c.responsibility_area || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.title || '').toLowerCase().includes(s)
    )
  })

  // Group by customer_id for multisite
  const getSiteName = (cid: string) => {
    const site = sites.find(s => s.id === cid)
    return site?.site_name || site?.company_name || customerName
  }

  const groupedContacts = isMultisite
    ? allCustomerIds.reduce<Record<string, CustomerContact[]>>((acc, cid) => {
        acc[cid] = filtered.filter(c => c.customer_id === cid)
        return acc
      }, {})
    : null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#20c58f]/10 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-[#20c58f]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-white truncate">Kontaktpersoner</h2>
              <p className="text-slate-400 text-xs truncate">{customerName} — {contacts.length} kontakter</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Search + Add */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök namn, ansvarsområde, email..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none placeholder-slate-500"
              />
            </div>
            {!showForm && (
              <Button
                onClick={() => {
                  setFormData(emptyForm(customerId))
                  setEditingContact(null)
                  setShowForm(true)
                }}
                className="flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Lägg till
              </Button>
            )}
          </div>

          {/* Inline form */}
          {showForm && (
            <div className="p-3 bg-slate-800/30 border border-[#20c58f]/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {editingContact ? 'Redigera kontakt' : 'Ny kontakt'}
                </h3>
                <button onClick={resetForm} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Namn *"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="För- och efternamn"
                />
                <Input
                  label="Titel / Roll"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="T.ex. Driftchef"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Ansvarsområde"
                  value={formData.responsibility_area}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsibility_area: e.target.value }))}
                  placeholder="T.ex. Avfall, Ledningsnät"
                />
                {isMultisite && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Kopplad till enhet</label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f]"
                    >
                      {sites.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.site_name || s.company_name || 'Okänd enhet'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Telefon"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="070-123 45 67"
                />
                <Input
                  label="E-post"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="namn@example.com"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                <Button variant="secondary" onClick={resetForm} disabled={saving}>
                  Avbryt
                </Button>
                <Button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5">
                  {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
                  {editingContact ? 'Uppdatera' : 'Lägg till'}
                </Button>
              </div>
            </div>
          )}

          {/* Contact list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">
                {contacts.length === 0
                  ? 'Inga kontakter registrerade ännu.'
                  : 'Inga kontakter matchar sökningen.'}
              </p>
            </div>
          ) : isMultisite && groupedContacts ? (
            // Multisite: grouped by site
            <div className="space-y-3">
              {allCustomerIds.map(cid => {
                const siteContacts = groupedContacts[cid] || []
                if (siteContacts.length === 0 && searchTerm) return null
                return (
                  <div key={cid} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
                      <Building2 className="w-3.5 h-3.5" />
                      {getSiteName(cid)}
                      <span className="text-slate-500">({siteContacts.length})</span>
                    </h4>
                    {siteContacts.length === 0 ? (
                      <p className="text-xs text-slate-500 py-1">Inga kontakter</p>
                    ) : (
                      <div className="space-y-1.5">
                        {siteContacts.map(contact => (
                          <ContactRow
                            key={contact.id}
                            contact={contact}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // Single customer: flat list
            <div className="space-y-1.5">
              {filtered.map(contact => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-center justify-end">
          <Button variant="secondary" onClick={onClose}>
            Stäng
          </Button>
        </div>
      </div>
    </div>
  )
}

// Sub-component for a single contact row
function ContactRow({
  contact,
  onEdit,
  onDelete
}: {
  contact: CustomerContact
  onEdit: (c: CustomerContact) => void
  onDelete: (c: CustomerContact) => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-colors group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{contact.name}</span>
          {contact.title && (
            <span className="text-xs text-slate-400 truncate">{contact.title}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {contact.responsibility_area && (
            <span className="text-xs px-1.5 py-0.5 bg-[#20c58f]/10 text-[#20c58f] rounded">
              {contact.responsibility_area}
            </span>
          )}
          {contact.phone && (
            <span className="text-xs text-slate-400">{contact.phone}</span>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
            >
              {contact.email}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(contact)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          title="Redigera"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(contact)}
          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
          title="Ta bort"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
