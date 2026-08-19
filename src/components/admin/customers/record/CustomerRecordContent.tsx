// src/components/admin/customers/record/CustomerRecordContent.tsx
// Delat record-innehåll för kundsidan (density='full') och peek-panelen
// (density='peek'). Sidan visar flikar (hidden-pattern); peek visar en kompakt
// version: RecordHeader + avtalskorten (kollapsade). Ingen datahämtning här —
// data kommer från useCustomerRecord via anroparen.

import { useMemo, useState } from 'react'
import {
  contractEffectiveAnnualValue,
  customerRowName,
  isEndedContract,
  type CustomerRecordData,
  type RecordAddition,
  type RecordBillingItem,
  type RecordContractSite,
  type RecordCustomer,
  type RecordPremiumEvent,
} from '../../../../hooks/useCustomerRecord'
import RecordHeader from './RecordHeader'
import ContractCard from './ContractCard'
import ContractTimelineList, {
  buildFamilyTimeline,
  nextUpcomingEvent,
} from './ContractTimelineList'
import BillingChainSection from './BillingChainSection'
import UnitsSection from './UnitsSection'
import AccessAccountsSection, { countAccessPersons } from './AccessAccountsSection'

type TabId = 'oversikt' | 'avtal' | 'fakturering' | 'enheter' | 'arenden' | 'atkomst'

function WhisperHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">{children}</h2>
}

interface Props {
  data: CustomerRecordData
  /** T.ex. "/admin/befintliga-kunder" */
  basePath: string
  /** 'full' = hela sidan med flikar, 'peek' = kompakt högerpanel */
  density: 'peek' | 'full'
}

export default function CustomerRecordContent({ data, basePath, density }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('oversikt')

  const derived = useMemo(() => {
    const { customer, root, units, contracts, billingItems, additions, premiumEvents, contractSites, caseCounts } = data

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

    // Premietrappa + omfattning grupperade per avtal (etapp 4)
    const premiumByContract = new Map<string, RecordPremiumEvent[]>()
    for (const e of premiumEvents) {
      const list = premiumByContract.get(e.contract_id) ?? []
      list.push(e)
      premiumByContract.set(e.contract_id, list)
    }
    const sitesByContract = new Map<string, RecordContractSite[]>()
    for (const cs of contractSites) {
      const list = sitesByContract.get(cs.contract_id) ?? []
      list.push(cs)
      sitesByContract.set(cs.contract_id, list)
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
    // AKTUELLT årsvärde: premietrappan styr när events finns, annars annual_value
    const familyAnnualValue = activeContracts.reduce(
      (sum, c) => sum + contractEffectiveAnnualValue(c, premiumByContract.get(c.id) ?? []),
      0
    )

    const timelineEvents = buildFamilyTimeline(
      sortedContracts,
      additionsByCustomer,
      billingByCustomer,
      nameById,
      premiumByContract
    )
    const nextEvent = nextUpcomingEvent(timelineEvents)

    const totalCases = Object.values(caseCounts).reduce((sum, n) => sum + n, 0)

    return {
      customerById,
      additionsByCustomer,
      billingByCustomer,
      premiumByContract,
      sitesByContract,
      sortedContracts,
      activeContracts,
      familyAnnualValue,
      timelineEvents,
      nextEvent,
      totalCases,
    }
  }, [data])

  const { customer, root, units, billingItems, caseCounts, access } = data
  const {
    customerById,
    additionsByCustomer,
    billingByCustomer,
    premiumByContract,
    sitesByContract,
    sortedContracts,
    activeContracts,
    familyAnnualValue,
    timelineEvents,
    nextEvent,
    totalCases,
  } = derived

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
          premiumEvents={premiumByContract.get(contract.id) ?? []}
          contractSites={sitesByContract.get(contract.id) ?? []}
          customerById={customerById}
          compact={compact}
        />
      )
    })

  const header = (
    <RecordHeader
      customer={customer}
      root={root}
      unitsCount={units.length}
      familyAnnualValue={familyAnnualValue}
      activeContractsCount={activeContracts.length}
      nextEvent={nextEvent}
      basePath={basePath}
    />
  )

  // Peek: kompakt version — header + avtalskorten (kollapsade, expanderbara)
  if (density === 'peek') {
    return (
      <div>
        {header}
        <section className="mt-5">
          <WhisperHeader>
            Avtal ({sortedContracts.length})
            {familyAnnualValue > 0 && (
              <span className="tabular-nums"> · {familyAnnualValue.toLocaleString('sv-SE')} kr/år</span>
            )}
          </WhisperHeader>
          <div className="space-y-3">{renderContractCards(false)}</div>
          {sortedContracts.length === 0 && (
            <p className="text-sm text-slate-500">Inga avtal registrerade för kunden.</p>
          )}
        </section>
      </div>
    )
  }

  const showUnitsTab = units.length > 0
  const accessCount = countAccessPersons(access)

  const tabs: { id: TabId; label: string; visible: boolean }[] = [
    { id: 'oversikt', label: 'Översikt', visible: true },
    { id: 'avtal', label: `Avtal (${sortedContracts.length})`, visible: true },
    { id: 'fakturering', label: 'Fakturering', visible: true },
    { id: 'enheter', label: `Enheter (${units.length})`, visible: showUnitsTab },
    { id: 'arenden', label: `Ärenden (${totalCases})`, visible: true },
    { id: 'atkomst', label: `Åtkomst & konton (${accessCount})`, visible: true },
  ]

  return (
    <div>
      {header}

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
            {familyAnnualValue > 0 && (
              <span className="tabular-nums"> · {familyAnnualValue.toLocaleString('sv-SE')} kr/år</span>
            )}
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
        <BillingChainSection root={root} units={units} contracts={sortedContracts} billingItems={billingItems} />
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

      <div hidden={activeTab !== 'atkomst'} className="pt-6">
        <AccessAccountsSection access={access} customerById={customerById} />
      </div>
    </div>
  )
}
