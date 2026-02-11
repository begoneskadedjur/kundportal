// src/pages/admin/Customers.tsx - Success Management Dashboard för kundhantering

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, Building2, User, Calendar, Coins,
  AlertTriangle, Activity, Send, Edit3, Users, FilePlus
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CustomerKpiCards from '../../components/admin/customers/CustomerKpiCards'
import CustomerRevenueModal from '../../components/admin/customers/CustomerRevenueModal'
import EmailCampaignModal from '../../components/admin/customers/EmailCampaignModal'
import EditCustomerModal from '../../components/admin/customers/EditCustomerModal'
import RenewalWorkflowModal from '../../components/admin/customers/RenewalWorkflowModal'
import TerminateContractModal from '../../components/admin/customers/TerminateContractModal'
import AddContractCustomerModal from '../../components/admin/customers/AddContractCustomerModal'
import TooltipWrapper from '../../components/ui/TooltipWrapper'
import { useCustomerAnalytics } from '../../hooks/useCustomerAnalytics'
import { useConsolidatedCustomers } from '../../hooks/useConsolidatedCustomers'
import ExpandableOrganizationRow from '../../components/admin/customers/ExpandableOrganizationRow'
import ColumnSelector, { useColumnVisibility } from '../../components/admin/customers/ColumnSelector'
import SiteDetailRow from '../../components/admin/customers/SiteDetailRow'
import MultisiteExpandedTabs from '../../components/admin/customers/MultisiteExpandedTabs'
import MultiSiteCustomerDetailModal from '../../components/admin/customers/MultiSiteCustomerDetailModal'
import SingleCustomerDetailModal from '../../components/admin/customers/SingleCustomerDetailModal'
import { 
  formatCurrency, 
  formatContractPeriod,
  getContractProgress 
} from '../../utils/customerMetrics'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { PriceListService } from '../../services/priceListService'
import type { PriceList, PriceListItemWithArticle } from '../../types/articles'

