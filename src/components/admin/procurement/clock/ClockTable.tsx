// src/components/admin/procurement/clock/ClockTable.tsx
// Avtalsklockans lista (docs/upphandlingsportal-ux-plan.md etapp 6 och 7): en
// rad per upphandling med köpare, län, nuvarande leverantör och kontaktperson,
// en tidslinje (bearbetningsfönster 18 till 12 månader före slut,
// förlängningsoption randig, avtalsslut och idag), slutdatum med källa och
// rättning, årsvärde, samt status och ansvarig i menyer i stället för
// rullistor. Felträff markeras med en ikonknapp.
//
// Tidslinjen: fönstret räknas mot sista möjliga slut med alla optioner (samma
// slutdatum som avtalsklockan alltid använt). Den randiga ytan är
// förlängningsoptionerna mellan basavtalets slut och det sista slutet.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { END_SOURCE_LABEL, FOLLOWUP_LABEL, WINDOW_STATE_DOT, WINDOW_STATE_LABEL, type ProcurementAwardStatus, type ProcurementContact } from '../../../../types/procurement'
import { addMonthsIso, daysBetweenIso } from '../../../../shared/procurementRules'
import { noticePath } from '../../../../lib/procurementPortal'
import type { ProcurementManagerProfile } from '../../../../services/procurementService'
import StatusMenu from '../StatusMenu'
import { IconButton, LinkButton, StatusDot } from '../ui'
import { fmtDate, fmtKrShort, fmtNum, fmtRelativeDays } from '../uiFormat'
import { BuyerLink, SupplierName } from '../market/shared'
import { countyLabel } from '../market/format'
import {
  AWARD_STATUS_DOT,
  AWARD_STATUS_LABEL,
  VALUE_KIND_LABEL,
  annualValueOfGroup,
  expectedAnnouncementQuarter,
  followupOf,
  windowStateOf,
  type ProcurementGroup,
} from '../market/marketStats'

const AWARD_STATUS_OPTIONS = (Object.keys(AWARD_STATUS_LABEL) as ProcurementAwardStatus[]).map((s) => ({ value: s, label: AWARD_STATUS_LABEL[s], dot: AWARD_STATUS_DOT[s] }))

/** Tidslinjens längd i månader från innevarande månad */
const TIMELINE_MONTHS = 36

interface Props {
  rows: ProcurementGroup[]
  today: string
  managers: ProcurementManagerProfile[]
  /** Köparens kontaktperson (senast kontaktad eller senast sedd), per köpar-id */
  contactFor: (g: ProcurementGroup) => ProcurementContact | null
  onStatus: (g: ProcurementGroup, status: ProcurementAwardStatus) => Promise<void>
  onOwner: (g: ProcurementGroup, ownerId: string | null) => Promise<void>
  onCorrectEnd: (g: ProcurementGroup, date: string | null) => Promise<void>
  /** Markera upphandlingen som felträff (gäller inte skadedjur) */
  onExclude?: (g: ProcurementGroup) => Promise<void>
}

function monthsFrom(from: string, d: string): number {
  return daysBetweenIso(from, d) / 30.4375
}

function pct(from: string, d: string | null): number | null {
  if (!d) return null
  return Math.max(0, Math.min(100, (monthsFrom(from, d) / TIMELINE_MONTHS) * 100))
}

/** Axelns start: första dagen i innevarande månad */
function timelineStart(today: string): string {
  return `${today.slice(0, 7)}-01`
}

