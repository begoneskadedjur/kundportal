import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { 
  MultisiteOrganization, 
  OrganizationSite, 
  MultisiteUserRole, 
  MultisiteUserRoleType,
  MultisitePermissions,
  getPermissionsForRole 
} from '../types/multisite'
import { 
  isMultisiteCustomer, 
  getOrganizationHierarchy, 
  canUserAccessSite,
  formatOrganizationData 
} from '../utils/multisiteHelpers'
import toast from 'react-hot-toast'

interface MultisiteContextType {
  // Organization data
  organization: MultisiteOrganization | null
  sites: OrganizationSite[]
  userRole: MultisiteUserRole | null
  permissions: MultisitePermissions
  
  // Current selections
  currentSite: OrganizationSite | null
  setCurrentSite: (site: OrganizationSite | null) => void
  
  // Customer data for current site
  currentCustomer: any | null
  
  // Access control
  accessibleSites: OrganizationSite[]
  canAccessSite: (siteId: string) => boolean
  canManageUsers: () => boolean
  canInviteRole: (roleType: MultisiteUserRoleType) => boolean
  
  // Data management
  loading: boolean
  error: string | null
  refreshData: () => Promise<void>
}

const defaultPermissions: MultisitePermissions = {
  canViewAllSites: false,
  canCreateSites: false,
  canManageUsers: false,
  canInviteQualityManagers: false,
  canInviteRegionalManagers: false,
  canInviteSiteManagers: false,
  canEditSiteDetails: false,
  canViewTrafficLight: false,
  canRequestService: false,
}

const MultisiteContext = createContext<MultisiteContextType>({
  organization: null,
  sites: [],
  userRole: null,
  permissions: defaultPermissions,
  currentSite: null,
  setCurrentSite: () => {},
  currentCustomer: null,
  accessibleSites: [],
  canAccessSite: () => false,
  canManageUsers: () => false,
  canInviteRole: () => false,
  loading: false,
  error: null,
  refreshData: async () => {},
})

export function useMultisite() {
  const context = useContext(MultisiteContext)
  if (!context) {
    throw new Error('useMultisite must be used within MultisiteProvider')
  }
  return context
}

interface MultisiteProviderProps {
  children: React.ReactNode
}

