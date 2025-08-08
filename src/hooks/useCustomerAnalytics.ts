// src/hooks/useCustomerAnalytics.ts - Hook för customer analytics och KPIs

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
}

interface CustomerWithMetrics extends Customer {
  healthScore: ReturnType<typeof calculateHealthScore>
  churnRisk: ReturnType<typeof calculateChurnRisk>
  renewalProbability: ReturnType<typeof calculateRenewalProbability>
  contractProgress: ReturnType<typeof getContractProgress>
  hasPortalAccess?: boolean
  invitationStatus?: 'none' | 'pending' | 'active'
}

interface Analytics {
  // Grundläggande KPIs
  totalCustomers: number
  activeCustomers: number
  inactiveCustomers: number
  portfolioValue: number
  renewalValue30Days: number
  renewalValue90Days: number
  averageContractValue: number
  averageHealthScore: number
  highRiskCount: number
  netRevenueRetention: number
  
  // Fördelningar
  customersByIndustry: { industry: string; count: number; value: number }[]
  customersBySize: { size: string; count: number; value: number }[]
  customersByManager: { manager: string; count: number; value: number }[]
  
  // Top listor
  topCustomersByValue: CustomerWithMetrics[]
  customersAtRisk: CustomerWithMetrics[]
  upcomingRenewals: CustomerWithMetrics[]
  
  // Trender (simulerade för nu)
  monthlyGrowth: number
  quarterlyGrowth: number
  yearlyGrowth: number
}

