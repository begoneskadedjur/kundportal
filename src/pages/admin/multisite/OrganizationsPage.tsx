import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { PageHeader } from '../../../components/shared'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import toast from 'react-hot-toast'
import { 
  Building2, 
  Users, 
  MapPin, 
  Edit2, 
  Trash2, 
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
  UserPlus,
  Shield,
  UserCheck,
  Key
} from 'lucide-react'
import Input from '../../../components/ui/Input'
import OrganizationEditModal from '../../../components/admin/multisite/OrganizationEditModal'
import UserModal from '../../../components/admin/multisite/UserModal'
import SiteModal from '../../../components/admin/multisite/SiteModal'
import CompactOrganizationTable from '../../../components/admin/multisite/CompactOrganizationTable'
import { useAuth } from '../../../contexts/AuthContext'

interface Organization {
  id: string
  name: string
  organization_number: string
  organization_id?: string
  billing_address: string
  billing_email: string
  billing_method: 'consolidated' | 'per_site'
  is_active: boolean
  created_at: string
  updated_at: string
  sites_count?: number
  users_count?: number
  activeUsersCount?: number
  total_value?: number
  // Organisationstyp för unified view
  organizationType?: 'multisite' | 'single'
  // Avtalsinfo
  contract_type?: string
  contract_end_date?: string
  contract_length?: number
  annual_value?: number
  monthly_value?: number
  account_manager?: string
  account_manager_email?: string
  sales_person?: string
  sales_person_email?: string
  // Enheter
  sites?: any[]
  contact_phone?: string
  contact_person?: string
  // Trafikljusdata
  worstPestLevel?: number | null
  worstProblemRating?: number | null
  unacknowledgedCount?: number
  criticalCasesCount?: number
  warningCasesCount?: number
}

interface OrganizationUser {
  id: string
  user_id: string
  organization_id: string
  role_type: string
  is_active: boolean
  created_at: string
  email?: string
  name?: string
  phone?: string
  site_ids?: string[]
}

