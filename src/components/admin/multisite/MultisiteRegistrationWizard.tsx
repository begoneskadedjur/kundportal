import React, { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { 
  MultisiteOrganization, 
  OrganizationSite,
  MultisiteUserRoleType 
} from '../../../types/multisite'
import { 
  Building2, 
  MapPin, 
  User, 
  Mail, 
  Phone, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  Receipt,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'

interface WizardProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type WizardStep = 'organization' | 'sites' | 'billing' | 'users' | 'confirmation'

interface OrganizationFormData {
  name: string
  organization_number: string
  primary_contact_email: string
  primary_contact_phone: string
  billing_address: string
  billing_type: 'consolidated' | 'per_site'
}

interface SiteFormData {
  site_name: string
  site_code: string
  address: string
  region: string
  contact_person: string
  contact_email: string
  contact_phone: string
  is_primary: boolean
}

interface UserInvite {
  email: string
  name: string
  role: MultisiteUserRoleType
  sites?: string[] // For site managers
  region?: string // For regional managers
}

export default function MultisiteRegistrationWizard({ isOpen, onClose, onSuccess }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('organization')
  const [loading, setLoading] = useState(false)
  
  // Form data states
  const [organizationData, setOrganizationData] = useState<OrganizationFormData>({
    name: '',
    organization_number: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_address: '',
    billing_type: 'consolidated'
  })
  
  const [sites, setSites] = useState<SiteFormData[]>([])
  const [newSite, setNewSite] = useState<SiteFormData>({
    site_name: '',
    site_code: '',
    address: '',
    region: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    is_primary: false
  })
  
  const [userInvites, setUserInvites] = useState<UserInvite[]>([])
  const [newInvite, setNewInvite] = useState<UserInvite>({
    email: '',
    name: '',
    role: 'quality_manager'
  })

  const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
    { key: 'organization', label: 'Organisation', icon: Building2 },
    { key: 'sites', label: 'Anläggningar', icon: MapPin },
    { key: 'billing', label: 'Fakturering', icon: Receipt },
    { key: 'users', label: 'Användare', icon: Users },
    { key: 'confirmation', label: 'Bekräftelse', icon: Check }
  ]

  const currentStepIndex = steps.findIndex(s => s.key === currentStep)

  const handleAddSite = () => {
    if (!newSite.site_name || !newSite.region) {
      toast.error('Ange minst namn och region för anläggningen')
      return
    }

    // If this is the first site, make it primary
    const isPrimary = sites.length === 0 ? true : newSite.is_primary

    // If marking as primary, unmark others
    const updatedSites = isPrimary 
      ? sites.map(s => ({ ...s, is_primary: false }))
      : sites

    setSites([...updatedSites, { ...newSite, is_primary: isPrimary }])
    setNewSite({
      site_name: '',
      site_code: '',
      address: '',
      region: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      is_primary: false
    })
    toast.success('Anläggning tillagd')
  }

  const handleRemoveSite = (index: number) => {
    const wasPrimary = sites[index].is_primary
    const newSites = sites.filter((_, i) => i !== index)
    
    // If we removed the primary site and there are others, make the first one primary
    if (wasPrimary && newSites.length > 0) {
      newSites[0].is_primary = true
    }
    
    setSites(newSites)
  }

  const handleAddUserInvite = () => {
    if (!newInvite.email || !newInvite.name) {
      toast.error('Ange både namn och e-post för användaren')
      return
    }

    setUserInvites([...userInvites, newInvite])
    setNewInvite({
      email: '',
      name: '',
      role: 'quality_manager'
    })
    toast.success('Användare tillagd till inbjudningslistan')
  }

  const handleRemoveUserInvite = (index: number) => {
    setUserInvites(userInvites.filter((_, i) => i !== index))
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'organization':
        if (!organizationData.name) {
          toast.error('Organisationsnamn krävs')
          return false
        }
        if (!organizationData.primary_contact_email) {
          toast.error('Kontakt e-post krävs')
          return false
        }
        return true
      
      case 'sites':
        if (sites.length === 0) {
          toast.error('Lägg till minst en anläggning')
          return false
        }
        if (!sites.some(s => s.is_primary)) {
          toast.error('En anläggning måste vara markerad som primär')
          return false
        }
        return true
      
      case 'billing':
        if (!organizationData.billing_address) {
          toast.error('Faktureringsadress krävs')
          return false
        }
        return true
      
      case 'users':
        // Users are optional
        return true
      
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    
    const stepOrder: WizardStep[] = ['organization', 'sites', 'billing', 'users', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = ['organization', 'sites', 'billing', 'users', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    
    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from('multisite_organizations')
        .insert({
          name: organizationData.name,
          organization_number: organizationData.organization_number || null,
          billing_type: organizationData.billing_type,
          primary_contact_email: organizationData.primary_contact_email,
          primary_contact_phone: organizationData.primary_contact_phone || null,
          billing_address: organizationData.billing_address
        })
        .select()
        .single()

      if (orgError) throw orgError

      // 2. Create sites
      const sitesToInsert = sites.map(site => ({
        organization_id: org.id,
        site_name: site.site_name,
        site_code: site.site_code || null,
        address: site.address || null,
        region: site.region,
        contact_person: site.contact_person || null,
        contact_email: site.contact_email || null,
        contact_phone: site.contact_phone || null,
        is_primary: site.is_primary
      }))

      const { error: sitesError } = await supabase
        .from('organization_sites')
        .insert(sitesToInsert)

      if (sitesError) throw sitesError

      // 3. Create customer record linked to organization
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          company_name: organizationData.name,
          organization_number: organizationData.organization_number || null,
          contact_email: organizationData.primary_contact_email,
          contact_phone: organizationData.primary_contact_phone || null,
          billing_email: organizationData.primary_contact_email,
          billing_address: organizationData.billing_address,
          organization_id: org.id,
          is_multisite: true,
          is_active: true
        })

      if (customerError) throw customerError

      // 4. Send user invites (would normally send emails here)
      if (userInvites.length > 0) {
        // In a real implementation, this would send invitation emails
        console.log('Would send invites to:', userInvites)
        toast.success(`${userInvites.length} inbjudningar kommer skickas`)
      }

      toast.success('Multisite-organisation skapad framgångsrikt!')
      onSuccess()
      handleReset()
    } catch (error) {
      console.error('Error creating multisite organization:', error)
      toast.error('Kunde inte skapa organisation')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep('organization')
    setOrganizationData({
      name: '',
      organization_number: '',
      primary_contact_email: '',
      primary_contact_phone: '',
      billing_address: '',
      billing_type: 'consolidated'
    })
    setSites([])
    setUserInvites([])
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrera Multisite-organisation" size="xl">
      <div className="bg-slate-900 rounded-xl overflow-hidden">
        {/* Header with steps */}
        <div className="bg-gradient-to-r from-purple-900/50 to-purple-600/30 p-6 border-b border-purple-500/20">
          
          {/* Step indicators */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = step.key === currentStep
              const isCompleted = index < currentStepIndex
              
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 ${
                    isActive ? 'text-purple-300' : isCompleted ? 'text-green-400' : 'text-slate-500'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      isActive ? 'bg-purple-500/20 border-purple-400' : 
                      isCompleted ? 'bg-green-500/20 border-green-400' : 
                      'bg-slate-800 border-slate-600'
                    }`}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 ${
                      isCompleted ? 'bg-green-500/50' : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Organization Step */}
          {currentStep === 'organization' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Organisationsuppgifter</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Organisationsnamn *
                  </label>
                  <Input
                    value={organizationData.name}
                    onChange={(e) => setOrganizationData({ ...organizationData, name: e.target.value })}
                    placeholder="t.ex. Espresso House Sverige AB"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Organisationsnummer
                  </label>
                  <Input
                    value={organizationData.organization_number}
                    onChange={(e) => setOrganizationData({ ...organizationData, organization_number: e.target.value })}
                    placeholder="XXXXXX-XXXX"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Primär kontakt e-post *
                  </label>
                  <Input
                    type="email"
                    value={organizationData.primary_contact_email}
                    onChange={(e) => setOrganizationData({ ...organizationData, primary_contact_email: e.target.value })}
                    placeholder="kontakt@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Primär kontakt telefon
                  </label>
                  <Input
                    type="tel"
                    value={organizationData.primary_contact_phone}
                    onChange={(e) => setOrganizationData({ ...organizationData, primary_contact_phone: e.target.value })}
                    placeholder="070-XXX XX XX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sites Step */}
          {currentStep === 'sites' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Anläggningar/Sites</h3>
              
              {/* Existing sites */}
              {sites.length > 0 && (
                <div className="space-y-2 mb-6">
                  {sites.map((site, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-white font-medium">{site.site_name}</span>
                          <span className="text-slate-400 text-sm ml-2">({site.region})</span>
                          {site.is_primary && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                              Primär
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSite(index)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new site form */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Lägg till anläggning</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={newSite.site_name}
                    onChange={(e) => setNewSite({ ...newSite, site_name: e.target.value })}
                    placeholder="Anläggningsnamn *"
                  />
                  <Input
                    value={newSite.site_code}
                    onChange={(e) => setNewSite({ ...newSite, site_code: e.target.value })}
                    placeholder="Site-kod (valfritt)"
                  />
                  <Input
                    value={newSite.region}
                    onChange={(e) => setNewSite({ ...newSite, region: e.target.value })}
                    placeholder="Region *"
                  />
                  <Input
                    value={newSite.address}
                    onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                    placeholder="Adress"
                  />
                  <Input
                    value={newSite.contact_person}
                    onChange={(e) => setNewSite({ ...newSite, contact_person: e.target.value })}
                    placeholder="Kontaktperson"
                  />
                  <Input
                    type="email"
                    value={newSite.contact_email}
                    onChange={(e) => setNewSite({ ...newSite, contact_email: e.target.value })}
                    placeholder="Kontakt e-post"
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={newSite.is_primary}
                      onChange={(e) => setNewSite({ ...newSite, is_primary: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                    />
                    Primär anläggning
                  </label>
                  <Button
                    onClick={handleAddSite}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Billing Step */}
          {currentStep === 'billing' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Faktureringsuppgifter</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Faktureringstyp *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'consolidated' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        organizationData.billing_type === 'consolidated'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <Receipt className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-medium">Konsoliderad</div>
                      <div className="text-xs mt-1 opacity-80">En faktura för alla anläggningar</div>
                    </button>
                    
                    <button
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'per_site' })}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        organizationData.billing_type === 'per_site'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <Receipt className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-medium">Per anläggning</div>
                      <div className="text-xs mt-1 opacity-80">Separat faktura per site</div>
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Faktureringsadress *
                  </label>
                  <textarea
                    value={organizationData.billing_address}
                    onChange={(e) => setOrganizationData({ ...organizationData, billing_address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Fakturaadress..."
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Users Step */}
          {currentStep === 'users' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Bjud in användare (valfritt)</h3>
              
              {/* Existing invites */}
              {userInvites.length > 0 && (
                <div className="space-y-2 mb-6">
                  {userInvites.map((invite, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <span className="text-white font-medium">{invite.name}</span>
                          <span className="text-slate-400 text-sm ml-2">{invite.email}</span>
                          <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                            {invite.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUserInvite(index)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new user form */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Lägg till användare</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={newInvite.name}
                    onChange={(e) => setNewInvite({ ...newInvite, name: e.target.value })}
                    placeholder="Namn"
                  />
                  <Input
                    type="email"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    placeholder="E-post"
                  />
                  <div>
                    <select
                      value={newInvite.role}
                      onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value as MultisiteUserRoleType })}
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="quality_manager">Quality Manager</option>
                      <option value="regional_manager">Regional Manager</option>
                      <option value="site_manager">Site Manager</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleAddUserInvite}
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Step */}
          {currentStep === 'confirmation' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-4">Bekräfta uppgifter</h3>
              
              <div className="space-y-4">
                {/* Organization summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Organisation</h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-slate-500">Namn:</dt>
                    <dd className="text-white">{organizationData.name}</dd>
                    <dt className="text-slate-500">Org.nr:</dt>
                    <dd className="text-white">{organizationData.organization_number || '-'}</dd>
                    <dt className="text-slate-500">Kontakt:</dt>
                    <dd className="text-white">{organizationData.primary_contact_email}</dd>
                    <dt className="text-slate-500">Fakturering:</dt>
                    <dd className="text-white">
                      {organizationData.billing_type === 'consolidated' ? 'Konsoliderad' : 'Per anläggning'}
                    </dd>
                  </dl>
                </div>
                
                {/* Sites summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">
                    Anläggningar ({sites.length})
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {sites.map((site, index) => (
                      <li key={index} className="text-white">
                        • {site.site_name} ({site.region})
                        {site.is_primary && (
                          <span className="ml-2 text-purple-300 text-xs">[Primär]</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Users summary */}
                {userInvites.length > 0 && (
                  <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Användare att bjuda in ({userInvites.length})
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {userInvites.map((invite, index) => (
                        <li key={index} className="text-white">
                          • {invite.name} - {invite.role.replace('_', ' ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="p-6 border-t border-slate-700 flex items-center justify-between">
          <Button
            onClick={handlePrevious}
            variant="secondary"
            disabled={currentStep === 'organization'}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </Button>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={onClose}
              variant="secondary"
            >
              Avbryt
            </Button>
            
            {currentStep === 'confirmation' ? (
              <Button
                onClick={handleSubmit}
                variant="primary"
                loading={loading}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Skapa organisation
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                variant="primary"
                className="flex items-center gap-2"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}