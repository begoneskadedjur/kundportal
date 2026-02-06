// src/components/admin/customers/MultisiteExpandedTabs.tsx - Tabbad expanderad vy för multisite-organisationer

import React, { useState } from 'react'
import {
  Users, Mail, Phone, Building2, MapPin, DollarSign,
  Activity, AlertTriangle, Crown, Shield, UserCheck, HelpCircle
} from 'lucide-react'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { ConsolidatedCustomer } from '../../../hooks/useConsolidatedCustomers'

interface MultisiteExpandedTabsProps {
  organization: ConsolidatedCustomer
  colSpan?: number
}

type TabKey = 'kontakt' | 'enheter' | 'ekonomi' | 'halsa'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'kontakt', label: 'Kontakt', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'enheter', label: 'Enheter', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'ekonomi', label: 'Ekonomi', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: 'halsa', label: 'Hälsa & Risk', icon: <Activity className="w-3.5 h-3.5" /> },
]

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getContactName = (contact_person: string | null, contact_email: string, multisiteUsers?: any[]) => {
  if (contact_person && contact_person.trim() !== '') return contact_person
  const userWithEmail = multisiteUsers?.find(user =>
    user.email === contact_email && user.display_name && user.display_name.trim() !== ''
  )
  if (userWithEmail?.display_name) return userWithEmail.display_name
  if (contact_email) {
    const emailParts = contact_email.split('@')
    if (emailParts[0] && emailParts[0].length > 3) {
      return emailParts[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    }
  }
  return null
}

// === TAB: Kontakt ===
function KontaktTab({ organization }: { organization: ConsolidatedCustomer }) {
  const verksamhetschef = organization.sites.find(site => site.site_type === 'huvudkontor') || organization.sites[0]
  const verksamhetschefFromUsers = organization.multisiteUsers?.find(user => user.role_type === 'verksamhetschef')
  const verksamhetschefName = verksamhetschefFromUsers?.display_name
    || getContactName(organization.contact_person, organization.contact_email, organization.multisiteUsers)
    || getContactName(verksamhetschef?.contact_person, verksamhetschef?.contact_email, organization.multisiteUsers)
    || 'Namn ej registrerat'

  const userRolesSummary = {
    active: organization.multisiteUsers?.filter(user => user.hasLoggedIn).length || 0,
    pending: organization.multisiteUsers?.filter(user => !user.hasLoggedIn).length || 0,
    verksamhetschef: organization.multisiteUsers?.filter(user => user.role_type === 'verksamhetschef').length || 0,
    regionchef: organization.multisiteUsers?.filter(user => user.role_type === 'regionchef').length || 0,
    platsansvarig: organization.multisiteUsers?.filter(user => user.role_type === 'platsansvarig').length || 0
  }

  const renderUserGroup = (users: any[], title: string, icon: React.ReactNode) => {
    if (users.length === 0) return null
    return (
      <div key={title} className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300 border-b border-slate-600/50 pb-1">
          {icon}
          <span>{title} ({users.length})</span>
        </div>
        {users.map((user: any, index: number) => {
          const userName = user.display_name || getContactName(null, user.email, organization.multisiteUsers) || 'Namn ej registrerat'
          return (
            <div key={user.user_id || index} className="ml-4 flex items-center justify-between bg-slate-800/30 rounded p-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-200 font-medium">{userName}</span>
                    <a href={`mailto:${user.email}`} className="text-slate-400 hover:text-blue-400 transition-colors" title={`Kontakta ${userName}`}>
                      <Mail className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                  {user.role_type === 'platsansvarig' && user.site_ids && user.site_ids.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      Ansvarig för: {user.site_ids.map((siteId: string) => {
                        const site = organization.sites.find(s => s.id === siteId)
                        return site?.site_name || site?.company_name || siteId
                      }).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${user.hasLoggedIn ? 'bg-green-400' : 'bg-slate-500'}`}
                title={user.hasLoggedIn ? 'Har loggat in' : 'Aldrig inloggad'} />
            </div>
          )
        })}
      </div>
    )
  }

  const verksamhetschefer = organization.multisiteUsers?.filter(u => u.role_type === 'verksamhetschef') || []
  const regionchefer = organization.multisiteUsers?.filter(u => u.role_type === 'regionchef') || []
  const platsansvariga = organization.multisiteUsers?.filter(u => u.role_type === 'platsansvarig') || []

  return (
    <div className="space-y-4">
      {/* Verksamhetschef */}
      <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600/50">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">Verksamhetschef</span>
        </div>
        <div className="space-y-2">
          <div className="font-medium text-white">{verksamhetschefName}</div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-3 h-3 text-slate-400" />
            <a href={`mailto:${verksamhetschefFromUsers?.email || organization.contact_email}`}
              className="text-blue-400 hover:text-blue-300 transition-colors">
              {verksamhetschefFromUsers?.email || organization.contact_email}
            </a>
          </div>
          {(organization.contact_phone || verksamhetschef?.contact_phone) && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3 h-3 text-slate-400" />
              <a href={`tel:${organization.contact_phone || verksamhetschef?.contact_phone}`}
                className="text-blue-400 hover:text-blue-300 transition-colors">
                {organization.contact_phone || verksamhetschef?.contact_phone}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Rollhierarki */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserCheck className="w-4 h-4 text-green-400" />
          <h5 className="text-sm font-medium text-slate-300">Organisationshierarki</h5>
        </div>
        <div className="space-y-3">
          {renderUserGroup(verksamhetschefer, 'Verksamhetschefer', <Crown className="w-3 h-3 text-amber-400" />)}
          {renderUserGroup(regionchefer, 'Regionchefer', <Shield className="w-3 h-3 text-purple-400" />)}
          {renderUserGroup(platsansvariga, 'Platsansvariga', <Building2 className="w-3 h-3 text-blue-400" />)}
          {(!organization.multisiteUsers || organization.multisiteUsers.length === 0) && (
            <div className="text-xs text-slate-500 italic text-center py-4">
              Inga användare med definierade roller
            </div>
          )}
        </div>

        {/* Rollsummering */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-600/50">
          <div className="text-center">
            <div className="text-xs text-slate-400">Aktiva</div>
            <div className="text-sm font-semibold text-green-400">{userRolesSummary.active}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">Väntande</div>
            <div className="text-sm font-semibold text-amber-400">{userRolesSummary.pending}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400">Totalt</div>
            <div className="text-sm font-semibold text-white">{organization.multisiteUsers?.length || 0}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// === TAB: Enheter ===
function EnheterTab({ organization }: { organization: ConsolidatedCustomer }) {
  const unitsWithArenden = organization.sites.filter(site => site.casesCount > 0)

  return (
    <div className="space-y-4">
      {/* Sammanfattning */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="text-xs text-slate-400">Totalt enheter</div>
          <div className="text-lg font-semibold text-white">{organization.totalSites}</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="text-xs text-slate-400">Aktiva ärenden</div>
          <div className="text-lg font-semibold text-blue-400">{organization.totalCasesCount}</div>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <div className="text-xs text-slate-400">Med extra ärenden</div>
          <div className="text-lg font-semibold text-green-400">{unitsWithArenden.length}</div>
        </div>
      </div>

      {/* Alla enheter */}
      <div className="space-y-2">
        {organization.sites.map(site => {
          const siteResponsibleUsers = organization.multisiteUsers?.filter(user =>
            user.role_type === 'platsansvarig' &&
            Array.isArray(user.site_ids) &&
            user.site_ids.includes(site.id)
          ) || []

          return (
            <div key={site.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span className="text-sm font-medium text-slate-200">
                    {site.site_name || site.company_name}
                  </span>
                  {site.site_code && <span className="text-xs text-slate-500">({site.site_code})</span>}
                </div>
                <div className="flex items-center gap-3">
                  {site.casesCount > 0 && (
                    <span className="text-xs text-blue-400">{site.casesCount} ärenden</span>
                  )}
                  {site.casesValue > 0 && (
                    <span className="text-xs font-medium text-green-400">{formatCurrency(site.casesValue)}</span>
                  )}
                </div>
              </div>

              {/* Ansvariga */}
              {siteResponsibleUsers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700/50">
                  <div className="flex flex-wrap gap-1">
                    {siteResponsibleUsers.map((user: any) => (
                      <div key={user.user_id} className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1">
                        <span className="text-xs text-slate-300">
                          {user.display_name || getContactName(null, user.email) || 'Ej angivet'}
                        </span>
                        <a href={`mailto:${user.email}`} className="text-slate-400 hover:text-blue-400 transition-colors">
                          <Mail className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// === TAB: Ekonomi ===
function EkonomiTab({ organization }: { organization: ConsolidatedCustomer }) {
  return (
    <div className="space-y-4">
      {/* Avtalsvärde-breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
          <div className="text-xs text-green-400">Avtalsvärde (år)</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(organization.totalAnnualValue || 0)}</div>
          <div className="text-xs text-slate-500">{formatCurrency((organization.totalAnnualValue || 0) / 12)}/mån</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
          <div className="text-xs text-blue-400">Ärenden utöver avtal</div>
          <div className="text-lg font-bold text-blue-400">{formatCurrency(organization.totalCasesValue || 0)}</div>
          <div className="text-xs text-slate-500">{organization.totalCasesCount} ärenden</div>
        </div>
        <div className="bg-slate-500/10 rounded-lg p-3 border border-slate-500/20">
          <div className="text-xs text-slate-300">Totalt kontraktsvärde</div>
          <div className="text-lg font-bold text-white">{formatCurrency(organization.totalContractValue)}</div>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
          <div className="text-xs text-purple-400">Per enhet (snitt)</div>
          <div className="text-lg font-bold text-purple-400">
            {formatCurrency(organization.totalSites > 0 ? organization.totalContractValue / organization.totalSites : 0)}
          </div>
        </div>
      </div>

      {/* Faktureringsstatus */}
      <div>
        <h5 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
          <DollarSign className="w-3 h-3" />
          Faktureringsstatus (Ärenden)
        </h5>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
            <div className="text-xs text-green-400">Betald</div>
            <div className="font-medium text-green-400">{formatCurrency(organization.casesBillingStatus.paid?.value || 0)}</div>
            <div className="text-xs text-slate-500">{organization.casesBillingStatus.paid?.count || 0} ärenden</div>
          </div>
          <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20">
            <div className="text-xs text-amber-400">Väntande</div>
            <div className="font-medium text-amber-400">{formatCurrency(organization.casesBillingStatus.pending?.value || 0)}</div>
            <div className="text-xs text-slate-500">{organization.casesBillingStatus.pending?.count || 0} ärenden</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// === TAB: Hälsa & Risk ===
function HalsaTab({ organization }: { organization: ConsolidatedCustomer }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Health Score */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TooltipWrapper
              content={
                <div className="p-3 max-w-sm">
                  <div className="font-medium text-white mb-2">Organisationens Hälsa</div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>Avtalsdata, betalningshistorik, portaltillgång, ärendehantering</div>
                  </div>
                </div>
              }
              placement="top"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-slate-300">Health Score</span>
                <HelpCircle className="w-3 h-3 text-slate-500" />
              </div>
            </TooltipWrapper>
          </div>
          <div className="text-3xl font-bold text-green-400 mb-1">
            {organization.overallHealthScore.score}/100
          </div>
          <div className="text-xs text-slate-400">
            {organization.overallHealthScore.level === 'excellent' ? 'Utmärkt' :
              organization.overallHealthScore.level === 'good' ? 'Bra' :
                organization.overallHealthScore.level === 'fair' ? 'Acceptabel' : 'Riskabel'}
          </div>
          {/* Score bar */}
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                organization.overallHealthScore.score >= 80 ? 'bg-green-500' :
                  organization.overallHealthScore.score >= 60 ? 'bg-yellow-500' :
                    organization.overallHealthScore.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${organization.overallHealthScore.score}%` }}
            />
          </div>
        </div>

        {/* Churn Risk */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TooltipWrapper
              content={
                <div className="p-3 max-w-sm">
                  <div className="font-medium text-white mb-2">Uppsägningsrisk</div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>Avtalsförnyelse, hälsa, betalningsproblem, engagemang</div>
                  </div>
                </div>
              }
              placement="top"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-slate-300">Uppsägningsrisk</span>
                <HelpCircle className="w-3 h-3 text-slate-500" />
              </div>
            </TooltipWrapper>
          </div>
          <div className={`text-3xl font-bold mb-1 ${
            organization.highestChurnRisk.risk === 'low' ? 'text-green-400' :
              organization.highestChurnRisk.risk === 'medium' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {organization.highestChurnRisk.risk === 'low' ? 'Låg' :
              organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Hög'}
          </div>
          <div className="text-xs text-slate-400">
            Score: {organization.highestChurnRisk.score.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Varningar */}
      {(organization.hasExpiringSites || organization.hasHighRiskSites) && (
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Uppmärksamhet krävs</span>
          </div>
          <div className="space-y-1 text-xs text-red-300">
            {organization.hasExpiringSites && <div>Enheter med utgående avtal</div>}
            {organization.hasHighRiskSites && <div>Enheter i riskzonen</div>}
          </div>
        </div>
      )}

      {/* Portal-tillgång */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h5 className="text-xs font-medium text-slate-400 mb-2">Portal-aktivitet</h5>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Registrerade:</span>
            <span className="text-white font-medium">{organization.multisiteUsers?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Aktiva:</span>
            <span className="text-green-400 font-medium">{organization.multisiteUsers?.filter(u => u.hasLoggedIn).length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Aldrig inloggat:</span>
            <span className="text-amber-400 font-medium">{organization.multisiteUsers?.filter(u => !u.hasLoggedIn).length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Väntande inbjudan:</span>
            <span className="text-amber-400 font-medium">{organization.pendingInvitationsCount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// === MAIN COMPONENT ===
export default function MultisiteExpandedTabs({ organization, colSpan = 10 }: MultisiteExpandedTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('kontakt')

  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-4 bg-slate-800/30">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 mb-4 border-b border-slate-700 pb-2 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-green-400 bg-green-500/10 border-b-2 border-green-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-w-4xl">
          {activeTab === 'kontakt' && <KontaktTab organization={organization} />}
          {activeTab === 'enheter' && <EnheterTab organization={organization} />}
          {activeTab === 'ekonomi' && <EkonomiTab organization={organization} />}
          {activeTab === 'halsa' && <HalsaTab organization={organization} />}
        </div>
      </td>
    </tr>
  )
}
