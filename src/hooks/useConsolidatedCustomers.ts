// src/hooks/useConsolidatedCustomers.ts - Hook för konsoliderad multisite-kundvy

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  calculatePortfolioValue,
  countActiveCustomers,
  calculateRenewalValue,
  countHighRiskCustomers,
  calculateHealthScore,
  calculateChurnRisk,
  calculateRenewalProbability,
  getContractProgress
} from '../utils/customerMetrics'

interface Customer {
  id: string
  company_name: string
  organization_number?: string | null
  contact_person: string | null
  contact_email: string
  contact_phone?: string | null
  contact_address?: string | null
  billing_email?: string | null
  billing_address?: string | null
  billing_frequency?: string | null
  price_list_id?: string | null
  billing_type?: 'consolidated' | 'per_site' | null
  billing_reference?: string | null
  cost_center?: string | null
  billing_recipient?: string | null
  price_adjustment_percent?: number | null
  billing_anchor_month?: number | null
  billing_active?: boolean
  adhoc_invoice_grouping?: 'per_case' | 'monthly_batch' | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  business_type?: string | null
  contract_type?: string | null
  oneflow_contract_id?: string | null
  contract_template_id?: string | null
  contract_status?: string
  contract_start_date?: string | null
  contract_end_date?: string | null
  contract_length?: string | null
  terminated_at?: string | null
  termination_reason?: string | null
  effective_end_date?: string | null
  annual_value?: number | null
  monthly_value?: number | null
  total_contract_value?: number | null
  assigned_account_manager?: string | null
  account_manager_email?: string | null
  sales_person?: string | null
  sales_person_email?: string | null
  industry_category?: string | null
  customer_size?: 'small' | 'medium' | 'large' | null
  service_frequency?: string | null
  source_type?: 'oneflow' | 'manual' | 'import' | null
  products?: any
  product_summary?: string | null
  service_details?: string | null
  
  // Multisite fields
  organization_id?: string | null
  is_multisite: boolean
  site_name?: string | null
  site_code?: string | null
  parent_customer_id?: string | null
  region?: string | null
  site_type?: 'huvudkontor' | 'enhet' | null
}

export interface CustomerSite extends Customer {
  healthScore: ReturnType<typeof calculateHealthScore>
  churnRisk: ReturnType<typeof calculateChurnRisk>
  renewalProbability: ReturnType<typeof calculateRenewalProbability>
  contractProgress: ReturnType<typeof getContractProgress>
  hasPortalAccess?: boolean
  invitationStatus?: 'none' | 'pending' | 'active'
  
  // Cases data per site
  casesCount: number
  casesValue: number
  // Ackumulerat avtalsvärde från fakturerade contract-items inom avtalsperiod
  // (används som fallback för avropsavtal där annual_value saknas)
  contractBilledAccum: number
  casesBillingBreakdown: {
    pending: number
    sent: number
    paid: number
    skip: number
  }
  cases?: Array<{
    id: string
    title: string
    description?: string
    price: number
    billing_status: 'pending' | 'sent' | 'paid' | 'skip'
    created_at: string
    case_type: 'private_case' | 'business_case'
  }>
}

export type PortalAccessStatus = 'full' | 'partial' | 'none'

export interface ConsolidatedCustomer {
  id: string // organization_id for multisite, customer.id for single
  organizationType: 'multisite' | 'single'
  organizationId?: string | null
  
  // Primary display info (from huvudkontor or single customer)
  company_name: string
  organization_number?: string | null
  contact_person: string | null
  contact_email: string
  contact_phone?: string | null
  contact_address?: string | null
  assigned_account_manager?: string | null
  account_manager_email?: string | null
  industry_category?: string | null
  customer_size?: 'small' | 'medium' | 'large' | null
  business_type?: string | null
  customer_number?: number | null
  customer_group_id?: string | null

  // Aggregated data
  sites: CustomerSite[]
  totalSites: number
  totalContractValue: number
  totalAnnualValue: number
  totalMonthlyValue: number
  portalAccessStatus: PortalAccessStatus
  activeUsersCount: number
  pendingInvitationsCount: number
  
  // Multisite users data
  multisiteUsers?: Array<{
    user_id: string
    role_type: string
    display_name: string | null
    email: string
    last_login: string | null
    last_sign_in_at: string | null
    email_verified: boolean | null
    is_active: boolean
    hasLoggedIn: boolean
    site_ids?: string[]
  }>
  
  // Cases aggregated data
  totalCasesValue: number
  totalCasesCount: number
  totalOrganizationValue: number // totalContractValue + totalCasesValue
  casesBillingStatus: {
    pending: { count: number; value: number }
    sent: { count: number; value: number }
    paid: { count: number; value: number }
    skip: { count: number; value: number }
  }
  
