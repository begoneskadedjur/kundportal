// src/components/admin/customers/EconomicBreakdownSection.tsx
import React from 'react'
import { BarChart3, TrendingUp, AlertTriangle, DollarSign, Target, Activity, FileText, CreditCard, CheckCircle, Clock, XCircle } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import { formatCurrency } from '../../../utils/customerMetrics'

interface EconomicBreakdownSectionProps {
  organization: ConsolidatedCustomer
}

interface ValueDistributionBarProps {
  site: { 
    id: string
    company_name: string
    site_name?: string | null
    total_contract_value?: number | null
    healthScore: { score: number; level: string }
    churnRisk: { risk: string; score: number }
  }
  maxValue: number
  totalValue: number
}

const ValueDistributionBar: React.FC<ValueDistributionBarProps> = ({ site, maxValue, totalValue }) => {
  const siteValue = site.total_contract_value || 0
  const percentage = totalValue > 0 ? (siteValue / totalValue) * 100 : 0
  const barWidth = maxValue > 0 ? (siteValue / maxValue) * 100 : 0
  
  const getBarColor = () => {
    if (site.churnRisk.risk === 'high') return 'bg-red-400'
    if (site.churnRisk.risk === 'medium') return 'bg-amber-400'
    if (site.healthScore.score >= 80) return 'bg-green-400'
    if (site.healthScore.score >= 60) return 'bg-blue-400'
    return 'bg-slate-400'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300 truncate">
          {site.site_name || site.company_name}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">
            {percentage.toFixed(1)}%
          </span>
          <span className="text-white font-medium min-w-[80px] text-right">
            {formatCurrency(siteValue)}
          </span>
        </div>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.max(2, barWidth)}%` }}
        />
      </div>
    </div>
  )
}

export default function EconomicBreakdownSection({ organization }: EconomicBreakdownSectionProps) {
  // Calculate economic metrics
  const totalContractValue = organization.totalContractValue
  
  // Real cases integration - data from useConsolidatedCustomers hook - säker tillgång
  const totalCasesValue = organization.totalCasesValue || 0
  const totalCasesCount = organization.totalCasesCount || 0
  
  // Cases billing breakdown from aggregated organization data - säker tillgång med fallbacks
  const casesBillingBreakdown = organization.casesBillingStatus || {
    pending: { count: 0, value: 0 },
    sent: { count: 0, value: 0 },
    paid: { count: 0, value: 0 },
    skip: { count: 0, value: 0 }
  }
  
  const totalOrganizationValue = totalContractValue + totalCasesValue
  const avgValuePerSite = organization.totalSites > 0 ? totalOrganizationValue / organization.totalSites : 0
  
  // Risk analysis
  const highRiskSites = organization.sites.filter(site => site.churnRisk.risk === 'high')
  const mediumRiskSites = organization.sites.filter(site => site.churnRisk.risk === 'medium')
  const highRiskValue = highRiskSites.reduce((sum, site) => sum + (site.total_contract_value || 0), 0)
  const mediumRiskValue = mediumRiskSites.reduce((sum, site) => sum + (site.total_contract_value || 0), 0)
  const atRiskValue = highRiskValue + mediumRiskValue
  const atRiskPercentage = totalOrganizationValue > 0 ? (atRiskValue / totalOrganizationValue) * 100 : 0
  
  // Performance metrics
  const avgHealthScore = organization.sites.length > 0 
    ? organization.sites.reduce((sum, site) => sum + site.healthScore.score, 0) / organization.sites.length
    : 0
  const avgChurnRisk = organization.sites.length > 0
    ? organization.sites.reduce((sum, site) => sum + site.churnRisk.score, 0) / organization.sites.length
    : 0
  const retentionRate = Math.max(0, 100 - avgChurnRisk)
  
  // Renewal forecast
  const renewalProbability = organization.sites.length > 0
    ? organization.sites.reduce((sum, site) => sum + site.renewalProbability, 0) / organization.sites.length
    : 0
  const expectedRenewalValue = totalOrganizationValue * (renewalProbability / 100)
  const potentialLoss = totalOrganizationValue - expectedRenewalValue
  
  // Sort sites by value for distribution
  const sortedSites = [...organization.sites]
    .sort((a, b) => (b.total_contract_value || 0) - (a.total_contract_value || 0))
  const maxSiteValue = sortedSites.length > 0 ? (sortedSites[0].total_contract_value || 0) : 0

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
          <BarChart3 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">Ekonomisk Analys</h3>
          <p className="text-sm text-slate-400">
            Värdefördelning och riskanalys per enhet
          </p>
        </div>
      </div>

      {/* Key Economic Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Total Värde</span>
          </div>
          <div className="text-xl font-bold text-green-400 mb-1">
            {formatCurrency(totalOrganizationValue)}
          </div>
          <div className="text-xs text-slate-500">
            Kontrakt: {formatCurrency(totalContractValue)}
          </div>
          {totalCasesValue > 0 && (
            <div className="text-xs text-blue-400">
              Intäkter från ärenden utöver avtal: {formatCurrency(totalCasesValue)}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Snitt/Enhet</span>
          </div>
          <div className="text-xl font-bold text-blue-400 mb-1">
            {formatCurrency(avgValuePerSite)}
          </div>
          <div className="text-xs text-slate-500">
            {organization.totalSites} enheter
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Värde i Risk</span>
          </div>
          <div className="text-xl font-bold text-red-400 mb-1">
            {formatCurrency(atRiskValue)}
          </div>
          <div className="text-xs text-slate-500">
            {atRiskPercentage.toFixed(1)}% av totalt
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wide">Förnyelse-prognos</span>
          </div>
          <div className="text-xl font-bold text-purple-400 mb-1">
            {renewalProbability.toFixed(0)}%
          </div>
          <div className="text-xs text-slate-500">
            ~{formatCurrency(expectedRenewalValue)}
          </div>
        </div>
      </div>

      {/* Value Distribution per Site */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-400" />
          Värdefördelning per Enhet
        </h4>
        
        <div className="space-y-4">
          {sortedSites.map((site) => (
            <ValueDistributionBar
              key={site.id}
              site={site}
              maxValue={maxSiteValue}
              totalValue={totalOrganizationValue}
            />
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-slate-400">Hög prestanda</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-slate-400">Bra prestanda</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                <span className="text-slate-400">Medium risk</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-slate-400">Hög risk</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Risk Breakdown */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Riskanalys
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div>
                <div className="text-red-400 font-medium">Hög Risk</div>
                <div className="text-xs text-slate-500">{highRiskSites.length} enheter</div>
              </div>
              <div className="text-right">
                <div className="text-red-400 font-bold">{formatCurrency(highRiskValue)}</div>
                <div className="text-xs text-slate-500">
                  {totalOrganizationValue > 0 ? ((highRiskValue / totalOrganizationValue) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <div>
                <div className="text-amber-400 font-medium">Medium Risk</div>
                <div className="text-xs text-slate-500">{mediumRiskSites.length} enheter</div>
              </div>
              <div className="text-right">
                <div className="text-amber-400 font-bold">{formatCurrency(mediumRiskValue)}</div>
                <div className="text-xs text-slate-500">
                  {totalOrganizationValue > 0 ? ((mediumRiskValue / totalOrganizationValue) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div>
                <div className="text-green-400 font-medium">Låg Risk</div>
                <div className="text-xs text-slate-500">
                  {organization.totalSites - highRiskSites.length - mediumRiskSites.length} enheter
                </div>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold">
                  {formatCurrency(totalOrganizationValue - atRiskValue)}
                </div>
                <div className="text-xs text-slate-500">
                  {totalOrganizationValue > 0 ? (((totalOrganizationValue - atRiskValue) / totalOrganizationValue) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Forecast */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Prestanda & Prognoser
          </h4>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Retention Rate</span>
                <span className={`font-semibold ${retentionRate >= 90 ? 'text-green-400' : retentionRate >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                  {retentionRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    retentionRate >= 90 ? 'bg-green-400' : retentionRate >= 80 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${retentionRate}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Genomsnitt Health Score</span>
                <span className={`font-semibold ${avgHealthScore >= 80 ? 'text-green-400' : avgHealthScore >= 60 ? 'text-blue-400' : 'text-red-400'}`}>
                  {avgHealthScore.toFixed(0)}/100
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    avgHealthScore >= 80 ? 'bg-green-400' : avgHealthScore >= 60 ? 'bg-blue-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${avgHealthScore}%` }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Förväntad förnyelse:</span>
                <span className="text-green-400 font-medium">{formatCurrency(expectedRenewalValue)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Potentiell förlust:</span>
                <span className="text-red-400 font-medium">{formatCurrency(potentialLoss)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-slate-300">Risk-justerat värde:</span>
                <span className="text-purple-400">{formatCurrency(expectedRenewalValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ärenden Economic Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ärenden Overview */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Ärenden & Tillfälliga Arbeten
          </h4>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {totalCasesCount}
                </div>
                <div className="text-xs text-slate-400">Totalt ärenden</div>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {formatCurrency(totalCasesValue)}
                </div>
                <div className="text-xs text-slate-400">Ärendevärde</div>
              </div>
            </div>
            
            {/* Per Site Ärenden Breakdown */}
            <div className="pt-4 border-t border-slate-700/50">
              <div className="text-sm text-slate-400 mb-3">Ärenden per enhet:</div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {organization.sites.map((site) => {
                  // Real cases data per site from useConsolidatedCustomers
                  const siteCasesCount = site.casesCount
                  const siteCasesValue = site.casesValue
                  
                  return (
                    <div key={site.id} className="flex items-center justify-between p-2 bg-slate-700/20 rounded">
                      <span className="text-slate-300 text-sm truncate">
                        {site.site_name || site.company_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{siteCasesCount} ärenden</span>
                        <span className="text-sm font-medium text-green-400">
                          {formatCurrency(siteCasesValue)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {totalCasesCount === 0 && (
                <div className="text-center py-6 text-slate-400">
                  <div className="mb-2">📋</div>
                  <div className="text-sm">Inga ärenden ännu</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Ärenden visas här när de skapas i systemet
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Billing Status Analysis */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h4 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            Faktureringsstatus (Ärenden)
          </h4>
          
          <div className="space-y-4">
            {/* Billing Status Cards */}
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-amber-400 font-medium text-sm">Väntande</div>
                    <div className="text-xs text-slate-500">Pending billing</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold">{formatCurrency(casesBillingBreakdown.pending?.value || 0)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-blue-400 font-medium text-sm">Skickad</div>
                    <div className="text-xs text-slate-500">Invoice sent</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-400 font-bold">{formatCurrency(casesBillingBreakdown.sent?.value || 0)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-green-400 font-medium text-sm">Betald</div>
                    <div className="text-xs text-slate-500">Payment received</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">{formatCurrency(casesBillingBreakdown.paid?.value || 0)}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-500/10 rounded-lg border border-slate-500/20">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-slate-400 font-medium text-sm">Hoppa över</div>
                    <div className="text-xs text-slate-500">Skip billing</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 font-bold">{formatCurrency(casesBillingBreakdown.skip?.value || 0)}</div>
                </div>
              </div>
            </div>
            
            {/* Billing Progress */}
            {totalCasesValue > 0 && (
              <div className="pt-4 border-t border-slate-700/50">
                <div className="text-sm text-slate-400 mb-2">Faktureringsframsteg:</div>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-green-400 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${totalCasesValue > 0 ? ((casesBillingBreakdown.paid?.value || 0) / totalCasesValue) * 100 : 0}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {totalCasesValue > 0 ? Math.round(((casesBillingBreakdown.paid?.value || 0) / totalCasesValue) * 100) : 0}% betalt
                  </span>
                  <span>
                    {formatCurrency(casesBillingBreakdown.paid?.value || 0)} / {formatCurrency(totalCasesValue)}
                  </span>
                </div>
              </div>
            )}
            
            {totalCasesValue === 0 && (
              <div className="text-center py-6 text-slate-400">
                <div className="mb-2">📊</div>
                <div className="text-sm">Ingen faktureringsstatus ännu</div>
                <div className="text-xs text-slate-500 mt-1">
                  Visas när cases med priser skapas
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </section>
  )
}