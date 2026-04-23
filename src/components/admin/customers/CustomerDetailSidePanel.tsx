// src/components/admin/customers/CustomerDetailSidePanel.tsx
// Sidopanel (slide-over på desktop, bottom sheet på mobil) för kunddetaljer.
// Ersätter expand-i-rad-mönstret. Query-logik lyft ur ExpandedCustomerRow i Customers.tsx.

import React, { useEffect, useState } from 'react'
import {
  X, Building2, Mail, Phone, User, MapPin, Users as UsersIcon,
  Edit3, TrendingUp, RefreshCw, XCircle, Receipt, ExternalLink,
  Calendar, Coins, Activity, AlertTriangle,
} from 'lucide-react'
import type { ConsolidatedCustomer, ContactSummary } from '../../../hooks/useConsolidatedCustomers'
import { PriceListService } from '../../../services/priceListService'
import { ImportedCustomerContractService } from '../../../services/importedCustomerContractService'
import { CaseBillingService } from '../../../services/caseBillingService'
import { PricingSettingsService } from '../../../services/pricingSettingsService'
import type { PriceList, PriceListItemWithArticle } from '../../../types/articles'
import type { CaseBillingItemWithRelations, CaseServiceSummary } from '../../../types/caseBilling'
import type { PricingSettings } from '../../../types/pricingSettings'
import CustomerContractButton from './CustomerContractButton'

interface Props {
  organization: ConsolidatedCustomer | null
  contacts: ContactSummary[]
  isOpen: boolean
  /** När true: panelen glider ut ur vägen och ignorerar Escape (en modal öppnad ovanpå). */
  dimmed?: boolean
  onClose: () => void
  onViewFullDetails: (org: ConsolidatedCustomer) => void
  onEdit: (org: ConsolidatedCustomer) => void
  onViewRevenue: (org: ConsolidatedCustomer) => void
  onRenewal: (org: ConsolidatedCustomer) => void
  onTerminate: (org: ConsolidatedCustomer) => void
  onBillingSettings: (org: ConsolidatedCustomer) => void
  onContacts: (org: ConsolidatedCustomer) => void
}

const fmtSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function marginPillClass(marginPercent: number, settings: PricingSettings): string {
  if (marginPercent >= settings.target_margin_percent) return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
  if (marginPercent >= settings.min_margin_percent) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
  return 'bg-red-500/20 text-red-400 border border-red-500/30'
}

