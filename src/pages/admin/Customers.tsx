// src/pages/admin/Customers.tsx - Success Management Dashboard för kundhantering

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, Building2, User, Calendar, DollarSign,
  ChevronLeft, ChevronRight, X, UserPlus, ExternalLink,
  TrendingUp, AlertTriangle, Activity, Send, Edit3, Users
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { PageHeader } from '../../components/shared'
import CustomerKpiCards from '../../components/admin/customers/CustomerKpiCards'
import HealthScoreBadge from '../../components/admin/customers/HealthScoreBadge'
import ChurnRiskBadge from '../../components/admin/customers/ChurnRiskBadge'
import PortalAccessBadge from '../../components/admin/customers/PortalAccessBadge'
import EmailCampaignModal from '../../components/admin/customers/EmailCampaignModal'
import EditCustomerModal from '../../components/admin/customers/EditCustomerModal'
import ARRForecastChart from '../../components/admin/customers/ARRForecastChart'
import TooltipWrapper from '../../components/ui/TooltipWrapper'
import { useCustomerAnalytics } from '../../hooks/useCustomerAnalytics'
import { useConsolidatedCustomers } from '../../hooks/useConsolidatedCustomers'
import ExpandableOrganizationRow from '../../components/admin/customers/ExpandableOrganizationRow'
import SiteDetailRow from '../../components/admin/customers/SiteDetailRow'
import MultiSiteCustomerDetailModal from '../../components/admin/customers/MultiSiteCustomerDetailModal'
import { 
  formatCurrency, 
  formatContractPeriod,
  getContractProgress 
} from '../../utils/customerMetrics'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Expanded row component för att visa mer detaljer
const ExpandedCustomerRow = ({ customer }: { customer: any }) => {
  const products = useMemo(() => {
    if (!customer.products) return []
    try {
      const parsed = typeof customer.products === 'string' 
        ? JSON.parse(customer.products) 
        : customer.products
      
      if (Array.isArray(parsed)) {
        const allProducts: any[] = []
        parsed.forEach((group: any) => {
          if (group.products && Array.isArray(group.products)) {
            group.products.forEach((product: any) => {
              allProducts.push({
                name: product.name || 'Okänd produkt',
                quantity: product.quantity?.amount || product.quantity || 1,
                description: product.description || ''
              })
            })
          }
        })
        return allProducts
      }
    } catch (error) {
      console.error('Error parsing products:', error)
    }
    return []
  }, [customer.products])

  return (
    <tr>
      <td colSpan={9} className="px-4 py-4 bg-slate-800/30">
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

          {/* Produkter */}
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-3">Produkter & Tjänster</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {products.length > 0 ? (
                products.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-300">{product.name}</span>
                    <span className="text-slate-500 font-mono">{product.quantity}x</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">Inga produkter registrerade</p>
              )}
            </div>
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
  
  // DEBUG: Log consolidated customers data in frontend
  console.log('🎨 FRONTEND DEBUG - consolidatedCustomers:', consolidatedCustomers.length)
  console.log('🎨 FRONTEND DEBUG - Multisite orgs:', consolidatedCustomers.filter(c => c.organizationType === 'multisite').length)
  console.log('🎨 FRONTEND DEBUG - Sample data:', consolidatedCustomers.slice(0, 2))
  
  // Keep old hook for backwards compatibility with components that need individual customers
  const { customers: legacyCustomers } = useCustomerAnalytics()
  
  // State management
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [emailCampaignOpen, setEmailCampaignOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [multiSiteDetailOpen, setMultiSiteDetailOpen] = useState(false)
  const [selectedMultiSiteOrg, setSelectedMultiSiteOrg] = useState<any>(null)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expiring'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all')
  const [portalFilter, setPortalFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all')
  const [managerFilter, setManagerFilter] = useState<string>('all')
  const [organizationTypeFilter, setOrganizationTypeFilter] = useState<'all' | 'multisite' | 'single'>('all')

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
    
    // DEBUG: Log filtering results
    console.log('🔽 FILTER DEBUG - Applied filters:', { searchTerm, statusFilter, healthFilter, organizationTypeFilter })
    console.log('🔽 FILTER DEBUG - Filtered result:', result.length)
    console.log('🔽 FILTER DEBUG - Multisite in filtered result:', result.filter(c => c.organizationType === 'multisite').length)
    
    return result
  }, [consolidatedCustomers, searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, organizationTypeFilter, filterConsolidatedCustomers])

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
    console.log('🚀 MODAL DEBUG - Opening multisite detail for:', organization.company_name)
    console.log('🚀 MODAL DEBUG - Organization data:', organization)
    setSelectedMultiSiteOrg(organization)
    setMultiSiteDetailOpen(true)
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
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
    <div className="space-y-6">
      <PageHeader 
        title="Success Management"
        subtitle="Hantera kundrelationer och maximera kundvärde"
        icon={TrendingUp}
        iconColor="text-green-500"
        showBackButton={true}
        backPath="/admin/dashboard"
        rightContent={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEmailCampaignOpen(true)}
              className="flex items-center gap-2 text-slate-400 hover:text-green-400 hover:bg-green-400/10"
              title="Skicka e-postkampanj"
            >
              <Send className="w-4 h-4" />
              <span className="hidden md:inline">E-postkampanj</span>
            </Button>
            <div className="w-px h-6 bg-slate-700"></div>
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Uppdatera
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-2"
            >
              {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              Analytics
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <CustomerKpiCards analytics={consolidatedAnalytics} />

      {/* Main content with sidebar */}
      <div className="relative">
        <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:mr-96' : ''}`}>
          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontaktperson, e-post eller org.nr..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Alla status</option>
                <option value="active">Aktiva</option>
                <option value="inactive">Inaktiva</option>
                <option value="expiring">Löper ut snart</option>
              </select>

              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value as any)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Health</option>
                <option value="excellent">Excellent (80+)</option>
                <option value="good">Good (60-79)</option>
                <option value="fair">Fair (40-59)</option>
                <option value="poor">Poor (0-39)</option>
              </select>

              <select
                value={portalFilter}
                onChange={(e) => setPortalFilter(e.target.value as any)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Portal Access</option>
                <option value="full">Full tillgång</option>
                <option value="partial">Delvis tillgång</option>
                <option value="none">Ingen tillgång</option>
              </select>

              <select
                value={organizationTypeFilter}
                onChange={(e) => setOrganizationTypeFilter(e.target.value as any)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Alla typer</option>
                <option value="multisite">Multisite</option>
                <option value="single">Enkelsites</option>
              </select>

              {uniqueManagers.length > 0 && (
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="all">Alla säljare</option>
                  {uniqueManagers.map(manager => (
                    <option key={manager} value={manager}>{manager}</option>
                  ))}
                </select>
              )}
            </div>
          </Card>

          {/* Consolidated Customer table */}
          <Card className="overflow-hidden border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/70 border-b border-slate-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        Organisation & Kontakt
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-400" />
                        Portal
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-2">
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                        Kontraktsvärde
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-400" />
                        Kontraktsperiod
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-green-400" />
                        Health Score
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        Churn Risk
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        Säljare
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-slate-300 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-2">
                        <Edit3 className="w-4 h-4 text-slate-400" />
                        Åtgärder
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((organization) => {
                    const isExpanded = expandedRows.has(organization.id)

                    return (
                      <React.Fragment key={organization.id}>
                        {/* Organization main row */}
                        <ExpandableOrganizationRow
                          organization={organization}
                          isExpanded={isExpanded}
                          onToggle={() => toggleExpandedRow(organization.id)}
                          onInviteToPortal={inviteToPortal}
                          onEdit={(org) => handleEditCustomer(org.sites[0])} // Edit first site for now
                          onViewMultiSiteDetails={handleViewMultiSiteDetails}
                        />
                        
                        {/* Site detail rows (only for multisite when expanded) */}
                        {isExpanded && organization.organizationType === 'multisite' && 
                          organization.sites.map((site) => (
                            <SiteDetailRow
                              key={site.id}
                              site={site}
                              indentLevel={1}
                              onSiteEdit={(site) => handleEditCustomer(site)}
                            />
                          ))
                        }
                        
                        {/* Expanded details for single-site customers */}
                        {isExpanded && organization.organizationType === 'single' && (
                          <ExpandedCustomerRow customer={organization.sites[0]} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>

              {filteredCustomers.length === 0 && (
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
            </div>
          </Card>
        </div>

        {/* Analytics Sidebar */}
        <div className={`
          fixed top-0 right-0 h-full w-96 
          bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 
          transform transition-all duration-300 z-40 overflow-y-auto shadow-2xl
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="p-6 space-y-6">
            {/* Sidebar header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Portfolio Analytics</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* ARR Forecast - Prominent feature */}
            <ARRForecastChart customers={legacyCustomers || []} />

            {/* Separator */}
            <div className="border-t border-slate-700"></div>

            {/* Organization statistics */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Organisationsöversikt</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-xs text-slate-400">Totalt organisationer</span>
                  <span className="text-sm font-medium text-white">{consolidatedAnalytics.totalOrganizations}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded">
                  <span className="text-xs text-slate-400">Multisite-organisationer</span>
                  <span className="text-sm font-medium text-blue-400">{consolidatedAnalytics.multisiteOrganizations}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                  <span className="text-xs text-slate-400">Enkelkunder</span>
                  <span className="text-sm font-medium text-white">{consolidatedAnalytics.singleCustomers}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                  <span className="text-xs text-slate-400">Totalt enheter</span>
                  <span className="text-sm font-medium text-green-400">{consolidatedAnalytics.totalSites}</span>
                </div>
              </div>
            </Card>

            {/* Top organizations */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Top 5 Organisationer</h4>
              <div className="space-y-2">
                {consolidatedAnalytics.topOrganizationsByValue.slice(0, 5).map((organization, idx) => (
                  <div 
                    key={organization.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSearchTerm(organization.company_name)
                      setSidebarOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">#{idx + 1}</span>
                      <div>
                        <p className="text-sm text-white truncate">
                          {organization.company_name}
                        </p>
                        <div className="flex items-center gap-2">
                          <HealthScoreBadge
                            score={organization.overallHealthScore.score}
                            level={organization.overallHealthScore.level}
                            tooltip=""
                            size="sm"
                            showIcon={false}
                          />
                          {organization.organizationType === 'multisite' && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                              {organization.totalSites} enheter
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(organization.totalContractValue)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* At risk organizations */}
            {consolidatedAnalytics.organizationsAtRiskList.length > 0 && (
              <Card className="p-4 bg-red-500/10 border-red-500/20">
                <h4 className="text-sm font-medium text-red-400 mb-3">
                  Organisationer i Riskzonen ({consolidatedAnalytics.organizationsAtRiskList.length})
                </h4>
                <div className="space-y-2">
                  {consolidatedAnalytics.organizationsAtRiskList.slice(0, 5).map((organization) => (
                    <div 
                      key={organization.id}
                      className="p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                      onClick={() => {
                        setSearchTerm(organization.company_name)
                        setSidebarOpen(false)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white truncate">{organization.company_name}</p>
                        {organization.organizationType === 'multisite' && (
                          <span className="text-xs bg-red-200 text-red-800 px-1 py-0.5 rounded">
                            {organization.totalSites} enheter
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <ChurnRiskBadge
                          risk={organization.highestChurnRisk.risk}
                          score={organization.highestChurnRisk.score}
                          tooltip=""
                          size="sm"
                          showIcon={false}
                        />
                        <span className="text-xs text-slate-500">
                          {organization.daysToNextRenewal ? `${organization.daysToNextRenewal} dagar kvar` : 'Okänt'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Upcoming renewals */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                Kommande Förnyelser ({consolidatedAnalytics.upcomingRenewals.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {consolidatedAnalytics.upcomingRenewals.map((organization) => (
                  <div 
                    key={organization.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSearchTerm(organization.company_name)
                      setSidebarOpen(false)
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white truncate">{organization.company_name}</p>
                        {organization.organizationType === 'multisite' && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-1 py-0.5 rounded">
                            {organization.totalSites} enheter
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(organization.totalContractValue)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${
                      (organization.daysToNextRenewal || 0) <= 30 ? 'text-red-400' :
                      (organization.daysToNextRenewal || 0) <= 60 ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      {organization.daysToNextRenewal || 0} dagar
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Growth metrics */}
            <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Tillväxt Metrics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Portal-tillgång</p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <span className="text-green-400">✓ {consolidatedAnalytics.portalAccessStats.fullAccess}</span>
                    <span className="text-yellow-400">⚠ {consolidatedAnalytics.portalAccessStats.partialAccess}</span>
                    <span className="text-gray-400">✗ {consolidatedAnalytics.portalAccessStats.noAccess}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Genomsnittsvärde</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(consolidatedAnalytics.averageContractValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Health Score</p>
                  <p className="text-lg font-bold text-green-400">
                    {consolidatedAnalytics.averageHealthScore.toFixed(0)}/100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">I riskzonen</p>
                  <p className="text-lg font-bold text-red-400">
                    {consolidatedAnalytics.organizationsAtRisk}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
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
    </div>
  )
}