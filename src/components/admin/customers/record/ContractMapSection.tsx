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
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
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
  BILLING_FREQUENCY_LABEL,
  type CustomerRecordData,
  type RecordContract,
  type RecordContractSite,
  type RecordCustomer,
  type RecordInspectionSession,
} from '../../../../hooks/useCustomerRecord'
import { ContractScopeService } from '../../../../services/contractScopeService'
import { PriceListService } from '../../../../services/priceListService'
import type { PriceList } from '../../../../types/articles'
import { isCompletedStatus, type ClickUpStatus } from '../../../../types/database'
import ContractHistoryModal, { type HistoryTab } from './ContractHistoryModal'
import ContractContentSection, { useContractContent } from './ContractContentSection'
import ContractPriceListSection, { useAvropCatalog } from './ContractPriceListSection'
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

interface DragState {
  payload: DragPayload
  started: boolean
  x: number
  y: number
  overContractId: string | null
  invalidReason: string | null
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
  const [busy, setBusy] = useState(false)
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
    const papers = contracts.filter((c) => !c.fromCustomerRow && !isImportedContract(c) && !isEndedContract(c))
    const leftovers = contracts.filter((c) => (c.fromCustomerRow || isImportedContract(c)) && !isEndedContract(c))
    // Kundkortsavtal som kan materialiseras till riktiga avtalsrader
    const customerRowContracts = leftovers.filter((c) => c.fromCustomerRow)
    const endedCount = contracts.filter((c) => isEndedContract(c)).length

    const accentByContract = new Map<string, string>()
    papers.forEach((c, i) => accentByContract.set(c.id, ACCENTS[i % ACCENTS.length]))

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
      endedCount,
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
    endedCount,
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

  const findPaperAt = (x: number, y: number): RecordContract | null => {
    const el = document.elementFromPoint(x, y)
    const paperEl = el?.closest<HTMLElement>('[data-paper-id]')
    if (!paperEl) return null
    return papers.find((c) => c.id === paperEl.dataset.paperId) ?? null
  }

