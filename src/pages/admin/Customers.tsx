// src/pages/admin/Customers.tsx — Befintliga kunder (etapp 3 av redesignen)
// CRM-lista à la Attio/Linear: portföljrad i text (inga KPI-kort), grupperade
// sektioner med räknare i whisper headers, ny radanatomi med Fortnox-statuspunkt
// och peek-panel (?peek=<id>) som återanvänder record-innehållet från kundsidan.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search, Filter, RefreshCw, ChevronDown, ChevronRight,
  Building2, AlertTriangle, Activity, Send, Edit3, FilePlus, FileText
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import CustomerRevenueModal from '../../components/admin/customers/CustomerRevenueModal'
import EmailCampaignModal from '../../components/admin/customers/EmailCampaignModal'
import EditCustomerModal from '../../components/admin/customers/EditCustomerModal'
import TerminateContractModal from '../../components/admin/customers/TerminateContractModal'
import AddContractCustomerModal from '../../components/admin/customers/AddContractCustomerModal'
import CreateCustomerManuallyModal from '../../components/admin/customers/CreateCustomerManuallyModal'
import AddXpertContractCustomerModal from '../../components/admin/customers/AddXpertContractCustomerModal'
import ImportCustomerByPdfModal from '../../components/admin/customers/ImportCustomerByPdfModal'
import ImportCustomerByOrgnrModal from '../../components/admin/customers/ImportCustomerByOrgnrModal'
import BillingSettingsModal from '../../components/admin/customers/BillingSettingsModal'
import CustomerContactsModal from '../../components/admin/customers/CustomerContactsModal'
import CustomerPeekPanel from '../../components/admin/customers/CustomerPeekPanel'
import CustomerListRow, { resolveFortnoxInfo } from '../../components/admin/customers/CustomerListRow'
import Select from '../../components/ui/Select'
import { useCustomerAnalytics } from '../../hooks/useCustomerAnalytics'
import { useConsolidatedCustomers, type ConsolidatedCustomer } from '../../hooks/useConsolidatedCustomers'
import toast from 'react-hot-toast'

// "Kräver åtgärd": uppsagd med slutdatum inom 90 dgr. Avtal förlängs automatiskt
// vid periodskifte (generate-continuing-contracts-cronen), så ett kommande
// periodskifte är INTE en åtgärd — det får en egen grupp.
function requiresAction(c: ConsolidatedCustomer): boolean {
  if (c.isTerminated) {
    if (!c.effectiveEndDate) return false
    const days = Math.ceil((new Date(c.effectiveEndDate).getTime() - Date.now()) / 86_400_000)
    return days >= 0 && days <= 90
  }
  return false
}

// Sorteringsdatum för "Kräver åtgärd" (närmast deadline först)
function actionDateMs(c: ConsolidatedCustomer): number {
  const iso = c.isTerminated ? c.effectiveEndDate : c.nextRenewalDate
  return iso ? new Date(iso).getTime() : Number.MAX_SAFE_INTEGER
}

