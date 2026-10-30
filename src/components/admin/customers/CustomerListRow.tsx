// src/components/admin/customers/CustomerListRow.tsx
// Radkomponent för Befintliga kunder.
// Anatomi: [kundnr] [namn + enhetsbadge] [N avtal] [årsvärde] [händelse]
// [säljare] [status: fem uppläggningsikoner] [hover-reveal åtgärdsmeny].
// Status och händelse följer den godkända skissen 2026-10-22 (SetupStatus.tsx).
// Multisite-expandering visar BARA indragna enhetsrader; klick på enhet
// navigerar till enhetens record-sida. Samma komponent används på mobil
// (stapel-layout via responsiva klasser, ingen parallell logik).

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CornerLeftUp,
  Edit3,
  MoreVertical,
  Receipt,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import type { ConsolidatedCustomer, CustomerSite } from '../../../hooks/useConsolidatedCustomers'
import type { AddonPendingSummary } from '../../../hooks/useAddonPending'
import { sortWorkItems, workItemsCountLabel, type ContractWorkItem } from '../../../shared/contractWorkItems'
import { unitFortnoxState } from '../../../shared/fortnoxCustomerNumbers'
import type { SetupSummary, SetupTarget } from '../../../shared/customerSetupStatus'
import { Icon, type IconName } from '../../icons/Icon'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { EXPLAIN_PANEL_CLASS, ExplainPanel, SetupStatusCell, SetupStatusCompact } from './SetupStatus'

// ---------------------------------------------------------------------------
// Delade hjälpare (används även av Customers.tsx)
// ---------------------------------------------------------------------------

/** Kundnummer + Fortnox-verifiering för raden (HK för multisite, annars sites[0]) */
export function resolveFortnoxInfo(org: ConsolidatedCustomer): { number: number | null; verified: boolean } {
  const primary = org.organizationType === 'multisite'
    ? ((org.headquarterCustomer as CustomerSite | null) ?? org.sites[0] ?? null)
    : (org.sites[0] ?? null)
  const number = primary?.customer_number ?? org.customer_number ?? null
  const verified = !!(primary?.fortnox_verified_at ?? org.fortnox_verified_at)
  return { number, verified }
}

/**
 * Fortnox-läget för en enhetsrad i en multisite-organisation. null = enheten
 * tillhör huvudkontorets bolag (faktureras via HK). Annars eget bolag med eget
 * nummer, delat nummer (annan rad med samma org.nr) eller inget nummer alls.
 */
export function resolveUnitFortnoxInfo(org: ConsolidatedCustomer, site: CustomerSite) {
  const hq = (org.headquarterCustomer as CustomerSite | null) ?? null
  const hkOrgNr = hq?.organization_number ?? org.organization_number ?? null
  const family = hq ? [hq, ...org.sites] : org.sites
  return unitFortnoxState(site, hkOrgNr, family)
}

/** Aktiva enheter som är egna bolag men saknar Fortnox-nummer (även delat) */
export function unitsMissingFortnox(org: ConsolidatedCustomer): number {
  if (org.organizationType !== 'multisite') return 0
  return org.sites.filter((site) => {
    if (site.is_active === false) return false
    const info = resolveUnitFortnoxInfo(org, site)
    return !!info && info.number == null
  }).length
}

const DAY_MS = 86_400_000

/** "1 nov" utan punkt */
function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace(/\./g, '')
}

/** "nov 2027" utan punkt */
function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' }).replace(/\./g, '')
}

function formatKr(n: number): string {
  return `${Math.round(n).toLocaleString('sv-SE')} kr`
}

export type CustomerEventKind = 'period' | 'uppsagd' | 'beslut'

export interface CustomerEvent {
  kind: CustomerEventKind | null
  /** Kort text i kolumnen: "1 nov" eller "12" */
  short: string
  /** Rubriken i förklaringen */
  title: string
  /** Hela texten i förklaringen */
  full: string
  /** "Tryck för att ...", null när händelsen inte går att trycka på */
  action: string | null
  /** Färgton för ikon och text */
  tone: string
}

