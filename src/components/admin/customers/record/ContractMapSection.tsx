// src/components/admin/customers/record/ContractMapSection.tsx
// Avtalskartan: avtalen som dokument, enheterna som kort. Dra en enhet in i ett
// avtal så skrivs den in i § 1 Omfattning (contract_sites), dra "Hela
// verksamheten" så täcks alla enheter. § 2 byter avtalets prislista
// (contracts.price_list_id → styr avropspriser per ärende), § 3 öppnar
// historiken. Kopplingslinjer ritas mellan enheter och avtal.
//
// All skrivning går via ContractScopeService; efter varje mutation anropas
// onChanged (refetch i useCustomerRecord) så vyn visar databasens sanning.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Archive,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ClockAlert,
  ExternalLink,
  FileSignature,
  FileText,
  Home,
  Pencil,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import {
  contractDisplayName,
  contractEffectiveAnnualValue,
  customerRowName,
  formatDateSv,
  formatKr,
  isEndedContract,
  isImportedContract,
  nextPremiumEvent,
  oneflowContractUrl,
  BILLING_FREQUENCY_LABEL,
  VISIT_FREQUENCY_LABEL,
  VISITS_PER_YEAR_BY_FREQUENCY,
  type CustomerRecordData,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordInspectionSession,
} from '../../../../hooks/useCustomerRecord'
import { daysUntilEnd, isTerminatedButRunning } from '../../../../utils/contractLifecycle'
import { buildRenewalPrefill } from '../../../../utils/contractRenewalPrefill'
import { ContractScopeService } from '../../../../services/contractScopeService'
import ContractStamp from './ContractStamp'
import DateField from '../../../ui/DateField'
import { PriceListService } from '../../../../services/priceListService'
import { useContractTypeOptions } from '../../../../hooks/useContractTypeOptions'
import { useTechnicians } from '../../../../hooks/useTechnicians'
import type { PriceList } from '../../../../types/articles'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'
import ContractHistoryModal, { type HistoryTab } from './ContractHistoryModal'
import ContractContentSection, { useContractContent, useAccumulatedCaseOutcome } from './ContractContentSection'
import ContractPriceListSection, { useAvropCatalog } from './ContractPriceListSection'
import ContractPremiumSection, { premiumSummary, type PremiumPlanEntry } from './ContractPremiumSection'
import ContractReferencesSection from './ContractReferencesSection'
import ContractTermSection from './ContractTermSection'
import ContractEquipmentSection from './ContractEquipmentSection'
import { AgreementObjectText, SignatureLine, AccountManagerLine } from './PaperSignatures'
import ContractSettingsDrawer, { type SettingsTab } from './ContractSettingsDrawer'
import {
  CONTRACT_PHASES,
  CONTRACT_PHASE_LABEL,
  computeCompleteness,
  contractPhase,
  type CompletenessInput,
  type SettingsGroup,
  SETTINGS_GROUPS,
} from './contractCompleteness'

/** § 6 tänds två sekunder när panelen öppnas från notisen eller remsan */
const PARA_FLASH_CLASSES = ['shadow-[inset_3px_0_0_#20c58f]', 'bg-[#20c58f]/[.04]']
import { PAPER_GEAR_CLASS } from './paperInk'
import LinkFortnoxInvoiceModal, { type LinkFortnoxTarget } from './LinkFortnoxInvoiceModal'
import AddonDropPrompt, { type AddonDropPromptState, type AddonPromptBrick } from './AddonDropPrompt'
import { useAddonPending } from '../../../../hooks/useAddonPending'
import type { AddonBrick } from '../../../../types/addonStations'
import BillingPlanPreviewModal from '../BillingPlanPreviewModal'
import { ContractInvoiceGenerator, type BillingPlan } from '../../../../services/contractInvoiceGenerator'
import type { CaseBillingItemWithRelations } from '../../../../types/caseBilling'
import ContractCaseServiceSelector from '../ContractCaseServiceSelector'
import Modal from '../../../ui/Modal'
import SiteModal from '../../multisite/SiteModal'
import { supabase } from '../../../../lib/supabase'

// Accentfärger per avtal (cyklas). Brandgrön först.
const ACCENTS = ['#20c58f', '#38bdf8', '#f59e0b', '#a78bfa', '#f472b6', '#34d399']

const todayKey = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Typer för interaktionen
// ---------------------------------------------------------------------------

type DragPayload =
  | { type: 'unit'; unitId: string }
  | { type: 'org' }
  | { type: 'scoperow'; unitId: string; scopeRowId: string; fromContractId: string }
  /** Ett papper: släpps på arkivet (uppsägning) eller på ett annat papper (byt ordning) */
  | { type: 'paper'; contractId: string }
  /** Katalogen: prislista → § 2, tjänst → § 4, utrustning → § 6 */
  | {
      type: 'catalog'
      kind: 'pricelist' | 'service' | 'equipment' | 'station_type'
      id: string
      name: string
      code?: string | null
      basePrice?: number | null
    }
  /** Bricka med tilläggsstationer (per enhet och typ): § 7 = inbakat, § 6 = tillägg */
  | ({ type: 'addon_stations' } & AddonBrick)

/** Enheten en dragning handlar om (null för verksamheten, papper och katalog) */
function unitIdOf(payload: DragPayload): string | null {
  return payload.type === 'unit' || payload.type === 'scoperow' || payload.type === 'addon_stations' ? payload.unitId : null
}

interface DragState {
  payload: DragPayload
  started: boolean
  x: number
  y: number
  overContractId: string | null
  invalidReason: string | null
  /** Musen är över det tomma avtalsbladet (nytt avtal) */
  overBlank: boolean
  /** § 1-rad över Verksamhetspanelen (avsluta täckning) */
  overAside: boolean
  /** Papper över arkivet (uppsägning) */
  overArchive: boolean
  /** Släppzon inuti pappret: 'scope' (§ 1, standard) eller 'refs' (§ 8) */
  overZone: DropZone
}

type DropZone = 'scope' | 'refs' | 'content' | 'equipment' | 'pricelist' | 'premium'

/** Vad som ligger under pekaren vid en dragning */
type DropTarget =
  | { kind: 'paper'; contract: RecordContract; zone: DropZone }
  | { kind: 'blank' }
  /** Verksamhetspanelen: en § 1-rad släpps tillbaka = täckningen avslutas */
  | { kind: 'aside' }
  /** Arkivet: ett papper släpps = uppsägning */
  | { kind: 'archive' }
  | null

/** Enhet som släppts på § 8 Referenser: sätt Er referens */
interface RefPrompt {
  contract: RecordContract
  unitId: string
}

/** § 3 per enhet: driftläge, takt och utfall i avtalsåret */
export interface UnitFollowup {
  unitId: string
  /** contract_sites-raden (null när enheten är avtalets egen kundrad eller täcks via covers_all_sites) */
  scopeRowId: string | null
  serviceMode: 'inspection' | 'on_demand'
  frequency: string | null
  visitsPerYear: number | null
  /** Takten kommer från avtalets förval, inte enhetens egen rad */
  inherited: boolean
  /** Förväntat antal utförda besök hittills i avtalsåret (pro rata) */
  expectedSoFar: number | null
  doneThisYear: number
  nextVisitAt: string | null
  casesThisYear: number
}

/** Redigering av en enhets besöksplan i § 3 */
interface SitePlanPrompt {
  contract: RecordContract
  unit: UnitFollowup
}

interface DatePrompt {
  x: number
  y: number
  title: string
  subject: string
  contract: RecordContract
  /** Avtalsstart som snabbval (om den finns) */
  contractStart: string | null
  onConfirm: (date: string) => void
}

interface PricePrompt {
  x: number
  y: number
  contract: RecordContract
}

/** Val vid släpp av "Hela verksamheten": bara dagens enheter eller även framtida */
interface ScopeModePrompt {
  x: number
  y: number
  contract: RecordContract
}

interface HistoryState {
  contract: RecordContract
  tab: HistoryTab
  unitFilter: string
}

interface Props {
  data: CustomerRecordData
  onChanged: () => void | Promise<void>
}

// ---------------------------------------------------------------------------

