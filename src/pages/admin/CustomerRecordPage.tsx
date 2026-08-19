// src/pages/admin/CustomerRecordPage.tsx
// Kanonisk kundsida (etapp 1 av redesignen av Befintliga kunder).
// Gör en kund med flera avtal, flera enheter och premietrappa begriplig:
// header i textrader (inga KPI-kort), flikar (hidden-pattern) och avtalskorten
// som enda "kort". :id kan vara org-raden eller en enhetsrad.

import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import {
  contractAnnualValue,
  customerRowName,
  isEndedContract,
  useCustomerRecord,
  type RecordAddition,
  type RecordBillingItem,
  type RecordCustomer,
} from '../../hooks/useCustomerRecord'
import RecordHeader from '../../components/admin/customers/record/RecordHeader'
import ContractCard from '../../components/admin/customers/record/ContractCard'
import ContractTimelineList, {
  buildFamilyTimeline,
  nextUpcomingEvent,
} from '../../components/admin/customers/record/ContractTimelineList'
import BillingChainSection from '../../components/admin/customers/record/BillingChainSection'
import UnitsSection from '../../components/admin/customers/record/UnitsSection'

type TabId = 'oversikt' | 'avtal' | 'fakturering' | 'enheter' | 'arenden'

function WhisperHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">{children}</h2>
}

