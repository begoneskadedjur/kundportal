// src/components/admin/customers/ExpandableOrganizationRow.tsx - Expanderbar rad för organisationer

import React from 'react'
import { ChevronDown, ChevronRight, Building2, ExternalLink, Edit3, Coins } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import CustomTooltip from '../../ui/CustomTooltip'

interface ExpandableOrganizationRowProps {
  organization: ConsolidatedCustomer
  isExpanded: boolean
  onToggle: () => void
  onInviteToPortal?: (org: ConsolidatedCustomer) => void
  onEdit?: (org: ConsolidatedCustomer) => void
  onEmailContact?: (org: ConsolidatedCustomer) => void
  onViewDetails?: (org: ConsolidatedCustomer) => void
  onViewMultiSiteDetails?: (org: ConsolidatedCustomer) => void
  onViewSingleCustomerDetails?: (org: ConsolidatedCustomer) => void
  onViewRevenue?: (org: ConsolidatedCustomer) => void
}

const HealthScoreBadge: React.FC<{ level: string; score: number }> = ({ level, score }) => {
  const getBadgeStyles = () => {
    switch (level) {
      case 'excellent':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'good':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'fair':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'poor':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getHealthText = () => {
    switch (level) {
      case 'excellent':
        return 'Utmärkt'
      case 'good':
        return 'Bra'
      case 'fair':
        return 'Ok'
      case 'poor':
        return 'Risk'
      default:
        return 'Okänd'
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeStyles()}`}>
      {getHealthText()} ({score})
    </span>
  )
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatContractPeriod = (org: ConsolidatedCustomer): { period: string; remaining: string; color: string } => {
  if (!org.nextRenewalDate) {
    return { period: 'Okänt avtal', remaining: '', color: 'text-slate-400' }
  }
  
  const endDate = new Date(org.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // Beräkna antal månader kvar mer exakt
  const monthsRemaining = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24 * 30.44)))
  
  // Formatera start- och slutdatum med exakt dag
  let startText = ''
  if (org.earliestContractStartDate) {
    const startDate = new Date(org.earliestContractStartDate)
    startText = startDate.toLocaleDateString('sv-SE', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }
  
  const endText = endDate.toLocaleDateString('sv-SE', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  })
  
  // Bygg ihop perioden
  const period = startText ? `${startText} - ${endText}` : endText
  
  // Månadsbaserad färgkodning: Röd ≤ 6 mån, Gul 7-12 mån, Grön > 12 mån
  let remaining = ''
  let color = 'text-slate-400'
  
  if (diffDays < 0) {
    remaining = 'Utgånget'
    color = 'text-red-400'
  } else if (monthsRemaining <= 6) {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-red-400'    // Röd - Akut uppmärksamhet
  } else if (monthsRemaining <= 12) {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-amber-400'  // Gul - Planering behövs
  } else {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-green-400'  // Grön - Stabilt
  }
  
  return { period, remaining, color }
}

export const ExpandableOrganizationRow: React.FC<ExpandableOrganizationRowProps> = ({
  organization,
  isExpanded,
  onToggle,
  onInviteToPortal,
  onEdit,
  onEmailContact,
  onViewDetails,
  onViewMultiSiteDetails,
  onViewSingleCustomerDetails,
  onViewRevenue
}) => {
  const isMultisite = organization.organizationType === 'multisite'
  
  return (
    <tr className={`border-b border-slate-700 hover:bg-slate-800/50 transition-colors duration-200 ${isExpanded ? 'bg-slate-800/30' : ''}`}>
      {/* Company & Contact Column */}
      <td className="px-6 py-4">
        <div className="flex items-center">
          <button
            onClick={onToggle}
            className="mr-3 p-1 rounded hover:bg-slate-600 transition-colors duration-200"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-400" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center">
              {isMultisite ? (
                <Building2 className="h-5 w-5 text-blue-400 mr-2" />
              ) : (
                <div className="w-5 h-5 mr-2" />
              )}
              <div>
                <div className="font-semibold text-slate-200">
                  {organization.company_name}
                  {isMultisite && (
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                      {organization.totalSites} enheter
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  {organization.contact_person && (
                    <span>{organization.contact_person} • </span>
                  )}
                  <span className="text-blue-400">{organization.contact_email}</span>
                </div>
                {isMultisite && (
                  <div className="text-xs text-slate-500 mt-1">
                    📍 {organization.totalSites} enheter | 
                    💰 {formatCurrency(organization.totalContractValue)}/år
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>

      {/* Annual Premium Column */}
      <td className="px-4 lg:px-6 py-4">
        <div className="text-right">
          <div className="font-semibold text-green-400 text-sm lg:text-base">
            {formatCurrency(organization.totalAnnualValue || 0)}
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            {formatCurrency((organization.totalAnnualValue || 0) / 12)}/mån
          </div>
        </div>
      </td>

      {/* Extra Billing Column */}
      <td className="hidden lg:table-cell px-4 lg:px-6 py-4">
        <div className="text-right">
          <div className="font-semibold text-blue-400 text-sm lg:text-base">
            {formatCurrency(organization.totalCasesValue || 0)}
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            utöver avtal
          </div>
        </div>
      </td>

      {/* Total Contract Value Column */}
      <td className="px-4 lg:px-6 py-4">
        <div className="text-right">
          <div className="font-semibold text-slate-200 text-sm lg:text-base">
            {formatCurrency(organization.totalContractValue)}
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            totalt värde
          </div>
        </div>
      </td>

      {/* Contract Period Column */}
      <td className="px-6 py-4">
        {(() => {
          const { period, remaining, color } = formatContractPeriod(organization)
          return (
            <div className="space-y-1">
              <div className="text-sm text-slate-200 font-medium">
                {period}
              </div>
              {remaining && (
                <div className={`text-xs font-medium ${color}`}>
                  {remaining}
                </div>
              )}
            </div>
          )
        })()}
      </td>

      {/* Health Score Column */}
      <td className="px-6 py-4">
        <CustomTooltip
          content={
            <div className="space-y-2">
              <div className="font-semibold">Health Score</div>
              <div className="text-xs">
                Beräknas utifrån:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Antal aktiva ärenden</li>
                  <li>Genomsnittlig responstid</li>
                  <li>Kundnöjdhet från enkäter</li>
                  <li>Betalningshistorik</li>
                  <li>Avtalsföljsamhet</li>
                </ul>
              </div>
              <div className="text-xs pt-1 border-t border-slate-600">
                <strong>Excellent:</strong> 90-100 poäng<br/>
                <strong>Good:</strong> 70-89 poäng<br/>
                <strong>Fair:</strong> 50-69 poäng<br/>
                <strong>Poor:</strong> Under 50 poäng
              </div>
            </div>
          }
          position="left"
        >
          <HealthScoreBadge 
            level={organization.overallHealthScore.level} 
            score={organization.overallHealthScore.score} 
          />
        </CustomTooltip>
        {organization.hasHighRiskSites && (
          <div className="text-xs text-red-600 mt-1">
            ⚠ Riskenhet
          </div>
        )}
      </td>

      {/* Churn Risk Column */}
      <td className="px-6 py-4">
        <CustomTooltip
          content={
            <div className="space-y-2">
              <div className="font-semibold">Churn Risk</div>
              <div className="text-xs">
                Sannolikhet att kunden säger upp avtalet:
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Betalningsförseningar</li>
                  <li>Minskat engagemang</li>
                  <li>Support-ärenden trend</li>
                  <li>Användning av tjänster</li>
                  <li>Avtalsförnyelsehistorik</li>
                </ul>
              </div>
              <div className="text-xs pt-1 border-t border-slate-600">
                <strong>Hög risk:</strong> &gt;70% sannolikhet<br/>
                <strong>Medel risk:</strong> 40-70% sannolikhet<br/>
                <strong>Låg risk:</strong> &lt;40% sannolikhet
              </div>
            </div>
          }
          position="left"
        >
          <div className={`text-sm font-medium ${
            organization.highestChurnRisk.risk === 'high' ? 'text-red-600' :
            organization.highestChurnRisk.risk === 'medium' ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {organization.highestChurnRisk.risk === 'high' ? 'Hög' :
             organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
          </div>
        </CustomTooltip>
        <div className="text-xs text-slate-500">
          {Math.round(organization.highestChurnRisk.score)}%
        </div>
      </td>

      {/* Manager Column */}
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-slate-200">
          {organization.assigned_account_manager || (
            <span className="text-slate-500 italic">Ej tilldelad</span>
          )}
        </div>
        {organization.account_manager_email && (
          <div className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
            {organization.account_manager_email}
          </div>
        )}
      </td>

      {/* Actions Column */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {/* Revenue Overview Button */}
          {onViewRevenue && (
            <button
              onClick={() => onViewRevenue(organization)}
              className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors duration-200"
              title="Visa intäktsöversikt"
            >
              <Coins className="h-4 w-4" />
            </button>
          )}

          {/* Multisite Detail Button */}
          {isMultisite && onViewMultiSiteDetails && (
            <button
              onClick={() => onViewMultiSiteDetails(organization)}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors duration-200"
              title="Visa detaljerad multisite-vy"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}

          {/* Single Customer Detail Button */}
          {!isMultisite && onViewSingleCustomerDetails && (
            <button
              onClick={() => onViewSingleCustomerDetails(organization)}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors duration-200"
              title="Visa detaljerad kundvy"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}

          {/* Edit Customer Button */}
          {onEdit && (
            <button
              onClick={() => onEdit(organization)}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors duration-200"
              title="Redigera kund"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default ExpandableOrganizationRow