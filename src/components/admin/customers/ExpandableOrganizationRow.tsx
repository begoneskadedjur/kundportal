// src/components/admin/customers/ExpandableOrganizationRow.tsx - Expanderbar rad för organisationer

import React from 'react'
import { ChevronDown, ChevronRight, Building2, Users, ExternalLink, AlertTriangle } from 'lucide-react'
import { ConsolidatedCustomer, PortalAccessStatus } from '../../../hooks/useConsolidatedCustomers'

interface ExpandableOrganizationRowProps {
  organization: ConsolidatedCustomer
  isExpanded: boolean
  onToggle: () => void
  onInviteToPortal?: (org: ConsolidatedCustomer) => void
  onEdit?: (org: ConsolidatedCustomer) => void
  onEmailContact?: (org: ConsolidatedCustomer) => void
  onViewDetails?: (org: ConsolidatedCustomer) => void
  onViewMultiSiteDetails?: (org: ConsolidatedCustomer) => void
}

const PortalAccessBadge: React.FC<{ status: PortalAccessStatus; userCount: number }> = ({ status, userCount }) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'full':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'none':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  const getBadgeIcon = () => {
    switch (status) {
      case 'full':
        return '✓'
      case 'partial':
        return '⚠'
      case 'none':
        return '✗'
    }
  }

  const getBadgeLabel = () => {
    switch (status) {
      case 'full':
        return 'Full tillgång'
      case 'partial':
        return 'Delvis tillgång'
      case 'none':
        return 'Ingen tillgång'
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeStyles()}`}>
        {getBadgeIcon()} {getBadgeLabel()}
      </span>
      {(status === 'full' || status === 'partial') && userCount > 0 && (
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-mono">
            {userCount} {userCount === 1 ? 'användare' : 'användare'}
          </span>
        </div>
      )}
    </div>
  )
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

const formatContractPeriod = (org: ConsolidatedCustomer): string => {
  if (!org.nextRenewalDate) return 'Okänt avtal'
  
  const endDate = new Date(org.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return 'Utgånget'
  } else if (diffDays <= 30) {
    return `${diffDays} dagar`
  } else if (diffDays <= 90) {
    const months = Math.ceil(diffDays / 30)
    return `${months} mån`
  } else if (diffDays <= 365) {
    const months = Math.ceil(diffDays / 30)
    return `${months} månader`
  } else {
    return endDate.toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'short' 
    })
  }
}

export const ExpandableOrganizationRow: React.FC<ExpandableOrganizationRowProps> = ({
  organization,
  isExpanded,
  onToggle,
  onInviteToPortal,
  onEdit,
  onEmailContact,
  onViewDetails,
  onViewMultiSiteDetails
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

      {/* Portal Access Column */}
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1">
          <PortalAccessBadge 
            status={organization.portalAccessStatus} 
            userCount={organization.activeUsersCount} 
          />
          {organization.pendingInvitationsCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
              <span className="text-xs text-amber-400">
                {organization.pendingInvitationsCount} väntande inbjudan{organization.pendingInvitationsCount > 1 ? 'ar' : ''}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* Contract Value Column */}
      <td className="px-6 py-4">
        <div className="text-right">
          <div className="font-semibold text-slate-200">
            {formatCurrency(organization.totalContractValue)}
          </div>
          <div className="text-sm text-slate-400">
            {formatCurrency(organization.totalMonthlyValue)}/mån
          </div>
        </div>
      </td>

      {/* Contract Period Column */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-200 font-medium">
            {formatContractPeriod(organization)}
          </div>
          {organization.daysToNextRenewal && (
            <div className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              organization.daysToNextRenewal <= 30 
                ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                : organization.daysToNextRenewal <= 90 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-green-500/20 text-green-400 border-green-500/30'
            }`}>
              {organization.daysToNextRenewal <= 30 ? '🔥 ' : ''}
              {organization.daysToNextRenewal} dagar
            </div>
          )}
        </div>
        {organization.hasExpiringSites && (
          <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Utgående avtal
          </div>
        )}
      </td>

      {/* Health Score Column */}
      <td className="px-6 py-4">
        <HealthScoreBadge 
          level={organization.overallHealthScore.level} 
          score={organization.overallHealthScore.score} 
        />
        {organization.hasHighRiskSites && (
          <div className="text-xs text-red-600 mt-1">
            ⚠ Riskenhet
          </div>
        )}
      </td>

      {/* Churn Risk Column */}
      <td className="px-6 py-4">
        <div className={`text-sm font-medium ${
          organization.highestChurnRisk.risk === 'high' ? 'text-red-600' :
          organization.highestChurnRisk.risk === 'medium' ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {organization.highestChurnRisk.risk === 'high' ? 'Hög' :
           organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
        </div>
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
          
          {/* Portal invite button */}
          {organization.portalAccessStatus !== 'full' && onInviteToPortal && (
            <button
              onClick={() => onInviteToPortal(organization)}
              className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors duration-200"
              title={isMultisite ? "Bjud in organisation till portal" : "Bjud in till portal"}
            >
              <Users className="h-4 w-4" />
            </button>
          )}

          {/* Actions dropdown */}
          <div className="relative inline-block text-left">
            <button
              className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-600 transition-colors duration-200"
              title="Fler åtgärder"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export default ExpandableOrganizationRow