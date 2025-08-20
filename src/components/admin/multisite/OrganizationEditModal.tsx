import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { MultisiteOrganization } from '../../../types/multisite'
import {
  X,
  Building2,
  Mail,
  Phone,
  Receipt,
  MapPin,
  Save,
  Loader2
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import toast from 'react-hot-toast'

interface OrganizationEditModalProps {
  organization: MultisiteOrganization & { 
    organization_id?: string
    billing_method?: 'consolidated' | 'per_site'
    contact_email?: string
    contact_phone?: string
    billing_email?: string
  }
  onClose: () => void
  onSuccess: () => void
}

export default function OrganizationEditModal({
  organization,
  onClose,
  onSuccess
}: OrganizationEditModalProps) {
  const [loading, setLoading] = useState(false)
  
  // Konvertera billing_method till billing_type format
  const getBillingType = () => {
    // Hantera både billing_type och billing_method
    if (organization.billing_type) return organization.billing_type
    if ((organization as any).billing_method === 'consolidated') return 'consolidated'
    if ((organization as any).billing_method === 'per_site') return 'per_site'
    return 'consolidated' // default
  }
  
  const [formData, setFormData] = useState({
    name: organization.name,
    organization_number: organization.organization_number || '',
    primary_contact_email: organization.primary_contact_email || (organization as any).contact_email || (organization as any).billing_email || '',
    primary_contact_phone: organization.primary_contact_phone || (organization as any).contact_phone || '',
    billing_address: organization.billing_address || '',
    billing_type: getBillingType()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validering
      if (!formData.name.trim()) {
        toast.error('Organisationsnamn är obligatoriskt')
        setLoading(false)
        return
      }

      if (formData.primary_contact_email && !validateEmail(formData.primary_contact_email)) {
        toast.error('Ogiltig e-postadress')
        setLoading(false)
        return
      }

      // Uppdatera huvudkontor customer - använd organization_id om det finns, annars id
      const orgId = organization.organization_id || organization.id
      
      const { error } = await supabase
        .from('customers')
        .update({
          company_name: formData.name.trim(),
          organization_number: formData.organization_number.trim() || null,
          contact_email: formData.primary_contact_email.trim() || null,
          contact_phone: formData.primary_contact_phone.trim() || null,
          billing_address: formData.billing_address.trim() || null,
          billing_email: formData.primary_contact_email.trim() || null,
          billing_type: formData.billing_type,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', orgId)
        .eq('site_type', 'huvudkontor')

      if (error) throw error

      toast.success('Organisation uppdaterad')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error updating organization:', error)
      toast.error('Kunde inte uppdatera organisation')
    } finally {
      setLoading(false)
    }
  }

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Redigera organisation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Grundläggande information */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-400" />
              Grundläggande information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organisationsnamn *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="t.ex. Espresso House AB"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organisationsnummer
                </label>
                <Input
                  type="text"
                  value={formData.organization_number}
                  onChange={(e) => setFormData({ ...formData, organization_number: e.target.value })}
                  placeholder="t.ex. 556123-4567"
                />
              </div>
            </div>
          </div>

          {/* Kontaktuppgifter */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              Kontaktuppgifter
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Primär kontakt e-post
                </label>
                <Input
                  type="email"
                  value={formData.primary_contact_email}
                  onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                  placeholder="kontakt@foretag.se"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Primär kontakt telefon
                </label>
                <Input
                  type="tel"
                  value={formData.primary_contact_phone}
                  onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                  placeholder="+46 70 123 45 67"
                />
              </div>
            </div>
          </div>

          {/* Fakturering */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-400" />
              Fakturering
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Faktureringstyp
                </label>
                <select
                  value={formData.billing_type}
                  onChange={(e) => setFormData({ ...formData, billing_type: e.target.value as 'consolidated' | 'per_site' })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="consolidated">Konsoliderad fakturering</option>
                  <option value="per_site">Fakturering per anläggning</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Faktureringsadress
                </label>
                <textarea
                  value={formData.billing_address}
                  onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                  placeholder="Gatuadress&#10;Postnummer Ort"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={loading}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Spara ändringar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}