export function MultisiteProvider({ children }: MultisiteProviderProps) {
  const { profile } = useAuth()
  const [organization, setOrganization] = useState<MultisiteOrganization | null>(null)
  const [sites, setSites] = useState<OrganizationSite[]>([])
  const [userRole, setUserRole] = useState<MultisiteUserRole | null>(null)
  const [currentSite, setCurrentSite] = useState<OrganizationSite | null>(null)
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch multisite data
  const fetchMultisiteData = useCallback(async () => {
    if (!profile?.user_id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if user has a multisite role
      const { data: roleData, error: roleError } = await supabase
        .from('multisite_user_roles')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('is_active', true)
        .maybeSingle()

      if (roleError) {
        console.error('Error fetching multisite role:', roleError)
        throw roleError
      }

      if (!roleData) {
        // User is not part of a multisite organization - this is normal for admin/koordinatorer
        setLoading(false)
        return
      }

      setUserRole(roleData)

      // Fetch organization (huvudkontor customer)
      const { data: orgData, error: orgError } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', roleData.organization_id)
        .eq('site_type', 'huvudkontor')
        .eq('is_active', true)
        .maybeSingle()

      if (orgError) {
        console.error('Error fetching organization:', orgError)
        throw orgError
      }
      
      if (!orgData) {
        console.warn('No huvudkontor found for organization:', roleData.organization_id)
        // Don't crash - graceful degradation
        setOrganization(null)
        setSites([])
        setLoading(false)
        return
      }
      
      // Map customer fields to organization structure
      // VIKTIGT: id ska vara huvudkontorets customer.id, inte organization_id
      const organization = {
        id: orgData.id, // Använd huvudkontorets customer.id
        organization_id: orgData.organization_id, // Behåll organization_id separat
        name: orgData.company_name,
        organization_name: orgData.company_name, // For backwards compatibility
        organization_number: orgData.organization_number,
        billing_type: 'consolidated' as const,
        primary_contact_email: orgData.contact_email,
        primary_contact_phone: orgData.contact_phone,
        billing_address: orgData.billing_address,
        is_active: orgData.is_active,
        created_at: orgData.created_at,
        updated_at: orgData.updated_at
      }
      setOrganization(organization)

      // Fetch sites based on role (enheter customers)
      
      let sitesQuery = supabase
        .from('customers')
        .select('*')
        .eq('organization_id', roleData.organization_id)
        .eq('site_type', 'enhet')
        .eq('is_active', true)

      // Apply role-based filtering
      if (roleData.role_type === 'regionchef' && roleData.region) {
        sitesQuery = sitesQuery.eq('region', roleData.region)
      } else if (roleData.role_type === 'platsansvarig' && roleData.site_ids) {
        sitesQuery = sitesQuery.in('id', roleData.site_ids)
      }

      const { data: sitesData, error: sitesError } = await sitesQuery
        .order('region', { ascending: true })
        .order('site_name', { ascending: true })
      
      if (sitesError) {
        console.error('Error fetching sites:', sitesError)
        // Don't throw - graceful degradation
        setSites([])
        setLoading(false)
        return
      }
      
      // Map customer data to OrganizationSite structure
      const sites = (sitesData || []).map(customer => ({
        id: customer.id,
        organization_id: customer.organization_id,
        site_name: customer.site_name || customer.company_name,
        site_code: customer.site_code,
        address: customer.contact_address,
        region: customer.region,
        contact_person: customer.contact_person,
        contact_email: customer.contact_email,
        contact_phone: customer.contact_phone,
        customer_id: customer.id, // Site IS the customer now
        is_primary: false,
        is_active: customer.is_active,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }))
      
      setSites(sites)

      // Set default current site if only one available
      if (sites && sites.length === 1) {
        setCurrentSite(sites[0])
      }
    } catch (err) {
      console.error('Error fetching multisite data:', err)
      setError('Kunde inte hämta multisite-data')
      toast.error('Problem med att ladda organisationsdata')
    } finally {
      setLoading(false)
    }
  }, [profile?.user_id])

  useEffect(() => {
    fetchMultisiteData()
  }, [fetchMultisiteData])

  // Fetch customer data when currentSite changes
  useEffect(() => {
    const fetchCustomerForSite = async () => {
      if (!currentSite) {
        setCurrentCustomer(null)
        return
      }

      try {
        // Site IS the customer now, so we just need to fetch the full customer data
        const { data: customer, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', currentSite.id)
          .single()

        if (error) throw error
        setCurrentCustomer(customer)
      } catch (error) {
        console.error('Error fetching customer for site:', error)
        setCurrentCustomer(null)
      }
    }

    fetchCustomerForSite()
  }, [currentSite])

  // Calculate permissions based on role
  const permissions = userRole 
    ? getPermissionsForRole(userRole.role_type)
    : defaultPermissions

  // Get accessible sites based on role
  const accessibleSites = sites.filter(site => {
    if (!userRole) return false
    
    if (userRole.role_type === 'verksamhetschef') {
      return true // Can access all sites
    }
    
    if (userRole.role_type === 'regionchef') {
      return site.region === userRole.region
    }
    
    if (userRole.role_type === 'platsansvarig') {
      return userRole.site_ids?.includes(site.id) || false
    }
    
    return false
  })

  // Check if user can access a specific site
  const canAccessSite = (siteId: string): boolean => {
    if (!userRole) return false
    
    // Använd hjälpfunktionen för grundläggande access
    const hasBasicAccess = canUserAccessSite(userRole, siteId)
    
    // För regionchefer, kontrollera också att siten finns i deras tillgängliga sites
    if (userRole.role_type === 'regionchef' || userRole.role_type === 'regional_manager') {
      return hasBasicAccess && accessibleSites.some(site => site.id === siteId)
    }
    
    return hasBasicAccess
  }

  // Check if user can manage users
  const canManageUsers = (): boolean => {
    return permissions.canManageUsers
  }

  // Check if user can invite a specific role
  const canInviteRole = (roleType: MultisiteUserRoleType): boolean => {
    switch (roleType) {
      case 'verksamhetschef':
        return permissions.canInviteQualityManagers
      case 'regionchef':
        return permissions.canInviteRegionalManagers
      case 'platsansvarig':
        return permissions.canInviteSiteManagers
      default:
        return false
    }
  }

  const value: MultisiteContextType = {
    organization,
    sites,
    userRole,
    permissions,
    currentSite,
    setCurrentSite,
    currentCustomer,
    accessibleSites,
    canAccessSite,
    canManageUsers,
    canInviteRole,
    loading,
    error,
    refreshData: fetchMultisiteData,
  }

  return (
    <MultisiteContext.Provider value={value}>
      {children}
    </MultisiteContext.Provider>
  )
}

export default MultisiteContext