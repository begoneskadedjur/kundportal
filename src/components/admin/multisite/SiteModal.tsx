import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { X, Building2, Mail, Phone, MapPin, Copy, Loader2, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface SiteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organizationId: string
  organizationName: string
  parentCustomerId: string
  existingSite?: {
    id: string
    site_name: string
    site_code: string
    region: string
    organization_number?: string
    contact_person?: string
    contact_email: string
    contact_phone?: string
    contact_address?: string
    billing_email?: string
    billing_address?: string
  } | null
}

interface ParentData {
  billing_email?: string
  billing_address?: string
  contract_type?: string
  account_manager?: string
  account_manager_email?: string
  sales_person?: string
  sales_person_email?: string
}

export default function SiteModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  organizationName,
  parentCustomerId,
  existingSite
}: SiteModalProps) {
  const [loading, setLoading] = useState(false)
  const [parentData, setParentData] = useState<ParentData | null>(null)
  
  // Grundinformation
  const [siteName, setSiteName] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [region, setRegion] = useState('')
  const [organizationNumber, setOrganizationNumber] = useState('')
  
  // Kontaktinformation
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  
  // Faktureringsuppgifter
  const [billingEmail, setBillingEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [useSameBilling, setUseSameBilling] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchParentData()
      
      if (existingSite) {
        // Fyll i fält från befintlig enhet
        setSiteName(existingSite.site_name || '')
        setSiteCode(existingSite.site_code || '')
        setRegion(existingSite.region || '')
        setOrganizationNumber(existingSite.organization_number || '')
        setContactPerson(existingSite.contact_person || '')
        setContactEmail(existingSite.contact_email || '')
        setContactPhone(existingSite.contact_phone || '')
        setContactAddress(existingSite.contact_address || '')
        setBillingEmail(existingSite.billing_email || '')
        setBillingAddress(existingSite.billing_address || '')
      } else {
        // Återställ för ny enhet
        resetForm()
      }
    }
  }, [isOpen, existingSite, parentCustomerId])

  const fetchParentData = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('billing_email, billing_address, contract_type, account_manager, account_manager_email, sales_person, sales_person_email')
        .eq('id', parentCustomerId)
        .single()

      if (error) throw error
      setParentData(data)
    } catch (error) {
      console.error('Error fetching parent data:', error)
    }
  }

  const resetForm = () => {
    setSiteName('')
    setSiteCode('')
    setRegion('')
    setOrganizationNumber('')
    setContactPerson('')
    setContactEmail('')
    setContactPhone('')
    setContactAddress('')
    setBillingEmail('')
    setBillingAddress('')
    setUseSameBilling(false)
  }

  const handleCopyBilling = () => {
    if (parentData) {
      setBillingEmail(parentData.billing_email || '')
      setBillingAddress(parentData.billing_address || '')
      setUseSameBilling(true)
      toast.success('Faktureringsuppgifter kopierade från huvudkontor')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!siteName || !siteCode || !region || !contactEmail) {
      toast.error('Vänligen fyll i alla obligatoriska fält')
      return
    }

    setLoading(true)

    try {
      // Hämta organization_id från huvudkontoret
      const { data: parentOrg, error: parentError } = await supabase
        .from('customers')
        .select('organization_id, contract_type')
        .eq('id', parentCustomerId)
        .single()

      if (parentError || !parentOrg) {
        throw new Error('Kunde inte hämta organisationsinformation')
      }

      const siteData = {
        company_name: `${organizationName} - ${siteName}`,
        site_name: siteName,
        site_code: siteCode,
        region: region,
        organization_number: organizationNumber || null,
        contact_person: contactPerson || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        contact_address: contactAddress || null,
        billing_email: billingEmail || null,
        billing_address: billingAddress || null,
        organization_id: parentOrg.organization_id,
        parent_customer_id: parentCustomerId,
        is_multisite: true,
        site_type: 'enhet',
        contract_type: parentOrg.contract_type,
        contract_status: 'signed',
        is_active: true,
        source_type: 'oneflow' as const,
        // Kopiera account manager info från parent om det finns
        ...(parentData && {
          account_manager: parentData.account_manager,
          account_manager_email: parentData.account_manager_email,
          sales_person: parentData.sales_person,
          sales_person_email: parentData.sales_person_email
        })
      }

      if (existingSite) {
        // Uppdatera befintlig enhet
        const { error } = await supabase
          .from('customers')
          .update(siteData)
          .eq('id', existingSite.id)

        if (error) throw error
        toast.success('Enhet uppdaterad')
      } else {
        // Skapa ny enhet
        const { error } = await supabase
          .from('customers')
          .insert(siteData)

        if (error) {
          if (error.message?.includes('site_code')) {
            throw new Error('Enhetskoden används redan')
          }
          throw error
        }
        toast.success('Ny enhet skapad')
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Error saving site:', error)
      toast.error(error.message || 'Kunde inte spara enhet')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {existingSite ? 'Redigera enhet' : 'Lägg till ny enhet'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {organizationName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Grundinformation */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              Grundinformation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Enhetsnamn *
                </label>
                <Input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="t.ex. Stockholm City"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Enhetskod *
                </label>
                <Input
                  type="text"
                  value={siteCode}
                  onChange={(e) => setSiteCode(e.target.value.toUpperCase())}
                  placeholder="t.ex. STO01"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Region *
                </label>
                <Input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="t.ex. Stockholm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Organisationsnummer
                </label>
                <Input
                  type="text"
                  value={organizationNumber}
                  onChange={(e) => setOrganizationNumber(e.target.value)}
                  placeholder="XXXXXX-XXXX"
                />
              </div>
            </div>
          </div>

          {/* Kontaktinformation */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-green-400" />
              Kontaktinformation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Kontaktperson
                </label>
                <Input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="För- och efternamn"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Kontakt-email *
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="kontakt@foretag.se"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Telefon
                </label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="07X-XXX XX XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Adress
                </label>
                <Input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="Gatuadress, Postnr Ort"
                />
              </div>
            </div>
          </div>

          {/* Faktureringsuppgifter */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                Faktureringsuppgifter
              </h3>
              {parentData && (
                <Button
                  type="button"
                  onClick={handleCopyBilling}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" />
                  Kopiera från huvudkontor
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Faktura-email
                </label>
                <Input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="faktura@foretag.se"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Faktureringsadress
                </label>
                <Input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Fakturaadress eller referens"
                />
              </div>
            </div>
            {useSameBilling && (
              <p className="text-xs text-green-400 mt-2">
                Använder samma faktureringsuppgifter som huvudkontoret
              </p>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
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
                <Building2 className="w-4 h-4" />
                {existingSite ? 'Spara ändringar' : 'Lägg till enhet'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}