  const startDrag = (e: React.PointerEvent, payload: DragPayload) => {
    if (busy || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setDrag({ payload, started: false, x: e.clientX, y: e.clientY, overContractId: null, invalidReason: null })
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
      const over = findPaperAt(e.clientX, e.clientY)
      setDrag({
        ...prev,
        started: true,
        x: e.clientX,
        y: e.clientY,
        overContractId: over?.id ?? null,
        invalidReason: over ? validateDrop(prev.payload, over) : null,
      })
    }
    const onUp = (e: PointerEvent) => {
      const prev = dragRef.current
      setDrag(null)
      if (!prev?.started) return
      const over = findPaperAt(e.clientX, e.clientY)
      if (!over) return
      const err = validateDrop(prev.payload, over)
      if (err) {
        toast.error(err)
      } else {
        openDatePromptForDrop(prev.payload, over, e.clientX, e.clientY)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, validateDrop, papers])

  const openDatePromptForDrop = (payload: DragPayload, contract: RecordContract, x: number, y: number) => {
    // "Hela verksamheten" → fråga först om det gäller även framtida enheter
    if (payload.type === 'org') {
      setScopeModePrompt({ x, y, contract })
      return
    }
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
      } else {
        await ContractScopeService.addSite(contract.id, payload.unitId, date)
        toast.success(
          `${customerRowName(customerById.get(payload.unitId)!)} står nu i § 1 Omfattning för ${contractDisplayName(contract)} från ${formatDateSv(date)}.`
        )
      }
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte uppdatera omfattningen')
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
          toast.success(`Täckningen för ${unitName} avslutas ${formatDateSv(date)}.`)
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
  const materializeContract = async (customerRowContract: RecordContract | null) => {
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
        customerRowContract?.label ?? customerRowContract?.contract_type ?? undefined,
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

  const changePriceList = async (contract: RecordContract, priceListId: string | null) => {
    setPricePrompt(null)
    if ((contract.price_list_id ?? null) === priceListId) return
    setBusy(true)
    try {
      await ContractScopeService.setPriceList(contract.id, priceListId, {
        from: priceListName(contract.price_list_id),
        to: priceListName(priceListId),
      })
      toast.success(
        priceListId
          ? `Prislistan för ${contractDisplayName(contract)} är nu ${priceListName(priceListId) ?? 'uppdaterad'} — gäller nya ärenden direkt.`
          : `Prislistan togs bort från ${contractDisplayName(contract)} — kundens prislista gäller.`
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

      return {
        nextVisit,
        visitsDone,
        visitsBooked: booked.length,
        casesDone,
        casesOpen: list.length - casesDone,
        casesTotal: list.length,
        covered,
      }
    },
    [activeScopeByContract, cases, inspections, locations]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hoverMatch = (unitId: string, contractId: string): 'hot' | 'dim' | 'normal' => {
    if (!hover) return 'normal'
    const match = hover.kind === 'unit' ? hover.id === unitId : hover.id === contractId
    return match ? 'hot' : 'dim'
  }

  const dragSourceUnitId = drag?.started
    ? drag.payload.type === 'org'
      ? null
      : drag.payload.unitId
    : null

  return (
    <div>
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
        {endedCount > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Avslutade avtal</div>
            <div className="text-lg font-bold tabular-nums text-slate-500">{endedCount}</div>
          </div>
        )}
        <p className="ml-auto self-center text-xs text-slate-500 max-w-md">
          Dra en enhet in i ett avtal för att skriva in den i omfattningen. Ändringar sparas direkt i databasen.
        </p>
      </div>

      <div ref={boardRef} className="relative grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-10 items-start">
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
        <aside className="relative z-10 bg-slate-800/30 border border-slate-700 rounded-2xl p-4 lg:sticky lg:top-4">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Verksamheten</h3>

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
        </aside>

        {/* Höger: avtalsdokumenten */}
        <main className="relative z-10 space-y-6 min-w-0">
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
              dragSubject={
                drag?.started
                  ? drag.payload.type === 'org'
                    ? 'Hela verksamheten'
                    : customerRowName(customerById.get(drag.payload.unitId) ?? ({ company_name: 'Enheten' } as RecordCustomer))
                  : null
              }
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
              onOpenHistory={(tab, unitFilter) => setHistory({ contract: c, tab, unitFilter: unitFilter ?? '' })}
              isUnitContract={!isSingleSite && unitIds.has(c.customer_id ?? '')}
              isSingleSite={isSingleSite}
            />
          ))}

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
                    onClick={() => materializeContract(c)}
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
                    </span>
                    <button
                      onClick={() => materializeContract(c.fromCustomerRow ? c : null)}
                      disabled={busy}
                      className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#20c58f] border border-[#20c58f]/40 rounded-lg px-2.5 py-1 hover:bg-[#20c58f]/10 transition-colors disabled:opacity-50"
                      title={
                        c.fromCustomerRow
                          ? 'Skapa ett riktigt avtal av kundkortets data'
                          : 'Skapa ett riktigt avtal på kundraden (importresten lämnas orörd)'
                      }
                    >
                      <FileText className="w-3 h-3" />
                      Skapa avtal
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </main>
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
          ) : (
            <Home className="w-4 h-4 text-slate-300" />
          )}
          <span>
            {drag.payload.type === 'org'
              ? 'Hela verksamheten'
              : customerRowName(customerById.get(drag.payload.unitId) ?? ({ company_name: 'Enhet' } as RecordCustomer))}
            <span className={`block text-[10px] font-normal ${drag.invalidReason ? 'text-red-400' : 'text-[#20c58f]'}`}>
              {drag.invalidReason ??
                (drag.overContractId ? 'Släpp för att skriva in i avtalet' : 'Släpp på ett avtal')}
            </span>
          </span>
        </div>
      )}

      {/* Datum-popover */}
      {datePrompt && (
        <DatePromptPopover prompt={datePrompt} onClose={() => setDatePrompt(null)} />
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
// Datum-popover: Idag / Avtalsstart / valfritt datum
// ---------------------------------------------------------------------------

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
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#20c58f] [color-scheme:dark]"
            aria-label="Annat datum"
          />
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
  }
  priceListLabel: string | null
  onClearCoversAll: () => void
  /** Bumpas när avtalsinnehållet sparats — tvingar omhämtning av § 4/§ 5 */
  contentReloadKey: number
  onEditContent: () => void
  isDropTarget: boolean
  isInvalidTarget: boolean
  invalidReason: string | null
  awaiting: boolean
  dragSubject: string | null
  isUnitContract: boolean
  /** Kunden saknar enheter — kundraden ÄR lokalen */
  isSingleSite: boolean
  registerRef: (el: HTMLElement | null) => void
  onHover: (on: boolean) => void
  onScopeRowDrag: (e: React.PointerEvent, cs: RecordContractSite) => void
  onEndCoverage: (cs: RecordContractSite, x: number, y: number) => void
  onEditPriceList: (x: number, y: number) => void
  onOpenHistory: (tab: HistoryTab, unitFilter?: string) => void
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
  isUnitContract,
  isSingleSite,
  registerRef,
  onHover,
  onScopeRowDrag,
  onEndCoverage,
  onEditPriceList,
  onOpenHistory,
}: PaperProps) {
  const key = todayKey()
  const contentData = useContractContent(contract.id, contentReloadKey)
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
  const frequency = contract.billing_frequency ? BILLING_FREQUENCY_LABEL[contract.billing_frequency] : null
  const oneflowUrl =
    contract.oneflow_contract_id && !isImportedContract(contract)
      ? `https://app.oneflow.com/contracts/${contract.oneflow_contract_id}`
      : null

  const startDate = contract.contract_start_date ?? contract.start_date
  const periodLabel = startDate
    ? `${formatDateSv(startDate)} – ${contract.contract_end_date ? formatDateSv(contract.contract_end_date) : 'tills vidare'}`
    : null

  return (
    <section
      ref={registerRef}
      data-paper-id={contract.id}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`relative rounded-md rounded-tr-xl bg-[#f6f3ea] text-[#262e38] font-serif px-6 py-5 transition-all ${
        isDropTarget ? 'scale-[1.008]' : ''
      }`}
      style={{
        borderLeft: `5px solid ${accent}`,
        boxShadow: isDropTarget
          ? `0 0 0 4px ${accent}55, 0 18px 48px rgba(0,0,0,.55)`
          : isInvalidTarget
            ? '0 0 0 4px rgba(248,113,113,.3), 0 16px 44px rgba(0,0,0,.5)'
            : '0 2px 0 rgba(0,0,0,.35), 0 16px 44px rgba(0,0,0,.5)',
      }}
    >
      {/* Vikt hörn */}
      <span
        className="absolute top-0 right-0 w-6 h-6 rounded-tr-xl rounded-bl-md"
        style={{ background: 'linear-gradient(225deg, #0f172a 0 50%, #ded9c8 50% 100%)' }}
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
          {isInvalidTarget ? invalidReason : `Släpp: ${dragSubject} skrivs in i § 1 Omfattning`}
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
          <div className="font-sans text-[9.5px] uppercase tracking-[0.2em] text-[#8a9099] mb-0.5">
            {isUnitContract ? 'Enhetsavtal' : 'Organisationsavtal'} · BeGone Skadedjur &amp; Sanering
          </div>
          <h3 className="text-lg font-bold leading-snug text-[#262e38]">{contractDisplayName(contract)}</h3>
          <div className="text-[11.5px] italic text-[#5d6672] mt-0.5">
            mellan BeGone Skadedjur &amp; Sanering AB och {isUnitContract && owner ? customerRowName(owner) + ', ' : ''}
            {root.company_name}
            {orgnr ? ` (${orgnr})` : ''}
          </div>
        </div>
        <div className="ml-auto shrink-0 text-center self-center">
          <span
            className="inline-block -rotate-6 font-sans text-[10.5px] font-extrabold uppercase tracking-[0.16em] border-2 rounded-md px-2.5 py-0.5 opacity-85"
            style={{ borderColor: accent, color: accent }}
          >
            Aktivt
          </span>
          {oneflowUrl && (
            <a
              href={oneflowUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 flex items-center justify-center gap-1 font-sans text-[10px] text-[#8a9099] hover:text-[#262e38]"
            >
              Signerat via Oneflow <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

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
      <div className="mt-3">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 1 · Omfattning</h4>
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
            <button
              onClick={onClearCoversAll}
              className="shrink-0 w-5 h-5 grid place-items-center rounded-full text-[#8a9099] hover:bg-black/10 hover:text-[#262e38] text-sm leading-none"
              aria-label="Byt till omfattning per enhet"
              title="Byt till omfattning per enhet"
            >
              ×
            </button>
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
                  onPointerDown={(e) => onScopeRowDrag(e, cs)}
                  className="group flex items-center gap-2.5 py-2 text-[13.5px] border-b border-dotted border-[#d9d3c2] cursor-grab select-none touch-none hover:bg-black/[.04] rounded-sm"
                  title="Dra till ett annat avtal för att flytta täckningen"
                >
                  <span className="w-6 text-[11px] text-[#8a9099] tabular-nums shrink-0">1.{i + 1}</span>
                  <span className="font-semibold truncate text-[#262e38]">
                    {unit ? (isSingleSite ? unit.company_name : customerRowName(unit)) : 'Okänd enhet'}
                  </span>
                  <span className="flex-1 border-b border-dotted border-[#d9d3c2] translate-y-1 min-w-4" />
                  <span
                    className={`text-[11.5px] tabular-nums whitespace-nowrap shrink-0 ${
                      isFuture ? 'text-[#b45309] font-semibold' : 'text-[#5d6672]'
                    }`}
                  >
                    gäller fr. {formatDateSv(cs.active_from)}
                  </span>
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

      {/* § 2 Prislista */}
      <div className="mt-3.5">
        <div className="flex items-baseline gap-2 border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 2 · Prislista för avrop</h4>
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
          <button
            onClick={(e) => onEditPriceList(e.clientX, e.clientY)}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 font-sans text-[11px] font-semibold text-[#5d6672] border border-[#d9d3c2] rounded-md px-2.5 py-1.5 bg-white/50 hover:text-[#262e38] transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Byt prislista
          </button>
        </div>

        {/* Vad kunden kan avropa: fasta priser + övriga mot offert */}
        <ContractPriceListSection
          catalog={avropCatalog.catalog}
          loading={avropCatalog.loading}
          priceListLabel={priceListLabel}
        />
      </div>

      {/* § 3 Uppföljning */}
      <div className="mt-3.5">
        <div className="border-b-[1.5px] border-[#262e38] pb-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-[#262e38]">§ 3 · Uppföljning</h4>
        </div>
        <div className="flex flex-wrap gap-2.5 pt-2.5 font-sans">
          <button
            onClick={() => onOpenHistory('besok')}
            className="flex-1 min-w-36 text-left bg-white/55 border border-[#d9d3c2] rounded-lg px-3 py-2 hover:bg-white/85 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-widest font-bold text-[#8a9099]">
              <Calendar className="w-3 h-3" /> Nästa kontrollbesök
            </span>
            <span className="block text-[12.5px] font-semibold mt-0.5 text-[#262e38]">
              {followup.nextVisit
                ? `${formatDateSv(followup.nextVisit.scheduled_at)} · ${customerRowName(
                    customerById.get(followup.nextVisit.customer_id) ?? root
                  )}`
                : 'Inget bokat'}
            </span>
          </button>
          <button
            onClick={() => onOpenHistory('besok')}
            className="flex-1 min-w-36 text-left bg-white/55 border border-[#d9d3c2] rounded-lg px-3 py-2 hover:bg-white/85 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-widest font-bold text-[#8a9099]">
              <CalendarCheck className="w-3 h-3" /> Kontrollbesök
            </span>
            <span className="block text-[12.5px] font-semibold mt-0.5 text-[#262e38]">
              {followup.visitsDone === 0 && followup.visitsBooked === 0 ? (
                <span className="text-[#8a9099]">Inga registrerade</span>
              ) : (
                <>
                  <span className="text-[#157a5b]">{followup.visitsDone} utförda</span>
                  {followup.visitsBooked > 0 && (
                    <span className="text-[#5d6672]"> · {followup.visitsBooked} bokade</span>
                  )}
                </>
              )}
            </span>
          </button>
          <button
            onClick={() => onOpenHistory('arenden')}
            className="flex-1 min-w-36 text-left bg-white/55 border border-[#d9d3c2] rounded-lg px-3 py-2 hover:bg-white/85 transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-widest font-bold text-[#8a9099]">
              <Clock className="w-3 h-3" /> Ärenden
            </span>
            <span className="block text-[12.5px] font-semibold mt-0.5 text-[#262e38]">
              <span className="text-[#157a5b]">{followup.casesDone} utförda</span>
              {followup.casesOpen > 0 && <span className="text-[#b45309]"> · {followup.casesOpen} öppna</span>}
            </span>
          </button>
        </div>
      </div>

      {/* § 4 Tjänster i avtalet + § 5 Marginal */}
      <ContractContentSection
        content={contentData.content}
        loading={contentData.loading}
        onEdit={onEditContent}
      />

      {/* Fot */}
      <div className="flex items-end gap-5 mt-4">
        {(contract.begone_employee_name || root.sales_person) && (
          <div className="shrink-0">
            <span
              className="inline-block -rotate-2 text-[17px] text-[#2f3a46]"
              style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive" }}
            >
              {contract.begone_employee_name ?? root.sales_person}
            </span>
            <div className="border-t border-[#5d6672] mt-0.5 pt-0.5 font-sans text-[9.5px] text-[#8a9099] tracking-wide">
              {contract.begone_employee_name ?? root.sales_person} · BeGone Skadedjur &amp; Sanering AB
            </div>
          </div>
        )}
        <div className="ml-auto text-right font-sans text-[10px] leading-relaxed text-[#8a9099]">
          {contract.created_at && !isImportedContract(contract) && `Signerat ${formatDateSv(contract.created_at)}`}
          {contract.notice_period_months ? ` · Uppsägningstid ${contract.notice_period_months} mån` : ''}
        </div>
      </div>
    </section>
  )
}