interface OrganizationSite {
  id: string
  site_name: string
  site_code: string
  region: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  billing_email?: string
  is_active: boolean
}

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])
  const [organizationUsers, setOrganizationUsers] = useState<Record<string, OrganizationUser[]>>({})
  const [organizationSites, setOrganizationSites] = useState<Record<string, OrganizationSite[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null)
  const [showSiteModal, setShowSiteModal] = useState(false)
  const [editingSite, setEditingSite] = useState<OrganizationSite | null>(null)

  // Hjälpfunktion för att beräkna dagar kvar på avtal
  const getDaysUntilContractEnd = (endDate: string | undefined) => {
    if (!endDate) return null
    
    const today = new Date()
    const contractEnd = new Date(endDate)
    const diffTime = contractEnd.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  // Hjälpfunktion för att formattera avtalslängd med enheter
  const formatContractLength = (length: number | string | null | undefined) => {
    if (!length) return '-'
    
    // Om längden är redan en sträng med enhet, returnera den direkt
    if (typeof length === 'string') {
      // Om strängen redan innehåller "år" eller "månader"/"mån", behåll som den är
      if (length.includes('år') || length.includes('månader') || length.includes('mån')) {
        return length
      }
      
      // Om det är bara en siffra som sträng, försök konvertera
      const numValue = parseInt(length, 10)
      if (isNaN(numValue)) return length // Om konvertering misslyckas, returnera ursprunglig sträng
      
      // För enskilda siffror som sträng, anta att det är år (vanliga avtal)
      return `${numValue} år`
    }
    
    // Om längden är ett nummer
    if (typeof length === 'number') {
      // Om längden är 12 eller större, anta att det är månader och konvertera till år
      if (length >= 12 && length % 12 === 0) {
        const years = length / 12
        return `${years} år`
      }
      
      // Annars visa som månader
      return `${length} mån`
    }
    
    return '-'
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  useEffect(() => {
    // Filtrera och sortera organisationer
    let filtered = searchTerm
      ? organizations.filter(org => 
          org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          org.organization_number.includes(searchTerm) ||
          org.billing_email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [...organizations]

    // Smart sortering: Kritiska först, sedan varningar, sedan resten
    filtered.sort((a, b) => {
      // Prioritet 1: Kritiska ärenden
      if (a.criticalCasesCount > 0 && b.criticalCasesCount === 0) return -1
      if (b.criticalCasesCount > 0 && a.criticalCasesCount === 0) return 1
      
      // Prioritet 2: Obekräftade rekommendationer
      if (a.unacknowledgedCount > 0 && b.unacknowledgedCount === 0) return -1
      if (b.unacknowledgedCount > 0 && a.unacknowledgedCount === 0) return 1
      
      // Prioritet 3: Varningar
      if (a.warningCasesCount > 0 && b.warningCasesCount === 0) return -1
      if (b.warningCasesCount > 0 && a.warningCasesCount === 0) return 1
      
      // Prioritet 4: Inaktiva sist
      if (a.is_active && !b.is_active) return -1
      if (!a.is_active && b.is_active) return 1
      
      // Slutligen: Alphabetisk sortering på namn
      return a.name.localeCompare(b.name, 'sv-SE')
    })

    setFilteredOrganizations(filtered)
  }, [searchTerm, organizations])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Hämta båda typer av kunder parallellt för bästa prestanda
      const [multisiteOrgs, singleCustomers] = await Promise.all([
        fetchMultisiteOrganizations(),
        fetchSingleCustomers()
      ])

      // Kombinera och sätt organisationer
      const allOrganizations = [...multisiteOrgs, ...singleCustomers]
      setOrganizations(allOrganizations)
      setFilteredOrganizations(allOrganizations)
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Kunde inte hämta organisationer')
    } finally {
      setLoading(false)
    }
  }

  const fetchMultisiteOrganizations = async (): Promise<Organization[]> => {
    try {
      // Hämta multisite organisationer (huvudkontor från customers)
      const { data: orgs, error: orgsError } = await supabase
        .from('customers')
        .select('*')
        .eq('site_type', 'huvudkontor')
        .eq('is_multisite', true)
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      if (!orgs || orgs.length === 0) {
        return []
      }

      // Hämta statistik för varje organisation
      const orgsWithStats = await Promise.all(orgs.map(async (org) => {
        // Hämta antal sites (enheter från customers)
        const { count: sitesCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.organization_id)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)
          .eq('is_active', true)

        // Hämta enheter med fullständig info
        const { data: sites } = await supabase
          .from('customers')
          .select('*')
          .eq('organization_id', org.organization_id)
          .eq('site_type', 'enhet')
          .eq('is_multisite', true)
          .order('region', { ascending: true })
          .order('site_name', { ascending: true })

        // Hämta antal användare och räkna aktiva användare
        const { count: usersCount } = await supabase
          .from('multisite_user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.organization_id)

        // Hämta aktiva användare (de som har profiles och har loggat in)
        const { data: activeUsers } = await supabase
          .from('multisite_user_roles')
          .select(`
            *,
            profiles!inner (
              last_sign_in_at,
              email_verified,
              last_login
            )
          `)
          .eq('organization_id', org.organization_id)

        // Hämta trafikljusdata för alla enheter i organisationen
        let worstPestLevel: number | null = null
        let worstProblemRating: number | null = null
        let unacknowledgedCount = 0
        let criticalCasesCount = 0
        let warningCasesCount = 0

        if (sites && sites.length > 0) {
          const siteIds = sites.map(s => s.id)
          
          // Hämta alla cases för organisationens enheter
          const { data: cases } = await supabase
            .from('cases')
            .select('pest_level, problem_rating, recommendations, recommendations_acknowledged')
            .in('customer_id', siteIds)

          if (cases) {
            cases.forEach(caseItem => {
              // Uppdatera värsta nivåer
              if (caseItem.pest_level !== null) {
                if (worstPestLevel === null || caseItem.pest_level > worstPestLevel) {
                  worstPestLevel = caseItem.pest_level
                }
              }
              
              if (caseItem.problem_rating !== null) {
                if (worstProblemRating === null || caseItem.problem_rating > worstProblemRating) {
                  worstProblemRating = caseItem.problem_rating
                }
              }

              // Räkna kritiska och varningar
              const pest = caseItem.pest_level ?? -1
              const problem = caseItem.problem_rating ?? -1
              
              if (pest >= 3 || problem >= 4) {
                criticalCasesCount++
              } else if (pest === 2 || problem === 3) {
                warningCasesCount++
              }

              // Räkna obekräftade rekommendationer
              if (caseItem.recommendations && !caseItem.recommendations_acknowledged) {
                unacknowledgedCount++
              }
            })
          }
        }

        return {
          id: org.id,
          name: org.company_name,
          organization_number: org.organization_number || '',
          billing_address: org.billing_address || org.contact_address || '',
          billing_email: org.billing_email || org.contact_email || '',
          billing_method: (org.billing_type || 'consolidated') as 'consolidated' | 'per_site',
          is_active: org.is_active !== false,
          created_at: org.created_at,
          updated_at: org.updated_at,
          organization_id: org.organization_id,
          organizationType: 'multisite' as const,
          sites_count: sitesCount || 0,
          users_count: usersCount || 0,
          activeUsersCount: activeUsers?.length || 0,
          total_value: org.total_contract_value || 0,
          // Avtalsinfo
          contract_type: org.contract_type,
          contract_end_date: org.contract_end_date,
          contract_length: org.contract_length,
          annual_value: org.annual_value || 0,
          monthly_value: org.monthly_value || 0,
          account_manager: org.assigned_account_manager,
          account_manager_email: org.account_manager_email,
          sales_person: org.sales_person,
          sales_person_email: org.sales_person_email,
          // Kontaktinfo
          contact_phone: org.contact_phone,
          contact_person: org.contact_person,
          // Enheter
          sites: sites || [],
          // Trafikljusdata
          worstPestLevel,
          worstProblemRating,
          unacknowledgedCount,
          criticalCasesCount,
          warningCasesCount
        }
      }))

      return orgsWithStats
    } catch (error) {
      console.error('Error fetching multisite organizations:', error)
      return []
    }
  }

  const fetchSingleCustomers = async (): Promise<Organization[]> => {
    try {
      // Hämta vanliga kunder (is_multisite = false)
      const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_multisite', false)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (!customers || customers.length === 0) {
        return []
      }

      // Hämta trafikljusdata för varje kund
      const customersWithStats = await Promise.all(customers.map(async (customer) => {
        // Hämta cases för denna kund
        const { data: cases } = await supabase
          .from('cases')
          .select('pest_level, problem_rating, recommendations, recommendations_acknowledged')
          .eq('customer_id', customer.id)

        // Hämta portal access information för denna kund
        const { data: profiles } = await supabase
          .from('profiles')
          .select('last_sign_in_at, email_verified, last_login')
          .eq('customer_id', customer.id)

        let worstPestLevel: number | null = null
        let worstProblemRating: number | null = null
        let unacknowledgedCount = 0
        let criticalCasesCount = 0
        let warningCasesCount = 0

        if (cases) {
          cases.forEach(caseItem => {
            // Uppdatera värsta nivåer
            if (caseItem.pest_level !== null) {
              if (worstPestLevel === null || caseItem.pest_level > worstPestLevel) {
                worstPestLevel = caseItem.pest_level
              }
            }
            
            if (caseItem.problem_rating !== null) {
              if (worstProblemRating === null || caseItem.problem_rating > worstProblemRating) {
                worstProblemRating = caseItem.problem_rating
              }
            }

            // Räkna kritiska och varningar
            const pest = caseItem.pest_level ?? -1
            const problem = caseItem.problem_rating ?? -1
            
            if (pest >= 3 || problem >= 4) {
              criticalCasesCount++
            } else if (pest === 2 || problem === 3) {
              warningCasesCount++
            }

            // Räkna obekräftade rekommendationer
            if (caseItem.recommendations && !caseItem.recommendations_acknowledged) {
              unacknowledgedCount++
            }
          })
        }

        return {
          id: customer.id,
          name: customer.company_name || customer.contact_person || 'Okänt namn',
          organization_number: customer.organization_number || '',
          billing_address: customer.billing_address || customer.contact_address || '',
          billing_email: customer.billing_email || customer.contact_email || '',
          billing_method: 'consolidated' as const,
          is_active: customer.is_active !== false,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
          organization_id: undefined,
          organizationType: 'single' as const,
          sites_count: 0, // Vanliga kunder har inga sites
          users_count: profiles?.length || 0,
          activeUsersCount: profiles?.filter(p => p.last_sign_in_at || p.last_login || p.email_verified).length || 0,
          total_value: customer.total_contract_value || 0,
          // Avtalsinfo
          contract_type: customer.contract_type,
          contract_end_date: customer.contract_end_date,
          contract_length: customer.contract_length,
          annual_value: customer.annual_value || 0,
          monthly_value: customer.monthly_value || 0,
          account_manager: customer.assigned_account_manager,
          account_manager_email: customer.account_manager_email,
          sales_person: customer.sales_person,
          sales_person_email: customer.sales_person_email,
          // Kontaktinfo
          contact_phone: customer.contact_phone,
          contact_person: customer.contact_person,
          // Enheter (inga för single customers)
          sites: [],
          // Trafikljusdata
          worstPestLevel,
          worstProblemRating,
          unacknowledgedCount,
          criticalCasesCount,
          warningCasesCount
        }
      }))

      return customersWithStats
    } catch (error) {
      console.error('Error fetching single customers:', error)
      return []
    }
  }

  const handleDeleteOrganization = async (org: Organization) => {
    if (!confirm(`Är du säker på att du vill ta bort ${org.name}? Detta kommer även ta bort alla anläggningar och användare.`)) {
      return
    }

    try {
      // Först måste vi hämta organization_id från huvudkontoret
      const { data: huvudkontor, error: hkError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', org.id)
        .eq('site_type', 'huvudkontor')
        .single()

      if (hkError || !huvudkontor) {
        throw new Error('Kunde inte hitta organisation')
      }

      const organizationId = huvudkontor.organization_id

      // 1. Ta bort alla enheter först (de har parent_customer_id som pekar på huvudkontoret)
      const { error: sitesError } = await supabase
        .from('customers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('site_type', 'enhet')

      if (sitesError) {
        console.error('Error deleting sites:', sitesError)
        throw new Error('Kunde inte ta bort enheter')
      }

      // 2. Ta bort alla användare/roller
      const { error: rolesError } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('organization_id', organizationId)

      if (rolesError) {
        console.error('Error deleting user roles:', rolesError)
        // Fortsätt ändå, detta är inte kritiskt
      }

      // 3. Nu kan vi ta bort huvudkontoret
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', org.id)
        .eq('site_type', 'huvudkontor')

      if (deleteError) throw deleteError

      toast.success('Organisation och alla relaterade data borttagna')
      fetchOrganizations()
    } catch (error) {
      console.error('Error deleting organization:', error)
      toast.error('Kunde inte ta bort organisation')
    }
  }

  const handleToggleActive = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !org.is_active })
        .eq('id', org.id)

      if (error) throw error

      toast.success(`Organisation ${org.is_active ? 'inaktiverad' : 'aktiverad'}`)
      fetchOrganizations()
    } catch (error) {
      console.error('Error toggling organization:', error)
      toast.error('Kunde inte uppdatera organisation')
    }
  }

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrg(org)
    setShowEditModal(true)
  }

  const handleViewDetails = (orgId: string) => {
    // Navigate to the management page with the organization details
    const basePath = profile?.role === 'admin' ? '/admin' : '/koordinator'
    navigate(`${basePath}/organisation/organizations-manage`, { state: { selectedOrgId: orgId } })
  }

  const fetchOrganizationUsers = async (orgId: string, organizationId: string) => {
    try {
      // Använd säker RPC-funktion istället för multisite_users_complete VIEW
      const { data: users, error } = await supabase
        .rpc('get_organization_users_complete', { 
          org_id: organizationId 
        })

      if (error) throw error

      // Data kommer redan formaterad från RPC-funktionen
      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        user_id: user.user_id,
        organization_id: user.organization_id,
        role_type: user.role_type,
        site_ids: user.site_ids,
        region: user.region,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        email: user.email || 'Okänd email',
        name: user.display_name || 'Okänt namn',
        phone: user.phone || null,
        last_sign_in_at: user.last_sign_in_at
      }))

      setOrganizationUsers(prev => ({
        ...prev,
        [orgId]: formattedUsers
      }))
    } catch (error) {
      console.error('Error fetching organization users:', error)
      toast.error('Kunde inte hämta användare')
    }
  }

  const handleToggleExpand = async (org: Organization) => {
    if (expandedOrgId === org.id) {
      setExpandedOrgId(null)
    } else {
      setExpandedOrgId(org.id)
      // Hämta användare och enheter om vi inte redan har dem
      if (org.organization_id) {
        if (!organizationUsers[org.id]) {
          await fetchOrganizationUsers(org.id, org.organization_id)
        }
        if (!organizationSites[org.id]) {
          await fetchOrganizationSites(org.id, org.organization_id)
        }
      }
    }
  }

  const handleAddUser = (org: Organization) => {
    setSelectedOrg(org)
    setEditingUser(null)
    setShowUserModal(true)
  }

  const handleEditUser = (org: Organization, user: OrganizationUser) => {
    setSelectedOrg(org)
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleDeleteUser = async (orgId: string, userId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna användare?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      toast.success('Användare borttagen')
      
      // Uppdatera lokal state
      setOrganizationUsers(prev => ({
        ...prev,
        [orgId]: prev[orgId].filter(u => u.id !== userId)
      }))
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Kunde inte ta bort användare')
    }
  }

  const fetchOrganizationSites = async (orgId: string, organizationId: string) => {
    try {
      const { data: sites, error } = await supabase
        .from('customers')
        .select('id, site_name, site_code, region, contact_person, contact_email, contact_phone, billing_email, is_active')
        .eq('organization_id', organizationId)
        .eq('site_type', 'enhet')
        .eq('is_multisite', true)
        .order('site_name', { ascending: true })

      if (error) throw error

      const formattedSites = (sites || []).map(site => ({
        id: site.id,
        site_name: site.site_name || '',
        site_code: site.site_code || '',
        region: site.region || '',
        contact_person: site.contact_person || undefined,
        contact_email: site.contact_email || undefined,
        contact_phone: site.contact_phone || undefined,
        billing_email: site.billing_email || undefined,
        is_active: site.is_active
      }))

      setOrganizationSites(prev => ({
        ...prev,
        [orgId]: formattedSites
      }))
    } catch (error) {
      console.error('Error fetching organization sites:', error)
      toast.error('Kunde inte hämta enheter')
    }
  }

  const handleAddSite = (org: Organization) => {
    setSelectedOrg(org)
    setEditingSite(null)
    setShowSiteModal(true)
  }

  const handleEditSite = (org: Organization, site: OrganizationSite) => {
    setSelectedOrg(org)
    setEditingSite(site)
    setShowSiteModal(true)
  }

  const handleDeleteSite = async (orgId: string, siteId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna enhet?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', siteId)

      if (error) throw error

      toast.success('Enhet borttagen')
      
      // Uppdatera lokal state
      setOrganizationSites(prev => ({
        ...prev,
        [orgId]: prev[orgId].filter(s => s.id !== siteId)
      }))
      
      // Uppdatera sites_count i organisations-listan
      setOrganizations(prev => prev.map(org => 
        org.id === orgId 
          ? { ...org, sites_count: (org.sites_count || 1) - 1 }
          : org
      ))
    } catch (error) {
      console.error('Error deleting site:', error)
      toast.error('Kunde inte ta bort enhet')
    }
  }

  const handleResetPassword = async (email: string, userName: string) => {
    if (!confirm(`Vill du skicka lösenordsåterställning till ${userName}?`)) {
      return
    }

    try {
      // Använd vår egen API med Resend för snyggare e-postmallar
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte skicka återställningsmail')
      }

      toast.success(`Lösenordsåterställning skickad till ${email}`)
    } catch (error: any) {
      console.error('Error sending password reset:', error)
      toast.error(error.message || 'Kunde inte skicka lösenordsåterställning')
    }
  }

  const getRoleName = (roleType: string) => {
    const roleNames: Record<string, string> = {
      'verksamhetschef': 'Verksamhetschef',
      'quality_manager': 'Verksamhetschef',
      'regionchef': 'Regionchef',
      'regional_manager': 'Regionchef',
      'platsansvarig': 'Platsansvarig',
      'site_manager': 'Platsansvarig'
    }
    return roleNames[roleType] || roleType
  }

  const handleInviteToPortal = async (org: Organization) => {
    if (!confirm(`Vill du bjuda in ${org.name} till kundportalen?`)) {
      return
    }

    try {
      // För vanliga avtalskunder, använd create-customer API:et
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          company_name: org.name,
          contact_person: org.contact_person,
          contact_email: org.billing_email,
          contact_phone: org.contact_phone,
          customer_id: org.id,
          skip_customer_creation: true // Kunden finns redan, bara skicka inbjudan
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Kunde inte skicka inbjudan')
      }

      toast.success(`Portal-inbjudan skickad till ${org.billing_email}`)
      // Uppdatera organisationer för att reflektera ny portal status
      fetchOrganizations()
    } catch (error: any) {
      console.error('Error sending portal invitation:', error)
      toast.error(error.message || 'Kunde inte skicka inbjudan till portal')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Organisationer & Kunder" 
          description="Hantera alla avtalskunder - både multisite-organisationer och vanliga kunder"
        />

        {/* Actions Bar */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Sök organisation, org.nr eller e-post..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => navigate('/admin/organisation/register')}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ny Organisation
            </Button>
          </div>

          {/* Snabbfilter för prioriterade organisationer */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-slate-400 py-2">Snabbfilter:</span>
            
            {/* Organisationstyp filter */}
            <button 
              className="px-3 py-1 text-xs bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              onClick={() => {
                const multisiteOrgs = organizations.filter(org => org.organizationType === 'multisite')
                setFilteredOrganizations(multisiteOrgs)
              }}
            >
              🏢 {organizations.filter(org => org.organizationType === 'multisite').length} multisite-organisationer
            </button>
            <button 
              className="px-3 py-1 text-xs bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
              onClick={() => {
                const singleOrgs = organizations.filter(org => org.organizationType === 'single')
                setFilteredOrganizations(singleOrgs)
              }}
            >
              👤 {organizations.filter(org => org.organizationType === 'single').length} vanliga kunder
            </button>
            
            {/* Problem-baserade filter */}
            <button 
              className="px-3 py-1 text-xs bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              onClick={() => {
                const criticalOrgs = organizations.filter(org => org.criticalCasesCount > 0)
                setFilteredOrganizations(criticalOrgs)
              }}
            >
              🔴 {organizations.filter(org => org.criticalCasesCount > 0).length} med kritiska ärenden
            </button>
            <button 
              className="px-3 py-1 text-xs bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
              onClick={() => {
                const unconfirmedOrgs = organizations.filter(org => org.unacknowledgedCount > 0)
                setFilteredOrganizations(unconfirmedOrgs)
              }}
            >
              ⚠️ {organizations.filter(org => org.unacknowledgedCount > 0).length} med obekräftade
            </button>
            
            {/* Status filter */}
            <button 
              className="px-3 py-1 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              onClick={() => {
                const inactiveOrgs = organizations.filter(org => !org.is_active)
                setFilteredOrganizations(inactiveOrgs)
              }}
            >
              🚫 {organizations.filter(org => !org.is_active).length} inaktiva
            </button>
            <button 
              className="px-3 py-1 text-xs bg-slate-600 border border-slate-500 text-slate-400 rounded-lg hover:bg-slate-500 transition-colors"
              onClick={() => setFilteredOrganizations(organizations)}
            >
              Visa alla
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt avtalskunder</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.length}
                </p>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="text-blue-400">
                    {organizations.filter(org => org.organizationType === 'multisite').length} multisite
                  </span>
                  <span className="text-green-400">
                    {organizations.filter(org => org.organizationType === 'single').length} vanliga
                  </span>
                </div>
              </div>
              <Building2 className="w-8 h-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt anläggningar</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.reduce((sum, org) => sum + (org.sites_count || 0), 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Från multisite-organisationer
                </p>
              </div>
              <MapPin className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt användare</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.reduce((sum, org) => sum + (org.users_count || 0), 0)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Multisite portal-användare
                </p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Årlig omsättning</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {new Intl.NumberFormat('sv-SE', { 
                    style: 'currency', 
                    currency: 'SEK',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                    notation: 'compact'
                  }).format(organizations.reduce((sum, org) => sum + (org.annual_value || 0), 0))}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Alla avtalskunder
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-500" />
            </div>
          </Card>
        </div>

        {/* Organizations List */}
        {filteredOrganizations.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchTerm ? 'Inga kunder hittades' : 'Inga kunder än'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm 
                ? 'Prova att justera din sökning eller ändra filter' 
                : 'Sidan visar alla avtalskunder - både multisite-organisationer och vanliga kunder'}
            </p>
            {!searchTerm && (
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => navigate('/admin/organisation/register')}
                  variant="primary"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Registrera Multisite-organisation
                </Button>
                <Button
                  onClick={() => navigate('/admin/customers')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Hantera Vanliga Kunder
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <CompactOrganizationTable
            organizations={filteredOrganizations}
            organizationUsers={organizationUsers}
            organizationSites={organizationSites}
            onToggleExpand={handleToggleExpand}
            onToggleActive={handleToggleActive}
            onEdit={handleEditOrganization}
            onDelete={handleDeleteOrganization}
            onAddUser={handleAddUser}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onResetPassword={handleResetPassword}
            onAddSite={handleAddSite}
            onEditSite={handleEditSite}
            onDeleteSite={handleDeleteSite}
            expandedOrgId={expandedOrgId}
            getDaysUntilContractEnd={getDaysUntilContractEnd}
            formatContractLength={formatContractLength}
            onInviteToPortal={handleInviteToPortal}
          />
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedOrg && (
        <OrganizationEditModal
          organization={selectedOrg}
          onClose={() => {
            setShowEditModal(false)
            setSelectedOrg(null)
          }}
          onSuccess={() => {
            setShowEditModal(false)
            setSelectedOrg(null)
            fetchOrganizations()
          }}
        />
      )}

      {/* User Modal */}
      {showUserModal && selectedOrg && (
        <UserModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false)
            setEditingUser(null)
          }}
          onSuccess={() => {
            setShowUserModal(false)
            setEditingUser(null)
            if (selectedOrg.organization_id) {
              fetchOrganizationUsers(selectedOrg.id, selectedOrg.organization_id)
            }
          }}
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          existingUser={editingUser}
        />
      )}

      {/* Site Modal */}
      {showSiteModal && selectedOrg && (
        <SiteModal
          isOpen={showSiteModal}
          onClose={() => {
            setShowSiteModal(false)
            setEditingSite(null)
          }}
          onSuccess={() => {
            setShowSiteModal(false)
            setEditingSite(null)
            if (selectedOrg.organization_id) {
              fetchOrganizationSites(selectedOrg.id, selectedOrg.organization_id)
            }
            // Uppdatera sites_count
            fetchOrganizations()
          }}
          organizationId={selectedOrg.organization_id || ''}
          organizationName={selectedOrg.name}
          parentCustomerId={selectedOrg.id}
          existingSite={editingSite}
        />
      )}
    </div>
  )
}