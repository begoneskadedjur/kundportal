import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { MultisiteOrganization } from '../../../types/multisite'
import {
  Building2,
  Mail,
  Save,
  Loader2,
  Shield
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Modal from '../../ui/Modal'
import toast from 'react-hot-toast'

interface OrganizationEditModalProps {
  organization: MultisiteOrganization & {
    organization_id?: string
    billing_method?: 'consolidated' | 'per_site'
    contact_email?: string
    contact_phone?: string
    billing_email?: string
    portal_access_enabled?: boolean
    portal_notifications_enabled?: boolean
    portal_access_level?: string
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

  const [formData, setFormData] = useState({
    name: organization.name,
    organization_number: organization.organization_number || '',
    primary_contact_email: organization.primary_contact_email || (organization as any).contact_email || (organization as any).billing_email || '',
    primary_contact_phone: organization.primary_contact_phone || (organization as any).contact_phone || '',
    portal_access_enabled: (organization as any).portal_access_enabled ?? true,
    portal_notifications_enabled: (organization as any).portal_notifications_enabled ?? true,
    portal_access_level: (organization as any).portal_access_level || 'full'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
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

      const orgId = organization.organization_id || organization.id

      const { error } = await supabase
        .from('customers')
        .update({
          company_name: formData.name.trim(),
          organization_number: formData.organization_number.trim() || null,
          contact_email: formData.primary_contact_email.trim() || null,
          contact_phone: formData.primary_contact_phone.trim() || null,
          billing_email: formData.primary_contact_email.trim() || null,
          portal_access_enabled: formData.portal_access_enabled,
          portal_notifications_enabled: formData.portal_notifications_enabled,
          portal_access_level: formData.portal_access_level,
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Redigera organisation"
      size="lg"
      footer={
        <div className="flex justify-end gap-3 px-4 py-2.5">
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
            form="org-edit-form"
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
      }
    >
      <form id="org-edit-form" onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Grundläggande information */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
            <Building2 className="w-4 h-4 text-[#20c58f]" />
            Grundläggande information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
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
              <label className="text-xs font-medium text-slate-400 mb-1 block">
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
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
            <Mail className="w-4 h-4 text-[#20c58f]" />
            Kontaktuppgifter
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
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
              <label className="text-xs font-medium text-slate-400 mb-1 block">
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

        {/* Portal-inställningar */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
            <Shield className="w-4 h-4 text-[#20c58f]" />
            Portal-inställningar
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.portal_access_enabled}
                onChange={(e) => setFormData({ ...formData, portal_access_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-800 border-slate-600"
              />
              <div>
                <span className="text-sm text-white">Portal-åtkomst aktiverad</span>
                <p className="text-xs text-slate-500">Kunden kan logga in på kundportalen</p>
              </div>
            </label>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">Åtkomstnivå</label>
              <select
                value={formData.portal_access_level}
                onChange={(e) => setFormData({ ...formData, portal_access_level: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
              >
                <option value="full">Full åtkomst</option>
                <option value="read_only">Endast läsning</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.portal_notifications_enabled}
                onChange={(e) => setFormData({ ...formData, portal_notifications_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-[#20c58f] focus:ring-[#20c58f] bg-slate-800 border-slate-600"
              />
              <div>
                <span className="text-sm text-white">E-postnotiser</span>
                <p className="text-xs text-slate-500">Skicka notiser vid nya ärenden och rekommendationer</p>
              </div>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  )
}