function healthColor(level: string) {
  switch (level) {
    case 'excellent': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'good': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'fair': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'poor': return 'bg-red-500/20 text-red-400 border-red-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

function healthLabel(level: string) {
  switch (level) {
    case 'excellent': return 'Utmärkt'
    case 'good': return 'Bra'
    case 'fair': return 'Ok'
    case 'poor': return 'Risk'
    default: return 'Okänd'
  }
}

function StatusBadge({ org }: { org: ConsolidatedCustomer }) {
  if (org.isPaused) {
    return (
      <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
        Pausad{org.pausedUntil ? ` till ${fmtDate(org.pausedUntil)}` : ''}
      </span>
    )
  }
  if (org.isTerminated) {
    return (
      <span className="text-[10px] font-medium bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
        Uppsagt
      </span>
    )
  }
  return (
    <span className="text-[10px] font-medium bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
      Aktiv
    </span>
  )
}

function SectionCard({ title, icon: Icon, children, action }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function CustomerDetailSidePanel({
  organization,
  contacts,
  isOpen,
  dimmed = false,
  onClose,
  onViewFullDetails,
  onEdit,
  onViewRevenue,
  onRenewal,
  onTerminate,
  onBillingSettings,
  onContacts,
}: Props) {
  const [priceListData, setPriceListData] = useState<{
    priceList: PriceList | null
    items: PriceListItemWithArticle[]
  }>({ priceList: null, items: [] })
  const [loadingPriceList, setLoadingPriceList] = useState(false)

  const [contractData, setContractData] = useState<{
    services: CaseBillingItemWithRelations[]
    articles: CaseBillingItemWithRelations[]
    summary: CaseServiceSummary | null
  }>({ services: [], articles: [], summary: null })
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null)
  const [loadingContract, setLoadingContract] = useState(false)

  const primarySite = organization?.sites?.[0]
  const isMultisite = organization?.organizationType === 'multisite'

  // Close on Escape — men inte när en modal är öppen ovanpå (dimmed)
  useEffect(() => {
    if (!isOpen || dimmed) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [isOpen, dimmed, onClose])

  // Fetch price list (single-site only — multisite visar aggregerad vy separat)
  useEffect(() => {
    if (!isOpen || !primarySite?.price_list_id || isMultisite) {
      setPriceListData({ priceList: null, items: [] })
      return
    }
    let cancelled = false
    setLoadingPriceList(true)
    ;(async () => {
      try {
        const [pl, items] = await Promise.all([
          PriceListService.getPriceListById(primarySite.price_list_id!),
          PriceListService.getPriceListItems(primarySite.price_list_id!),
        ])
        if (!cancelled) setPriceListData({ priceList: pl, items })
      } catch (err) {
        console.error('SidePanel price list error:', err)
      } finally {
        if (!cancelled) setLoadingPriceList(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, primarySite?.price_list_id, isMultisite])

  // Fetch contract summary
  useEffect(() => {
    if (!isOpen || !primarySite?.id || isMultisite) {
      setContractData({ services: [], articles: [], summary: null })
      return
    }
    let cancelled = false
    setLoadingContract(true)
    ;(async () => {
      try {
        const [contractId, settings] = await Promise.all([
          ImportedCustomerContractService.findContract(primarySite.id),
          PricingSettingsService.get(),
        ])
        if (cancelled) return
        setPricingSettings(settings)
        if (!contractId) {
          setContractData({ services: [], articles: [], summary: null })
          return
        }
        const [{ services, articles }, summary] = await Promise.all([
          ImportedCustomerContractService.getItems(contractId),
          CaseBillingService.getCaseServiceSummary(contractId, 'contract', settings.min_margin_percent),
        ])
        if (!cancelled) setContractData({ services, articles, summary })
      } catch (err) {
        console.error('SidePanel contract error:', err)
        if (!cancelled) setContractData({ services: [], articles: [], summary: null })
      } finally {
        if (!cancelled) setLoadingContract(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, primarySite?.id, isMultisite])

  if (!organization) return null

  const contractMonthsRemaining = organization.daysToNextRenewal != null
    ? Math.max(0, Math.round(organization.daysToNextRenewal / 30.44))
    : null

  const showRenewalButton = !organization.isTerminated
    && organization.daysToNextRenewal != null
    && organization.daysToNextRenewal > 0
    && organization.daysToNextRenewal <= 90

  const oneflowContractId = primarySite?.oneflow_contract_id

  return (
    <>
      {/* Backdrop — klick stänger (inaktiv när dimmed så modalens backdrop hanterar interaktion) */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100] transition-all duration-300 ${
          isOpen && !dimmed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Panel — glider ut åt höger när dimmed (modal öppen ovanpå) */}
      <div
        className={`
          fixed z-[101] bg-slate-900 shadow-2xl flex flex-col

          sm:top-0 sm:right-0 sm:h-full sm:w-[520px] lg:w-[640px]
          sm:border-l sm:border-slate-800
          sm:transform sm:transition-transform sm:duration-300 sm:ease-out
          ${isOpen && !dimmed ? 'sm:translate-x-0' : 'sm:translate-x-full'}

          max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:h-[90vh]
          max-sm:rounded-t-2xl max-sm:border-t max-sm:border-slate-700
          max-sm:transform max-sm:transition-transform max-sm:duration-300 max-sm:ease-out
          ${isOpen && !dimmed ? 'max-sm:translate-y-0' : 'max-sm:translate-y-full'}
        `}
      >
        {/* Drag handle på mobil */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              {isMultisite && <Building2 className="w-4 h-4 text-blue-400 shrink-0" />}
              <h2 className="text-lg font-semibold text-white truncate">{organization.company_name}</h2>
              <StatusBadge org={organization} />
              {isMultisite && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                  {organization.totalSites} enheter
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {organization.customer_number != null && (
                <span className="font-mono text-[#20c58f]/70">#{organization.customer_number}</span>
              )}
              {organization.organization_number && (
                <span>Org.nr {organization.organization_number}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action-rad */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap gap-1.5">
          <button
            onClick={() => onViewFullDetails(organization)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {isMultisite ? 'Multisite-vy' : 'Detaljvy'}
          </button>
          <button
            onClick={() => onEdit(organization)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Redigera
          </button>
          <button
            onClick={() => onViewRevenue(organization)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#20c58f]/10 text-[#20c58f] hover:bg-[#20c58f]/20 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Intäkter
          </button>
          <button
            onClick={() => onBillingSettings(organization)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            Fakturering
          </button>
          <button
            onClick={() => onContacts(organization)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <UsersIcon className="w-3.5 h-3.5" />
            Kontakter
            {contacts.length > 0 && (
              <span className="ml-0.5 text-[10px] text-slate-500">({contacts.length})</span>
            )}
          </button>
          {showRenewalButton && (
            <button
              onClick={() => onRenewal(organization)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Förnya
            </button>
          )}
          {oneflowContractId && (
            <CustomerContractButton
              oneflowContractId={oneflowContractId}
              customerName={organization.company_name}
            />
          )}
          {!organization.isTerminated && (
            <button
              onClick={() => onTerminate(organization)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
            >
              <XCircle className="w-3.5 h-3.5" />
              Säg upp
            </button>
          )}
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Kontakt */}
          <SectionCard title="Kontakt" icon={User}>
            <div className="space-y-1.5 text-sm">
              {organization.contact_person && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">Person</span>
                  <span className="text-white truncate">{organization.contact_person}</span>
                </div>
              )}
              {organization.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">E-post</span>
                  <a href={`mailto:${organization.contact_email}`} className="text-[#20c58f] hover:underline truncate">
                    {organization.contact_email}
                  </a>
                </div>
              )}
              {primarySite?.billing_email && primarySite.billing_email !== organization.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">Faktura</span>
                  <a href={`mailto:${primarySite.billing_email}`} className="text-amber-400 hover:underline truncate">
                    {primarySite.billing_email}
                  </a>
                </div>
              )}
              {organization.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">Telefon</span>
                  <a href={`tel:${organization.contact_phone}`} className="text-white hover:text-[#20c58f]">
                    {organization.contact_phone}
                  </a>
                </div>
              )}
              {organization.contact_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">Adress</span>
                  <span className="text-white">{organization.contact_address}</span>
                </div>
              )}
              {organization.assigned_account_manager && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-slate-700/50 mt-1.5">
                  <User className="w-3.5 h-3.5 text-[#20c58f] shrink-0" />
                  <span className="text-slate-400 text-xs w-20 shrink-0">Säljare</span>
                  <span className="text-white">{organization.assigned_account_manager}</span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Avtal */}
          <SectionCard title="Avtal" icon={Calendar}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Årspremie</p>
                <p className="text-white font-semibold">{fmtSEK(organization.totalAnnualValue || 0)}</p>
                <p className="text-xs text-slate-500">{fmtSEK((organization.totalAnnualValue || 0) / 12)}/mån</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Avtalsvärde</p>
                <p className="text-white font-semibold">{fmtSEK(organization.totalContractValue)}</p>
                <p className="text-xs text-slate-500">totalt värde</p>
              </div>
              {organization.totalCasesValue > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Debiterat utöver avtal</p>
                  <p className="text-white font-semibold">{fmtSEK(organization.totalCasesValue)}</p>
                </div>
              )}
              {organization.earliestContractStartDate && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Avtalsstart</p>
                  <p className="text-white">{fmtDate(organization.earliestContractStartDate)}</p>
                </div>
              )}
              {organization.nextRenewalDate && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Avtalsslut</p>
                  <p className="text-white">{fmtDate(organization.nextRenewalDate)}</p>
                  {contractMonthsRemaining != null && !organization.isTerminated && (
                    <p className={`text-xs ${
                      contractMonthsRemaining <= 6 ? 'text-red-400' :
                      contractMonthsRemaining <= 12 ? 'text-amber-400' :
                      'text-green-400'
                    }`}>
                      {contractMonthsRemaining} mån kvar
                    </p>
                  )}
                </div>
              )}
              {organization.isTerminated && organization.effectiveEndDate && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Uppsägning</p>
                  <p className="text-red-400">Slutar {fmtDate(organization.effectiveEndDate)}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Avtalsinnehåll — bara single-site */}
          {!isMultisite && (
            <SectionCard
              title="Avtalsinnehåll"
              icon={Receipt}
              action={contractData.summary?.margin_percent != null && pricingSettings ? (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${marginPillClass(contractData.summary.margin_percent, pricingSettings)}`}>
                  {contractData.summary.margin_percent.toFixed(1)}% marginal
                </span>
              ) : null}
            >
              {loadingContract ? (
                <p className="text-xs text-slate-500">Laddar...</p>
              ) : (
                <>
                  {contractData.services.length > 0 ? (
                    <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                      {contractData.services.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs py-1">
                          <span className="text-slate-200 truncate">
                            {item.quantity > 1 && <span className="text-slate-500 mr-1">{item.quantity}×</span>}
                            {item.service_name || item.article_name}
                          </span>
                          <span className="text-slate-400 font-mono shrink-0 ml-2">
                            {fmtSEK(item.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mb-2">Inget avtalsinnehåll registrerat</p>
                  )}

                  {contractData.articles.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/50">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-400 mb-1">
                        <span>Interna kostnader ({contractData.articles.length})</span>
                        <span className="font-mono">
                          {fmtSEK(contractData.summary?.articles.total_purchase_cost ?? 0)}
                        </span>
                      </div>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {contractData.articles.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs text-slate-500 py-0.5">
                            <span className="truncate">
                              {item.quantity > 1 && <span className="mr-1">{item.quantity}×</span>}
                              {item.article_name}
                            </span>
                            <span className="font-mono shrink-0 ml-2">{fmtSEK(item.total_price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </SectionCard>
          )}

          {/* Prislista — bara single-site */}
          {!isMultisite && (
            <SectionCard title="Prislista för extra-tjänster" icon={Coins}>
              {loadingPriceList ? (
                <p className="text-xs text-slate-500">Laddar...</p>
              ) : priceListData.priceList ? (
                <div>
                  <div className="text-sm text-[#20c58f] font-medium mb-0.5">
                    {priceListData.priceList.name}
                  </div>
                  <p className="text-xs text-slate-500">
                    {priceListData.items.length > 0
                      ? `${priceListData.items.length} tjänster i prislistan`
                      : 'Inga tjänster i prislistan än'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Ingen prislista tilldelad (standardpriser gäller)</p>
              )}
            </SectionCard>
          )}

          {/* Multisite-enheter */}
          {isMultisite && organization.sites.length > 0 && (
            <SectionCard title={`Enheter (${organization.sites.length})`} icon={Building2}>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {organization.sites.map(site => (
                  <div
                    key={site.id}
                    className="px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{site.site_name || site.company_name || 'Enhet'}</div>
                      {site.contact_address && (
                        <div className="text-xs text-slate-500 truncate">{site.contact_address}</div>
                      )}
                    </div>
                    {site.annual_value != null && site.annual_value > 0 && (
                      <div className="text-xs text-slate-400 font-mono shrink-0">
                        {fmtSEK(site.annual_value)}/år
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Health Score breakdown — single-site */}
          {!isMultisite && primarySite?.healthScore?.breakdown && (
            <SectionCard title="Health Score" icon={Activity} action={
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${healthColor(organization.overallHealthScore.level)}`}>
                {healthLabel(organization.overallHealthScore.level)} ({organization.overallHealthScore.score})
              </span>
            }>
              <div className="space-y-1.5">
                {Object.entries(primarySite.healthScore.breakdown).map(([key, data]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{data.score}/100</span>
                      <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            data.score >= 80 ? 'bg-emerald-500' :
                            data.score >= 60 ? 'bg-yellow-500' :
                            data.score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${data.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Churn risk */}
          <SectionCard title="Churn Risk" icon={AlertTriangle}>
            <div className="flex items-center justify-between text-sm">
              <span className={
                organization.highestChurnRisk.risk === 'high' ? 'text-red-400 font-semibold' :
                organization.highestChurnRisk.risk === 'medium' ? 'text-yellow-400 font-semibold' :
                'text-emerald-400 font-semibold'
              }>
                {organization.highestChurnRisk.risk === 'high' ? 'Hög' :
                 organization.highestChurnRisk.risk === 'medium' ? 'Medel' : 'Låg'}
              </span>
              <span className="text-xs text-slate-500">{Math.round(organization.highestChurnRisk.score)}%</span>
            </div>
          </SectionCard>

          {/* Kontaktpersoner */}
          {contacts.length > 0 && (
            <SectionCard title={`Kontaktpersoner (${contacts.length})`} icon={UsersIcon}>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {contacts.map((contact, i) => (
                  <div
                    key={i}
                    className="px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/50 flex items-center gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium truncate">{contact.name}</span>
                        {contact.responsibility_area && (
                          <span className="text-[10px] text-[#20c58f] bg-[#20c58f]/10 px-1.5 py-0.5 rounded shrink-0">
                            {contact.responsibility_area}
                          </span>
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-xs text-slate-500 truncate">{contact.title}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1 text-slate-500 hover:text-[#20c58f] transition-colors"
                          title={contact.phone}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="p-1 text-slate-500 hover:text-[#20c58f] transition-colors"
                          title={contact.email}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Avtalstext */}
          {(primarySite as any)?.agreement_text && (
            <SectionCard title="Avtalstext" icon={Receipt}>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
                {(primarySite as any).agreement_text}
              </p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  )
}