/**
 * Händelsen för raden: tillägg att besluta går före, sedan övriga uppgifter på
 * avtalskartan (arbetslistan), sedan uppsägning, sedan nästa period.
 */
export function customerEvent(org: ConsolidatedCustomer, addon: AddonPendingSummary | null, work: ContractWorkItem[] = []): CustomerEvent {
  if (addon) {
    const full = `${addon.stations} ${addon.stations === 1 ? 'tilläggsstation väntar' : 'tilläggsstationer väntar'} på beslut, ${formatKr(addon.annual_kr)}/år`
      + `${addon.contracts > 1 ? ` på ${addon.contracts} avtal` : ''}`
      + `${addon.first_marked_at ? `, markerade ${formatDayMonth(addon.first_marked_at)}` : ''}.`
    return {
      kind: 'beslut', short: String(addon.stations), title: 'Tilläggsstationer att besluta',
      full, action: 'Tryck för att besluta', tone: 'text-amber-400',
    }
  }
  if (work.length > 0) {
    const first = sortWorkItems(work)[0]
    const rest = work.length - 1
    return {
      kind: 'beslut', short: String(work.length), title: workItemsCountLabel(work.length),
      full: first.instruction + (rest > 0 ? ` Och ${rest} till.` : ''),
      action: 'Tryck för att öppna avtalskartan', tone: 'text-amber-400',
    }
  }
  if (org.isTerminated) {
    if (org.effectiveEndDate) {
      const iso = org.effectiveEndDate.slice(0, 10)
      const past = new Date(org.effectiveEndDate).getTime() < Date.now()
      return {
        kind: 'uppsagd', short: formatDayMonth(org.effectiveEndDate), title: 'Uppsagd',
        full: past ? `Avtalet är uppsagt och slutade ${iso}.` : `Avtalet är uppsagt och slutar ${iso}.`,
        action: 'Tryck för att se avtalet', tone: past ? 'text-slate-500' : 'text-red-400',
      }
    }
    return { kind: 'uppsagd', short: 'Uppsagd', title: 'Uppsagd', full: 'Avtalet är uppsagt.', action: 'Tryck för att se avtalet', tone: 'text-red-400' }
  }
  const end = org.nextRenewalDate
  if (!end) return { kind: null, short: '', title: '', full: '', action: null, tone: 'text-slate-600' }
  const days = org.daysToNextRenewal ?? Math.ceil((new Date(end).getTime() - Date.now()) / DAY_MS)
  if (days <= 0) return { kind: null, short: 'Fortlöpande', title: '', full: '', action: null, tone: 'text-slate-500' }
  const iso = end.slice(0, 10)
  const soon = days <= 90
  return {
    kind: 'period',
    short: soon ? formatDayMonth(end) : formatMonthYear(end),
    title: 'Ny period',
    full: `Ny avtalsperiod börjar ${iso}.`,
    action: 'Tryck för att se faktureringen',
    tone: soon ? 'text-emerald-400' : 'text-slate-400',
  }
}

const EVENT_ICON: Record<CustomerEventKind, IconName> = {
  period: 'kund.period',
  uppsagd: 'kund.uppsagd',
  beslut: 'kund.beslut',
}

