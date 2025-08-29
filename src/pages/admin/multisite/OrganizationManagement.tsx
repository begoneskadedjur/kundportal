import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { 
  MultisiteOrganization, 
  OrganizationSite,
  MultisiteUserRole 
} from '../../../types/multisite'
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Trash2,
  Search,
  Filter,
  Mail,
  Phone,
  Receipt,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  ArrowLeft,
  Edit2,
  Settings,
  ChevronRight
} from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import MultisiteRegistrationWizard from '../../../components/admin/multisite/MultisiteRegistrationWizard'
import OrganizationEditModal from '../../../components/admin/multisite/OrganizationEditModal'
import UserManagementPanel from '../../../components/admin/multisite/UserManagementPanel'
import SiteManagementPanel from '../../../components/admin/multisite/SiteManagementPanel'
import CompactOrganizationTable from '../../../components/admin/multisite/CompactOrganizationTable'
import toast from 'react-hot-toast'

export default function OrganizationManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [organizations, setOrganizations] = useState<MultisiteOrganization[]>([])
  const [sites, setSites] = useState<Record<string, OrganizationSite[]>>({})
  const [users, setUsers] = useState<Record<string, MultisiteUserRole[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<MultisiteOrganization | null>(null)
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'multisite' | 'single'>('all')
  const [portalStatusFilter, setPortalStatusFilter] = useState<'all' | 'has_access' | 'no_access'>('all')
  const [loginStatusFilter, setLoginStatusFilter] = useState<'all' | 'logged_in' | 'never_logged_in'>('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<MultisiteOrganization | null>(null)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)
  const [inviteToPortal, setInviteToPortal] = useState<{ org: MultisiteOrganization | null; showModal: boolean }>({ org: null, showModal: false })

  useEffect(() => {
    fetchOrganizations()
  }, [])

  // Handle navigation from organizations list
  useEffect(() => {
    if (location.state?.selectedOrgId) {
      setExpandedOrg(location.state.selectedOrgId)
      // Clear the state to prevent it from persisting
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Hämta alla kunder: både multisite-huvudkontor och vanliga kunder
      const { data: allCustomersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .or('and(site_type.eq.huvudkontor,is_multisite.eq.true),and(is_multisite.is.null),and(is_multisite.eq.false)')
        .order('company_name')

      if (customersError) throw customersError

      // Hämta portal access information
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('customer_id, role, last_sign_in_at, email_verified, is_active')
        .eq('role', 'customer')

      const portalAccessMap = new Map<string, { hasAccess: boolean; lastLogin?: string; isActive: boolean }>()
      profilesData?.forEach(profile => {
        if (profile.customer_id) {
          portalAccessMap.set(profile.customer_id, {
            hasAccess: true,
            lastLogin: profile.last_sign_in_at,
            isActive: profile.is_active || false
          })
        }
      })

      // Hämta multisite portal access
      const { data: multisiteRoles } = await supabase
        .from('multisite_user_roles')
        .select('organization_id, user_id, is_active')
        .eq('is_active', true)

      const multisiteAccessMap = new Map<string, number>()
      multisiteRoles?.forEach(role => {
        if (role.organization_id) {
          const current = multisiteAccessMap.get(role.organization_id) || 0
          multisiteAccessMap.set(role.organization_id, current + 1)
        }
      })

      // Map customers to organization structure
      const orgs = (allCustomersData || []).map(customer => {
        const isMultisite = customer.is_multisite && customer.site_type === 'huvudkontor'
        const portalInfo = portalAccessMap.get(customer.id)
        const multisiteUserCount = isMultisite ? multisiteAccessMap.get(customer.organization_id || customer.id) || 0 : 0
        const singlePortalAccess = !isMultisite && portalInfo?.hasAccess
        
        return {
          id: customer.id,
          organization_id: customer.organization_id,
          name: customer.company_name,
          organization_number: customer.organization_number,
          billing_type: 'consolidated' as const,
          primary_contact_email: customer.contact_email,
          primary_contact_phone: customer.contact_phone,
          billing_address: customer.billing_address,
          is_active: customer.is_active,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
          // Nya fält för båda kundtyper
          organizationType: isMultisite ? 'multisite' as const : 'single' as const,
          portalAccessStatus: isMultisite 
            ? (multisiteUserCount > 0 ? 'full' as const : 'none' as const)
            : (singlePortalAccess ? 'full' as const : 'none' as const),
          activeUsersCount: isMultisite ? multisiteUserCount : (singlePortalAccess ? 1 : 0),
          hasLoggedIn: portalInfo?.lastLogin ? true : false,
          lastLoginDate: portalInfo?.lastLogin,
          sites_count: isMultisite ? undefined : 1 // Kommer uppdateras för multisite nedan
        }
      })

      setOrganizations(orgs)

      // Fetch sites for each multisite organization
      const multisiteOrgs = orgs.filter(org => org.organizationType === 'multisite')
      if (multisiteOrgs && multisiteOrgs.length > 0) {
        const sitesData: Record<string, OrganizationSite[]> = {}
        const usersData: Record<string, MultisiteUserRole[]> = {}

        for (const org of multisiteOrgs) {
          // Fetch sites (enhet customers)
          const { data: enhetData, error: sitesError } = await supabase
            .from('customers')
            .select('*')
            .eq('organization_id', org.organization_id) // Använd organization_id
            .eq('site_type', 'enhet')
            .eq('is_multisite', true) // Säkerställ multisite
            .order('site_name')

          if (!sitesError && enhetData) {
            // Map customers to site structure
            const orgSites = enhetData.map(customer => ({
              id: customer.id,
              organization_id: customer.organization_id,
              site_name: customer.site_name || customer.company_name,
              site_code: customer.site_code,
              address: customer.contact_address,
              region: customer.region,
              contact_person: customer.contact_person,
              contact_email: customer.contact_email,
              contact_phone: customer.contact_phone,
              customer_id: customer.id,
              is_primary: false,
              is_active: customer.is_active,
              created_at: customer.created_at,
              updated_at: customer.updated_at
            }))
            sitesData[org.id] = orgSites
          }

          // Fetch users
          const { data: orgUsers, error: usersError } = await supabase
            .from('multisite_user_roles')
            .select('*')
            .eq('organization_id', org.organization_id) // Använd organization_id

          if (!usersError && orgUsers) {
            usersData[org.id] = orgUsers
          }
        }

        setSites(sitesData)
        setUsers(usersData)
        
        // Uppdatera sites_count för multisite-organisationer
        setOrganizations(prevOrgs => 
          prevOrgs.map(org => {
            if (org.organizationType === 'multisite' && sitesData[org.id]) {
              return {
                ...org,
                sites_count: sitesData[org.id].length + 1 // +1 för huvudkontor
              }
            }
            return org
          })
        )
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Kunde inte hämta organisationer')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOrganization = async (org: MultisiteOrganization) => {
    if (!confirm(`Är du säker på att du vill ta bort ${org.name}? Detta kommer även ta bort alla sites och användare.`)) {
      return
    }

    try {
      // Vi måste ta bort i rätt ordning pga foreign key constraints
      
      // 1. Först ta bort alla enheter (de har parent_customer_id som pekar på huvudkontoret)
      const { error: sitesError } = await supabase
        .from('customers')
        .delete()
        .eq('organization_id', org.organization_id)
        .eq('site_type', 'enhet')

      if (sitesError) {
        console.error('Error deleting sites:', sitesError)
        throw new Error('Kunde inte ta bort enheter')
      }

      // 2. Ta bort alla användare/roller
      const { error: rolesError } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('organization_id', org.organization_id)

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

  const handleToggleActive = async (org: MultisiteOrganization) => {
    try {
      // Update all customers for this organization
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !org.is_active })
        .eq('organization_id', org.id)

      if (error) throw error

      toast.success(`Organisation ${org.is_active ? 'inaktiverad' : 'aktiverad'}`)
      fetchOrganizations()
    } catch (error) {
      console.error('Error toggling organization:', error)
      toast.error('Kunde inte uppdatera organisation')
    }
  }

  // Nya funktioner för portal-hantering
  const handleInviteToPortal = async (org: any) => {
    try {
      if (!org.primary_contact_email) {
        toast.error('Ingen kontakt-e-post funnen för denna kund')
        return
      }

      // Använd befintlig API för kundregistrering
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: org.primary_contact_email,
          customerData: {
            company_name: org.name,
            organization_number: org.organization_number,
            contact_person: org.contact_person,
            contact_email: org.primary_contact_email,
            contact_phone: org.primary_contact_phone,
            existing_customer_id: org.id
          },
          sendWelcomeEmail: true,
          role: 'customer',
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(errorData)
      }

      toast.success(`Portal-inbjudan skickad till ${org.primary_contact_email}`)
      fetchOrganizations() // Uppdatera listan
    } catch (error) {
      console.error('Error inviting to portal:', error)
      toast.error('Kunde inte skicka portal-inbjudan')
    }
  }

  const handleResetPassword = async (org: any) => {
    try {
      if (!org.primary_contact_email) {
        toast.error('Ingen kontakt-e-post funnen för denna kund')
        return
      }

      // Hämta användaren från profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('customer_id', org.id)
        .eq('role', 'customer')
        .single()

      if (!profile) {
        toast.error('Ingen portal-användare funnen för denna kund')
        return
      }

      // Skicka lösenordsåterställning via Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(org.primary_contact_email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) throw error

      toast.success(`Lösenordsåterställning skickad till ${org.primary_contact_email}`)
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('Kunde inte skicka lösenordsåterställning')
    }
  }

  const filteredOrganizations = organizations.filter(org => {
    // Textsökning
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.organization_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Kundtyp-filter
    const matchesCustomerType = 
      customerTypeFilter === 'all' ||
      (customerTypeFilter === 'multisite' && org.organizationType === 'multisite') ||
      (customerTypeFilter === 'single' && org.organizationType === 'single')
    
    // Portal-status filter
    const matchesPortalStatus = 
      portalStatusFilter === 'all' ||
      (portalStatusFilter === 'has_access' && org.portalAccessStatus === 'full') ||
      (portalStatusFilter === 'no_access' && org.portalAccessStatus === 'none')
    
    // Inloggnings-status filter
    const matchesLoginStatus = 
      loginStatusFilter === 'all' ||
      (loginStatusFilter === 'logged_in' && org.hasLoggedIn) ||
      (loginStatusFilter === 'never_logged_in' && !org.hasLoggedIn)
    
    return matchesSearch && matchesCustomerType && matchesPortalStatus && matchesLoginStatus
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Kundhantering"
          description="Hantera alla kunder - både multisite-organisationer och vanliga kunder"
          icon={Building2}
        />

        {/* Action Bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/admin/dashboard')}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Tillbaka
            </Button>
            <div className="w-px h-8 bg-slate-700" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök kund..."
                className="pl-10"
              />
            </div>
            
            {/* Filter Controls */}
            <div className="flex items-center gap-3">
              {/* Kundtyp Filter */}
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value as 'all' | 'multisite' | 'single')}
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Alla kundtyper</option>
                <option value="multisite">Multisite</option>
                <option value="single">Vanlig kund</option>
              </select>
              
              {/* Portal-status Filter */}
              <select
                value={portalStatusFilter}
                onChange={(e) => setPortalStatusFilter(e.target.value as 'all' | 'has_access' | 'no_access')}
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Alla portal-status</option>
                <option value="has_access">Har tillgång</option>
                <option value="no_access">Ingen tillgång</option>
              </select>
              
              {/* Inloggnings-status Filter */}
              <select
                value={loginStatusFilter}
                onChange={(e) => setLoginStatusFilter(e.target.value as 'all' | 'logged_in' | 'never_logged_in')}
                className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none"
              >
                <option value="all">Alla login-status</option>
                <option value="logged_in">Har loggat in</option>
                <option value="never_logged_in">Aldrig loggat in</option>
              </select>
            </div>
          </div>
          <Button
            onClick={() => setWizardOpen(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ny organisation
          </Button>
        </div>

        {/* Organizations Table */}
        {filteredOrganizations.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Inga kunder hittades
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm ? 'Prova att ändra din sökning eller filter' : 'Kom igång genom att skapa din första multisite-organisation'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setWizardOpen(true)}
                variant="primary"
                className="mx-auto flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa första organisationen
              </Button>
            )}
          </Card>
        ) : (
          <CompactOrganizationTable
            organizations={filteredOrganizations}
            organizationUsers={users}
            organizationSites={sites}
            onToggleExpand={(org) => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
            onToggleActive={handleToggleActive}
            onEdit={(org) => setEditingOrg(org)}
            onDelete={handleDeleteOrganization}
            onAddUser={(org) => console.log('Add user:', org.id)}
            onEditUser={(org, user) => console.log('Edit user:', user.id)}
            onDeleteUser={(orgId, userId) => console.log('Delete user:', userId)}
            onResetPassword={handleResetPassword}
            onAddSite={(org) => console.log('Add site:', org.id)}
            onEditSite={(org, site) => console.log('Edit site:', site.id)}
            onDeleteSite={(orgId, siteId) => console.log('Delete site:', siteId)}
            expandedOrgId={expandedOrg}
            getDaysUntilContractEnd={(endDate) => {
              if (!endDate) return null
              const end = new Date(endDate)
              const now = new Date()
              return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            }}
            onInviteToPortal={handleInviteToPortal}
            onViewMultiSiteDetails={(org) => {
              navigate('/admin/organisation/details', { state: { organizationId: org.id } })
            }}
            onViewSingleCustomerDetails={(org) => {
              navigate('/admin/customers', { state: { selectedCustomerId: org.id } })
            }}
          />
        )}
      </div>

      {/* Registration Wizard - Conditionally rendered */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Registrera Multisite-organisation</h2>
              <button
                onClick={() => setWizardOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <MultisiteRegistrationWizard
                onSuccess={() => {
                  setWizardOpen(false)
                  fetchOrganizations()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {editingOrg && (
        <OrganizationEditModal
          organization={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSuccess={() => {
            fetchOrganizations()
            setEditingOrg(null)
          }}
        />
      )}
    </div>
  )
}