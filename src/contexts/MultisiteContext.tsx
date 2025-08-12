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
        throw roleError
      }

      if (!roleData) {
        // User is not part of a multisite organization - this is normal for admin/koordinatorer
        setLoading(false)
        return
      }

      setUserRole(roleData)

      // Fetch organization
      const { data: orgData, error: orgError } = await supabase
        .from('multisite_organizations')
        .select('*')
        .eq('id', roleData.organization_id)
        .eq('is_active', true)
        .single()

      if (orgError) throw orgError
      setOrganization(orgData)

      // Fetch sites based on role
      let sitesQuery = supabase
        .from('organization_sites')
        .select('*')
        .eq('organization_id', roleData.organization_id)
        .eq('is_active', true)

      // Apply role-based filtering
      if (roleData.role_type === 'regional_manager' && roleData.region) {
        sitesQuery = sitesQuery.eq('region', roleData.region)
      } else if (roleData.role_type === 'site_manager' && roleData.site_ids) {
        sitesQuery = sitesQuery.in('id', roleData.site_ids)
      }

      const { data: sitesData, error: sitesError } = await sitesQuery
        .order('region', { ascending: true })
        .order('site_name', { ascending: true })

      if (sitesError) throw sitesError
      setSites(sitesData || [])

      // Set default current site if only one available
      if (sitesData && sitesData.length === 1) {
        setCurrentSite(sitesData[0])
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

  // Calculate permissions based on role
  const permissions = userRole 
    ? getPermissionsForRole(userRole.role_type)
    : defaultPermissions

  // Get accessible sites based on role
  const accessibleSites = sites.filter(site => {
    if (!userRole) return false
    
    if (userRole.role_type === 'verksamhetsansvarig') {
      return true // Can access all sites
    }
    
    if (userRole.role_type === 'regionansvarig') {
      return site.region === userRole.region
    }
    
    if (userRole.role_type === 'enhetsansvarig') {
      return userRole.site_ids?.includes(site.id) || false
    }
    
    return false
  })

  // Check if user can access a specific site
  const canAccessSite = (siteId: string): boolean => {
    return accessibleSites.some(site => site.id === siteId)
  }

  // Check if user can manage users
  const canManageUsers = (): boolean => {
    return permissions.canManageUsers
  }

  // Check if user can invite a specific role
  const canInviteRole = (roleType: MultisiteUserRoleType): boolean => {
    switch (roleType) {
      case 'verksamhetsansvarig':
        return permissions.canInviteQualityManagers
      case 'regionansvarig':
        return permissions.canInviteRegionalManagers
      case 'enhetsansvarig':
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