  // Aggregated metrics
  overallHealthScore: ReturnType<typeof calculateHealthScore>
  highestChurnRisk: ReturnType<typeof calculateChurnRisk>
  averageRenewalProbability: number
  nextRenewalDate?: string | null
  daysToNextRenewal?: number | null
  earliestContractStartDate?: string | null
  
  // Status flags
  is_active: boolean
  isTerminated: boolean
  effectiveEndDate?: string | null
  hasExpiringSites: boolean
  hasHighRiskSites: boolean
  
  // Metadata
  created_at: string | null
  updated_at: string | null
}

export interface ConsolidatedAnalytics {
  totalOrganizations: number
  totalSites: number
  multisiteOrganizations: number
  singleCustomers: number
  portfolioValue: number
  renewalValue30Days: number
  renewalValue90Days: number
  averageContractValue: number
  averageHealthScore: number
  organizationsAtRisk: number
  monthlyGrowth: number
  
  // KPI Cards properties
  totalCustomers: number
  activeCustomers: number
  terminatedCount: number
  netRevenueRetention: number
  highRiskCount: number
  
  topOrganizationsByValue: ConsolidatedCustomer[]
  organizationsAtRiskList: ConsolidatedCustomer[]
  upcomingRenewals: ConsolidatedCustomer[]
  
  portalAccessStats: {
    fullAccess: number
    partialAccess: number
    noAccess: number
  }
}

export interface ContactSummary {
  name: string
  title: string | null
  responsibility_area: string | null
  phone: string | null
  email: string | null
}

