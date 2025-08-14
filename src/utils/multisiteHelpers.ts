// src/utils/multisiteHelpers.ts - Hjälpfunktioner för multisite-hantering

import { supabase } from '../lib/supabase'

/**
 * Kontrollerar om en kund är en multisite-kund
 */
export function isMultisiteCustomer(customer: any): boolean {
  return customer?.is_multisite === true
}

/**
 * Returnerar kundens typ baserat på site_type
 */
export function getCustomerType(customer: any): 'huvudkontor' | 'enhet' | 'standard' {
  if (!customer) return 'standard'
  
  if (!isMultisiteCustomer(customer)) {
    return 'standard'
  }
  
  if (customer.site_type === 'huvudkontor') {
    return 'huvudkontor'
  }
  
  if (customer.site_type === 'enhet') {
    return 'enhet'
  }
  
  return 'standard'
}

/**
 * Returnerar visningsnamnet för en kund
 * För multisite-enheter: använder site_name eller company_name
 * För vanliga kunder: använder alltid company_name
 */
export function getCustomerDisplayName(customer: any): string {
  if (!customer) return 'Okänd kund'
  
  // För vanliga kunder, använd alltid company_name
  if (!isMultisiteCustomer(customer)) {
    return customer.company_name || 'Okänd kund'
  }
  
  // För multisite-enheter, prioritera site_name
  if (customer.site_type === 'enhet' && customer.site_name) {
    return customer.site_name
  }
  
  // Fallback till company_name
  return customer.company_name || 'Okänd kund'
}

/**
 * Returnerar fullständigt namn för en multisite-enhet
 * Format: "Organisationsnamn - Enhetsnamn"
 */
export function getFullSiteName(customer: any): string {
  if (!customer) return 'Okänd kund'
  
  // För vanliga kunder, returnera bara company_name
  if (!isMultisiteCustomer(customer)) {
    return customer.company_name || 'Okänd kund'
  }
  
  // För huvudkontor, returnera bara company_name
  if (customer.site_type === 'huvudkontor') {
    return customer.company_name || 'Okänd organisation'
  }
  
  // För enheter, returnera fullständigt namn om möjligt
  if (customer.site_type === 'enhet') {
    // Company name för enheter är redan formaterat som "Organisation - Enhet"
    return customer.company_name || customer.site_name || 'Okänd enhet'
  }
  
  return customer.company_name || 'Okänd kund'
}

/**
 * Hämtar hela organisationshierarkin för ett organization_id
 */
export async function getOrganizationHierarchy(organizationId: string) {
  try {
    // Hämta huvudkontor
    const { data: huvudkontor, error: hkError } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('site_type', 'huvudkontor')
      .eq('is_multisite', true)
      .maybeSingle()
    
    if (hkError) {
      console.error('Error fetching huvudkontor:', hkError)
      return null
    }
    
    // Hämta alla enheter
    const { data: enheter, error: enheterError } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('site_type', 'enhet')
      .eq('is_multisite', true)
      .order('site_name')
    
    if (enheterError) {
      console.error('Error fetching enheter:', enheterError)
      return null
    }
    
    return {
      huvudkontor,
      enheter: enheter || []
    }
  } catch (error) {
    console.error('Error in getOrganizationHierarchy:', error)
    return null
  }
}

/**
 * Validerar om en customer ID är ett huvudkontor
 */
export async function isHuvudkontor(customerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('site_type, is_multisite')
      .eq('id', customerId)
      .single()
    
    if (error || !data) return false
    
    return data.is_multisite === true && data.site_type === 'huvudkontor'
  } catch (error) {
    console.error('Error checking if huvudkontor:', error)
    return false
  }
}

/**
 * Hämtar regioner för en organisation
 */
export async function getOrganizationRegions(organizationId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('region')
      .eq('organization_id', organizationId)
      .eq('site_type', 'enhet')
      .eq('is_multisite', true)
      .not('region', 'is', null)
    
    if (error || !data) return []
    
    // Extrahera unika regioner
    const regions = [...new Set(data.map(d => d.region).filter(Boolean))]
    return regions.sort()
  } catch (error) {
    console.error('Error fetching organization regions:', error)
    return []
  }
}

/**
 * Kontrollerar om en användare har tillgång till en specifik enhet
 */
export function canUserAccessSite(userRole: any, siteId: string): boolean {
  if (!userRole) return false
  
  // Verksamhetschef har tillgång till alla enheter i organisationen
  if (userRole.role_type === 'verksamhetschef' || userRole.role_type === 'quality_manager') {
    return true
  }
  
  // Platsansvarig har bara tillgång till sina specifika enheter
  if (userRole.role_type === 'platsansvarig' || userRole.role_type === 'site_manager') {
    return userRole.site_ids?.includes(siteId) || false
  }
  
  // Regionchef - behöver kontrollera region (hanteras separat)
  if (userRole.role_type === 'regionchef' || userRole.role_type === 'regional_manager') {
    // Detta kräver att vi kontrollerar regionens enheter
    // Returnerar true här och låter anropande kod hantera regionfiltrering
    return true
  }
  
  return false
}

/**
 * Formaterar organisationsdata för visning
 */
export function formatOrganizationData(org: any) {
  if (!org) return null
  
  return {
    id: org.organization_id || org.id,
    name: org.company_name || org.organization_name,
    organizationNumber: org.organization_number,
    billingAddress: org.billing_address || org.contact_address,
    billingType: org.billing_type || 'consolidated',
    primaryContactEmail: org.contact_email,
    primaryContactPhone: org.contact_phone,
    isActive: org.is_active !== false
  }
}