export default function CustomerRecordPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { data, loading, error } = useCustomerRecord(id)
  const [activeTab, setActiveTab] = useState<TabId>('oversikt')

  // Fungerar för /admin, /koordinator och /saljare — samma sidkomponent
  const basePath = `${location.pathname.split('/befintliga-kunder')[0]}/befintliga-kunder`

  const derived = useMemo(() => {
    if (!data) return null
    const { customer, root, units, contracts, billingItems, additions, caseCounts } = data

    const family: RecordCustomer[] = [root, ...units]
    const nameById = new Map(family.map((c) => [c.id, customerRowName(c)]))
    const customerById = new Map(family.map((c) => [c.id, c]))

    const additionsByCustomer = new Map<string, RecordAddition[]>()
    for (const a of additions) {
      const list = additionsByCustomer.get(a.customer_id) ?? []
      list.push(a)
      additionsByCustomer.set(a.customer_id, list)
    }
    const billingByCustomer = new Map<string, RecordBillingItem[]>()
    for (const b of billingItems) {
      const list = billingByCustomer.get(b.customer_id) ?? []
      list.push(b)
      billingByCustomer.set(b.customer_id, list)
    }

    // Den visade radens avtal först, därefter org → enheter i familjeordning
    const familyOrder = new Map(family.map((c, i) => [c.id, i]))
    const sortedContracts = [...contracts].sort((a, b) => {
      const aViewed = a.customer_id === customer.id ? 0 : 1
      const bViewed = b.customer_id === customer.id ? 0 : 1
      if (aViewed !== bViewed) return aViewed - bViewed
      return (familyOrder.get(a.customer_id ?? '') ?? 99) - (familyOrder.get(b.customer_id ?? '') ?? 99)
    })

    const activeContracts = sortedContracts.filter((c) => !isEndedContract(c))
    const familyAnnualValue = activeContracts.reduce((sum, c) => sum + contractAnnualValue(c), 0)

    const timelineEvents = buildFamilyTimeline(sortedContracts, additionsByCustomer, billingByCustomer, nameById)
    const nextEvent = nextUpcomingEvent(timelineEvents)

    const totalCases = Object.values(caseCounts).reduce((sum, n) => sum + n, 0)

    return {
      family,
      nameById,
      customerById,
      additionsByCustomer,
      billingByCustomer,
      sortedContracts,
      activeContracts,
      familyAnnualValue,
      timelineEvents,
      nextEvent,
      totalCases,
    }
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !data || !derived) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <button
            onClick={() => navigate(basePath)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#20c58f] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till kundlistan
          </button>
          <div className="flex items-center gap-3 text-slate-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">Kunde inte hämta kunden</p>
              {error && <p className="text-xs text-slate-500 mt-0.5">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { customer, root, units, billingItems, caseCounts } = data
  const {
    sortedContracts,
    activeContracts,
    familyAnnualValue,
    additionsByCustomer,
    billingByCustomer,
    customerById,
    timelineEvents,
    nextEvent,
    totalCases,
  } = derived

  const showUnitsTab = units.length > 0

  const tabs: { id: TabId; label: string; visible: boolean }[] = [
    { id: 'oversikt', label: 'Översikt', visible: true },
    { id: 'avtal', label: `Avtal (${sortedContracts.length})`, visible: true },
    { id: 'fakturering', label: 'Fakturering', visible: true },
    { id: 'enheter', label: `Enheter (${units.length})`, visible: showUnitsTab },
    { id: 'arenden', label: `Ärenden (${totalCases})`, visible: true },
  ]

  const renderContractCards = (compact: boolean) =>
    sortedContracts.map((contract) => {
      const owner = customerById.get(contract.customer_id ?? '') ?? root
      return (
        <ContractCard
          key={contract.id}
          contract={contract}
          owner={owner}
          root={root}
          additions={additionsByCustomer.get(owner.id) ?? []}
          billingItems={billingByCustomer.get(owner.id) ?? []}
          compact={compact}
        />
      )
    })

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate(basePath)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#20c58f] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Befintliga kunder
        </button>

        <RecordHeader
          customer={customer}
          root={root}
          unitsCount={units.length}
          familyAnnualValue={familyAnnualValue}
          activeContractsCount={activeContracts.length}
          nextEvent={nextEvent}
          basePath={basePath}
        />

        {/* Flikrad */}
        <nav className="flex items-center gap-5 mt-6 border-b border-slate-800">
          {tabs
            .filter((t) => t.visible)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 text-sm border-b-2 -mb-px transition-colors tabular-nums ${
                  activeTab === tab.id
                    ? 'border-[#20c58f] text-[#20c58f]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </nav>

        {/* Flikpaneler — göms med hidden, avmonteras aldrig */}
        <div hidden={activeTab !== 'oversikt'} className="pt-6 space-y-8">
          <section>
            <WhisperHeader>
              Avtal ({sortedContracts.length})
              {familyAnnualValue > 0 && <span className="tabular-nums"> · {familyAnnualValue.toLocaleString('sv-SE')} kr/år</span>}
            </WhisperHeader>
            <div className="space-y-3">{renderContractCards(true)}</div>
          </section>

          <section>
            <WhisperHeader>Tidslinje</WhisperHeader>
            <ContractTimelineList events={timelineEvents} emptyText="Inga avtalshändelser ännu." />
          </section>
        </div>

        <div hidden={activeTab !== 'avtal'} className="pt-6">
          <div className="space-y-3">{renderContractCards(false)}</div>
          {sortedContracts.length === 0 && (
            <p className="text-sm text-slate-500">Inga avtal registrerade för kunden.</p>
          )}
        </div>

        <div hidden={activeTab !== 'fakturering'} className="pt-6">
          <BillingChainSection root={root} units={units} billingItems={billingItems} />
        </div>

        {showUnitsTab && (
          <div hidden={activeTab !== 'enheter'} className="pt-6">
            <UnitsSection
              root={root}
              units={units}
              contracts={sortedContracts}
              caseCounts={caseCounts}
              basePath={basePath}
              currentCustomerId={customer.id}
            />
          </div>
        )}

        <div hidden={activeTab !== 'arenden'} className="pt-6">
          <ul className="divide-y divide-slate-800">
            {[root, ...units].map((row) => (
              <li key={row.id} className="flex items-baseline justify-between py-2 text-sm">
                <span className="text-slate-300">{customerRowName(row)}</span>
                <span className="text-slate-400 tabular-nums">{caseCounts[row.id] ?? 0} ärenden</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-600 mt-3">Fullständig ärendelista kommer i en senare etapp.</p>
        </div>
      </div>
    </div>
  )
}
