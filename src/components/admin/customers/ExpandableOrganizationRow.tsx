// src/components/admin/customers/ExpandableOrganizationRow.tsx - Kompakt rad, klick öppnar sidopanel

import React from 'react'
import { ChevronDown, ChevronRight, Building2, Users } from 'lucide-react'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'
import CustomTooltip from '../../ui/CustomTooltip'

interface ExpandableOrganizationRowProps {
  organization: ConsolidatedCustomer
  isExpanded: boolean
  onToggleMultisiteSites: () => void
  onOpenPanel: (org: ConsolidatedCustomer) => void
  visibleColumns?: Set<string>
  contactCount?: number
  isHighlighted?: boolean
}

const HealthScoreBadge: React.FC<{ level: string; score: number }> = ({ level, score }) => {
  const styles = (() => {
    switch (level) {
      case 'excellent': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'good': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'fair': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'poor': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  })()
  const text = (() => {
    switch (level) {
      case 'excellent': return 'Utmärkt'
      case 'good': return 'Bra'
      case 'fair': return 'Ok'
      case 'poor': return 'Risk'
      default: return 'Okänd'
    }
  })()
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles}`}>
      {text} ({score})
    </span>
  )
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const formatContractPeriod = (
  org: ConsolidatedCustomer,
  isTerminated: boolean
): { period: string; remaining: string; color: string } => {
  if (!org.nextRenewalDate) {
    return { period: 'Okänt avtal', remaining: '', color: 'text-slate-400' }
  }

  const endDate = new Date(org.nextRenewalDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const monthsRemaining = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24 * 30.44)))

  let startText = ''
  if (org.earliestContractStartDate) {
    startText = new Date(org.earliestContractStartDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const endText = endDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  const period = startText ? `${startText} – ${endText}` : endText

  let remaining = ''
  let color = 'text-slate-400'

  if (diffDays < 0) {
    if (isTerminated) return { period, remaining: '', color: 'text-slate-400' }
    remaining = 'Fortlöpande – avtalstid passerad'
    color = 'text-amber-400'
  } else if (monthsRemaining <= 6) {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-red-400'
  } else if (monthsRemaining <= 12) {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-amber-400'
  } else {
    remaining = `${monthsRemaining} mån kvar`
    color = 'text-green-400'
  }

  return { period, remaining, color }
}

export const ExpandableOrganizationRow: React.FC<ExpandableOrganizationRowProps> = ({
  organization,
  isExpanded,
  onToggleMultisiteSites,
  onOpenPanel,
  visibleColumns,
  contactCount,
  isHighlighted,
}) => {
  const isVisible = (col: string) => !visibleColumns || visibleColumns.has(col)
  const isMultisite = organization.organizationType === 'multisite'
  const isTerminated = organization.isTerminated

  // Röd border på kritiska rader
  const urgencyBorder =
    (organization.daysToNextRenewal != null && organization.daysToNextRenewal <= 30)
      || organization.highestChurnRisk.risk === 'high'
      ? 'border-l-[3px] border-l-red-500'
      : 'border-l-[3px] border-l-transparent'

  const handleRowClick = () => onOpenPanel(organization)

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isMultisite) onToggleMultisiteSites()
    else onOpenPanel(organization)
  }

  return (
    <tr
      data-customer-row-id={organization.id}
      onClick={handleRowClick}
      className={`border-b border-slate-700/50 transition-colors duration-200 cursor-pointer ${
        isHighlighted
          ? 'bg-[#20c58f]/10 border-l-[3px] border-l-[#20c58f] ring-2 ring-[#20c58f]/50 shadow-[0_0_20px_-4px_rgba(32,197,143,0.55)]'
          : `hover:bg-slate-800/40 ${isExpanded ? 'bg-slate-800/30' : ''} ${urgencyBorder}`
      }`}
    >
      {/* Company & Contact Column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isMultisite ? (
            <button
              onClick={handleChevronClick}
              className="p-1 rounded hover:bg-slate-600 transition-colors"
              aria-label={isExpanded ? 'Dölj enheter' : 'Visa enheter'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          {isMultisite ? (
            <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
          ) : (
            <div className="w-4 h-4 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-sm font-semibold text-white truncate">{organization.company_name}</span>
              {organization.customer_number != null && (
                <span className="text-xs font-mono text-[#20c58f]/70">#{organization.customer_number}</span>
              )}
              {isMultisite && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                  {organization.totalSites} enheter
                </span>
              )}
              {/* Status-badge */}
              {organization.isPaused ? (
                <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Pausad{organization.pausedUntil ? ` till ${new Date(organization.pausedUntil).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : ''}
                </span>
              ) : isTerminated ? (
                <span className="text-[10px] font-medium bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
                  Uppsagt
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Aktiv
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {organization.contact_person && (
                <span>{organization.contact_person} • </span>
              )}
              <span>{organization.contact_email}</span>
              {contactCount != null && contactCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-slate-600">
                  <Users className="w-3 h-3" />
                  {contactCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Annual Premium Column */}
      {isVisible('annualValue') && (
        <td className="px-4 py-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-white">
              {formatCurrency(organization.totalAnnualValue || 0)}
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              {formatCurrency((organization.totalAnnualValue || 0) / 12)}/mån
            </div>
          </div>
        </td>
      )}

      {/* Extra Billing Column */}
      {isVisible('casesValue') && (
        <td className="hidden lg:table-cell px-4 py-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-white">
              {formatCurrency(organization.totalCasesValue || 0)}
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              utöver avtal
            </div>
          </div>
        </td>
      )}

      {/* Total Contract Value Column */}
      {isVisible('contractValue') && (
        <td className="px-4 py-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-white">
              {formatCurrency(organization.totalContractValue)}
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              totalt värde
            </div>
          </div>
        </td>
      )}

      {/* Contract Period Column */}
      {isVisible('contractPeriod') && (
        <td className="px-4 py-3">
          {(() => {
            const { period, remaining, color } = formatContractPeriod(organization, isTerminated)
            return (
              <div className="space-y-0.5">
                <div className="text-xs text-slate-300">{period}</div>
                {isTerminated ? (
                  <div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                      Uppsagt
                    </span>
                    {organization.effectiveEndDate && (
                      <div className="text-[10px] text-red-400 mt-0.5">
                        Slutar {new Date(organization.effectiveEndDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                ) : remaining ? (
                  <div className={`text-[10px] font-medium ${color}`}>{remaining}</div>
                ) : null}
              </div>
            )
          })()}
        </td>
      )}

      {/* Health Score Column */}
      {isVisible('healthScore') && (
        <td className="px-4 py-3">
          <CustomTooltip
            content={
              <div className="space-y-2">
                <div className="font-semibold">Health Score</div>
                <div className="text-xs">
                  Beräknas utifrån kontraktsålder, kommunikation, support, betalningar och avtalsföljsamhet.
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
        </td>
      )}

      {/* Churn Risk Column */}
      {isVisible('churnRisk') && (
        <td className="px-4 py-3">
          <div className={`text-sm font-medium ${
            organization.highestChurnRisk.risk === 'high' ? 'text-red-400' :
            organization.highestChurnRisk.risk === 'medium' ? 'text-yellow-400' :
            'text-emerald-400'
          }`}>
            {organization.highestChurnRisk.risk === 'high' ? 'Hög' :
             organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
          </div>
          <div className="text-[10px] text-slate-500">
            {Math.round(organization.highestChurnRisk.score)}%
          </div>
        </td>
      )}

      {/* Manager Column */}
      {isVisible('manager') && (
        <td className="px-4 py-3">
          <div className="text-xs text-slate-300">
            {organization.assigned_account_manager || (
              <span className="text-slate-600 italic">Ej tilldelad</span>
            )}
          </div>
        </td>
      )}

      {/* Actions column — bara en chevron som indikator att raden är klickbar */}
      <td className="px-4 py-3 w-10">
        <div className="flex items-center justify-end">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </div>
      </td>
    </tr>
  )
}

export default ExpandableOrganizationRow
