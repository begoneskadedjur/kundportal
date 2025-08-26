// src/components/admin/customers/SiteDetailRow.tsx - Rad för individuella sites under organisationer

import React from 'react'
import { MapPinIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { CustomerSite } from '../../../hooks/useConsolidatedCustomers'

interface SiteDetailRowProps {
  site: CustomerSite
  indentLevel?: number
  onSiteEdit?: (site: CustomerSite) => void
  onSiteContact?: (site: CustomerSite) => void
}

const PortalAccessBadge: React.FC<{ status: 'none' | 'pending' | 'active' }> = ({ status }) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'none':
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getBadgeText = () => {
    switch (status) {
      case 'active':
        return '✓ Aktiv'
      case 'pending':
        return '⏳ Väntande'
      case 'none':
        return '✗ Ingen'
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getBadgeStyles()}`}>
      {getBadgeText()}
    </span>
  )
}

const HealthScoreBadge: React.FC<{ level: string; score: number }> = ({ level, score }) => {
  const getBadgeStyles = () => {
    switch (level) {
      case 'excellent':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'good':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'fair':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'poor':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200'
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getBadgeStyles()}`}>
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

const formatContractPeriod = (site: CustomerSite): string => {
  if (!site.contract_end_date) return 'Okänt'
  
  const endDate = new Date(site.contract_end_date)
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

const getSiteTypeIcon = (siteType: string | null | undefined) => {
  if (siteType === 'huvudkontor') {
    return <BuildingOffice2Icon className="h-4 w-4 text-blue-500" />
  }
  return <MapPinIcon className="h-4 w-4 text-gray-400" />
}

const getSiteTypeName = (siteType: string | null | undefined) => {
  if (siteType === 'huvudkontor') return 'Huvudkontor'
  if (siteType === 'enhet') return 'Enhet'
  return 'Okänd'
}

export const SiteDetailRow: React.FC<SiteDetailRowProps> = ({
  site,
  indentLevel = 1,
  onSiteEdit,
  onSiteContact
}) => {
  const indentWidth = indentLevel * 24 // 24px per indent level

  return (
    <tr className="border-b border-gray-100 bg-gray-50/50 hover:bg-gray-100/50">
      {/* Company & Contact Column */}
      <td className="px-6 py-3">
        <div className="flex items-center" style={{ paddingLeft: `${indentWidth}px` }}>
          <div className="mr-2 text-gray-300">└─</div>
          
          <div className="flex items-center">
            {getSiteTypeIcon(site.site_type)}
            
            <div className="ml-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 text-sm">
                  {site.site_name || site.company_name}
                </span>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  {getSiteTypeName(site.site_type)}
                </span>
                {site.region && (
                  <span className="text-xs text-gray-500">
                    {site.region}
                  </span>
                )}
              </div>
              
              <div className="text-xs text-gray-600 mt-1">
                {site.contact_person && (
                  <span>{site.contact_person} • </span>
                )}
                <span className="text-blue-600">{site.contact_email}</span>
              </div>
              
              {site.site_code && (
                <div className="text-xs text-gray-500 mt-1">
                  Kod: {site.site_code}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Portal Access Column */}
      <td className="px-6 py-3">
        <PortalAccessBadge status={site.invitationStatus || 'none'} />
      </td>

      {/* Contract Value Column */}
      <td className="px-6 py-3">
        <div className="text-right text-sm">
          <div className="font-medium text-gray-700">
            {formatCurrency(site.total_contract_value || 0)}
          </div>
          <div className="text-xs text-gray-500">
            {formatCurrency(site.monthly_value || 0)}/mån
          </div>
        </div>
      </td>

      {/* Contract Period Column */}
      <td className="px-6 py-3">
        <div className="text-sm text-gray-700">
          {formatContractPeriod(site)}
        </div>
        {site.contractProgress.daysRemaining <= 90 && site.contractProgress.daysRemaining > 0 && (
          <div className="text-xs text-amber-600 mt-1">
            ⚠ Utgår snart
          </div>
        )}
      </td>

      {/* Health Score Column */}
      <td className="px-6 py-3">
        <HealthScoreBadge 
          level={site.healthScore.level} 
          score={site.healthScore.score} 
        />
      </td>

      {/* Churn Risk Column */}
      <td className="px-6 py-3">
        <div className={`text-sm font-medium ${
          site.churnRisk.risk === 'high' ? 'text-red-600' :
          site.churnRisk.risk === 'medium' ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {site.churnRisk.risk === 'high' ? 'Hög' :
           site.churnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
        </div>
        <div className="text-xs text-gray-400">
          {Math.round(site.churnRisk.score)}%
        </div>
      </td>

      {/* Manager Column */}
      <td className="px-6 py-3">
        <div className="text-sm text-gray-600">
          {site.assigned_account_manager || '—'}
        </div>
      </td>

      {/* Actions Column */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          {/* Site-specific actions */}
          <button
            onClick={() => onSiteContact?.(site)}
            className="text-gray-400 hover:text-gray-600 text-xs"
            title="Kontakta enhet"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={() => onSiteEdit?.(site)}
            className="text-gray-400 hover:text-gray-600 text-xs"
            title="Redigera enhet"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

export default SiteDetailRow