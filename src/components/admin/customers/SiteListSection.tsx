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
  organization?: ConsolidatedCustomer // Lägg till för åtkomst till multisite data
}

interface CasesSectionProps {
  siteId: string
  siteName: string
  casesCount: number
  casesValue: number
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
const CasesSection: React.FC<CasesSectionProps> = ({ siteId, siteName, casesCount, casesValue }) => {
  // TODO: This will fetch real cases data when integration is implemented
  // For now, we'll show placeholder data and structure
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Use real data from site props
  const totalCasesValue = casesValue || 0
  const actualCasesCount = casesCount || 0
  
  // Placeholder for future cases breakdown - will be populated from actual API calls
  const mockCases: CaseItem[] = []
  
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
              <span className="text-sm font-medium text-slate-300">Ärenden Översikt</span>
            </div>
            {actualCasesCount > 0 && (
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
              <div className="text-lg font-bold text-blue-400">{actualCasesCount}</div>
              <div className="text-xs text-slate-400">Totalt ärenden</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">{formatCurrency(totalCasesValue)}</div>
              <div className="text-xs text-slate-400">Total värde</div>
            </div>
          </div>
          
          {/* Billing Status Pills */}
          {actualCasesCount > 0 && (
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
          
          {actualCasesCount === 0 && (
            <div className="mt-4 text-center py-6 text-slate-400">
              <div className="mb-2">📋</div>
              <div className="text-sm">Inga ärenden för denna enhet</div>
              <div className="text-xs text-slate-500 mt-1">Ärenden visas här när de skapas</div>
            </div>
          )}
        </div>
        
        {/* Expanded Cases List */}
        {isExpanded && actualCasesCount > 0 && (
          <div className="border-t border-slate-700/50 bg-slate-900/50">
            <div className="p-4">
              <div className="text-center py-6 text-slate-400">
                <div className="mb-2">🔧</div>
                <div className="text-sm">Detaljerade ärendelistan kommer snart</div>
                <div className="text-xs text-slate-500 mt-1">
                  Vi förbereder integration med befintliga ärendekomponenter
                </div>
              </div>
              {/* TODO: Integrera med befintliga ärendekomponenter som CaseListItem eller ActiveCasesList 
                  när ärendedata är tillgängligt per site/organization */}
              <div className="space-y-3 hidden">
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
                      +{mockCases.length - 5} fler ärenden...
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

const SiteCard: React.FC<SiteCardProps> = ({ site, isExpanded, onToggle, onEdit, organization }) => {
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
              
              <div className="space-y-2 mb-3">
                {/* Site Contact Information */}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {site.contact_person || 'Ingen kontakt'}
                  </span>
                  {site.contact_email && (
                    <a 
                      href={`mailto:${site.contact_email}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      title={`Skicka email till ${site.contact_person || 'kontakt'}`}
                    >
                      <Mail className="w-3 h-3" />
                      {site.contact_email}
                    </a>
                  )}
                  {site.contact_phone && (
                    <a 
                      href={`tel:${site.contact_phone}`}
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      title={`Ring ${site.contact_person || 'kontakt'}`}
                    >
                      <Phone className="w-3 h-3" />
                      {site.contact_phone}
                    </a>
                  )}
                </div>
                
                {/* Platsansvariga användare från multisite data */}
                {organization?.multisiteUsers && (
                  <div className="pt-2">
                    {(() => {
                      const siteResponsibleUsers = organization.multisiteUsers.filter(user => 
                        user.role_type === 'platsansvarig' && 
                        user.site_ids?.includes(site.id)
                      )
                      
                      if (siteResponsibleUsers.length > 0) {
                        return (
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">Platsansvariga:</div>
                            {siteResponsibleUsers.map((user, index) => (
                              <div key={user.user_id} className="flex items-center gap-2 text-xs">
                                <UserCheck className="w-3 h-3 text-purple-400" />
                                <span className="text-slate-300">{user.display_name || 'Namnlös användare'}</span>
                                <a 
                                  href={`mailto:${user.email}`}
                                  className="text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                                  title={`Kontakta ${user.display_name || 'användare'}`}
                                >
                                  <Mail className="w-3 h-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
              </div>

              {/* Endast relevanta status badges för individuella enheter */}
              <div className="flex items-center gap-3">
                {isExpiring && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Avtal utgår snart
                  </span>
                )}
                {site.casesCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <Activity className="w-3 h-3 mr-1" />
                    {site.casesCount} ärenden ({formatCurrency(site.casesValue)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <div className="text-right">
              <div className="text-sm text-slate-400 mb-1">Avtalsvärde</div>
              <div className="text-lg font-semibold text-green-400">
                {formatCurrency(site.total_contract_value || 0)}
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

            </div>

            {/* Enhetens Aktivitet & Status */}
            <div>
              <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Enhetsstatus & Aktivitet  
              </h6>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-lg font-bold text-blue-400 mb-1">
                  {site.casesCount || 0}
                </div>
                <div className="text-xs text-slate-400">Aktiva ärenden</div>
                <div className="text-xs text-green-400 mt-1">
                  {formatCurrency(site.casesValue || 0)} värde
                </div>
              </div>
              
              {/* Portal Access för denna enhet */}
              {organization?.multisiteUsers && (
                <div className="mt-4 p-3 bg-slate-700/20 rounded-lg">
                  <div className="text-xs text-slate-400 mb-2">Ansvariga användare med portaltillgång:</div>
                  {(() => {
                    // Verksamhetschef har alltid tillgång till alla enheter
                    const verksamhetschefer = organization.multisiteUsers.filter(user => user.role_type === 'verksamhetschef')
                    
                    // Regionchefer som har valt denna enhet
                    const regionchefer = organization.multisiteUsers.filter(user => 
                      user.role_type === 'regionchef' && 
                      user.site_ids?.includes(site.id)
                    )
                    
                    // Platsansvariga för denna specifika enhet
                    const platsansvariga = organization.multisiteUsers.filter(user => 
                      user.role_type === 'platsansvarig' && 
                      user.site_ids?.includes(site.id)
                    )
                    
                    const allRelevantUsers = [...verksamhetschefer, ...regionchefer, ...platsansvariga]
                    
                    if (allRelevantUsers.length > 0) {
                      return (
                        <div className="space-y-2">
                          {/* Verksamhetschefer först */}
                          {verksamhetschefer.map(user => (
                            <div key={user.user_id} className="text-xs text-slate-300 flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${user.hasLoggedIn ? 'bg-green-400' : 'bg-slate-500'}`} />
                              <span className="font-medium text-amber-400">👑</span>
                              {user.display_name || 'Namnlös användare'} 
                              <span className="text-slate-500">(Verksamhetschef)</span>
                            </div>
                          ))}
                          
                          {/* Regionchefer */}
                          {regionchefer.map(user => (
                            <div key={user.user_id} className="text-xs text-slate-300 flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${user.hasLoggedIn ? 'bg-green-400' : 'bg-slate-500'}`} />
                              <span className="font-medium text-purple-400">🛡️</span>
                              {user.display_name || 'Namnlös användare'} 
                              <span className="text-slate-500">(Regionchef)</span>
                            </div>
                          ))}
                          
                          {/* Platsansvariga */}
                          {platsansvariga.map(user => (
                            <div key={user.user_id} className="text-xs text-slate-300 flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${user.hasLoggedIn ? 'bg-green-400' : 'bg-slate-500'}`} />
                              <span className="font-medium text-blue-400">🏢</span>
                              {user.display_name || 'Namnlös användare'} 
                              <span className="text-slate-500">(Platsansvarig)</span>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return <div className="text-xs text-slate-500 italic">Inga användare med portaltillgång för denna enhet</div>
                  })()}
                </div>
              )}
            </div>

            {/* Cases Section */}
            <div>
              <h6 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ärenden & Extra Arbeten
              </h6>
              
              {/* Cases Summary for this site */}
              <CasesSection 
                siteId={site.id} 
                siteName={site.site_name || site.company_name}
                casesCount={site.casesCount || 0}
                casesValue={site.casesValue || 0}
              />
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
            <h3 className="text-xl font-semibold text-white">Enheter & Lokaler</h3>
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
              organization={organization}
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