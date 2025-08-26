// src/components/admin/customers/ExpandableOrganizationRow.tsx - Expanderbar rad för organisationer

import React from 'react'
import { ChevronDown, ChevronRight, Building2, Users } from 'lucide-react'
import { ConsolidatedCustomer, PortalAccessStatus } from '../../../hooks/useConsolidatedCustomers'

interface ExpandableOrganizationRowProps {
  organization: ConsolidatedCustomer
  isExpanded: boolean
  onToggle: () => void
  onInviteToPortal?: (org: ConsolidatedCustomer) => void
  onEdit?: (org: ConsolidatedCustomer) => void
  onEmailContact?: (org: ConsolidatedCustomer) => void
  onViewDetails?: (org: ConsolidatedCustomer) => void
}

const PortalAccessBadge: React.FC<{ status: PortalAccessStatus; userCount: number }> = ({ status, userCount }) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'full':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'none':
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getBadgeText = () => {
    switch (status) {
      case 'full':
        return `✓ Portal (${userCount})`
      case 'partial':
        return `⚠ Delvis (${userCount})`
      case 'none':
        return '✗ Ingen'
    }
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeStyles()}`}>
      {getBadgeText()}
    </span>
  )
}

const HealthScoreBadge: React.FC<{ level: string; score: number }> = ({ level, score }) => {
  const getBadgeStyles = () => {
    switch (level) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'fair':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'poor':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
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
  if (!org.nextRenewalDate) return 'Okänt'
  
  const endDate = new Date(org.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return 'Utgången'
  } else if (diffDays <= 30) {
    return `${diffDays} dagar kvar`
  } else if (diffDays <= 90) {
    return `~${Math.ceil(diffDays / 30)} mån kvar`
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
  onViewDetails
}) => {
  const isMultisite = organization.organizationType === 'multisite'
  
  return (
    <tr className={`border-b border-gray-200 hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
      {/* Company & Contact Column */}
      <td className="px-6 py-4">
        <div className="flex items-center">
          <button
            onClick={onToggle}
            className="mr-3 p-1 rounded hover:bg-gray-200 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          <div className="flex-1">
            <div className="flex items-center">
              {isMultisite ? (
                <Building2 className="h-5 w-5 text-blue-500 mr-2" />
              ) : (
                <div className="w-5 h-5 mr-2" />
              )}
              <div>
                <div className="font-semibold text-gray-900">
                  {organization.company_name}
                  {isMultisite && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {organization.totalSites} enheter
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {organization.contact_person && (
                    <span>{organization.contact_person} • </span>
                  )}
                  <span className="text-blue-600">{organization.contact_email}</span>
                </div>
                {isMultisite && (
                  <div className="text-xs text-gray-500 mt-1">
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
            <span className="text-xs text-amber-600">
              +{organization.pendingInvitationsCount} väntande
            </span>
          )}
        </div>
      </td>

      {/* Contract Value Column */}
      <td className="px-6 py-4">
        <div className="text-right">
          <div className="font-semibold text-gray-900">
            {formatCurrency(organization.totalContractValue)}
          </div>
          <div className="text-sm text-gray-600">
            {formatCurrency(organization.totalMonthlyValue)}/mån
          </div>
        </div>
      </td>

      {/* Contract Period Column */}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {formatContractPeriod(organization)}
        </div>
        {organization.hasExpiringSites && (
          <div className="text-xs text-amber-600 mt-1">
            ⚠ Utgående avtal
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
        <div className="text-xs text-gray-500">
          {Math.round(organization.highestChurnRisk.score)}%
        </div>
      </td>

      {/* Manager Column */}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">
          {organization.assigned_account_manager || 'Ej tilldelad'}
        </div>
        {organization.account_manager_email && (
          <div className="text-xs text-gray-500">
            {organization.account_manager_email}
          </div>
        )}
      </td>

      {/* Actions Column */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {/* Portal invite button */}
          {organization.portalAccessStatus !== 'full' && onInviteToPortal && (
            <button
              onClick={() => onInviteToPortal(organization)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              title={isMultisite ? "Bjud in organisation till portal" : "Bjud in till portal"}
            >
              <Users className="h-4 w-4" />
            </button>
          )}

          {/* Actions dropdown */}
          <div className="relative inline-block text-left">
            <button
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
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