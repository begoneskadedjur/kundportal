// src/components/admin/customers/OrganizationOverviewSection.tsx
import React from 'react'
import { User, Mail, Phone, MapPin, Building2, Hash, Users, TrendingUp, Calendar, DollarSign, FileText, Activity } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import { formatCurrency } from '../../../utils/customerMetrics'

interface OrganizationOverviewSectionProps {
  organization: ConsolidatedCustomer
}

const formatContractTimeRemaining = (organization: ConsolidatedCustomer): { 
  text: string
  months: number
  urgency: 'critical' | 'warning' | 'normal' | 'expired'
  progress: number
} => {
  if (!organization.nextRenewalDate) {
    return { text: 'Okänt', months: 0, urgency: 'normal', progress: 0 }
  }

  const endDate = new Date(organization.nextRenewalDate)
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

export default function OrganizationOverviewSection({ organization }: OrganizationOverviewSectionProps) {
  const contractInfo = formatContractTimeRemaining(organization)
  
  // Calculate average values
  const avgContractValue = organization.totalSites > 0 ? organization.totalContractValue / organization.totalSites : 0
  const avgHealthScore = organization.sites.length > 0 
    ? Math.round(organization.sites.reduce((sum, site) => sum + site.healthScore.score, 0) / organization.sites.length)
    : 0

  // Real cases data from useConsolidatedCustomers hook
  const totalCasesValue = organization.totalCasesValue
  const totalCasesCount = organization.totalCasesCount
  const pendingCasesValue = organization.casesBillingStatus.pending.value
  const paidCasesValue = organization.casesBillingStatus.paid.value
  const sentCasesValue = organization.casesBillingStatus.sent.value
  const skipCasesValue = organization.casesBillingStatus.skip.value
  
  const totalOrganizationValue = organization.totalContractValue + totalCasesValue

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-white">Organisationsöversikt</h3>
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
                  {organization.contact_person || 'Ej angivet'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-500 mt-1" />
              <div>
                <div className="text-sm text-slate-400">E-postadress</div>
                <a 
                  href={`mailto:${organization.contact_email}`}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {organization.contact_email}
                </a>
              </div>
            </div>

            {organization.contact_phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-500 mt-1" />
                <div>
                  <div className="text-sm text-slate-400">Telefonnummer</div>
                  <a 
                    href={`tel:${organization.contact_phone}`}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {organization.contact_phone}
                  </a>
                </div>
              </div>
            )}

            {organization.contact_address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-500 mt-1" />
                <div>
                  <div className="text-sm text-slate-400">Adress</div>
                  <div className="text-white">{organization.contact_address}</div>
                </div>
              </div>
            )}

            {organization.organization_number && (
              <div className="flex items-start gap-3">
                <Hash className="w-4 h-4 text-slate-500 mt-1" />
                <div>
                  <div className="text-sm text-slate-400">Organisationsnummer</div>
                  <div className="text-white font-mono">{organization.organization_number}</div>
                </div>
              </div>
            )}

            {organization.assigned_account_manager && (
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-500 mt-1" />
                <div>
                  <div className="text-sm text-slate-400">Säljare</div>
                  <div className="text-white">{organization.assigned_account_manager}</div>
                  {organization.account_manager_email && (
                    <a 
                      href={`mailto:${organization.account_manager_email}`}
                      className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                    >
                      {organization.account_manager_email}
                    </a>
                  )}
                </div>
              </div>
            )}
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
              <div className="text-sm text-slate-400 mb-1">Total Organisationsvärde</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(totalOrganizationValue)}
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Kontrakt:</span>
                  <span className="text-slate-300">{formatCurrency(organization.totalContractValue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Ärenden:</span>
                  <span className="text-blue-400">{formatCurrency(totalCasesValue)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {formatCurrency(organization.totalMonthlyValue)}/månad (kontrakt)
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-2">Kontraktsperiod</div>
              <div className="flex items-center gap-3">
                <div className={`text-lg font-semibold ${
                  contractInfo.urgency === 'expired' ? 'text-red-400' :
                  contractInfo.urgency === 'critical' ? 'text-red-400' :
                  contractInfo.urgency === 'warning' ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {contractInfo.text}
                </div>
                {contractInfo.urgency === 'critical' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    Kritisk
                  </span>
                )}
                {contractInfo.urgency === 'warning' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Varning
                  </span>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Avtalstid kvar</span>
                  <span>{Math.round(contractInfo.progress)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      contractInfo.urgency === 'expired' ? 'bg-red-400' :
                      contractInfo.urgency === 'critical' ? 'bg-red-400' :
                      contractInfo.urgency === 'warning' ? 'bg-amber-400' :
                      'bg-green-400'
                    }`}
                    style={{ width: `${contractInfo.progress}%` }}
                  />
                </div>
              </div>
              
              {organization.nextRenewalDate && (
                <div className="text-sm text-slate-500 mt-2">
                  Förnyelse: {new Date(organization.nextRenewalDate).toLocaleDateString('sv-SE', {
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
                    {totalCasesCount}
                  </div>
                  <div className="text-xs text-slate-400">Totala ärenden</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-400 mb-1">
                    {formatCurrency(totalCasesValue)}
                  </div>
                  <div className="text-xs text-slate-400">Ärenden värde</div>
                </div>
              </div>
              
              {/* Billing Status Breakdown - only show if there are cases */}
              {totalCasesValue > 0 && (
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
              
              {totalCasesValue === 0 && (
                <div className="mt-4 p-3 bg-slate-800/30 rounded-lg text-center">
                  <div className="text-slate-400 text-sm">📋 Inga ärenden ännu</div>
                  <div className="text-slate-500 text-xs mt-1">Ärenden visas när de läggs till i systemet</div>
                </div>
              )}
            </div>

            {/* Additional contract info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
              <div>
                <div className="text-sm text-slate-400">Genomsnitt/enhet</div>
                <div className="text-lg font-semibold text-white">
                  {formatCurrency(totalOrganizationValue / Math.max(1, organization.totalSites))}
                </div>
                <div className="text-xs text-slate-500">Kontrakt + Ärenden</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Enheter</div>
                <div className="text-lg font-semibold text-white">
                  {organization.totalSites}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Statistics */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Organisationsstatistik
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {organization.totalSites}
            </div>
            <div className="text-sm text-slate-400">Totala enheter</div>
          </div>
          
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-green-400 mb-1">
              {organization.activeUsersCount}
            </div>
            <div className="text-sm text-slate-400">Portal-användare</div>
          </div>
          
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-purple-400 mb-1">
              {formatCurrency(avgContractValue)}
            </div>
            <div className="text-sm text-slate-400">Genomsnitt/enhet</div>
          </div>
          
          <div className="text-center p-4 bg-slate-700/30 rounded-lg">
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {avgHealthScore}
            </div>
            <div className="text-sm text-slate-400">Genomsnitt Health Score</div>
          </div>
        </div>

        {/* Additional organization info */}
        {(organization.industry_category || organization.business_type || organization.customer_size) && (
          <div className="mt-6 pt-6 border-t border-slate-700/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {organization.industry_category && (
                <div>
                  <div className="text-sm text-slate-400">Bransch</div>
                  <div className="text-white capitalize">{organization.industry_category}</div>
                </div>
              )}
              
              {organization.business_type && (
                <div>
                  <div className="text-sm text-slate-400">Verksamhetstyp</div>
                  <div className="text-white">{organization.business_type}</div>
                </div>
              )}
              
              {organization.customer_size && (
                <div>
                  <div className="text-sm text-slate-400">Företagsstorlek</div>
                  <div className="text-white capitalize">{organization.customer_size}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}