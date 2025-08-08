// src/pages/admin/Customers.tsx - Success Management Dashboard för kundhantering

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, Building2, User, Calendar, DollarSign,
  ChevronLeft, ChevronRight, X, UserPlus, ExternalLink,
  TrendingUp, AlertTriangle, Activity
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
import TooltipWrapper from '../../components/ui/TooltipWrapper'
import { useCustomerAnalytics } from '../../hooks/useCustomerAnalytics'
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
  const { customers, analytics, loading, error, filterCustomers, refresh } = useCustomerAnalytics()
  
  // State management
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [sendingInvitation, setSendingInvitation] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expiring'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all')
  const [portalFilter, setPortalFilter] = useState<'all' | 'active' | 'pending' | 'none'>('all')
  const [managerFilter, setManagerFilter] = useState<string>('all')

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return filterCustomers({
      search: searchTerm,
      status: statusFilter,
      healthScore: healthFilter,
      portalAccess: portalFilter,
      manager: managerFilter === 'all' ? undefined : managerFilter
    })
  }, [customers, searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, filterCustomers])

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

  // Portal invitation
  const inviteToPortal = async (customer: any) => {
    setSendingInvitation(customer.id)
    try {
      // Skapa auth-användare och profil
      const response = await fetch('/api/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: customer.company_name,
          contact_person: customer.contact_person,
          contact_email: customer.contact_email,
          contact_phone: customer.contact_phone,
          customer_id: customer.id,
          skip_customer_creation: true // Vi har redan kunden, skapa bara profil
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka inbjudan')
      }
      
      toast.success('Portal-inbjudan skickad!')
      refresh() // Uppdatera listan
    } catch (error: any) {
      console.error('Error inviting to portal:', error)
      toast.error(error.message || 'Ett fel uppstod')
    } finally {
      setSendingInvitation(null)
    }
  }

  // Get unique managers for filter
  const uniqueManagers = useMemo(() => {
    const managers = new Set<string>()
    customers.forEach(c => {
      if (c.assigned_account_manager) {
        managers.add(c.assigned_account_manager)
      }
    })
    return Array.from(managers).sort()
  }, [customers])

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
      <CustomerKpiCards analytics={analytics} />

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
                <option value="active">Aktiv</option>
                <option value="pending">Inbjuden</option>
                <option value="none">Ej inbjuden</option>
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

          {/* Customer table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Företag & Kontakt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Portal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Kontraktsvärde
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Kontraktsperiod
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Health Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Churn Risk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Säljare
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Åtgärder
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredCustomers.map((customer) => {
                    const isExpanded = expandedRows.has(customer.id)
                    const contractPeriod = formatContractPeriod(
                      customer.contract_start_date,
                      customer.contract_end_date
                    )
                    const progress = customer.contractProgress

                    return (
                      <React.Fragment key={customer.id}>
                        <tr className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {customer.company_name}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {customer.contact_person || 'Ingen kontaktperson'}
                              </p>
                              {customer.organization_number && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Org.nr: {customer.organization_number}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <PortalAccessBadge status={customer.invitationStatus || 'none'} size="sm" />
                          </td>

                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm font-bold text-white">
                                {formatCurrency(customer.total_contract_value)}
                              </p>
                              <p className="text-xs text-green-400 mt-1">
                                {formatCurrency(customer.annual_value)} /år
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatCurrency(customer.monthly_value)} /mån
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <TooltipWrapper content={contractPeriod.tooltip} position="top">
                              <div className="cursor-help">
                                <p className="text-sm text-white">
                                  {contractPeriod.display}
                                </p>
                                <div className="mt-2">
                                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${
                                        progress.status === 'expired' ? 'bg-red-500' :
                                        progress.status === 'expiring-soon' ? 'bg-orange-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${progress.percentage}%` }}
                                    />
                                  </div>
                                </div>
                                <p className={`text-xs mt-1 ${
                                  contractPeriod.isExpired ? 'text-red-400' :
                                  contractPeriod.isExpiringSoon ? 'text-orange-400' :
                                  'text-slate-500'
                                }`}>
                                  {contractPeriod.isExpired ? 'Utgånget' :
                                   contractPeriod.isExpiringSoon ? `${contractPeriod.daysRemaining} dagar kvar!` :
                                   `${contractPeriod.monthsRemaining} månader kvar`}
                                </p>
                              </div>
                            </TooltipWrapper>
                          </td>

                          <td className="px-4 py-4">
                            <HealthScoreBadge
                              score={customer.healthScore.score}
                              level={customer.healthScore.level}
                              tooltip={customer.healthScore.tooltip}
                              size="sm"
                            />
                          </td>

                          <td className="px-4 py-4">
                            <ChurnRiskBadge
                              risk={customer.churnRisk.risk}
                              score={customer.churnRisk.score}
                              tooltip={customer.churnRisk.tooltip}
                              size="sm"
                            />
                          </td>

                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm text-white">
                                {customer.assigned_account_manager || 'Ej tilldelad'}
                              </p>
                              {customer.sales_person && customer.sales_person !== customer.assigned_account_manager && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Såld av: {customer.sales_person}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex justify-center gap-2">
                              {customer.invitationStatus === 'none' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => inviteToPortal(customer)}
                                  disabled={sendingInvitation === customer.id}
                                  className="text-blue-400 hover:text-blue-300"
                                  title="Bjud in till portal"
                                >
                                  {sendingInvitation === customer.id ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    <UserPlus className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.location.href = `mailto:${customer.contact_email}`}
                                className="text-slate-400 hover:text-white"
                                title="Skicka e-post"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>

                              {customer.contact_phone && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.location.href = `tel:${customer.contact_phone}`}
                                  className="text-slate-400 hover:text-white"
                                  title="Ring"
                                >
                                  <Phone className="w-4 h-4" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpandedRow(customer.id)}
                                className="text-slate-400 hover:text-white"
                                title={isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && <ExpandedCustomerRow customer={customer} />}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">
                    {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' 
                      ? 'Inga kunder matchar dina filter'
                      : 'Inga kunder att visa'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Analytics Sidebar */}
        <div className={`
          fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-800 
          transform transition-transform duration-300 z-40 overflow-y-auto
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

            {/* Industry breakdown */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Fördelning per Industri</h4>
              <div className="space-y-2">
                {analytics.customersByIndustry.slice(0, 5).map((item) => (
                  <div key={item.industry} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.industry}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white">{item.count} st</span>
                      <span className="text-xs text-green-400">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top customers */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Top 5 Kunder</h4>
              <div className="space-y-2">
                {analytics.topCustomersByValue.slice(0, 5).map((customer, idx) => (
                  <div 
                    key={customer.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSearchTerm(customer.company_name)
                      setSidebarOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">#{idx + 1}</span>
                      <div>
                        <p className="text-sm text-white truncate">
                          {customer.company_name}
                        </p>
                        <HealthScoreBadge
                          score={customer.healthScore.score}
                          level={customer.healthScore.level}
                          tooltip={customer.healthScore.tooltip}
                          size="sm"
                          showIcon={false}
                        />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-400">
                      {formatCurrency(customer.total_contract_value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* At risk customers */}
            {analytics.customersAtRisk.length > 0 && (
              <Card className="p-4 bg-red-500/10 border-red-500/20">
                <h4 className="text-sm font-medium text-red-400 mb-3">
                  Kunder i Riskzonen ({analytics.customersAtRisk.length})
                </h4>
                <div className="space-y-2">
                  {analytics.customersAtRisk.slice(0, 5).map((customer) => (
                    <div 
                      key={customer.id}
                      className="p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                      onClick={() => {
                        setSearchTerm(customer.company_name)
                        setSidebarOpen(false)
                      }}
                    >
                      <p className="text-sm text-white truncate">{customer.company_name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <ChurnRiskBadge
                          risk={customer.churnRisk.risk}
                          score={customer.churnRisk.score}
                          tooltip={customer.churnRisk.tooltip}
                          size="sm"
                          showIcon={false}
                        />
                        <span className="text-xs text-slate-500">
                          {customer.contractProgress.daysRemaining} dagar kvar
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
                Kommande Förnyelser ({analytics.upcomingRenewals.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.upcomingRenewals.map((customer) => (
                  <div 
                    key={customer.id}
                    className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSearchTerm(customer.company_name)
                      setSidebarOpen(false)
                    }}
                  >
                    <div>
                      <p className="text-sm text-white truncate">{customer.company_name}</p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(customer.total_contract_value)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${
                      customer.contractProgress.daysRemaining <= 30 ? 'text-red-400' :
                      customer.contractProgress.daysRemaining <= 60 ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      {customer.contractProgress.daysRemaining} dagar
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
                  <p className="text-xs text-slate-500">Månadsvis</p>
                  <p className="text-lg font-bold text-white">
                    {analytics.monthlyGrowth > 0 ? '+' : ''}{analytics.monthlyGrowth.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Kvartalsvis</p>
                  <p className="text-lg font-bold text-white">
                    {analytics.quarterlyGrowth > 0 ? '+' : ''}{analytics.quarterlyGrowth.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Årlig</p>
                  <p className="text-lg font-bold text-white">
                    {analytics.yearlyGrowth > 0 ? '+' : ''}{analytics.yearlyGrowth.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">NRR</p>
                  <TooltipWrapper 
                    content="Net Revenue Retention - visar hur mycket intäkterna växer från befintliga kunder. Över 100% betyder expansion."
                    position="left"
                  >
                    <p className="text-lg font-bold text-green-400 cursor-help">
                      {analytics.netRevenueRetention}%
                    </p>
                  </TooltipWrapper>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}