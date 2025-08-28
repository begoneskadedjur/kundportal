// src/components/admin/customers/SiteDetailRow.tsx - Rad för individuella sites under organisationer

import React from 'react'
import { MapPin, Building2 } from 'lucide-react'
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
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'none':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
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
    return 'Utgånget'
  } else if (diffDays <= 30) {
    return `${diffDays} dagar`
  } else if (diffDays <= 90) {
    const months = Math.ceil(diffDays / 30)
    return `${months} mån`
  } else {
    const months = Math.ceil(diffDays / 30)
    return `${months} mån`
  }
}

const getSiteTypeIcon = (siteType: string | null | undefined) => {
  if (siteType === 'huvudkontor') {
    return <Building2 className="h-4 w-4 text-blue-400" />
  }
  return <MapPin className="h-4 w-4 text-slate-400" />
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
    <tr className="border-b border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/40 transition-colors duration-200">
      {/* Company & Contact Column */}
      <td className="px-6 py-3">
        <div className="flex items-center" style={{ paddingLeft: `${indentWidth}px` }}>
          <div className="mr-2 text-slate-500">└─</div>
          
          <div className="flex items-center">
            {getSiteTypeIcon(site.site_type)}
            
            <div className="ml-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200 text-sm">
                  {site.site_name || site.company_name}
                </span>
                <span className="text-xs bg-slate-600/50 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
                  {getSiteTypeName(site.site_type)}
                </span>
                {site.region && (
                  <span className="text-xs text-slate-500">
                    {site.region}
                  </span>
                )}
              </div>
              
              <div className="text-xs text-slate-400 mt-1">
                {site.contact_person && (
                  <span>{site.contact_person} • </span>
                )}
                <span className="text-blue-400">{site.contact_email}</span>
              </div>
              
              {site.site_code && (
                <div className="text-xs text-slate-500 mt-1">
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

      {/* Contract Value Column - Simplified for sites under org */}
      <td className="px-6 py-3">
        <div className="text-right text-sm">
          <div className="font-medium text-slate-300 text-xs">
            {formatCurrency(site.total_contract_value || 0)}
          </div>
          <div className="text-xs text-slate-500">
            {formatCurrency(site.monthly_value || 0)}/mån
          </div>
        </div>
      </td>

      {/* Contract Period Column - Only show if different from org */}
      <td className="px-6 py-3">
        <div className="text-xs text-slate-400">
          {formatContractPeriod(site)}
        </div>
        {site.contractProgress.daysRemaining <= 90 && site.contractProgress.daysRemaining > 0 && (
          <div className="text-xs text-amber-400 mt-1 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            Utgår snart
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
          site.churnRisk.risk === 'high' ? 'text-red-400' :
          site.churnRisk.risk === 'medium' ? 'text-yellow-400' :
          'text-green-400'
        }`}>
          {site.churnRisk.risk === 'high' ? 'Hög' :
           site.churnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
        </div>
        <div className="text-xs text-slate-500">
          {Math.round(site.churnRisk.score)}%
        </div>
      </td>

      {/* Manager Column - Simplified for sites (often inherited from org) */}
      <td className="px-6 py-3">
        <div className="text-xs text-slate-500">
          {site.assigned_account_manager ? (
            <span className="italic">Som organisation</span>
          ) : (
            '—'
          )}
        </div>
      </td>

      {/* Actions Column */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          {/* Site-specific actions */}
          <button
            onClick={() => onSiteContact?.(site)}
            className="text-slate-400 hover:text-slate-200 text-xs transition-colors duration-200"
            title="Kontakta enhet"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={() => onSiteEdit?.(site)}
            className="text-slate-400 hover:text-slate-200 text-xs transition-colors duration-200"
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