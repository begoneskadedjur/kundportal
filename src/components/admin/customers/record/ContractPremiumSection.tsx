// src/components/admin/customers/record/ContractPremiumSection.tsx
// § 7 Premie och fakturering på avtalspappret i Avtalskartan.
//
// Här bor det som styr årspremiefakturan: årspremie, faktureringsfrekvens,
// ankarmånad och premietrappan (contract_premium_events). Nästa faktura
// härleds ur samma periodregel som fakturaplaneringen använder (perioder
// börjar den första i ankarmånaden). All skrivning går via
// ContractScopeService.setPremium / addPremiumEvent.
//
// Fas 2 (docs/avtalskarta-motor-plan.md) gör trappan till fakturakälla och
// lägger till samlad faktura (gemet). Tills dess visar 7.4 att avtalet
// faktureras för sig.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import DateField from '../../../ui/DateField'
import {
  BILLING_FREQUENCY_LABEL,
  formatDateSv,
  formatKr,
  type CustomerRecordData,
  type RecordContract,
} from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import { PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk } from './paperInk'

type PremiumEvent = CustomerRecordData['premiumEvents'][number]

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'annual', label: 'Årsvis' },
  { value: 'semi_annual', label: 'Halvårsvis' },
  { value: 'quarterly', label: 'Kvartalsvis' },
  { value: 'monthly', label: 'Månadsvis' },
]

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

const EVENT_LABEL: Record<string, string> = {
  start: 'Start',
  step_up: 'Upptrappning',
  indexation: 'Indexering',
  addition: 'Tillägg',
  adjustment: 'Justering',
  termination: 'Avslut',
}

/**
 * Nästa periodstart efter idag. Perioder börjar den 1:a i ankarmånaden och
 * upprepas enligt frekvensen; första perioden är den som avtalsstarten faller
 * i. Utan frekvens eller startdatum finns ingen nästa faktura att visa.
 */