export function useConsolidatedCustomers() {
  const [consolidatedCustomers, setConsolidatedCustomers] = useState<ConsolidatedCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [contactsSearch, setContactsSearch] = useState<Map<string, string[]>>(new Map())
  const [contactsMap, setContactsMap] = useState<Map<string, ContactSummary[]>>(new Map())

  useEffect(() => {
    fetchConsolidatedCustomers()
  }, [refreshKey])

  const fetchConsolidatedCustomers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Parallellisera oberoende queries för snabbare laddning
      const [
        customersResult,
        profilesResult,
        multisiteRolesResult,
        casesResult,
        invitationsResult,
        contactsResult,
        adHocResult,
        contractItemsResult
      ] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('customer_id, role').eq('role', 'customer'),
        supabase.from('multisite_user_roles').select('organization_id, user_id, is_active, role_type, site_ids').eq('is_active', true),
        supabase.from('cases').select('id, customer_id, title, description, price, billing_status, created_at'),
        supabase.from('user_invitations').select('customer_id, accepted_at, expires_at'),
        supabase.from('customer_contacts').select('customer_id, name, title, responsibility_area, phone, email'),
        supabase.from('contract_billing_items').select('customer_id, total_price').eq('item_type', 'ad_hoc').neq('status', 'cancelled'),
        supabase.from('contract_billing_items').select('customer_id, total_price, billing_period_start').eq('item_type', 'contract').neq('status', 'cancelled')
      ])

      const { data: customersData, error: customersError } = customersResult
      if (customersError) throw customersError

      const { data: profilesData } = profilesResult
      const { data: multisiteRoles, error: multisiteError } = multisiteRolesResult
      const { data: casesData, error: casesError } = casesResult
      const { data: invitationsData, error: invitationsError } = invitationsResult
      const { data: contactsData } = contactsResult
      const { data: adHocData } = adHocResult
      const { data: contractItemsData } = contractItemsResult

      // Bygg ad_hoc-map: customer_id → summerad totalbelopp
      const adHocMap = new Map<string, number>()
      adHocData?.forEach((item: any) => {
        adHocMap.set(item.customer_id, (adHocMap.get(item.customer_id) ?? 0) + (item.total_price ?? 0))
      })

      // Bygg contract-items-per-kund (filter på period per kund sker nedan när customer-data finns)
      const contractItemsByCustomer = new Map<string, Array<{ total_price: number; billing_period_start: string | null }>>()
      contractItemsData?.forEach((item: any) => {
        const arr = contractItemsByCustomer.get(item.customer_id) || []
        arr.push({ total_price: item.total_price ?? 0, billing_period_start: item.billing_period_start })
        contractItemsByCustomer.set(item.customer_id, arr)
      })

      // Customer contacts map for search (customer_id -> searchable strings)
      const contactsSearchMap = new Map<string, string[]>()
      const contactsSummaryMap = new Map<string, ContactSummary[]>()
      contactsData?.forEach((c: any) => {
        const strs = contactsSearchMap.get(c.customer_id) || []
        if (c.name) strs.push(c.name.toLowerCase())
        if (c.responsibility_area) strs.push(c.responsibility_area.toLowerCase())
        if (c.email) strs.push(c.email.toLowerCase())
        contactsSearchMap.set(c.customer_id, strs)

        const summaries = contactsSummaryMap.get(c.customer_id) || []
        summaries.push({
          name: c.name,
          title: c.title || null,
          responsibility_area: c.responsibility_area || null,
          phone: c.phone || null,
          email: c.email || null
        })
        contactsSummaryMap.set(c.customer_id, summaries)
      })

      // Portal access map
      const portalAccessMap = new Map<string, boolean>()
      profilesData?.forEach(profile => {
        if (profile.customer_id) {
          portalAccessMap.set(profile.customer_id, true)
        }
      })

      // Hämta multisite profiles och auth users (beror på multisiteRoles)
      let multisiteProfilesData = null
      let authUsersData = null
      if (multisiteRoles && !multisiteError) {
        const userIds = multisiteRoles.map(r => r.user_id)

        // Parallellisera multisite-relaterade queries
        const multisiteProfilesPromise = supabase.from('profiles')
          .select('user_id, display_name, email, last_login, email_verified, is_active')
          .in('user_id', userIds)
          .eq('is_active', true)

        const authUsersPromise = supabase
          .rpc('get_user_login_status', { user_ids: userIds })
          .then(result => result)
          .catch(() => ({ data: null, error: { message: 'RPC not available' } }))

        const [multisiteProfilesResult, authUsersResult] = await Promise.all([
          multisiteProfilesPromise,
          authUsersPromise
        ])

        multisiteProfilesData = multisiteProfilesResult.data
        if (authUsersResult && !(authUsersResult as any).error && (authUsersResult as any).data) {
          authUsersData = (authUsersResult as any).data
        }
      }

      // Skapa multisite users map med fullständig info
      const multisiteUsersMap = new Map<string, Array<{
        user_id: string
        role_type: string
        display_name: string | null
        email: string
        last_login: string | null
        last_sign_in_at: string | null
        email_verified: boolean | null
        is_active: boolean
        hasLoggedIn: boolean
        site_ids?: string[]
      }>>()

      // Kombinera multisite_user_roles med profiles och auth users data
      if (multisiteRoles && multisiteProfilesData) {
        const profilesMap = new Map(multisiteProfilesData.map(p => [p.user_id, p]))
        const authUsersMap = new Map((authUsersData || []).map((u: any) => [u.id, u]))

        multisiteRoles.forEach(role => {
          const profile = profilesMap.get(role.user_id)
          const authUser = authUsersMap.get(role.user_id)

          if (role.organization_id && profile) {
            const current = multisiteUsersMap.get(role.organization_id) || []
            current.push({
              user_id: role.user_id,
              role_type: role.role_type,
              display_name: profile.display_name,
              email: profile.email,
              last_login: profile.last_login,
              last_sign_in_at: authUser?.last_sign_in_at || null,
              email_verified: profile.email_verified,
              is_active: profile.is_active,
              hasLoggedIn: authUser?.last_sign_in_at ? !!authUser.last_sign_in_at : !!profile.last_login,
              site_ids: role.site_ids
            })
            multisiteUsersMap.set(role.organization_id, current)
          }
        })
      }

      // Skapa bakåtkompatibel access map för befintlig kod
      const multisiteAccessMap = new Map<string, number>()
      multisiteUsersMap.forEach((users, orgId) => {
        multisiteAccessMap.set(orgId, users.length)
      })

      // Cases map
      if (casesError && !casesError.message.includes('permission denied')) {
        console.error('Error fetching cases:', casesError)
      }

      const casesMap = new Map<string, any[]>()
      casesData?.forEach(caseItem => {
        if (caseItem.customer_id) {
          const existing = casesMap.get(caseItem.customer_id) || []
          existing.push({
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
            price: caseItem.price || 0,
            billing_status: caseItem.billing_status || 'pending',
            created_at: caseItem.created_at,
            case_type: 'private_case'
          })
          casesMap.set(caseItem.customer_id, existing)
        }
      })

      // Inbjudningar
      if (invitationsError && !invitationsError.message.includes('permission denied')) {
        console.error('Error fetching invitations:', invitationsError)
      }

      const invitationMap = new Map<string, 'pending' | 'active'>()
      invitationsData?.forEach(inv => {
        if (inv.customer_id) {
          if (inv.accepted_at) {
            invitationMap.set(inv.customer_id, 'active')
          } else if (new Date(inv.expires_at) > new Date()) {
            invitationMap.set(inv.customer_id, 'pending')
          }
        }
      })

      // Berika kunder med metrics
      const enrichedCustomers: CustomerSite[] = (customersData || []).map(customer => {
        const hasPortalAccess = portalAccessMap.has(customer.id)
        const invitationStatus = invitationMap.get(customer.id) || 'none'
        
        // Hämta cases för denna kund
        const customerCases = casesMap.get(customer.id) || []
        // casesValue = summan av ad_hoc contract_billing_items (ClickUp fasas ut)
        const casesValue = adHocMap.get(customer.id) ?? 0

        // Ackumulerat avtalsvärde: SUM(contract-items inom [contract_start_date, terminated_at || now()])
        // Används som fallback för avropsavtal (annual_value saknas men contract_start_date finns).
        const items = contractItemsByCustomer.get(customer.id) || []
        const startCutoff = customer.contract_start_date ? new Date(customer.contract_start_date) : null
        const endCutoff = customer.terminated_at ? new Date(customer.terminated_at) : new Date()
        const contractBilledAccum = items.reduce((sum, it) => {
          if (!it.billing_period_start) return sum + it.total_price
          const d = new Date(it.billing_period_start)
          if (startCutoff && d < startCutoff) return sum
          if (d > endCutoff) return sum
          return sum + it.total_price
        }, 0)
        const casesBillingBreakdown = {
          pending: customerCases.filter(c => c.billing_status === 'pending').length,
          sent: customerCases.filter(c => c.billing_status === 'sent').length,
          paid: customerCases.filter(c => c.billing_status === 'paid').length,
          skip: customerCases.filter(c => c.billing_status === 'skip').length
        }
        
        return {
          ...customer,
          healthScore: calculateHealthScore(customer),
          churnRisk: calculateChurnRisk(customer),
          renewalProbability: calculateRenewalProbability(customer),
          contractProgress: getContractProgress(
            customer.contract_start_date,
            customer.contract_end_date
          ),
          hasPortalAccess,
          invitationStatus: hasPortalAccess ? 'active' : invitationStatus,
          
          // Cases data
          casesCount: customerCases.length,
          casesValue,
          contractBilledAccum,
          casesBillingBreakdown,
          cases: customerCases
        }
      })

      // Konsolidera kunder
      const consolidated = consolidateCustomers(enrichedCustomers, multisiteAccessMap, multisiteUsersMap)
      setConsolidatedCustomers(consolidated)
      setContactsSearch(contactsSearchMap)
      setContactsMap(contactsSummaryMap)

    } catch (err) {
      console.error('Error fetching consolidated customers:', err)
      setError('Kunde inte hämta kunddata')
    } finally {
      setLoading(false)
    }
  }

  const consolidateCustomers = (
    customers: CustomerSite[], 
    multisiteAccessMap: Map<string, number>,
    multisiteUsersMap: Map<string, Array<{
      user_id: string
      role_type: string
      display_name: string | null
      email: string
      last_login: string | null
      last_sign_in_at: string | null
      email_verified: boolean | null
      is_active: boolean
      hasLoggedIn: boolean
      site_ids?: string[]
    }>>
  ): ConsolidatedCustomer[] => {
    const consolidatedMap = new Map<string, ConsolidatedCustomer>()
    
    customers.forEach(customer => {
      if (customer.is_multisite && customer.organization_id) {
        // Multisite customer - gruppera per organization_id
        const orgId = customer.organization_id
        
        if (!consolidatedMap.has(orgId)) {
          // Hitta huvudkontor för organisation
          const huvudkontor = customers.find(c => 
            c.organization_id === orgId && c.site_type === 'huvudkontor'
          ) || customer
          
          // Hämta användarinfo för denna organisation
          const orgUsers = multisiteUsersMap.get(orgId) || []
          const activeUsers = orgUsers.filter(u => u.hasLoggedIn)
          
          consolidatedMap.set(orgId, {
            id: orgId,
            organizationType: 'multisite',
            organizationId: orgId,
            
            // Använd huvudkontor info som primär info
            company_name: huvudkontor.company_name,
            organization_number: huvudkontor.organization_number,
            contact_person: huvudkontor.contact_person,
            contact_email: huvudkontor.contact_email,
            contact_phone: huvudkontor.contact_phone,
            contact_address: huvudkontor.contact_address,
            assigned_account_manager: huvudkontor.assigned_account_manager,
            account_manager_email: huvudkontor.account_manager_email,
            industry_category: huvudkontor.industry_category,
            customer_size: huvudkontor.customer_size,
            business_type: huvudkontor.business_type,
            customer_number: huvudkontor.customer_number,
            customer_group_id: huvudkontor.customer_group_id,

            sites: [],
            totalSites: 0,
            totalContractValue: 0,
            totalAnnualValue: 0,
            totalMonthlyValue: 0,
            portalAccessStatus: orgUsers.length > 0 ? 'partial' : 'none',
            activeUsersCount: activeUsers.length,
            pendingInvitationsCount: orgUsers.length - activeUsers.length,
            
            // Lägg till användarinfo
            multisiteUsers: orgUsers,
            
            // Cases initialization
            totalCasesValue: 0,
            totalCasesCount: 0,
            totalOrganizationValue: 0,
            casesBillingStatus: {
              pending: { count: 0, value: 0 },
              sent: { count: 0, value: 0 },
              paid: { count: 0, value: 0 },
              skip: { count: 0, value: 0 }
            },
            
            overallHealthScore: { 
              score: 0, 
              level: 'poor' as const, 
              color: '#ef4444',
              breakdown: {
                contractAge: { value: 0, weight: 0.25, score: 0 },
                communicationFrequency: { value: 0, weight: 0.25, score: 0 },
                supportTickets: { value: 0, weight: 0.25, score: 0 },
                paymentHistory: { value: 0, weight: 0.25, score: 0 }
              },
              tooltip: 'No data available'
            },
            highestChurnRisk: { score: 0, risk: 'low' as const, color: '#10b981', factors: [], tooltip: 'Low risk' },
            averageRenewalProbability: 0,
            
            is_active: huvudkontor.is_active || false,
            isTerminated: false,
            effectiveEndDate: null,
            hasExpiringSites: false,
            hasHighRiskSites: false,
            
            created_at: huvudkontor.created_at,
            updated_at: huvudkontor.updated_at
          })
        }
        
        const org = consolidatedMap.get(orgId)!
        org.sites.push(customer)
        
      } else {
        // Single-site customer
        consolidatedMap.set(customer.id, {
          id: customer.id,
          organizationType: 'single',
          organizationId: null,
          
          company_name: customer.company_name,
          organization_number: customer.organization_number,
          contact_person: customer.contact_person,
          contact_email: customer.contact_email,
          contact_phone: customer.contact_phone,
          contact_address: customer.contact_address,
          assigned_account_manager: customer.assigned_account_manager,
          account_manager_email: customer.account_manager_email,
          industry_category: customer.industry_category,
          customer_size: customer.customer_size,
          business_type: customer.business_type,
          customer_number: customer.customer_number,
          customer_group_id: customer.customer_group_id,

          sites: [customer],
          totalSites: 1,
          // Avropsavtal (ingen årspremie men start-datum finns) → ackumulerat debiterat som avtalsvärde
          totalContractValue: ((!customer.annual_value || customer.annual_value <= 0) && customer.contract_start_date)
            ? customer.contractBilledAccum
            : (customer.total_contract_value || 0),
          totalAnnualValue: customer.annual_value || 0,
          totalMonthlyValue: customer.monthly_value || 0,
          portalAccessStatus: customer.hasPortalAccess ? 'full' : 'none',
          activeUsersCount: customer.hasPortalAccess ? 1 : 0,
          pendingInvitationsCount: customer.invitationStatus === 'pending' ? 1 : 0,
          
          // Cases data for single customer
          totalCasesValue: customer.casesValue,
          totalCasesCount: customer.casesCount,
          totalOrganizationValue:
            (((!customer.annual_value || customer.annual_value <= 0) && customer.contract_start_date)
              ? customer.contractBilledAccum
              : (customer.total_contract_value || 0))
            + customer.casesValue,
          casesBillingStatus: {
            pending: { 
              count: customer.casesBillingBreakdown.pending, 
              value: customer.cases?.filter(c => c.billing_status === 'pending').reduce((sum, c) => sum + c.price, 0) || 0 
            },
            sent: { 
              count: customer.casesBillingBreakdown.sent, 
              value: customer.cases?.filter(c => c.billing_status === 'sent').reduce((sum, c) => sum + c.price, 0) || 0 
            },
            paid: { 
              count: customer.casesBillingBreakdown.paid, 
              value: customer.cases?.filter(c => c.billing_status === 'paid').reduce((sum, c) => sum + c.price, 0) || 0 
            },
            skip: { 
              count: customer.casesBillingBreakdown.skip, 
              value: customer.cases?.filter(c => c.billing_status === 'skip').reduce((sum, c) => sum + c.price, 0) || 0 
            }
          },
          
          overallHealthScore: customer.healthScore,
          highestChurnRisk: customer.churnRisk,
          averageRenewalProbability: customer.renewalProbability.probability,
          nextRenewalDate: customer.effective_end_date || customer.contract_end_date,
          daysToNextRenewal: customer.effective_end_date
            ? Math.ceil((new Date(customer.effective_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : customer.contractProgress.daysRemaining,
          earliestContractStartDate: customer.contract_start_date,

          is_active: customer.is_active || false,
          isTerminated: !!customer.terminated_at,
          effectiveEndDate: customer.effective_end_date || null,
          hasExpiringSites: customer.contractProgress.daysRemaining <= 90,
          hasHighRiskSites: customer.churnRisk.risk === 'high',
          
          created_at: customer.created_at,
          updated_at: customer.updated_at
        })
      }
    })
    
    // Beräkna aggregerade värden för multisite-organisationer
    consolidatedMap.forEach((org, orgId) => {
      if (org.organizationType === 'multisite') {
        const sites = org.sites
        
        // Aggregera värden
        org.totalSites = sites.length
        // Avropsavtal per site → ackumulerad debitering istället för fast total_contract_value
        org.totalContractValue = sites.reduce((sum, site) => {
          const isAvropsavtal = (!site.annual_value || site.annual_value <= 0) && !!site.contract_start_date
          return sum + (isAvropsavtal ? site.contractBilledAccum : (site.total_contract_value || 0))
        }, 0)
        org.totalAnnualValue = sites.reduce((sum, site) => sum + (site.annual_value || 0), 0)
        org.totalMonthlyValue = sites.reduce((sum, site) => sum + (site.monthly_value || 0), 0)
        
        // Aggregera cases-värden
        org.totalCasesValue = sites.reduce((sum, site) => sum + site.casesValue, 0)
        org.totalCasesCount = sites.reduce((sum, site) => sum + site.casesCount, 0)
        org.totalOrganizationValue = org.totalContractValue + org.totalCasesValue
        
        // Aggregera billing status
        org.casesBillingStatus = sites.reduce((acc, site) => {
          site.cases?.forEach(caseItem => {
            acc[caseItem.billing_status].count++
            acc[caseItem.billing_status].value += caseItem.price
          })
          return acc
        }, {
          pending: { count: 0, value: 0 },
          sent: { count: 0, value: 0 },
          paid: { count: 0, value: 0 },
          skip: { count: 0, value: 0 }
        })
        
        // Portal access status
        const sitesWithAccess = sites.filter(site => site.hasPortalAccess).length
        if (sitesWithAccess === sites.length) {
          org.portalAccessStatus = 'full'
        } else if (sitesWithAccess > 0 || org.activeUsersCount > 0) {
          org.portalAccessStatus = 'partial'
        } else {
          org.portalAccessStatus = 'none'
        }
        
        org.pendingInvitationsCount = sites.filter(site => site.invitationStatus === 'pending').length
        
        // Health metrics
        const avgHealth = sites.reduce((sum, site) => sum + site.healthScore.score, 0) / sites.length
        const worstHealth = sites.reduce((worst, site) => 
          site.healthScore.score < worst ? site.healthScore.score : worst, 100
        )
        org.overallHealthScore = {
          score: Math.round(avgHealth),
          level: worstHealth >= 80 ? 'excellent' : worstHealth >= 60 ? 'good' : worstHealth >= 40 ? 'fair' : 'poor',
          color: worstHealth >= 80 ? '#10b981' : worstHealth >= 60 ? '#f59e0b' : worstHealth >= 40 ? '#f97316' : '#ef4444',
          breakdown: {
            contractAge: { value: 0, weight: 0.25, score: 0 },
            communicationFrequency: { value: 0, weight: 0.25, score: 0 },
            supportTickets: { value: 0, weight: 0.25, score: 0 },
            paymentHistory: { value: 0, weight: 0.25, score: 0 }
          },
          tooltip: `Health Score: ${Math.round(avgHealth)}/100`
        }
        
        // Churn risk
        const highestRisk = sites.reduce((max, site) => 
          site.churnRisk.score > max.score ? site.churnRisk : max, 
          { score: 0, risk: 'low' as const, color: '#10b981', factors: [], tooltip: 'Low risk' }
        )
        org.highestChurnRisk = highestRisk
        
        // Renewal probability
        org.averageRenewalProbability = sites.reduce((sum, site) => sum + site.renewalProbability.probability, 0) / sites.length
        
        // Next renewal — prefer effective_end_date if terminated
        const nextRenewal = sites
          .filter(site => site.effective_end_date || site.contract_end_date)
          .sort((a, b) => {
            const dateA = new Date(a.effective_end_date || a.contract_end_date!).getTime()
            const dateB = new Date(b.effective_end_date || b.contract_end_date!).getTime()
            return dateA - dateB
          })[0]

        if (nextRenewal) {
          const renewalDate = nextRenewal.effective_end_date || nextRenewal.contract_end_date
          org.nextRenewalDate = renewalDate
          org.daysToNextRenewal = renewalDate
            ? Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : nextRenewal.contractProgress.daysRemaining
        }
        
        // Earliest contract start
        const earliestStart = sites
          .filter(site => site.contract_start_date)
          .sort((a, b) => new Date(a.contract_start_date!).getTime() - new Date(b.contract_start_date!).getTime())[0]
        
        if (earliestStart) {
          org.earliestContractStartDate = earliestStart.contract_start_date
        }
        
        // Status flags
        org.hasExpiringSites = sites.some(site => site.contractProgress.daysRemaining <= 90)
        org.hasHighRiskSites = sites.some(site => site.churnRisk.risk === 'high')

        // Termination — org is terminated if ALL sites are terminated
        org.isTerminated = sites.every(site => !!site.terminated_at)
        const terminatedSites = sites.filter(s => s.effective_end_date)
        if (terminatedSites.length > 0) {
          // Use the earliest effective_end_date across sites
          const earliest = terminatedSites.sort((a, b) =>
            new Date(a.effective_end_date!).getTime() - new Date(b.effective_end_date!).getTime()
          )[0]
          org.effectiveEndDate = earliest.effective_end_date
        }
      }
    })
    
    const result = Array.from(consolidatedMap.values())
    
    // DEBUG: Log consolidation result
    return result
  }

  // Beräkna analytics baserat på consolidated customers
  const analytics = useMemo<ConsolidatedAnalytics>(() => {
    if (!consolidatedCustomers.length) {
      return {
        totalOrganizations: 0,
        totalSites: 0,
        multisiteOrganizations: 0,
        singleCustomers: 0,
        portfolioValue: 0,
        renewalValue30Days: 0,
        renewalValue90Days: 0,
        averageContractValue: 0,
        averageHealthScore: 0,
        organizationsAtRisk: 0,
        monthlyGrowth: 0,
        totalCustomers: 0,
        activeCustomers: 0,
        terminatedCount: 0,
        netRevenueRetention: 100,
        highRiskCount: 0,
        topOrganizationsByValue: [],
        organizationsAtRiskList: [],
        upcomingRenewals: [],
        portalAccessStats: { fullAccess: 0, partialAccess: 0, noAccess: 0 }
      }
    }

    // Exkludera uppsagda kunder från alla finansiella/operativa KPI:er
    const active = consolidatedCustomers.filter(c => !c.isTerminated)
    const terminatedCount = consolidatedCustomers.length - active.length

    const multisiteOrgs = active.filter(c => c.organizationType === 'multisite')
    const singleCustomers = active.filter(c => c.organizationType === 'single')

    const portfolioValue = active.reduce((sum, c) => sum + c.totalContractValue, 0)
    const averageContractValue = portfolioValue / (active.length || 1)
    const averageHealthScore = active.reduce((sum, c) => sum + c.overallHealthScore.score, 0) / (active.length || 1)

    const organizationsAtRiskCount = active.filter(c =>
      c.highestChurnRisk.risk === 'high' || c.hasHighRiskSites
    ).length

    const totalSites = active.reduce((sum, c) => sum + c.totalSites, 0)

    // Portal access stats
    const portalAccessStats = active.reduce(
      (stats, c) => {
        stats[c.portalAccessStatus === 'full' ? 'fullAccess' :
               c.portalAccessStatus === 'partial' ? 'partialAccess' : 'noAccess']++
        return stats
      },
      { fullAccess: 0, partialAccess: 0, noAccess: 0 }
    )

    // Top organizations by value
    const topOrganizationsByValue = [...active]
      .sort((a, b) => b.totalContractValue - a.totalContractValue)
      .slice(0, 10)

    // Organizations at risk
    const organizationsAtRiskList = active
      .filter(c => c.highestChurnRisk.risk === 'high' || c.hasHighRiskSites)
      .sort((a, b) => b.highestChurnRisk.score - a.highestChurnRisk.score)
      .slice(0, 10)

    // Upcoming renewals
    const upcomingRenewals = active
      .filter(c => c.daysToNextRenewal && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90)
      .sort((a, b) => (a.daysToNextRenewal || 0) - (b.daysToNextRenewal || 0))

    // Additional metrics for KPI cards
    const activeCustomersCount = active.filter(c => c.is_active).length

    return {
      totalOrganizations: active.length,
      totalSites,
      multisiteOrganizations: multisiteOrgs.length,
      singleCustomers: singleCustomers.length,
      portfolioValue,
      renewalValue30Days: active
        .filter(c => c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 30)
        .reduce((sum, c) => sum + c.totalContractValue, 0),
      renewalValue90Days: active
        .filter(c => c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90)
        .reduce((sum, c) => sum + c.totalContractValue, 0),
      averageContractValue,
      averageHealthScore,
      organizationsAtRisk: organizationsAtRiskCount,
      monthlyGrowth: 0,

      // KPI Cards properties
      totalCustomers: active.length,
      activeCustomers: activeCustomersCount,
      terminatedCount,
      netRevenueRetention: 0,
      highRiskCount: organizationsAtRiskCount,

      topOrganizationsByValue,
      organizationsAtRiskList,
      upcomingRenewals,
      portalAccessStats
    }
  }, [consolidatedCustomers])

  // Filter function för consolidated customers
  const filterCustomers = (filters: {
    search?: string
    status?: 'all' | 'active' | 'inactive' | 'expiring' | 'terminated'
    manager?: string
    industry?: string
    healthScore?: 'all' | 'excellent' | 'good' | 'fair' | 'poor'
    portalAccess?: 'all' | 'full' | 'partial' | 'none'
    organizationType?: 'all' | 'multisite' | 'single'
    minValue?: number
    maxValue?: number
  }) => {
    return consolidatedCustomers.filter(customer => {
      // Sökfilter - sök i organisation och alla sites
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesOrg =
          customer.company_name?.toLowerCase().includes(searchLower) ||
          customer.contact_person?.toLowerCase().includes(searchLower) ||
          customer.contact_email?.toLowerCase().includes(searchLower) ||
          customer.organization_number?.includes(filters.search) ||
          customer.customer_number?.toString().includes(filters.search)
        
        const matchesSites = customer.sites.some(site =>
          site.company_name?.toLowerCase().includes(searchLower) ||
          site.contact_person?.toLowerCase().includes(searchLower) ||
          site.contact_email?.toLowerCase().includes(searchLower) ||
          site.site_name?.toLowerCase().includes(searchLower) ||
          site.organization_number?.includes(filters.search)
        )

        // Search in customer contacts
        const matchesContacts = customer.sites.some(site => {
          const strs = contactsSearch.get(site.id)
          return strs?.some(s => s.includes(searchLower))
        })

        if (!matchesOrg && !matchesSites && !matchesContacts) return false
      }
      
      // Organization type filter
      if (filters.organizationType && filters.organizationType !== 'all') {
        if (customer.organizationType !== filters.organizationType) return false
      }
      
      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'active' && !customer.is_active) return false
        if (filters.status === 'inactive' && customer.is_active) return false
        if (filters.status === 'expiring' && !customer.hasExpiringSites) return false
        if (filters.status === 'terminated' && !customer.isTerminated) return false
      }
      
      // Manager filter
      if (filters.manager && filters.manager !== 'all') {
        if (customer.assigned_account_manager !== filters.manager) return false
      }
      
      // Industry filter
      if (filters.industry && filters.industry !== 'all') {
        if (customer.industry_category !== filters.industry) return false
      }
      
      // Health Score filter
      if (filters.healthScore && filters.healthScore !== 'all') {
        if (customer.overallHealthScore.level !== filters.healthScore) return false
      }
      
      // Portal Access filter
      if (filters.portalAccess && filters.portalAccess !== 'all') {
        if (customer.portalAccessStatus !== filters.portalAccess) return false
      }
      
      // Value filters
      if (filters.minValue && customer.totalContractValue < filters.minValue) return false
      if (filters.maxValue && customer.totalContractValue > filters.maxValue) return false
      
      return true
    })
  }

  // Förfiltrerad lista utan uppsagda kunder — för analytics/diagram
  const activeConsolidatedCustomers = useMemo(
    () => consolidatedCustomers.filter(c => !c.isTerminated),
    [consolidatedCustomers]
  )

  const refresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const getContactsForOrganization = (org: ConsolidatedCustomer): ContactSummary[] => {
    return org.sites.flatMap(site => contactsMap.get(site.id) || [])
  }

  return {
    consolidatedCustomers,
    activeConsolidatedCustomers,
    analytics,
    loading,
    error,
    filterCustomers,
    refresh,
    getContactsForOrganization
  }
}

// Re-export all types to ensure they're available 
export { useConsolidatedCustomers as default }
export type { CustomerSite, PortalAccessStatus, ConsolidatedCustomer, ConsolidatedAnalytics }