// Expanded row component för att visa mer detaljer
const ExpandedCustomerRow = ({ customer, colSpan = 10 }: { customer: any; colSpan?: number }) => {
  const [priceListData, setPriceListData] = useState<{
    priceList: PriceList | null
    items: PriceListItemWithArticle[]
  }>({ priceList: null, items: [] })
  const [loadingPriceList, setLoadingPriceList] = useState(false)

  useEffect(() => {
    const fetchPriceList = async () => {
      if (!customer.price_list_id) return
      setLoadingPriceList(true)
      try {
        const [pl, items] = await Promise.all([
          PriceListService.getPriceListById(customer.price_list_id),
          PriceListService.getPriceListItems(customer.price_list_id)
        ])
        setPriceListData({ priceList: pl, items })
      } catch (err) {
        console.error('Error fetching price list:', err)
      } finally {
        setLoadingPriceList(false)
      }
    }
    fetchPriceList()
  }, [customer.price_list_id])

  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-4 bg-slate-800/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kontaktinformation */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Kontaktinformation</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">Kontaktperson:</span>
                <span className="text-white">{customer.contact_person || 'Ej angiven'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">E-post:</span>
                <a href={`mailto:${customer.contact_email}`} className="text-blue-400 hover:text-blue-300">
                  {customer.contact_email}
                </a>
              </div>
              {customer.billing_email && customer.billing_email !== customer.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-400">Faktura:</span>
                  <a href={`mailto:${customer.billing_email}`} className="text-yellow-400 hover:text-yellow-300">
                    {customer.billing_email}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">Telefon:</span>
                <a href={`tel:${customer.contact_phone}`} className="text-blue-400 hover:text-blue-300">
                  {customer.contact_phone || 'Ej angivet'}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400">Adress:</span>
                <span className="text-white">{customer.contact_address || 'Ej angiven'}</span>
              </div>
            </div>
          </div>

          {/* Prislista & Artiklar */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Prislista & Artiklar</h4>
            {loadingPriceList ? (
              <p className="text-xs text-slate-500">Laddar...</p>
            ) : priceListData.priceList ? (
              <div>
                <div className="text-xs text-purple-400 mb-2 font-medium">
                  {priceListData.priceList.name}
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {priceListData.items.length > 0 ? (
                    priceListData.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <span className="text-slate-300">{item.article?.name || 'Okänd'}</span>
                        <span className="text-slate-500 font-mono">
                          {new Intl.NumberFormat('sv-SE').format(item.custom_price)} kr/{item.article?.unit || 'st'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Inga artiklar i prislistan</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Ingen prislista tilldelad</p>
            )}
          </div>

          {/* Health Score Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Health Score Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(customer.healthScore.breakdown).map(([key, data]: [string, any]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{data.score}/100</span>
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          data.score >= 80 ? 'bg-green-500' :
                          data.score >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${data.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Avtalsinformation */}
        {customer.agreement_text && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Avtalstext</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {customer.agreement_text}
            </p>
          </div>
        )}
      </td>
    </tr>
  )
}

export default function Customers() {
  const navigate = useNavigate()
  // Use consolidated customers hook instead of regular customer analytics
  const { 
    consolidatedCustomers, 
    analytics: consolidatedAnalytics, 
    loading, 
    error, 
    filterCustomers: filterConsolidatedCustomers, 
    refresh 
  } = useConsolidatedCustomers()

  // Keep old hook for backwards compatibility with components that need individual customers
  const { customers: legacyCustomers } = useCustomerAnalytics()
  
  // State management
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null)
  const [emailCampaignOpen, setEmailCampaignOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [multiSiteDetailOpen, setMultiSiteDetailOpen] = useState(false)
  const [selectedMultiSiteOrg, setSelectedMultiSiteOrg] = useState<any>(null)
  const [singleCustomerDetailOpen, setSingleCustomerDetailOpen] = useState(false)
  const [selectedSingleCustomer, setSelectedSingleCustomer] = useState<any>(null)
  const [revenueModalOpen, setRevenueModalOpen] = useState(false)
  const [revenueCustomer, setRevenueCustomer] = useState<any>(null)
  const [renewalModalOpen, setRenewalModalOpen] = useState(false)
  const [renewalOrganization, setRenewalOrganization] = useState<any>(null)
  const [terminateModalOpen, setTerminateModalOpen] = useState(false)
  const [terminateOrganization, setTerminateOrganization] = useState<any>(null)
  const [addContractCustomerOpen, setAddContractCustomerOpen] = useState(false)

  // Filter states — searchInput är UI-state, searchTerm debouncas för prestanda vid 3000+ kunder
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expiring' | 'terminated'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all')
  const [portalFilter, setPortalFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all')
  const [managerFilter, setManagerFilter] = useState<string>('all')
  const [organizationTypeFilter, setOrganizationTypeFilter] = useState<'all' | 'multisite' | 'single'>('all')

  // Sortering
  const [sortField, setSortField] = useState<string>('company_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Paginering
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // Kolumnväljare
  const { visibleColumns, toggleColumn, resetToDefaults } = useColumnVisibility()

  // Kollapserbara filter
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const activeFilterCount = [statusFilter, healthFilter, portalFilter, organizationTypeFilter, managerFilter]
    .filter(f => f !== 'all').length

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const result = filterConsolidatedCustomers({
      search: searchTerm,
      status: statusFilter,
      healthScore: healthFilter,
      portalAccess: portalFilter,
      manager: managerFilter === 'all' ? undefined : managerFilter,
      organizationType: organizationTypeFilter === 'all' ? undefined : organizationTypeFilter
    })

    return result
  }, [consolidatedCustomers, searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, organizationTypeFilter, filterConsolidatedCustomers])

  // Sorterade kunder
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'company_name':
          aVal = a.company_name; bVal = b.company_name; break
        case 'totalAnnualValue':
          aVal = a.totalAnnualValue || 0; bVal = b.totalAnnualValue || 0; break
        case 'totalCasesValue':
          aVal = a.totalCasesValue || 0; bVal = b.totalCasesValue || 0; break
        case 'totalContractValue':
          aVal = a.totalContractValue; bVal = b.totalContractValue; break
        case 'daysToNextRenewal':
          aVal = a.daysToNextRenewal ?? 9999; bVal = b.daysToNextRenewal ?? 9999; break
        case 'healthScore':
          aVal = a.overallHealthScore.score; bVal = b.overallHealthScore.score; break
        case 'churnRisk':
          aVal = a.highestChurnRisk.score; bVal = b.highestChurnRisk.score; break
        default: return 0
      }
      if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDirection === 'asc' ? (aVal - bVal) : (bVal - aVal)
    })
  }, [filteredCustomers, sortField, sortDirection])

  // Paginerade kunder
  const paginatedCustomers = sortedCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const totalPages = Math.ceil(sortedCustomers.length / pageSize)

  // Sorteringshantering
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  // Snabbvy-counts (beräknas på hela datasetet, inte filtrerat)
  const expiringCount = consolidatedCustomers.filter(c => c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90).length
  const highRiskCount = consolidatedAnalytics.organizationsAtRisk
  const multisiteCount = consolidatedAnalytics.multisiteOrganizations
  const terminatedCount = consolidatedCustomers.filter(c => c.isTerminated).length

  // Aktiv preset-detektering
  const activePreset = statusFilter === 'expiring' ? 'expiring'
    : statusFilter === 'terminated' ? 'terminated'
    : healthFilter === 'poor' ? 'highrisk'
    : organizationTypeFilter === 'multisite' ? 'multisite'
    : 'all'

  // Reset alla filter
  const resetFilters = () => {
    setSearchInput(''); setStatusFilter('all'); setHealthFilter('all')
    setPortalFilter('all'); setOrganizationTypeFilter('all'); setManagerFilter('all')
    setSortField('company_name'); setSortDirection('asc')
    setCurrentPage(1)
  }

  // Applicera preset
  const applyPreset = (preset: string) => {
    setSearchInput(''); setHealthFilter('all'); setPortalFilter('all'); setManagerFilter('all')
    setCurrentPage(1)

    switch (preset) {
      case 'expiring':
        setStatusFilter('expiring'); setOrganizationTypeFilter('all')
        setSortField('daysToNextRenewal'); setSortDirection('asc')
        break
      case 'highrisk':
        setStatusFilter('all'); setOrganizationTypeFilter('all'); setHealthFilter('poor')
        setSortField('churnRisk'); setSortDirection('desc')
        break
      case 'multisite':
        setStatusFilter('all'); setOrganizationTypeFilter('multisite')
        break
      case 'terminated':
        setStatusFilter('terminated'); setOrganizationTypeFilter('all')
        setSortField('company_name'); setSortDirection('asc')
        break
    }
  }

  // Reset paginering vid filterändring
  useEffect(() => { setCurrentPage(1) }, [searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, organizationTypeFilter])

  // Toggle expanded row
  const toggleExpandedRow = (customerId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedRows(newExpanded)
  }

  // Portal invitation for consolidated customers
  const inviteToPortal = async (organization: any) => {
    setSendingInvitation(organization.id)
    try {
      if (organization.organizationType === 'multisite') {
        // For multisite - invite organization
        toast.info('Multisite portal-inbjudan kommer snart...')
        // TODO: Implement multisite portal invitation
      } else {
        // For single customer - use existing logic
        const singleCustomer = organization.sites[0]
        const response = await fetch('/api/create-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name: singleCustomer.company_name,
            contact_person: singleCustomer.contact_person,
            contact_email: singleCustomer.contact_email,
            contact_phone: singleCustomer.contact_phone,
            customer_id: singleCustomer.id,
            skip_customer_creation: true
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Kunde inte skicka inbjudan')
        }
        
        toast.success('Portal-inbjudan skickad!')
      }
      refresh()
    } catch (error: any) {
      console.error('Error inviting to portal:', error)
      toast.error(error.message || 'Ett fel uppstod')
    } finally {
      setSendingInvitation(null)
    }
  }

  // Handle customer edit
  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer)
    setEditModalOpen(true)
  }

  const handleCustomerSaved = (updatedCustomer: any) => {
    // Refresh the data to show updated information
    refresh()
  }

  // Handle multisite detail view - Opens detailed modal for multisite organizations
  const handleViewMultiSiteDetails = (organization: any) => {
    setSelectedMultiSiteOrg(organization)
    setMultiSiteDetailOpen(true)
  }

  // Handle single customer detail view - Opens detailed modal for single customers
  const handleViewSingleCustomerDetails = (organization: any) => {
    setSelectedSingleCustomer(organization)
    setSingleCustomerDetailOpen(true)
  }

  // Handle revenue modal
  const handleViewRevenue = (organization: any) => {
    setRevenueCustomer(organization)
    setRevenueModalOpen(true)
  }

  const handleStartRenewal = (organization: any) => {
    setRenewalOrganization(organization)
    setRenewalModalOpen(true)
  }

  const handleTerminate = (organization: any) => {
    setTerminateOrganization(organization)
    setTerminateModalOpen(true)
  }

  // Get unique managers for filter
  const uniqueManagers = useMemo(() => {
    const managers = new Set<string>()
    consolidatedCustomers.forEach(c => {
      if (c.assigned_account_manager) {
        managers.add(c.assigned_account_manager)
      }
    })
    return Array.from(managers).sort()
  }, [consolidatedCustomers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <Card className="p-8 bg-red-500/10 border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-center">{error}</p>
          <Button onClick={refresh} className="mt-4">
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sidtitel + åtgärdsknappar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kunder</h1>
          <p className="text-sm text-slate-400 mt-1">Hantera kundrelationer och maximera kundvärde</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddContractCustomerOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
            title="Lägg till avtalskund från PDF"
          >
            <FilePlus className="w-4 h-4" />
            <span className="hidden md:inline">Lägg till avtalskund</span>
          </button>
          <div className="w-px h-6 bg-slate-700" />
          <button
            onClick={() => setEmailCampaignOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
            title="Skicka e-postkampanj"
          >
            <Send className="w-4 h-4" />
            <span className="hidden md:inline">E-postkampanj</span>
          </button>
          <div className="w-px h-6 bg-slate-700" />
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Uppdatera</span>
          </button>
          <button
            onClick={() => navigate('/admin/customers/analytics')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline">Detaljerad Analytics</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <CustomerKpiCards analytics={consolidatedAnalytics} />

      {/* Varningsbanner för utgående avtal */}
      {consolidatedAnalytics.upcomingRenewals.length > 0 && (
        <div className={`flex items-center justify-between p-4 rounded-lg border mb-4 ${
          consolidatedAnalytics.upcomingRenewals.some(r => (r.daysToNextRenewal || 0) <= 30)
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
              consolidatedAnalytics.upcomingRenewals.some(r => (r.daysToNextRenewal || 0) <= 30)
                ? 'text-red-400'
                : 'text-amber-400'
            }`} />
            <div>
              <p className={`text-sm font-medium ${
                consolidatedAnalytics.upcomingRenewals.some(r => (r.daysToNextRenewal || 0) <= 30)
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}>
                {consolidatedAnalytics.upcomingRenewals.length} avtal löper ut inom 90 dagar
              </p>
              <p className="text-xs text-slate-400">
                Totalt värde: {formatCurrency(consolidatedAnalytics.renewalValue90Days)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('expiring')
              setSearchInput('')
              setHealthFilter('all')
              setPortalFilter('all')
              setOrganizationTypeFilter('all')
              setManagerFilter('all')
            }}
            className={`${
              consolidatedAnalytics.upcomingRenewals.some(r => (r.daysToNextRenewal || 0) <= 30)
                ? 'text-red-400 hover:text-red-300'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            Visa utgående avtal
          </Button>
        </div>
      )}

      {/* Main content */}
      <div>
          {/* Filters */}
          <Card className="p-4 mb-6 overflow-visible relative z-20">
            <div className="flex gap-3">
              {/* Sökfält — alltid synligt */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontaktperson, e-post eller org.nr..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {/* Filter toggle-knapp */}
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  filtersExpanded || activeFilterCount > 0
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {/* Kolumnväljare */}
              <ColumnSelector visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetToDefaults} />
            </div>

            {/* Collapsible filter dropdowns */}
            {filtersExpanded && (
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-700">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Alla status</option>
                  <option value="active">Aktiva</option>
                  <option value="inactive">Inaktiva</option>
                  <option value="expiring">Löper ut snart</option>
                  <option value="terminated">Uppsagda</option>
                </select>

                <select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Alla hälsonivåer</option>
                  <option value="excellent">Utmärkt (80+)</option>
                  <option value="good">Bra (60-79)</option>
                  <option value="fair">Acceptabel (40-59)</option>
                  <option value="poor">Risk (0-39)</option>
                </select>

                <select
                  value={portalFilter}
                  onChange={(e) => setPortalFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Portaltillgång</option>
                  <option value="full">Full tillgång</option>
                  <option value="partial">Delvis tillgång</option>
                  <option value="none">Ingen tillgång</option>
                </select>

                <select
                  value={organizationTypeFilter}
                  onChange={(e) => setOrganizationTypeFilter(e.target.value as any)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Alla typer</option>
                  <option value="multisite">Multisite</option>
                  <option value="single">Enkelsites</option>
                </select>

                {uniqueManagers.length > 0 && (
                  <select
                    value={managerFilter}
                    onChange={(e) => setManagerFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="all">Alla säljare</option>
                    {uniqueManagers.map(manager => (
                      <option key={manager} value={manager}>{manager}</option>
                    ))}
                  </select>
                )}

                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter('all'); setHealthFilter('all'); setPortalFilter('all')
                      setOrganizationTypeFilter('all'); setManagerFilter('all')
                    }}
                    className="px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Rensa filter
                  </button>
                )}
              </div>
            )}
          </Card>

          {/* Snabbvy-knappar */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-400 font-medium mr-1">Snabbvy:</span>
            <button
              onClick={() => resetFilters()}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'all'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
              }`}
            >
              Alla ({sortedCustomers.length})
            </button>
            <button
              onClick={() => applyPreset('expiring')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'expiring'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              Utgående avtal ({expiringCount})
            </button>
            <button
              onClick={() => applyPreset('highrisk')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'highrisk'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/30'
              }`}
            >
              Hög risk ({highRiskCount})
            </button>
            <button
              onClick={() => applyPreset('multisite')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'multisite'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-blue-400 hover:border-blue-500/30'
              }`}
            >
              Multisite ({multisiteCount})
            </button>
            {terminatedCount > 0 && (
              <button
                onClick={() => applyPreset('terminated')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activePreset === 'terminated'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/30'
                }`}
              >
                Uppsagda ({terminatedCount})
              </button>
            )}
          </div>

          {/* Consolidated Customer table */}
          <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/95 backdrop-blur border-b border-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('company_name')}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        Organisation & Kontakt
                        {sortField === 'company_name' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    {visibleColumns.has('annualValue') && (
                      <th className="px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalAnnualValue')}>
                        <div className="flex items-center justify-end gap-2">
                          <Coins className="w-4 h-4 text-green-400" />
                          Årspremie
                          {sortField === 'totalAnnualValue' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('casesValue') && (
                      <th className="hidden lg:table-cell px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalCasesValue')}>
                        <div className="flex items-center justify-end gap-2">
                          <Coins className="w-4 h-4 text-blue-400" />
                          Debiterat utöver avtal
                          {sortField === 'totalCasesValue' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('contractValue') && (
                      <th className="px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalContractValue')}>
                        <div className="flex items-center justify-end gap-2">
                          <Coins className="w-4 h-4 text-yellow-400" />
                          Avtalsvärde
                          {sortField === 'totalContractValue' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('contractPeriod') && (
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('daysToNextRenewal')}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          Kontraktsperiod
                          {sortField === 'daysToNextRenewal' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('healthScore') && (
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('healthScore')}>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-green-400" />
                          Health Score
                          {sortField === 'healthScore' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('churnRisk') && (
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('churnRisk')}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          Churn Risk
                          {sortField === 'churnRisk' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has('manager') && (
                      <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-400" />
                          Säljare
                        </div>
                      </th>
                    )}
                    <th className="px-6 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <Edit3 className="w-4 h-4 text-slate-400" />
                        Åtgärder
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((organization) => {
                    const isExpanded = expandedRows.has(organization.id)

                    return (
                      <React.Fragment key={organization.id}>
                        {/* Organization main row */}
                        <ExpandableOrganizationRow
                          organization={organization}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpandedRow(organization.id)}
                          onInviteToPortal={inviteToPortal}
                          onEdit={(org) => handleEditCustomer(org.sites[0])}
                          onViewMultiSiteDetails={handleViewMultiSiteDetails}
                          onViewSingleCustomerDetails={handleViewSingleCustomerDetails}
                          onViewRevenue={handleViewRevenue}
                          onRenewal={handleStartRenewal}
                          onTerminate={handleTerminate}
                          visibleColumns={visibleColumns}
                        />

                        {/* Contact and units expanded view for multisite organizations */}
                        {isExpanded && organization.organizationType === 'multisite' && (
                          <MultisiteExpandedTabs organization={organization} colSpan={visibleColumns.size} />
                        )}

                        {/* Expanded details for single-site customers */}
                        {isExpanded && organization.organizationType === 'single' && (
                          <ExpandedCustomerRow customer={organization.sites[0]} colSpan={visibleColumns.size} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>

              {sortedCustomers.length === 0 && (
                <div className="text-center py-20 bg-slate-800/20">
                  <div className="mx-auto w-fit p-4 rounded-full bg-slate-700/30 border border-slate-600/50 mb-6">
                    <Building2 className="w-16 h-16 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">
                    {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' || organizationTypeFilter !== 'all'
                      ? 'Inga organisationer matchar dina filter'
                      : 'Inga organisationer registrerade'}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto">
                    {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' || organizationTypeFilter !== 'all'
                      ? 'Prova att justera dina filterkriterier för att hitta organisationer.'
                      : 'Organisationer kommer att visas här när de läggs till i systemet.'}
                  </p>
                </div>
              )}

              {/* Pagineringsfooter */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 bg-slate-800/50 border-t border-slate-700">
                  <span className="text-sm text-slate-400">
                    Visar {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, sortedCustomers.length)} av {sortedCustomers.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Föregående
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .map((page, idx, arr) => (
                        <React.Fragment key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <span className="text-slate-500 text-xs">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                              page === currentPage
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      ))
                    }
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Nästa
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
      </div>

      {/* Email Campaign Modal */}
      <EmailCampaignModal
        isOpen={emailCampaignOpen}
        onClose={() => setEmailCampaignOpen(false)}
        customers={legacyCustomers || []}
      />

      {/* Edit Customer Modal */}
      <EditCustomerModal
        customer={editingCustomer}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingCustomer(null)
        }}
        onSave={handleCustomerSaved}
      />

      {/* MultiSite Customer Detail Modal */}
      <MultiSiteCustomerDetailModal
        organization={selectedMultiSiteOrg}
        isOpen={multiSiteDetailOpen}
        onClose={() => {
          setMultiSiteDetailOpen(false)
          setSelectedMultiSiteOrg(null)
        }}
      />

      {/* Single Customer Detail Modal */}
      <SingleCustomerDetailModal
        customer={selectedSingleCustomer}
        isOpen={singleCustomerDetailOpen}
        onClose={() => {
          setSingleCustomerDetailOpen(false)
          setSelectedSingleCustomer(null)
        }}
      />

      {/* Revenue Modal */}
      <CustomerRevenueModal
        customer={revenueCustomer}
        isOpen={revenueModalOpen}
        onClose={() => {
          setRevenueModalOpen(false)
          setRevenueCustomer(null)
        }}
      />

      {/* Renewal Workflow Modal */}
      <RenewalWorkflowModal
        organization={renewalOrganization}
        isOpen={renewalModalOpen}
        onClose={() => {
          setRenewalModalOpen(false)
          setRenewalOrganization(null)
        }}
      />

      {/* Terminate Contract Modal */}
      <TerminateContractModal
        organization={terminateOrganization}
        isOpen={terminateModalOpen}
        onClose={() => {
          setTerminateModalOpen(false)
          setTerminateOrganization(null)
        }}
        onTerminated={refresh}
      />

      {/* Add Contract Customer Modal */}
      <AddContractCustomerModal
        isOpen={addContractCustomerOpen}
        onClose={() => setAddContractCustomerOpen(false)}
        onCustomerCreated={refresh}
      />
    </div>
  )
}