export function nextInvoicePeriodStart(
  contract: Pick<RecordContract, 'billing_frequency' | 'billing_anchor_month' | 'contract_start_date' | 'start_date' | 'contract_end_date'>,
  today: string = todayKey()
): string | null {
  const start = contract.contract_start_date ?? contract.start_date
  if (!start || !contract.billing_frequency || contract.billing_frequency === 'on_demand') return null
  const stepMonths =
    contract.billing_frequency === 'monthly'
      ? 1
      : contract.billing_frequency === 'quarterly'
        ? 3
        : contract.billing_frequency === 'semi_annual'
          ? 6
          : 12
  const startYear = Number(start.slice(0, 4))
  const startMonth = Number(start.slice(5, 7))
  const anchor = contract.billing_anchor_month ?? startMonth
  // Gå bakåt från ankarmånaden tills vi är på eller före avtalsstarten
  let y = startYear
  let m = anchor
  while (y * 12 + m > startYear * 12 + startMonth) {
    m -= stepMonths
    if (m < 1) {
      m += 12
      y -= 1
    }
  }
  // Stega framåt tills periodstarten ligger efter idag
  const key = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`
  let guard = 0
  while (key(y, m) <= today && guard < 600) {
    m += stepMonths
    if (m > 12) {
      m -= 12
      y += 1
    }
    guard += 1
  }
  const next = key(y, m)
  if (contract.contract_end_date && next > contract.contract_end_date) return null
  return next
}

function periodAmount(annual: number, frequency: string | null): number {
  const divisor = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : frequency === 'semi_annual' ? 2 : 1
  return Math.round(annual / divisor)
}

/** Rad ur fakturaplanen som rör det här avtalet (från ContractInvoiceGenerator). */
export interface PremiumPlanEntry {
  action: string
  /** Fakturatyp: premium, equipment (tillägg per år), equipment_monthly (tillägg per månad) */
  kind?: string
  periodStart: string
  periodEnd: string
  /** Fakturans belopp exkl. moms (hela fakturan vid samlad) */
  subtotal: number
  invoiceDate: string
  dueDate: string
  existingStatus?: string | null
  consolidated?: boolean
  reason?: string
}

interface Props {
  contract: RecordContract
  premiumEvents: PremiumEvent[]
  /** Årsvärdet som gäller idag (ur trappan, annars annual_value) */
  annualInForce: number | null
  ink: PaperInk
  archived: boolean
  /** Kundens faktureringsläge (gemet) */
  invoiceMode?: 'per_contract' | 'consolidated'
  /** Fakturaplanens rader för avtalet, i periodordning */
  planEntries?: PremiumPlanEntry[]
  /** Koppla en Fortnox-faktura till en passerad period utan faktura */
  onLinkFortnox?: (period: { periodStart: string; periodEnd: string; expectedSubtotal: number | null; kind?: string }) => void
  onSavePremium?: (input: { annualValue: number | null; billingFrequency: string | null; billingAnchorMonth: number | null }) => Promise<void>
  onAddPremiumEvent?: (input: {
    eventType: 'step_up' | 'indexation' | 'adjustment'
    effectiveFrom: string
    annualValue: number
    note: string | null
  }) => Promise<void>
}

export default function ContractPremiumSection({
  contract,
  premiumEvents,
  annualInForce,
  ink,
  archived,
  onSavePremium,
  onAddPremiumEvent,
  invoiceMode,
  planEntries,
  onLinkFortnox,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [stepForm, setStepForm] = useState<null | { eventType: 'step_up' | 'indexation' }>(null)
  const [saving, setSaving] = useState(false)

  const [annualInput, setAnnualInput] = useState('')
  const [freqInput, setFreqInput] = useState('')
  const [anchorInput, setAnchorInput] = useState('')

  const [stepDate, setStepDate] = useState('')
  const [stepValue, setStepValue] = useState('')
  const [stepPercent, setStepPercent] = useState('')
  const [stepNote, setStepNote] = useState('')

  const today = todayKey()
  const frequency = contract.billing_frequency ?? null
  const frequencyLabel = frequency ? BILLING_FREQUENCY_LABEL[frequency] ?? frequency : null
  const anchor = contract.billing_anchor_month ?? null
  const nextStart = nextInvoicePeriodStart(contract, today)
  const paused = contract.billing_active === false
  const pausedUntil = paused && contract.billing_paused_until ? formatDateSv(contract.billing_paused_until) : null
  const sortedEvents = [...premiumEvents].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const canEdit = !archived && !!onSavePremium
  const canStep = !archived && !!onAddPremiumEvent
  // Fakturaplanen vinner över den lokala periodberäkningen när den finns:
  // den känner till trappan, utrustningen, Fortnox-importer och samlingsfakturor.
  const allEntries = planEntries ?? []
  // § 7 handlar om premien; tillägg på egna fakturor får rad 7.5
  const entries = allEntries.filter((e) => !e.kind || e.kind === 'premium')
  const equipmentEntries = allEntries.filter((e) => e.kind === 'equipment' || e.kind === 'equipment_monthly')
  const uncovered = allEntries.filter((e) => e.action === 'uncovered')
  const nextEntry = entries.find((e) => e.periodStart > today && e.action !== 'uncovered' && e.action !== 'delete')
  const nextEquipment = equipmentEntries.find((e) => e.periodStart >= today.slice(0, 7) + '-01' && e.action !== 'uncovered' && e.action !== 'delete')
  const nextLabel: { date: string; text: string } | null = nextEntry
    ? {
        date: nextEntry.periodStart,
        text:
          nextEntry.existingStatus && ['booked', 'sent', 'paid'].includes(nextEntry.existingStatus)
            ? `${formatKr(nextEntry.subtotal)} · ${nextEntry.existingStatus === 'paid' ? 'betald' : 'skickad'}`
            : nextEntry.existingStatus
              ? `${formatKr(nextEntry.subtotal)} · utkast${nextEntry.consolidated ? ', samlad' : ''}`
              : `${formatKr(nextEntry.subtotal)} · skapas ${formatDateSv(nextEntry.invoiceDate)}${nextEntry.consolidated ? ', samlad' : ''}`,
      }
    : nextStart
      ? { date: nextStart, text: annualInForce ? formatKr(periodAmount(annualInForce, frequency)) : 'belopp saknas' }
      : null

  const openEdit = () => {
    setAnnualInput(annualInForce != null ? String(annualInForce) : '')
    setFreqInput(frequency ?? 'annual')
    setAnchorInput(anchor ? String(anchor) : nextStart ? nextStart.slice(5, 7) : '')
    setEditing(true)
  }

  const savePremium = async () => {
    if (!onSavePremium) return
    const annual = annualInput.trim() ? Number(annualInput.replace(/\s/g, '').replace(',', '.')) : null
    if (annual != null && !(annual >= 0)) return
    setSaving(true)
    try {
      await onSavePremium({
        annualValue: annual,
        billingFrequency: freqInput || null,
        billingAnchorMonth: anchorInput ? Number(anchorInput) : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const openStep = (eventType: 'step_up' | 'indexation') => {
    setStepDate(nextStart ?? today)
    setStepValue('')
    setStepPercent(eventType === 'indexation' ? '' : '')
    setStepNote(eventType === 'indexation' ? 'AKI' : '')
    setStepForm({ eventType })
  }

  const saveStep = async () => {
    if (!onAddPremiumEvent || !stepForm) return
    const base = annualInForce ?? 0
    let value = stepValue.trim() ? Number(stepValue.replace(/\s/g, '').replace(',', '.')) : NaN
    if (stepForm.eventType === 'indexation' && !stepValue.trim() && stepPercent.trim()) {
      const pct = Number(stepPercent.replace(',', '.'))
      if (Number.isFinite(pct)) value = Math.round(base * (1 + pct / 100))
    }
    if (!Number.isFinite(value) || !(value > 0) || !stepDate) return
    setSaving(true)
    try {
      await onAddPremiumEvent({
        eventType: stepForm.eventType,
        effectiveFrom: stepDate,
        annualValue: value,
        note:
          stepForm.eventType === 'indexation' && stepPercent.trim()
            ? `${stepNote.trim() ? `${stepNote.trim()} ` : ''}${stepPercent.replace('.', ',')} %`.trim()
            : stepNote.trim() || null,
      })
      setStepForm(null)
    } finally {
      setSaving(false)
    }
  }

  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 7 · Premie och fakturering
        </h4>
        <span className="ml-auto font-sans text-[10.5px] tabular-nums" style={{ color: ink.muted }}>
          {paused
            ? (pausedUntil ? `fakturering pausad till ${pausedUntil}` : 'fakturering pausad tills vidare')
            : frequencyLabel
              ? `faktureras ${frequencyLabel.toLowerCase()}${anchor ? ` · ${MONTHS[anchor - 1]}` : ''}`
              : 'faktureringsvillkor saknas'}
        </span>
      </div>

      {!editing ? (
        <>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.1</span>
            <span className="font-semibold">Årspremie</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-bold tabular-nums" style={{ color: annualInForce ? ink.primary : ink.warn }}>
              {annualInForce ? `${formatKr(annualInForce)}/år` : 'ej satt'}
            </span>
            {canEdit && (
              <button onClick={openEdit} className={PAPER_LINK_CLASS} style={{ color: ink.muted }} title="Ändra årspremie, frekvens och ankarmånad">
                ändra
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.2</span>
            <span className="font-semibold">Faktureringsfrekvens</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px] tabular-nums" style={{ color: frequencyLabel ? ink.secondary : ink.warn }}>
              {frequencyLabel
                ? `${frequencyLabel.toLowerCase()}${anchor ? ` · ankarmånad ${MONTHS[anchor - 1]}` : ' · ankarmånad ej satt'}`
                : 'ej satt'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.3</span>
            <span className="font-semibold">Nästa faktura</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
              {paused ? (
                pausedUntil ? `pausad till ${pausedUntil}` : 'pausad tills vidare'
              ) : nextLabel ? (
                <>
                  <b style={{ color: ink.primary }}>{formatDateSv(nextLabel.date)}</b> · {nextLabel.text}
                </>
              ) : (
                'ingen planerad'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.4</span>
            <span className="font-semibold">Faktureras</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px]" style={{ color: ink.secondary }}>
              {invoiceMode === 'consolidated' ? 'på kundens samlingsfaktura, som egen rad' : 'på egen faktura'}
            </span>
          </div>
          {equipmentEntries.length > 0 && (
            <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.5</span>
              <span className="font-semibold">Tillägg faktureras separat</span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
              <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                {nextEquipment ? (
                  <>
                    <b style={{ color: ink.primary }}>{formatDateSv(nextEquipment.periodStart)}</b> · {formatKr(nextEquipment.subtotal)}
                    {nextEquipment.kind === 'equipment_monthly' ? ' per månad' : ' per år'}
                    {nextEquipment.existingStatus ? (['booked', 'sent', 'paid'].includes(nextEquipment.existingStatus) ? ' · skickad' : ' · utkast') : ` · skapas ${formatDateSv(nextEquipment.invoiceDate)}`}
                  </>
                ) : (
                  'ingen planerad'
                )}
              </span>
            </div>
          )}
          {uncovered.map((u) => (
            <div
              key={u.periodStart}
              className="flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-md font-sans text-[11px] leading-relaxed"
              style={{ border: '1px dashed rgba(180,83,9,.5)', color: '#7a3c07' }}
            >
              <span>
                {u.kind === 'equipment' || u.kind === 'equipment_monthly' ? 'Tilläggsperioden' : 'Perioden'} <b>{formatDateSv(u.periodStart)} t.o.m. {formatDateSv(u.periodEnd)}</b> saknar faktura i portalen
                {u.subtotal > 0 ? ` (${formatKr(u.subtotal)} exkl. moms)` : ''}. Fakturerad utanför portalen? Koppla Fortnox-fakturan.
              </span>
              {onLinkFortnox && !archived && (
                <button
                  onClick={() => onLinkFortnox({ periodStart: u.periodStart, periodEnd: u.periodEnd, expectedSubtotal: u.subtotal || null, kind: u.kind })}
                  className={`${PAPER_LINK_CLASS} ml-auto shrink-0`}
                  style={{ color: ink.warn }}
                >
                  koppla Fortnox-faktura
                </button>
              )}
            </div>
          ))}
        </>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`premium-annual-${contract.id}`}>Årspremie (kr/år)</label>
          <input
            id={`premium-annual-${contract.id}`}
            className={PAPER_INPUT_CLASS}
            inputMode="numeric"
            value={annualInput}
            onChange={(e) => setAnnualInput(e.target.value)}
            placeholder="t.ex. 6842"
            autoFocus
          />
          <label htmlFor={`premium-freq-${contract.id}`}>Frekvens</label>
          <select id={`premium-freq-${contract.id}`} className={PAPER_INPUT_CLASS} value={freqInput} onChange={(e) => setFreqInput(e.target.value)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <label htmlFor={`premium-anchor-${contract.id}`}>Ankarmånad</label>
          <select id={`premium-anchor-${contract.id}`} className={PAPER_INPUT_CLASS} value={anchorInput} onChange={(e) => setAnchorInput(e.target.value)}>
            <option value="">Från avtalsstart</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button
              onClick={() => void savePremium()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              Avbryt
            </button>
            <span className="ml-auto text-[10.5px]" style={{ color: ink.muted }}>
              Perioder börjar den 1:a i ankarmånaden.
            </span>
          </div>
        </div>
      )}

      {/* Premietrappa */}
      <div className="pt-2.5">
        <div className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: ink.muted }}>
          Premietrappa
        </div>
        {sortedEvents.length === 0 ? (
          <p className="font-sans text-[11px] italic py-1" style={{ color: ink.muted }}>
            Ingen startpunkt ännu. Sätts automatiskt när årspremien sparas.
          </p>
        ) : (
          <div className="flex items-start gap-0 font-sans overflow-x-auto py-1">
            {sortedEvents.map((ev, i) => {
              const future = ev.effective_from > today
              const isCurrent =
                !future && (i === sortedEvents.length - 1 || sortedEvents[i + 1].effective_from > today)
              return (
                <div key={ev.id} className="relative flex-1 min-w-[104px] pt-4" title={ev.note ?? undefined}>
                  <span
                    className="absolute top-[5px] left-0 right-0 h-[2px]"
                    style={{
                      background: ink.secondary,
                      left: i === 0 ? '50%' : 0,
                      right: i === sortedEvents.length - 1 ? '50%' : 0,
                    }}
                  />
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                    style={
                      future
                        ? { background: 'transparent', border: `2px dashed ${ink.muted}` }
                        : { background: isCurrent ? '#20c58f' : ink.primary, boxShadow: `0 0 0 1.5px ${ink.sheet}` }
                    }
                  />
                  <div className="text-[10px] text-center tabular-nums" style={{ color: ink.muted }}>
                    {formatDateSv(ev.effective_from)}
                  </div>
                  <div className="text-[11px] font-bold text-center" style={{ color: future ? ink.muted : ink.primary }}>
                    {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                  </div>
                  <div className="text-[12px] text-center tabular-nums" style={{ color: future ? ink.muted : ink.primary }}>
                    {formatKr(Number(ev.annual_value))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {canStep && !stepForm && (
          <div className="flex gap-4 pt-1 font-sans">
            <button onClick={() => openStep('step_up')} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              + lägg till steg
            </button>
            <button onClick={() => openStep('indexation')} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              + indexjustering
            </button>
          </div>
        )}
        {stepForm && (
          <div className="font-sans mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
            <span className="col-span-2 font-semibold" style={{ color: ink.primary }}>
              {stepForm.eventType === 'indexation' ? 'Indexjustering' : 'Nytt steg i premietrappan'}
            </span>
            <label htmlFor={`step-date-${contract.id}`}>Gäller från</label>
            <DateField id={`step-date-${contract.id}`} className={`${PAPER_INPUT_CLASS} pl-7 w-full`} value={stepDate} onChange={setStepDate} />
            {stepForm.eventType === 'indexation' && (
              <>
                <label htmlFor={`step-pct-${contract.id}`}>Procent</label>
                <input
                  id={`step-pct-${contract.id}`}
                  className={PAPER_INPUT_CLASS}
                  inputMode="decimal"
                  value={stepPercent}
                  onChange={(e) => setStepPercent(e.target.value)}
                  placeholder="t.ex. 3,1"
                />
              </>
            )}
            <label htmlFor={`step-value-${contract.id}`}>{stepForm.eventType === 'indexation' ? 'eller nytt belopp' : 'Ny årspremie'}</label>
            <input
              id={`step-value-${contract.id}`}
              className={PAPER_INPUT_CLASS}
              inputMode="numeric"
              value={stepValue}
              onChange={(e) => setStepValue(e.target.value)}
              placeholder={annualInForce ? `nu ${formatKr(annualInForce)}` : 'kr/år'}
            />
            <label htmlFor={`step-note-${contract.id}`}>Notering</label>
            <input
              id={`step-note-${contract.id}`}
              className={PAPER_INPUT_CLASS}
              value={stepNote}
              onChange={(e) => setStepNote(e.target.value)}
              placeholder={stepForm.eventType === 'indexation' ? 't.ex. AKI näringsgren N, dec 2026' : 't.ex. ny enhet ansluter'}
            />
            <div className="col-span-2 flex items-center gap-3 pt-1">
              <button
                onClick={() => void saveStep()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Spara steg
              </button>
              <button onClick={() => setStepForm(null)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
