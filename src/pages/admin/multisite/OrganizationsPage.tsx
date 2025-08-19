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
import { useAuth } from '../../../contexts/AuthContext'
import TrafficLightBadge from '../../../components/organisation/TrafficLightBadge'
import { AlertTriangle } from 'lucide-react'

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
  total_value?: number
  // Avtalsinfo
  contract_type?: string
  contract_end_date?: string
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

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])
  const [organizationUsers, setOrganizationUsers] = useState<Record<string, OrganizationUser[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null)

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
      // Hämta organisationer (huvudkontor från customers)
      const { data: orgs, error: orgsError } = await supabase
        .from('customers')
        .select('*')
        .eq('site_type', 'huvudkontor')
        .eq('is_multisite', true)
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      // Hämta statistik för varje organisation
      if (orgs && orgs.length > 0) {
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

          // Hämta antal användare
          const { count: usersCount } = await supabase
            .from('multisite_user_roles')
            .select('*', { count: 'exact', head: true })
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
            billing_method: 'consolidated' as const,
            is_active: org.is_active !== false,
            created_at: org.created_at,
            updated_at: org.updated_at,
            organization_id: org.organization_id,
            sites_count: sitesCount || 0,
            users_count: usersCount || 0,
            total_value: org.total_contract_value || 0,
            // Avtalsinfo
            contract_type: org.contract_type,
            contract_end_date: org.contract_end_date,
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

        setOrganizations(orgsWithStats)
        setFilteredOrganizations(orgsWithStats)
      } else {
        setOrganizations([])
        setFilteredOrganizations([])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Kunde inte hämta organisationer')
    } finally {
      setLoading(false)
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
      // Hämta användare från den nya viewen som kombinerar all data
      const { data: users, error } = await supabase
        .from('multisite_users_complete')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Formatera användardata
      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        user_id: user.user_id,
        organization_id: user.organization_id,
        role_type: user.role_type,
        site_ids: user.site_ids,
        is_active: user.is_active,
        created_at: user.created_at,
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
      // Hämta användare om vi inte redan har dem
      if (!organizationUsers[org.id] && org.organization_id) {
        await fetchOrganizationUsers(org.id, org.organization_id)
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
          title="Multisite-organisationer" 
          description="Hantera organisationer med flera anläggningar"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt organisationer</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.length}
                </p>
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
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Organizations List */}
        {filteredOrganizations.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchTerm ? 'Inga organisationer hittades' : 'Inga organisationer än'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm 
                ? 'Prova att justera din sökning' 
                : 'Börja med att registrera din första multisite-organisation'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => navigate('/admin/organisation/register')}
                variant="primary"
                className="flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Registrera Organisation
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrganizations.map((org) => (
              <Card 
                key={org.id} 
                className={`${!org.is_active ? 'opacity-60' : ''}`}
              >
                {/* Klickbar header-sektion med ny layout */}
                <div 
                  className="p-6 hover:bg-slate-800/30 transition-all duration-200 cursor-pointer"
                  onClick={() => handleToggleExpand(org)}
                >
                  {/* Huvudlayout: Vänster + Höger kolumn */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* VÄNSTER KOLUMN - Huvudinformation & Status */}
                    <div className="lg:col-span-2 space-y-4">
                      {/* Organisation Header */}
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${
                          org.is_active 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          <Building2 className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-semibold text-white truncate">
                              {org.name}
                            </h3>
                            {!org.is_active && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium">
                                Inaktiv
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 font-mono">
                            Org.nr: {org.organization_number}
                          </p>
                        </div>
                      </div>

                      {/* Status & Varningar - Prominent placering */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Trafikljusstatus med större storlek */}
                        {(org.worstPestLevel !== null || org.worstProblemRating !== null) && (
                          <TrafficLightBadge
                            pestLevel={org.worstPestLevel}
                            problemRating={org.worstProblemRating}
                            size="large"
                          />
                        )}
                        
                        {/* Kritiska ärenden med pulsande effekt */}
                        {org.criticalCasesCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg animate-pulse">
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            <span className="text-sm font-medium text-red-400">
                              {org.criticalCasesCount} kritiska ärenden
                            </span>
                          </div>
                        )}
                        
                        {/* Varningar */}
                        {org.warningCasesCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                            <span className="text-sm font-medium text-yellow-400">
                              {org.warningCasesCount} varningar
                            </span>
                          </div>
                        )}
                        
                        {/* Obekräftade rekommendationer */}
                        {org.unacknowledgedCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-medium text-amber-400">
                              {org.unacknowledgedCount} obekräftade
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Grundläggande statistik */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <MapPin className="w-4 h-4 text-blue-400" />
                          <span className="font-medium">{org.sites_count || 0}</span>
                          <span className="text-slate-400">anläggningar</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Users className="w-4 h-4 text-green-400" />
                          <span className="font-medium">{org.users_count || 0}</span>
                          <span className="text-slate-400">användare</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{org.billing_email}</span>
                        </div>
                      </div>
                    </div>

                    {/* HÖGER KOLUMN - Affärsdata */}
                    <div className="space-y-4">
                      {/* Avtalsinfo */}
                      {(org.annual_value > 0 || org.contract_end_date) && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Avtalsinfo
                          </h4>
                          <div className="space-y-2">
                            {org.annual_value > 0 && (
                              <div>
                                <p className="text-xs text-slate-400">Årspremie</p>
                                <p className="text-white font-semibold text-lg">
                                  {new Intl.NumberFormat('sv-SE', { 
                                    style: 'currency', 
                                    currency: 'SEK',
                                    minimumFractionDigits: 0
                                  }).format(org.annual_value)}
                                </p>
                              </div>
                            )}
                            {org.contract_end_date && (
                              <div>
                                <p className="text-xs text-slate-400">Utgångsdatum</p>
                                <p className="text-white font-medium">
                                  {new Date(org.contract_end_date).toLocaleDateString('sv-SE')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Account Management */}
                      {(org.account_manager || org.sales_person) && (
                        <div className="space-y-3">
                          {org.account_manager && (
                            <div className="p-3 bg-slate-800/50 rounded-lg">
                              <p className="text-xs text-slate-400 mb-1">Account Manager</p>
                              <p className="text-white font-medium">{org.account_manager}</p>
                              {org.account_manager_email && (
                                <a 
                                  href={`mailto:${org.account_manager_email}`}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {org.account_manager_email}
                                </a>
                              )}
                            </div>
                          )}
                          
                          {org.sales_person && (
                            <div className="p-3 bg-slate-800/50 rounded-lg">
                              <p className="text-xs text-slate-400 mb-1">Säljare</p>
                              <p className="text-white font-medium">{org.sales_person}</p>
                              {org.sales_person_email && (
                                <a 
                                  href={`mailto:${org.sales_person_email}`}
                                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {org.sales_person_email}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>Skapad {new Date(org.created_at).toLocaleDateString('sv-SE')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar - Expand/Collapse och åtgärder */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400">
                      {expandedOrgId === org.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                      <span className="text-sm">
                        {expandedOrgId === org.id ? 'Dölj detaljer' : 'Visa detaljer'}
                      </span>
                    </div>
                    
                    {/* Åtgärdsknappar */}
                    <div onClick={(e) => e.stopPropagation()} className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(org)}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          org.is_active 
                            ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-300' 
                            : 'hover:bg-green-500/20 text-green-400 hover:text-green-300'
                        }`}
                        title={org.is_active ? 'Inaktivera organisation' : 'Aktivera organisation'}
                      >
                        {org.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleEditOrganization(org)}
                        className="p-2 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg transition-all duration-200"
                        title="Redigera organisation"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteOrganization(org)}
                        className="p-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all duration-200"
                        title="Ta bort organisation"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanderad användarsektion */}
                {expandedOrgId === org.id && (
                  <div className="border-t border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Användare
                      </h4>
                      <Button
                        onClick={() => handleAddUser(org)}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Lägg till användare
                      </Button>
                    </div>

                    {/* Användarlista */}
                    {organizationUsers[org.id] ? (
                      organizationUsers[org.id].length > 0 ? (
                        <div className="space-y-3">
                          {organizationUsers[org.id].map(user => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                  <UserCheck className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                  <p className="text-white font-medium">{user.name}</p>
                                  <div className="flex items-center gap-3 text-sm">
                                    <p className="text-slate-400">{user.email}</p>
                                    {user.phone && (
                                      <>
                                        <span className="text-slate-600">•</span>
                                        <a 
                                          href={`tel:${user.phone}`}
                                          className="text-slate-400 hover:text-blue-400 flex items-center gap-1"
                                        >
                                          <Phone className="w-3 h-3" />
                                          {user.phone}
                                        </a>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Shield className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm text-blue-400">
                                    {getRoleName(user.role_type)}
                                  </span>
                                  {user.site_ids && user.site_ids.length > 0 && (
                                    <span className="text-xs text-slate-500 ml-2">
                                      ({user.site_ids.length} {user.site_ids.length === 1 ? 'enhet' : 'enheter'})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResetPassword(user.email, user.name)}
                                  className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
                                  title="Skicka lösenordsåterställning"
                                >
                                  <Key className="w-4 h-4 text-purple-400" />
                                </button>
                                <button
                                  onClick={() => handleEditUser(org, user)}
                                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Redigera"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(org.id, user.id)}
                                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                  title="Ta bort"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">Inga användare registrerade</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Klicka på "Lägg till användare" för att bjuda in användare
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                        <p className="text-slate-400 mt-2">Laddar användare...</p>
                      </div>
                    )}

                    {/* Sites/Enheter sektion */}
                    {org.sites && org.sites.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-700">
                        <h4 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                          <MapPin className="w-5 h-5 text-blue-400" />
                          Anläggningar ({org.sites.length})
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {org.sites.map(site => (
                            <div key={site.id} className="p-4 bg-slate-800/50 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h5 className="font-medium text-white">{site.site_name || site.company_name}</h5>
                                  {site.site_code && (
                                    <span className="text-xs text-slate-500">Kod: {site.site_code}</span>
                                  )}
                                </div>
                                {site.region && (
                                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                                    {site.region}
                                  </span>
                                )}
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                {site.contact_person && (
                                  <div className="flex items-center gap-2 text-slate-300">
                                    <UserCheck className="w-4 h-4 text-slate-400" />
                                    <span>{site.contact_person}</span>
                                  </div>
                                )}
                                {site.contact_phone && (
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <Phone className="w-4 h-4" />
                                    <a 
                                      href={`tel:${site.contact_phone}`} 
                                      className="hover:text-blue-400 transition-colors"
                                    >
                                      {site.contact_phone}
                                    </a>
                                  </div>
                                )}
                                {site.contact_email && (
                                  <div className="flex items-center gap-2 text-slate-400">
                                    <Mail className="w-4 h-4" />
                                    <a 
                                      href={`mailto:${site.contact_email}`} 
                                      className="hover:text-blue-400 transition-colors truncate"
                                      title={site.contact_email}
                                    >
                                      {site.contact_email}
                                    </a>
                                  </div>
                                )}
                                {site.contact_address && (
                                  <div className="flex items-start gap-2 text-slate-400">
                                    <MapPin className="w-4 h-4 mt-0.5" />
                                    <span className="text-xs">{site.contact_address}</span>
                                  </div>
                                )}
                              </div>
                              
                              {site.organization_number && (
                                <div className="mt-2 pt-2 border-t border-slate-700">
                                  <span className="text-xs text-slate-500">
                                    Org.nr: {site.organization_number} (Per-site fakturering)
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visa/Hantera-knapp */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <Button
                        onClick={() => handleViewDetails(org.id)}
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        Visa fullständig organisationshantering
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
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
          onUpdate={() => {
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
    </div>
  )
}