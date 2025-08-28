// src/components/admin/customers/SiteListSection.tsx
import React, { useState } from 'react'
import { MapPin, ChevronDown, ChevronRight, Building2, Edit3, Mail, Phone, User, AlertTriangle, Calendar, TrendingUp, DollarSign, FileText, Activity, ExternalLink } from 'lucide-react'
import { ConsolidatedCustomer, CustomerSite } from '../../../hooks/useConsolidatedCustomers'
import HealthScoreBadge from './HealthScoreBadge'
import ChurnRiskBadge from './ChurnRiskBadge'
import { formatCurrency, getContractProgress } from '../../../utils/customerMetrics'

interface SiteListSectionProps {
  organization: ConsolidatedCustomer
}

interface SiteCardProps {
  site: CustomerSite
  isExpanded: boolean
  onToggle: () => void
  onEdit?: (site: CustomerSite) => void
}

interface CasesSectionProps {
  siteId: string
  siteName: string
}

// Individual case item interface
interface CaseItem {
  id: string
  title: string
  description: string | null
  price: number | null
  billing_status: 'pending' | 'sent' | 'paid' | 'skip' | null
  created_at: string
  completed_date: string | null
  status: string
  case_type: 'private' | 'business'
}

// Cases section component for each site
const CasesSection: React.FC<CasesSectionProps> = ({ siteId, siteName }) => {
  // TODO: This will fetch real cases data when integration is implemented
  // For now, we'll show placeholder data and structure
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Placeholder cases data - this will come from actual API calls
  const mockCases: CaseItem[] = [
    // This will be populated from private_cases and business_cases tables
    // filtered by customer_id or site association
  ]
  
  const totalCasesValue = mockCases.reduce((sum, c) => sum + (c.price || 0), 0)
  const casesCount = mockCases.length
  
  // Calculate billing status breakdown
  const billingBreakdown = mockCases.reduce((acc, c) => {
    if (c.billing_status) {
      acc[c.billing_status] = (acc[c.billing_status] || 0) + (c.price || 0)
    }
    return acc
  }, {} as Record<'pending' | 'sent' | 'paid' | 'skip', number>)

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'sent': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'skip': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getBillingStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Väntande'
      case 'sent': return 'Skickad'
      case 'paid': return 'Betald'
      case 'skip': return 'Hoppa över'
      default: return 'Ej angiven'
    }
  }

  return (
    <div className="space-y-4">
      {/* Cases Summary */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Cases Översikt</span>
            </div>
            {casesCount > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isExpanded ? 'Dölj detaljer' : 'Visa detaljer'}
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-bold text-blue-400">{casesCount}</div>
              <div className="text-xs text-slate-400">Totala cases</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">{formatCurrency(totalCasesValue)}</div>
              <div className="text-xs text-slate-400">Total värde</div>
            </div>
          </div>
          
          {/* Billing Status Pills */}
          {casesCount > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-slate-500">Faktureringsstatus:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(billingBreakdown).map(([status, value]) => (
                  value > 0 && (
                    <span
                      key={status}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                        getBillingStatusColor(status)
                      }`}
                    >
                      {getBillingStatusText(status)}: {formatCurrency(value)}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}
          
          {casesCount === 0 && (
            <div className="mt-4 text-center py-6 text-slate-400">
              <div className="mb-2">📋</div>
              <div className="text-sm">Inga cases för denna enhet</div>
              <div className="text-xs text-slate-500 mt-1">Cases visas här när de skapas</div>
            </div>
          )}
        </div>
        
        {/* Expanded Cases List */}
        {isExpanded && casesCount > 0 && (
          <div className="border-t border-slate-700/50 bg-slate-900/50">
            <div className="p-4">
              <div className="space-y-3">
                {mockCases.slice(0, 5).map((caseItem) => (
                  <div key={caseItem.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {caseItem.title}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {caseItem.description || 'Ingen beskrivning'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(caseItem.created_at).toLocaleDateString('sv-SE')}
                        {caseItem.completed_date && (
                          <span className="ml-2 text-green-400">✓ Slutförd</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {caseItem.price && (
                        <div className="text-right">
                          <div className="text-sm font-medium text-green-400">
                            {formatCurrency(caseItem.price)}
                          </div>
                          {caseItem.billing_status && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                              getBillingStatusColor(caseItem.billing_status)
                            }`}>
                              {getBillingStatusText(caseItem.billing_status)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {mockCases.length > 5 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-slate-500">
                      +{mockCases.length - 5} fler cases...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SiteCard: React.FC<SiteCardProps> = ({ site, isExpanded, onToggle, onEdit }) => {
  const contractProgress = getContractProgress(site.contract_start_date, site.contract_end_date)
  
  // Determine site type display
  const getSiteTypeInfo = () => {
    if (site.site_type === 'huvudkontor') {
      return {
        icon: <Building2 className="w-5 h-5 text-blue-400" />,
        text: 'Huvudkontor',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-400'
      }
    }
    return {
      icon: <MapPin className="w-5 h-5 text-slate-400" />,
      text: 'Enhet',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      textColor: 'text-slate-400'
    }
  }

  const siteTypeInfo = getSiteTypeInfo()
  const isExpiring = contractProgress.daysRemaining <= 90 && contractProgress.daysRemaining > 0
  const isHighRisk = site.churnRisk.risk === 'high'

  return (
    <div className={`border border-slate-700/50 rounded-lg overflow-hidden transition-all duration-200 ${
      isExpanded ? 'bg-slate-800/70' : 'bg-slate-800/50 hover:bg-slate-800/70'
    }`}>
      
      {/* Site Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${siteTypeInfo.bgColor} border ${siteTypeInfo.borderColor}`}>
              {siteTypeInfo.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h5 className="text-lg font-medium text-white truncate">
                  {site.site_name || site.company_name}
                </h5>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${siteTypeInfo.bgColor} ${siteTypeInfo.textColor} ${siteTypeInfo.borderColor}`}>
                  {siteTypeInfo.text}
                </span>
                {site.region && (
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-600/50 text-slate-300 border border-slate-600">
                    {site.region}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {site.contact_person || 'Ingen kontakt'}
                </span>
                <span className="text-blue-400">{site.contact_email}</span>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-3">
                <HealthScoreBadge
                  score={site.healthScore.score}
                  level={site.healthScore.level}
                  tooltip=""
                  size="sm"
                />
                <ChurnRiskBadge
                  risk={site.churnRisk.risk}
                  score={site.churnRisk.score}
                  tooltip=""
                  size="sm"
                />
                {isExpiring && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Utgår snart
                  </span>
                )}
                {isHighRisk && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Hög risk
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <div className="text-right">
              <div className="text-lg font-semibold text-green-400">
                {formatCurrency(site.total_contract_value || 0)}
              </div>
              <div className="text-sm text-slate-500">
                {formatCurrency(site.monthly_value || 0)}/mån
              </div>
            </div>
            
            <button
              onClick={onToggle}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-2"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/50">
          <div className="p-4 space-y-6">
            
            {/* Contact & Contract Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Contact Information */}
              <div>
                <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Kontaktinformation
                </h6>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-400">Kontakt:</span>
                    <span className="text-white">{site.contact_person || 'Ej angiven'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-400">E-post:</span>
                    <a href={`mailto:${site.contact_email}`} className="text-blue-400 hover:text-blue-300">
                      {site.contact_email}
                    </a>
                  </div>
                  {site.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-400">Telefon:</span>
                      <a href={`tel:${site.contact_phone}`} className="text-blue-400 hover:text-blue-300">
                        {site.contact_phone}
                      </a>
                    </div>
                  )}
                  {site.contact_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 text-slate-500 mt-1" />
                      <span className="text-slate-400">Adress:</span>
                      <span className="text-white">{site.contact_address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contract Information */}
              <div>
                <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Kontraktsinformation
                </h6>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Årsvärde:</span>
                    <span className="text-white font-medium">{formatCurrency(site.annual_value || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Månadsavgift:</span>
                    <span className="text-white font-medium">{formatCurrency(site.monthly_value || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total värde:</span>
                    <span className="text-green-400 font-medium">{formatCurrency(site.total_contract_value || 0)}</span>
                  </div>
                  {site.contract_start_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Startdatum:</span>
                      <span className="text-white">{new Date(site.contract_start_date).toLocaleDateString('sv-SE')}</span>
                    </div>
                  )}
                  {site.contract_end_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Slutdatum:</span>
                      <span className={`font-medium ${
                        contractProgress.daysRemaining <= 30 ? 'text-red-400' :
                        contractProgress.daysRemaining <= 90 ? 'text-amber-400' :
                        'text-white'
                      }`}>
                        {new Date(site.contract_end_date).toLocaleDateString('sv-SE')}
                        {contractProgress.daysRemaining > 0 && (
                          <span className="ml-1 text-xs">
                            ({contractProgress.daysRemaining} dagar)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Health & Performance Metrics */}
            <div>
              <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Prestanda & Hälsa
              </h6>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-400 mb-1">
                    {site.healthScore.score}
                  </div>
                  <div className="text-xs text-slate-400">Health Score</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-amber-400 mb-1">
                    {Math.round(site.churnRisk.score)}%
                  </div>
                  <div className="text-xs text-slate-400">Churn Risk</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-purple-400 mb-1">
                    {Math.round(site.renewalProbability)}%
                  </div>
                  <div className="text-xs text-slate-400">Renewal Prob</div>
                </div>
              </div>
            </div>

            {/* Cases Section */}
            <div>
              <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Cases & Extra Arbeten
              </h6>
              
              {/* Cases Summary for this site */}
              <CasesSection siteId={site.id} siteName={site.site_name || site.company_name} />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-500">
                Site ID: {site.id}
                {site.site_code && ` • Kod: ${site.site_code}`}
              </div>
              <button
                onClick={() => onEdit?.(site)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Redigera enhet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SiteListSection({ organization }: SiteListSectionProps) {
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'high-risk' | 'expiring'>('all')

  const toggleSiteExpansion = (siteId: string) => {
    const newExpanded = new Set(expandedSites)
    if (newExpanded.has(siteId)) {
      newExpanded.delete(siteId)
    } else {
      newExpanded.add(siteId)
    }
    setExpandedSites(newExpanded)
  }

  const handleEditSite = (site: CustomerSite) => {
    // TODO: Implement site editing
    console.log('Edit site:', site.id)
  }

  // Format currency helper (moved here since it's used by CasesSection)
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Filter sites based on selected filter
  const filteredSites = organization.sites.filter(site => {
    if (filter === 'all') return true
    if (filter === 'high-risk') return site.churnRisk.risk === 'high'
    if (filter === 'expiring') {
      const contractProgress = getContractProgress(site.contract_start_date, site.contract_end_date)
      return contractProgress.daysRemaining <= 90 && contractProgress.daysRemaining > 0
    }
    return true
  })

  const highRiskSites = organization.sites.filter(site => site.churnRisk.risk === 'high').length
  const expiringSites = organization.sites.filter(site => {
    const contractProgress = getContractProgress(site.contract_start_date, site.contract_end_date)
    return contractProgress.daysRemaining <= 90 && contractProgress.daysRemaining > 0
  }).length

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30">
            <MapPin className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Enheter & Sites</h3>
            <p className="text-sm text-slate-400">
              {organization.totalSites} enheter i organisationen
            </p>
          </div>
        </div>

        {/* Filter Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            Alla ({organization.totalSites})
          </button>
          {highRiskSites > 0 && (
            <button
              onClick={() => setFilter('high-risk')}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                filter === 'high-risk'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Högrisk ({highRiskSites})
            </button>
          )}
          {expiringSites > 0 && (
            <button
              onClick={() => setFilter('expiring')}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                filter === 'expiring'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Utgående ({expiringSites})
            </button>
          )}
        </div>
      </div>

      {/* Sites List */}
      <div className="space-y-4">
        {filteredSites.length > 0 ? (
          filteredSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              isExpanded={expandedSites.has(site.id)}
              onToggle={() => toggleSiteExpansion(site.id)}
              onEdit={handleEditSite}
            />
          ))
        ) : (
          <div className="text-center py-12 bg-slate-800/30 rounded-lg border border-slate-700/50">
            <div className="mb-4">
              <MapPin className="w-12 h-12 text-slate-500 mx-auto" />
            </div>
            <h4 className="text-lg font-medium text-slate-300 mb-2">
              Inga enheter matchar filtret
            </h4>
            <p className="text-slate-500">
              Prova att ändra filter eller kontrollera organisationens enheter
            </p>
          </div>
        )}
      </div>
    </section>
  )
}