export function useCustomerAnalytics() {
  const [customers, setCustomers] = useState<CustomerWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Hämta kunder och profiler för portal access
  useEffect(() => {
    fetchCustomersWithMetrics()
  }, [refreshKey])

  const fetchCustomersWithMetrics = async () => {
    try {
      setLoading(true)
      setError(null)

      // Hämta kunder
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Hämta profiler för att kolla portal access
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('customer_id, role')
        .eq('role', 'customer')

      if (profilesError) throw profilesError

      // Skapa en map för snabb lookup av portal access
      const portalAccessMap = new Map<string, boolean>()
      profilesData?.forEach(profile => {
        if (profile.customer_id) {
          portalAccessMap.set(profile.customer_id, true)
        }
      })

      // Hämta inbjudningar
      const { data: invitationsData } = await supabase
        .from('user_invitations')
        .select('customer_id, accepted_at, expires_at')

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
      const enrichedCustomers: CustomerWithMetrics[] = (customersData || []).map(customer => {
        const hasPortalAccess = portalAccessMap.has(customer.id)
        const invitationStatus = invitationMap.get(customer.id) || 'none'
        
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
          invitationStatus: hasPortalAccess ? 'active' : invitationStatus
        }
      })

      setCustomers(enrichedCustomers)
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError('Kunde inte hämta kunddata')
    } finally {
      setLoading(false)
    }
  }

  // Beräkna analytics baserat på customers
  const analytics = useMemo<Analytics>(() => {
    if (!customers.length) {
      return {
        totalCustomers: 0,
        activeCustomers: 0,
        inactiveCustomers: 0,
        portfolioValue: 0,
        renewalValue30Days: 0,
        renewalValue90Days: 0,
        averageContractValue: 0,
        averageHealthScore: 0,
        highRiskCount: 0,
        netRevenueRetention: 100,
        customersByIndustry: [],
        customersBySize: [],
        customersByManager: [],
        topCustomersByValue: [],
        customersAtRisk: [],
        upcomingRenewals: [],
        monthlyGrowth: 0,
        quarterlyGrowth: 0,
        yearlyGrowth: 0
      }
    }

    // Grundläggande KPIs
    const activeCustomers = countActiveCustomers(customers)
    const portfolioValue = calculatePortfolioValue(customers)
    const renewalValue30Days = calculateRenewalValue(customers, 30)
    const renewalValue90Days = calculateRenewalValue(customers, 90)
    const highRiskCount = countHighRiskCustomers(customers)
    
    const averageContractValue = portfolioValue / (customers.length || 1)
    const averageHealthScore = customers.reduce((sum, c) => sum + c.healthScore.score, 0) / customers.length
    
    // Fördelning per industri
    const industryMap = new Map<string, { count: number; value: number }>()
    customers.forEach(customer => {
      const industry = customer.industry_category || 'Okänd'
      const existing = industryMap.get(industry) || { count: 0, value: 0 }
      industryMap.set(industry, {
        count: existing.count + 1,
        value: existing.value + (customer.total_contract_value || 0)
      })
    })
    const customersByIndustry = Array.from(industryMap.entries())
      .map(([industry, data]) => ({ industry, ...data }))
      .sort((a, b) => b.value - a.value)
    
    // Fördelning per storlek
    const sizeMap = new Map<string, { count: number; value: number }>()
    customers.forEach(customer => {
      const size = customer.customer_size || 'unknown'
      const sizeLabel = 
        size === 'large' ? 'Stor' :
        size === 'medium' ? 'Medel' :
        size === 'small' ? 'Liten' : 'Okänd'
      const existing = sizeMap.get(sizeLabel) || { count: 0, value: 0 }
      sizeMap.set(sizeLabel, {
        count: existing.count + 1,
        value: existing.value + (customer.total_contract_value || 0)
      })
    })
    const customersBySize = Array.from(sizeMap.entries())
      .map(([size, data]) => ({ size, ...data }))
      .sort((a, b) => b.value - a.value)
    
    // Fördelning per account manager
    const managerMap = new Map<string, { count: number; value: number }>()
    customers.forEach(customer => {
      const manager = customer.assigned_account_manager || 'Ej tilldelad'
      const existing = managerMap.get(manager) || { count: 0, value: 0 }
      managerMap.set(manager, {
        count: existing.count + 1,
        value: existing.value + (customer.total_contract_value || 0)
      })
    })
    const customersByManager = Array.from(managerMap.entries())
      .map(([manager, data]) => ({ manager, ...data }))
      .sort((a, b) => b.value - a.value)
    
    // Top kunder efter värde
    const topCustomersByValue = [...customers]
      .sort((a, b) => (b.total_contract_value || 0) - (a.total_contract_value || 0))
      .slice(0, 10)
    
    // Kunder i riskzonen
    const customersAtRisk = customers
      .filter(c => c.churnRisk.risk === 'high')
      .sort((a, b) => b.churnRisk.score - a.churnRisk.score)
      .slice(0, 10)
    
    // Kommande förnyelser
    const upcomingRenewals = customers
      .filter(c => {
        const days = c.contractProgress.daysRemaining
        return days > 0 && days <= 90
      })
      .sort((a, b) => a.contractProgress.daysRemaining - b.contractProgress.daysRemaining)
    
    // Simulerade tillväxtsiffror (skulle hämtas från historisk data)
    const monthlyGrowth = 5.2 // %
    const quarterlyGrowth = 15.8 // %
    const yearlyGrowth = 42.3 // %
    
    // Net Revenue Retention (simulerad)
    const netRevenueRetention = 110 // % - över 100% betyder expansion
    
    return {
      totalCustomers: customers.length,
      activeCustomers,
      inactiveCustomers: customers.length - activeCustomers,
      portfolioValue,
      renewalValue30Days,
      renewalValue90Days,
      averageContractValue,
      averageHealthScore,
      highRiskCount,
      netRevenueRetention,
      customersByIndustry,
      customersBySize,
      customersByManager,
      topCustomersByValue,
      customersAtRisk,
      upcomingRenewals,
      monthlyGrowth,
      quarterlyGrowth,
      yearlyGrowth
    }
  }, [customers])

  // Filterfunktioner
  const filterCustomers = (filters: {
    search?: string
    status?: 'all' | 'active' | 'inactive' | 'expiring'
    manager?: string
    industry?: string
    healthScore?: 'all' | 'excellent' | 'good' | 'fair' | 'poor'
    portalAccess?: 'all' | 'active' | 'pending' | 'none'
    minValue?: number
    maxValue?: number
  }) => {
    return customers.filter(customer => {
      // Sökfilter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesSearch = 
          customer.company_name?.toLowerCase().includes(searchLower) ||
          customer.contact_person?.toLowerCase().includes(searchLower) ||
          customer.contact_email?.toLowerCase().includes(searchLower) ||
          customer.organization_number?.includes(filters.search)
        
        if (!matchesSearch) return false
      }
      
      // Statusfilter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'active' && customer.contract_status !== 'active' && customer.contract_status !== 'signed') return false
        if (filters.status === 'inactive' && customer.contract_status !== 'expired' && customer.contract_status !== 'terminated') return false
        if (filters.status === 'expiring' && customer.contractProgress.daysRemaining > 90) return false
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
        if (customer.healthScore.level !== filters.healthScore) return false
      }
      
      // Portal Access filter
      if (filters.portalAccess && filters.portalAccess !== 'all') {
        if (customer.invitationStatus !== filters.portalAccess) return false
      }
      
      // Värdefilter
      if (filters.minValue && (customer.total_contract_value || 0) < filters.minValue) return false
      if (filters.maxValue && (customer.total_contract_value || 0) > filters.maxValue) return false
      
      return true
    })
  }

  // Refresh-funktion
  const refresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return {
    customers,
    analytics,
    loading,
    error,
    filterCustomers,
    refresh
  }
}