// src/components/admin/customers/CustomerListRow.tsx
// Radkomponent för nya Befintliga kunder-listan (etapp 3).
// Anatomi: [kundnr + statuspunkt] [namn + enhetsbadge] [N avtal] [årsvärde]
// [nästa händelse i klartext] [säljare] [hover-reveal åtgärdsmeny].
// Multisite-expandering visar BARA indragna enhetsrader; klick på enhet
// navigerar till enhetens record-sida. Samma komponent används på mobil
// (stapel-layout via responsiva klasser — ingen parallell logik).

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CornerLeftUp,
  Edit3,
  MoreVertical,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import type { ConsolidatedCustomer, CustomerSite } from '../../../hooks/useConsolidatedCustomers'

// ---------------------------------------------------------------------------
// Delade hjälpare (används även av portföljraden i Customers.tsx)
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

const DAY_MS = 86_400_000

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
}

/** Nästa händelse i klartext, härledd från befintliga fält */
export function nextEventInfo(org: ConsolidatedCustomer): { text: string; className: string } {
  if (org.isTerminated) {
    if (org.effectiveEndDate) {
      const past = new Date(org.effectiveEndDate).getTime() < Date.now()
      return past
        ? { text: `Uppsagd, slutade ${formatDayMonth(org.effectiveEndDate)}`, className: 'text-slate-500' }
        : { text: `Uppsagd, slutar ${formatDayMonth(org.effectiveEndDate)}`, className: 'text-red-400' }
    }
    return { text: 'Uppsagd', className: 'text-red-400' }
  }
  const end = org.nextRenewalDate
  if (!end) return { text: '–', className: 'text-slate-600' }
  const days = org.daysToNextRenewal ?? Math.ceil((new Date(end).getTime() - Date.now()) / DAY_MS)
  if (days <= 0) return { text: 'Fortlöpande', className: 'text-slate-500' }
  if (days <= 30) return { text: `Utgår ${formatDayMonth(end)}`, className: 'text-red-400' }
  if (days <= 90) return { text: `Utgår ${formatDayMonth(end)}`, className: 'text-amber-400' }
  return { text: `Förnyelse ${formatMonthYear(end)}`, className: 'text-slate-400' }
}

function formatKr(n: number): string {
  return `${Math.round(n).toLocaleString('sv-SE')} kr`
}

/** Portalstatus för raden (etapp 6) — härledd från hookens befintliga fält */
export function portalStatusInfo(org: ConsolidatedCustomer): { label: string; dotClass: string } {
  if (org.activeUsersCount > 0) {
    return { label: 'Aktiv', dotClass: 'bg-[#20c58f]' }
  }
  if (org.pendingInvitationsCount > 0 || org.portalAccessStatus !== 'none') {
    return { label: 'Inbjuden', dotClass: 'bg-amber-400' }
  }
  return { label: 'Ej inbjuden', dotClass: 'bg-slate-600' }
}

// ---------------------------------------------------------------------------
// Statuspunkt för Fortnox-kundnummer
// ---------------------------------------------------------------------------

function FortnoxDot({ number, verified }: { number: number | null; verified: boolean }) {
  if (number == null) {
    return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Fortnox-kundnummer saknas" aria-hidden />
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
// Komponent
// ---------------------------------------------------------------------------

export interface RowActions {
  onEdit: () => void
  onRevenue: () => void
  onBillingSettings: () => void
  onContacts: () => void
  onRenewal: () => void
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
}

export default function CustomerListRow({
  organization: org,
  expanded,
  onToggleExpand,
  onPeek,
  onOpenUnit,
  actions,
  contactCount,
  highlighted = false,
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
  const { number, verified } = resolveFortnoxInfo(org)
  const next = nextEventInfo(org)
  const portal = portalStatusInfo(org)
  const annual = org.totalAnnualValue || 0
  const contractCount = org.contractCount || 0
  const seller = org.assigned_account_manager ?? org.sales_person ?? null

  const showRenewalAction =
    !org.isTerminated &&
    org.daysToNextRenewal != null &&
    org.daysToNextRenewal > 0 &&
    org.daysToNextRenewal <= 90

  const menuItem =
    'w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition-colors'

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
        className={`group relative flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-0.5 px-3 py-2.5 md:py-2 cursor-pointer hover:bg-slate-900/60 transition-colors border-l-2 ${
          highlighted ? 'border-l-[#20c58f] bg-[#20c58f]/5' : 'border-l-transparent'
        }`}
      >
        {/* Kundnr + statuspunkt */}
        <span className="flex items-center gap-1.5 w-20 shrink-0">
          <FortnoxDot number={number} verified={verified} />
          {number != null ? (
            <span className="font-mono text-xs text-slate-400 tabular-nums">#{number}</span>
          ) : (
            <span className="text-xs text-slate-600">–</span>
          )}
        </span>

        {/* Namn + enhetsbadge + expandering */}
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm text-slate-100 truncate">{org.company_name}</span>
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

        {/* Nyckeltal — egen rad på mobil (stapel), kolumner på desktop */}
        <span className="flex items-center gap-x-3 md:gap-x-4 basis-full md:basis-auto pl-[86px] md:pl-0 md:shrink-0 text-xs md:text-sm min-w-0">
          <span className="text-slate-400 tabular-nums shrink-0 md:w-14 md:text-right">
            {contractCount > 0 ? `${contractCount} avtal` : '–'}
          </span>
          <span className="text-slate-200 tabular-nums shrink-0 md:w-24 md:text-right">
            {annual > 0 ? formatKr(annual) : '–'}
          </span>
          <span className={`${next.className} truncate md:w-44`}>{next.text}</span>
          <span className="hidden lg:block text-slate-500 truncate w-28">{seller ?? '–'}</span>
          {/* Portalstatus — sista kolumnen (etapp 6) */}
          <span className="hidden lg:flex items-center gap-1.5 w-24 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${portal.dotClass}`} aria-hidden />
            <span className="text-xs text-slate-500 truncate">{portal.label}</span>
          </span>
        </span>

        {/* Åtgärdsmeny — hover-reveal */}
        <span className="relative shrink-0 ml-auto md:ml-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className={`p-1.5 rounded text-slate-500 hover:text-slate-200 transition-all ${
              menuOpen ? 'opacity-100' : 'md:opacity-0 md:group-hover:opacity-100'
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
              {showRenewalAction && (
                <button onClick={() => { setMenuOpen(false); actions.onRenewal() }} className={menuItem}>
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  Starta förnyelse
                </button>
              )}
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
            const viaHk = site.customer_number == null
            return (
              <li key={site.id} className="list-none">
                <button
                  onClick={() => onOpenUnit(site.id)}
                  className="w-full text-left pl-[52px] md:pl-24 pr-3 py-1.5 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-0.5 hover:bg-slate-900/60 transition-colors group/unit"
                >
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
                    {viaHk && (
                      <span className="flex items-center gap-1">
                        <CornerLeftUp className="w-3 h-3" />
                        via HK
                      </span>
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
