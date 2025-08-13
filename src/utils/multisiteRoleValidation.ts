// Multisite Role Validation Utilities
import { MultisiteUserRoleType } from '../types/multisite'

export interface RolePermissions {
  canViewAllSites: boolean
  canManageUsers: boolean
  canEditOrganization: boolean
  canViewBilling: boolean
  canRequestService: boolean
  canViewReports: boolean
  canManageRegion: boolean
  canManageSite: boolean
}

/**
 * Get permissions for a specific multisite role
 */
export function getRolePermissions(role: MultisiteUserRoleType): RolePermissions {
  switch (role) {
    case 'verksamhetschef':
      return {
        canViewAllSites: true,
        canManageUsers: true,
        canEditOrganization: true,
        canViewBilling: true,
        canRequestService: true,
        canViewReports: true,
        canManageRegion: true,
        canManageSite: true
      }
    
    case 'regionchef':
      return {
        canViewAllSites: false, // Only assigned sites
        canManageUsers: true, // Can invite platsansvariga
        canEditOrganization: false,
        canViewBilling: true, // For their region
        canRequestService: true,
        canViewReports: true, // For their region
        canManageRegion: true,
        canManageSite: true // For assigned sites
      }
    
    case 'platsansvarig':
      return {
        canViewAllSites: false, // Only assigned sites
        canManageUsers: false,
        canEditOrganization: false,
        canViewBilling: false,
        canRequestService: true,
        canViewReports: true, // For their site
        canManageRegion: false,
        canManageSite: true // For assigned sites
      }
    
    default:
      return {
        canViewAllSites: false,
        canManageUsers: false,
        canEditOrganization: false,
        canViewBilling: false,
        canRequestService: false,
        canViewReports: false,
        canManageRegion: false,
        canManageSite: false
      }
  }
}

/**
 * Check if a user has access to a specific site
 */
export function hasAccessToSite(
  role: MultisiteUserRoleType,
  siteId: string,
  assignedSiteIds?: string[] | null
): boolean {
  // Verksamhetschef has access to all sites
  if (role === 'verksamhetschef') {
    return true
  }
  
  // Regionchef and platsansvarig only have access to assigned sites
  if (!assignedSiteIds || assignedSiteIds.length === 0) {
    return false
  }
  
  return assignedSiteIds.includes(siteId)
}

/**
 * Get role display name in Swedish
 */
export function getRoleDisplayName(role: MultisiteUserRoleType): string {
  switch (role) {
    case 'verksamhetschef':
      return 'Verksamhetschef'
    case 'regionchef':
      return 'Regionchef'
    case 'platsansvarig':
      return 'Platsansvarig'
    default:
      return 'Okänd roll'
  }
}

/**
 * Get role description in Swedish
 */
export function getRoleDescription(role: MultisiteUserRoleType): string {
  switch (role) {
    case 'verksamhetschef':
      return 'Full tillgång till organisationen. Kan hantera alla anläggningar, användare och inställningar.'
    case 'regionchef':
      return 'Ansvarar för tilldelade anläggningar inom sin region. Kan bjuda in platsansvariga.'
    case 'platsansvarig':
      return 'Ansvarar för specifika anläggningar. Kan begära service och se rapporter för sina platser.'
    default:
      return 'Ingen rollbeskrivning tillgänglig'
  }
}

/**
 * Validate role assignment
 */
export function validateRoleAssignment(
  role: MultisiteUserRoleType,
  siteIds?: string[] | null
): { valid: boolean; error?: string } {
  // Verksamhetschef doesn't need site assignments
  if (role === 'verksamhetschef') {
    return { valid: true }
  }
  
  // Regionchef and platsansvarig must have at least one site
  if (role === 'regionchef' || role === 'platsansvarig') {
    if (!siteIds || siteIds.length === 0) {
      return { 
        valid: false, 
        error: `${getRoleDisplayName(role)} måste ha minst en tilldelad anläggning` 
      }
    }
  }
  
  return { valid: true }
}