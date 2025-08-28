// src/components/admin/customers/MultiSiteCustomerDetailModal.tsx
import React from 'react'
import { X, Building2, Calendar, TrendingUp, AlertCircle, Users, DollarSign } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import HealthScoreBadge from './HealthScoreBadge'
import ChurnRiskBadge from './ChurnRiskBadge'
import PortalAccessBadge from './PortalAccessBadge'
import OrganizationOverviewSection from './OrganizationOverviewSection'
import SiteListSection from './SiteListSection'
import EconomicBreakdownSection from './EconomicBreakdownSection'
import { formatCurrency } from '../../../utils/customerMetrics'

interface MultiSiteCustomerDetailModalProps {
  organization: ConsolidatedCustomer | null
  isOpen: boolean
  onClose: () => void
}

const formatContractTimeRemaining = (organization: ConsolidatedCustomer): { 
  text: string
  months: number
  urgency: 'critical' | 'warning' | 'normal' | 'expired'
} => {
  if (!organization.nextRenewalDate) {
    return { text: 'Okänt', months: 0, urgency: 'normal' }
  }

  const endDate = new Date(organization.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffMonths = Math.round(diffTime / (1000 * 60 * 60 * 24 * 30))

  if (diffMonths < 0) {
    return { text: 'Utgången', months: 0, urgency: 'expired' }
  } else if (diffMonths <= 3) {
    return { text: `${diffMonths} månader kvar`, months: diffMonths, urgency: 'critical' }
  } else if (diffMonths <= 6) {
    return { text: `${diffMonths} månader kvar`, months: diffMonths, urgency: 'warning' }
  } else {
    return { text: `${diffMonths} månader kvar`, months: diffMonths, urgency: 'normal' }
  }
}

export default function MultiSiteCustomerDetailModal({
  organization,
  isOpen,
  onClose
}: MultiSiteCustomerDetailModalProps) {
  if (!isOpen || !organization) return null

  const contractTime = formatContractTimeRemaining(organization)
  
  // Calculate additional metrics for header
  const avgHealthScore = Math.round(
    organization.sites.reduce((sum, site) => sum + site.healthScore.score, 0) / organization.sites.length
  )
  
  const totalCasesValue = organization.totalCasesValue
  const totalCasesCount = organization.totalCasesCount
  
  // Billing status values from organization data
  const pendingCasesValue = organization.casesBillingStatus.pending.value
  const sentCasesValue = organization.casesBillingStatus.sent.value
  const paidCasesValue = organization.casesBillingStatus.paid.value

  const totalOrganizationValue = organization.totalOrganizationValue

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
                        {organization.company_name}
                      </h2>
                      {organization.organizationType === 'multisite' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {organization.totalSites} enheter
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {organization.contact_person}
                      </span>
                      <span className="text-blue-400">{organization.contact_email}</span>
                      {organization.assigned_account_manager && (
                        <span>• Säljare: {organization.assigned_account_manager}</span>
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
                    {formatCurrency(totalOrganizationValue)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs text-slate-500">
                      Kontrakt: {formatCurrency(organization.totalContractValue)}
                    </div>
                    <div className="text-xs text-blue-400">
                      Ärenden: {formatCurrency(totalCasesValue)}
                      {totalCasesCount > 0 && (
                        <span className="ml-1 text-slate-500">({totalCasesCount} st)</span>
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
                        width: contractTime.urgency === 'expired' ? '0%' : `${Math.max(10, Math.min(100, (contractTime.months / 12) * 100))}%` 
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
                      score={organization.overallHealthScore.score}
                      level={organization.overallHealthScore.level}
                      tooltip=""
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
                      risk={organization.highestChurnRisk.risk}
                      score={organization.highestChurnRisk.score}
                      tooltip=""
                      size="sm"
                      showIcon={false}
                    />
                  </div>
                </div>
              </div>

              {/* Portal Status */}
              <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Portal Status:</span>
                  <PortalAccessBadge
                    status={organization.portalAccessStatus}
                    userCount={organization.activeUsersCount}
                    tooltip=""
                    size="sm"
                  />
                </div>
                {organization.pendingInvitationsCount > 0 && (
                  <span className="text-sm text-amber-400">
                    {organization.pendingInvitationsCount} väntande inbjudningar
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 space-y-8">
            
            {/* Organization Overview */}
            <OrganizationOverviewSection organization={organization} />

            {/* Site List */}
            <SiteListSection organization={organization} />

            {/* Economic Breakdown */}
            <EconomicBreakdownSection organization={organization} />

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 rounded-b-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Senast uppdaterad: {organization.updated_at ? 
                  new Date(organization.updated_at).toLocaleString('sv-SE') : 
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