export function TimelineAxis({ today }: { today: string }) {
  const from = timelineStart(today)
  const ticks = [0, 12, 24, 36].map((m) => ({ m, label: addMonthsIso(from, m).slice(0, 7) }))
  return (
    <div className="relative h-4 text-[10.5px] text-slate-500 tabular-nums">
      {ticks.map((t, i) => (
        <span
          key={t.m}
          className="absolute top-0"
          style={i === 0 ? { left: 0 } : i === ticks.length - 1 ? { right: 0 } : { left: `${(t.m / TIMELINE_MONTHS) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

/** Tidslinjen för ett avtal */
export function Timeline({ g, today }: { g: ProcurementGroup; today: string }) {
  const from = timelineStart(today)
  const ws = pct(from, g.windowStart)
  const we = pct(from, g.windowEnd)
  const end = pct(from, g.endDate)
  const base = g.baseEndDate && g.endDate && g.baseEndDate < g.endDate ? pct(from, g.baseEndDate) : null
  const now = pct(from, today) ?? 0
  const endOutside = g.endDate ? monthsFrom(from, g.endDate) > TIMELINE_MONTHS : false
  const label = [
    g.windowStart ? `Bearbetningsfönster ${g.windowStart} till ${g.windowEnd}` : null,
    base != null ? `förlängningsoption från ${g.baseEndDate}` : null,
    g.endDate ? `avtalsslut ${g.endDate}` : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="relative h-[22px] rounded-[5px] border border-slate-800 bg-slate-900/60 overflow-hidden" role="img" aria-label={label || 'Slutdatum saknas'} title={label}>
      {ws != null && we != null && we > ws && (
        <span className="absolute inset-y-0 bg-[#20c58f]/15 border-x border-[#20c58f]" style={{ left: `${ws}%`, width: `${we - ws}%` }} />
      )}
      {base != null && end != null && end > base && (
        <span
          className="absolute inset-y-0 text-slate-500"
          style={{ left: `${base}%`, width: `${end - base}%`, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 4px, currentColor 4px 5px)', opacity: 0.55 }}
        />
      )}
      {base != null && <span className="absolute inset-y-0 w-px bg-slate-400" style={{ left: `${base}%` }} />}
      {end != null && !endOutside && <span className="absolute inset-y-0 w-0.5 bg-slate-100" style={{ left: `calc(${end}% - 1px)` }} />}
      <span className="absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: `${now}%` }} />
      {endOutside && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 tabular-nums">{g.endDate?.slice(0, 4)}</span>}
    </div>
  )
}

/** Uppföljningen: ny annons (med länk), ny tilldelning eller slut passerat */
function FollowupLine({ g, today }: { g: ProcurementGroup; today: string }) {
  const status = followupOf(g, today)
  if (!status) return null
  if (status === 'new_notice') {
    return (
      <div className="mt-0.5 space-y-0.5">
        <StatusDot tone="good">{FOLLOWUP_LABEL.new_notice}</StatusDot>
        <div className="text-[11px] text-slate-500 truncate" title={g.followupTitle ?? ''}>
          {g.followupNoticeId ? (
            <Link to={noticePath(g.followupNoticeId)} className="text-[#20c58f] hover:underline">{g.followupTitle ?? 'Öppna annonsen'}</Link>
          ) : (
            g.followupTitle
          )}
          {g.followupDate ? ` · ${fmtDate(g.followupDate)}` : ''}
        </div>
      </div>
    )
  }
  if (status === 'new_award') return <div className="mt-0.5"><StatusDot tone="neutral">{FOLLOWUP_LABEL.new_award}</StatusDot></div>
  if (status === 'passed_no_notice') return <div className="mt-0.5"><StatusDot dotClass={WINDOW_STATE_DOT.due}>{WINDOW_STATE_LABEL.due}</StatusDot></div>
  return <div className="mt-0.5"><StatusDot tone="muted">{FOLLOWUP_LABEL.stale}</StatusDot></div>
}

function EndDateCell({ g, today, onCorrectEnd }: { g: ProcurementGroup; today: string; onCorrectEnd: Props['onCorrectEnd'] }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(g.endDate ?? '')
  const [saving, setSaving] = useState(false)
  const windowState = windowStateOf(g, today)

  const save = async (date: string | null) => {
    setSaving(true)
    try {
      await onCorrectEnd(g, date)
      setEditing(false)
    } catch {
      // Felet visas som toast av sidan; fältet står kvar öppet
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Rätta avtalsslut"
          className="w-full px-2 py-1.5 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
        />
        <div className="flex gap-3">
          <LinkButton onClick={() => void save(value || null)} disabled={saving || !/^\d{4}-\d{2}-\d{2}$/.test(value)}>Spara</LinkButton>
          <LinkButton tone="muted" onClick={() => { setEditing(false); setValue(g.endDate ?? '') }} disabled={saving}>Avbryt</LinkButton>
        </div>
      </div>
    )
  }

  const optionYears = g.optionMonths && g.optionMonths > 0 ? g.optionMonths / 12 : null
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <span className="text-[13px] text-slate-100 tabular-nums">{fmtDate(g.endDate)}</span>
        <button
          type="button"
          onClick={() => { setValue(g.endDate ?? ''); setEditing(true) }}
          className="inline-flex items-center justify-center w-11 h-11 -my-3 -mr-2 rounded-md text-slate-500 hover:text-[#20c58f]"
          title="Rätta avtalsslut"
          aria-label="Rätta avtalsslut"
        >
          <Icon name="allman.anteckning" size={16} />
        </button>
      </div>
      <div className="text-[11px] text-slate-500">{g.endDate ? fmtRelativeDays(g.endDate) : ''}</div>
      {optionYears != null && g.baseEndDate && !g.correctedEndDate && (
        <div className="text-[11px] text-slate-400 inline-flex items-center gap-1" title={g.optionText ?? undefined}>
          <Icon name="upphandling.forlangning" size={16} />
          basavtal {g.baseEndDate}, option {fmtNum(optionYears, 1)} år{g.optionsKnown ? '' : ' (antagen)'}
        </div>
      )}
      <div
        className={`text-[11px] ${g.correctedEndDate ? 'text-[#20c58f]' : g.endSource === 'assumption_2_2' ? 'text-amber-400' : 'text-slate-500'}`}
        title={g.correctedEndDate ? undefined : g.calcBasis ?? undefined}
      >
        {g.endSource ? END_SOURCE_LABEL[g.endSource] : 'Källa saknas'}
      </div>
      {g.correctedEndDate && (
        <div className="text-[11px] text-slate-500">
          Beräknat {fmtDate(g.calcEndDate)}{' '}
          <LinkButton tone="muted" onClick={() => void save(null)} disabled={saving}>Rensa rättningen</LinkButton>
        </div>
      )}
      {windowState && windowState !== 'due' && <div className="mt-0.5"><StatusDot dotClass={WINDOW_STATE_DOT[windowState]}>{WINDOW_STATE_LABEL[windowState]}</StatusDot></div>}
      <FollowupLine g={g} today={today} />
    </div>
  )
}

function ContactLine({ contact }: { contact: ProcurementContact | null }) {
  if (!contact) return <div className="text-[11.5px] text-amber-400">Ingen kontaktperson</div>
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} kopierad`)
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400 min-w-0">
      <Icon name="upphandling.kontaktperson" size={16} className="shrink-0" />
      <span className="truncate">
        {contact.name ?? contact.email}
        {contact.role ? `, ${contact.role.toLowerCase()}` : ''}
      </span>
      {contact.phone && (
        <button type="button" onClick={() => void copy(contact.phone!, 'Telefonnumret')} className="shrink-0 inline-flex items-center justify-center w-11 h-11 -my-3.5 -mx-3 text-slate-500 hover:text-[#20c58f]" aria-label={`Kopiera telefonnummer ${contact.phone}`} title={contact.phone}>
          <Icon name="kontakt.telefon" size={16} />
        </button>
      )}
      {contact.email && (
        <button type="button" onClick={() => void copy(contact.email!, 'E-postadressen')} className="shrink-0 inline-flex items-center justify-center w-11 h-11 -my-3.5 -mx-3 text-slate-500 hover:text-[#20c58f]" aria-label={`Kopiera e-post ${contact.email}`} title={contact.email}>
          <Icon name="kontakt.mejl" size={16} />
        </button>
      )}
    </div>
  )
}

const GRID = 'lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)_150px_84px_150px] lg:gap-4'

export function ClockTable({ rows, today, managers, contactFor, onStatus, onOwner, onCorrectEnd, onExclude }: Props) {
  const ownerOptions = [
    { value: '', label: 'Ingen ansvarig', dot: 'bg-slate-700' },
    ...managers.map((m) => ({ value: m.user_id, label: m.display_name || m.email, dot: 'bg-slate-400' })),
  ]
  return (
    <div className="rounded-[10px] border border-slate-800 bg-slate-900/40">
      <div className={`hidden ${GRID} px-4 py-2 border-b border-slate-800 text-[10px] uppercase tracking-[0.12em] text-slate-500`}>
        <div>Köpare och leverantör</div>
        <div>Tidslinje</div>
        <div>Slut och fönster</div>
        <div className="text-right">Årsvärde</div>
        <div>Status</div>
      </div>
      <ul className="divide-y divide-slate-800/70">
        {rows.map((g) => {
          const annual = annualValueOfGroup(g)
          const followup = followupOf(g, today)
          const q = followup === 'passed_no_notice' ? 'nu' : followup ? null : expectedAnnouncementQuarter(g, today)?.replace('-', ' ')
          const owner = ownerOptions.find((o) => o.value === (g.ownerId ?? '')) ?? ownerOptions[0]
          return (
            <li key={g.key} className={`${GRID} px-4 py-3 space-y-2 lg:space-y-0 hover:bg-slate-800/20`}>
              <div className="min-w-0 space-y-0.5">
                <div className="text-[13px] font-medium"><BuyerLink id={g.buyerId} name={g.buyerName} /></div>
                <div className="text-[11.5px] text-slate-500 truncate">
                  {countyLabel(g.countyCode)}
                  {g.year ? ` · ${g.year}` : ''}
                  {g.isFramework ? ' · ramavtal' : ''}
                  {q ? ` · annons väntas ${q}` : ''}
                </div>
                {g.title && <div className="text-[11.5px] text-slate-500 truncate" title={g.title}>{g.title}</div>}
                <div className="text-[12px] text-slate-300 flex flex-wrap gap-x-2">
                  {g.winners.length === 0 ? <span className="text-slate-500">Okänd leverantör</span> : g.winners.map((w) => <SupplierName key={`${w.supplierId}${w.org}${w.name}`} w={w} />)}
                </div>
                <ContactLine contact={contactFor(g)} />
              </div>
              <div className="hidden lg:flex flex-col justify-center">
                <Timeline g={g} today={today} />
              </div>
              <div>
                <EndDateCell key={`${g.key}:${g.endDate}`} g={g} today={today} onCorrectEnd={onCorrectEnd} />
              </div>
              <div className="lg:text-right text-[13px] tabular-nums text-slate-200">
                <span className="lg:hidden text-[11px] text-slate-500 mr-1">Årsvärde</span>
                {fmtKrShort(annual)}
                {annual != null && <div className="text-[10.5px] text-slate-500">{VALUE_KIND_LABEL[g.valueKind]}</div>}
              </div>
              <div className="flex lg:flex-col items-start gap-x-3">
                <StatusMenu
                  size="sm"
                  value={g.status}
                  label={AWARD_STATUS_LABEL[g.status]}
                  dot={AWARD_STATUS_DOT[g.status]}
                  options={AWARD_STATUS_OPTIONS}
                  onChange={(s) => void onStatus(g, s)}
                  ariaLabel={`Byt status för ${g.buyerName ?? 'avtalet'}`}
                  align="right"
                />
                <StatusMenu
                  size="sm"
                  value={g.ownerId ?? ''}
                  label={owner.value ? owner.label : 'Ingen ansvarig'}
                  dot={owner.dot}
                  options={ownerOptions}
                  onChange={(v) => void onOwner(g, v || null)}
                  ariaLabel={`Byt ansvarig för ${g.buyerName ?? 'avtalet'}`}
                  align="right"
                />
                {onExclude && (
                  <IconButton
                    icon={<Icon name="allman.arkiv" size={20} />}
                    label="Markera som felträff: gäller inte skadedjur"
                    onClick={() => void onExclude(g)}
                    className="-ml-2"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <div className={`hidden ${GRID} px-4 py-1.5 border-t border-slate-800`}>
        <div />
        <TimelineAxis today={today} />
        <div />
        <div />
        <div />
      </div>
    </div>
  )
}
