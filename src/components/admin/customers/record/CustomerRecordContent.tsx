// src/components/admin/customers/record/CustomerRecordContent.tsx
// Delat record-innehåll för kundsidan (density='full') och peek-panelen
// (density='peek'). Sidan visar flikar (hidden-pattern); peek visar en kompakt
// version: RecordHeader + avtalskorten (kollapsade). Ingen datahämtning här —
// data kommer från useCustomerRecord via anroparen.

import { useMemo, useState } from 'react'
import { Archive } from 'lucide-react'
import {
  contractEffectiveAnnualValue,
  customerRowName,
  isEndedContract,
  isImportedContract,
  type CustomerRecordData,
  type RecordAddition,
  type RecordBillingItem,
  type RecordCase,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordPremiumEvent,
} from '../../../../hooks/useCustomerRecord'
import RecordHeader from './RecordHeader'
import ContractCard from './ContractCard'
import {
  buildFamilyTimeline,
  nextUpcomingEvent,
} from './ContractTimelineList'
import ContractTimeline from './ContractTimeline'
import BillingChainSection from './BillingChainSection'
import UnitsSection from './UnitsSection'
import AccessAccountsSection, { countAccessPersons } from './AccessAccountsSection'
import ContractMapSection from './ContractMapSection'
import CustomerCasesSection from './CustomerCasesSection'
import RevenueSection from './RevenueSection'
import CustomerPulseRow from './CustomerPulseRow'
import CaseDetailPanel from './CaseDetailPanel'
import { EmptyContractsIllustration } from './ContractGlyphs'
import { contractState } from '../../../../utils/contractLifecycle'


type TabId = 'oversikt' | 'avtal' | 'avtalskarta' | 'fakturering' | 'intakter' | 'enheter' | 'arenden' | 'atkomst'

function WhisperHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">{children}</h2>
}

interface Props {
  data: CustomerRecordData
  /** T.ex. "/admin/befintliga-kunder" */
  basePath: string
  /** 'full' = hela sidan med flikar, 'peek' = kompakt högerpanel */
  density: 'peek' | 'full'
  /** Refetch efter mutation (Avtalskartan). Saknas den göms kartfliken. */
  onDataChanged?: () => void | Promise<void>
}

