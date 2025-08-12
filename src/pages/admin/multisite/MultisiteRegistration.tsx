import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  Users,
  ArrowLeft,
  UserPlus
} from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Card from '../../../components/ui/Card'

type WizardStep = 'organization' | 'sites' | 'users' | 'billing' | 'confirmation'

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

const STEPS = [
  { key: 'organization', label: 'Organisation', icon: Building2 },
  { key: 'sites', label: 'Anläggningar', icon: MapPin },
  { key: 'users', label: 'Användare', icon: Users },
  { key: 'billing', label: 'Fakturering', icon: Receipt },
  { key: 'confirmation', label: 'Bekräftelse', icon: Check }
]

export default function MultisiteRegistration() {
  const navigate = useNavigate()
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
    role: 'verksamhetschef',
    sites: []
  })

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep)

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

    // Validate site selection based on role
    if (newInvite.role === 'regionchef' && (!newInvite.sites || newInvite.sites.length === 0)) {
      toast.error('Regionschef måste kopplas till minst en anläggning')
      return
    }

    if (newInvite.role === 'platsansvarig' && (!newInvite.sites || newInvite.sites.length === 0)) {
      toast.error('Platsansvarig måste kopplas till en anläggning')
      return
    }

    // Check for duplicate emails
    if (userInvites.some(invite => invite.email === newInvite.email)) {
      toast.error('En användare med denna e-post har redan lagts till')
      return
    }

    setUserInvites([...userInvites, newInvite])
    setNewInvite({
      email: '',
      name: '',
      role: 'verksamhetschef',
      sites: []
    })
    toast.success('Användare tillagd till inbjudningslistan')
  }

  const handleRemoveUserInvite = (index: number) => {
    setUserInvites(userInvites.filter((_, i) => i !== index))
  }

  // Silent validation for UI state (no toast messages)
  const isCurrentStepValid = (): boolean => {
    switch (currentStep) {
      case 'organization':
        return !!(organizationData.name && organizationData.primary_contact_email)
      
      case 'sites':
        return sites.length > 0 && sites.some(s => s.is_primary)
      
      case 'billing':
        return !!organizationData.billing_address
      
      case 'users':
        // Users step is always valid since users are optional
        // Verksamhetschef is created automatically from organization primary contact
        // Site managers are created from site contacts if provided
        return true
      
      default:
        return true
    }
  }

  // Validation with user feedback (shows toast messages)
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
        // Users step is always valid since it's optional
        // Verksamhetschef is created automatically from organization primary contact
        // Additional users can be added but are not required
        return true
      
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    
    const stepOrder: WizardStep[] = ['organization', 'sites', 'users', 'billing', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = ['organization', 'sites', 'users', 'billing', 'confirmation']
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

      // 4. Send user invites via API
      if (userInvites.length > 0) {
        try {
          for (const invite of userInvites) {
            const response = await fetch('/api/send-multisite-invitation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organizationId: org.id,
                email: invite.email,
                name: invite.name,
                role: invite.role,
                organizationName: organizationData.name
              })
            })

            if (!response.ok) {
              console.error('Failed to send invitation to:', invite.email)
              toast.error(`Kunde inte skicka inbjudan till ${invite.email}`)
            }
          }
          toast.success(`${userInvites.length} inbjudningar skickade!`)
        } catch (emailError) {
          console.error('Error sending invitations:', emailError)
          toast.error('Organisationen skapades men inbjudningarna kunde inte skickas')
        }
      }

      toast.success('Multisite-organisation skapad framgångsrikt!')
      navigate('/admin/multisite/organizations')
    } catch (error) {
      console.error('Error creating multisite organization:', error)
      toast.error('Kunde inte skapa organisation')
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'organization':
        return (
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Organisationsuppgifter</h2>
                <p className="text-slate-400">Grundläggande information om multisite-organisationen</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input
                    label="Organisationsnamn *"
                    value={organizationData.name}
                    onChange={(e) => setOrganizationData({ ...organizationData, name: e.target.value })}
                    placeholder="t.ex. Espresso House Sverige AB"
                    icon={<Building2 className="w-4 h-4" />}
                    required
                  />
                </div>
                
                <Input
                  label="Organisationsnummer"
                  value={organizationData.organization_number}
                  onChange={(e) => setOrganizationData({ ...organizationData, organization_number: e.target.value })}
                  placeholder="XXXXXX-XXXX"
                  icon={<Building2 className="w-4 h-4" />}
                />
                
                <div>
                  <Input
                    label="Primär kontakt e-post *"
                    type="email"
                    value={organizationData.primary_contact_email}
                    onChange={(e) => setOrganizationData({ ...organizationData, primary_contact_email: e.target.value })}
                    placeholder="kontakt@example.com"
                    icon={<Mail className="w-4 h-4" />}
                    required
                  />
                  <p className="text-sm text-slate-400 mt-1">
                    Denna e-post skapar en användare med rollen Verksamhetschef för hela organisationen.
                  </p>
                </div>
                
                <Input
                  label="Primär kontakt telefon"
                  type="tel"
                  value={organizationData.primary_contact_phone}
                  onChange={(e) => setOrganizationData({ ...organizationData, primary_contact_phone: e.target.value })}
                  placeholder="070-XXX XX XX"
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>
            </div>
          </Card>
        )

      case 'sites':
        return (
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Anläggningar/Sites</h2>
                <p className="text-slate-400">Lägg till de anläggningar som ska ingå i organisationen</p>
              </div>
              
              {/* Existing sites */}
              {sites.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-lg font-semibold text-white">Tillagda anläggningar</h3>
                  {sites.map((site, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-slate-400" />
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
                        className="p-2 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new site form */}
              <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Lägg till anläggning
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Anläggningsnamn *"
                    value={newSite.site_name}
                    onChange={(e) => setNewSite({ ...newSite, site_name: e.target.value })}
                    placeholder="Butik Malmö City"
                  />
                  <Input
                    label="Site-kod (valfritt)"
                    value={newSite.site_code}
                    onChange={(e) => setNewSite({ ...newSite, site_code: e.target.value })}
                    placeholder="MLM001"
                  />
                  <Input
                    label="Region *"
                    value={newSite.region}
                    onChange={(e) => setNewSite({ ...newSite, region: e.target.value })}
                    placeholder="Skåne"
                  />
                  <Input
                    label="Adress"
                    value={newSite.address}
                    onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                    placeholder="Storgatan 1, 211 42 Malmö"
                  />
                  <Input
                    label="Platsansvarigs e-post"
                    type="email"
                    value={newSite.contact_email}
                    onChange={(e) => setNewSite({ ...newSite, contact_email: e.target.value })}
                    placeholder="platsansvarig@example.com"
                    icon={<Mail className="w-4 h-4" />}
                  />
                  <Input
                    label="Telefonnummer"
                    type="tel"
                    value={newSite.contact_phone}
                    onChange={(e) => setNewSite({ ...newSite, contact_phone: e.target.value })}
                    placeholder="070-XXX XX XX"
                    icon={<Phone className="w-4 h-4" />}
                  />
                </div>
                <div className="md:col-span-2 -mt-2">
                  <p className="text-sm text-slate-400">
                    Här skapas en användare med rollen Platsansvarig som kopplas direkt till denna anläggning.
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
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
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )

      case 'billing':
        return (
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Receipt className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Faktureringsuppgifter</h2>
                <p className="text-slate-400">Välj faktureringsmodell och ange adress</p>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-4">
                    Faktureringstyp *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'consolidated' })}
                      className={`p-6 rounded-xl border-2 transition-all ${
                        organizationData.billing_type === 'consolidated'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <Receipt className="w-8 h-8 mx-auto mb-3" />
                      <div className="font-semibold text-lg">Konsoliderad</div>
                      <div className="text-sm mt-2 opacity-80">En faktura för alla anläggningar</div>
                    </button>
                    
                    <button
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'per_site' })}
                      className={`p-6 rounded-xl border-2 transition-all ${
                        organizationData.billing_type === 'per_site'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <Receipt className="w-8 h-8 mx-auto mb-3" />
                      <div className="font-semibold text-lg">Per anläggning</div>
                      <div className="text-sm mt-2 opacity-80">Separat faktura per site</div>
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
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Fakturaadress...&#10;Företagsnamn&#10;Gatuadress&#10;Postnummer Stad"
                    required
                  />
                </div>
              </div>
            </div>
          </Card>
        )

      case 'users':
        return (
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-yellow-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Koppla användare till anläggningar</h2>
                <p className="text-slate-400">Lägg till användare och koppla dem till de anläggningar som skapades i föregående steg</p>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Automatiskt skapade roller:</strong><br/>
                    • <strong>Verksamhetschef:</strong> Skapas från organisationens primära kontakt ({organizationData.primary_contact_email})<br/>
                    • <strong>Platsansvariga:</strong> Skapas från anläggningarnas kontaktpersoner (om angivna)<br/><br/>
                    Här kan du lägga till <strong>ytterligare användare</strong> och <strong>regionchefer</strong> som ska ha tillgång till flera anläggningar.
                  </p>
                </div>
              </div>
              
              {/* Show existing sites first */}
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold text-white">Översikt anläggningar och ansvariga</h3>
                <div className="grid gap-3">
                  {sites.map((site, index) => (
                    <div key={index} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-purple-400" />
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
                        <div className="text-right">
                          {site.contact_email ? (
                            <div className="text-sm">
                              <span className="text-green-400">✓ Platsansvarig:</span>
                              <div className="text-slate-300">{site.contact_email}</div>
                            </div>
                          ) : (
                            <span className="text-amber-400 text-sm">Ingen platsansvarig angiven</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Existing invites */}
              {userInvites.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-lg font-semibold text-white">Ytterligare användare att bjuda in</h3>
                  {userInvites.map((invite, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        {/* Role-specific icons */}
                        {invite.role === 'verksamhetschef' && <Building2 className="w-5 h-5 text-blue-400" />}
                        {invite.role === 'regionchef' && <MapPin className="w-5 h-5 text-purple-400" />}
                        {invite.role === 'platsansvarig' && <User className="w-5 h-5 text-green-400" />}
                        <div>
                          <span className="text-white font-medium">{invite.name}</span>
                          <span className="text-slate-400 text-sm ml-2">{invite.email}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              invite.role === 'verksamhetschef' ? 'bg-blue-500/20 text-blue-300' :
                              invite.role === 'regionchef' ? 'bg-purple-500/20 text-purple-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {invite.role === 'verksamhetschef' ? 'Verksamhetschef (Extra)' :
                               invite.role === 'regionchef' ? 'Regionchef' :
                               'Platsansvarig (Extra)'}
                            </span>
                            {invite.role === 'regionchef' && invite.sites && invite.sites.length > 0 && (
                              <span className="text-xs text-slate-400">
                                Regioner: {invite.sites.map(siteId => {
                                  const site = sites.find(s => s.site_name === siteId);
                                  return site ? site.region : siteId;
                                }).join(', ')}
                              </span>
                            )}
                            {invite.role === 'platsansvarig' && invite.sites && invite.sites.length > 0 && (
                              <span className="text-xs text-slate-400">
                                Anläggning: {invite.sites[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUserInvite(index)}
                        className="p-2 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new user form */}
              <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Lägg till ytterligare användare
                </h4>
                <div className="space-y-4">
                  {/* Basic user info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Namn"
                      value={newInvite.name}
                      onChange={(e) => setNewInvite({ ...newInvite, name: e.target.value })}
                      placeholder="Anna Andersson"
                      icon={<User className="w-4 h-4" />}
                    />
                    <Input
                      label="E-postadress"
                      type="email"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                      placeholder="anna@example.com"
                      icon={<Mail className="w-4 h-4" />}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Roll</label>
                      <select
                        value={newInvite.role}
                        onChange={(e) => {
                          const role = e.target.value as MultisiteUserRoleType;
                          setNewInvite({ ...newInvite, role, sites: [] });
                        }}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="verksamhetschef">Verksamhetschef (Extra)</option>
                        <option value="regionchef">Regionchef</option>
                        <option value="platsansvarig">Platsansvarig (Extra)</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Role descriptions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
                    <div className={`p-3 rounded-lg ${
                      newInvite.role === 'verksamhetschef' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-800/50'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-blue-300">Verksamhetschef (Extra)</span>
                      </div>
                      <p>Ytterligare verksamhetschef med högsta behörighet inom organisationen.</p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      newInvite.role === 'regionchef' ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-slate-800/50'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-purple-300">Regionschef</span>
                      </div>
                      <p>Ansvarig för utvalda anläggningar inom specifika regioner.</p>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      newInvite.role === 'platsansvarig' ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-800/50'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-green-300">Platsansvarig (Extra)</span>
                      </div>
                      <p>Ytterligare ansvarig för en specifik anläggning.</p>
                    </div>
                  </div>
                  
                  {/* Dynamic site selection based on role */}
                  {newInvite.role === 'regionchef' && sites.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-3">
                        Välj anläggningar (kan välja flera)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {sites.map((site, index) => (
                          <label key={index} className="flex items-center gap-2 p-2 hover:bg-slate-700/30 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newInvite.sites?.includes(site.site_name) || false}
                              onChange={(e) => {
                                const currentSites = newInvite.sites || [];
                                if (e.target.checked) {
                                  setNewInvite({ ...newInvite, sites: [...currentSites, site.site_name] });
                                } else {
                                  setNewInvite({ ...newInvite, sites: currentSites.filter(s => s !== site.site_name) });
                                }
                              }}
                              className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                            />
                            <span className="text-sm text-slate-300">{site.site_name}</span>
                            <span className="text-xs text-slate-500">({site.region})</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {newInvite.role === 'platsansvarig' && sites.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Välj anläggning
                      </label>
                      <select
                        value={newInvite.sites?.[0] || ''}
                        onChange={(e) => setNewInvite({ ...newInvite, sites: e.target.value ? [e.target.value] : [] })}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-green-500"
                      >
                        <option value="">Välj en anläggning</option>
                        {sites.map((site, index) => (
                          <option key={index} value={site.site_name}>
                            {site.site_name} ({site.region})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 text-right">
                  <Button
                    onClick={handleAddUserInvite}
                    variant="secondary"
                    className="flex items-center gap-2"
                    disabled={!newInvite.name || !newInvite.email || 
                      (newInvite.role === 'regionchef' && (!newInvite.sites || newInvite.sites.length === 0)) ||
                      (newInvite.role === 'platsansvarig' && (!newInvite.sites || newInvite.sites.length === 0))
                    }
                  >
                    <Plus className="w-4 h-4" />
                    Lägg till användare
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )

      case 'confirmation':
        return (
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Bekräfta uppgifter</h2>
                <p className="text-slate-400">Granska informationen innan organisationen skapas</p>
              </div>
              
              <div className="space-y-6">
                {/* Organization summary */}
                <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Organisation
                  </h3>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <dt className="text-slate-500">Namn:</dt>
                    <dd className="text-white font-medium">{organizationData.name}</dd>
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
                <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Anläggningar ({sites.length})
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {sites.map((site, index) => (
                      <li key={index} className="text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {site.site_name} ({site.region})
                        {site.is_primary && (
                          <span className="ml-2 text-purple-300 text-xs font-medium">[Primär]</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Users summary */}
                {userInvites.length > 0 && (
                  <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Användare att bjuda in ({userInvites.length})
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {userInvites.map((invite, index) => (
                        <li key={index} className="text-white flex items-center gap-2">
                          {invite.role === 'verksamhetschef' && <Building2 className="w-4 h-4 text-blue-400" />}
                          {invite.role === 'regionchef' && <MapPin className="w-4 h-4 text-purple-400" />}
                          {invite.role === 'platsansvarig' && <User className="w-4 h-4 text-green-400" />}
                          <div>
                            <span className="font-medium">{invite.name}</span>
                            <span className="ml-2 text-sm">
                              ({invite.role === 'verksamhetschef' ? 'Verksamhetschef (Extra)' :
                                invite.role === 'regionchef' ? 'Regionschef' :
                                'Platsansvarig (Extra)'})
                            </span>
                            <span className="text-slate-400 ml-2">({invite.email})</span>
                            {invite.sites && invite.sites.length > 0 && (
                              <div className="text-xs text-slate-500 ml-6">
                                {invite.role === 'regionchef' ? 'Anläggningar: ' : 'Anläggning: '}
                                {invite.sites.join(', ')}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="text-center pt-4">
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  size="lg"
                  className="px-8 py-3"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Skapa Organisation
                </Button>
              </div>
            </div>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header with gradient */}
      <header className="bg-gradient-to-r from-purple-900/50 to-purple-600/30 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate('/admin/dashboard')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <Building2 className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Registrera Multisite-organisation</h1>
                <p className="text-slate-300">Steg-för-steg guide för att skapa en ny organisation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = step.key === currentStep
              const isCompleted = index < currentStepIndex
              
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={`flex items-center gap-3 ${
                    isActive ? 'text-purple-300' : isCompleted ? 'text-green-400' : 'text-slate-500'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                      isActive ? 'bg-purple-500/20 border-purple-400' : 
                      isCompleted ? 'bg-green-500/20 border-green-400' : 
                      'bg-slate-800 border-slate-600'
                    }`}>
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <div className="hidden sm:block">
                      <div className="font-medium">{step.label}</div>
                      <div className="text-xs opacity-80">Steg {index + 1}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500/50' : 'bg-slate-700'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{
                duration: 0.4,
                ease: "easeInOut"
              }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 'organization'}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </Button>

          <div className="text-center">
            <p className="text-sm text-slate-400">
              Steg {currentStepIndex + 1} av {STEPS.length}
            </p>
            {!isCurrentStepValid() && currentStep !== 'confirmation' && (
              <p className="text-xs text-amber-400 mt-1">
                Fyll i obligatoriska fält för att fortsätta
              </p>
            )}
          </div>

          {currentStep !== 'confirmation' ? (
            <Button
              onClick={handleNext}
              disabled={!isCurrentStepValid()}
              className="flex items-center gap-2"
            >
              Nästa
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="w-20" /> // Placeholder för symmetri
          )}
        </div>
      </main>
    </div>
  )
}