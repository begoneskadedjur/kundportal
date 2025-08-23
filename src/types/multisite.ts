// Multisite types for BeGone Kundportal

export interface MultisiteOrganization {
  id: string
  name: string  // company_name från customers
  organization_name?: string // För bakåtkompatibilitet
  organization_number: string | null
  billing_type: 'consolidated' | 'per_site'
  primary_contact_email: string | null
  primary_contact_phone: string | null
  billing_address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationSite {
  id: string // Detta är nu customer.id
  organization_id: string
  site_name: string
  site_code: string | null
  address: string | null // contact_address från customers
  region: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  customer_id?: string | null  // Behålls för bakåtkompatibilitet, men är samma som id
  is_primary: boolean // Behålls för bakåtkompatibilitet
  is_active: boolean
  created_at: string
  updated_at: string
  // Lägg till fält för getCustomerDisplayName kompatibilitet
  is_multisite?: boolean
  site_type?: string
  company_name?: string
}

export type MultisiteUserRoleType = 'verksamhetschef' | 'regionchef' | 'platsansvarig'

export interface MultisiteUserRole {
  id: string
  user_id: string
  organization_id: string
  role_type: MultisiteUserRoleType
  site_ids: string[] | null // För platsansvariga och regionchefer
  sites: string[] | null // För regionchefer - vilka anläggningar de ansvarar för
  region: string | null // För regionchefer (kan behållas för bakåtkompatibilitet)
  is_active: boolean
  created_at: string
  updated_at: string
}

// Traffic Light System Types
export type PestLevel = 0 | 1 | 2 | 3
export type ProblemRating = 1 | 2 | 3 | 4 | 5
export type PestLevelTrend = 'improving' | 'stable' | 'worsening'
export type TrafficLightColor = 'green' | 'yellow' | 'red' | 'gray'

export interface TrafficLightAssessment {
  pest_level: PestLevel | null
  problem_rating: ProblemRating | null
  assessment_date: string | null
  assessed_by: string | null
  pest_level_trend: PestLevelTrend | null
}

export interface TrafficLightStatus extends TrafficLightAssessment {
  case_id: string
  case_number: string
  title: string
  customer_id: string
  customer_name: string
  site_id: string | null
  site_name: string | null
  region: string | null
  traffic_light_color: TrafficLightColor
  created_at: string
  updated_at: string
}

// Extended Customer type for multisite
export interface MultisiteCustomer {
  id: string
  company_name: string
  organization_id: string | null
  is_multisite: boolean
  // ... other customer fields
}

// Extended Case type with traffic light
export interface CaseWithTrafficLight {
  id: string
  case_number: string
  title: string
  customer_id: string | null
  site_id: string | null
  pest_level: PestLevel | null
  problem_rating: ProblemRating | null
  assessment_date: string | null
  assessed_by: string | null
  pest_level_trend: PestLevelTrend | null
  // ... other case fields
}

// Helper functions for traffic light calculations
export function calculateTrafficLightColor(
  pestLevel: PestLevel | null,
  problemRating: ProblemRating | null
): TrafficLightColor {
  if (pestLevel === null || problemRating === null) {
    return 'gray'
  }
  
  if (pestLevel >= 3 || problemRating >= 4) {
    return 'red'
  }
  
  if (pestLevel === 2 || problemRating === 3) {
    return 'yellow'
  }
  
  return 'green'
}

export function getPestLevelLabel(level: PestLevel): string {
  switch (level) {
    case 0:
      return 'Ingen förekomst'
    case 1:
      return 'Låg'
    case 2:
      return 'Måttlig'
    case 3:
      return 'Hög/Infestation'
    default:
      return 'Okänd'
  }
}

export function getProblemRatingLabel(rating: ProblemRating): string {
  switch (rating) {
    case 1:
      return 'Utmärkt'
    case 2:
      return 'Bra'
    case 3:
      return 'Kräver uppmärksamhet'
    case 4:
      return 'Allvarligt'
    case 5:
      return 'Kritiskt - Kräver kundengagemang'
    default:
      return 'Okänd'
  }
}

export function getTrafficLightLabel(color: TrafficLightColor): string {
  switch (color) {
    case 'green':
      return 'OK - Ingen åtgärd'
    case 'yellow':
      return 'Varning - Övervakning'
    case 'red':
      return 'Kritisk - Åtgärd krävs'
    case 'gray':
      return 'Ej bedömd'
    default:
      return 'Okänd'
  }
}

// Permission helpers
export interface MultisitePermissions {
  canViewAllSites: boolean
  canCreateSites: boolean
  canManageUsers: boolean
  canInviteQualityManagers: boolean
  canInviteRegionalManagers: boolean
  canInviteSiteManagers: boolean
  canEditSiteDetails: boolean
  canViewTrafficLight: boolean
  canRequestService: boolean
}

export function getPermissionsForRole(role: MultisiteUserRoleType): MultisitePermissions {
  switch (role) {
    case 'verksamhetschef':
      return {
        canViewAllSites: true,
        canCreateSites: true,
        canManageUsers: true,
        canInviteQualityManagers: true,
        canInviteRegionalManagers: true,
        canInviteSiteManagers: true,
        canEditSiteDetails: true,
        canViewTrafficLight: true,
        canRequestService: true,
      }
    case 'regionchef':
      return {
        canViewAllSites: false, // Endast deras regioner/anläggningar
        canCreateSites: false,
        canManageUsers: true, // Begränsad till deras regioner
        canInviteQualityManagers: false,
        canInviteRegionalManagers: false,
        canInviteSiteManagers: true, // För deras regioner
        canEditSiteDetails: true, // För deras regioner
        canViewTrafficLight: true, // För deras regioner
        canRequestService: true,
      }
    case 'platsansvarig':
      return {
        canViewAllSites: false, // Endast deras anläggning
        canCreateSites: false,
        canManageUsers: false,
        canInviteQualityManagers: false,
        canInviteRegionalManagers: false,
        canInviteSiteManagers: false,
        canEditSiteDetails: false,
        canViewTrafficLight: true, // För deras anläggning
        canRequestService: true,
      }
    default:
      return {
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
  }
}