export default function CustomerRecordContent({ data, basePath, density, onDataChanged }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('oversikt')
  // Ärendet visas i en LÄSVY som hämtar sin egen data. Redigering sker i
  // ärendevyn — de fulla modalerna är arbetsverktyg med tabellspecifika
  // fältnamn och hör inte hemma här.
  const [openCase, setOpenCase] = useState<RecordCase | null>(null)

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

    // Importrester och trashade rader är historik från importen, inte avtal.
    // Avtalskartan gör samma uppdelning — utan den blandas de rakt av med de
    // riktiga avtalen och kunden ser ut att ha dubbletter.
    const realContracts = sortedContracts.filter(
      (c) => !isImportedContract(c) && (c.status as string) !== 'trashed'
    )
    // Importrester delas i två: de som väntar på åtgärd, och de som redan
    // ersatts av ett portalskapat avtal. De senare är tomma skal — historiken
    // flyttades vid konverteringen — men får INTE raderas: de bär de riktiga
    // Oneflow-id:na, och nattsynken återskapar allt som saknas i DB som nya
    // AKTIVA avtal. Avtalskartan gör redan samma uppdelning.
    const allLeftovers = sortedContracts.filter(
      (c) => isImportedContract(c) || (c.status as string) === 'trashed'
    )
    const importLeftovers = allLeftovers.filter((c) => !isEndedContract(c))
    const replacedLeftovers = allLeftovers.filter((c) => isEndedContract(c))

    const activeContracts = realContracts.filter((c) => !isEndedContract(c))
    // Uppsagt-men-löpande räknas som levande: det faktureras och schemaläggs
    // till sista giltiga dagen och hör därför hemma bland de aktiva korten.
    const liveContracts = realContracts.filter((c) => contractState(c) !== 'ended')
    const endedContracts = realContracts.filter((c) => contractState(c) === 'ended')
    // Fördelning: var avtalen bor (organisationen vs enheterna)
    const unitIds = new Set(units.map((u) => u.id))
    const contractsOnUnits = activeContracts.filter((c) => unitIds.has(c.customer_id ?? '')).length
    const contractsOnOrg = activeContracts.length - contractsOnUnits
    const contractDistribution = units.length > 0 && activeContracts.length > 0
      ? [
          contractsOnOrg > 0 ? `${contractsOnOrg} på organisationen` : null,
          contractsOnUnits > 0 ? `${contractsOnUnits} på enheterna` : null,
        ].filter(Boolean).join(', ')
      : null
    // AKTUELLT årsvärde: premietrappan styr när events finns, annars annual_value
    const familyAnnualValue = activeContracts.reduce(
      (sum, c) => sum + contractEffectiveAnnualValue(c, premiumByContract.get(c.id) ?? []),
      0
    )

    // realContracts, inte sortedContracts: importresterna är samma avtal i sin
    // gamla form, så varje avtalsstart, periodskifte och slutdatum skrevs två
    // gånger i tidslinjen.
    const timelineEvents = buildFamilyTimeline(
      realContracts,
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
      realContracts,
      liveContracts,
      endedContracts,
      importLeftovers,
      replacedLeftovers,
      activeContracts,
      familyAnnualValue,
      contractDistribution,
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
    realContracts,
    liveContracts,
    endedContracts,
    importLeftovers,
    replacedLeftovers,
    activeContracts,
    familyAnnualValue,
    contractDistribution,
    timelineEvents,
    nextEvent,
    totalCases,
  } = derived

  const renderContractCards = (compact: boolean, list: RecordContract[] = realContracts) =>
    list.map((contract) => {
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
      contractDistribution={contractDistribution}
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
            Avtal ({realContracts.length})
            {familyAnnualValue > 0 && (
              <span className="tabular-nums"> · {familyAnnualValue.toLocaleString('sv-SE')} kr/år</span>
            )}
          </WhisperHeader>
          <div className="space-y-3">{renderContractCards(false)}</div>
          {realContracts.length === 0 && (
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
    { id: 'avtal', label: `Avtal (${realContracts.length})`, visible: true },
    { id: 'avtalskarta', label: 'Avtalskarta', visible: !!onDataChanged },
    { id: 'fakturering', label: 'Fakturering', visible: true },
    { id: 'intakter', label: 'Intäkter', visible: true },
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
        <CustomerPulseRow
          contracts={realContracts}
          annualValue={familyAnnualValue}
          cases={data.cases}
          inspections={data.inspections}
          invoices={data.invoices}
        />

        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-xs uppercase tracking-wide text-slate-500">
              Avtal ({realContracts.length})
              {familyAnnualValue > 0 && (
                <span className="tabular-nums"> · {familyAnnualValue.toLocaleString('sv-SE')} kr/år</span>
              )}
            </h2>
            {realContracts.length > 4 && (
              <button
                onClick={() => setActiveTab('avtal')}
                className="ml-auto text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
              >
                Visa alla i Avtal →
              </button>
            )}
          </div>
          {/* Två kolumner: kompakta kort är låga och en enkolumnslista lämnade
              halva bredden tom. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {renderContractCards(true, liveContracts.slice(0, 4))}
          </div>
          {realContracts.length === 0 && (
            <div className="flex flex-col items-center text-center py-10 rounded-2xl border border-dashed border-slate-800">
              <EmptyContractsIllustration className="mb-4" />
              <p className="text-sm text-slate-300 font-medium">Inga avtal registrerade</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Skapa ett avtal i Avtalskartan så syns det här med omfattning, prislista och tidslinje.
              </p>
            </div>
          )}
        </section>

        <section>
          <WhisperHeader>Tidslinje</WhisperHeader>
          <ContractTimeline events={timelineEvents} emptyText="Inga avtalshändelser ännu." />
        </section>
      </div>

      <div hidden={activeTab !== 'avtal'} className="pt-6">
        {/* Levande avtal överst — uppsagt-men-löpande hör hit, det fungerar
            fortfarande till slutdatumet. */}
        <div className="space-y-3">{renderContractCards(false, liveContracts)}</div>
        {realContracts.length === 0 && (
          <div className="flex flex-col items-center text-center py-10 rounded-2xl border border-dashed border-slate-800">
            <EmptyContractsIllustration className="mb-4" />
            <p className="text-sm text-slate-300 font-medium">Inga avtal registrerade</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              Skapa ett avtal i Avtalskartan så syns det här med omfattning, prislista och tidslinje.
            </p>
          </div>
        )}
        {endedContracts.length > 0 && (
          <details className="mt-4 border border-slate-800 rounded-2xl">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-400 select-none flex items-center gap-2 hover:text-slate-200 transition-colors">
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              Avslutade avtal ({endedContracts.length})
              <span className="font-normal text-slate-500">— historik</span>
            </summary>
            <div className="px-4 pb-4 space-y-3">{renderContractCards(false, endedContracts)}</div>
          </details>
        )}
        {/* Importrester som väntar på åtgärd — de har ännu inte konverterats
            till riktiga avtal. */}
        {importLeftovers.length > 0 && (
          <details className="mt-4 border border-slate-700/50 rounded-2xl">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-400 select-none flex items-center gap-2 hover:text-slate-200 transition-colors">
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              Importrester ({importLeftovers.length})
              <span className="font-normal text-slate-500">
                — behöver konverteras eller städas
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {renderContractCards(false, importLeftovers)}
            </div>
          </details>
        )}
        {/* Redan ersatta: konverteringen ÄR gjord och historiken ligger på det
            nya avtalet. Raderna finns kvar bara för att bära Oneflow-id:t —
            raderas de återskapar nattsynken dem som aktiva avtal. Ingen
            åtgärd behövs, så de tonas ned ytterligare. */}
        {replacedLeftovers.length > 0 && (
          <details className="mt-3 border border-slate-800/60 rounded-2xl">
            <summary className="cursor-pointer px-4 py-2.5 text-xs text-slate-500 select-none flex items-center gap-2 hover:text-slate-300 transition-colors">
              <Archive className="w-3 h-3 text-slate-600" />
              Ersatta av nyare avtal ({replacedLeftovers.length})
              <span className="text-slate-600">— teknisk koppling till Oneflow, ingen åtgärd behövs</span>
            </summary>
            <div className="px-4 pb-4 space-y-3">
              {renderContractCards(false, replacedLeftovers)}
            </div>
          </details>
        )}
      </div>

      {onDataChanged && (
        <div hidden={activeTab !== 'avtalskarta'} className="pt-6">
          <ContractMapSection data={data} onChanged={onDataChanged} />
        </div>
      )}

      <div hidden={activeTab !== 'fakturering'} className="pt-6">
        <BillingChainSection root={root} units={units} contracts={realContracts} invoices={data.invoices} />
      </div>

      <div hidden={activeTab !== 'intakter'} className="pt-6">
        <RevenueSection
          root={root}
          units={units}
          invoices={data.invoices}
          additions={data.additions}
        />
      </div>

      {showUnitsTab && (
        <div hidden={activeTab !== 'enheter'} className="pt-6">
          <UnitsSection
            root={root}
            units={units}
            contracts={realContracts}
            caseCounts={caseCounts}
            basePath={basePath}
            currentCustomerId={customer.id}
          />
        </div>
      )}

      <div hidden={activeTab !== 'arenden'} className="pt-6">
        <CustomerCasesSection
          root={root}
          units={units}
          cases={data.cases}
          inspections={data.inspections}
          schedules={data.schedules}
          contracts={realContracts}
          onOpenCase={setOpenCase}
        />
      </div>

      <div hidden={activeTab !== 'atkomst'} className="pt-6">
        <AccessAccountsSection access={access} customerById={customerById} />
      </div>

      {openCase && <CaseDetailPanel caseRow={openCase} onClose={() => setOpenCase(null)} />}
    </div>
  )
}