/** Kolumnen Händelse: egen ikon + kort text, hela texten vid hovring och fokus. */
function EventCell({ event, onOpen }: { event: CustomerEvent; onOpen: () => void }) {
  if (!event.kind) {
    return <span className={`text-xs ${event.tone}`}>{event.short}</span>
  }
  return (
    <TooltipWrapper
      position="bottom"
      delay={120}
      showOnFocus
      panelClassName={EXPLAIN_PANEL_CLASS}
      content={<ExplainPanel title={event.title} reason={event.full} action={event.action} />}
    >
      <button
        type="button"
        aria-label={`${event.title}: ${event.full}`}
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${event.tone}`}
      >
        <Icon name={EVENT_ICON[event.kind]} size={20} />
        <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums">{event.short}</span>
      </button>
    </TooltipWrapper>
  )
}

// ---------------------------------------------------------------------------
// Statuspunkt för Fortnox-kundnummer (enhetsraderna)
// ---------------------------------------------------------------------------

function FortnoxDot({ number, verified }: { number: number | null; verified: boolean }) {
  if (number == null) {
    return <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" title="Kundnummer ges vid första Fortnox-utkastet" aria-hidden />
  }
  if (verified) {
    return <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] shrink-0" title="Verifierad mot Fortnox" aria-hidden />
  }
  return (
    <span
      className="w-1.5 h-1.5 rounded-full border border-amber-400 bg-transparent shrink-0"
      title="Kundnummer ej verifierat mot Fortnox"
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Kolumnrubriker (samma bredder som raden)
// ---------------------------------------------------------------------------

export function CustomerListHeader({ onHelp }: { onHelp: () => void }) {
  return (
    <li className="list-none hidden lg:flex items-center gap-x-3 px-3 py-2.5 border-b border-slate-800 border-l-2 border-l-transparent text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span className="w-20 shrink-0">Kundnr</span>
      <span className="flex-1 min-w-0">Kund</span>
      <span className="flex items-center gap-x-4 shrink-0">
        <span className="w-14 text-right">Avtal</span>
        <span className="w-24 text-right">Värde/år</span>
        <span className="w-28">Händelse</span>
        <span className="hidden xl:block w-28">Säljare</span>
        <span className="flex items-center gap-1.5 w-[280px] xl:w-[310px]">
          Status
          <button
            type="button"
            onClick={onHelp}
            aria-label="Vad betyder statusikonerna?"
            className="inline-flex rounded p-0.5 text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="kund.info" size={16} />
          </button>
        </span>
      </span>
      {/* Plats för åtgärdsmenyn */}
      <span className="w-7 shrink-0" aria-hidden />
    </li>
  )
}

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------

export interface RowActions {
  onEdit: () => void
  onRevenue: () => void
  onBillingSettings: () => void
  onContacts: () => void
  onTerminate: () => void
}

interface Props {
  organization: ConsolidatedCustomer
  /** Multisite: visar enhetsraderna */
  expanded: boolean
  onToggleExpand: () => void
  /** Radklick → peek-panel */
  onPeek: () => void
  /** Klick på enhetsrad → navigate till enhetens record-sida */
  onOpenUnit: (unitId: string) => void
  actions: RowActions
  contactCount: number
  highlighted?: boolean
  /** Tilläggsstationer som väntar på beslut om fakturering (bara faktureringsansvariga får den) */
  addonPending?: AddonPendingSummary | null
  /** Övriga uppgifter på avtalskartan (arbetslistan), bara faktureringsansvariga */
  workItems?: ContractWorkItem[]
  /** Öppna kundens avtalskarta på Innehåll och utrustning */
  onOpenAddons?: () => void
  /** Ny period eller uppsägning: öppna kundsidan där det syns */
  onOpenEvent?: (kind: 'period' | 'uppsagd') => void
  /** Uppläggningens status. null medan den hämtas */
  setup?: SetupSummary | null
  /** Klick på en statusikon eller nästa åtgärd */
  onSetupNavigate?: (target: SetupTarget) => void
  /** Sorterat på datum: "Tillagd 2026-10-22" bredvid namnet */
  dateNote?: string | null
}

export default function CustomerListRow({
  organization: org,
  expanded,
  onToggleExpand,
  onPeek,
  onOpenUnit,
  actions,
  contactCount,
  addonPending = null,
  workItems = [],
  onOpenAddons,
  onOpenEvent,
  setup = null,
  onSetupNavigate,
  highlighted = false,
  dateNote = null,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [menuOpen])

  const isMultisite = org.organizationType === 'multisite'
  const { number } = resolveFortnoxInfo(org)
  const event = customerEvent(org, addonPending, workItems)
  const annual = org.totalAnnualValue || 0
  const contractCount = org.contractCount || 0
  const seller = org.assigned_account_manager ?? org.sales_person ?? null
  const incomplete = !!setup && !setup.terminated && !setup.complete
  const navigateSetup = (t: SetupTarget) => onSetupNavigate?.(t)
  const openEvent = () => {
    if (event.kind === 'beslut') onOpenAddons?.()
    else if (event.kind) onOpenEvent?.(event.kind)
  }

  const menuItem =
    'w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition-colors'

  // Vänsterkanten: markerad rad (grön) går före ofullständig (bärnsten)
  const edge = highlighted
    ? 'border-l-[#20c58f] bg-[#20c58f]/5'
    : incomplete ? 'border-l-amber-500' : 'border-l-transparent'

  return (
    <li className="list-none">
      {/* Huvudrad */}
      <div
        role="button"
        tabIndex={0}
        data-customer-row-id={org.id}
        onClick={onPeek}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onPeek()
        }}
        className={`group relative flex flex-wrap lg:flex-nowrap items-center gap-x-3 gap-y-1 px-3 py-2.5 lg:py-2 cursor-pointer hover:bg-slate-900/60 transition-colors border-l-2 ${edge}`}
      >
        {/* Kundnr */}
        <span className="flex items-center w-20 shrink-0">
          {number != null ? (
            <span className="font-mono text-xs text-slate-400 tabular-nums">#{number}</span>
          ) : (
            <span className="text-xs text-slate-600">–</span>
          )}
        </span>

        {/* Namn + enhetsbadge + expandering */}
        <span className="flex items-center gap-2 flex-1 min-w-0 pr-7 lg:pr-0">
          <span className="text-sm text-slate-100 truncate">{org.company_name}</span>
          {dateNote && (
            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">{dateNote}</span>
          )}
          {isMultisite && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#20c58f] border border-slate-700 rounded px-1.5 py-0.5 shrink-0 transition-colors tabular-nums"
              title={expanded ? 'Dölj enheter' : 'Visa enheter'}
            >
              {org.totalSites} enheter
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </span>

        {/* Nyckeltal: egen rad på mobil (stapel), kolumner på dator */}
        <span className="flex items-center gap-x-3 lg:gap-x-4 basis-full lg:basis-auto pl-[92px] lg:pl-0 lg:shrink-0 text-xs lg:text-sm min-w-0">
          <span className="text-slate-400 tabular-nums shrink-0 lg:w-14 lg:text-right">
            {contractCount > 0 ? `${contractCount} avtal` : '–'}
          </span>
          <span className="text-slate-200 tabular-nums shrink-0 lg:w-24 lg:text-right">
            {annual > 0 ? formatKr(annual) : '–'}
            {org.manualBilling && (
              <span className="block text-[10px] leading-tight text-slate-500 font-normal">manuell fakt.</span>
            )}
          </span>
          <span className="lg:w-28 min-w-0 flex">
            <EventCell event={event} onOpen={openEvent} />
          </span>
          <span className="hidden xl:block text-slate-500 truncate w-28">{seller ?? ''}</span>
          {/* Status: fem ikoner (dator) */}
          <span className="hidden lg:flex items-center w-[280px] xl:w-[310px] min-w-0">
            <SetupStatusCell summary={setup} onNavigate={navigateSetup} />
          </span>
        </span>

        {/* Status på telefon och smal skärm: 16 px utan bildtext, raden öppnar kundpanelen */}
        <span className="lg:hidden basis-full pl-[92px]">
          <SetupStatusCompact summary={setup} />
        </span>

        {/* Åtgärdsmeny: hover-reveal */}
        <span className="absolute right-2 top-2 lg:static shrink-0 lg:ml-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className={`p-1.5 rounded text-slate-500 hover:text-slate-200 transition-all ${
              menuOpen ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100'
            }`}
            aria-label="Åtgärder"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => { setMenuOpen(false); actions.onEdit() }} className={menuItem}>
                <Edit3 className="w-4 h-4 text-slate-400" />
                Redigera kund
              </button>
              <button onClick={() => { setMenuOpen(false); actions.onRevenue() }} className={menuItem}>
                <TrendingUp className="w-4 h-4 text-slate-400" />
                Intäktsöversikt
              </button>
              <button onClick={() => { setMenuOpen(false); actions.onBillingSettings() }} className={menuItem}>
                <Receipt className="w-4 h-4 text-slate-400" />
                Inställningar fakturering
              </button>
              <button onClick={() => { setMenuOpen(false); actions.onContacts() }} className={menuItem}>
                <Users className="w-4 h-4 text-slate-400" />
                Kontaktpersoner
                {contactCount > 0 && (
                  <span className="ml-auto text-xs text-slate-500 tabular-nums">{contactCount}</span>
                )}
              </button>
              {!org.isTerminated && (
                <>
                  <div className="border-t border-slate-800 my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); actions.onTerminate() }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2.5 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Säg upp avtal
                  </button>
                </>
              )}
            </div>
          )}
        </span>
      </div>

      {/* Multisite: indragna enhetsrader (inga tabbar inline) */}
      {isMultisite && expanded && (
        <ul className="border-l-2 border-l-transparent">
          {org.sites.map((site) => {
            const ownContracts = (site.contracts ?? []).filter((c) => !c.id.startsWith('synth-'))
            const ownAnnual = ownContracts.reduce((sum, c) => sum + Number(c.annual_value ?? 0), 0)
              || Number(site.annual_value ?? 0)
            const unitFortnox = resolveUnitFortnoxInfo(org, site)
            return (
              <li key={site.id} className="list-none">
                <button
                  onClick={() => onOpenUnit(site.id)}
                  className="w-full text-left pl-3 md:pl-8 pr-3 py-1.5 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-0.5 hover:bg-slate-900/60 transition-colors group/unit"
                >
                  {/* Kundnr i samma kolumn som huvudraden: eget bolag visar
                      statuspunkt + nummer, enhet i HK:s bolag visar "via HK" */}
                  <span className="flex items-center gap-1.5 w-20 shrink-0">
                    {unitFortnox ? (
                      <>
                        <FortnoxDot number={unitFortnox.number} verified={unitFortnox.verified} />
                        {unitFortnox.number != null ? (
                          <span
                            className="font-mono text-xs text-slate-400 tabular-nums"
                            title={unitFortnox.sharedWith ? `Eget bolag, delar nummer med ${unitFortnox.sharedWith}` : 'Eget bolag, eget Fortnox-kundnummer'}
                          >
                            #{unitFortnox.number}
                          </span>
                        ) : (
                          <span className="text-xs text-red-400" title="Eget bolag utan Fortnox-kundnummer">saknar nr</span>
                        )}
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-600" title={`Faktureras via huvudkontoret${number != null ? ` #${number}` : ''}`}>
                        <CornerLeftUp className="w-3 h-3" />
                        via HK
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm text-slate-300 truncate">{site.site_name || site.company_name}</span>
                    {site.region && <span className="text-xs text-slate-500 truncate shrink-0">{site.region}</span>}
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-xs text-slate-500">
                    {ownContracts.length > 0 ? (
                      <span className="tabular-nums">
                        {ownContracts.length} eget avtal · {formatKr(ownAnnual)}/år
                      </span>
                    ) : (
                      <span>omfattas av org-avtal</span>
                    )}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover/unit:opacity-100 transition-opacity shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
