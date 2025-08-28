// src/components/admin/customers/SingleCustomerDetailModal.tsx
import React from 'react'
import { 
  X, 
  Building2, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  Users, 
  DollarSign, 
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  FileText,
  Activity,
  Shield,
  TrendingDown
} from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import HealthScoreBadge from './HealthScoreBadge'
import ChurnRiskBadge from './ChurnRiskBadge'
import PortalAccessBadge from './PortalAccessBadge'
import AdminCasesList from './AdminCasesList'
import { formatCurrency } from '../../../utils/customerMetrics'

interface SingleCustomerDetailModalProps {
  customer: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
}

const formatContractTimeRemaining = (customer: ConsolidatedCustomer): { 
  text: string
  months: number
  urgency: 'critical' | 'warning' | 'normal' | 'expired'
  progress: number
} => {
  if (!customer.nextRenewalDate) {
    return { text: 'Okänt', months: 0, urgency: 'normal', progress: 0 }
  }

  const endDate = new Date(customer.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffMonths = Math.round(diffTime / (1000 * 60 * 60 * 24 * 30))

  let urgency: 'critical' | 'warning' | 'normal' | 'expired'
  let progress = 0

  if (diffMonths < 0) {
    urgency = 'expired'
    progress = 0
  } else if (diffMonths <= 3) {
    urgency = 'critical'
    progress = Math.max(10, (diffMonths / 12) * 100)
  } else if (diffMonths <= 6) {
    urgency = 'warning'
    progress = (diffMonths / 12) * 100
  } else {
    urgency = 'normal'
    progress = Math.min(100, (diffMonths / 12) * 100)
  }

  return { 
    text: diffMonths < 0 ? 'Utgången' : `${diffMonths} månader kvar`, 
    months: Math.max(0, diffMonths), 
    urgency,
    progress
  }
}

export default function SingleCustomerDetailModal({
  customer,
  isOpen,
  onClose
}: SingleCustomerDetailModalProps) {
  if (!isOpen || !customer || customer.organizationType !== 'single') return null

  const contractTime = formatContractTimeRemaining(customer)
  
  // Single customer data (direct access since there's only one site)
  const site = customer.sites[0] // Single customer always has exactly one site
  const totalCustomerValue = customer.totalOrganizationValue
  const contractValue = customer.totalContractValue
  const casesValue = customer.totalCasesValue
  const casesCount = customer.totalCasesCount
  
  // Billing status values from customer data
  const pendingCasesValue = customer.casesBillingStatus.pending.value
  const sentCasesValue = customer.casesBillingStatus.sent.value
  const paidCasesValue = customer.casesBillingStatus.paid.value
  const skipCasesValue = customer.casesBillingStatus.skip.value

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
          
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 rounded-t-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">
                        {customer.company_name}
                      </h2>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Enskild kund
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {customer.contact_person || 'Kontaktperson ej angiven'}
                      </span>
                      <span className="text-blue-400">{customer.contact_email}</span>
                      {customer.organization_number && (
                        <span>• Org.nr: {customer.organization_number}</span>
                      )}
                      {customer.assigned_account_manager && (
                        <span>• Säljare: {customer.assigned_account_manager}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-slate-400">Total Värde</span>
                  </div>
                  <div className="text-lg font-semibold text-green-400">
                    {formatCurrency(totalCustomerValue)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs text-slate-500">
                      Kontrakt: {formatCurrency(contractValue)}
                    </div>
                    <div className="text-xs text-blue-400">
                      Ärenden: {formatCurrency(casesValue)}
                      {casesCount > 0 && (
                        <span className="ml-1 text-slate-500">({casesCount} st)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-slate-400">Avtalstid</span>
                  </div>
                  <div className={`text-lg font-semibold ${
                    contractTime.urgency === 'expired' ? 'text-red-400' :
                    contractTime.urgency === 'critical' ? 'text-red-400' :
                    contractTime.urgency === 'warning' ? 'text-amber-400' :
                    'text-green-400'
                  }`}>
                    {contractTime.text}
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        contractTime.urgency === 'expired' ? 'bg-red-400' :
                        contractTime.urgency === 'critical' ? 'bg-red-400' :
                        contractTime.urgency === 'warning' ? 'bg-amber-400' :
                        'bg-green-400'
                      }`}
                      style={{ 
                        width: contractTime.urgency === 'expired' ? '0%' : `${contractTime.progress}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400">Health Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HealthScoreBadge
                      score={customer.overallHealthScore.score}
                      level={customer.overallHealthScore.level}
                      tooltip={customer.overallHealthScore.tooltip}
                      size="sm"
                      showIcon={false}
                    />
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-slate-400">Churn Risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChurnRiskBadge
                      risk={customer.highestChurnRisk.risk}
                      score={customer.highestChurnRisk.score}
                      tooltip={customer.highestChurnRisk.tooltip}
                      size="sm"
                      showIcon={false}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 space-y-8">
            
            {/* Customer Overview Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Kundöversikt</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Contact Information */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-slate-400" />
                    Kontaktinformation
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">Kontaktperson</div>
                        <div className="text-white font-medium">
                          {customer.contact_person || 'Kontaktperson ej angiven'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">E-postadress</div>
                        <a 
                          href={`mailto:${customer.contact_email}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {customer.contact_email}
                        </a>
                      </div>
                    </div>

                    {customer.contact_phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Telefonnummer</div>
                          <a 
                            href={`tel:${customer.contact_phone}`}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {customer.contact_phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {customer.contact_address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Adress</div>
                          <div className="text-white">{customer.contact_address}</div>
                        </div>
                      </div>
                    )}

                    {customer.organization_number && (
                      <div className="flex items-start gap-3">
                        <Hash className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Organisationsnummer</div>
                          <div className="text-white font-mono">{customer.organization_number}</div>
                        </div>
                      </div>
                    )}

                    {customer.assigned_account_manager && (
                      <div className="flex items-start gap-3">
                        <Users className="w-4 h-4 text-slate-500 mt-1" />
                        <div>
                          <div className="text-sm text-slate-400">Säljare</div>
                          <div className="text-white">{customer.assigned_account_manager}</div>
                          {customer.account_manager_email && (
                            <a 
                              href={`mailto:${customer.account_manager_email}`}
                              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                            >
                              {customer.account_manager_email}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Portal Access Status */}
                    <div className="flex items-start gap-3 pt-4 border-t border-slate-700/50">
                      <Shield className="w-4 h-4 text-slate-500 mt-1" />
                      <div>
                        <div className="text-sm text-slate-400">Portalåtkomst</div>
                        <div className="mt-1">
                          <PortalAccessBadge 
                            status={customer.portalAccessStatus}
                            tooltip={
                              customer.portalAccessStatus === 'full' ? 'Kund har fullständig portalåtkomst' :
                              customer.portalAccessStatus === 'partial' ? 'Kund har begränsad portalåtkomst' :
                              'Kund har ingen portalåtkomst'
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contract Overview */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    Kontraktsöversikt
                  </h4>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Total Kundvärde</div>
                      <div className="text-2xl font-bold text-green-400">
                        {formatCurrency(totalCustomerValue)}
                      </div>
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Kontrakt:</span>
                          <span className="text-slate-300">{formatCurrency(contractValue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Ärenden:</span>
                          <span className="text-blue-400">{formatCurrency(casesValue)}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-2">
                          {formatCurrency(customer.totalMonthlyValue)}/månad (kontrakt)
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-2">Kontraktsperiod</div>
                      <div className="flex items-center gap-3">
                        <div className={`text-lg font-semibold ${
                          contractTime.urgency === 'expired' ? 'text-red-400' :
                          contractTime.urgency === 'critical' ? 'text-red-400' :
                          contractTime.urgency === 'warning' ? 'text-amber-400' :
                          'text-green-400'
                        }`}>
                          {contractTime.text}
                        </div>
                        {contractTime.urgency === 'critical' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                            Kritisk
                          </span>
                        )}
                        {contractTime.urgency === 'warning' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Varning
                          </span>
                        )}
                      </div>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Avtalstid kvar</span>
                          <span>{Math.round(contractTime.progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              contractTime.urgency === 'expired' ? 'bg-red-400' :
                              contractTime.urgency === 'critical' ? 'bg-red-400' :
                              contractTime.urgency === 'warning' ? 'bg-amber-400' :
                              'bg-green-400'
                            }`}
                            style={{ width: `${contractTime.progress}%` }}
                          />
                        </div>
                      </div>
                      
                      {customer.nextRenewalDate && (
                        <div className="text-sm text-slate-500 mt-2">
                          Förnyelse: {new Date(customer.nextRenewalDate).toLocaleDateString('sv-SE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      )}
                    </div>

                    {/* Cases Summary */}
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Ärenden & Extra Arbeten
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-700/30 rounded-lg p-3">
                          <div className="text-lg font-bold text-blue-400 mb-1">
                            {casesCount}
                          </div>
                          <div className="text-xs text-slate-400">Totala ärenden</div>
                        </div>
                        <div className="bg-slate-700/30 rounded-lg p-3">
                          <div className="text-lg font-bold text-green-400 mb-1">
                            {formatCurrency(casesValue)}
                          </div>
                          <div className="text-xs text-slate-400">Ärenden värde</div>
                        </div>
                      </div>
                      
                      {/* Billing Status Breakdown - only show if there are cases */}
                      {casesValue > 0 && (
                        <div className="mt-4 space-y-2">
                          <div className="text-xs text-slate-500 mb-2">Faktureringsstatus:</div>
                          <div className="grid grid-cols-4 gap-1 text-xs">
                            <div className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-center">
                              <div className="font-medium">{formatCurrency(pendingCasesValue)}</div>
                              <div className="text-xs opacity-80">Väntande</div>
                            </div>
                            <div className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-center">
                              <div className="font-medium">{formatCurrency(sentCasesValue)}</div>
                              <div className="text-xs opacity-80">Skickad</div>
                            </div>
                            <div className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-center">
                              <div className="font-medium">{formatCurrency(paidCasesValue)}</div>
                              <div className="text-xs opacity-80">Betald</div>
                            </div>
                            <div className="bg-slate-500/10 text-slate-400 px-2 py-1 rounded text-center">
                              <div className="font-medium">{formatCurrency(skipCasesValue)}</div>
                              <div className="text-xs opacity-80">Hoppa över</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {casesValue === 0 && (
                        <div className="mt-4 p-3 bg-slate-800/30 rounded-lg text-center">
                          <div className="text-slate-400 text-sm">📋 Inga ärenden ännu</div>
                          <div className="text-slate-500 text-xs mt-1">Ärenden visas när de läggs till i systemet</div>
                        </div>
                      )}
                    </div>

                    {/* Additional customer info */}
                    {(customer.industry_category || customer.business_type || customer.customer_size) && (
                      <div className="pt-4 border-t border-slate-700/50">
                        <div className="grid grid-cols-1 gap-4">
                          {customer.industry_category && (
                            <div>
                              <div className="text-sm text-slate-400">Bransch</div>
                              <div className="text-white capitalize">{customer.industry_category}</div>
                            </div>
                          )}
                          
                          {customer.business_type && (
                            <div>
                              <div className="text-sm text-slate-400">Verksamhetstyp</div>
                              <div className="text-white">{customer.business_type}</div>
                            </div>
                          )}
                          
                          {customer.customer_size && (
                            <div>
                              <div className="text-sm text-slate-400">Företagsstorlek</div>
                              <div className="text-white capitalize">{customer.customer_size}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Cases Management Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Ärendehantering</h3>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <AdminCasesList 
                  customerId={site.id}
                  organizationId={customer.organizationId || undefined}
                />
              </div>
            </section>

            {/* Economic Analysis Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Ekonomisk Analys</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue Breakdown */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4">Intäktsfördelning</h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        <span className="text-slate-300">Kontrakt (årligt)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{formatCurrency(customer.totalAnnualValue)}</div>
                        <div className="text-xs text-slate-500">{((customer.totalAnnualValue / totalCustomerValue) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                        <span className="text-slate-300">Ärenden & Extra arbeten</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{formatCurrency(casesValue)}</div>
                        <div className="text-xs text-slate-500">{((casesValue / totalCustomerValue) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Totalt kundvärde:</span>
                        <span className="text-xl font-bold text-green-400">{formatCurrency(totalCustomerValue)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4">Betalningsstatus (Ärenden)</h4>
                  
                  {casesValue > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <span className="text-green-400">Betalda</span>
                        <div className="text-right">
                          <div className="text-green-400 font-semibold">{formatCurrency(paidCasesValue)}</div>
                          <div className="text-xs text-slate-500">{customer.casesBillingStatus.paid.count} st</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <span className="text-blue-400">Skickade</span>
                        <div className="text-right">
                          <div className="text-blue-400 font-semibold">{formatCurrency(sentCasesValue)}</div>
                          <div className="text-xs text-slate-500">{customer.casesBillingStatus.sent.count} st</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <span className="text-amber-400">Väntande</span>
                        <div className="text-right">
                          <div className="text-amber-400 font-semibold">{formatCurrency(pendingCasesValue)}</div>
                          <div className="text-xs text-slate-500">{customer.casesBillingStatus.pending.count} st</div>
                        </div>
                      </div>
                      
                      {skipCasesValue > 0 && (
                        <div className="flex items-center justify-between p-3 bg-slate-500/10 rounded-lg border border-slate-500/20">
                          <span className="text-slate-400">Hoppas över</span>
                          <div className="text-right">
                            <div className="text-slate-400 font-semibold">{formatCurrency(skipCasesValue)}</div>
                            <div className="text-xs text-slate-500">{customer.casesBillingStatus.skip.count} st</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-slate-400 text-sm">💰 Inga ärenden att fakturera</div>
                      <div className="text-slate-500 text-xs mt-1">Betalningsstatus visas här när ärenden skapas</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Health & Risk Metrics Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg border border-red-500/30">
                  <Activity className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Hälsa & Riskanalys</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Health Score Breakdown */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Health Score Uppdelning
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-slate-300">Övergripande Health Score</span>
                      <HealthScoreBadge
                        score={customer.overallHealthScore.score}
                        level={customer.overallHealthScore.level}
                        tooltip={customer.overallHealthScore.tooltip}
                        size="md"
                      />
                    </div>
                    
                    {/* Health Score Components */}
                    <div className="space-y-3">
                      {Object.entries(customer.overallHealthScore.breakdown).map(([key, data]) => {
                        const label = {
                          contractAge: 'Ålder på avtal',
                          communicationFrequency: 'Kommunikationsfrekvens',
                          supportTickets: 'Supportärenden',
                          paymentHistory: 'Betalningshistorik'
                        }[key] || key
                        
                        const percentage = Math.round((data.weight * 100))
                        const scoreValue = Math.round(data.score)
                        
                        return (
                          <div key={key} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">{label}</span>
                              <span className="text-slate-300">{scoreValue}/100 ({percentage}% vikt)</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  scoreValue >= 80 ? 'bg-green-400' :
                                  scoreValue >= 60 ? 'bg-yellow-400' :
                                  scoreValue >= 40 ? 'bg-orange-400' :
                                  'bg-red-400'
                                }`}
                                style={{ width: `${scoreValue}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Risk Analysis */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    Riskanalys
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-slate-300">Churn Risk</span>
                      <ChurnRiskBadge
                        risk={customer.highestChurnRisk.risk}
                        score={customer.highestChurnRisk.score}
                        tooltip={customer.highestChurnRisk.tooltip}
                        size="md"
                      />
                    </div>
                    
                    {/* Risk Factors */}
                    {customer.highestChurnRisk.factors && customer.highestChurnRisk.factors.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400 mb-3">Riskfaktorer:</div>
                        {customer.highestChurnRisk.factors.map((factor, index) => (
                          <div key={index} className="flex items-start gap-2 p-2 bg-slate-700/30 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-300 text-sm">{factor}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Renewal Probability */}
                    <div className="pt-4 border-t border-slate-700/50">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Förnyelsesannolikhet</span>
                          <span className="text-slate-300">{Math.round(customer.averageRenewalProbability)}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              customer.averageRenewalProbability >= 80 ? 'bg-green-400' :
                              customer.averageRenewalProbability >= 60 ? 'bg-yellow-400' :
                              customer.averageRenewalProbability >= 40 ? 'bg-orange-400' :
                              'bg-red-400'
                            }`}
                            style={{ width: `${customer.averageRenewalProbability}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Contract Status Alerts */}
                    <div className="space-y-2">
                      {customer.hasExpiringSites && (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span className="text-amber-400 text-sm">Avtal går ut inom 90 dagar</span>
                        </div>
                      )}
                      
                      {customer.highestChurnRisk.risk === 'high' && (
                        <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 text-sm">Hög risk för kundförlust</span>
                        </div>
                      )}
                      
                      {!customer.is_active && (
                        <div className="flex items-center gap-2 p-2 bg-slate-500/10 rounded-lg border border-slate-500/20">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-400 text-sm">Kunden är markerad som inaktiv</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 rounded-b-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Senast uppdaterad: {customer.updated_at ? 
                  new Date(customer.updated_at).toLocaleString('sv-SE') : 
                  'Okänt'
                }
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Stäng
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}