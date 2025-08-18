import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
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
  Package,
  Calendar,
  FileText,
  Briefcase,
  UserCheck,
  CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import ProductSelector from '../ProductSelector'
import { SelectedProduct } from '../../../types/products'
import { calculateContractEndDate } from '../../../types/database'
import { formatCurrency } from '../../../utils/formatters'
import { 
  calculatePriceSummary, 
  calculateVolumeDiscount, 
  calculateSeasonalDiscount,
  formatPrice 
} from '../../../utils/pricingCalculator'

interface WizardProps {
  onSuccess?: () => void
}

type WizardStep = 'organization' | 'contract' | 'sites' | 'billing' | 'users' | 'roles' | 'confirmation'

// Steg 1: Endast fysisk organisationsinformation
interface OrganizationFormData {
  name: string
  organization_number: string
  billing_address: string
  billing_type: 'consolidated' | 'per_site'
  billing_email: string
}

// Nytt steg: Avtalsinformation
interface ContractFormData {
  contract_type: string
  contract_start_date: string
  contract_length: string // '12', '24', '36', '60' månader
  contract_end_date: string // Beräknas automatiskt
  annual_value: number
  agreement_text: string
  service_details: string
  product_summary: string
  assigned_account_manager: string
  account_manager_email: string
  sales_person: string
  sales_person_email: string
  selectedProducts: SelectedProduct[]
}

// Steg 3: Endast fysiska platser
interface SiteFormData {
  site_name: string
  site_code: string
  address: string
  region: string
  is_primary: boolean
  organization_number?: string // För per-site fakturering
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
  sites?: string[] // För regionchefer - vilka anläggningar de ansvarar för
}