function formatAnnualSum(v: number): string {
  if (v >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} Mkr/år`
  }
  return `${Math.round(v / 1000).toLocaleString('sv-SE')} tkr/år`
}

type QuickView = 'all' | 'atgard' | 'fortnox'

export default function Customers() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Samma sida används under /admin, /koordinator och /saljare
  const basePath = `${location.pathname.split('/befintliga-kunder')[0]}/befintliga-kunder`

  const {
    consolidatedCustomers,
    loading,
    error,
    filterCustomers: filterConsolidatedCustomers,
    refresh,
    getContactsForOrganization
  } = useConsolidatedCustomers()

  // Behålls för EmailCampaignModal som behöver individuella kundrader
  const { customers: legacyCustomers } = useCustomerAnalytics()

  // State management
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [emailCampaignOpen, setEmailCampaignOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [revenueModalOpen, setRevenueModalOpen] = useState(false)
  const [revenueCustomer, setRevenueCustomer] = useState<any>(null)
  // Multi-kontrakt-refaktor (Fas 12 bug D): scopa Intäkter-modal till valt avtal.
  const [revenueContractId, setRevenueContractId] = useState<string | null>(null)
  const [terminateModalOpen, setTerminateModalOpen] = useState(false)
  const [terminateOrganization, setTerminateOrganization] = useState<any>(null)
  const [addManualCustomerOpen, setAddManualCustomerOpen] = useState(false)
  const [addContractCustomerOpen, setAddContractCustomerOpen] = useState(false)
  const [addXpertContractCustomerOpen, setAddXpertContractCustomerOpen] = useState(false)
  const [importByPdfOpen, setImportByPdfOpen] = useState(false)
  const [importByOrgnrOpen, setImportByOrgnrOpen] = useState(false)
  const [importDropdownOpen, setImportDropdownOpen] = useState(false)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const [billingSettingsOpen, setBillingSettingsOpen] = useState(false)
  const [billingSettingsOrg, setBillingSettingsOrg] = useState<any>(null)
  // Multi-kontrakt-refaktor (Fas 9): scopa BillingSettingsModal till valt avtal.
  const [billingSettingsContractId, setBillingSettingsContractId] = useState<string | null>(null)
  const [contactsModalOpen, setContactsModalOpen] = useState(false)
  const [contactsOrg, setContactsOrg] = useState<any>(null)

  // Kollapsade gruppsektioner — Pausade + Uppsagda kollapsade by default
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    pausade: true,
    uppsagda: true,
  })
  const toggleGroup = (key: string) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))

  // Flash-highlight från URL-param (?customerId=...) vid navigation från offertuppföljningen
  const [flashCustomerId, setFlashCustomerId] = useState<string | null>(null)

  // Peek-panel via URL-param (?peek=<customers.id>) — history-safe
  const peekCustomerId = searchParams.get('peek')

  // customers.id att peek:a för en rad (multisite-rader har organization_id som id)
  const peekIdFor = (org: ConsolidatedCustomer): string | null =>
    org.organizationType === 'multisite'
      ? (org.headquarterCustomer?.id ?? org.sites[0]?.id ?? null)
      : org.id

  const openPeek = (org: ConsolidatedCustomer) => {
    const id = peekIdFor(org)
    if (!id) return
    setSearchParams(prev => { prev.set('peek', id); return prev })
  }
  const closePeek = useCallback(() => {
    setSearchParams(prev => { prev.delete('peek'); return prev })
  }, [setSearchParams])

  // Close import dropdown on outside click
  useEffect(() => {
    if (!importDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setImportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [importDropdownOpen])

  // Active customer highlight — vilken org som har öppen modal
  const activeCustomerId =
    flashCustomerId ||
    (revenueModalOpen && revenueCustomer?.id) ||
    (editModalOpen && editingOrgId) ||
    (terminateModalOpen && terminateOrganization?.id) ||
    (billingSettingsOpen && billingSettingsOrg?.id) ||
    (contactsModalOpen && contactsOrg?.id) ||
    null

  // Filter states — searchInput är UI-state, searchTerm debouncas för prestanda
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expiring' | 'terminated'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | 'excellent' | 'good' | 'fair' | 'poor'>('all')
  const [portalFilter, setPortalFilter] = useState<'all' | 'full' | 'partial' | 'none'>('all')
  const [managerFilter, setManagerFilter] = useState<string>('all')
  const [organizationTypeFilter, setOrganizationTypeFilter] = useState<'all' | 'multisite' | 'single'>('all')
  const [quickView, setQuickView] = useState<QuickView>('all')

  // Paginering
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  // Kollapserbara filter
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const activeFilterCount = [statusFilter, healthFilter, portalFilter, organizationTypeFilter, managerFilter]
    .filter(f => f !== 'all').length

  // Filtered customers (hookens filter + snabbvy-filter)
  const filteredCustomers = useMemo(() => {
    const result = filterConsolidatedCustomers({
      search: searchTerm,
      status: statusFilter,
      healthScore: healthFilter,
      portalAccess: portalFilter,
      manager: managerFilter === 'all' ? undefined : managerFilter,
      organizationType: organizationTypeFilter === 'all' ? undefined : organizationTypeFilter
    })

    if (quickView === 'atgard') return result.filter(requiresAction)
    if (quickView === 'fortnox') {
      return result.filter(c => !c.isTerminated && resolveFortnoxInfo(c).number == null)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consolidatedCustomers, searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, organizationTypeFilter, quickView, filterConsolidatedCustomers])

  // Grupperade sektioner (ersätter gamla statusgrupperna)
  const groups = useMemo(() => {
    const byName = [...filteredCustomers].sort((a, b) =>
      (a.company_name ?? '').localeCompare(b.company_name ?? '', 'sv')
    )

    const atgard: ConsolidatedCustomer[] = []
    const fornyelse: ConsolidatedCustomer[] = []
    const aktiva: ConsolidatedCustomer[] = []
    const pausade: ConsolidatedCustomer[] = []
    const uppsagda: ConsolidatedCustomer[] = []

    for (const c of byName) {
      if (requiresAction(c)) atgard.push(c)
      else if (c.isTerminated) uppsagda.push(c)
      else if (c.isPaused) pausade.push(c)
      else if (c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90) fornyelse.push(c)
      else aktiva.push(c)
    }

    atgard.sort((a, b) => actionDateMs(a) - actionDateMs(b))
    fornyelse.sort((a, b) => (a.daysToNextRenewal ?? 9999) - (b.daysToNextRenewal ?? 9999))

    const sumAnnual = (rows: ConsolidatedCustomer[]) =>
      rows.reduce((sum, c) => sum + (c.totalAnnualValue || 0), 0)

    return [
      { key: 'atgard', label: 'Kräver åtgärd', rows: atgard, sum: null as number | null },
      { key: 'fornyelse', label: 'Periodskifte inom 90 dgr', rows: fornyelse, sum: sumAnnual(fornyelse) },
      { key: 'aktiva', label: 'Aktiva', rows: aktiva, sum: sumAnnual(aktiva) },
      { key: 'pausade', label: 'Pausade', rows: pausade, sum: null as number | null },
      { key: 'uppsagda', label: 'Uppsagda', rows: uppsagda, sum: null as number | null },
    ].filter(g => g.rows.length > 0)
  }, [filteredCustomers])

  // Paginering över den grupp-ordnade listan
  const orderedRows = useMemo(() => groups.flatMap(g => g.rows), [groups])
  const totalPages = Math.ceil(orderedRows.length / pageSize)
  const pageIdSet = useMemo(
    () => new Set(orderedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(c => c.id)),
    [orderedRows, currentPage]
  )

  // Portföljrad — beräknas på hela datasetet (exkl. uppsagda)
  const portfolio = useMemo(() => {
    const active = consolidatedCustomers.filter(c => !c.isTerminated)
    const annualSum = active.reduce((sum, c) => sum + (c.totalAnnualValue || 0), 0)
    const contractCount = active.reduce(
      (sum, c) => sum + (c.contractCount || (c.totalAnnualValue ? 1 : 0)),
      0
    )
    const renewals = active.filter(c =>
      c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90
    ).length
    const missingFortnox = active.filter(c => resolveFortnoxInfo(c).number == null).length
    return { annualSum, contractCount, customerCount: active.length, renewals, missingFortnox }
  }, [consolidatedCustomers])

  // Deep-link via ?customerId=... — hitta kunden, navigera till rätt sida, scrolla + flash
  useEffect(() => {
    const targetId = searchParams.get('customerId')
    if (!targetId || loading || consolidatedCustomers.length === 0) return

    const match = consolidatedCustomers.find(org =>
      org.id === targetId
      || org.sites.some(s => s.id === targetId)
      || org.headquarterCustomer?.id === targetId
    )
    if (!match) {
      toast.error('Kunden kunde inte hittas i listan')
      setSearchParams(prev => { prev.delete('customerId'); return prev }, { replace: true })
      return
    }

    // Rensa filter så kunden garanterat syns
    setSearchInput('')
    setSearchTerm('')
    setStatusFilter('all')
    setHealthFilter('all')
    setPortalFilter('all')
    setManagerFilter('all')
    setOrganizationTypeFilter('all')
    setQuickView('all')

    const index = orderedRows.findIndex(org => org.id === match.id)
    if (index >= 0) {
      setCurrentPage(Math.floor(index / pageSize) + 1)
    }

    setFlashCustomerId(match.id)

    const scrollTimer = setTimeout(() => {
      const el = document.querySelector(`[data-customer-row-id="${match.id}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)

    const flashTimer = setTimeout(() => setFlashCustomerId(null), 4000)
    setSearchParams(prev => { prev.delete('customerId'); return prev }, { replace: true })

    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(flashTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, consolidatedCustomers])

  // Snabbvy-counts (på hela datasetet)
  const expiringCount = consolidatedCustomers.filter(c => c.daysToNextRenewal != null && c.daysToNextRenewal > 0 && c.daysToNextRenewal <= 90).length
  const atgardCount = consolidatedCustomers.filter(requiresAction).length
  const multisiteCount = consolidatedCustomers.filter(c => !c.isTerminated && c.organizationType === 'multisite').length
  const terminatedCount = consolidatedCustomers.filter(c => c.isTerminated).length

  // Aktiv preset-detektering
  const activePreset: string = quickView === 'atgard' ? 'atgard'
    : quickView === 'fortnox' ? 'fortnox'
    : statusFilter === 'expiring' ? 'expiring'
    : statusFilter === 'terminated' ? 'terminated'
    : organizationTypeFilter === 'multisite' ? 'multisite'
    : 'all'

  // Reset alla filter
  const resetFilters = () => {
    setSearchInput(''); setStatusFilter('all'); setHealthFilter('all')
    setPortalFilter('all'); setOrganizationTypeFilter('all'); setManagerFilter('all')
    setQuickView('all')
    setCurrentPage(1)
  }

  // Applicera preset
  const applyPreset = (preset: string) => {
    setSearchInput(''); setHealthFilter('all'); setPortalFilter('all'); setManagerFilter('all')
    setQuickView('all')
    setCurrentPage(1)

    switch (preset) {
      case 'expiring':
        setStatusFilter('expiring'); setOrganizationTypeFilter('all')
        break
      case 'atgard':
        setStatusFilter('all'); setOrganizationTypeFilter('all'); setQuickView('atgard')
        break
      case 'fortnox':
        setStatusFilter('all'); setOrganizationTypeFilter('all'); setQuickView('fortnox')
        break
      case 'multisite':
        setStatusFilter('all'); setOrganizationTypeFilter('multisite')
        break
      case 'terminated':
        setStatusFilter('terminated'); setOrganizationTypeFilter('all')
        break
    }
  }

  // Reset paginering vid filterändring
  useEffect(() => { setCurrentPage(1) }, [searchTerm, statusFilter, healthFilter, portalFilter, managerFilter, organizationTypeFilter, quickView])

  // Toggle expanded row (multisite-enheter)
  const toggleExpandedRow = (customerId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedRows(newExpanded)
  }

  // Handle customer edit — skickar huvudkontoret för multisite, annars sites[0]
  const handleEditCustomer = (org: ConsolidatedCustomer) => {
    setEditingCustomer(org.headquarterCustomer || org.sites?.[0] || org)
    setEditingOrgId(org.id)
    setEditModalOpen(true)
  }

  const handleCustomerSaved = () => {
    refresh()
  }

  const handleViewRevenue = (organization: ConsolidatedCustomer, contractId: string | null = null) => {
    setRevenueCustomer(organization)
    setRevenueContractId(contractId)
    setRevenueModalOpen(true)
  }

  const handleTerminate = (organization: ConsolidatedCustomer) => {
    setTerminateOrganization(organization)
    setTerminateModalOpen(true)
  }

  const handleBillingSettings = (organization: ConsolidatedCustomer, contractId: string | null = null) => {
    setBillingSettingsOrg(organization)
    setBillingSettingsContractId(contractId)
    setBillingSettingsOpen(true)
  }

  const handleContacts = (organization: ConsolidatedCustomer) => {
    setContactsOrg(organization)
    setContactsModalOpen(true)
  }

  // Get unique managers for filter
  const uniqueManagers = useMemo(() => {
    const managers = new Set<string>()
    consolidatedCustomers.forEach(c => {
      if (c.assigned_account_manager) {
        managers.add(c.assigned_account_manager)
      }
    })
    return Array.from(managers).sort()
  }, [consolidatedCustomers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <Card className="p-8 bg-red-500/10 border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-center">{error}</p>
          <Button onClick={refresh} className="mt-4">
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Sidtitel + portföljrad + åtgärdsknappar */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Befintliga kunder</h1>
          {/* Portföljrad — ersätter KPI-korten */}
          <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-slate-200 tabular-nums">{formatAnnualSum(portfolio.annualSum)}</span>
            <span className="text-slate-700">·</span>
            <span>
              <span className="text-slate-200 tabular-nums">{portfolio.contractCount}</span> avtal hos{' '}
              <span className="text-slate-200 tabular-nums">{portfolio.customerCount}</span> kunder
            </span>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => applyPreset('expiring')}
              className="hover:text-[#20c58f] transition-colors"
            >
              <span className="text-slate-200 tabular-nums">{portfolio.renewals}</span> periodskiften inom 90 dgr
            </button>
            <span className="text-slate-700">·</span>
            <button
              onClick={() => applyPreset('fortnox')}
              className="hover:text-[#20c58f] transition-colors"
            >
              <span className="text-slate-200 tabular-nums">{portfolio.missingFortnox}</span> saknar Fortnox-nr
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={importDropdownRef}>
            <button
              onClick={() => setImportDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
              title="Lägg till avtalskund från PDF"
            >
              <FilePlus className="w-4 h-4" />
              <span className="hidden md:inline">Lägg till avtalskund</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${importDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {importDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-1">
                  <button
                    onClick={() => { setImportDropdownOpen(false); setAddManualCustomerOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Lägg till kund manuellt</div>
                      <div className="text-xs text-slate-500 mt-0.5">Fyll i alla uppgifter för hand</div>
                    </div>
                  </button>
                  <div className="mx-4 my-1 border-t border-slate-700/50" />
                  <button
                    onClick={() => { setImportDropdownOpen(false); setImportByOrgnrOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors"
                  >
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Importera via org.nummer</div>
                      <div className="text-xs text-slate-500 mt-0.5">Hämtar från Fortnox + Oneflow automatiskt</div>
                    </div>
                  </button>
                  <div className="mx-4 my-1 border-t border-slate-700/50" />
                  <button
                    onClick={() => { setImportDropdownOpen(false); setAddContractCustomerOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors"
                  >
                    <FilePlus className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Lägg till avtalskund - BeGone</div>
                      <div className="text-xs text-slate-500 mt-0.5">Importera BeGone-avtal (Oneflow)</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setImportDropdownOpen(false); setAddXpertContractCustomerOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors"
                  >
                    <FilePlus className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Lägg till avtalskund - Xpert</div>
                      <div className="text-xs text-slate-500 mt-0.5">Importera Xpert Bekämpning-avtal</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setImportDropdownOpen(false); setImportByPdfOpen(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-violet-400 hover:bg-violet-400/10 transition-colors"
                  >
                    <FilePlus className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Lägg till avtalskund – PDF</div>
                      <div className="text-xs text-slate-500 mt-0.5">AI scannar avtal + hämtar Fortnox-historik</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <button
            onClick={() => setEmailCampaignOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-green-400 hover:bg-green-400/10 transition-colors"
            title="Skicka e-postkampanj"
          >
            <Send className="w-4 h-4" />
            <span className="hidden md:inline">E-postkampanj</span>
          </button>
          <div className="w-px h-6 bg-slate-700" />
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden md:inline">Uppdatera</span>
          </button>
          <button
            onClick={() => navigate('/admin/kundprognos')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline">Detaljerad Analytics</span>
          </button>
          <button
            onClick={() => navigate('/admin/manadsrapport')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">Månadsrapport</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-4">
          {/* Filters */}
          <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl overflow-visible relative z-20">
            <div className="flex gap-3">
              {/* Sökfält — alltid synligt */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Sök företag, kontaktperson, e-post, org.nr eller kundnr..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              {/* Filter toggle-knapp */}
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  filtersExpanded || activeFilterCount > 0
                    ? 'bg-[#20c58f]/10 border-[#20c58f]/30 text-[#20c58f]'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="bg-[#20c58f] text-[#fff] text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Collapsible filter dropdowns */}
            {filtersExpanded && (
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-700">
                <Select
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Alla status' },
                    { value: 'active', label: 'Aktiva' },
                    { value: 'inactive', label: 'Inaktiva' },
                    { value: 'expiring', label: 'Löper ut snart' },
                    { value: 'terminated', label: 'Uppsagda' },
                  ]}
                />

                <Select
                  value={healthFilter}
                  onChange={(v) => setHealthFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Alla hälsonivåer' },
                    { value: 'excellent', label: 'Utmärkt (80+)' },
                    { value: 'good', label: 'Bra (60-79)' },
                    { value: 'fair', label: 'Acceptabel (40-59)' },
                    { value: 'poor', label: 'Risk (0-39)' },
                  ]}
                />

                <Select
                  value={portalFilter}
                  onChange={(v) => setPortalFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Portaltillgång' },
                    { value: 'full', label: 'Full tillgång' },
                    { value: 'partial', label: 'Delvis tillgång' },
                    { value: 'none', label: 'Ingen tillgång' },
                  ]}
                />

                <Select
                  value={organizationTypeFilter}
                  onChange={(v) => setOrganizationTypeFilter(v as any)}
                  options={[
                    { value: 'all', label: 'Alla typer' },
                    { value: 'multisite', label: 'Multisite' },
                    { value: 'single', label: 'Enkelsites' },
                  ]}
                />

                {uniqueManagers.length > 0 && (
                  <Select
                    value={managerFilter}
                    onChange={setManagerFilter}
                    options={[
                      { value: 'all', label: 'Alla säljare' },
                      ...uniqueManagers.map(m => ({ value: m, label: m })),
                    ]}
                  />
                )}

                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter('all'); setHealthFilter('all'); setPortalFilter('all')
                      setOrganizationTypeFilter('all'); setManagerFilter('all')
                    }}
                    className="px-3 py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Rensa filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Snabbvy-knappar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Snabbvy:</span>
            <button
              onClick={() => resetFilters()}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'all'
                  ? 'bg-[#20c58f]/20 text-[#20c58f] border border-[#20c58f]/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
              }`}
            >
              Alla ({consolidatedCustomers.length})
            </button>
            <button
              onClick={() => applyPreset('atgard')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'atgard'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/30'
              }`}
            >
              Kräver åtgärd ({atgardCount})
            </button>
            <button
              onClick={() => applyPreset('expiring')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'expiring'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-amber-400 hover:border-amber-500/30'
              }`}
            >
              Utgående avtal ({expiringCount})
            </button>
            <button
              onClick={() => applyPreset('multisite')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activePreset === 'multisite'
                  ? 'bg-[#20c58f]/20 text-[#20c58f] border border-[#20c58f]/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
              }`}
            >
              Multisite ({multisiteCount})
            </button>
            {terminatedCount > 0 && (
              <button
                onClick={() => applyPreset('terminated')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activePreset === 'terminated'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/30'
                }`}
              >
                Uppsagda ({terminatedCount})
              </button>
            )}
          </div>

          {/* Grupperad kundlista — samma radkomponent för desktop och mobil */}
          <div className="border border-slate-800 bg-slate-900/30 rounded-xl overflow-visible">
            <ul>
              {groups.map((group, groupIndex) => {
                const collapsed = collapsedGroups[group.key] === true
                const rowsOnPage = group.rows.filter(r => pageIdSet.has(r.id))
                return (
                  <React.Fragment key={group.key}>
                    {/* Whisper header med räknare */}
                    <li className={`list-none ${groupIndex > 0 ? 'border-t border-slate-800' : ''}`}>
                      <button
                        onClick={() => toggleGroup(group.key)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {collapsed
                          ? <ChevronRight className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                        }
                        <span>{group.label}</span>
                        <span className="tabular-nums">({group.rows.length})</span>
                        {group.sum != null && group.sum > 0 && (
                          <span className="tabular-nums normal-case tracking-normal text-slate-600">
                            · {formatAnnualSum(group.sum)}
                          </span>
                        )}
                      </button>
                    </li>

                    {!collapsed && rowsOnPage.map(org => (
                      <CustomerListRow
                        key={org.id}
                        organization={org}
                        expanded={expandedRows.has(org.id)}
                        onToggleExpand={() => toggleExpandedRow(org.id)}
                        onPeek={() => openPeek(org)}
                        onOpenUnit={(unitId) => navigate(`${basePath}/${unitId}`)}
                        contactCount={getContactsForOrganization(org).length}
                        highlighted={
                          activeCustomerId === org.id ||
                          (peekCustomerId != null && peekIdFor(org) === peekCustomerId)
                        }
                        actions={{
                          onEdit: () => handleEditCustomer(org),
                          onRevenue: () => handleViewRevenue(org),
                          onBillingSettings: () => handleBillingSettings(org),
                          onContacts: () => handleContacts(org),
                          onTerminate: () => handleTerminate(org),
                        }}
                      />
                    ))}
                  </React.Fragment>
                )
              })}
            </ul>
          </div>

          {/* Tom-state */}
          {orderedRows.length === 0 && (
            <div className="text-center py-20 bg-slate-800/20 rounded-xl">
              <div className="mx-auto w-fit p-4 rounded-full bg-slate-700/30 border border-slate-600/50 mb-6">
                <Building2 className="w-16 h-16 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' || organizationTypeFilter !== 'all' || quickView !== 'all'
                  ? 'Inga organisationer matchar dina filter'
                  : 'Inga organisationer registrerade'}
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' || organizationTypeFilter !== 'all' || quickView !== 'all'
                  ? 'Prova att justera dina filterkriterier för att hitta organisationer.'
                  : 'Organisationer kommer att visas här när de läggs till i systemet.'}
              </p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl mt-2">
              <span className="text-sm text-slate-400">
                Visar {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, orderedRows.length)} av {orderedRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
                >
                  Föregående
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <React.Fragment key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="text-slate-500 text-xs">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))
                }
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
                >
                  Nästa
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Email Campaign Modal */}
      <EmailCampaignModal
        isOpen={emailCampaignOpen}
        onClose={() => setEmailCampaignOpen(false)}
        customers={legacyCustomers || []}
      />

      {/* Edit Customer Modal */}
      <EditCustomerModal
        customer={editingCustomer}
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingCustomer(null)
          setEditingOrgId(null)
        }}
        onSave={handleCustomerSaved}
      />

      {/* Revenue Modal */}
      <CustomerRevenueModal
        customer={revenueCustomer}
        contractId={revenueContractId}
        isOpen={revenueModalOpen}
        onClose={() => {
          setRevenueModalOpen(false)
          setRevenueCustomer(null)
          setRevenueContractId(null)
        }}
      />


      {/* Terminate Contract Modal */}
      <TerminateContractModal
        organization={terminateOrganization}
        isOpen={terminateModalOpen}
        onClose={() => {
          setTerminateModalOpen(false)
          setTerminateOrganization(null)
        }}
        onTerminated={refresh}
      />

      {/* Add Customer Manually Modal */}
      <CreateCustomerManuallyModal
        isOpen={addManualCustomerOpen}
        onClose={() => setAddManualCustomerOpen(false)}
        onCustomerCreated={refresh}
      />

      {/* Import Customer by Org.nr Modal */}
      <ImportCustomerByOrgnrModal
        isOpen={importByOrgnrOpen}
        onClose={() => setImportByOrgnrOpen(false)}
        onImported={(customerId) => {
          refresh()
          setSearchParams({ customerId })
        }}
      />

      {/* Add Contract Customer Modal */}
      <AddContractCustomerModal
        isOpen={addContractCustomerOpen}
        onClose={() => setAddContractCustomerOpen(false)}
        onCustomerCreated={refresh}
      />

      {/* Add Xpert Contract Customer Modal */}
      <AddXpertContractCustomerModal
        isOpen={addXpertContractCustomerOpen}
        onClose={() => setAddXpertContractCustomerOpen(false)}
        onCustomerCreated={refresh}
      />

      {/* Import Customer by PDF Modal */}
      <ImportCustomerByPdfModal
        isOpen={importByPdfOpen}
        onClose={() => setImportByPdfOpen(false)}
        onImported={(customerId) => {
          refresh()
          setSearchParams({ customerId })
        }}
      />

      {/* Billing Settings Modal */}
      {billingSettingsOrg && (
        <BillingSettingsModal
          customerId={billingSettingsOrg.sites[0]?.id || null}
          headquarterCustomerId={
            billingSettingsOrg.organizationType === 'multisite'
              ? (billingSettingsOrg.headquarterCustomer?.id || null)
              : null
          }
          contractId={billingSettingsContractId}
          customerName={billingSettingsOrg.company_name}
          contactEmail={billingSettingsOrg.contact_email}
          isMultisite={billingSettingsOrg.organizationType === 'multisite'}
          currentBillingFrequency={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_frequency || billingSettingsOrg.sites[0]?.billing_frequency || null)
              : (billingSettingsOrg.sites[0]?.billing_frequency || null)
          }
          currentPriceListId={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.price_list_id || billingSettingsOrg.sites[0]?.price_list_id || null)
              : (billingSettingsOrg.sites[0]?.price_list_id || null)
          }
          currentBillingEmail={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_email || billingSettingsOrg.sites[0]?.billing_email || null)
              : (billingSettingsOrg.sites[0]?.billing_email || null)
          }
          currentBillingAddress={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_address || billingSettingsOrg.sites[0]?.billing_address || null)
              : (billingSettingsOrg.sites[0]?.billing_address || null)
          }
          currentBillingType={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_type || billingSettingsOrg.sites[0]?.billing_type || null)
              : (billingSettingsOrg.sites[0]?.billing_type || null)
          }
          currentBillingReference={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_reference || billingSettingsOrg.sites[0]?.billing_reference || null)
              : (billingSettingsOrg.sites[0]?.billing_reference || null)
          }
          currentCostCenter={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.cost_center || billingSettingsOrg.sites[0]?.cost_center || null)
              : (billingSettingsOrg.sites[0]?.cost_center || null)
          }
          currentBillingRecipient={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_recipient || billingSettingsOrg.sites[0]?.billing_recipient || null)
              : (billingSettingsOrg.sites[0]?.billing_recipient || null)
          }
          currentPriceAdjustmentPercent={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.price_adjustment_percent ?? billingSettingsOrg.sites[0]?.price_adjustment_percent ?? null)
              : (billingSettingsOrg.sites[0]?.price_adjustment_percent ?? null)
          }
          currentBillingActive={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_active ?? (billingSettingsOrg.sites[0] as any)?.billing_active ?? false)
              : ((billingSettingsOrg.sites[0] as any)?.billing_active ?? false)
          }
          currentContractStartDate={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.contract_start_date ?? billingSettingsOrg.sites[0]?.contract_start_date ?? null)
              : (billingSettingsOrg.sites[0]?.contract_start_date ?? null)
          }
          currentContractEndDate={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.contract_end_date ?? billingSettingsOrg.sites[0]?.contract_end_date ?? null)
              : (billingSettingsOrg.sites[0]?.contract_end_date ?? null)
          }
          currentBillingAnchorMonth={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.billing_anchor_month ?? (billingSettingsOrg.sites[0] as any)?.billing_anchor_month ?? null)
              : ((billingSettingsOrg.sites[0] as any)?.billing_anchor_month ?? null)
          }
          currentAdhocInvoiceGrouping={
            billingSettingsOrg.organizationType === 'multisite'
              ? ((billingSettingsOrg.headquarterCustomer as any)?.adhoc_invoice_grouping ?? (billingSettingsOrg.sites[0] as any)?.adhoc_invoice_grouping ?? null)
              : ((billingSettingsOrg.sites[0] as any)?.adhoc_invoice_grouping ?? null)
          }
          sites={billingSettingsOrg.sites || []}
          isOpen={billingSettingsOpen}
          onClose={() => {
            setBillingSettingsOpen(false)
            setBillingSettingsOrg(null)
            setBillingSettingsContractId(null)
          }}
          onSave={refresh}
        />
      )}

      {/* Customer Contacts Modal */}
      {contactsOrg && (
        <CustomerContactsModal
          customerId={contactsOrg.sites[0]?.id || contactsOrg.id}
          customerName={contactsOrg.company_name}
          isMultisite={contactsOrg.organizationType === 'multisite'}
          sites={contactsOrg.sites || []}
          isOpen={contactsModalOpen}
          onClose={() => {
            setContactsModalOpen(false)
            setContactsOrg(null)
          }}
        />
      )}

      {/* Peek-panel — radklick, ersätter gamla CustomerDetailSidePanel */}
      <CustomerPeekPanel
        customerId={peekCustomerId}
        basePath={basePath}
        onClose={closePeek}
      />
    </div>
  )
}
