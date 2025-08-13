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

type WizardStep = 'organization' | 'sites' | 'users' | 'roles' | 'confirmation'

// Steg 1: Endast fysisk organisationsinformation
interface OrganizationFormData {
  name: string
  organization_number: string
  billing_address: string
  billing_type: 'consolidated' | 'per_site'
}

// Steg 2: Endast fysiska platser
interface SiteFormData {
  site_name: string
  site_code: string
  address: string
  region: string
  is_primary: boolean
}

// Steg 3: Endast kontaktinformation för användare
interface UserContactData {
  id: string // Temporary ID for tracking
  name: string
  email: string
  phone: string
}

// Steg 4: Koppla användare till roller
interface UserRoleAssignment {
  userId: string
  role: MultisiteUserRoleType
  siteIds?: string[] // För platsansvariga och regionchefer
  region?: string // För regionchefer
}

export default function MultisiteRegistrationWizard({ isOpen, onClose, onSuccess }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('organization')
  const [loading, setLoading] = useState(false)
  
  // Form data states
  const [organizationData, setOrganizationData] = useState<OrganizationFormData>({
    name: '',
    organization_number: '',
    billing_address: '',
    billing_type: 'consolidated'
  })
  
  const [sites, setSites] = useState<SiteFormData[]>([])
  const [newSite, setNewSite] = useState<SiteFormData>({
    site_name: '',
    site_code: '',
    address: '',
    region: '',
    is_primary: false
  })
  
  const [users, setUsers] = useState<UserContactData[]>([])
  const [newUser, setNewUser] = useState<UserContactData>({
    id: '',
    name: '',
    email: '',
    phone: ''
  })
  
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignment[]>([])

  const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
    { key: 'organization', label: 'Organisation', icon: Building2 },
    { key: 'sites', label: 'Anläggningar', icon: MapPin },
    { key: 'users', label: 'Användare', icon: User },
    { key: 'roles', label: 'Roller', icon: Users },
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

  const handleAddUser = () => {
    if (!newUser.email || !newUser.name) {
      toast.error('Ange både namn och e-post för användaren')
      return
    }

    const userId = Date.now().toString() // Temporary ID
    const userWithId = { ...newUser, id: userId }
    
    setUsers([...users, userWithId])
    setNewUser({
      id: '',
      name: '',
      email: '',
      phone: ''
    })
    toast.success('Användare tillagd')
  }

  const handleRemoveUser = (userId: string) => {
    setUsers(users.filter(user => user.id !== userId))
    // Also remove any role assignments for this user
    setRoleAssignments(roleAssignments.filter(assignment => assignment.userId !== userId))
  }

  const handleRoleAssignment = (userId: string, role: MultisiteUserRoleType, siteIds?: string[], region?: string) => {
    const existingIndex = roleAssignments.findIndex(assignment => assignment.userId === userId)
    const newAssignment: UserRoleAssignment = { userId, role, siteIds, region }
    
    if (existingIndex >= 0) {
      const updated = [...roleAssignments]
      updated[existingIndex] = newAssignment
      setRoleAssignments(updated)
    } else {
      setRoleAssignments([...roleAssignments, newAssignment])
    }
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'organization':
        if (!organizationData.name) {
          toast.error('Organisationsnamn krävs')
          return false
        }
        if (!organizationData.billing_address) {
          toast.error('Faktureringsadress krävs')
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
      
      case 'users':
        if (users.length === 0) {
          toast.error('Lägg till minst en användare')
          return false
        }
        return true
      
      case 'roles':
        // Check that at least one user has verksamhetschef role
        const hasVerksamhetschef = roleAssignments.some(assignment => assignment.role === 'verksamhetschef')
        if (!hasVerksamhetschef) {
          toast.error('Minst en användare måste vara Verksamhetschef')
          return false
        }
        
        // Check that each site has at least one platsansvarig
        const sitesWithoutManager = sites.filter(site => {
          const siteManagers = roleAssignments.filter(assignment => 
            assignment.role === 'platsansvarig' && 
            assignment.siteIds?.includes(site.site_name) // Using site_name as temp ID
          )
          return siteManagers.length === 0
        })
        
        if (sitesWithoutManager.length > 0) {
          toast.error(`Följande anläggningar saknar platsansvarig: ${sitesWithoutManager.map(s => s.site_name).join(', ')}')`)
          return false
        }
        
        return true
      
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    
    const stepOrder: WizardStep[] = ['organization', 'sites', 'users', 'roles', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = ['organization', 'sites', 'users', 'roles', 'confirmation']
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
          organization_name: organizationData.name,
          organization_number: organizationData.organization_number || null,
          billing_type: organizationData.billing_type,
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
        is_primary: site.is_primary
      }))

      const { data: createdSites, error: sitesError } = await supabase
        .from('organization_sites')
        .insert(sitesToInsert)
        .select()

      if (sitesError) throw sitesError

      // 3. Create customer record linked to organization
      const verksamhetschef = roleAssignments.find(assignment => assignment.role === 'verksamhetschef')
      const primaryUser = users.find(user => user.id === verksamhetschef?.userId)
      
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          company_name: organizationData.name,
          organization_number: organizationData.organization_number || null,
          contact_email: primaryUser?.email || '',
          contact_phone: primaryUser?.phone || null,
          billing_email: primaryUser?.email || '',
          billing_address: organizationData.billing_address,
          organization_id: org.id,
          is_multisite: true,
          is_active: true
        })

      if (customerError) throw customerError

      // 4. Create user role assignments (would normally send emails here)
      if (roleAssignments.length > 0) {
        // Map site names to actual site IDs
        const siteNameToIdMap = new Map()
        if (createdSites) {
          createdSites.forEach((site: any) => {
            siteNameToIdMap.set(site.site_name, site.id)
          })
        }
        
        const roleInserts = roleAssignments.map(assignment => {
          const user = users.find(u => u.id === assignment.userId)
          const siteIds = assignment.siteIds?.map(siteName => siteNameToIdMap.get(siteName)).filter(Boolean) || null
          
          return {
            user_email: user?.email, // For now, store email until user accounts are created
            user_name: user?.name,
            user_phone: user?.phone,
            organization_id: org.id,
            role_type: assignment.role,
            site_ids: siteIds,
            region: assignment.region
          }
        })
        
        // In a real implementation, this would create user accounts and send invitation emails
        console.log('Would create user roles:', roleInserts)
        toast.success(`${roleAssignments.length} användarroller kommer skapas`)
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
      billing_address: '',
      billing_type: 'consolidated'
    })
    setSites([])
    setUsers([])
    setRoleAssignments([])
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
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  Organisationsuppgifter
                </h3>
                <p className="text-slate-400 text-sm">
                  Ange grundläggande information om organisationen. Kontaktpersoner läggs till i ett senare steg.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Faktureringsadress *
                  </label>
                  <textarea
                    value={organizationData.billing_address}
                    onChange={(e) => setOrganizationData({ ...organizationData, billing_address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                    placeholder="Fullständig fakturaadress..."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Faktureringstyp *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'consolidated' })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${organizationData.billing_type === 'consolidated'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                    >
                      <Receipt className="w-6 h-6 mb-2 text-yellow-400" />
                      <div className="font-medium">Konsoliderad fakturering</div>
                      <div className="text-xs mt-1 opacity-80">En sammanställd faktura för alla anläggningar</div>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setOrganizationData({ ...organizationData, billing_type: 'per_site' })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${organizationData.billing_type === 'per_site'
                          ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                    >
                      <Receipt className="w-6 h-6 mb-2 text-yellow-400" />
                      <div className="font-medium">Per anläggning</div>
                      <div className="text-xs mt-1 opacity-80">Separata fakturor för varje site</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sites Step */}
          {currentStep === 'sites' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  Anläggningar och Platser
                </h3>
                <p className="text-slate-400 text-sm">
                  Definiera alla fysiska platser som ska ingå i organisationen. Kontaktpersoner för varje plats läggs till senare.
                </p>
              </div>
              
              {/* Existing sites */}
              {sites.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    Tillagda anläggningar ({sites.length})
                  </h4>
                  {sites.map((site, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{site.site_name}</span>
                            {site.is_primary && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full font-medium">
                                Primär
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-sm">
                            Region: {site.region} {site.site_code && `• Kod: ${site.site_code}`}
                          </div>
                          {site.address && (
                            <div className="text-slate-500 text-xs">
                              {site.address}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSite(index)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Ta bort anläggning"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new site form */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Lägg till ny anläggning</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Anläggningsnamn *
                      </label>
                      <Input
                        value={newSite.site_name}
                        onChange={(e) => setNewSite({ ...newSite, site_name: e.target.value })}
                        placeholder="t.ex. Stockholm City"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Site-kod
                      </label>
                      <Input
                        value={newSite.site_code}
                        onChange={(e) => setNewSite({ ...newSite, site_code: e.target.value })}
                        placeholder="t.ex. STO01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Region *
                      </label>
                      <Input
                        value={newSite.region}
                        onChange={(e) => setNewSite({ ...newSite, region: e.target.value })}
                        placeholder="t.ex. Stockholm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Adress
                      </label>
                      <Input
                        value={newSite.address}
                        onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                        placeholder="Fullständig adress"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={newSite.is_primary}
                        onChange={(e) => setNewSite({ ...newSite, is_primary: e.target.checked })}
                        className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                      />
                      Primär anläggning (huvudkontor/centralt ansvar)
                    </label>
                    <Button
                      onClick={handleAddSite}
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Lägg till anläggning
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Users Step */}
          {currentStep === 'users' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <User className="w-5 h-5 text-green-400" />
                  Användare och Kontaktpersoner
                </h3>
                <p className="text-slate-400 text-sm">
                  Lägg till alla personer som ska ha tillgång till systemet. Roller tilldelas i nästa steg.
                </p>
              </div>
              
              {/* Existing users */}
              {users.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">
                    Tillagda användare ({users.length})
                  </h4>
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-white font-medium">{user.name}</div>
                          <div className="text-slate-400 text-sm">{user.email}</div>
                          {user.phone && (
                            <div className="text-slate-500 text-xs">{user.phone}</div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUser(user.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Ta bort användare"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new user form */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-4">Lägg till ny användare</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Namn *
                      </label>
                      <Input
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="För- och efternamn"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        E-postadress *
                      </label>
                      <Input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="namn@företag.se"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Telefonnummer
                      </label>
                      <Input
                        type="tel"
                        value={newUser.phone}
                        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                        placeholder="070-XXX XX XX"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleAddUser}
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Lägg till användare
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Roles Step */}
          {currentStep === 'roles' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <Users className="w-5 h-5 text-yellow-400" />
                  Roller och Behörigheter
                </h3>
                <p className="text-slate-400 text-sm">
                  Tilldela roller till användarna och definiera deras ansvarsområden.
                </p>
              </div>
              
              <div className="space-y-4">
                {users.map((user) => {
                  const assignment = roleAssignments.find(a => a.userId === user.id)
                  const currentRole = assignment?.role
                  
                  return (
                    <div key={user.id} className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <div>
                            <div className="text-white font-medium">{user.name}</div>
                            <div className="text-slate-400 text-sm">{user.email}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <select
                            value={currentRole || ''}
                            onChange={(e) => {
                              const role = e.target.value as MultisiteUserRoleType
                              if (role) {
                                handleRoleAssignment(user.id, role)
                              }
                            }}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            <option value="">Välj roll...</option>
                            <option value="verksamhetschef">Verksamhetschef</option>
                            <option value="regionchef">Regionchef</option>
                            <option value="platsansvarig">Platsansvarig</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Role-specific options */}
                      {currentRole === 'regionchef' && (
                        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Ansvarar för region:
                          </label>
                          <Input
                            value={assignment?.region || ''}
                            onChange={(e) => handleRoleAssignment(user.id, 'regionchef', undefined, e.target.value)}
                            placeholder="t.ex. Stockholm, Göteborg..."
                          />
                        </div>
                      )}
                      
                      {currentRole === 'platsansvarig' && (
                        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Ansvarar för anläggningar:
                          </label>
                          <div className="space-y-2">
                            {sites.map((site) => (
                              <label key={site.site_name} className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={assignment?.siteIds?.includes(site.site_name) || false}
                                  onChange={(e) => {
                                    const currentSiteIds = assignment?.siteIds || []
                                    const newSiteIds = e.target.checked
                                      ? [...currentSiteIds, site.site_name]
                                      : currentSiteIds.filter(id => id !== site.site_name)
                                    handleRoleAssignment(user.id, 'platsansvarig', newSiteIds)
                                  }}
                                  className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                                />
                                {site.site_name} ({site.region})
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Role description */}
                      {currentRole && (
                        <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                          <div className="text-blue-300 text-sm">
                            {currentRole === 'verksamhetschef' && 'Har full tillgång till alla anläggningar och kan hantera användare och inställningar.'}
                            {currentRole === 'regionchef' && 'Kan hantera anläggningar i sin region och bjuda in platsansvariga.'}
                            {currentRole === 'platsansvarig' && 'Har tillgång till sina tilldelade anläggningar och kan begära service.'}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {users.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Inga användare har lagts till ännu.</p>
                  <p className="text-sm">Gå tillbaka till föregående steg för att lägga till användare.</p>
                </div>
              )}
            </div>
          )}

          {/* Confirmation Step */}
          {currentStep === 'confirmation' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <Check className="w-5 h-5 text-green-400" />
                  Granska och Bekräfta
                </h3>
                <p className="text-slate-400 text-sm">
                  Kontrollera att all information är korrekt innan organisationen skapas.
                </p>
              </div>
              
              <div className="space-y-6">
                {/* Organization summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    Organisation
                  </h4>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500 font-medium">Namn:</dt>
                      <dd className="text-white">{organizationData.name}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Organisationsnummer:</dt>
                      <dd className="text-white">{organizationData.organization_number || 'Ej angivet'}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-slate-500 font-medium">Faktureringsadress:</dt>
                      <dd className="text-white whitespace-pre-line">{organizationData.billing_address}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Faktureringstyp:</dt>
                      <dd className="text-white">
                        {organizationData.billing_type === 'consolidated' ? 'Konsoliderad fakturering' : 'Per anläggning'}
                      </dd>
                    </div>
                  </dl>
                </div>
                
                {/* Sites summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    Anläggningar ({sites.length})
                  </h4>
                  <div className="space-y-2">
                    {sites.map((site, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{site.site_name}</span>
                            {site.is_primary && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                Primär
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-sm">
                            Region: {site.region}
                            {site.site_code && ` • Kod: ${site.site_code}`}
                            {site.address && ` • ${site.address}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Users and roles summary */}
                {users.length > 0 && (
                  <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                      <Users className="w-4 h-4 text-green-400" />
                      Användare och Roller ({users.length})
                    </h4>
                    <div className="space-y-3">
                      {users.map((user) => {
                        const assignment = roleAssignments.find(a => a.userId === user.id)
                        return (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="text-white font-medium">{user.name}</div>
                              <div className="text-slate-400 text-sm">{user.email}</div>
                              {user.phone && (
                                <div className="text-slate-500 text-xs">{user.phone}</div>
                              )}
                            </div>
                            <div className="text-right">
                              {assignment ? (
                                <div>
                                  <div className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full font-medium">
                                    {assignment.role === 'verksamhetschef' && 'Verksamhetschef'}
                                    {assignment.role === 'regionchef' && 'Regionchef'}
                                    {assignment.role === 'platsansvarig' && 'Platsansvarig'}
                                  </div>
                                  {assignment.region && (
                                    <div className="text-slate-400 text-xs mt-1">Region: {assignment.region}</div>
                                  )}
                                  {assignment.siteIds && assignment.siteIds.length > 0 && (
                                    <div className="text-slate-400 text-xs mt-1">
                                      {assignment.siteIds.length === 1 ? 'Anläggning' : 'Anläggningar'}: {assignment.siteIds.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                                  Ingen roll tilldelad
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* Warning if missing required assignments */}
                {(() => {
                  const hasVerksamhetschef = roleAssignments.some(a => a.role === 'verksamhetschef')
                  const unassignedUsers = users.filter(user => !roleAssignments.find(a => a.userId === user.id))
                  
                  if (!hasVerksamhetschef || unassignedUsers.length > 0) {
                    return (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <h4 className="text-red-300 font-medium mb-2">Uppmärksamhet krävs:</h4>
                        <ul className="text-red-200 text-sm space-y-1">
                          {!hasVerksamhetschef && (
                            <li>• Ingen användare har tilldelats rollen Verksamhetschef</li>
                          )}
                          {unassignedUsers.length > 0 && (
                            <li>• {unassignedUsers.length} användare saknar roller</li>
                          )}
                        </ul>
                      </div>
                    )
                  }
                  return null
                })()}
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