export default function MultisiteRegistrationWizard({ onSuccess }: WizardProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [currentStep, setCurrentStep] = useState<WizardStep>('organization')
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<{id: string, email: string, display_name?: string}[]>([])
  const [contractTypes, setContractTypes] = useState<{id: string, name: string}[]>([])

  // Determine the correct navigation path based on user role
  const getNavigationPath = () => {
    if (profile?.role === 'admin') {
      return '/admin/dashboard'
    } else if (profile?.is_koordinator || profile?.role === 'koordinator') {
      return '/coordinator'
    }
    // Fallback to admin dashboard
    return '/admin/dashboard'
  }
  
  // Form data states
  const [organizationData, setOrganizationData] = useState<OrganizationFormData>({
    name: '',
    organization_number: '',
    billing_address: '',
    billing_type: 'consolidated',
    billing_email: ''
  })
  
  const [contractData, setContractData] = useState<ContractFormData>({
    contract_type: '',
    contract_start_date: new Date().toISOString().split('T')[0],
    contract_length: '36', // Default 3 år
    contract_end_date: '',
    annual_value: 0,
    agreement_text: '',
    service_details: '',
    product_summary: '',
    assigned_account_manager: '',
    account_manager_email: '',
    sales_person: '',
    sales_person_email: '',
    selectedProducts: []
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

  // Hämta anställda och avtalstyper vid mount
  useEffect(() => {
    fetchEmployees()
    fetchContractTypes()
  }, [])

  // Automatisk beräkning av slutdatum
  useEffect(() => {
    if (contractData.contract_start_date && contractData.contract_length) {
      const months = parseInt(contractData.contract_length)
      if (months > 0) {
        const endDate = calculateContractEndDate(contractData.contract_start_date, months)
        setContractData(prev => ({ ...prev, contract_end_date: endDate }))
      }
    }
  }, [contractData.contract_start_date, contractData.contract_length])

  // Beräkna total årspremie från valda produkter med rabatter
  useEffect(() => {
    if (contractData.selectedProducts.length > 0) {
      // Använd samma prisberäkning som för vanliga kunder
      const priceSummary = calculatePriceSummary(
        contractData.selectedProducts, 
        'company' // Multisite är alltid företagskunder
      )
      
      // Beräkna volym- och säsongsrabatter
      const volumeDiscount = calculateVolumeDiscount(contractData.selectedProducts, 'company')
      const seasonalDiscount = calculateSeasonalDiscount(contractData.selectedProducts, 'company')
      
      // Total årspremie efter alla rabatter (men före moms)
      const totalAnnualValue = priceSummary.subtotal - volumeDiscount - seasonalDiscount
      
      // Uppdatera product_summary med information om rabatter
      let productSummary = `${contractData.selectedProducts.length} produkter/tjänster`
      if (volumeDiscount > 0) {
        const totalQty = contractData.selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
        productSummary += ` | Volymrabatt (${totalQty} st): -${formatPrice(volumeDiscount)}`
      }
      if (seasonalDiscount > 0) {
        productSummary += ` | Säsongsrabatt: -${formatPrice(seasonalDiscount)}`
      }
      
      setContractData(prev => ({ 
        ...prev, 
        annual_value: totalAnnualValue,
        product_summary: productSummary
      }))
    } else {
      setContractData(prev => ({ 
        ...prev, 
        annual_value: 0,
        product_summary: ''
      }))
    }
  }, [contractData.selectedProducts])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      // Mappa till rätt format för dropdown
      const mappedEmployees = data?.map(tech => ({
        id: tech.id,
        email: tech.email || '',
        display_name: tech.name
      })) || []
      setEmployees(mappedEmployees)
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast.error('Kunde inte hämta anställda')
    }
  }

  const fetchContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_types')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error fetching contract types:', error)
      toast.error('Kunde inte hämta avtalstyper')
    }
  }

  const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
    { key: 'organization', label: 'Organisation', icon: Building2 },
    { key: 'contract', label: 'Avtal', icon: FileText },
    { key: 'sites', label: 'Anläggningar', icon: MapPin },
    { key: 'billing', label: 'Fakturering', icon: Receipt },
    { key: 'users', label: 'Användare', icon: User },
    { key: 'roles', label: 'Roller', icon: Users },
    { key: 'confirmation', label: 'Bekräftelse', icon: CheckCircle }
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

  const handleRoleAssignment = (userId: string, role: MultisiteUserRoleType, siteIds?: string[], sites?: string[]) => {
    const existingIndex = roleAssignments.findIndex(assignment => assignment.userId === userId)
    const newAssignment: UserRoleAssignment = { userId, role, siteIds, sites }
    
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
        if (!organizationData.billing_email) {
          toast.error('Fakturerings-email krävs')
          return false
        }
        return true
      
      case 'contract':
        if (!contractData.contract_type) {
          toast.error('Välj avtalstyp')
          return false
        }
        if (contractData.selectedProducts.length === 0) {
          toast.error('Välj minst en produkt')
          return false
        }
        if (!contractData.assigned_account_manager && !contractData.account_manager_email) {
          toast.error('Välj account manager')
          return false
        }
        if (!contractData.sales_person && !contractData.sales_person_email) {
          toast.error('Välj säljare')
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
        // Om per-site fakturering, kontrollera att alla sites har org.nr
        if (organizationData.billing_type === 'per_site') {
          const sitesWithoutOrgNr = sites.filter(s => !s.organization_number)
          if (sitesWithoutOrgNr.length > 0) {
            toast.error(`Organisationsnummer saknas för: ${sitesWithoutOrgNr.map(s => s.site_name).join(', ')}`)
            return false
          }
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
    
    const stepOrder: WizardStep[] = ['organization', 'contract', 'sites', 'billing', 'users', 'roles', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = ['organization', 'contract', 'sites', 'billing', 'users', 'roles', 'confirmation']
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1])
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    
    try {
      // Find the primary user (verksamhetschef)
      const verksamhetschef = roleAssignments.find(assignment => assignment.role === 'verksamhetschef')
      const primaryUser = users.find(user => user.id === verksamhetschef?.userId)
      
      // 1. Generate organization ID
      const organizationId = crypto.randomUUID()
      
      // 2. Create huvudkontor (main office) customer med all avtalsinformation
      const { data: hovedkontor, error: orgError } = await supabase
        .from('customers')
        .insert({
          company_name: organizationData.name,
          organization_number: organizationData.organization_number || null,
          contact_email: primaryUser?.email || '',
          contact_phone: primaryUser?.phone || null,
          billing_email: organizationData.billing_email || primaryUser?.email || '',
          billing_address: organizationData.billing_address,
          site_type: 'huvudkontor',
          organization_id: organizationId,
          is_multisite: true,
          contract_type: contractData.contract_type || 'multisite',
          contract_start_date: contractData.contract_start_date,
          contract_end_date: contractData.contract_end_date,
          contract_length: `${contractData.contract_length} månader`,
          annual_value: contractData.annual_value,
          total_contract_value: contractData.annual_value * (parseInt(contractData.contract_length) / 12),
          agreement_text: contractData.agreement_text,
          service_details: contractData.service_details,
          product_summary: contractData.product_summary,
          products: contractData.selectedProducts,
          assigned_account_manager: contractData.assigned_account_manager,
          account_manager_email: contractData.account_manager_email,
          sales_person: contractData.sales_person,
          sales_person_email: contractData.sales_person_email,
          is_active: true
        })
        .select()
        .single()

      if (orgError) throw orgError

      // 3. Create enhet (unit) customers med eventuella egna org.nr för fakturering
      const sitesToInsert = sites.map(site => ({
        company_name: `${organizationData.name} - ${site.site_name}`,
        site_name: site.site_name,
        site_code: site.site_code || null,
        contact_address: site.address || null,
        contact_email: '',
        region: site.region,
        site_type: 'enhet' as const,
        parent_customer_id: hovedkontor.id,
        organization_id: organizationId,
        organization_number: site.organization_number || null, // För per-site fakturering
        is_multisite: true,
        contract_type: contractData.contract_type || 'multisite',
        is_active: true
      }))

      const { data: createdSites, error: sitesError } = await supabase
        .from('customers')
        .insert(sitesToInsert)
        .select()

      if (sitesError) throw sitesError

      // 4. Create user accounts and role assignments
      if (roleAssignments.length > 0 && users.length > 0) {
        try {
          // Map site names to actual customer IDs (sites are now customers)
          const siteNameToIdMap = new Map()
          if (createdSites) {
            createdSites.forEach((customer: any) => {
              siteNameToIdMap.set(customer.site_name, customer.id)
            })
          }

          // Update role assignments with actual customer IDs (as site_ids)
          const updatedRoleAssignments = roleAssignments.map(assignment => ({
            ...assignment,
            siteIds: assignment.siteIds?.map(siteName => siteNameToIdMap.get(siteName)).filter(Boolean) || null,
            sites: assignment.sites?.map(siteName => siteNameToIdMap.get(siteName)).filter(Boolean) || null
          }))

          // Get current session token for API authentication
          const { data: { session } } = await supabase.auth.getSession()
          
          if (!session?.access_token) {
            throw new Error('No valid session found')
          }

          // Call API to create users and roles
          const userResponse = await fetch('/api/create-multisite-users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              organizationId: organizationId,
              users: users,
              roleAssignments: updatedRoleAssignments
            })
          })

          const userResult = await userResponse.json()
          
          if (!userResponse.ok) {
            console.error('User creation API error:', userResult)
            throw new Error(userResult.error || 'Failed to create users')
          }

          // Hantera resultatet baserat på summary
          if (userResult.summary) {
            const { successful, failed, total } = userResult.summary
            
            if (successful > 0) {
              toast.success(`${successful} av ${total} användare skapade och inbjudningar skickade!`)
            }
            
            if (failed > 0) {
              const errorDetails = userResult.results
                ?.filter((r: any) => !r.success)
                ?.map((r: any) => `${r.email}: ${r.error}`)
                ?.join('\n')
              
              console.error('Failed user creations:', errorDetails)
              toast.error(`${failed} användare kunde inte skapas. Se konsollen för detaljer.`)
            }
            
            if (successful === 0 && failed > 0) {
              // Om inga användare kunde skapas alls
              throw new Error('Kunde inte skapa några användare. Kontrollera användaruppgifterna.')
            }
          } else {
            // Fallback om summary inte finns
            if (userResult.success) {
              toast.success('Användare skapade!')
            } else {
              toast.error('Problem vid skapande av användare')
              console.error('User creation results:', userResult)
            }
          }
          
        } catch (error) {
          console.error('Error creating users:', error)
          toast.error('Kunde inte skapa användarkonton')
        }
      }

      toast.success('Multisite-organisation skapad framgångsrikt!')
      if (onSuccess) {
        onSuccess()
      } else {
        navigate(getNavigationPath())
      }
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
      billing_type: 'consolidated',
      billing_email: ''
    })
    setContractData({
      contract_type: '',
      contract_start_date: new Date().toISOString().split('T')[0],
      contract_length: '36',
      contract_end_date: '',
      annual_value: 0,
      agreement_text: '',
      service_details: '',
      product_summary: '',
      assigned_account_manager: '',
      account_manager_email: '',
      sales_person: '',
      sales_person_email: '',
      selectedProducts: []
    })
    setSites([])
    setUsers([])
    setRoleAssignments([])
    navigate(getNavigationPath())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate(getNavigationPath())} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-3 rounded-xl border border-purple-500/20 backdrop-blur-sm">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Registrera Multisite-organisation</h1>
                <p className="text-sm text-slate-400">Steg-för-steg guide för att skapa en ny multisite-organisation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Progress Steps */}
      <div className="bg-gradient-to-r from-purple-900/50 via-indigo-900/50 to-purple-600/30 border-b border-purple-500/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = step.key === currentStep
              const isCompleted = index < currentStepIndex
              
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <motion.div 
                    className={`flex items-center gap-3 cursor-pointer ${
                      isActive ? 'text-purple-300' : isCompleted ? 'text-green-400' : 'text-slate-500'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <motion.div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                        isActive ? 'bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border-purple-400 shadow-lg' : 
                        isCompleted ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border-green-400 shadow-lg' : 
                        'bg-slate-800/50 border-slate-600 backdrop-blur-sm'
                      }`}
                      animate={isActive ? { 
                        boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)'
                      } : {}}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                        >
                          <Check className="w-6 h-6" />
                        </motion.div>
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                    <span className="text-sm font-semibold hidden sm:inline">{step.label}</span>
                  </motion.div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-gradient-to-r from-green-500/50 to-green-400/30' : 'bg-slate-700/50'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="min-h-[600px] overflow-hidden">
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
          {/* Organization Step */}
          {currentStep === 'organization' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Organisationsuppgifter</h2>
                <p className="text-slate-400 text-lg">
                  Ange grundläggande information om organisationen. Kontaktpersoner läggs till i ett senare steg.
                </p>
              </div>
              
              <Card className="p-8 bg-slate-800/30 backdrop-blur-xl border-slate-700/50 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                      Organisationsnamn *
                    </label>
                    <Input
                      value={organizationData.name}
                      onChange={(e) => setOrganizationData({ ...organizationData, name: e.target.value })}
                      placeholder="t.ex. Espresso House Sverige AB"
                      required
                      icon={<Building2 className="w-4 h-4" />}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                      Organisationsnummer
                    </label>
                    <Input
                      value={organizationData.organization_number}
                      onChange={(e) => setOrganizationData({ ...organizationData, organization_number: e.target.value })}
                      placeholder="XXXXXX-XXXX"
                      icon={<FileText className="w-4 h-4" />}
                    />
                  </div>
                </div>
              
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                      Faktureringsadress *
                    </label>
                    <textarea
                      value={organizationData.billing_address}
                      onChange={(e) => setOrganizationData({ ...organizationData, billing_address: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                      placeholder="Fullständig fakturaadress..."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-4">
                      Faktureringstyp *
                    </label>
                    <div className="grid grid-cols-2 gap-6">
                      <motion.button
                        type="button"
                        onClick={() => setOrganizationData({ ...organizationData, billing_type: 'consolidated' })}
                        className={`p-6 rounded-xl border-2 transition-all text-left relative overflow-hidden ${organizationData.billing_type === 'consolidated'
                            ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-400 text-purple-300 shadow-lg'
                            : 'bg-slate-800/30 backdrop-blur-sm border-slate-600/50 text-slate-300 hover:border-slate-500/70'
                          }`}
                        whileHover={{ 
                          scale: 1.02
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Receipt className="w-8 h-8 text-yellow-400" />
                        </div>
                        <div className="font-semibold text-center mb-2">Konsoliderad fakturering</div>
                        <div className="text-xs text-center opacity-80">En sammanställd faktura för alla anläggningar</div>
                        {organizationData.billing_type === 'consolidated' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                            className="absolute top-4 right-4"
                          >
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          </motion.div>
                        )}
                      </motion.button>
                      
                      <motion.button
                        type="button"
                        onClick={() => setOrganizationData({ ...organizationData, billing_type: 'per_site' })}
                        className={`p-6 rounded-xl border-2 transition-all text-left relative overflow-hidden ${organizationData.billing_type === 'per_site'
                            ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-400 text-purple-300 shadow-lg'
                            : 'bg-slate-800/30 backdrop-blur-sm border-slate-600/50 text-slate-300 hover:border-slate-500/70'
                          }`}
                        whileHover={{ 
                          scale: 1.02
                        }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Receipt className="w-8 h-8 text-yellow-400" />
                        </div>
                        <div className="font-semibold text-center mb-2">Per anläggning</div>
                        <div className="text-xs text-center opacity-80">Separata fakturor för varje site</div>
                        {organizationData.billing_type === 'per_site' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.3, type: "spring", bounce: 0.5 }}
                            className="absolute top-4 right-4"
                          >
                            <CheckCircle className="w-6 h-6 text-green-500" />
                          </motion.div>
                        )}
                      </motion.button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                      Fakturerings-email *
                    </label>
                    <Input
                      type="email"
                      value={organizationData.billing_email}
                      onChange={(e) => setOrganizationData({ ...organizationData, billing_email: e.target.value })}
                      placeholder="faktura@företag.se"
                      required
                      icon={<Mail className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Contract Step */}
          {currentStep === 'contract' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Avtalsinformation</h2>
                <p className="text-slate-400 text-lg">
                  Definiera avtalsvillkor, välj produkter och tilldela ansvariga personer.
                </p>
              </div>
              
              {/* Produktväljare */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Välj produkter</h4>
                <ProductSelector
                  selectedProducts={contractData.selectedProducts}
                  onSelectionChange={(products) => setContractData({ ...contractData, selectedProducts: products })}
                  customerType="company" // Multisite är alltid företagskunder
                  className="mb-4"
                />
                
                {/* Visa prissammanfattning om produkter är valda */}
                {contractData.selectedProducts.length > 0 && (
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h5 className="text-sm font-semibold text-slate-300 mb-3">Prissammanfattning</h5>
                    {(() => {
                      const priceSummary = calculatePriceSummary(contractData.selectedProducts, 'company')
                      const volumeDiscount = calculateVolumeDiscount(contractData.selectedProducts, 'company')
                      const seasonalDiscount = calculateSeasonalDiscount(contractData.selectedProducts, 'company')
                      const totalQty = contractData.selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
                      
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-slate-400">
                            <span>Grundpris ({totalQty} tjänster):</span>
                            <span className="font-mono">{formatPrice(priceSummary.subtotal)}</span>
                          </div>
                          
                          {volumeDiscount > 0 && (
                            <div className="flex justify-between text-green-400">
                              <span>Volymrabatt:
                                {totalQty >= 10 && ' (15%)'}
                                {totalQty >= 5 && totalQty < 10 && ' (10%)'}
                                {totalQty >= 3 && totalQty < 5 && ' (5%)'}
                              </span>
                              <span className="font-mono">-{formatPrice(volumeDiscount)}</span>
                            </div>
                          )}
                          
                          {seasonalDiscount > 0 && (
                            <div className="flex justify-between text-blue-400">
                              <span>Säsongsrabatt (vinter):</span>
                              <span className="font-mono">-{formatPrice(seasonalDiscount)}</span>
                            </div>
                          )}
                          
                          <div className="border-t border-slate-600 pt-2 flex justify-between font-semibold text-white">
                            <span>Årspremie (exkl. moms):</span>
                            <span className="font-mono">{formatPrice(contractData.annual_value)}</span>
                          </div>
                          
                          <div className="text-xs text-slate-500 pt-1">
                            * Moms tillkommer med 25% för företagskunder
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
              
              {/* Avtalsinformation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Avtalstyp *
                  </label>
                  <select
                    value={contractData.contract_type}
                    onChange={(e) => setContractData({ ...contractData, contract_type: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Välj avtalstyp...</option>
                    {contractTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Avtalslängd *
                  </label>
                  <select
                    value={contractData.contract_length}
                    onChange={(e) => setContractData({ ...contractData, contract_length: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="12">1 år</option>
                    <option value="24">2 år</option>
                    <option value="36">3 år</option>
                    <option value="60">5 år</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Startdatum *
                  </label>
                  <Input
                    type="date"
                    value={contractData.contract_start_date}
                    onChange={(e) => setContractData({ ...contractData, contract_start_date: e.target.value })}
                    className="[&::-webkit-calendar-picker-indicator]:invert"
                    placeholder="ÅÅÅÅ-MM-DD"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Slutdatum (beräknas automatiskt)
                  </label>
                  <Input
                    type="date"
                    value={contractData.contract_end_date}
                    disabled
                    className="bg-slate-900/50 cursor-not-allowed [&::-webkit-calendar-picker-indicator]:invert"
                    placeholder="ÅÅÅÅ-MM-DD"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Årspremie
                  </label>
                  <Input
                    type="text"
                    value={formatCurrency(contractData.annual_value)}
                    disabled
                    className="bg-slate-900/50 cursor-not-allowed font-mono"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Beräknas från valda produkter
                    {(() => {
                      const totalQty = contractData.selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
                      if (totalQty >= 10) return ' (15% volymrabatt inkluderad)'
                      if (totalQty >= 5) return ' (10% volymrabatt inkluderad)'
                      if (totalQty >= 3) return ' (5% volymrabatt inkluderad)'
                      return ''
                    })()}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Totalt avtalsvärde
                  </label>
                  <Input
                    type="text"
                    value={formatCurrency(contractData.annual_value * (parseInt(contractData.contract_length) / 12))}
                    disabled
                    className="bg-slate-900/50 cursor-not-allowed font-mono"
                  />
                </div>
              </div>
              
              {/* Personal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Account Manager *
                  </label>
                  <select
                    value={contractData.account_manager_email || ''}
                    onChange={(e) => {
                      const employee = employees.find(emp => emp.email === e.target.value)
                      setContractData({ 
                        ...contractData, 
                        assigned_account_manager: employee?.display_name || employee?.email || '',
                        account_manager_email: employee?.email || ''
                      })
                    }}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Välj account manager...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.email}>
                        {emp.display_name || emp.email}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Säljare *
                  </label>
                  <select
                    value={contractData.sales_person_email || ''}
                    onChange={(e) => {
                      const employee = employees.find(emp => emp.email === e.target.value)
                      setContractData({ 
                        ...contractData, 
                        sales_person: employee?.display_name || employee?.email || '',
                        sales_person_email: employee?.email || ''
                      })
                    }}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Välj säljare...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.email}>
                        {emp.display_name || emp.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Avtalstexter */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Avtalsomfattning
                  </label>
                  <textarea
                    value={contractData.agreement_text}
                    onChange={(e) => setContractData({ ...contractData, agreement_text: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Beskriv vad avtalet omfattar..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Servicedetaljer
                  </label>
                  <textarea
                    value={contractData.service_details}
                    onChange={(e) => setContractData({ ...contractData, service_details: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Detaljerad beskrivning av tjänster..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sites Step */}
          {currentStep === 'sites' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Anläggningar och Platser</h2>
                <p className="text-slate-400 text-lg">
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
                        className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-green-500"
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

          {/* Billing Step */}
          {currentStep === 'billing' && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                  <Receipt className="w-5 h-5 text-yellow-400" />
                  Faktureringsuppgifter
                </h3>
                <p className="text-slate-400 text-sm">
                  {organizationData.billing_type === 'consolidated' 
                    ? 'Konsoliderad fakturering - en gemensam faktura för alla anläggningar.'
                    : 'Individuell fakturering - separata fakturor per anläggning. Ange organisationsnummer för varje enhet.'}
                </p>
              </div>
              
              {/* Visa faktureringstyp som valdes i steg 1 */}
              <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Faktureringstyp</h4>
                    <p className="text-white">
                      {organizationData.billing_type === 'consolidated' 
                        ? 'Konsoliderad fakturering' 
                        : 'Fakturering per anläggning'}
                    </p>
                  </div>
                  <Receipt className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
              
              {/* Om per-site fakturering, visa fält för org.nr per site */}
              {organizationData.billing_type === 'per_site' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-300">Organisationsnummer per anläggning</h4>
                  <p className="text-sm text-slate-400">
                    Ange organisationsnummer för varje anläggning som ska faktureras separat.
                  </p>
                  
                  {sites.map((site, index) => (
                    <div key={index} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-white font-medium">{site.site_name}</span>
                            {site.is_primary && (
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                                Primär
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Organisationsnummer *
                              </label>
                              <Input
                                value={site.organization_number || ''}
                                onChange={(e) => {
                                  const updatedSites = [...sites]
                                  updatedSites[index] = { ...site, organization_number: e.target.value }
                                  setSites(updatedSites)
                                }}
                                placeholder="XXXXXX-XXXX"
                                required={organizationData.billing_type === 'per_site'}
                              />
                            </div>
                            <div className="flex items-end">
                              <p className="text-sm text-slate-400">
                                Region: {site.region}
                                {site.site_code && ` • Kod: ${site.site_code}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Sammanfattning av faktureringsuppgifter */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="text-blue-300 font-medium mb-2">Faktureringssammanfattning</h4>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• Faktureringsadress: {organizationData.billing_address}</li>
                  <li>• Fakturerings-email: {organizationData.billing_email}</li>
                  <li>• Huvudorganisationsnummer: {organizationData.organization_number || 'Ej angivet'}</li>
                  {organizationData.billing_type === 'per_site' && (
                    <li>• Antal separata fakturor: {sites.length}</li>
                  )}
                </ul>
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
                            Ansvarar för anläggningar:
                          </label>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {sites.map((site) => (
                              <label key={site.site_name} className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={assignment?.sites?.includes(site.site_name) || false}
                                  onChange={(e) => {
                                    const currentSites = assignment?.sites || []
                                    const newSites = e.target.checked
                                      ? [...currentSites, site.site_name]
                                      : currentSites.filter(name => name !== site.site_name)
                                    handleRoleAssignment(user.id, 'regionchef', undefined, newSites)
                                  }}
                                  className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-green-500"
                                />
                                {site.site_name} ({site.region})
                              </label>
                            ))}
                          </div>
                          {sites.length === 0 && (
                            <p className="text-slate-400 text-sm">
                              Inga anläggningar har lagts till ännu. Gå tillbaka till steg 2 för att lägga till anläggningar.
                            </p>
                          )}
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
                                  className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-green-500"
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
                            {currentRole === 'regionchef' && 'Kan hantera sina tilldelade anläggningar och bjuda in platsansvariga för dessa platser.'}
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
                
                {/* Contract summary */}
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
                    <FileText className="w-4 h-4 text-green-400" />
                    Avtalsinformation
                  </h4>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500 font-medium">Avtalstyp:</dt>
                      <dd className="text-white">
                        {contractTypes.find(t => t.id === contractData.contract_type)?.name || contractData.contract_type}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Avtalslängd:</dt>
                      <dd className="text-white">{parseInt(contractData.contract_length) / 12} år</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Startdatum:</dt>
                      <dd className="text-white">{contractData.contract_start_date}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Slutdatum:</dt>
                      <dd className="text-white">{contractData.contract_end_date}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Årspremie:</dt>
                      <dd className="text-white font-mono">{formatCurrency(contractData.annual_value)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Totalt avtalsvärde:</dt>
                      <dd className="text-white font-mono">
                        {formatCurrency(contractData.annual_value * (parseInt(contractData.contract_length) / 12))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Account Manager:</dt>
                      <dd className="text-white">{contractData.assigned_account_manager}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500 font-medium">Säljare:</dt>
                      <dd className="text-white">{contractData.sales_person}</dd>
                    </div>
                  </dl>
                  
                  {/* Visa valda produkter med rabatter */}
                  {contractData.selectedProducts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <dt className="text-slate-500 font-medium text-sm mb-2">
                        Valda produkter ({contractData.selectedProducts.length}):
                      </dt>
                      <div className="space-y-1">
                        {contractData.selectedProducts.map((product, idx) => {
                          const pricing = product.product?.pricing?.company || { basePrice: product.price }
                          const unitPrice = pricing.discountPercent 
                            ? pricing.basePrice * (1 - pricing.discountPercent / 100)
                            : pricing.basePrice
                          return (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-slate-300">
                                {product.name || product.product?.name} x{product.quantity}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {formatPrice(unitPrice * product.quantity)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Visa rabatter om de finns */}
                      {(() => {
                        const volumeDiscount = calculateVolumeDiscount(contractData.selectedProducts, 'company')
                        const seasonalDiscount = calculateSeasonalDiscount(contractData.selectedProducts, 'company')
                        const totalQty = contractData.selectedProducts.reduce((sum, p) => sum + p.quantity, 0)
                        
                        if (volumeDiscount > 0 || seasonalDiscount > 0) {
                          return (
                            <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs">
                              {volumeDiscount > 0 && (
                                <div className="flex justify-between text-green-400">
                                  <span>Volymrabatt ({totalQty} tjänster):</span>
                                  <span className="font-mono">-{formatPrice(volumeDiscount)}</span>
                                </div>
                              )}
                              {seasonalDiscount > 0 && (
                                <div className="flex justify-between text-blue-400">
                                  <span>Säsongsrabatt:</span>
                                  <span className="font-mono">-{formatPrice(seasonalDiscount)}</span>
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}
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
                                  {assignment.sites && assignment.sites.length > 0 && assignment.role === 'regionchef' && (
                                    <div className="text-slate-400 text-xs mt-1">
                                      Anläggningar: {assignment.sites.join(', ')}
                                    </div>
                                  )}
                                  {assignment.siteIds && assignment.siteIds.length > 0 && assignment.role === 'platsansvarig' && (
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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <motion.div 
          className="mt-12 pt-8 border-t border-slate-700/50 flex items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={currentStep === 'organization'}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Föregående
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-slate-400 font-medium">
              Steg {currentStepIndex + 1} av {steps.length}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate(getNavigationPath())}
              variant="outline"
            >
              Avbryt
            </Button>
            
            {currentStep === 'confirmation' ? (
              <Button
                onClick={handleSubmit}
                variant="primary"
                loading={loading}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                size="lg"
              >
                <CheckCircle className="w-5 h-5" />
                Skapa organisation
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                variant="primary"
                className="flex items-center gap-2"
                size="lg"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}