export default function ContractMapSection({ data, onChanged }: Props) {
  const { root, units, contracts, additions, billingItems, premiumEvents, contractSites, cases, contractEvents, inspections } =
    data
  const navigate = useNavigate()
  // Aktiv personal — säljaren väljs ur registret, aldrig som fritext.
  // Avtalen bar redan 21 unika namn mot 12 i personalregistret.
  const { technicians } = useTechnicians()

  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [datePrompt, setDatePrompt] = useState<DatePrompt | null>(null)
  const [pricePrompt, setPricePrompt] = useState<PricePrompt | null>(null)
  const [scopeModePrompt, setScopeModePrompt] = useState<ScopeModePrompt | null>(null)
  const [history, setHistory] = useState<HistoryState | null>(null)
  const [siteModalOpen, setSiteModalOpen] = useState(false)
  /** Avtal vars innehåll (§ 4 tjänster/kostnader) redigeras */
  const [contentEditor, setContentEditor] = useState<RecordContract | null>(null)
  /** Bumpas när innehållet sparats så pappren hämtar om tjänster + marginal */
  const [contentReloadKey, setContentReloadKey] = useState(0)
  /**
   * Val av avtalstyp innan ett nytt avtal skapas. `blankPayload` = enheten
   * (eller Hela verksamheten) som släpptes på det tomma avtalsbladet; då
   * skapas ett tomt avtal på kundraden och enheten skrivs in i § 1 direkt.
   */
  const [typePrompt, setTypePrompt] = useState<{ source: RecordContract | null; blankPayload?: DragPayload } | null>(null)
  /** Enhet släppt på § 8 — raden öppnas för inmatning av Er referens */
  const [refPrompt, setRefPrompt] = useState<RefPrompt | null>(null)
  /** Fakturaplanen för kundens avtal (gemet, § 7). Läses om efter varje skrivning. */
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([])
  const [billingPlansKey, setBillingPlansKey] = useState(0)
  /** Förhandsgranskning innan fakturaplanen appliceras */
  const [planPreview, setPlanPreview] = useState<BillingPlan | null>(null)
  const [planPreviewOpen, setPlanPreviewOpen] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  /** "Indexera alla avtal" på gemet */
  const [indexAllOpen, setIndexAllOpen] = useState(false)
  /** Koppla Fortnox-faktura till en passerad period (§ 7) */
  const [fortnoxTarget, setFortnoxTarget] = useState<LinkFortnoxTarget | null>(null)
  /** § 3: enhetens besöksplan redigeras */
  const [sitePlanPrompt, setSitePlanPrompt] = useState<SitePlanPrompt | null>(null)
  /** Katalogen i Verksamhetspanelen */
  const [catalogOpen, setCatalogOpen] = useState(false)
  // Vänsterpanelen: Verksamheten eller Katalog, inte en hopfälld details
  const [railTab, setRailTab] = useState<'units' | 'catalog'>('units')
  // Inställningspanelen till höger om pappren: vilket avtal, vilken grupp, vilken flik
  const [settingsPanel, setSettingsPanel] = useState<{ contractId: string; group: SettingsGroup; tab: SettingsTab } | null>(null)
  const openSettings = (contract: RecordContract, group: SettingsGroup, tab: SettingsTab = 'settings') =>
    setSettingsPanel({ contractId: contract.id, group, tab })
  useEffect(() => {
    if (railTab === 'catalog') setCatalogOpen(true)
  }, [railTab])
  const [catalogTab, setCatalogTab] = useState<'pricelist' | 'service' | 'equipment'>('pricelist')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalog, setCatalog] = useState<{
    services: { id: string; code: string | null; name: string; base_price: number | null; is_contract_service: boolean | null; is_addon_service: boolean | null; used_for_addon_stations: boolean | null }[]
    stationTypes: { id: string; code: string | null; name: string }[]
  }>({ services: [], stationTypes: [] })

  useEffect(() => {
    if (!catalogOpen) return
    let cancelled = false
    ;(async () => {
      const [{ data: services }, { data: types }] = await Promise.all([
        supabase.from('services').select('id, code, name, base_price, is_contract_service, is_addon_service, used_for_addon_stations').eq('is_active', true).order('code'),
        supabase.from('station_types').select('id, code, name').eq('is_active', true).order('sort_order'),
      ])
      if (cancelled) return
      setCatalog({
        services: (services ?? []) as typeof catalog.services,
        stationTypes: (types ?? []) as typeof catalog.stationTypes,
      })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogOpen])
  /** Avtal som ska raderas (bekräftelse) */
  const [deletePrompt, setDeletePrompt] = useState<RecordContract | null>(null)
  /** Avtal vars besöksfrekvens ska sättas */
  const [frequencyPrompt, setFrequencyPrompt] = useState<RecordContract | null>(null)
  /** Avtal vars signeringsdatum ska sättas */
  const [signedAtPrompt, setSignedAtPrompt] = useState<RecordContract | null>(null)
  /** Avtal som ska sägas upp */
  const [terminatePrompt, setTerminatePrompt] = useState<RecordContract | null>(null)
  const { options: contractTypes } = useContractTypeOptions()
  const [busy, setBusy] = useState(false)
  // Tillägg att besluta: kundens summa (samma källa som listan och notisen)
  // och vad som beslutats i den här vyn, per avtal, för klarraden.
  const addonPendingRows = useAddonPending()
  const [decidedByContract, setDecidedByContract] = useState<Record<string, { count: number; kr: number }>>({})
  const hadBricksRef = useRef(false)
  /** Scrolla fram § 6 på pappret och tänd kanten i två sekunder */
  const focusParaSix = (contractId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`para6-${contractId}`)
      if (!el) return
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      el.classList.add(...PARA_FLASH_CLASSES)
      window.setTimeout(() => el.classList.remove(...PARA_FLASH_CLASSES), 2000)
    }, 250)
  }
  const [hover, setHover] = useState<{ kind: 'unit' | 'contract'; id: string } | null>(null)

  const boardRef = useRef<HTMLDivElement>(null)
  const unitRefs = useRef(new Map<string, HTMLDivElement>())
  const orgRef = useRef<HTMLDivElement | null>(null)
  const paperRefs = useRef(new Map<string, HTMLElement>())
  const [wires, setWires] = useState<
    { key: string; d: string; color: string; unitId: string; contractId: string; ex: number; ey: number }[]
  >([])

  useEffect(() => {
    PriceListService.getActivePriceLists()
      .then(setPriceLists)
      .catch(() => setPriceLists([]))
  }, [])

  // -------------------------------------------------------------------------
  // Härledd data
  // -------------------------------------------------------------------------

  const derived = useMemo(() => {
    const family = [root, ...units]
    const customerById = new Map(family.map((c) => [c.id, c]))
    const unitIds = new Set(units.map((u) => u.id))

    // Papper = riktiga aktiva avtal. Kundrads-/importrester visas i en egen
    // sektion nedanför — de kan inte ta emot omfattning (ingen riktig avtalsrad).
    // Visningsordning: display_order (dra papper över papper), sedan skapandeordning
    const papers = contracts
      .filter((c) => !c.fromCustomerRow && !isImportedContract(c) && !isEndedContract(c))
      .sort((a, b) => {
        const d = Number(a.display_order ?? 0) - Number(b.display_order ?? 0)
        return d !== 0 ? d : (a.created_at ?? '').localeCompare(b.created_at ?? '')
      })
    const leftovers = contracts.filter((c) => (c.fromCustomerRow || isImportedContract(c)) && !isEndedContract(c))
    // Kundkortsavtal som kan materialiseras till riktiga avtalsrader
    const customerRowContracts = leftovers.filter((c) => c.fromCustomerRow)
    // Avslutade avtal visas som gråtonade dokument — historiken ska synas,
    // inte bara räknas. Importrester/kundrader hör inte hit.
    const endedPapers = contracts.filter(
      (c) => !c.fromCustomerRow && !isImportedContract(c) && isEndedContract(c)
    )
    // Räknaren MÅSTE spegla endedPapers. Tidigare räknades alla avslutade rader
    // inklusive importrester, så en kund vars gamla avtal ersatts av nya såg ut
    // att ha flera avslutade avtal — trots att importresterna är samma avtal i
    // sin gamla form, inte separata avslutade avtal.
    const endedCount = endedPapers.length
    // Ersatta importrester räknas för sig: de är historik från importen, inte
    // avtal som tagit slut.
    const replacedLeftovers = contracts.filter(
      (c) => (c.fromCustomerRow || isImportedContract(c)) && isEndedContract(c)
    ).length
    // Uppsagda som fortfarande löper ligger bland papperen (de fungerar till
    // slutdatumet) men ska räknas separat så det syns att de tar slut.
    const terminatedRunningCount = papers.filter((c) => isTerminatedButRunning(c)).length

    const accentByContract = new Map<string, string>()
    papers.forEach((c, i) => accentByContract.set(c.id, ACCENTS[i % ACCENTS.length]))
    // Avslutade avtal får neutral grå accent
    endedPapers.forEach((c) => accentByContract.set(c.id, '#8a9099'))

    const key = todayKey()
    // Aktiva + framtida omfattningsrader per avtal
    const activeScopeByContract = new Map<string, RecordContractSite[]>()
    for (const cs of contractSites) {
      if (cs.active_to && cs.active_to < key) continue
      const list = activeScopeByContract.get(cs.contract_id) ?? []
      list.push(cs)
      activeScopeByContract.set(cs.contract_id, list)
    }
    const premiumByContract = new Map<string, typeof premiumEvents>()
    for (const e of premiumEvents) {
      const list = premiumByContract.get(e.contract_id) ?? []
      list.push(e)
      premiumByContract.set(e.contract_id, list)
    }
    const additionsByCustomer = new Map<string, typeof additions>()
    for (const a of additions) {
      const list = additionsByCustomer.get(a.customer_id) ?? []
      list.push(a)
      additionsByCustomer.set(a.customer_id, list)
    }
    const billingByCustomer = new Map<string, typeof billingItems>()
    for (const b of billingItems) {
      const list = billingByCustomer.get(b.customer_id) ?? []
      list.push(b)
      billingByCustomer.set(b.customer_id, list)
    }

    // Lokaler = de platser avtalen kan omfatta. Har kunden enheter är det de;
    // saknas enheter är KUNDEN SJÄLV lokalen (en vanlig kund utan multisite —
    // organisationen och platsen är samma sak).
    const isSingleSite = units.length === 0
    const locations: RecordCustomer[] = isSingleSite ? [root] : units
    const locationIds = new Set(locations.map((l) => l.id))

    // Vilka avtal täcker en lokal? Avtalet äger raden, står i omfattningen,
    // ELLER har covers_all_sites (täcker allt inkl. framtida enheter).
    const coverage = new Map<string, RecordContract[]>()
    for (const l of locations) coverage.set(l.id, [])
    const addCoverage = (locationId: string, c: RecordContract) => {
      const list = coverage.get(locationId)
      if (list && !list.some((x) => x.id === c.id)) list.push(c)
    }
    for (const c of papers) {
      if (c.covers_all_sites) {
        for (const l of locations) addCoverage(l.id, c)
        continue
      }
      if (locationIds.has(c.customer_id ?? '')) addCoverage(c.customer_id as string, c)
      for (const cs of activeScopeByContract.get(c.id) ?? []) {
        if (locationIds.has(cs.customer_id)) addCoverage(cs.customer_id, c)
      }
    }
    const uncoveredUnits = locations.filter((l) => (coverage.get(l.id) ?? []).length === 0)

    return {
      customerById,
      unitIds,
      locations,
      locationIds,
      isSingleSite,
      papers,
      leftovers,
      customerRowContracts,
      endedPapers,
      endedCount,
      replacedLeftovers,
      terminatedRunningCount,
      accentByContract,
      activeScopeByContract,
      premiumByContract,
      additionsByCustomer,
      billingByCustomer,
      coverage,
      uncoveredUnits,
    }
  }, [root, units, contracts, contractSites, premiumEvents, additions, billingItems])

  const {
    customerById,
    unitIds,
    locations,
    locationIds,
    isSingleSite,
    papers,
    leftovers,
    customerRowContracts,
    endedPapers,
    endedCount,
    replacedLeftovers,
    terminatedRunningCount,
    accentByContract,
    activeScopeByContract,
    premiumByContract,
    additionsByCustomer,
    billingByCustomer,
    coverage,
    uncoveredUnits,
  } = derived

  const priceListName = useCallback(
    (id: string | null | undefined) => priceLists.find((p) => p.id === id)?.name ?? null,
    [priceLists]
  )

  // -------------------------------------------------------------------------
  // Kopplingslinjer
  // -------------------------------------------------------------------------

  const recomputeWires = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const bRect = board.getBoundingClientRect()
    const next: typeof wires = []
    for (const c of papers) {
      const paperEl = paperRefs.current.get(c.id)
      if (!paperEl) continue
      const pRect = paperEl.getBoundingClientRect()
      const ex = pRect.left - bRect.left - 4
      const ey = pRect.top + pRect.height / 2 - bRect.top
      const color = accentByContract.get(c.id) ?? ACCENTS[0]
      const sources = new Set<string>()
      if (c.covers_all_sites) {
        for (const l of locations) sources.add(l.id)
      } else {
        if (locationIds.has(c.customer_id ?? '')) sources.add(c.customer_id as string)
        for (const cs of activeScopeByContract.get(c.id) ?? []) {
          if (locationIds.has(cs.customer_id)) sources.add(cs.customer_id)
        }
      }
      for (const unitId of sources) {
        const uEl = unitRefs.current.get(unitId)
        if (!uEl) continue
        const uRect = uEl.getBoundingClientRect()
        const sx = uRect.right - bRect.left
        const sy = uRect.top + uRect.height / 2 - bRect.top
        const mx = (sx + ex) / 2
        next.push({
          key: `${c.id}-${unitId}`,
          d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`,
          color,
          unitId,
          contractId: c.id,
          ex,
          ey,
        })
      }
    }
    setWires(next)
  }, [papers, locations, locationIds, activeScopeByContract, accentByContract])

  useLayoutEffect(() => {
    recomputeWires()
  }, [recomputeWires, priceLists])

  useEffect(() => {
    const onResize = () => recomputeWires()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    if (boardRef.current) ro.observe(boardRef.current)
    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
    }
  }, [recomputeWires])

  // -------------------------------------------------------------------------
  // Drag & drop (pointer-baserad)
  // -------------------------------------------------------------------------

  const validateDrop = useCallback(
    (payload: DragPayload, contract: RecordContract): string | null => {
      if (contract.fromCustomerRow) return 'Kundkortsavtal — konvertera till riktigt avtal först'
      if (isImportedContract(contract)) return 'Importrest — konvertera till riktigt avtal först'
      if (contract.covers_all_sites) return 'Omfattar redan hela verksamheten'
      if (payload.type === 'org') return null
      if (payload.type === 'paper' || payload.type === 'catalog') return null
      const unitId = payload.unitId
      // Enkelkund: avtalet bor på kundraden som ÄR lokalen. Då ska lokalen
      // ändå kunna skrivas in i omfattningen — det är hela poängen.
      if (!isSingleSite && contract.customer_id === unitId) return 'Avtalet bor redan på enheten'
      if (payload.type === 'scoperow' && payload.fromContractId === contract.id) return 'Står redan i detta avtal'
      const scope = activeScopeByContract.get(contract.id) ?? []
      if (scope.some((cs) => cs.customer_id === unitId)) return 'Står redan i § 1 Omfattning'
      return null
    },
    [activeScopeByContract, isSingleSite]
  )

  /**
   * Vad ligger under pekaren: ett papper (med släppzon), det tomma
   * avtalsbladet eller inget. Zonen läses ur närmaste [data-drop-zone]
   * inuti pappret; utan zon gäller § 1 Omfattning som förut.
   */
  const findDropTarget = (x: number, y: number): DropTarget => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    if (el.closest('[data-blank-sheet]')) return { kind: 'blank' }
    if (el.closest('[data-drop-zone="archive"]')) return { kind: 'archive' }
    if (el.closest('[data-drop-zone="aside"]')) return { kind: 'aside' }
    const paperEl = el.closest<HTMLElement>('[data-paper-id]')
    if (!paperEl) return null
    const contract = papers.find((c) => c.id === paperEl.dataset.paperId)
    if (!contract) return null
    const zoneEl = el.closest<HTMLElement>('[data-drop-zone]')
    const raw = zoneEl?.dataset.dropZone
    const zone: DropZone =
      raw === 'refs' || raw === 'content' || raw === 'equipment' || raw === 'pricelist' || raw === 'premium' ? raw : 'scope'
    return { kind: 'paper', contract, zone }
  }

  /** Täcker avtalet enheten (eget avtal, § 1-rad eller hela verksamheten)? */
  const contractCoversUnit = (contract: RecordContract, unitId: string): boolean =>
    !!contract.covers_all_sites ||
    contract.customer_id === unitId ||
    (activeScopeByContract.get(contract.id) ?? []).some((cs) => cs.customer_id === unitId)

  /** Vad får släppas var? Katalog och papper har egna regler, enheter går via validateDrop. */
  const validateAnyDrop = (payload: DragPayload, target: DropTarget): string | null => {
    if (!target) return null
    if (payload.type === 'paper') {
      if (target.kind === 'archive') return null
      if (target.kind === 'paper') return target.contract.id === payload.contractId ? 'Släpp på ett annat papper för att byta ordning' : null
      return 'Dra pappret till arkivet (säg upp) eller över ett annat papper (byt ordning)'
    }
    if (payload.type === 'catalog') {
      if (target.kind !== 'paper') return 'Släpp på ett avtal'
      if (isTerminatedButRunning(target.contract)) return 'Avtalet är uppsagt'
      if (target.zone === 'premium') return 'Katalogen släpps på § 2, § 4 eller § 6'
      return null
    }
    if (payload.type === 'addon_stations') {
      if (target.kind !== 'paper') return 'Släpp på § 7 (baka in i premien) eller § 6 (tillägg utöver avtalet)'
      if (isTerminatedButRunning(target.contract)) return 'Avtalet är uppsagt'
      if (target.zone !== 'premium' && target.zone !== 'equipment') return 'Släpp på § 7 för att baka in i premien, eller på § 6 för tillägg utöver avtalet'
      if (!contractCoversUnit(target.contract, payload.unitId)) return 'Enheten står inte i avtalets omfattning'
      return null
    }
    if (target.kind === 'aside') return payload.type === 'scoperow' ? null : 'Dra en rad ur § 1 hit för att avsluta täckningen'
    if (target.kind === 'archive') return 'Bara papper kan arkiveras'
    if (target.kind === 'blank') return payload.type === 'scoperow' ? 'Omfattningsrader flyttas mellan avtal' : null
    if (target.zone === 'refs') return validateRefDrop(payload, target.contract)
    return validateDrop(payload, target.contract)
  }

  /** Släpp på § 8: enheten måste redan stå i avtalets omfattning */
  const validateRefDrop = useCallback(
    (payload: DragPayload, contract: RecordContract): string | null => {
      if (payload.type === 'org') return 'Dra in en enskild enhet för att sätta dess referens'
      if (payload.type === 'paper' || payload.type === 'catalog') return 'Bara enheter kan få en referenskod här'
      if (contract.covers_all_sites) return null
      if (contract.customer_id === payload.unitId) return null
      const scope = activeScopeByContract.get(contract.id) ?? []
      if (scope.some((cs) => cs.customer_id === payload.unitId)) return null
      return 'Skriv in enheten i § 1 Omfattning först'
    },
    [activeScopeByContract]
  )

  const startDrag = (e: React.PointerEvent, payload: DragPayload) => {
    if (busy || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setDrag({
      payload,
      started: false,
      x: e.clientX,
      y: e.clientY,
      overContractId: null,
      invalidReason: null,
      overBlank: false,
      overAside: false,
      overArchive: false,
      overZone: 'scope',
    })
  }

  /** Vad dragningen heter i spöket och släppytorna */
  const payloadLabel = (payload: DragPayload): string => {
    if (payload.type === 'org') return 'Hela verksamheten'
    if (payload.type === 'paper') return contractDisplayName(papers.find((c) => c.id === payload.contractId) ?? ({ label: 'Avtal' } as RecordContract))
    if (payload.type === 'catalog') return payload.name
    if (payload.type === 'addon_stations') {
      return `${payload.count} st ${payload.stationTypeName} · ${customerRowName(customerById.get(payload.unitId) ?? ({ company_name: 'Enhet' } as RecordCustomer))}`
    }
    return customerRowName(customerById.get(payload.unitId) ?? ({ company_name: 'Enhet' } as RecordCustomer))
  }

  const dragRef = useRef<DragState | null>(null)
  useEffect(() => {
    dragRef.current = drag
  }, [drag])

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const prev = dragRef.current
      if (!prev) return
      const started = prev.started || Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 5
      if (!started) {
        setDrag({ ...prev, x: e.clientX, y: e.clientY })
        return
      }
      const target = findDropTarget(e.clientX, e.clientY)
      const paper = target?.kind === 'paper' ? target : null
      setDrag({
        ...prev,
        started: true,
        x: e.clientX,
        y: e.clientY,
        overContractId: paper?.contract.id ?? null,
        overBlank: target?.kind === 'blank' && (prev.payload.type === 'unit' || prev.payload.type === 'org'),
        overAside: target?.kind === 'aside' && prev.payload.type === 'scoperow',
        overArchive: target?.kind === 'archive' && prev.payload.type === 'paper',
        overZone: paper?.zone ?? 'scope',
        invalidReason: target && (target.kind === 'paper' || target.kind === 'aside' || target.kind === 'archive') ? validateAnyDrop(prev.payload, target) : null,
      })
    }
    const onUp = (e: PointerEvent) => {
      const prev = dragRef.current
      setDrag(null)
      if (!prev?.started) return
      const target = findDropTarget(e.clientX, e.clientY)
      if (!target) return
      const err = validateAnyDrop(prev.payload, target)
      if (err) {
        if (target.kind === 'paper' || target.kind === 'aside' || target.kind === 'archive') toast.error(err)
        return
      }
      const payload = prev.payload
      if (target.kind === 'blank') {
        if (payload.type === 'unit' || payload.type === 'org') setTypePrompt({ source: null, blankPayload: payload })
        return
      }
      if (target.kind === 'aside') {
        if (payload.type !== 'scoperow') return
        const contract = papers.find((c) => c.id === payload.fromContractId)
        const cs = (activeScopeByContract.get(payload.fromContractId) ?? []).find((r) => r.id === payload.scopeRowId)
        if (contract && cs) endCoverage(contract, cs, e.clientX, e.clientY)
        return
      }
      if (target.kind === 'archive') {
        if (payload.type !== 'paper') return
        const contract = papers.find((c) => c.id === payload.contractId)
        if (contract) setTerminatePrompt(contract)
        return
      }
      if (payload.type === 'paper') {
        const from = papers.find((c) => c.id === payload.contractId)
        if (from) void swapOrder(from, target.contract)
        return
      }
      if (payload.type === 'catalog') {
        void dropCatalog(payload, target.contract, target.zone)
        return
      }
      if (payload.type === 'addon_stations') {
        if (target.zone !== 'premium' && target.zone !== 'equipment') return
        const unit = customerById.get(payload.unitId)
        setAddonPrompt({
          x: e.clientX,
          y: e.clientY,
          contract: target.contract,
          state: {
            x: e.clientX,
            y: e.clientY,
            contractLabel: contractDisplayName(target.contract),
            bricks: [{ brick: payload, unitName: unit ? customerRowName(unit) : 'enhet' }],
            zone: target.zone,
            annualInForce: target.contract.annual_value != null ? Number(target.contract.annual_value) : null,
          },
        })
        return
      }
      if (target.zone === 'refs') {
        if (payload.type !== 'org') openSettings(target.contract, 'referenser')
        return
      }
      openDatePromptForDrop(payload, target.contract, e.clientX, e.clientY)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, validateDrop, validateRefDrop, papers, activeScopeByContract])

  const openDatePromptForDrop = (payload: DragPayload, contract: RecordContract, x: number, y: number) => {
    // "Hela verksamheten" → fråga först om det gäller även framtida enheter
    if (payload.type === 'org') {
      setScopeModePrompt({ x, y, contract })
      return
    }
    // Papper och katalog har egna släppvägar (swapOrder, dropCatalog)
    if (payload.type === 'paper' || payload.type === 'catalog') return
    const subject = customerRowName(customerById.get(payload.unitId) ?? ({ company_name: 'Enhet' } as RecordCustomer))
    setDatePrompt({
      x,
      y,
      title: 'Täckning gäller från',
      subject: `${subject} skrivs in i ${contractDisplayName(contract)}`,
      contract,
      contractStart: contract.contract_start_date ?? contract.start_date ?? null,
      onConfirm: (date) => runDropAction(payload, contract, date),
    })
  }

  /** Sätt covers_all_sites (täcker även framtida enheter) */
  const applyCoversAll = async (contract: RecordContract) => {
    setScopeModePrompt(null)
    setBusy(true)
    try {
      await ContractScopeService.setCoversAllSites(contract.id, true)
      toast.success(
        `${contractDisplayName(contract)} omfattar nu hela verksamheten — alla ${units.length} enheter och enheter som tillkommer senare.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra omfattningsläget')
    } finally {
      setBusy(false)
    }
  }

  /** Stäng av covers_all_sites — omfattningen styrs åter av § 1 */
  const clearCoversAll = async (contract: RecordContract) => {
    setBusy(true)
    try {
      await ContractScopeService.setCoversAllSites(contract.id, false)
      toast.success(`${contractDisplayName(contract)} styrs nu per enhet — dra in enheterna som ska omfattas.`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra omfattningsläget')
    } finally {
      setBusy(false)
    }
  }

  const runDropAction = async (payload: DragPayload, contract: RecordContract, date: string) => {
    setBusy(true)
    try {
      if (payload.type === 'org') {
        const added = await ContractScopeService.coverAll(contract.id, locations.map((l) => l.id), date)
        if (added === 0) {
          toast('Alla enheter täcks redan av avtalet.', { icon: 'ℹ️' })
        } else {
          toast.success(`${added} enhet${added === 1 ? '' : 'er'} inskrivna i ${contractDisplayName(contract)} från ${formatDateSv(date)}.`)
        }
      } else if (payload.type === 'scoperow') {
        await ContractScopeService.moveSite(payload.scopeRowId, contract.id, payload.unitId, date)
        toast.success(
          `${customerRowName(customerById.get(payload.unitId)!)} flyttad till ${contractDisplayName(contract)} — gamla täckningen avslutas ${formatDateSv(date)}.`
        )
      } else if (payload.type === 'unit') {
        await ContractScopeService.addSite(contract.id, payload.unitId, date)
        const unitName = customerRowName(customerById.get(payload.unitId)!)
        // Ångra: raden raderas om den är färsk, annars avslutas täckningen
        const { data: fresh } = await supabase
          .from('contract_sites')
          .select('id')
          .eq('contract_id', contract.id)
          .eq('customer_id', payload.unitId)
          .is('active_to', null)
          .maybeSingle()
        undoToast(
          `${unitName} står nu i § 1 Omfattning för ${contractDisplayName(contract)} från ${formatDateSv(date)}.`,
          fresh
            ? async () => {
                await ContractScopeService.removeSiteIfFresh(fresh.id)
                await onChanged()
              }
            : null
        )
      }
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte uppdatera omfattningen')
    } finally {
      setBusy(false)
    }
  }

  /** Toast med Ångra-knapp (fem sekunder). Ångra-fel visas som vanlig felrad. */
  const undoToast = (message: string, undo: (() => Promise<void>) | null) => {
    if (!undo) {
      toast.success(message)
      return
    }
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>{message}</span>
          <button
            onClick={async () => {
              toast.dismiss(t.id)
              try {
                await undo()
                toast.success('Ångrat.')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Kunde inte ångra')
              }
            }}
            className="shrink-0 text-xs font-bold text-[#20c58f] border border-[#20c58f]/40 rounded-lg px-2.5 py-1 hover:bg-[#20c58f]/10"
          >
            Ångra
          </button>
        </span>
      ),
      { duration: 6000, icon: '✓' }
    )
  }

  /** Byt visningsordning: pappret som dras tar den andras plats */
  const swapOrder = async (from: RecordContract, to: RecordContract) => {
    setBusy(true)
    try {
      const fromOrder = Number(from.display_order ?? papers.indexOf(from) + 1)
      const toOrder = Number(to.display_order ?? papers.indexOf(to) + 1)
      await ContractScopeService.swapDisplayOrder({ id: from.id, order: fromOrder }, { id: to.id, order: toOrder })
      undoToast(`${contractDisplayName(from)} ligger nu ${toOrder < fromOrder ? 'före' : 'efter'} ${contractDisplayName(to)}.`, async () => {
        await ContractScopeService.swapDisplayOrder({ id: from.id, order: toOrder }, { id: to.id, order: fromOrder })
        await onChanged()
      })
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte byta ordning')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Katalogen: prislista → § 2, tjänst → § 4 (ingår i premien), utrustning →
   * § 6 (per styck och år), stationstyp → § 6 (per kontrollrunda). Priset tas
   * från avtalets prislista, annars kundens, annars tjänstens grundpris.
   */
  const dropCatalog = async (payload: Extract<DragPayload, { type: 'catalog' }>, contract: RecordContract, zone: DropZone) => {
    if (payload.kind === 'pricelist') {
      await changePriceList(contract, payload.id)
      return
    }
    setBusy(true)
    try {
      const listId = contract.price_list_id ?? root.price_list_id ?? null
      let unitPrice = payload.basePrice ?? 0
      let serviceId = payload.id
      let serviceCode = payload.code ?? null
      let serviceName = payload.name
      let stationTypeId: string | null = null
      let billingModel: 'premium' | 'per_year' | 'per_month' | 'per_round' =
        payload.kind === 'service' ? (zone === 'equipment' ? 'per_year' : 'premium') : payload.kind === 'station_type' ? 'per_round' : zone === 'content' ? 'premium' : 'per_year'
      if (payload.kind === 'station_type') {
        // Tilläggsstation: raden bär tjänsten som är flaggad för tilläggsstationer
        const addon = catalog.services.find((s) => s.used_for_addon_stations)
        if (!addon) throw new Error('Ingen tjänst är flaggad för tilläggsstationer (tjänstekatalogen)')
        serviceId = addon.id
        serviceCode = addon.code
        serviceName = `${payload.name} (tilläggsstation)`
        stationTypeId = payload.id
        unitPrice = addon.base_price ?? 0
        billingModel = 'per_round'
      }
      if (listId) {
        const { data: priced } = await supabase
          .from('price_list_items')
          .select('custom_price')
          .eq('price_list_id', listId)
          .eq('service_id', serviceId)
          .maybeSingle()
        if (priced?.custom_price != null) unitPrice = Number(priced.custom_price)
      }
      const rowId = await ContractScopeService.addContentServiceRow(contract.id, contract.customer_id ?? root.id, {
        serviceId,
        serviceCode,
        serviceName,
        unitPrice,
        quantity: 1,
        billingModel,
        stationTypeId,
        note: 'Tillagd från katalogen i avtalskartan',
      })
      setContentReloadKey((k) => k + 1)
      setBillingPlansKey((k) => k + 1)
      undoToast(
        `${serviceName} tillagd i ${billingModel === 'premium' ? '§ 4 Tjänster i avtalet' : '§ 6 Utrustning'} för ${contractDisplayName(contract)}${
          unitPrice ? ` (${formatKr(unitPrice)}${billingModel === 'per_round' ? '/runda' : '/år'})` : ' (pris saknas, sätt i redigeraren)'
        }.`,
        async () => {
          await ContractScopeService.removeContentRow(contract.id, rowId)
          setContentReloadKey((k) => k + 1)
          setBillingPlansKey((k) => k + 1)
        }
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte lägga till raden')
    } finally {
      setBusy(false)
    }
  }

  const endCoverage = (contract: RecordContract, cs: RecordContractSite, x: number, y: number) => {
    const unitName = customerRowName(customerById.get(cs.customer_id) ?? ({ company_name: 'Enhet' } as RecordCustomer))
    setDatePrompt({
      x,
      y,
      title: 'Täckning avslutas',
      subject: `${unitName} tas ur ${contractDisplayName(contract)} (historiken sparas)`,
      contract,
      contractStart: null,
      onConfirm: async (date) => {
        setBusy(true)
        try {
          await ContractScopeService.endSite(cs.id, date)
          undoToast(`Täckningen för ${unitName} avslutas ${formatDateSv(date)}.`, async () => {
            await ContractScopeService.reopenSite(cs.id)
            await onChanged()
          })
          await onChanged()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Kunde inte avsluta täckningen')
        } finally {
          setBusy(false)
        }
      },
    })
  }

  /**
   * Gör ett riktigt avtal av kundkortets avtalsdata. Kunder importerade från
   * Fortnox har premie och datum på kundraden men ingen contracts-rad, och kan
   * därför inte bära omfattning, prislista eller avtalsinnehåll.
   */
  const materializeContract = async (customerRowContract: RecordContract | null, typeName?: string) => {
    // null = kunden har inga kundkortsavtal (t.ex. bara importrester) → skapa
    // ett tomt avtal på kundraden som sedan fylls i § 4.
    const owner = customerRowContract
      ? (customerById.get(customerRowContract.customer_id ?? '') ?? root)
      : root

    // Avtalet som ersätts: den klickade importresten, annars kundradens enda
    // importrest. Historiken (fakturor, ärenden, besök) flyttas till det nya.
    const ownerLeftovers = leftovers.filter(
      (c) => !c.fromCustomerRow && c.customer_id === owner.id
    )
    const replaces =
      customerRowContract && !customerRowContract.fromCustomerRow
        ? customerRowContract.id
        : ownerLeftovers.length === 1
          ? ownerLeftovers[0].id
          : null

    setBusy(true)
    try {
      await ContractScopeService.createFromCustomerRow(
        owner.id,
        typeName ?? customerRowContract?.label ?? customerRowContract?.contract_type ?? undefined,
        replaces
      )
      toast.success(
        replaces
          ? `Avtal skapat för ${customerRowName(owner)} — historiken följde med. Lägg nu in tjänster och kostnader i § 4.`
          : `Avtal skapat för ${customerRowName(owner)} — lägg nu in tjänster och kostnader i § 4.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skapa avtalet')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Tomt avtalsblad: en enhet (eller Hela verksamheten) släpptes på det
   * streckade pappret. Skapar ett tomt avtal på kundraden och skriver in
   * enheten i § 1 från idag. Premie och löptid fylls i på pappret (§ 7, § 9).
   * Detta är vägen till FLERA avtal på samma kund — "Skapa avtal" ovan
   * materialiserar bara kundradens första.
   */
  const createFromBlank = async (payload: DragPayload, typeName?: string) => {
    if (payload.type !== 'unit' && payload.type !== 'org') return
    setBusy(true)
    try {
      const contractId = await ContractScopeService.createBlankContract(root.id, {
        label: typeName ?? null,
        contractType: typeName ?? null,
      })
      const today = todayKey()
      if (payload.type === 'org') {
        await ContractScopeService.coverAll(
          contractId,
          locations.map((l) => l.id),
          today
        )
        toast.success(
          `Nytt avtal${typeName ? ` (${typeName})` : ''} skapat med alla ${locations.length} enheter i § 1. Fyll i årspremie i § 7 och löptid i § 9.`
        )
      } else {
        const unit = customerById.get(payload.unitId)
        await ContractScopeService.addSite(contractId, payload.unitId, today)
        toast.success(
          `Nytt avtal${typeName ? ` (${typeName})` : ''} skapat med ${unit ? customerRowName(unit) : 'enheten'} i § 1 från idag. Fyll i årspremie i § 7 och löptid i § 9.`
        )
      }
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skapa avtalet')
    } finally {
      setBusy(false)
    }
  }

  const savePremium = async (
    contract: RecordContract,
    input: { annualValue: number | null; billingFrequency: string | null; billingAnchorMonth: number | null }
  ) => {
    try {
      await ContractScopeService.setPremium(contract.id, input)
      toast.success(
        input.annualValue
          ? `Årspremie ${formatKr(input.annualValue)} sparad för ${contractDisplayName(contract)}.`
          : `Premien borttagen från ${contractDisplayName(contract)}.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara premien')
      throw err
    }
  }

  const addPremiumEvent = async (
    contract: RecordContract,
    input: { eventType: 'step_up' | 'indexation' | 'adjustment'; effectiveFrom: string; annualValue: number; note: string | null }
  ) => {
    try {
      await ContractScopeService.addPremiumEvent(contract.id, input)
      toast.success(
        `${input.eventType === 'indexation' ? 'Indexjustering' : 'Nytt steg'} från ${formatDateSv(input.effectiveFrom)}: ${formatKr(input.annualValue)}/år.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara steget')
      throw err
    }
  }

  const saveTerm = async (
    contract: RecordContract,
    input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }
  ) => {
    try {
      await ContractScopeService.setTerm(contract.id, input)
      toast.success(`Löptid sparad för ${contractDisplayName(contract)}.`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara löptiden')
      throw err
    }
  }

  const saveInvoiceReference = async (
    contract: RecordContract,
    input: { invoiceReference: string | null; diaryNumber: string | null }
  ) => {
    try {
      await ContractScopeService.setInvoiceReference(contract.id, input)
      toast.success('Avtalets referens sparad. Skrivs på årspremiefakturan.')
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara referensen')
      throw err
    }
  }

  const saveUnitReference = async (contract: RecordContract, unit: RecordCustomer, code: string | null) => {
    try {
      await ContractScopeService.setUnitBillingReference(unit.id, code, {
        contractId: contract.id,
        unitName: customerRowName(unit),
      })
      toast.success(
        code
          ? `Er referens ${code} sparad på ${customerRowName(unit)} (Märkning faktura). Förifylls på enhetens ärenden.`
          : `Er referens borttagen från ${customerRowName(unit)}.`
      )
      setRefPrompt(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara referenskoden')
      throw err
    }
  }

  /**
   * Kundkortsavtal på en rad som redan täcks av ett riktigt avtal är rester:
   * datumen på kundraden ger ett spökkort i avtalskartan fast enheten står i
   * ett avtals § 1. Nollning tar bort kortet; avtalet ovan bär reglerna.
   */
  /** Raden står i något avtals § 1 eller bär ett eget papper */
  const rowIsCovered = (rowId: string) =>
    (coverage.get(rowId) ?? []).length > 0 || papers.some((p) => p.customer_id === rowId)

  /**
   * Kundkortsavtal kan nollas så fort kunden har minst ett riktigt papper:
   * då är avtalskartan källan och kundkortsdatumen bara rester. Rader som
   * ännu inte står i något avtal kräver en bekräftelse.
   */
  const canClearRow = (c: RecordContract) => c.fromCustomerRow && papers.length > 0

  const clearRowContractFields = async (customerRowContract: RecordContract) => {
    const rowId = customerRowContract.customer_id ?? ''
    const row = customerById.get(rowId)
    const name = row ? customerRowName(row) : 'kundraden'
    if (
      !rowIsCovered(rowId) &&
      !window.confirm(
        `${name} står inte i något avtal ännu. Nolla kundkortets avtalsdatum ändå? Enheten blir "utan avtalstäckning" tills du drar in den i ett avtal.`
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await ContractScopeService.clearCustomerRowContractFields(rowId)
      toast.success(
        rowIsCovered(rowId)
          ? `Avtalsfälten på ${name} nollade. Avtalet i § 1 gäller.`
          : `Avtalsfälten på ${name} nollade. Dra in enheten i ett avtal när den ska täckas.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte nolla avtalsfälten')
    } finally {
      setBusy(false)
    }
  }

  const clearAllRowContractFields = async (rows: RecordContract[]) => {
    const ids = rows.map((c) => c.customer_id ?? '').filter(Boolean)
    if (ids.length === 0) return
    const uncovered = ids.filter((id) => !rowIsCovered(id)).length
    if (
      !window.confirm(
        uncovered > 0
          ? `Nolla kundkortets avtalsdatum på ${ids.length} rader? ${uncovered} av dem står inte i något avtal ännu och blir "utan avtalstäckning" tills de dras in.`
          : `Nolla kundkortets avtalsdatum på ${ids.length} rader? Avtalen i § 1 gäller redan.`
      )
    ) {
      return
    }
    setBusy(true)
    let done = 0
    try {
      for (const id of ids) {
        await ContractScopeService.clearCustomerRowContractFields(id)
        done++
      }
      toast.success(`Avtalsfälten nollade på ${done} rader.`)
    } catch (err) {
      toast.error(
        `${err instanceof Error ? err.message : 'Kunde inte nolla avtalsfälten'} (${done} av ${ids.length} klara)`
      )
    } finally {
      setBusy(false)
      await onChanged()
    }
  }

  // -------------------------------------------------------------------------
  // Fakturaplan (gemet + § 7): avtalen är källan till årspremiefakturan
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    if (papers.length === 0) {
      setBillingPlans([])
      return
    }
    ContractInvoiceGenerator.planCombinedForCustomer(root.id)
      .then((plans) => {
        if (!cancelled) setBillingPlans(plans)
      })
      .catch((err) => {
        console.error('Kunde inte planera fakturor för avtalskartan:', err)
        if (!cancelled) setBillingPlans([])
      })
    return () => {
      cancelled = true
    }
    // papers.length: planen läses om när avtal tillkommer eller försvinner;
    // billingPlansKey bumpas efter varje skrivning som påverkar fakturorna.
  }, [root.id, papers.length, contentReloadKey, billingPlansKey, contracts])

  // § 6: aktiva stationer per kundrad, ur utplaceringarna (ute) och planritningarna (inne)
  const [stationsByCustomer, setStationsByCustomer] = useState<Map<string, { outdoor: number; indoor: number; addon: number }>>(new Map())
  /** Tilläggsstationer per år/månad utan beslutat läge, per enhet och stationstyp */
  const [addonBricksByCustomer, setAddonBricksByCustomer] = useState<Map<string, AddonBrick[]>>(new Map())
  const [stationsKey, setStationsKey] = useState(0)
  const [addonPrompt, setAddonPrompt] = useState<{ x: number; y: number; contract: RecordContract; state: AddonDropPromptState } | null>(null)
  useEffect(() => {
    let cancelled = false
    const ids = [root.id, ...units.map((u) => u.id)]
    if (ids.length === 0) return
    ;(async () => {
      try {
        const [{ data: outdoor }, { data: indoor }] = await Promise.all([
          supabase
            .from('equipment_placements')
            .select('id, customer_id, is_addon, station_type_id, addon_billing_model, addon_contract_mode, station_type:station_types(name)')
            .in('customer_id', ids)
            .eq('status', 'active'),
          supabase
            .from('indoor_stations')
            .select('id, is_addon, station_type_id, addon_billing_model, addon_contract_mode, station_type:station_types(name), floor_plan:floor_plans!inner(customer_id)')
            .eq('status', 'active')
            .in('floor_plan.customer_id', ids),
        ])
        if (cancelled) return
        const map = new Map<string, { outdoor: number; indoor: number; addon: number }>()
        const bricks = new Map<string, AddonBrick>()
        type Row = {
          id: string
          customer_id: string
          is_addon: boolean | null
          station_type_id: string | null
          addon_billing_model: string | null
          addon_contract_mode: string | null
          station_type: { name: string } | { name: string }[] | null
        }
        const typeName = (st: Row['station_type']): string => {
          const s = Array.isArray(st) ? st[0] : st
          return s?.name ?? 'Station'
        }
        const bump = (r: Row, kind: 'outdoor' | 'indoor') => {
          const cur = map.get(r.customer_id) ?? { outdoor: 0, indoor: 0, addon: 0 }
          cur[kind] += 1
          if (r.is_addon) cur.addon += 1
          map.set(r.customer_id, cur)
          // Bricka: per år/månad utan beslutat läge
          if (r.is_addon && (r.addon_billing_model === 'per_year' || r.addon_billing_model === 'per_month') && !r.addon_contract_mode) {
            const key = `${r.customer_id}|${r.station_type_id ?? ''}|${r.addon_billing_model}`
            const b = bricks.get(key) ?? {
              unitId: r.customer_id,
              stationTypeId: r.station_type_id,
              stationTypeName: typeName(r.station_type),
              model: r.addon_billing_model,
              count: 0,
              outdoorIds: [],
              indoorIds: [],
            }
            b.count += 1
            if (kind === 'outdoor') b.outdoorIds.push(r.id)
            else b.indoorIds.push(r.id)
            bricks.set(key, b)
          }
        }
        for (const r of (outdoor ?? []) as unknown as Row[]) bump(r, 'outdoor')
        for (const r of (indoor ?? []) as unknown as Array<Omit<Row, 'customer_id'> & { floor_plan: { customer_id: string } | { customer_id: string }[] | null }>) {
          const fp = Array.isArray(r.floor_plan) ? r.floor_plan[0] : r.floor_plan
          if (fp?.customer_id) bump({ ...r, customer_id: fp.customer_id }, 'indoor')
        }
        const byCustomer = new Map<string, AddonBrick[]>()
        for (const b of bricks.values()) byCustomer.set(b.unitId, [...(byCustomer.get(b.unitId) ?? []), b])
        setStationsByCustomer(map)
        setAddonBricksByCustomer(byCustomer)
      } catch (err) {
        console.error('Kunde inte räkna stationer för avtalskartan:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [root.id, units, stationsKey])

  /** Brickor för de enheter avtalet täcker */
  const bricksFor = useCallback(
    (contract: RecordContract): AddonBrick[] => {
      const ids = contract.covers_all_sites
        ? locations.map((l) => l.id)
        : [contract.customer_id ?? '', ...(activeScopeByContract.get(contract.id) ?? []).map((cs) => cs.customer_id)]
      const out: AddonBrick[] = []
      for (const id of new Set(ids)) out.push(...(addonBricksByCustomer.get(id) ?? []))
      return out
    },
    [activeScopeByContract, locations, addonBricksByCustomer]
  )

  /**
   * Brickor vars enhet inte täcks av NÅGOT avtal. De renderas annars
   * ingenstans, så tilläggsstationerna blir osynliga och obetalda.
   */
  /** Lokalerna avtalet omfattar, i § 1:s ordning (samma regel som pappret) */
  const coveredLocationsFor = (c: RecordContract): RecordCustomer[] => {
    if (c.covers_all_sites) return locations
    const owner = customerById.get(c.customer_id ?? '')
    const sc = activeScopeByContract.get(c.id) ?? []
    return [
      ...(owner && locations.some((l) => l.id === owner.id) ? [owner] : []),
      ...sc.map((cs) => customerById.get(cs.customer_id)).filter((u): u is RecordCustomer => !!u && u.id !== owner?.id),
    ]
  }
  const orphanBricks = useMemo(() => {
    const covered = new Set<string>()
    for (const p of papers) {
      if (p.covers_all_sites) { locations.forEach((l) => covered.add(l.id)); continue }
      covered.add(p.customer_id ?? '')
      for (const cs of activeScopeByContract.get(p.id) ?? []) covered.add(cs.customer_id)
    }
    const out: AddonBrick[] = []
    for (const [unitId, bricks] of addonBricksByCustomer) {
      if (!covered.has(unitId)) out.push(...bricks)
    }
    return out
  }, [papers, locations, activeScopeByContract, addonBricksByCustomer])

  /** Öppna beslutspopovern för en eller flera brickor på samma avtal */
  const openAddonPrompt = (c: RecordContract, bricks: AddonBrick[], zone: 'premium' | 'equipment', x: number, y: number) => {
    setAddonPrompt({
      x,
      y,
      contract: c,
      state: {
        x,
        y,
        contractLabel: contractDisplayName(c),
        bricks: bricks.map((brick) => {
          const unit = customerById.get(brick.unitId)
          return { brick, unitName: unit ? customerRowName(unit) : 'enhet' }
        }),
        zone,
        annualInForce: c.annual_value != null ? Number(c.annual_value) : null,
      },
    })
  }

  /** Ett beslut per bricka: baka in (§ 7) eller tillägg (§ 6). Kastar vid fel. */
  const confirmAddonBrick = async (item: AddonPromptBrick, input: { effectiveFrom: string; unitPriceAnnual: number }) => {
    if (!addonPrompt) return
    const { contract, state } = addonPrompt
    const b = item.brick
    if (state.zone === 'premium') {
      await ContractScopeService.addAddonStationsToPremium(contract.id, {
        unitId: b.unitId,
        unitName: item.unitName,
        stationTypeId: b.stationTypeId,
        stationTypeName: b.stationTypeName,
        model: b.model,
        count: b.count,
        outdoorIds: b.outdoorIds,
        indoorIds: b.indoorIds,
        unitPriceAnnual: input.unitPriceAnnual,
        effectiveFrom: input.effectiveFrom,
      })
    } else {
      await ContractScopeService.addAddonStationsSeparate(contract.id, {
        unitId: b.unitId,
        unitName: item.unitName,
        stationTypeName: b.stationTypeName,
        model: b.model,
        count: b.count,
        outdoorIds: b.outdoorIds,
        indoorIds: b.indoorIds,
        unitPriceAnnual: input.unitPriceAnnual,
      })
    }
    setDecidedByContract((prev) => ({
      ...prev,
      [contract.id]: {
        count: (prev[contract.id]?.count ?? 0) + b.count,
        kr: (prev[contract.id]?.kr ?? 0) + input.unitPriceAnnual * b.count,
      },
    }))
  }

  /** Alla brickor i popovern beslutade: en toast, en omladdning */
  const addonPromptDone = async (summary: { bricks: number; stations: number; annualKr: number }) => {
    if (!addonPrompt) return
    const { contract, state } = addonPrompt
    const name = contractDisplayName(contract)
    if (state.zone === 'premium') {
      toast.success(`${summary.stations} st tilläggsstationer inbakade i ${name}: premien höjs med ${formatKr(summary.annualKr)}/år.`)
    } else {
      toast.success(`${summary.stations} st tilläggsstationer ligger nu som tillägg utöver ${name} (§ 6), ${formatKr(summary.annualKr)}/år.`)
    }
    setBusy(true)
    try {
      setStationsKey((k) => k + 1)
      setContentReloadKey((k) => k + 1)
      setBillingPlansKey((k) => k + 1)
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  const changeEquipmentInvoiceMode = async (contract: RecordContract, mode: 'with_premium' | 'separate') => {
    setBusy(true)
    try {
      await ContractScopeService.setEquipmentInvoiceMode(contract.id, mode)
      toast.success(mode === 'separate' ? 'Utrustning i § 6 faktureras nu på egna fakturor.' : 'Utrustning i § 6 ligger nu på premiefakturan.')
      setBillingPlansKey((k) => k + 1)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra faktureringsläge')
    } finally {
      setBusy(false)
    }
  }

  const stationCountFor = useCallback(
    (contract: RecordContract) => {
      const ids = contract.covers_all_sites
        ? locations.map((l) => l.id)
        : [contract.customer_id ?? '', ...(activeScopeByContract.get(contract.id) ?? []).map((cs) => cs.customer_id)]
      const sum = { outdoor: 0, indoor: 0, addon: 0 }
      for (const id of new Set(ids)) {
        const s = stationsByCustomer.get(id)
        if (!s) continue
        sum.outdoor += s.outdoor
        sum.indoor += s.indoor
        sum.addon += s.addon
      }
      return sum
    },
    [activeScopeByContract, locations, stationsByCustomer]
  )

  const invoiceMode: 'per_contract' | 'consolidated' =
    (root as unknown as { contract_invoice_mode?: string | null }).contract_invoice_mode === 'consolidated'
      ? 'consolidated'
      : 'per_contract'

  /** Planens rader per avtal, för § 7 (samlade rader räknas till varje avtal de bär) */
  const planEntriesByContract = useMemo(() => {
    const map = new Map<string, PremiumPlanEntry[]>()
    for (const plan of billingPlans) {
      for (const e of plan.entries) {
        if (!e.planned) continue
        const ids = new Set<string>()
        if (e.contractId) ids.add(e.contractId)
        else if (plan.contractId) ids.add(plan.contractId)
        for (const r of e.rows ?? []) if (r.contract_id) ids.add(r.contract_id)
        const entry: PremiumPlanEntry = {
          action: e.action,
          kind: e.kind ?? 'premium',
          periodStart: e.planned.periodStart,
          periodEnd: e.planned.periodEnd,
          subtotal: e.planned.subtotal,
          invoiceDate: e.planned.invoiceDate,
          dueDate: e.planned.dueDate,
          existingStatus: e.existingStatus ?? null,
          consolidated: e.consolidated ?? plan.consolidated ?? false,
          reason: e.reason,
          rows: e.rows?.map((r) => ({ name: r.article_name, quantity: r.quantity, unit_price: r.unit_price, total_price: r.total_price })),
        }
        for (const id of ids) map.set(id, [...(map.get(id) ?? []), entry])
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    return map
  }, [billingPlans])

  const planTotals = useMemo(() => {
    const merged = billingPlans.length ? ContractInvoiceGenerator.mergePlans(root.id, billingPlans) : null
    const today = todayKey()
    const next = merged?.entries
      .filter((e) => e.planned && e.planned.periodStart > today && e.action !== 'uncovered' && e.action !== 'delete')
      .sort((a, b) => a.planned!.periodStart.localeCompare(b.planned!.periodStart))[0]
    return {
      changes: merged ? merged.summary.create + merged.summary.update + merged.summary.delete : 0,
      uncovered: merged?.summary.uncovered ?? 0,
      next: next?.planned ?? null,
    }
  }, [billingPlans, root.id])

  const annualSum = useMemo(
    () => papers.reduce((s, c) => s + (contractEffectiveAnnualValue(c, premiumByContract.get(c.id) ?? []) ?? 0), 0),
    [papers, premiumByContract]
  )

  const setInvoiceMode = async (mode: 'per_contract' | 'consolidated') => {
    if (mode === invoiceMode) return
    setBusy(true)
    try {
      await ContractScopeService.setContractInvoiceMode(root.id, mode)
      toast.success(
        mode === 'consolidated'
          ? 'Årspremierna faktureras nu på en samlad faktura, en rad per avtal. Planera fakturorna för att byta ut befintliga utkast.'
          : 'Varje avtal faktureras nu för sig. Planera fakturorna för att byta ut befintliga utkast.'
      )
      await onChanged()
      setBillingPlansKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra faktureringsläge')
    } finally {
      setBusy(false)
    }
  }

  const openPlanPreview = async () => {
    setPlanLoading(true)
    setPlanPreviewOpen(true)
    try {
      const plans = await ContractInvoiceGenerator.planCombinedForCustomer(root.id)
      setBillingPlans(plans)
      const merged = ContractInvoiceGenerator.mergePlans(root.id, plans)
      setPlanPreview(merged)
      if (merged.summary.create + merged.summary.update + merged.summary.delete + merged.summary.historical === 0) {
        setPlanPreviewOpen(false)
        setPlanPreview(null)
        toast.success(
          merged.summary.uncovered > 0
            ? `Fakturorna stämmer redan. ${merged.summary.uncovered} passerad period saknar faktura i portalen, koppla den från § 7.`
            : 'Fakturorna stämmer redan med avtalen.'
        )
      }
    } catch (err) {
      setPlanPreviewOpen(false)
      toast.error(err instanceof Error ? err.message : 'Kunde inte beräkna fakturaplanen')
    } finally {
      setPlanLoading(false)
    }
  }

  const applyPlanPreview = async () => {
    if (!planPreview) return
    setBusy(true)
    try {
      const r = await ContractInvoiceGenerator.apply(planPreview)
      toast.success(`Fakturor: ${r.createdIds.length} nya, ${r.updatedIds.length} uppdaterade, ${r.deletedIds.length} borttagna.`)
      setPlanPreviewOpen(false)
      setPlanPreview(null)
      await onChanged()
      setBillingPlansKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte applicera fakturaplanen')
    } finally {
      setBusy(false)
    }
  }

  const indexAll = async (input: { effectiveFrom: string; percent: number; note: string | null; includeEquipment: boolean }) => {
    setBusy(true)
    try {
      const r = await ContractScopeService.indexAllContracts(root.id, input)
      toast.success(
        `${r.indexed} avtal indexerade med ${input.percent.toLocaleString('sv-SE')} % från ${formatDateSv(input.effectiveFrom)}${
          r.skipped ? ` (${r.skipped} utan premie hoppades över)` : ''
        }. Klicka "Planera fakturor" och uppdatera de planerade fakturorna, annars träder indexeringen inte i kraft på dem.`
      )
      setIndexAllOpen(false)
      await onChanged()
      setBillingPlansKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte indexera avtalen')
    } finally {
      setBusy(false)
    }
  }

  const changeLineBillingModel = async (contract: RecordContract, item: CaseBillingItemWithRelations, model: 'premium' | 'per_year' | 'per_month' | 'per_round') => {
    try {
      await ContractScopeService.setLineBillingModel(contract.id, item.id, model, item.service_name ?? item.article_name)
      toast.success(`${item.service_name ?? item.article_name}: ${model === 'per_year' ? 'per styck och år' : model === 'per_round' ? 'per kontrollrunda' : 'ingår i premien'}.`)
      setContentReloadKey((k) => k + 1)
      setBillingPlansKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra faktureringsläge')
      throw err
    }
  }

  const openLinkFortnox = (
    contract: RecordContract,
    period: { periodStart: string; periodEnd: string; expectedSubtotal: number | null; kind?: string }
  ) => {
    // Tilläggsfakturor (kind equipment) är alltid per avtal, aldrig samlade
    const isEquipment = period.kind === 'equipment' || period.kind === 'equipment_monthly'
    const consolidated = !isEquipment && invoiceMode === 'consolidated' && papers.length > 1
    setFortnoxTarget({
      customerId: root.id,
      customerName: customerRowName(root),
      contractId: consolidated ? null : contract.id,
      contractLabel: consolidated ? null : contractDisplayName(contract),
      coveredContractIds: consolidated ? papers.map((p) => p.id) : undefined,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      expectedSubtotal: period.expectedSubtotal,
      kind: isEquipment ? 'equipment' : 'premium',
    })
  }

  const deleteContract = async (contract: RecordContract) => {
    setDeletePrompt(null)
    setBusy(true)
    try {
      await ContractScopeService.deleteContract(contract.id)
      toast.success(`${contractDisplayName(contract)} raderat.`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte radera avtalet')
    } finally {
      setBusy(false)
    }
  }

  const saveFrequency = async (
    contract: RecordContract,
    frequency: string | null,
    visitsPerYear: number | null
  ) => {
    setFrequencyPrompt(null)
    setBusy(true)
    try {
      await ContractScopeService.setVisitFrequency(contract.id, frequency, visitsPerYear)
      toast.success(
        frequency
          ? `Besöksfrekvens sparad${visitsPerYear ? ` — ${visitsPerYear} besök/år` : ''}. Syns nu vid schemaläggning.`
          : 'Avtalet har ingen fast besöksfrekvens.'
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara besöksfrekvensen')
    } finally {
      setBusy(false)
    }
  }

  const changeContractType = async (contract: RecordContract, typeName: string) => {
    setBusy(true)
    try {
      await ContractScopeService.setContractType(contract.id, typeName)
      toast.success(`Avtalstyp satt till ${typeName}.`)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra avtalstyp')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Befordra en importrest till ett riktigt avtal med RADENS egen data.
   * Kunder med flera avtal över tid har en importrest per avtal — kundkortet
   * bär bara ett av dem, så "skapa från kundkortet" ger fel avtal.
   */
  const promoteImported = async (imported: RecordContract) => {
    setBusy(true)
    try {
      await ContractScopeService.createFromImportedContract(imported.id)
      toast.success(
        `Avtal skapat från ${contractDisplayName(imported)} — belopp, datum och historik följde med.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skapa avtalet')
    } finally {
      setBusy(false)
    }
  }

  const terminateContract = async (contract: RecordContract, endDate: string, reason: string | null) => {
    setTerminatePrompt(null)
    setBusy(true)
    try {
      await ContractScopeService.terminateContract(contract.id, endDate, reason)
      toast.success(
        endDate < todayKey()
          ? `${contractDisplayName(contract)} är avslutat (gällde t.o.m. ${formatDateSv(endDate)}).`
          : `${contractDisplayName(contract)} uppsagt — löper till ${formatDateSv(endDate)}.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte säga upp avtalet')
    } finally {
      setBusy(false)
    }
  }

  const reactivate = async (contract: RecordContract) => {
    setBusy(true)
    try {
      await ContractScopeService.reactivateContract(contract.id)
      toast.success(
        `${contractDisplayName(contract)} är aktivt igen — scheman återupptagna och avbokade besök återställda.`
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte återaktivera avtalet')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Vem som sade upp avtalet. contracts saknar terminated_by-kolumn, så namnet
   * härleds ur uppsägningshändelsen i tidslinjen. Saknas den returneras null
   * och frasen utelämnas helt — skriv aldrig "okänd".
   */
  const terminatedByFor = useCallback(
    (contractId: string): string | null => {
      const ev = contractEvents
        .filter(
          (e) =>
            e.contract_id === contractId &&
            (e.title === 'Avtalet uppsagt' || e.title === 'Avtalet avslutat')
        )
        .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))[0]
      const name = ev?.created_by_name ?? null
      // Cron-jobbet som stänger utlöpta avtal är ingen person
      if (!name || name.startsWith('System')) return null
      return name
    },
    [contractEvents]
  )

  /**
   * Förnya ett avslutat avtal: öppna avtalswizzarden förifylld med det gamla
   * avtalets uppgifter, så ett nytt förslag kan skickas till kunden via
   * Oneflow. Det gamla avtalet ligger kvar orört som historik — en förnyelse
   * är en NY period, inte samma avtal återupplivat.
   */
  const renewContract = async (contract: RecordContract) => {
    setBusy(true)
    try {
      const prefill = await buildRenewalPrefill(contract.id)
      sessionStorage.setItem('prefill_customer_data', JSON.stringify(prefill))
      if (prefill.templateSource === 'none') {
        toast('Det gamla avtalet saknar Oneflow-mall — välj mall i steg 2.', {
          icon: '📄',
          duration: 6000,
        })
      } else if (prefill.templateSource === 'derived') {
        toast('Mallen är härledd ur avtalstypen — kontrollera att den stämmer.', {
          icon: '📄',
          duration: 6000,
        })
      }
      // Avtalskartan renderas bara under /admin, så rutten är fast här.
      navigate('/admin/skapa-avtal?prefill=contract')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte förbereda förnyelsen')
    } finally {
      setBusy(false)
    }
  }

  const changePriceList = async (contract: RecordContract, priceListId: string | null) => {
    setPricePrompt(null)
    if ((contract.price_list_id ?? null) === priceListId) return
    setBusy(true)
    try {
      const previous = contract.price_list_id ?? null
      await ContractScopeService.setPriceList(contract.id, priceListId, {
        from: priceListName(contract.price_list_id),
        to: priceListName(priceListId),
      })
      undoToast(
        priceListId
          ? `Prislistan för ${contractDisplayName(contract)} är nu ${priceListName(priceListId) ?? 'uppdaterad'} — gäller nya ärenden direkt.`
          : `Prislistan togs bort från ${contractDisplayName(contract)} — kundens prislista gäller.`,
        async () => {
          await ContractScopeService.setPriceList(contract.id, previous, { from: priceListName(priceListId), to: priceListName(previous) })
          await onChanged()
        }
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte byta prislista')
    } finally {
      setBusy(false)
    }
  }

  // "Lägg till enhet": uppgradera HK till multisite först om det behövs,
  // annars skriver SiteModal organization_id = null och enheten tappas av
  // organisationsvyerna.
  const openAddUnit = async () => {
    if (!root.organization_id) {
      setBusy(true)
      try {
        const { error } = await supabase
          .from('customers')
          .update({ is_multisite: true, site_type: 'huvudkontor', organization_id: crypto.randomUUID() })
          .eq('id', root.id)
        if (error) throw new Error(error.message)
        await onChanged()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Kunde inte förbereda organisationen')
        setBusy(false)
        return
      }
      setBusy(false)
    }
    setSiteModalOpen(true)
  }

  /**
   * Kundansvarig följer AVTALET och dess omfattning — kunden kan ha två avtal
   * med olika ansvariga för olika enheter. Speglas därför bara till kundraden
   * avtalet bor på + enheterna i § 1 Omfattning, aldrig hela familjen.
   */
  const saveAccountManager = async (
    contract: RecordContract,
    name: string | null,
    email: string | null
  ) => {
    setBusy(true)
    try {
      const covered = new Set<string>()
      if (contract.customer_id) covered.add(contract.customer_id)
      if (contract.covers_all_sites) {
        locations.forEach((l) => covered.add(l.id))
      } else {
        for (const cs of activeScopeByContract.get(contract.id) ?? []) covered.add(cs.customer_id)
      }
      await ContractScopeService.setAccountManager(contract.id, name, email, [...covered])
      toast.success(
        name
          ? `Kundansvarig för ${contractDisplayName(contract)} är nu ${name} — gäller enheterna i avtalets omfattning.`
          : 'Kundansvarig borttagen från avtalet.'
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara kundansvarig')
    } finally {
      setBusy(false)
    }
  }

  // -------------------------------------------------------------------------
  // Uppföljningsdata (§ 3)
  // -------------------------------------------------------------------------

  const followupFor = useCallback(
    (
      contract: RecordContract
    ): {
      nextVisit: RecordInspectionSession | null
      visitsDone: number
      visitsBooked: number
      casesDone: number
      casesOpen: number
      casesTotal: number
      covered: string[]
      caseIds: string[]
      units: UnitFollowup[]
    } => {
      // Täckta kundrader: avtalets egen rad + omfattningen (eller alla enheter
      // när avtalet täcker hela verksamheten)
      const covered = (
        contract.covers_all_sites
          ? [contract.customer_id as string, ...locations.map((l) => l.id)]
          : [
              contract.customer_id as string,
              ...(activeScopeByContract.get(contract.id) ?? []).map((cs) => cs.customer_id),
            ]
      )
        .filter(Boolean)
        .filter((id, i, arr) => arr.indexOf(id) === i)
      const coveredSet = new Set(covered)

      // Kontrollbesök: exakt avtalskoppling när sessionen har contract_id,
      // annars fallback på kundrad (äldre sessioner som inte kunnat kopplas).
      const visits = inspections.filter((s) =>
        s.contract_id ? s.contract_id === contract.id : coveredSet.has(s.customer_id)
      )
      const visitsDone = visits.filter((s) => s.completed_at).length
      const booked = visits.filter((s) => !s.completed_at && s.scheduled_at)
      const key = todayKey()
      const nextVisit =
        booked
          .filter((s) => (s.scheduled_at as string).slice(0, 10) >= key)
          .sort((a, b) => (a.scheduled_at as string).localeCompare(b.scheduled_at as string))[0] ?? null

      const list = cases.filter((c) => c.contract_id === contract.id || (c.customer_id && coveredSet.has(c.customer_id)))
      const casesDone = list.filter((c) => c.completed_date || isCompletedStatus(c.status as ClickUpStatus)).length

      // § 3 per enhet: driftläge, takt, utfall i avtalsåret och nästa besök.
      // Avtalsåret räknas från senaste årsdagen av avtalsstarten (annars 1 jan).
      const start = contract.contract_start_date ?? contract.start_date ?? null
      let yearStart = `${key.slice(0, 4)}-01-01`
      if (start) {
        const anniversary = `${key.slice(0, 4)}${start.slice(4)}`
        yearStart = anniversary <= key ? anniversary : `${Number(key.slice(0, 4)) - 1}${start.slice(4)}`
      }
      const daysIntoYear = Math.max(
        1,
        Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${yearStart}T12:00:00`).getTime()) / 86400000)
      )
      const scopeRows = activeScopeByContract.get(contract.id) ?? []
      const unitIdsForRows = contract.covers_all_sites
        ? locations.map((l) => l.id)
        : [
            ...(locationIds.has(contract.customer_id ?? '') ? [contract.customer_id as string] : []),
            ...scopeRows.map((cs) => cs.customer_id),
          ].filter((id, i, arr) => arr.indexOf(id) === i)
      const units: UnitFollowup[] = unitIdsForRows.map((unitId) => {
        const scope = scopeRows.find((cs) => cs.customer_id === unitId) ?? null
        const serviceMode: 'inspection' | 'on_demand' = scope?.service_mode === 'on_demand' ? 'on_demand' : 'inspection'
        const frequency = scope?.visit_frequency ?? contract.visit_frequency ?? null
        const plan =
          scope?.visits_per_year ??
          contract.visits_per_year ??
          (frequency ? (VISITS_PER_YEAR_BY_FREQUENCY[frequency] ?? null) : null)
        const unitVisits = visits.filter((s) => s.customer_id === unitId)
        const doneThisYear = unitVisits.filter((s) => s.completed_at && (s.completed_at as string).slice(0, 10) >= yearStart).length
        const nextUnit =
          unitVisits
            .filter((s) => !s.completed_at && s.scheduled_at && (s.scheduled_at as string).slice(0, 10) >= key)
            .sort((a, b) => (a.scheduled_at as string).localeCompare(b.scheduled_at as string))[0] ?? null
        const unitCases = list.filter((c) => c.customer_id === unitId)
        return {
          unitId,
          scopeRowId: scope?.id ?? null,
          serviceMode,
          frequency,
          visitsPerYear: plan,
          inherited: !scope?.visit_frequency && !scope?.visits_per_year,
          expectedSoFar: plan ? Math.min(plan, Math.round((plan * daysIntoYear) / 365)) : null,
          doneThisYear,
          nextVisitAt: nextUnit?.scheduled_at ?? null,
          casesThisYear: unitCases.filter((c) => (c.completed_date ?? c.created_at).slice(0, 10) >= yearStart).length,
        }
      })

      return {
        nextVisit,
        visitsDone,
        visitsBooked: booked.length,
        casesDone,
        casesOpen: list.length - casesDone,
        casesTotal: list.length,
        covered,
        caseIds: list.map((c) => c.id),
        units,
      }
    },
    [activeScopeByContract, cases, inspections, locations, locationIds]
  )

  /** Kompletthetens underlag utom marginalen (pappret och panelen fyller i den) */
  const completenessBaseFor = (c: RecordContract): Omit<CompletenessInput, 'breakdown'> => ({
    contract: c,
    scope: activeScopeByContract.get(c.id) ?? [],
    isAvrop: c.contract_type === 'Avropsavtal' || c.label === 'Avropsavtal',
    isUnitContract: !isSingleSite && unitIds.has(c.customer_id ?? ''),
    followupUnits: followupFor(c).units,
    pendingBricks: bricksFor(c).length,
    uncoveredPeriods: (planEntriesByContract.get(c.id) ?? []).filter((e) => e.action === 'uncovered').length,
    coveredUnits: coveredLocationsFor(c),
  })
  const incompletePapers = papers.filter((c) => !computeCompleteness({ ...completenessBaseFor(c), breakdown: null }).complete).length

  // Uppgiften "tillägg att besluta": brickor per papper, kundens kr/år ur
  // samma RPC som listan och notisen, och kön mellan avtalen.
  const papersWithBricks = papers.filter((c) => bricksFor(c).length > 0)
  const pendingStations = papersWithBricks.reduce((sum, c) => sum + bricksFor(c).reduce((s2, b) => s2 + b.count, 0), 0)
  if (pendingStations > 0) hadBricksRef.current = true
  const addonSummary = addonPendingRows.find((r) => r.root_customer_id === root.id) ?? null
  const decidedTotal = Object.values(decidedByContract).reduce((acc, d) => ({ count: acc.count + d.count, kr: acc.kr + d.kr }), { count: 0, kr: 0 })
  const nextBricksAfter = (contractId: string | null) => {
    const others = papersWithBricks.filter((c) => c.id !== contractId)
    const c = others[0]
    return c ? { contractId: c.id, label: contractDisplayName(c), count: bricksFor(c).reduce((s2, b) => s2 + b.count, 0) } : null
  }
  const openBricks = (c: RecordContract) => {
    openSettings(c, 'innehall')
    focusParaSix(c.id)
  }

  // ?panel=innehall (från notisen eller kundlistans "tillägg att besluta"):
  // öppna panelen på första pappret som har brickor, annars första pappret.
  const panelFromUrl = useRef(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('panel') : null)
  useEffect(() => {
    const wanted = panelFromUrl.current
    if (!wanted || papers.length === 0) return
    panelFromUrl.current = null
    const group = SETTINGS_GROUPS.includes(wanted as SettingsGroup) ? (wanted as SettingsGroup) : 'innehall'
    const target = papers.find((c) => bricksFor(c).length > 0) ?? papers[0]
    setSettingsPanel({ contractId: target.id, group, tab: 'settings' })
    if (group === 'innehall') focusParaSix(target.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers.length])

  const saveSitePlan = async (
    contract: RecordContract,
    unit: UnitFollowup,
    input: { serviceMode: 'inspection' | 'on_demand'; frequency: string | null; visitsPerYear: number | null }
  ) => {
    if (!unit.scopeRowId) {
      toast.error('Enheten står inte i § 1 Omfattning på det här avtalet. Besökstakten sätts på avtalet i § 3.')
      return
    }
    setBusy(true)
    try {
      await ContractScopeService.setSiteVisitPlan(contract.id, unit.scopeRowId, input, customerRowName(customerById.get(unit.unitId) ?? root))
      toast.success(
        input.serviceMode === 'on_demand'
          ? `${customerRowName(customerById.get(unit.unitId) ?? root)} arbetar på avrop. Inget schema förväntas.`
          : `Besökstakt sparad för ${customerRowName(customerById.get(unit.unitId) ?? root)}.`
      )
      setSitePlanPrompt(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara enhetens besöksplan')
    } finally {
      setBusy(false)
    }
  }

  const saveRenewal = async (
    contract: RecordContract,
    input: { renewalMode: 'rolling' | 'fixed' | 'option'; optionUntil: string | null; optionDecisionDeadline: string | null; reminderDays: number | null }
  ) => {
    try {
      await ContractScopeService.setRenewal(contract.id, input)
      toast.success(
        input.renewalMode === 'option'
          ? 'Option registrerad. Kundansvarig påminns före beslutsdatumet.'
          : input.renewalMode === 'fixed'
            ? 'Fast slutdatum med påminnelse registrerat.'
            : 'Avtalet löper vidare tills det sägs upp.'
      )
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara förlängningsläget')
      throw err
    }
  }

  const exerciseOption = async (contract: RecordContract) => {
    try {
      const newEnd = await ContractScopeService.exerciseOption(contract.id)
      toast.success(`Option nyttjad: ${contractDisplayName(contract)} gäller nu till ${formatDateSv(newEnd)}. Planera fakturorna för nästa period.`)
      await onChanged()
      setBillingPlansKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte nyttja optionen')
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hoverMatch = (unitId: string, contractId: string): 'hot' | 'dim' | 'normal' => {
    if (!hover) return 'normal'
    const match = hover.kind === 'unit' ? hover.id === unitId : hover.id === contractId
    return match ? 'hot' : 'dim'
  }

  const dragSourceUnitId = drag?.started ? unitIdOf(drag.payload) : null

  return (
    // Panelen ligger som slide-over utanför sidans max-width. På breda skärmar
    // finns tomrum utanför containern, så kartan skjuts åt vänster (relative,
    // inte transform: transform skulle ankra fixed-popovers fel) och pappret
    // hamnar aldrig under panelen. På 1280 px täcker panelen högerkanten.
    <div
      className={`transition-[left] duration-200 ${
        settingsPanel ? 'xl:relative xl:-left-[120px] 2xl:-left-[240px]' : ''
      }`}
    >
      {/* Uppgiftsremsa: tillägg att besluta. Beskriver en uppgift med ett
          slut, till skillnad från sammanfattningen som beskriver tillståndet.
          Försvinner när sista brickan är beslutad, då står kvittensen kvar
          tills man lämnar fliken. */}
      {pendingStations > 0 && (() => {
        const current = papersWithBricks.find((c) => c.id === settingsPanel?.contractId) ?? papersWithBricks[0]
        const idx = papersWithBricks.findIndex((c) => c.id === current.id)
        const here = bricksFor(current).reduce((s2, b) => s2 + b.count, 0)
        const rest = papersWithBricks.filter((c) => c.id !== current.id)
        return (
          <div className="mb-3 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-amber-200">
                {pendingStations} tillägg att besluta
                {addonSummary && addonSummary.annual_kr > 0 && <> · {formatKr(addonSummary.annual_kr)}/år</>}
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                Tekniker har satt ut stationer utöver avtalet. Bestäm per rad om de ska faktureras som tillägg eller bakas in i premien.
              </div>
              <div className="text-[11px] text-amber-200/70 mt-0.5 tabular-nums">
                Avtal {idx + 1} av {papersWithBricks.length} · {here} här
                {rest.map((c) => (
                  <span key={c.id}>, {bricksFor(c).reduce((s2, b) => s2 + b.count, 0)} på {contractDisplayName(c)}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openBricks(current)}
              className="shrink-0 text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110"
            >
              Öppna § 6
            </button>
          </div>
        )
      })()}
      {pendingStations === 0 && hadBricksRef.current && decidedTotal.count > 0 && (
        <div className="mb-3 px-3 py-2 rounded-xl border border-[#20c58f]/35 bg-[#20c58f]/5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-white">Alla tillägg beslutade</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {formatKr(decidedTotal.kr)}/år på {Object.keys(decidedByContract).length} avtal. Fakturaunderlaget uppdateras vid nästa period.
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`${window.location.pathname.split('/befintliga-kunder')[0]}/befintliga-kunder?quick=atgard`)}
            className="shrink-0 text-[12px] px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f]"
          >
            Tillbaka till Kräver åtgärd
          </button>
        </div>
      )}

      {/* Sammanfattning */}
      <div className="flex flex-wrap gap-6 bg-slate-800/30 border border-slate-700 rounded-2xl px-4 py-3 mb-5 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Aktiva avtal</div>
          <div className="text-lg font-bold tabular-nums">{papers.length}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            {isSingleSite ? 'Täckt lokal' : 'Täckta enheter'}
          </div>
          <div className={`text-lg font-bold tabular-nums ${uncoveredUnits.length ? 'text-amber-400' : 'text-[#20c58f]'}`}>
            {locations.length - uncoveredUnits.length} av {locations.length}
          </div>
        </div>
        {/* Uppsagda avtal som fortfarande löper — de ingår i "Aktiva avtal"
            eftersom de faktureras och schemaläggs till sista giltiga dagen,
            men det ska synas att de tar slut. */}
        {terminatedRunningCount > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Uppsagda, löper ut</div>
            <div className="text-lg font-bold tabular-nums text-amber-400">{terminatedRunningCount}</div>
          </div>
        )}
        {endedCount > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Avslutade avtal</div>
            <div className="text-lg font-bold tabular-nums text-slate-500">{endedCount}</div>
          </div>
        )}
        {/* Ersatta importrester är INTE avslutade avtal — det är samma avtal i
            sin gamla form. Egen ruta så de inte blåser upp avslutade-siffran. */}
        {replacedLeftovers > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Ersatta importrester</div>
            <div className="text-lg font-bold tabular-nums text-slate-600">{replacedLeftovers}</div>
          </div>
        )}
        <p className="ml-auto self-center text-xs text-slate-500 max-w-md">
          Dra en enhet in i ett avtal för att skriva in den i omfattningen. Ändringar sparas direkt i databasen.
        </p>
      </div>

      <div
        ref={boardRef}
        className="relative grid grid-cols-1 gap-10 items-start lg:grid-cols-[290px_1fr]"
      >
        {/* Kopplingslinjer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block" aria-hidden>
          {wires.map((w) => {
            const state = hoverMatch(w.unitId, w.contractId)
            return (
              <g key={w.key}>
                <path
                  d={w.d}
                  fill="none"
                  stroke={w.color}
                  strokeWidth={state === 'hot' ? 3 : 2}
                  opacity={state === 'hot' ? 1 : state === 'dim' ? 0.08 : 0.4}
                />
                <circle cx={w.ex} cy={w.ey} r="3.5" fill={w.color} opacity={state === 'dim' ? 0.15 : 1} />
              </g>
            )
          })}
          {drag?.started && dragSourceUnitId && boardRef.current && (() => {
            const uEl = unitRefs.current.get(dragSourceUnitId)
            if (!uEl) return null
            const bRect = boardRef.current.getBoundingClientRect()
            const uRect = uEl.getBoundingClientRect()
            const sx = uRect.right - bRect.left
            const sy = uRect.top + uRect.height / 2 - bRect.top
            const tx = drag.x - bRect.left
            const ty = drag.y - bRect.top
            const mx = (sx + tx) / 2
            return (
              <path
                d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                fill="none"
                stroke="#20c58f"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                opacity="0.9"
              />
            )
          })()}
          {drag?.started && drag.payload.type === 'org' && boardRef.current && orgRef.current && (() => {
            const bRect = boardRef.current.getBoundingClientRect()
            const uRect = orgRef.current.getBoundingClientRect()
            const sx = uRect.right - bRect.left
            const sy = uRect.top + uRect.height / 2 - bRect.top
            const tx = drag.x - bRect.left
            const ty = drag.y - bRect.top
            const mx = (sx + tx) / 2
            return (
              <path
                d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                fill="none"
                stroke="#20c58f"
                strokeWidth="2.5"
                strokeDasharray="6 5"
                opacity="0.9"
              />
            )
          })()}
        </svg>

        {/* Vänster: verksamheten */}
        <aside
          data-drop-zone="aside"
          className={`relative z-10 bg-slate-800/30 border rounded-2xl p-4 lg:sticky lg:top-4 transition-colors ${
            drag?.started && drag.payload.type === 'scoperow'
              ? drag.overAside
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-amber-400/40'
              : 'border-slate-700'
          }`}
        >
          <div className="flex items-center gap-4 border-b border-slate-700 mb-3">
            {(['units', 'catalog'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRailTab(t)}
                className={`pb-2 text-[11px] uppercase tracking-wider font-semibold border-b-2 -mb-px transition-colors ${
                  railTab === t ? 'text-slate-100 border-[#20c58f]' : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {t === 'units' ? 'Verksamheten' : 'Katalog'}
              </button>
            ))}
            {drag?.started && drag.payload.type === 'scoperow' && (
              <span className="ml-auto pb-2 text-[10px] normal-case tracking-normal text-amber-300 font-medium">släpp här för att avsluta täckningen</span>
            )}
          </div>

          {railTab === 'units' && (
          <>
          {units.length > 0 && (
            <div
              ref={orgRef}
              onPointerDown={(e) => startDrag(e, { type: 'org' })}
              className="flex items-start gap-2.5 rounded-xl border border-[#20c58f]/45 bg-gradient-to-br from-[#20c58f]/15 to-transparent px-3 py-2.5 mb-2 cursor-grab select-none touch-none hover:border-[#20c58f] transition-colors"
            >
              <span className="shrink-0 w-9 h-9 rounded-lg grid place-items-center bg-[#20c58f]/15 border border-[#20c58f]/40">
                <Building2 className="w-4.5 h-4.5 text-[#20c58f]" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-100">Hela verksamheten</div>
                <div className="text-[11px] text-slate-400">Dra in i ett avtal → alla enheter skrivs in</div>
              </div>
            </div>
          )}

          {units.length > 0 && <hr className="border-slate-700/50 my-3" />}

          <div className="space-y-2">
            {locations.map((u) => {
              const cov = coverage.get(u.id) ?? []
              const uncovered = cov.length === 0
              return (
                <div
                  key={u.id}
                  ref={(el) => {
                    if (el) unitRefs.current.set(u.id, el)
                    else unitRefs.current.delete(u.id)
                  }}
                  onPointerDown={(e) => startDrag(e, { type: 'unit', unitId: u.id })}
                  onMouseEnter={() => setHover({ kind: 'unit', id: u.id })}
                  onMouseLeave={() => setHover(null)}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-grab select-none touch-none transition-all hover:-translate-y-px hover:shadow-lg hover:shadow-black/30 ${
                    dragSourceUnitId === u.id ? 'opacity-40' : ''
                  } ${
                    uncovered
                      ? 'border-amber-400/50 bg-slate-800/60 hover:border-amber-400'
                      : 'border-slate-700 bg-slate-800/60 hover:border-[#20c58f]'
                  }`}
                >
                  <span
                    className={`shrink-0 w-9 h-9 rounded-lg grid place-items-center border ${
                      uncovered ? 'bg-amber-400/10 border-amber-400/40' : 'bg-slate-700/40 border-slate-700'
                    }`}
                  >
                    <Home className={`w-4 h-4 ${uncovered ? 'text-amber-400' : 'text-slate-400'}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-200 truncate">
                      {isSingleSite ? u.company_name : customerRowName(u)}
                    </div>
                    {isSingleSite && (
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                        Kundens lokal
                      </div>
                    )}
                    {uncovered ? (
                      <div className="text-[11px] text-amber-300">Ingen avtalstäckning — dra in i ett avtal</div>
                    ) : (
                      <div className="space-y-0.5 mt-0.5">
                        {cov.map((c) => (
                          <div key={c.id} className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                            <span
                              className="w-2 h-2 rounded-[3px] shrink-0"
                              style={{ background: accentByContract.get(c.id) }}
                            />
                            {contractDisplayName(c)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 self-center">
                    {uncovered ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#20c58f]" />
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {isSingleSite && (
            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              Kunden har en lokal. Lägg till enheter först om verksamheten ska delas upp per plats.
            </p>
          )}

          {uncoveredUnits.length > 0 && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <b>{uncoveredUnits.map((u) => customerRowName(u)).join(', ')}</b> saknar avtalstäckning.
              </span>
            </div>
          )}

          <button
            onClick={openAddUnit}
            disabled={busy}
            className="mt-3 w-full flex items-center justify-center gap-2 border-[1.5px] border-dashed border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 hover:border-[#20c58f] hover:text-[#20c58f] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Lägg till enhet
          </button>
          </>
          )}

          {/* Katalogen: systemets prislistor, tjänster och utrustning. Dras in
              i § 2, § 4 och § 6 på ett papper, eller in i panelen. Systemkatalog,
              inte kundinnehåll, så regeln "inget kundnivå-innehåll i
              Verksamhetspanelen" håller. Egen flik, lika synlig som enheterna. */}
          {railTab === 'catalog' && (
            <div>
              <p className="text-[11px] text-slate-500 mb-2">Dra in på ett avtal: prislistor till § 2, tjänster till § 4, utrustning till § 6.</p>
              {papers.length === 0 && <p className="text-[11px] text-slate-500 italic">Skapa ett avtal först.</p>}
              <div className="pb-1">
                <div className="flex gap-1 mb-2">
                  {(['pricelist', 'service', 'equipment'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setCatalogTab(tab)}
                      className={`text-[11px] font-semibold rounded-lg px-2.5 py-1 transition-colors ${
                        catalogTab === tab ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {tab === 'pricelist' ? 'Prislistor' : tab === 'service' ? 'Tjänster' : 'Utrustning'}
                    </button>
                  ))}
                </div>
                {catalogTab !== 'pricelist' && (
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Sök…"
                    className="w-full mb-2 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#20c58f] focus:outline-none"
                  />
                )}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {catalogTab === 'pricelist' &&
                    priceLists.map((pl) => (
                      <div
                        key={pl.id}
                        onPointerDown={(e) => startDrag(e, { type: 'catalog', kind: 'pricelist', id: pl.id, name: pl.name })}
                        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 cursor-grab select-none touch-none hover:border-[#20c58f]"
                      >
                        <span className="truncate">{pl.name}</span>
                        {pl.is_default && <span className="ml-auto text-[10px] text-slate-500">standard</span>}
                      </div>
                    ))}
                  {catalogTab === 'service' &&
                    catalog.services
                      .filter((s) => !s.is_contract_service && !s.is_addon_service && !s.used_for_addon_stations)
                      .filter((s) => !catalogSearch || s.name.toLowerCase().includes(catalogSearch.toLowerCase()) || (s.code ?? '').includes(catalogSearch))
                      .slice(0, 60)
                      .map((s) => (
                        <div
                          key={s.id}
                          onPointerDown={(e) => startDrag(e, { type: 'catalog', kind: 'service', id: s.id, name: s.name, code: s.code, basePrice: s.base_price })}
                          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 cursor-grab select-none touch-none hover:border-[#20c58f]"
                        >
                          <span className="text-[10px] text-slate-500 tabular-nums w-7 shrink-0">{s.code}</span>
                          <span className="truncate">{s.name}</span>
                          {s.base_price != null && <span className="ml-auto text-[10px] text-slate-500 tabular-nums whitespace-nowrap">{formatKr(s.base_price)}</span>}
                        </div>
                      ))}
                  {catalogTab === 'equipment' && (
                    <>
                      {catalog.services
                        .filter((s) => s.is_addon_service || s.used_for_addon_stations)
                        .filter((s) => !catalogSearch || s.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                        .map((s) => (
                          <div
                            key={s.id}
                            onPointerDown={(e) => startDrag(e, { type: 'catalog', kind: 'equipment', id: s.id, name: s.name, code: s.code, basePrice: s.base_price })}
                            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 cursor-grab select-none touch-none hover:border-[#20c58f]"
                          >
                            <span className="text-[10px] text-slate-500 tabular-nums w-7 shrink-0">{s.code}</span>
                            <span className="truncate">{s.name}</span>
                            <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">per år</span>
                          </div>
                        ))}
                      {catalog.stationTypes
                        .filter((t) => !catalogSearch || t.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                        .map((t) => (
                          <div
                            key={t.id}
                            onPointerDown={(e) => startDrag(e, { type: 'catalog', kind: 'station_type', id: t.id, name: t.name, code: t.code })}
                            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-200 cursor-grab select-none touch-none hover:border-[#20c58f]"
                          >
                            <span className="truncate">{t.name}</span>
                            <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">tilläggsstation, per runda</span>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Höger: avtalsdokumenten */}
        <main className="relative z-10 space-y-6 min-w-0">
          {/* Gemet: hur kundens årspremier faktureras. Kundnivåval som rör hur
              pappren binds ihop, därför här ovanför pappren och aldrig i
              Verksamhetspanelen. Bär även "Planera fakturor" och "Indexera alla". */}
          {papers.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-2.5 text-[12.5px] font-sans">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={invoiceMode === 'consolidated' ? '#20c58f' : '#94a3b8'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-100">
                {papers.length > 1 ? (invoiceMode === 'consolidated' ? 'Samlingsfaktura' : 'Enskilda fakturor') : 'Årspremie'}
              </span>
              <span className="text-slate-400">
                {papers.length > 1
                  ? invoiceMode === 'consolidated'
                    ? 'en faktura per period, en Fortnox-rad per avtal'
                    : 'varje avtal faktureras för sig'
                  : 'avtalet faktureras för sig'}
              </span>
              <span className="flex-1 border-b border-dotted border-slate-700 translate-y-1 min-w-4" />
              <span className="text-slate-200 font-semibold tabular-nums whitespace-nowrap">
                {papers.length} avtal · {formatKr(annualSum)}/år
                {planTotals.next ? ` · nästa ${formatDateSv(planTotals.next.periodStart)}` : ''}
              </span>
              {papers.length > 1 && (
                <button
                  onClick={() => void setInvoiceMode(invoiceMode === 'consolidated' ? 'per_contract' : 'consolidated')}
                  disabled={busy}
                  className="text-[12px] font-semibold text-[#20c58f] underline decoration-dotted hover:brightness-110 disabled:opacity-50"
                  title={invoiceMode === 'consolidated' ? 'Byt till en faktura per avtal' : 'Byt till en samlad faktura med en rad per avtal'}
                >
                  {invoiceMode === 'consolidated' ? 'dela upp' : 'slå ihop'}
                </button>
              )}
              <button
                onClick={() => setIndexAllOpen(true)}
                disabled={busy}
                className="text-[12px] font-semibold text-slate-300 underline decoration-dotted hover:text-slate-100 disabled:opacity-50"
                title="Indexera alla kundens avtal med samma procent och datum"
              >
                indexera alla
              </button>
              <button
                onClick={() => void openPlanPreview()}
                disabled={busy || planLoading}
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  planTotals.changes > 0
                    ? 'bg-[#20c58f] text-[#fff] hover:brightness-110'
                    : 'border border-slate-600 text-slate-200 hover:border-[#20c58f]'
                }`}
                title="Jämför avtalen med fakturorna och skapa, uppdatera eller ta bort utkast"
              >
                Planera fakturor
                {planTotals.changes > 0 && <span className="tabular-nums opacity-90">· {planTotals.changes}</span>}
              </button>
              {planTotals.uncovered > 0 && (
                <span className="text-[11px] text-amber-300 whitespace-nowrap">
                  {planTotals.uncovered} period{planTotals.uncovered === 1 ? '' : 'er'} saknar faktura
                </span>
              )}
              {incompletePapers > 0 && (
                <span className="text-[11px] text-amber-300 whitespace-nowrap">
                  {incompletePapers} avtal saknar uppgifter
                </span>
              )}
            </div>
          )}

          {/* Tilläggsstationer på enheter som inget avtal täcker syns annars
              ingenstans: brickan renderas bara på avtal vars omfattning
              innehåller enheten. Utan den här raden ligger de obetalda. */}
          {orphanBricks.length > 0 && (
            <div className="mb-3 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10">
              <div className="text-[12px] font-semibold text-amber-200">
                {orphanBricks.reduce((sum, b) => sum + b.count, 0)} tilläggsstationer utanför avtalen
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                {Array.from(
                  new Set(
                    orphanBricks.map((b) =>
                      customerRowName(customerById.get(b.unitId) ?? ({ company_name: 'Enhet' } as RecordCustomer))
                    )
                  )
                ).join(', ')}
                {' '}saknar avtal som täcker enheten. Lägg enheten i ett avtals § 1 så går stationerna att fakturera.
              </div>
            </div>
          )}
          {papers.map((c) => (
            <PaperContract
              key={c.id}
              contract={c}
              accent={accentByContract.get(c.id) ?? ACCENTS[0]}
              root={root}
              customerById={customerById}
              scope={activeScopeByContract.get(c.id) ?? []}
              premiumEvents={premiumByContract.get(c.id) ?? []}
              followup={followupFor(c)}
              priceListLabel={priceListName(c.price_list_id)}
              onClearCoversAll={() => clearCoversAll(c)}
              contentReloadKey={contentReloadKey}
              onEditContent={() => setContentEditor(c)}
              isDropTarget={drag?.started ? drag.overContractId === c.id && !drag.invalidReason : false}
              isInvalidTarget={drag?.started ? drag.overContractId === c.id && !!drag.invalidReason : false}
              invalidReason={drag?.overContractId === c.id ? drag?.invalidReason ?? null : null}
              awaiting={!!drag?.started}
              dragSubject={drag?.started ? payloadLabel(drag.payload) : null}
              dragKind={drag?.started ? drag.payload.type : null}
              onPaperDrag={(e) => startDrag(e, { type: 'paper', contractId: c.id })}
              registerRef={(el) => {
                if (el) paperRefs.current.set(c.id, el)
                else paperRefs.current.delete(c.id)
              }}
              onHover={(on) => setHover(on ? { kind: 'contract', id: c.id } : null)}
              onScopeRowDrag={(e, cs) =>
                startDrag(e, { type: 'scoperow', unitId: cs.customer_id, scopeRowId: cs.id, fromContractId: c.id })
              }
              onEndCoverage={(cs, x, y) => endCoverage(c, cs, x, y)}
              onEditPriceList={(x, y) => setPricePrompt({ x, y, contract: c })}
              staff={technicians}
              contractTypes={contractTypes.map((t) => t.value)}
              onChangeType={(t) => changeContractType(c, t)}
              onDelete={c.template_id === 'local' ? () => setDeletePrompt(c) : undefined}
              onEditFrequency={() => setFrequencyPrompt(c)}
              onEditSignedAt={() => setSignedAtPrompt(c)}
              locations={locations}
              dropZone={drag?.overContractId === c.id ? drag.overZone : undefined}
              onSavePremium={(input) => savePremium(c, input)}
              onAddPremiumEvent={(input) => addPremiumEvent(c, input)}
              onSaveTerm={(input) => saveTerm(c, input)}
              onSaveInvoiceReference={(input) => saveInvoiceReference(c, input)}
              onSaveUnitReference={(unit, code) => saveUnitReference(c, unit, code)}
              refFocusUnitId={refPrompt?.contract.id === c.id ? refPrompt.unitId : null}
              onRefFocusHandled={() => setRefPrompt(null)}
              invoiceMode={papers.length > 1 ? invoiceMode : 'per_contract'}
              planEntries={planEntriesByContract.get(c.id) ?? []}
              onLinkFortnox={(period) => openLinkFortnox(c, period)}
              onChangeLineModel={(item, model) => changeLineBillingModel(c, item, model)}
              onEditSitePlan={(unit) => setSitePlanPrompt({ contract: c, unit })}
              onSaveRenewal={(input) => saveRenewal(c, input)}
              onExerciseOption={() => exerciseOption(c)}
              stationCount={stationCountFor(c)}
              addonBricks={bricksFor(c)}
              onBrickDrag={(e, brick) => startDrag(e, { type: 'addon_stations', ...brick })}
              unitNameOf={(id) => customerRowName(customerById.get(id) ?? ({ company_name: 'Enhet' } as RecordCustomer))}
              onChangeEquipmentInvoiceMode={(mode) => changeEquipmentInvoiceMode(c, mode)}
              equipmentInvoiceMode={
                customerById.get(c.customer_id ?? '')?.addon_invoice_mode === 'separate_per_contract'
                  ? 'separate'
                  : 'with_premium'
              }
              // Uppsagt-men-löpande avtal ligger kvar bland de aktiva (de
              // fungerar till slutdatumet) och ska kunna ångras direkt — inte
              // först när uppsägningstiden hunnit löpa ut.
              state={isTerminatedButRunning(c) ? 'terminated-running' : 'active'}
              onTerminate={isTerminatedButRunning(c) ? undefined : () => setTerminatePrompt(c)}
              onReactivate={isTerminatedButRunning(c) ? () => reactivate(c) : undefined}
              terminatedBy={terminatedByFor(c.id)}
              onSaveAgreementText={async (text) => {
                try {
                  await ContractScopeService.setAgreementText(c.id, text)
                  toast.success('Avtalsobjektet sparat.')
                  await onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara avtalsobjektet')
                }
              }}
              onSaveSalesPerson={async (name) => {
                try {
                  await ContractScopeService.setSalesPerson(c.id, name)
                  toast.success(name ? `Säljare satt till ${name}.` : 'Säljare borttagen.')
                  await onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara säljare')
                }
              }}
              onSaveAccountManager={(name, email) => saveAccountManager(c, name, email)}
              onOpenHistory={(tab, unitFilter) => setHistory({ contract: c, tab, unitFilter: unitFilter ?? '' })}
              isUnitContract={!isSingleSite && unitIds.has(c.customer_id ?? '')}
              isSingleSite={isSingleSite}
              onOpenSettings={(group) => openSettings(c, group)}
              settingsOpen={settingsPanel?.contractId === c.id}
            />
          ))}

          {/* Tomt avtalsblad: alltid sist, även när avtal redan finns. Dra in en
              enhet (eller Hela verksamheten) så skapas ett NYTT avtal på
              kundraden — vägen till flera avtal på samma kund (FEV: fyra
              prisposter). "Skapa avtal" nedan materialiserar bara kundradens
              första avtal och räcker inte för det. */}
          <div
            data-blank-sheet
            className={`relative rounded-md rounded-tr-xl border-2 border-dashed px-6 py-6 text-center font-sans transition-all ${
              drag?.started && drag.overBlank
                ? 'border-[#20c58f] bg-[#20c58f]/10 scale-[1.006]'
                : drag?.started && (drag.payload.type === 'unit' || drag.payload.type === 'org')
                  ? 'border-[#20c58f]/50'
                  : 'border-slate-700'
            }`}
          >
            <div className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#20c58f] mb-1.5">
              Tomt avtalsblad
            </div>
            <p className="text-sm font-semibold text-slate-200">
              Nytt avtal på {customerRowName(root)}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {drag?.started && drag.overBlank
                ? `Släpp: ett nytt avtal skapas med ${drag.payload.type === 'org' ? 'alla enheter' : payloadLabel(drag.payload)} i § 1`
                : 'Dra in en enhet eller Hela verksamheten hit. Du väljer avtalstyp, sedan fylls premie (§ 7) och löptid (§ 9) i på pappret.'}
            </p>
          </div>

          {papers.length === 0 && (
            <div className="border border-dashed border-slate-700 rounded-2xl p-6 text-center">
              <p className="text-sm text-slate-400">Inga aktiva avtal som dokument.</p>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
                {customerRowContracts.length > 0
                  ? `Kundens avtal finns bara som fält på kundkortet${
                      customerRowContracts.some((c) => Number(c.annual_value ?? 0) > 0)
                        ? ` (${formatKr(
                            customerRowContracts.reduce((s, c) => s + Number(c.annual_value ?? 0), 0)
                          )}/år)`
                        : ''
                    }. Skapa ett riktigt avtal för att kunna lägga in tjänster, kostnader, omfattning och prislista.`
                  : leftovers.length > 0
                    ? 'Kunden har bara importerade avtalsrester. Skapa ett riktigt avtal för att kunna lägga in tjänster, kostnader, omfattning och prislista.'
                    : 'Skapa ett avtal för kunden så dyker det upp här som ett dokument.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {/* Ett kort per kundkortsavtal (bär premie/datum), annars ett
                    enda tomt avtal på kundraden. */}
                {(customerRowContracts.length > 0 ? customerRowContracts : [null]).map((c, i) => (
                  <button
                    key={c?.id ?? `new-${i}`}
                    onClick={() => setTypePrompt({ source: c })}
                    disabled={busy}
                    className="inline-flex items-center gap-2 bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    Skapa avtal
                    {customerRowContracts.length > 1 && c && (
                      <span className="font-normal opacity-90">
                        · {customerRowName(customerById.get(c.customer_id ?? '') ?? root)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Arkivytan: ett papper som dras hit sägs upp (uppsägningsdialogen öppnas) */}
          {drag?.started && drag.payload.type === 'paper' && (
            <div
              data-drop-zone="archive"
              className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-4 py-4 text-sm font-semibold transition-colors ${
                drag.overArchive ? 'border-red-400 bg-red-400/10 text-red-300' : 'border-slate-600 text-slate-400'
              }`}
            >
              <Archive className="w-4 h-4" />
              {drag.overArchive ? 'Släpp: avtalet sägs upp' : 'Dra hit för att säga upp avtalet'}
            </div>
          )}

          {/* Avslutade avtal — historiken ska gå att öppna, inte bara räknas */}
          {endedPapers.length > 0 && (
            <details
              className="border border-slate-700/50 rounded-2xl text-slate-400 mb-4"
              // Är arkivet allt som finns att visa ska det inte ligga dolt
              open={papers.length === 0}
            >
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-400 select-none flex items-center gap-2 hover:text-slate-200 transition-colors">
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                Avslutade avtal ({endedPapers.length})
                <span className="font-normal text-slate-500">— historik, inga aktiva funktioner</span>
              </summary>
              {/*
                Ingen opacity här. Arkivkänslan sitter i papprets egna färger
                (se PAPER_INK.archived) — halvtransparent text läser som trasig
                och blir dessutom svår att läsa, vilket motverkar hela syftet
                med att spara avtalen för spårbarhet.

                Alla skrivcallbacks utelämnas medvetet: eftersom de är valfria i
                PaperProps renderas knapparna inte alls, och låsningen blir
                typstyrd i stället för villkorsstyrd.
              */}
              <div className="px-4 pb-4 space-y-4">
                {endedPapers.map((c) => (
                  <PaperContract
                    key={c.id}
                    contract={c}
                    accent="#8a9099"
                    root={root}
                    customerById={customerById}
                    scope={activeScopeByContract.get(c.id) ?? []}
                    premiumEvents={premiumByContract.get(c.id) ?? []}
                    followup={followupFor(c)}
                    priceListLabel={priceListName(c.price_list_id)}
                    contentReloadKey={contentReloadKey}
                    state="archived"
                    isDropTarget={false}
                    isInvalidTarget={false}
                    invalidReason={null}
                    awaiting={false}
                    dragSubject={null}
                    registerRef={() => {}}
                    onHover={() => {}}
                    onOpenHistory={(tab, unitFilter) => setHistory({ contract: c, tab, unitFilter: unitFilter ?? '' })}
                    isUnitContract={!isSingleSite && unitIds.has(c.customer_id ?? '')}
                    isSingleSite={isSingleSite}
                    staff={technicians}
                    contractTypes={contractTypes.map((t) => t.value)}
                    terminatedBy={terminatedByFor(c.id)}
                    onRenew={() => renewContract(c)}
                    onReactivate={() => reactivate(c)}
                    locations={locations}
                    stationCount={stationCountFor(c)}
                  />
                ))}
              </div>
            </details>
          )}

          {leftovers.length > 0 && (
            <details className="border border-slate-700/50 rounded-2xl text-slate-400">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-500 select-none">
                Importrester &amp; kundkortsavtal ({leftovers.length}) — behöver konverteras eller städas
              </summary>
              <ul className="px-4 pb-3 space-y-1.5 text-xs">
                {leftovers.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="uppercase tracking-wide text-[9px] border border-slate-700 rounded-full px-2 py-0.5 shrink-0">
                      {c.fromCustomerRow ? 'Kundkort' : 'Importerad'}
                    </span>
                    <span className="text-slate-300">{contractDisplayName(c)}</span>
                    <span className="text-slate-500 truncate">
                      · {customerRowName(customerById.get(c.customer_id ?? '') ?? root)}
                      {Number(c.annual_value ?? 0) > 0 && ` · ${formatKr(Number(c.annual_value))}/år`}
                      {c.contract_start_date &&
                        ` · ${formatDateSv(c.contract_start_date)}${
                          c.contract_end_date ? ` – ${formatDateSv(c.contract_end_date)}` : ''
                        }`}
                    </span>
                    {/* Kundkortsavtal på en rad som redan täcks av ett riktigt avtal
                        (står i § 1, eller bär ett eget papper) är rester: nolla
                        datumen så spökkortet försvinner, i stället för att skapa
                        ännu ett avtal av dem. */}
                    {canClearRow(c) && (
                      <button
                        onClick={() => void clearRowContractFields(c)}
                        disabled={busy}
                        className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 border border-slate-600 rounded-lg px-2.5 py-1 hover:border-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
                        title={
                          rowIsCovered(c.customer_id ?? '')
                            ? 'Raden täcks redan av ett avtal — nolla kundradens egna avtalsdatum så resten försvinner'
                            : 'Nolla kundradens egna avtalsdatum — avtalskartan är källan nu'
                        }
                      >
                        Nolla avtalsfält
                      </button>
                    )}
                    <button
                      onClick={() =>
                        c.fromCustomerRow
                          ? setTypePrompt({ source: c })
                          : void promoteImported(c)
                      }
                      disabled={busy}
                      className={`${
                        canClearRow(c) ? '' : 'ml-auto '
                      }shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#20c58f] border border-[#20c58f]/40 rounded-lg px-2.5 py-1 hover:bg-[#20c58f]/10 transition-colors disabled:opacity-50`}
                      title={
                        c.fromCustomerRow
                          ? 'Skapa ett riktigt avtal av kundkortets data'
                          : 'Skapa ett riktigt avtal med den här radens belopp och datum — historiken följer med'
                      }
                    >
                      <FileText className="w-3 h-3" />
                      Skapa avtal
                    </button>
                  </li>
                ))}
              </ul>
              {leftovers.filter(canClearRow).length > 1 && (
                <div className="px-4 pb-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span>
                    Kundkortsavtalen är rester när avtalskartan bär reglerna. Nollning rör bara kundradens
                    egna avtalsdatum, aldrig ärenden, scheman eller avtalen ovan.
                  </span>
                  <button
                    onClick={() => void clearAllRowContractFields(leftovers.filter(canClearRow))}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 border border-slate-600 rounded-lg px-2.5 py-1 hover:border-slate-400 hover:text-slate-100 transition-colors disabled:opacity-50"
                  >
                    Nolla alla kundkortsavtal ({leftovers.filter(canClearRow).length})
                  </button>
                </div>
              )}
            </details>
          )}
        </main>

        {/* Inställningar och puls: öppnas från kugghjulet på en paragraf, ligger
            bredvid pappret så att raden uppdateras medan man skriver. */}
        {settingsPanel && (() => {
          const c = papers.find((x) => x.id === settingsPanel.contractId)
          if (!c) return null
          const events = premiumByContract.get(c.id) ?? []
          return (
            <ContractSettingsDrawer
              contract={c}
              root={root}
              archived={false}
              group={settingsPanel.group}
              tab={settingsPanel.tab}
              onChangeGroup={(group) => setSettingsPanel({ ...settingsPanel, group, tab: 'settings' })}
              onChangeTab={(tab) => setSettingsPanel({ ...settingsPanel, tab })}
              onClose={() => setSettingsPanel(null)}
              completenessBase={completenessBaseFor(c)}
              contentReloadKey={contentReloadKey}
              rootPriceListId={root.price_list_id ?? null}
              contractTypes={contractTypes.map((t) => t.value)}
              onSaveDisplayName={async (name) => {
                try {
                  await ContractScopeService.setDisplayName(c.id, name)
                  toast.success(name ? `Avtalet heter nu ${name}.` : 'Avtalets namn borttaget, avtalstypen visas.')
                  await onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara namnet')
                }
              }}
              onChangeLineShare={async (item, share) => {
                try {
                  await ContractScopeService.setLineShare(item.id, share)
                  setContentReloadKey((k) => k + 1)
                  setBillingPlansKey((k) => k + 1)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara andelen')
                }
              }}
              onChangeType={(t) => changeContractType(c, t)}
              onEditSignedAt={() => setSignedAtPrompt(c)}
              staff={technicians}
              onSaveSalesPerson={async (name) => {
                try {
                  await ContractScopeService.setSalesPerson(c.id, name)
                  toast.success(name ? `Säljare satt till ${name}.` : 'Säljare borttagen.')
                  await onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara säljare')
                }
              }}
              onSaveAccountManager={(name, email) => saveAccountManager(c, name, email)}
              oneflowUrl={oneflowContractUrl(c)}
              scope={activeScopeByContract.get(c.id) ?? []}
              customerById={customerById}
              isSingleSite={isSingleSite}
              isUnitContract={!isSingleSite && unitIds.has(c.customer_id ?? '')}
              onClearCoversAll={() => clearCoversAll(c)}
              onEndCoverage={(cs, x, y) => endCoverage(c, cs, x, y)}
              onSaveAgreementText={async (text) => {
                try {
                  await ContractScopeService.setAgreementText(c.id, text)
                  toast.success('Avtalsobjektet sparat.')
                  await onChanged()
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Kunde inte spara avtalsobjektet')
                }
              }}
              priceListLabel={priceListName(c.price_list_id)}
              onEditPriceList={(x, y) => setPricePrompt({ x, y, contract: c })}
              followup={followupFor(c)}
              onEditFrequency={() => setFrequencyPrompt(c)}
              onEditSitePlan={(unit) => setSitePlanPrompt({ contract: c, unit })}
              onEditContent={() => setContentEditor(c)}
              onChangeLineModel={(item, model) => changeLineBillingModel(c, item, model)}
              bricks={bricksFor(c)}
              decided={decidedByContract[c.id] ?? null}
              nextBricks={nextBricksAfter(c.id)}
              onGoNext={() => {
                const next = nextBricksAfter(c.id)
                const target = next ? papers.find((x) => x.id === next.contractId) : null
                if (target) openBricks(target)
              }}
              onDecideBrick={(brick, zone, x, y) => openAddonPrompt(c, [brick], zone, x, y)}
              onDecideBricks={(bricks, zone, x, y) => openAddonPrompt(c, bricks, zone, x, y)}
              unitNameOf={(id) => customerRowName(customerById.get(id) ?? ({ company_name: 'Enhet' } as RecordCustomer))}
              equipmentInvoiceMode={
                customerById.get(c.customer_id ?? '')?.addon_invoice_mode === 'separate_per_contract' ? 'separate' : 'with_premium'
              }
              onChangeEquipmentInvoiceMode={(mode) => changeEquipmentInvoiceMode(c, mode)}
              premiumEvents={events}
              annualInForce={contractEffectiveAnnualValue(c, events)}
              invoiceMode={papers.length > 1 ? invoiceMode : 'per_contract'}
              planEntries={planEntriesByContract.get(c.id) ?? []}
              onLinkFortnox={(period) => openLinkFortnox(c, period)}
              onSavePremium={(input) => savePremium(c, input)}
              onAddPremiumEvent={(input) => addPremiumEvent(c, input)}
              coveredLocations={coveredLocationsFor(c)}
              onSaveInvoiceReference={(input) => saveInvoiceReference(c, input)}
              onSaveUnitReference={(unit, code) => saveUnitReference(c, unit, code)}
              onSaveTerm={(input) => saveTerm(c, input)}
              onSaveRenewal={(input) => saveRenewal(c, input)}
              onExerciseOption={() => exerciseOption(c)}
              onTerminate={isTerminatedButRunning(c) ? undefined : () => setTerminatePrompt(c)}
              onReactivate={isTerminatedButRunning(c) ? () => reactivate(c) : undefined}
              onDelete={c.template_id === 'local' ? () => setDeletePrompt(c) : undefined}
              stationCount={stationCountFor(c)}
              onOpenHistory={(tab, unitFilter) => setHistory({ contract: c, tab, unitFilter: unitFilter ?? '' })}
            />
          )
        })()}
      </div>

      {/* Drag-ghost */}
      {drag?.started && (
        <div
          className={`fixed z-[120] pointer-events-none flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold text-slate-100 shadow-2xl shadow-black/60 -rotate-2 bg-slate-950 ${
            drag.invalidReason ? 'border-red-400' : 'border-[#20c58f]'
          }`}
          style={{ left: drag.x + 14, top: drag.y + 10 }}
        >
          {drag.payload.type === 'org' ? (
            <Building2 className="w-4 h-4 text-[#20c58f]" />
          ) : drag.payload.type === 'paper' ? (
            <FileText className="w-4 h-4 text-slate-300" />
          ) : drag.payload.type === 'catalog' ? (
            <Plus className="w-4 h-4 text-slate-300" />
          ) : (
            <Home className="w-4 h-4 text-slate-300" />
          )}
          <span>
            {payloadLabel(drag.payload)}
            <span className={`block text-[10px] font-normal ${drag.invalidReason ? 'text-red-400' : 'text-[#20c58f]'}`}>
              {drag.invalidReason ??
                (drag.overBlank
                  ? 'Släpp för att skapa ett nytt avtal'
                  : drag.overAside
                    ? 'Släpp för att avsluta täckningen'
                    : drag.overArchive
                      ? 'Släpp för att säga upp avtalet'
                      : drag.overContractId
                        ? drag.payload.type === 'addon_stations'
                          ? drag.overZone === 'premium'
                            ? 'Släpp för att baka in i årspremien (§ 7)'
                            : 'Släpp för att lägga som tillägg utöver avtalet (§ 6)'
                          : drag.payload.type === 'paper'
                          ? 'Släpp för att byta ordning'
                          : drag.payload.type === 'catalog'
                            ? drag.payload.kind === 'pricelist'
                              ? 'Släpp för att byta prislista (§ 2)'
                              : drag.overZone === 'equipment' || drag.payload.kind !== 'service'
                                ? 'Släpp för att lägga till i § 6 Utrustning'
                                : 'Släpp för att lägga till i § 4 Tjänster'
                            : drag.overZone === 'refs'
                              ? 'Släpp för att sätta Er referens'
                              : 'Släpp för att skriva in i avtalet'
                        : drag.payload.type === 'paper'
                          ? 'Släpp på arkivet eller ett annat papper'
                          : drag.payload.type === 'catalog'
                            ? 'Släpp på ett avtal'
                            : 'Släpp på ett avtal eller det tomma bladet')}
            </span>
          </span>
        </div>
      )}

      {/* Datum-popover */}
      {addonPrompt && (
        <AddonDropPrompt prompt={addonPrompt.state} onClose={() => setAddonPrompt(null)} onConfirmBrick={confirmAddonBrick} onAllDone={addonPromptDone} />
      )}
      {datePrompt && (
        <DatePromptPopover prompt={datePrompt} onClose={() => setDatePrompt(null)} />
      )}

      {/* Fakturaplan: förhandsgranska diff mot fakturorna innan apply (gemet) */}
      <BillingPlanPreviewModal
        isOpen={planPreviewOpen}
        plan={planPreview}
        loading={planLoading}
        onConfirm={() => void applyPlanPreview()}
        onCancel={() => {
          setPlanPreviewOpen(false)
          setPlanPreview(null)
        }}
      />

      {/* Koppla Fortnox-faktura till en passerad period (§ 7) */}
      <LinkFortnoxInvoiceModal
        target={fortnoxTarget}
        onClose={() => setFortnoxTarget(null)}
        onLinked={async () => {
          await onChanged()
          setBillingPlansKey((k) => k + 1)
        }}
      />

      {/* § 3 per enhet: driftläge och besökstakt */}
      {sitePlanPrompt && (
        <SitePlanModal
          unitName={customerRowName(customerById.get(sitePlanPrompt.unit.unitId) ?? root)}
          unit={sitePlanPrompt.unit}
          contractFrequency={sitePlanPrompt.contract.visit_frequency ?? null}
          contractVisits={sitePlanPrompt.contract.visits_per_year ?? null}
          busy={busy}
          onClose={() => setSitePlanPrompt(null)}
          onSave={(input) => void saveSitePlan(sitePlanPrompt.contract, sitePlanPrompt.unit, input)}
        />
      )}

      {/* Indexera alla avtal (gemet) */}
      {indexAllOpen && (
        <IndexAllModal
          count={papers.length}
          annualSum={annualSum}
          busy={busy}
          onClose={() => setIndexAllOpen(false)}
          onConfirm={(input) => void indexAll(input)}
        />
      )}

      {/* Avtalstyp innan nytt avtal skapas — samma typer som Oneflow-wizarden */}
      {typePrompt && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/70 p-4" onClick={() => setTypePrompt(null)}>
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-[#20c58f]" />
              Vilken typ av avtal?
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Samma avtalstyper som i avtalswizarden. Namnet blir avtalets rubrik.
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {contractTypes.map((t) => (
                <button
                  key={t.serviceId}
                  onClick={() => {
                    const { source, blankPayload } = typePrompt
                    setTypePrompt(null)
                    if (blankPayload) void createFromBlank(blankPayload, t.value)
                    else void materializeContract(source, t.value)
                  }}
                  disabled={busy}
                  className="w-full flex items-center gap-2 text-left text-sm rounded-xl border border-slate-700/60 px-3 py-2.5 text-slate-200 hover:border-[#20c58f] hover:bg-[#20c58f]/5 transition-colors disabled:opacity-50"
                >
                  <span className="flex-1">{t.value}</span>
                  {t.code && <span className="text-[10px] text-slate-500 tabular-nums">{t.code}</span>}
                </button>
              ))}
              {contractTypes.length === 0 && (
                <p className="text-xs text-slate-500 py-2">
                  Inga avtalstyper hittades. Markera tjänster som avtalstyp i tjänstekatalogen.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-700/50">
              <button
                onClick={() => {
                  const { source, blankPayload } = typePrompt
                  setTypePrompt(null)
                  if (blankPayload) void createFromBlank(blankPayload)
                  else void materializeContract(source)
                }}
                disabled={busy}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Hoppa över — sätt typ senare
              </button>
              <button onClick={() => setTypePrompt(null)} className="text-xs text-slate-500 hover:text-slate-300">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Säg upp avtalet */}
      {terminatePrompt && (
        <TerminateModal
          contract={terminatePrompt}
          busy={busy}
          onClose={() => setTerminatePrompt(null)}
          onConfirm={(endDate, reason) => terminateContract(terminatePrompt, endDate, reason)}
        />
      )}

      {/* Signeringsdatum — när kunden faktiskt skrev under */}
      {signedAtPrompt && (
        <SignedAtModal
          contract={signedAtPrompt}
          busy={busy}
          onClose={() => setSignedAtPrompt(null)}
          onSave={async (date) => {
            const contract = signedAtPrompt
            setSignedAtPrompt(null)
            setBusy(true)
            try {
              await ContractScopeService.setSignedAt(contract.id, date)
              toast.success(date ? `Signeringsdatum satt till ${formatDateSv(date)}.` : 'Signeringsdatum borttaget.')
              await onChanged()
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Kunde inte spara signeringsdatum')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {/* Besöksfrekvens enligt avtalet */}
      {frequencyPrompt && (
        <VisitFrequencyModal
          contract={frequencyPrompt}
          busy={busy}
          onClose={() => setFrequencyPrompt(null)}
          onSave={(freq, visits) => saveFrequency(frequencyPrompt, freq, visits)}
        />
      )}

      {/* Radera avtal — bekräftelse */}
      {deletePrompt && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/70 p-4" onClick={() => setDeletePrompt(null)}>
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-slate-100 mb-1">
              Radera {contractDisplayName(deletePrompt)}?
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Avtalet och dess innehåll, omfattning och premietrappa tas bort permanent. Avtal med
              fakturarader, ärenden eller kontrollbesök går inte att radera — säg upp dem i stället.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletePrompt(null)}
                className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-800"
              >
                Avbryt
              </button>
              <button
                onClick={() => deleteContract(deletePrompt)}
                disabled={busy}
                className="text-xs font-semibold text-[#fff] bg-red-600 px-3 py-2 rounded-lg hover:bg-red-500 disabled:opacity-50"
              >
                Radera avtalet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Omfattningsläge: bara dagens enheter eller även framtida */}
      {scopeModePrompt && (
        <div
          className="fixed z-[130] w-80 bg-slate-950 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/60"
          style={{
            left: Math.min(scopeModePrompt.x, window.innerWidth - 340),
            top: Math.min(scopeModePrompt.y, window.innerHeight - 260),
          }}
        >
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-0.5">
            <Building2 className="w-3.5 h-3.5 text-[#20c58f]" />
            Hur ska avtalet omfatta verksamheten?
          </h4>
          <p className="text-[11px] text-slate-400 mb-2.5">{contractDisplayName(scopeModePrompt.contract)}</p>
          <button
            onClick={() => applyCoversAll(scopeModePrompt.contract)}
            className="w-full text-left rounded-lg border border-slate-700/60 px-3 py-2 mb-1.5 hover:border-[#20c58f] hover:bg-[#20c58f]/5 transition-colors"
          >
            <span className="block text-xs font-semibold text-slate-100">Hela verksamheten, löpande</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              Alla {units.length} enheter — och enheter som tillkommer senare täcks automatiskt
            </span>
          </button>
          <button
            onClick={() => {
              const contract = scopeModePrompt.contract
              const { x, y } = scopeModePrompt
              setScopeModePrompt(null)
              setDatePrompt({
                x,
                y,
                title: 'Täckning gäller från',
                subject: `Dagens ${units.length} enheter skrivs in i ${contractDisplayName(contract)}`,
                contract,
                contractStart: contract.contract_start_date ?? contract.start_date ?? null,
                onConfirm: (date) => runDropAction({ type: 'org' }, contract, date),
              })
            }}
            className="w-full text-left rounded-lg border border-slate-700/60 px-3 py-2 hover:border-[#20c58f] hover:bg-[#20c58f]/5 transition-colors"
          >
            <span className="block text-xs font-semibold text-slate-100">Bara dagens enheter</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              Skriver in de {units.length} enheterna i § 1 med startdatum — framtida enheter läggs till manuellt
            </span>
          </button>
          <button
            onClick={() => setScopeModePrompt(null)}
            className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-slate-300"
          >
            Avbryt
          </button>
        </div>
      )}

      {/* Prislist-popover */}
      {pricePrompt && (
        <div
          className="fixed z-[130] w-72 bg-slate-950 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/60"
          style={{
            left: Math.min(pricePrompt.x, window.innerWidth - 300),
            top: Math.min(pricePrompt.y, window.innerHeight - 320),
          }}
        >
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-0.5">
            <Pencil className="w-3.5 h-3.5 text-[#20c58f]" />
            Prislista för avtalet
          </h4>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Styr avrops- och tilläggspriser i ärenden på avtalets enheter.
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {priceLists.map((pl) => {
              const selected = pricePrompt.contract.price_list_id === pl.id
              return (
                <button
                  key={pl.id}
                  onClick={() => changePriceList(pricePrompt.contract, pl.id)}
                  className={`w-full flex items-center justify-between gap-2 text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                    selected
                      ? 'border-[#20c58f]/60 bg-[#20c58f]/10 text-[#20c58f] font-semibold'
                      : 'border-slate-700/60 text-slate-200 hover:border-[#20c58f] hover:bg-[#20c58f]/5'
                  }`}
                >
                  {pl.name}
                  {selected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                </button>
              )
            })}
            {priceLists.length === 0 && <p className="text-xs text-slate-500 py-2">Inga aktiva prislistor.</p>}
          </div>
          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-700/50">
            {pricePrompt.contract.price_list_id ? (
              <button
                onClick={() => changePriceList(pricePrompt.contract, null)}
                className="text-[11px] text-slate-400 hover:text-red-400"
              >
                Ta bort prislistan
              </button>
            ) : (
              <span className="text-[11px] text-slate-600">Ingen prislista → kundens gäller</span>
            )}
            <button onClick={() => setPricePrompt(null)} className="text-[11px] text-slate-400 hover:text-slate-200">
              Stäng
            </button>
          </div>
        </div>
      )}

      {/* Historikmodal */}
      <ContractHistoryModal
        contract={history?.contract ?? null}
        initialTab={history?.tab}
        initialUnitFilter={history?.unitFilter}
        onClose={() => setHistory(null)}
        additions={history ? additionsByCustomer.get(history.contract.customer_id ?? '') ?? [] : []}
        billingItems={history ? billingByCustomer.get(history.contract.customer_id ?? '') ?? [] : []}
        premiumEvents={history ? premiumByContract.get(history.contract.id) ?? [] : []}
        contractSites={history ? contractSites.filter((cs) => cs.contract_id === history.contract.id) : []}
        cases={cases}
        loggedEvents={history ? contractEvents.filter((e) => e.contract_id === history.contract.id) : []}
        inspections={inspections}
        customerById={customerById}
        coveredCustomerIds={history ? followupFor(history.contract).covered : []}
      />

      {/* Avtalsinnehåll: tjänster kunden får + interna kostnader (samma editor
          som Oneflow-wizarden och faktureringsinställningarna använder) */}
      {contentEditor && (
        <Modal
          isOpen
          onClose={() => {
            setContentEditor(null)
            setContentReloadKey((k) => k + 1)
          }}
          usePortal
          size="xl"
          title={`Avtalsinnehåll — ${contractDisplayName(contentEditor)}`}
          subtitle="Tjänster kunden får och de interna kostnaderna de medför. Marginalen räknas automatiskt."
        >
          <div className="p-4">
            <ContractCaseServiceSelector
              customerId={contentEditor.customer_id as string}
              contractId={contentEditor.id}
            />
          </div>
        </Modal>
      )}

      {/* Lägg till enhet — riktiga enhetsformuläret */}
      <SiteModal
        isOpen={siteModalOpen}
        onClose={() => setSiteModalOpen(false)}
        onSuccess={() => {
          setSiteModalOpen(false)
          void onChanged()
        }}
        organizationId={root.organization_id ?? ''}
        organizationName={root.company_name}
        parentCustomerId={root.id}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avtalsobjekt: avtalstexten från Oneflow (vad som ingår, stationer per plats)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Säg upp avtal — per avtal, inte per kund
// ---------------------------------------------------------------------------

function TerminateModal({
  contract,
  busy,
  onClose,
  onConfirm,
}: {
  contract: RecordContract
  busy: boolean
  onClose: () => void
  onConfirm: (endDate: string, reason: string | null) => void
}) {
  // Förval: avtalets slutdatum om det finns, annars idag
  const [endDate, setEndDate] = useState(contract.contract_end_date ?? todayKey())
  const [reason, setReason] = useState('')
  const alreadyPassed = endDate < todayKey()

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-slate-100 mb-1">
          Säg upp {contractDisplayName(contract)}
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          Avtalet bevaras som historik med all fakturering och alla ärenden. Endast detta avtal
          påverkas — kundens övriga avtal löper vidare.
        </p>

        <label className="block text-xs font-medium text-slate-400 mb-1">Gäller till och med</label>
        <DateField
          value={endDate}
          onChange={setEndDate}
          aria-label="Sista giltiga dag"
          className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />
        <p className="text-[11px] text-slate-500 mt-1 mb-3">
          {alreadyPassed
            ? 'Datumet har passerat — avtalet markeras som avslutat direkt.'
            : 'Avtalet visas som uppsagt och löper till detta datum.'}
        </p>

        <label className="block text-xs font-medium text-slate-400 mb-1">Anledning (valfritt)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="t.ex. Ersatt av nytt avtal"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-700/50">
          <button onClick={onClose} className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-800">
            Avbryt
          </button>
          <button
            onClick={() => onConfirm(endDate, reason.trim() || null)}
            disabled={busy || !endDate}
            className="text-xs font-semibold text-[#fff] bg-amber-600 px-3 py-2 rounded-lg hover:bg-amber-500 disabled:opacity-40"
          >
            {alreadyPassed ? 'Markera som avslutat' : 'Säg upp avtalet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signeringsdatum: när kunden faktiskt skrev under
// ---------------------------------------------------------------------------

function SignedAtModal({
  contract,
  busy,
  onClose,
  onSave,
}: {
  contract: RecordContract
  busy: boolean
  onClose: () => void
  onSave: (date: string | null) => void
}) {
  const [date, setDate] = useState(contract.signed_at ?? '')

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-[#20c58f]" />
          När signerades avtalet?
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          Datumet kunden skrev under — hämtas från Oneflow-dokumentet. Inte samma sak som när avtalet
          lades upp i portalen.
        </p>
        {/* DateField, inte <input type="date">: Chrome struntar i lang="sv-SE"
            och visar mm/dd/yyyy efter webbläsarens språk. */}
        <DateField
          value={date}
          onChange={setDate}
          autoFocus
          aria-label="Signeringsdatum"
          className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
          {contract.signed_at ? (
            <button
              onClick={() => onSave(null)}
              disabled={busy}
              className="text-xs text-slate-400 hover:text-red-400 disabled:opacity-50"
            >
              Ta bort datum
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-800">
              Avbryt
            </button>
            <button
              onClick={() => onSave(date || null)}
              disabled={busy || !date}
              className="text-xs font-semibold text-[#fff] bg-[#20c58f] px-3 py-2 rounded-lg hover:brightness-110 disabled:opacity-40"
            >
              Spara
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Besöksfrekvens: hur ofta kunden ska besökas enligt avtalet
// ---------------------------------------------------------------------------

function VisitFrequencyModal({
  contract,
  busy,
  onClose,
  onSave,
}: {
  contract: RecordContract
  busy: boolean
  onClose: () => void
  onSave: (frequency: string | null, visitsPerYear: number | null) => void
}) {
  const [frequency, setFrequency] = useState<string | null>(contract.visit_frequency ?? null)
  const [visits, setVisits] = useState<string>(
    contract.visits_per_year != null ? String(contract.visits_per_year) : ''
  )

  // Byt frekvens → förvälj standardantalet (12/4/2/1), custom behåller inmatat
  const pickFrequency = (f: string) => {
    setFrequency(f)
    const preset = VISITS_PER_YEAR_BY_FREQUENCY[f]
    if (preset) setVisits(String(preset))
  }

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-base font-semibold text-slate-100 flex items-center gap-2 mb-1">
          <CalendarCheck className="w-4 h-4 text-[#20c58f]" />
          Besöksfrekvens enligt avtalet
        </h4>
        <p className="text-xs text-slate-400 mb-3">
          Visas för den som lägger upp ronderingsschemat och används som facit i uppföljningen.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {Object.entries(VISIT_FREQUENCY_LABEL).map(([value, label]) => (
            <button
              key={value}
              onClick={() => pickFrequency(value)}
              className={`text-left text-sm rounded-xl border px-3 py-2 transition-colors ${
                frequency === value
                  ? 'border-[#20c58f] bg-[#20c58f]/10 text-[#20c58f] font-semibold'
                  : 'border-slate-700/60 text-slate-200 hover:border-[#20c58f]/60'
              }`}
            >
              {label}
              {VISITS_PER_YEAR_BY_FREQUENCY[value] && (
                <span className="block text-[10px] font-normal text-slate-500">
                  {VISITS_PER_YEAR_BY_FREQUENCY[value]} besök/år
                </span>
              )}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">Antal besök per år</label>
        <input
          type="number"
          min={1}
          max={52}
          value={visits}
          onChange={(e) => setVisits(e.target.value)}
          placeholder="t.ex. 6"
          className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Fyll i om avtalet anger ett antal som inte matchar intervallet, t.ex. 6 besök per år.
        </p>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
          <button
            onClick={() => onSave(null, null)}
            disabled={busy}
            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
            title="Avropsavtal och liknande har ingen fast besöksfrekvens"
          >
            Ingen fast frekvens (avrop)
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs font-semibold text-slate-300 px-3 py-2 rounded-lg hover:bg-slate-800">
              Avbryt
            </button>
            <button
              onClick={() => onSave(frequency, visits ? parseInt(visits, 10) : null)}
              disabled={busy || !frequency}
              className="text-xs font-semibold text-[#fff] bg-[#20c58f] px-3 py-2 rounded-lg hover:brightness-110 disabled:opacity-40"
            >
              Spara
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Datum-popover: Idag / Avtalsstart / valfritt datum
// ---------------------------------------------------------------------------

/**
 * Indexera alla kundens levande avtal i ett steg (gemet). Samma procent och
 * datum på alla; fakturaansvarig indexerar utan annan godkännare (beslut
 * 2026-09-02). Utrustning per styck och år räknas upp om rutan är ikryssad.
 */
function IndexAllModal({
  count,
  annualSum,
  busy,
  onClose,
  onConfirm,
}: {
  count: number
  annualSum: number
  busy: boolean
  onClose: () => void
  onConfirm: (input: { effectiveFrom: string; percent: number; note: string | null; includeEquipment: boolean }) => void
}) {
  const nextYear = new Date()
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  const [effectiveFrom, setEffectiveFrom] = useState(`${nextYear.getFullYear()}-01-01`)
  const [percent, setPercent] = useState('')
  const [note, setNote] = useState('AKI')
  const [includeEquipment, setIncludeEquipment] = useState(true)
  const pct = Number(percent.replace(',', '.'))
  const valid = Number.isFinite(pct) && pct !== 0 && !!effectiveFrom
  const preview = valid ? Math.round(annualSum * (1 + pct / 100)) : null

  return (
    <Modal isOpen onClose={onClose} title={`Indexera ${count} avtal`} size="sm">
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-400">
          Ett steg i varje avtals premietrappa med samma procent och datum. Nuvarande summa {formatKr(annualSum)}/år
          {preview != null ? `, blir ${formatKr(preview)}/år` : ''}. Indexeringen träder i kraft på fakturorna först när du sedan klickar "Planera fakturor" och uppdaterar de planerade fakturorna. Skickade fakturor rörs aldrig.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Gäller från
            <DateField
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              aria-label="Gäller från"
              className="mt-1 w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
            />
          </label>
          <label className="text-xs text-slate-400">
            Procent
            <input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              inputMode="decimal"
              placeholder="t.ex. 3,1"
              autoFocus
              className="mt-1 w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Notering
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="t.ex. AKI näringsgren N, dec 2026"
            className="mt-1 w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeEquipment}
            onChange={(e) => setIncludeEquipment(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
          />
          Räkna även upp utrustning per styck och år (§ 6)
        </label>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button onClick={onClose} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button
            onClick={() => valid && onConfirm({ effectiveFrom, percent: pct, note: note.trim() || null, includeEquipment })}
            disabled={!valid || busy}
            className="bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            Indexera
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * § 3 per enhet: driftläge (stationskontroll eller avrop) och besökstakt.
 * Tom takt = avtalets förval. Avrop har ingen takt.
 */
function SitePlanModal({
  unitName,
  unit,
  contractFrequency,
  contractVisits,
  busy,
  onClose,
  onSave,
}: {
  unitName: string
  unit: UnitFollowup
  contractFrequency: string | null
  contractVisits: number | null
  busy: boolean
  onClose: () => void
  onSave: (input: { serviceMode: 'inspection' | 'on_demand'; frequency: string | null; visitsPerYear: number | null }) => void
}) {
  const [mode, setMode] = useState<'inspection' | 'on_demand'>(unit.serviceMode)
  const [frequency, setFrequency] = useState<string>(unit.inherited ? '' : (unit.frequency ?? ''))
  const [visits, setVisits] = useState<string>(unit.inherited ? '' : unit.visitsPerYear != null ? String(unit.visitsPerYear) : '')
  const inputCls = 'mt-1 w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:outline-none'

  return (
    <Modal isOpen onClose={onClose} title={`Besöksplan · ${unitName}`} size="sm">
      <div className="p-4 space-y-3">
        <label className="text-xs text-slate-400 block">
          Driftläge
          <select value={mode} onChange={(e) => setMode(e.target.value as 'inspection' | 'on_demand')} className={inputCls} autoFocus>
            <option value="inspection">Stationskontroll (återkommande schema)</option>
            <option value="on_demand">Avrop (ärendestyrd, inget schema)</option>
          </select>
        </label>
        {mode === 'inspection' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Frekvens
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls}>
                <option value="">
                  Avtalets förval{contractFrequency ? ` (${(VISIT_FREQUENCY_LABEL[contractFrequency] ?? contractFrequency).toLowerCase()})` : ''}
                </option>
                {Object.entries(VISIT_FREQUENCY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Besök per år
              <input
                value={visits}
                onChange={(e) => setVisits(e.target.value)}
                inputMode="numeric"
                placeholder={contractVisits != null ? `förval ${contractVisits}` : frequency ? String(VISITS_PER_YEAR_BY_FREQUENCY[frequency] ?? '') : ''}
                className={inputCls}
              />
            </label>
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          {mode === 'on_demand'
            ? 'Enheten flaggas inte som "utan schema" i ronderingsöversikten. Extra besök bokas som vanliga ärenden.'
            : 'Takten visas vid schemaläggning och används för utfallet i § 3. Tom takt = avtalets förval.'}
        </p>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/50">
          <button onClick={onClose} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200">
            Avbryt
          </button>
          <button
            onClick={() =>
              onSave({
                serviceMode: mode,
                frequency: mode === 'inspection' && frequency ? frequency : null,
                visitsPerYear:
                  mode === 'inspection'
                    ? visits
                      ? Number(visits)
                      : frequency
                        ? (VISITS_PER_YEAR_BY_FREQUENCY[frequency] ?? null)
                        : null
                    : null,
              })
            }
            disabled={busy}
            className="bg-[#20c58f] text-[#fff] text-sm font-semibold rounded-xl px-4 py-2 hover:brightness-110 disabled:opacity-50"
          >
            Spara
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DatePromptPopover({ prompt, onClose }: { prompt: DatePrompt; onClose: () => void }) {
  const [customDate, setCustomDate] = useState('')
  const confirm = (date: string) => {
    onClose()
    prompt.onConfirm(date)
  }
  return (
    <div
      className="fixed z-[130] w-72 bg-slate-950 border border-slate-700 rounded-2xl p-3 shadow-2xl shadow-black/60"
      style={{ left: Math.min(prompt.x, window.innerWidth - 300), top: Math.min(prompt.y, window.innerHeight - 260) }}
    >
      <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-0.5">
        <Calendar className="w-3.5 h-3.5 text-[#20c58f]" />
        {prompt.title}
      </h4>
      <p className="text-[11px] text-slate-400 mb-2.5">{prompt.subject}</p>
      <div className="space-y-1.5">
        <button
          onClick={() => confirm(todayKey())}
          className="w-full flex items-center justify-between text-left text-xs rounded-lg border border-slate-700/60 px-3 py-2 text-slate-200 hover:border-[#20c58f] hover:bg-[#20c58f]/5 transition-colors"
        >
          Idag <span className="text-slate-500 tabular-nums">{formatDateSv(todayKey())}</span>
        </button>
        {prompt.contractStart && (
          <button
            onClick={() => confirm(prompt.contractStart as string)}
            className="w-full flex items-center justify-between text-left text-xs rounded-lg border border-slate-700/60 px-3 py-2 text-slate-200 hover:border-[#20c58f] hover:bg-[#20c58f]/5 transition-colors"
          >
            Avtalsstart <span className="text-slate-500 tabular-nums">{formatDateSv(prompt.contractStart)}</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DateField
              value={customDate}
              onChange={setCustomDate}
              aria-label="Annat datum (ÅÅÅÅ-MM-DD)"
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
            />
          </div>
          <button
            onClick={() => customDate && confirm(customDate)}
            disabled={!customDate}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#20c58f] text-[#fff] disabled:opacity-40"
          >
            Välj
          </button>
        </div>
      </div>
      <button onClick={onClose} className="mt-2 w-full text-center text-[11px] text-slate-500 hover:text-slate-300">
        Avbryt
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Avtalsdokumentet
// ---------------------------------------------------------------------------

/**
 * Papprets tre tillstånd. 'terminated-running' behåller det LEVANDE pappret —
 * ett avtal som sagts upp med tre månaders varsel faktureras och schemaläggs
 * fortfarande fram till sista giltiga dagen, och ska därför inte se arkiverat
 * ut. Det får i stället en uppsägningsremsa med nedräkning.
 */
type PaperState = 'active' | 'terminated-running' | 'archived'

/**
 * Papperspalett. Arkiverade avtal dämpas genom FÄRGVAL, aldrig genom opacity:
 * halvtransparent text läser som trasig, inte som arkiverad — och blir dessutom
 * oläslig. Bläcket #2f3540 mot #e4e2dc ger ~9,9:1, långt över AAA-kravet.
 *
 * Alla värden är literala hex, aldrig temavariabler. Pappret ska se likadant ut
 * i ljust och mörkt tema — det är ett dokument, inte en portalyta. Därav också
 * bg-[#fff]/xx i stället för bg-white/xx: --color-white remappas i ljust tema
 * och skulle göra fältytorna mörkblå.
 */
const PAPER_INK = {
  live: {
    sheet: '#f6f3ea',
    primary: '#262e38',
    secondary: '#5d6672',
    muted: '#8a9099',
    rule: '#d9d3c2',
    field: 'bg-[#fff]/55',
    fieldStrong: 'bg-[#fff]/70',
    positive: '#157a5b',
    warn: '#b45309',
    danger: '#9b3535',
    corner: '#ded9c8',
    valueBox: 'bg-black/[.035]',
  },
  archived: {
    sheet: '#e4e2dc',
    primary: '#2f3540',
    secondary: '#5a626e',
    muted: '#767d87',
    rule: '#c9c6be',
    field: 'bg-[#fff]/35',
    fieldStrong: 'bg-[#fff]/45',
    // Dämpade accenter: på ett avslutat avtal finns inget kvar att åtgärda,
    // så varken grönt eller bärnsten ska ropa på uppmärksamhet.
    positive: '#4a6b60',
    warn: '#7a6a4e',
    danger: '#9b3535',
    corner: '#cfccc4',
    valueBox: 'bg-black/[.05]',
  },
} as const

interface PaperProps {
  contract: RecordContract
  accent: string
  root: RecordCustomer
  customerById: Map<string, RecordCustomer>
  scope: RecordContractSite[]
  premiumEvents: CustomerRecordData['premiumEvents']
  followup: {
    nextVisit: RecordInspectionSession | null
    visitsDone: number
    visitsBooked: number
    casesDone: number
    casesOpen: number
    casesTotal: number
    covered: string[]
    caseIds: string[]
    units: UnitFollowup[]
  }
  /** § 3 per enhet: öppna redigering av enhetens besöksplan */
  onEditSitePlan?: (unit: UnitFollowup) => void
  /** § 9: förlängningsläge, option och nyttjande */
  onSaveRenewal?: (input: { renewalMode: 'rolling' | 'fixed' | 'option'; optionUntil: string | null; optionDecisionDeadline: string | null; reminderDays: number | null }) => Promise<void>
  onExerciseOption?: () => Promise<void>
  priceListLabel: string | null
  /**
   * Papprets livscykel. Styr både utseende och vilka åtgärder som finns:
   *   'active'             — ljust papper, allt öppet
   *   'terminated-running' — ljust papper + uppsägningsremsa med nedräkning.
   *                          Avtalet fungerar fortfarande till slutdatumet.
   *   'archived'           — dämpat papper, alla skrivåtgärder borta
   */
  state: PaperState
  onClearCoversAll?: () => void
  /** Bumpas när avtalsinnehållet sparats — tvingar omhämtning av § 4/§ 5 */
  contentReloadKey: number
  onEditContent?: () => void
  isDropTarget: boolean
  isInvalidTarget: boolean
  invalidReason: string | null
  awaiting: boolean
  dragSubject: string | null
  /** Vilken typ som dras (styr släpptexten) */
  dragKind?: DragPayload['type'] | null
  /** Greppet vid stämpeln: dra pappret till arkivet eller över ett annat papper */
  onPaperDrag?: (e: React.PointerEvent) => void
  isUnitContract: boolean
  /** Kunden saknar enheter — kundraden ÄR lokalen */
  isSingleSite: boolean
  registerRef: (el: HTMLElement | null) => void
  onHover: (on: boolean) => void
  onScopeRowDrag?: (e: React.PointerEvent, cs: RecordContractSite) => void
  onEndCoverage?: (cs: RecordContractSite, x: number, y: number) => void
  onEditPriceList?: (x: number, y: number) => void
  onOpenHistory: (tab: HistoryTab, unitFilter?: string) => void
  /** Avtalstyper (tjänster med is_contract_service) */
  contractTypes: string[]
  onChangeType?: (typeName: string) => void
  /** Endast portalskapade avtal går att radera */
  onDelete?: () => void
  /** Öppna besöksfrekvens-väljaren */
  onEditFrequency?: () => void
  /** Spara avtalsobjektets text */
  onSaveAgreementText?: (text: string | null) => Promise<void>
  /** Alla lokaler (enheter, eller kundraden själv) — § 8 listar dem avtalet omfattar */
  locations: RecordCustomer[]
  /** Släppzon under pekaren just nu ('refs' = § 8 Referenser) */
  dropZone?: DropZone
  /** § 7 Premie och fakturering */
  onSavePremium?: (input: { annualValue: number | null; billingFrequency: string | null; billingAnchorMonth: number | null }) => Promise<void>
  onAddPremiumEvent?: (input: {
    eventType: 'step_up' | 'indexation' | 'adjustment'
    effectiveFrom: string
    annualValue: number
    note: string | null
  }) => Promise<void>
  /** § 9 Löptid */
  onSaveTerm?: (input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }) => Promise<void>
  /** § 8 Referenser */
  onSaveInvoiceReference?: (input: { invoiceReference: string | null; diaryNumber: string | null }) => Promise<void>
  onSaveUnitReference?: (unit: RecordCustomer, code: string | null) => Promise<void>
  /** Enhet som just släppts på § 8 — dess rad öppnas för inmatning */
  refFocusUnitId?: string | null
  onRefFocusHandled?: () => void
  /** § 7: kundens faktureringsläge och fakturaplanens rader för avtalet */
  invoiceMode?: 'per_contract' | 'consolidated'
  planEntries?: PremiumPlanEntry[]
  onLinkFortnox?: (period: { periodStart: string; periodEnd: string; expectedSubtotal: number | null; kind?: string }) => void
  /** § 6: byt faktureringsläge på en tjänsterad */
  onChangeLineModel?: (item: CaseBillingItemWithRelations, model: 'premium' | 'per_year' | 'per_month' | 'per_round') => Promise<void>
  /** § 6: aktiva stationer på avtalets enheter */
  stationCount?: { outdoor: number; indoor: number; addon: number } | null
  /** § 6: brickor med tilläggsstationer att besluta om, och drag av dem */
  addonBricks?: AddonBrick[]
  onBrickDrag?: (e: React.PointerEvent, brick: AddonBrick) => void
  unitNameOf?: (unitId: string) => string
  onChangeEquipmentInvoiceMode?: (mode: 'with_premium' | 'separate') => Promise<void>
  /** Kundens läge för § 6 (bor på kunden, inte avtalet) */
  equipmentInvoiceMode?: 'with_premium' | 'separate'
  /** Öppna väljaren för signeringsdatum */
  onEditSignedAt?: () => void
  /** Spara avtalets säljare (den som skrivit under för BeGone) */
  onSaveSalesPerson?: (name: string | null) => Promise<void>
  /** Spara avtalets kundansvarige — speglas till enheterna i § 1 Omfattning */
  onSaveAccountManager?: (name: string | null, email: string | null) => Promise<void>
  /** Aktiv personal att välja säljare/kundansvarig bland — aldrig fritext */
  staff: { id: string; name: string; email?: string | null }[]
  /** Säg upp avtalet (saknas för redan avslutade) */
  onTerminate?: () => void
  /** Ångra uppsägning */
  onReactivate?: () => void
  /** Skicka ett nytt avtalsförslag till kunden via Oneflow, baserat på detta avtal */
  onRenew?: () => void
  /**
   * Vem som sade upp avtalet. contracts har ingen terminated_by-kolumn, så
   * namnet härleds ur uppsägningshändelsen i contract_events. Saknas det
   * utelämnas frasen helt — skriv aldrig "okänd".
   */
  terminatedBy?: string | null
  /** Kugghjulet på en paragraf: öppna inställningspanelen på rätt grupp */
  onOpenSettings?: (group: SettingsGroup) => void
  /** Panelen är öppen för det här avtalet */
  settingsOpen?: boolean
}

/** "3 år 2 mån" — hur länge avtalet faktiskt varade. */
function contractDurationLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return null
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  if (e.getDate() < s.getDate()) months -= 1
  if (months < 1) return 'under 1 mån'
  const years = Math.floor(months / 12)
  const rest = months % 12
  return [years > 0 ? `${years} år` : null, rest > 0 ? `${rest} mån` : null]
    .filter(Boolean)
    .join(' ')
}

function PaperContract({
  contract,
  accent,
  root,
  customerById,
  scope,
  premiumEvents,
  followup,
  priceListLabel,
  onClearCoversAll,
  contentReloadKey,
  onEditContent,
  isDropTarget,
  isInvalidTarget,
  invalidReason,
  awaiting,
  dragSubject,
  dragKind,
  onPaperDrag,
  isUnitContract,
  isSingleSite,
  registerRef,
  onHover,
  onScopeRowDrag,
  onEndCoverage,
  onOpenHistory,
  staff,
  onTerminate,
  onReactivate,
  onRenew,
  state,
  terminatedBy,
  locations,
  dropZone,
  onSavePremium,
  onAddPremiumEvent,
  onSaveTerm,
  onSaveInvoiceReference,
  onSaveUnitReference,
  refFocusUnitId,
  onRefFocusHandled,
  invoiceMode,
  planEntries,
  onLinkFortnox,
  onSaveRenewal,
  onExerciseOption,
  stationCount,
  addonBricks,
  onBrickDrag,
  unitNameOf,
  equipmentInvoiceMode = 'with_premium',
  onOpenSettings,
  settingsOpen,
}: PaperProps) {
  const key = todayKey()
  const archived = state === 'archived'
  const terminatedRunning = state === 'terminated-running'
  const ink = PAPER_INK[archived ? 'archived' : 'live']
  const contentData = useContractContent(contract.id, contentReloadKey)
  // Avropsavtal: § 5 visar ackumulerat utfall från avtalets ärenden i stället
  // för avtalsinnehållet (som är 0 kr på avrop). Samma ärendemängd som § 3.
  const isAvrop = contract.contract_type === 'Avropsavtal' || contract.label === 'Avropsavtal'
  const accumulatedOutcome = useAccumulatedCaseOutcome(isAvrop ? followup.caseIds : null, contentReloadKey)
  // Avtalets prislista styr vad kunden kan avropa och till vilket pris.
  // Saknas prislista på avtalet gäller kundens — samma uppslag som ärendena gör.
  const avropCatalog = useAvropCatalog(
    contract.price_list_id ?? root.price_list_id ?? null,
    contentData.content.services.map((s) => s.service_id).filter((id): id is string => !!id)
  )
  const annual = contractEffectiveAnnualValue(contract, premiumEvents)
  const nextStep = nextPremiumEvent(premiumEvents)
  const orgnr = contract.organization_number ?? root.organization_number
  const owner = customerById.get(contract.customer_id ?? '')
  // Lokalerna avtalet omfattar, i § 1:s ordning: täcker-alla → alla lokaler;
  // annars raden avtalet bor på (om den är en lokal) + § 1-enheterna.
  const coveredLocations: RecordCustomer[] = contract.covers_all_sites
    ? locations
    : [
        ...(owner && locations.some((l) => l.id === owner.id) ? [owner] : []),
        ...scope
          .map((cs) => customerById.get(cs.customer_id))
          .filter((c): c is RecordCustomer => !!c && c.id !== owner?.id),
      ]
  const frequency = contract.billing_frequency ? BILLING_FREQUENCY_LABEL[contract.billing_frequency] : null
  // Kräver ett numeriskt Oneflow-id. Den gamla kollen (bara !isImportedContract)
  // släppte igenom portalskapade avtal, vars syntetiska 'local-<uuid>' gav en
  // länk till ett dokument som inte finns.
  const oneflowUrl = oneflowContractUrl(contract)

  // Kompletthet och fas: samlar de villkor som tidigare stod utspridda som
  // orange texter på pappret. Raden under stämpeln försvinner när allt är klart.
  const completeness = computeCompleteness({
    contract,
    scope,
    isAvrop,
    isUnitContract,
    followupUnits: followup.units,
    breakdown: contentData.content.summary?.breakdown ?? null,
    pendingBricks: (addonBricks ?? []).length,
    uncoveredPeriods: (planEntries ?? []).filter((e) => e.action === 'uncovered').length,
    coveredUnits: coveredLocations,
  })
  const phase = contractPhase(contract, state, key)
  const nextEquipment = premiumSummary({ contract, annualInForce: annual, planEntries }).nextEquipment
  const gear = (group: SettingsGroup, title: string) =>
    onOpenSettings && !archived ? (
      <button
        type="button"
        onClick={() => onOpenSettings(group)}
        className={PAPER_GEAR_CLASS}
        style={{ borderColor: ink.rule, color: ink.muted }}
        title={title}
        aria-label={title}
      >
        ⚙
      </button>
    ) : null

  const startDate = contract.contract_start_date ?? contract.start_date
  const periodLabel = startDate
    ? `${formatDateSv(startDate)} – ${contract.contract_end_date ? formatDateSv(contract.contract_end_date) : 'tills vidare'}`
    : null
  const durationLabel = archived
    ? contractDurationLabel(startDate, contract.effective_end_date ?? contract.contract_end_date)
    : null

  return (
    <section
      ref={registerRef}
      // Arkiverade papper får INGET data-paper-id: findPaperAt() letar efter
      // attributet vid släpp, så utan det kan de inte ens träffas av en dragning.
      {...(archived ? {} : { 'data-paper-id': contract.id })}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`relative rounded-md rounded-tr-xl font-serif px-6 py-5 transition-all ${
        isDropTarget ? 'scale-[1.008]' : ''
      } ${settingsOpen ? 'ring-2 ring-[#20c58f]/60' : ''}`}
      style={{
        background: ink.sheet,
        color: ink.primary,
        // Uppsagt men löpande får bärnstenskant — då syns det redan i
        // kopplingslinjen till enheten att täckningen tar slut.
        borderLeft: `5px solid ${archived ? ink.muted : terminatedRunning ? '#b45309' : accent}`,
        boxShadow: isDropTarget
          ? `0 0 0 4px ${accent}55, 0 18px 48px rgba(0,0,0,.55)`
          : isInvalidTarget
            ? '0 0 0 4px rgba(248,113,113,.3), 0 16px 44px rgba(0,0,0,.5)'
            : archived
              // Platt skugga: arkiverade dokument ligger ner, de svävar inte.
              ? '0 1px 0 rgba(0,0,0,.28), inset 0 0 0 1px rgba(47,53,64,.07)'
              : '0 2px 0 rgba(0,0,0,.35), 0 16px 44px rgba(0,0,0,.5)',
      }}
    >
      {/* Vikt hörn */}
      <span
        className="absolute top-0 right-0 w-6 h-6 rounded-tr-xl rounded-bl-md"
        style={{ background: `linear-gradient(225deg, #0f172a 0 50%, ${ink.corner} 50% 100%)` }}
        aria-hidden
      />

      {/* Släpp-yta */}
      {(isDropTarget || isInvalidTarget) && (
        <div
          className="absolute inset-2 z-10 grid place-items-center rounded border-2 border-dashed font-sans text-sm font-semibold text-center px-4"
          style={{
            borderColor: isInvalidTarget ? '#f87171' : accent,
            background: 'rgba(246,243,234,.85)',
            color: isInvalidTarget ? '#9b3535' : '#262e38',
          }}
        >
          {isInvalidTarget
            ? invalidReason
            : dragKind === 'addon_stations'
              ? dropZone === 'premium'
                ? `Släpp: ${dragSubject} bakas in i årspremien (§ 7)`
                : `Släpp: ${dragSubject} läggs som tillägg utöver avtalet (§ 6)`
            : dragKind === 'paper'
              ? `Släpp: ${dragSubject} byter plats med det här pappret`
              : dragKind === 'catalog'
                ? dropZone === 'pricelist'
                  ? `Släpp: ${dragSubject} blir avtalets prislista (§ 2)`
                  : dropZone === 'equipment'
                    ? `Släpp: ${dragSubject} läggs till i § 6 Utrustning`
                    : dropZone === 'content'
                      ? `Släpp: ${dragSubject} läggs till i § 4 Tjänster i avtalet`
                      : `Släpp: ${dragSubject} läggs till på avtalet`
                : dropZone === 'refs'
                  ? `Släpp: sätt Er referens för ${dragSubject} i § 8`
                  : `Släpp: ${dragSubject} skrivs in i § 1 Omfattning`}
        </div>
      )}
      {awaiting && !isDropTarget && !isInvalidTarget && (
        <div
          className="absolute inset-2 z-10 rounded border-2 border-dashed pointer-events-none"
          style={{ borderColor: `${accent}66` }}
          aria-hidden
        />
      )}

      {/* Huvud */}
      <div className="flex items-start gap-3.5">
        <span
          className="shrink-0 w-10 h-10 rounded-full grid place-items-center border-[1.5px]"
          style={{ borderColor: accent, background: `${accent}20` }}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: accent }} />
        </span>
        <div className="min-w-0">
          <div
            className="font-sans text-[9.5px] uppercase tracking-[0.2em] mb-0.5"
            style={{ color: ink.muted }}
          >
            {isUnitContract ? 'Enhetsavtal' : 'Organisationsavtal'} · BeGone Skadedjur &amp; Sanering
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-bold leading-snug" style={{ color: ink.primary }}>
              {contractDisplayName(contract)}
            </h3>
            {gear('avtalet', 'Inställningar för avtalet')}
          </div>
          <div className="text-[11.5px] italic mt-0.5" style={{ color: ink.secondary }}>
            mellan BeGone Skadedjur &amp; Sanering AB och {isUnitContract && owner ? customerRowName(owner) + ', ' : ''}
            {root.company_name}
            {orgnr ? ` (${orgnr})` : ''}
          </div>
          {/* Fasen: Utkast, Signerat, Aktivt, Uppsagt, Arkiverat. Ett utkast ska
              inte faktureras, och kollegan ser direkt var avtalet befinner sig. */}
          <div className="flex items-center gap-0.5 mt-1.5 font-sans text-[9px] uppercase tracking-[0.12em]" aria-label={`Fas: ${CONTRACT_PHASE_LABEL[phase]}`}>
            {CONTRACT_PHASES.map((ph, i) => (
              <span key={ph} className="flex items-center gap-0.5">
                {i > 0 && <span style={{ color: ink.rule }}>·</span>}
                <span
                  className={ph === phase ? 'font-bold' : ''}
                  style={{
                    color: ph === phase ? (phase === 'uppsagt' ? ink.warn : phase === 'arkiverat' ? ink.secondary : phase === 'utkast' ? ink.warn : ink.positive) : ink.muted,
                    opacity: ph === phase ? 1 : 0.55,
                  }}
                >
                  {CONTRACT_PHASE_LABEL[ph]}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div
          className={`ml-auto shrink-0 text-center self-center ${onPaperDrag ? 'cursor-grab select-none touch-none' : ''}`}
          onPointerDown={onPaperDrag}
          title={onPaperDrag ? 'Dra pappret till arkivet för att säga upp det, eller över ett annat papper för att byta ordning' : undefined}
        >
          <ContractStamp
            variant={archived ? 'ended' : terminatedRunning ? 'terminated' : 'active'}
            color={state === 'active' ? accent : undefined}
            subLabel={
              terminatedRunning && contract.effective_end_date
                ? `T.O.M. ${formatDateSv(contract.effective_end_date)}`
                : archived
                  ? formatDateSv(contract.effective_end_date ?? contract.contract_end_date)
                  : null
            }
          />
          {oneflowUrl && (
            <a
              href={oneflowUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex items-center justify-center gap-1 font-sans text-[10px] hover:opacity-70 transition-opacity"
              style={{ color: ink.muted }}
            >
              Signerat via Oneflow <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Uppsägningsremsa: bara på avtal som sagts upp men fortfarande löper.
          Avtalet fungerar som vanligt till slutdatumet — remsan säger när det
          upphör, och nedräkningen blir röd sista månaden. */}
      {terminatedRunning && contract.effective_end_date && (() => {
        const left = daysUntilEnd(contract)
        const urgent = left !== null && left <= 30
        return (
          <div
            className="mt-3 flex items-center gap-2.5 rounded-md px-3 py-2 font-sans"
            style={{
              border: '1px solid rgba(180,83,9,.45)',
              background: 'rgba(180,83,9,.08)',
            }}
          >
            <ClockAlert className="w-3.5 h-3.5 shrink-0" style={{ color: '#b45309' }} />
            <span className="text-[11.5px] leading-relaxed" style={{ color: '#7a3c07' }}>
              Uppsagt{contract.terminated_at ? ` ${formatDateSv(contract.terminated_at.slice(0, 10))}` : ''} — avtalet gäller till och med{' '}
              <b className="tabular-nums">{formatDateSv(contract.effective_end_date)}</b>.
              Fakturering och schemaläggning fortsätter till dess.
            </span>
            <span className="ml-auto shrink-0 text-right">
              <span
                className={`block text-[15px] tabular-nums leading-none ${urgent ? 'font-extrabold' : 'font-bold'}`}
                style={{ color: urgent ? '#9b3535' : '#b45309' }}
              >
                {left === 0 ? 'Idag' : left}
              </span>
              <span
                className="block text-[9px] uppercase tracking-[0.14em]"
                style={{ color: ink.muted }}
              >
                {left === 0 ? 'sista dagen' : 'dagar kvar'}
              </span>
            </span>
          </div>
        )
      })()}

      {/* Kompletthetsraden: det enda stället pappret säger vad som saknas.
          Varje punkt öppnar panelen på rätt grupp. Försvinner när allt är klart. */}
      {!archived && !completeness.complete && (
        <div
          className="mt-3 px-3 py-2 rounded-md font-sans text-[11.5px] flex flex-wrap items-baseline gap-x-4 gap-y-1"
          style={{ border: '1px solid rgba(180,83,9,.35)', background: 'rgba(180,83,9,.07)', color: ink.warn }}
        >
          <b>
            Avtalet är inte komplett · {completeness.missing.length} av {completeness.vitalTotal} delar saknas
          </b>
          {completeness.missing.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onOpenSettings?.(m.group)}
              className="underline decoration-dotted hover:opacity-80"
              title={m.hint}
            >
              ○ {m.label} ({m.paragraph})
            </button>
          ))}
        </div>
      )}

      {/* Värderad */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-3.5 mb-1 px-3 py-2.5 rounded-md bg-black/[.035]">
        <span className="text-xl font-bold tabular-nums text-[#262e38]">
          {annual > 0 ? formatKr(annual) : 'Avrop'}
          <span className="text-xs font-normal text-[#5d6672]">
            {annual > 0 ? `/år${frequency ? ` · faktureras ${frequency}` : ''}` : ' — fasta priser per ärende'}
          </span>
        </span>
        <button
          onClick={() => onOpenHistory('tidslinje')}
          className="font-sans text-[11.5px] text-[#5d6672] hover:bg-black/5 rounded px-1.5 py-0.5 inline-flex items-center gap-1.5"
          title="Visa avtalets tidslinje"
        >
          <Clock className="w-3 h-3" />
          {nextStep
            ? <>→ <b className="text-[#262e38]">{formatKr(Number(nextStep.annual_value))}/år</b> fr. {formatDateSv(nextStep.effective_from)}</>
            : 'Tidslinje'}
          <span className="underline decoration-dotted text-[10px] text-[#8a9099]">visa händelser</span>
        </button>
        {periodLabel && <span className="ml-auto text-[11.5px] italic text-[#5d6672]">{periodLabel}</span>}
      </div>

      {/* § 1 Omfattning */}
      <div className="mt-3 group/para">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 1 · Omfattning</h4>
          {gear('omfattning', 'Inställningar för omfattning')}
          <span className="ml-auto font-sans text-[10.5px] text-[#8a9099] tabular-nums">
            {contract.covers_all_sites
              ? 'hela verksamheten'
              : isUnitContract
                ? 'enhetsavtal'
                : isSingleSite
                  ? `${scope.length} av 1 lokal`
                  : `${scope.length} enhet${scope.length === 1 ? '' : 'er'}`}
          </span>
        </div>
        {contract.covers_all_sites ? (
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] border-b border-dotted border-[#d9d3c2]">
            <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">1.1</span>
            <span className="font-semibold text-[#262e38]">Hela verksamheten</span>
            <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
            <span className="text-[11.5px] text-[#5d6672] whitespace-nowrap">
              samtliga nuvarande och framtida enheter
            </span>
            {onClearCoversAll && (
              <button
                onClick={onClearCoversAll}
                className="shrink-0 w-5 h-5 grid place-items-center rounded-full text-[#8a9099] hover:bg-black/10 hover:text-[#262e38] text-sm leading-none"
                aria-label="Byt till omfattning per enhet"
                title="Byt till omfattning per enhet"
              >
                ×
              </button>
            )}
          </div>
        ) : isUnitContract && owner ? (
          <div className="flex items-center gap-2.5 py-2 text-[13.5px] border-b border-dotted border-[#d9d3c2]">
            <span className="w-6 text-[11px] text-[#8a9099] tabular-nums">1.1</span>
            <span className="font-semibold text-[#262e38]">{customerRowName(owner)}</span>
            <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1" />
            <span className="text-[11.5px] text-[#5d6672]">avtalet bor på enheten</span>
          </div>
        ) : (
          <>
            {scope.map((cs, i) => {
              const unit = customerById.get(cs.customer_id)
              const isFuture = !!cs.active_from && cs.active_from > key
              return (
                <div
                  key={cs.id}
                  onPointerDown={onScopeRowDrag ? (e) => onScopeRowDrag(e, cs) : undefined}
                  className={`group flex items-center gap-2.5 py-2 text-[13.5px] border-b border-dotted rounded-sm ${
                    onScopeRowDrag
                      ? 'cursor-grab select-none touch-none hover:bg-black/[.04]'
                      : 'cursor-default'
                  }`}
                  style={{ borderColor: ink.rule }}
                  title={onScopeRowDrag ? 'Dra till ett annat avtal för att flytta täckningen' : undefined}
                >
                  <span
                    className="w-6 text-[11px] tabular-nums shrink-0"
                    style={{ color: ink.muted }}
                  >
                    1.{i + 1}
                  </span>
                  <span className="font-semibold truncate" style={{ color: ink.primary }}>
                    {unit ? (isSingleSite ? unit.company_name : customerRowName(unit)) : 'Okänd enhet'}
                  </span>
                  <span
                    className="flex-1 border-b border-dotted translate-y-1 min-w-4"
                    style={{ borderColor: ink.rule }}
                  />
                  {/* Framtidsmarkeringen neutraliseras på arkiverade avtal —
                      där finns inget kommande att bevaka. */}
                  <span
                    className={`text-[11.5px] tabular-nums whitespace-nowrap shrink-0 ${
                      isFuture && !archived ? 'font-semibold' : ''
                    }`}
                    style={{
                      color: isFuture && !archived ? '#b45309' : archived ? ink.muted : ink.secondary,
                    }}
                  >
                    gäller fr. {formatDateSv(cs.active_from)}
                  </span>
                  {onEndCoverage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEndCoverage(cs, e.clientX, e.clientY)
                      }}
                      className="shrink-0 w-5 h-5 grid place-items-center rounded-full text-[#8a9099] hover:bg-black/10 hover:text-[#262e38] text-sm leading-none"
                      aria-label={`Avsluta täckning för ${unit ? customerRowName(unit) : 'enheten'}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
            {scope.length === 0 && (
              <div className="flex items-center gap-2 py-3 text-[12.5px] italic text-[#8a9099]">
                <Home className="w-3.5 h-3.5" />
                {isSingleSite
                  ? `${root.company_name} omfattas inte ännu — dra in lokalen från vänster.`
                  : 'Inga enheter omfattas ännu — dra in dem från vänster.'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Avtalsobjekt — vad som ingår, antal stationer per plats,
          besöksintervall. Kommer från Oneflow vid signering, men går att
          fylla i för hand på äldre och manuella avtal. */}
      <AgreementObjectText text={contract.agreement_text ?? null} ink={ink} />

      {/* § 2 Prislista — släppzon för prislistor från katalogen */}
      <div className="mt-3.5 group/para" data-drop-zone="pricelist">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 2 · Prislista för avrop</h4>
          {gear('prislista', 'Inställningar för prislista')}
          {avropCatalog.catalog.priced.length > 0 && (
            <span className="ml-auto font-sans text-[10.5px] text-[#8a9099] tabular-nums">
              {avropCatalog.catalog.priced.length} till fast pris
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 pt-2">
          <div className="min-w-0">
            <div className="font-bold text-[13.5px] text-[#262e38]">{priceListLabel ?? 'Ingen egen prislista'}</div>
            <div className="font-sans text-[11px] text-[#8a9099]">
              {priceListLabel
                ? 'Gäller avrop och tillägg per ärende — följer med till fakturan.'
                : 'Kundens prislista (eller prisguiden) gäller för avrop på avtalets enheter.'}
            </div>
          </div>
        </div>

        {/* Vad kunden kan avropa: fasta priser + övriga mot offert */}
        <ContractPriceListSection
          catalog={avropCatalog.catalog}
          loading={avropCatalog.loading}
          priceListLabel={priceListLabel}
        />
      </div>

      {/* § 3 Uppföljning: vad kunden betalat för. Facit vid schemaläggning.
          Utfallet (besök gjorda, nästa besök, ärenden) bor i pulsen. */}
      <div className="mt-3.5 group/para">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 3 · Uppföljning</h4>
          {gear('uppfoljning', 'Inställningar för uppföljning')}
          <span className="ml-auto font-sans text-[10.5px] tabular-nums" style={{ color: ink.muted }}>
            {contract.visits_per_year
              ? `${contract.visits_per_year} besök/år`
              : contract.visit_frequency
                ? VISIT_FREQUENCY_LABEL[contract.visit_frequency]
                : isAvrop
                  ? 'avrop'
                  : ''}
          </span>
        </div>
        {/* Per enhet: driftläge, takt och utfall i avtalsåret. Takten ärvs från
            avtalets förval tills enheten får en egen (contract_sites). */}
        {followup.units.length > 0 && (
          <div className="pt-1">
            {followup.units.map((u, i) => {
              const unit = customerById.get(u.unitId)
              const behind = u.serviceMode === 'inspection' && u.expectedSoFar != null && u.doneThisYear < u.expectedSoFar
              const noSchedule = u.serviceMode === 'inspection' && !u.nextVisitAt
              return (
                <div
                  key={u.unitId}
                  className="flex items-center gap-2.5 py-1.5 text-[13px]"
                  style={{ borderBottom: `1px dotted ${ink.rule}` }}
                >
                  <span className="font-sans text-[10.5px] w-6 tabular-nums" style={{ color: ink.muted }}>
                    3.{i + 1}
                  </span>
                  <span className="font-semibold">{unit ? customerRowName(unit) : 'Enhet'}</span>
                  <span className="flex-1 border-b border-dotted mx-1 translate-y-1 min-w-3" style={{ borderColor: ink.rule }} />
                  <span className="font-sans text-[11px]" style={{ color: u.inherited ? ink.muted : ink.secondary }}>
                    {u.serviceMode === 'on_demand'
                      ? 'avrop'
                      : `stationskontroll${u.frequency ? ` · ${(VISIT_FREQUENCY_LABEL[u.frequency] ?? u.frequency).toLowerCase()}` : ''}`}
                  </span>
                  {u.serviceMode === 'inspection' && u.visitsPerYear != null && (
                    <span className="font-sans text-[11.5px] tabular-nums" style={{ color: behind ? ink.warn : ink.positive }}>
                      {u.doneThisYear} av {u.visitsPerYear} i år
                    </span>
                  )}
                  <span className="font-sans text-[11.5px] tabular-nums whitespace-nowrap" style={{ color: noSchedule ? ink.warn : ink.secondary }}>
                    {u.serviceMode === 'on_demand'
                      ? `${u.casesThisYear} ärende${u.casesThisYear === 1 ? '' : 'n'} i år`
                      : u.nextVisitAt
                        ? `nästa ${formatDateSv(u.nextVisitAt)}`
                        : 'inget schema'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* § 4 Tjänster i avtalet + § 5 Marginal */}
      {/* § 4 + § 5 — släppzon för tjänster från katalogen */}
      <div data-drop-zone="content">
        <ContractContentSection
          content={contentData.content}
          loading={contentData.loading}
          onEdit={onEditContent}
          onOpenSettings={onOpenSettings && !archived ? () => onOpenSettings('innehall') : undefined}
          annualInForce={annual > 0 ? annual : null}
          onOpenPremium={onOpenSettings && !archived ? () => onOpenSettings('fakturering') : undefined}
          showAccumulated={isAvrop}
          accumulated={accumulatedOutcome.summary}
          accumulatedLoading={accumulatedOutcome.loading}
        />
      </div>

      {/* § 6 Utrustning i avtalet — samma rader som § 4/§ 5, med faktureringsläge.
          Släppzon för utrustning och stationstyper från katalogen. */}
      <div data-drop-zone="equipment" id={`para6-${contract.id}`} className="transition-shadow duration-500 rounded-sm">
        <ContractEquipmentSection
          services={contentData.content.services}
          articles={contentData.content.articles}
          loading={contentData.loading}
          ink={ink}
          archived={archived}
          onOpenSettings={onOpenSettings ? () => onOpenSettings('innehall') : undefined}
          stationCount={stationCount}
          bricks={addonBricks}
          onBrickPointerDown={onBrickDrag}
          unitNameOf={unitNameOf}
          equipmentInvoiceMode={equipmentInvoiceMode}
          nextEquipmentInvoice={
            nextEquipment ? { periodStart: nextEquipment.periodStart, subtotal: nextEquipment.subtotal, monthly: nextEquipment.kind === 'equipment_monthly' } : null
          }
        />
      </div>

      {/* § 7 Premie och fakturering — avtalet är källan till årspremiefakturan.
          Släppzon: dra en bricka med tilläggsstationer hit för att baka in dem i premien. */}
      <div
        data-drop-zone="premium"
        className={`rounded transition-shadow ${
          dropZone === 'premium' && (isDropTarget || isInvalidTarget) ? 'ring-2 ring-offset-2 ring-[#20c58f]' : ''
        }`}
        style={dropZone === 'premium' && (isDropTarget || isInvalidTarget) ? { ['--tw-ring-offset-color' as string]: ink.sheet } : undefined}
      >
        <ContractPremiumSection
          contract={contract}
          premiumEvents={premiumEvents}
          annualInForce={annual}
          ink={ink}
          archived={archived}
          onSavePremium={onSavePremium}
          onAddPremiumEvent={onAddPremiumEvent}
          invoiceMode={invoiceMode}
          planEntries={planEntries}
          onLinkFortnox={onLinkFortnox}
          onOpenSettings={onOpenSettings ? () => onOpenSettings('fakturering') : undefined}
          equipmentInvoiceMode={equipmentInvoiceMode}
        />
      </div>

      {/* § 8 Referenser — avtalets referens + Er referens per enhet i omfattningen.
          Släppzon: dra in en enhet från vänster för att sätta dess kod. */}
      <div
        data-drop-zone="refs"
        className={`rounded transition-shadow ${
          dropZone === 'refs' && (isDropTarget || isInvalidTarget) ? 'ring-2 ring-offset-2 ring-[#20c58f]' : ''
        }`}
        style={dropZone === 'refs' && (isDropTarget || isInvalidTarget) ? { ['--tw-ring-offset-color' as string]: ink.sheet } : undefined}
      >
        <ContractReferencesSection
          contract={contract}
          coveredLocations={coveredLocations}
          ink={ink}
          archived={archived}
          onSaveInvoiceReference={onSaveInvoiceReference}
          onSaveUnitReference={onSaveUnitReference}
          focusUnitId={refFocusUnitId}
          onFocusHandled={onRefFocusHandled}
          onOpenSettings={onOpenSettings ? () => onOpenSettings('referenser') : undefined}
        />
      </div>

      {/* § 9 Löptid och option */}
      <ContractTermSection
        contract={contract}
        ink={ink}
        archived={archived}
        onSaveTerm={onSaveTerm}
        onSaveRenewal={onSaveRenewal}
        onExerciseOption={onExerciseOption}
        onTerminate={onTerminate}
        onOpenSettings={onOpenSettings ? () => onOpenSettings('loptid') : undefined}
      />

      {/* Avslutsnotis — bara på arkiverade avtal. Sammanfattar vad som hände
          och hur länge relationen varade, plus den enda framåtriktade
          åtgärden: skicka ett nytt förslag byggt på det här avtalet. */}
      {archived && (
        <div className="mt-4 pt-3" style={{ borderTop: `1.5px solid ${ink.rule}` }}>
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 w-7 h-7 rounded-full grid place-items-center"
              style={{
                border: '1px solid rgba(155,53,53,.35)',
                background: 'rgba(155,53,53,.07)',
              }}
            >
              <Archive className="w-3.5 h-3.5" style={{ color: ink.danger }} />
            </span>
            <div className="min-w-0 font-sans">
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.16em] mb-1"
                style={{ color: ink.muted }}
              >
                Avtalet är avslutat
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11.5px] leading-relaxed">
                {contract.terminated_at && (
                  <>
                    <dt style={{ color: ink.muted }}>Uppsagt</dt>
                    <dd className="tabular-nums" style={{ color: ink.primary }}>
                      {formatDateSv(contract.terminated_at.slice(0, 10))}
                      {terminatedBy ? ` av ${terminatedBy}` : ''}
                    </dd>
                  </>
                )}
                <dt style={{ color: ink.muted }}>Gällde t.o.m.</dt>
                <dd className="font-semibold tabular-nums" style={{ color: ink.primary }}>
                  {formatDateSv(contract.effective_end_date ?? contract.contract_end_date)}
                </dd>
                {periodLabel && (
                  <>
                    <dt style={{ color: ink.muted }}>Löptid</dt>
                    <dd className="tabular-nums" style={{ color: ink.secondary }}>
                      {periodLabel}
                      {durationLabel ? ` · ${durationLabel}` : ''}
                    </dd>
                  </>
                )}
                <dt style={{ color: ink.muted }}>Signerat</dt>
                <dd className="tabular-nums" style={{ color: ink.secondary }}>
                  {contract.signed_at ? formatDateSv(contract.signed_at) : '–'}
                </dd>
                {contract.termination_reason && (
                  <>
                    <dt style={{ color: ink.muted }}>Orsak</dt>
                    <dd style={{ color: ink.primary }}>{contract.termination_reason}</dd>
                  </>
                )}
              </dl>
              {!contract.termination_reason && (
                <p className="text-[10.5px] italic mt-1" style={{ color: ink.muted }}>
                  Ingen orsak registrerad.
                </p>
              )}
              {onReactivate && (
                <button
                  onClick={onReactivate}
                  className="mt-1.5 text-[10px] underline decoration-dotted transition-colors hover:opacity-70"
                  style={{ color: ink.muted }}
                  title="Ångra uppsägningen — avtalet blir aktivt igen"
                >
                  Ångra uppsägningen
                </button>
              )}
            </div>

            {/* Enda knappen på hela det arkiverade pappret. Att den lyser
                brandgrönt mot dämpat papper är hela poängen — allt annat här
                är historik, det här är vägen framåt. */}
            {onRenew && (
              <div className="ml-auto shrink-0 self-center text-right">
                <button
                  onClick={onRenew}
                  className="inline-flex items-center gap-2 font-sans text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3.5 py-2 shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] focus-visible:ring-offset-2 transition-all"
                  style={{ ['--tw-ring-offset-color' as string]: ink.sheet }}
                  title="Skapa ett nytt avtalsförslag i Oneflow baserat på det här avtalet"
                >
                  <FileSignature className="w-3.5 h-3.5" />
                  Förnya avtal
                </button>
                <p
                  className="text-[10px] mt-1 max-w-[9.5rem] leading-snug"
                  style={{ color: ink.muted }}
                >
                  Nytt förslag till kunden via Oneflow, baserat på detta avtal
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fot */}
      <div className="flex items-end gap-5 mt-4">
        {/* Säljaren som skrivit under för BeGone. Wizarden fyller alltid i
            fältet, men manuellt upplagda och importerade avtal saknar det —
            då faller signaturen tillbaka på kundkortets säljare, som kan vara
            fel person för just det avtalet. Klick redigerar direkt i
            skrivstilen; utseendet är identiskt före och efter. */}
        <div className="shrink-0 space-y-1.5">
          <SignatureLine
            value={contract.begone_employee_name ?? null}
            fallback={root.sales_person ?? null}
            ink={ink}
            archived={archived}
            staff={staff}
          />
          {/* Kundansvarig hör till avtalet och dess omfattning — kunden kan ha
              två avtal med olika ansvariga. Kundkortets värde visas som dämpad
              fallback tills avtalet fått ett eget. */}
          <AccountManagerLine
            value={contract.account_manager_name ?? null}
            email={contract.account_manager_email ?? null}
            fallback={root.assigned_account_manager ?? null}
            ink={ink}
            archived={archived}
            staff={staff}
          />
        </div>
        {/* Signeringsdatum som läsning. Uppsägning, ångra och radering bor
            under Löptid i panelen, inte som länkar i foten. */}
        {!archived && (
          <div className="ml-auto text-right font-sans text-[10px] leading-relaxed" style={{ color: ink.muted }}>
            {contract.signed_at ? (
              <>Signerat {formatDateSv(contract.signed_at)}</>
            ) : onOpenSettings ? (
              <button type="button" onClick={() => onOpenSettings('avtalet')} className="underline decoration-dotted" style={{ color: ink.warn }}>
                Signeringsdatum saknas
              </button>
            ) : (
              'Signeringsdatum saknas'
            )}
            {contract.notice_period_months ? ` · Uppsägningstid ${contract.notice_period_months} mån` : ''}
            {onOpenSettings && (
              <>
                <br />
                <button type="button" onClick={() => onOpenSettings('loptid')} className="underline decoration-dotted hover:opacity-70">
                  Uppsägning och radering under Löptid
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
