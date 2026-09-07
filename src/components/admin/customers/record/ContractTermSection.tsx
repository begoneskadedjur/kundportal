// src/components/admin/customers/record/ContractTermSection.tsx
// § 9 Löptid och option på avtalspappret i Avtalskartan.
//
// Start, slut och uppsägningstid (contracts.contract_start_date,
// contract_end_date, notice_period_months), förlängningsläge och option
// (renewal_mode, option_until, option_decision_deadline) samt bevakningen.
// Beslut 2026-09-02: inget avtal stoppas automatiskt. Läget styr bara vad
// kundansvarig påminns om (cron contract-renewal-watch) och när. "Nyttja
// option" flyttar slutdatumet på samma papper och loggas i tidslinjen.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import DateField from '../../../ui/DateField'
import { formatDateSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import { PANEL_INPUT_CLASS, PAPER_GEAR_CLASS, PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk, type SectionMode } from './paperInk'

type RenewalMode = 'rolling' | 'fixed' | 'option'

/** Sista dag att säga upp: slutdatum minus uppsägningstiden (i månader). */
export function lastTerminationDay(endDate: string | null, noticeMonths: number | null): string | null {
  if (!endDate || !noticeMonths) return null
  const [y, m, d] = endDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 - noticeMonths, d))
  return dt.toISOString().slice(0, 10)
}

function monthsBetween(start: string, end: string): number | null {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const months = (ey - sy) * 12 + (em - sm) + 1
  return months > 0 ? months : null
}

function daysUntil(iso: string, today: string): number {
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000)
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Props {
  contract: RecordContract
  ink: PaperInk
  archived: boolean
  onSaveTerm?: (input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }) => Promise<void>
  onSaveRenewal?: (input: { renewalMode: RenewalMode; optionUntil: string | null; optionDecisionDeadline: string | null; reminderDays: number | null }) => Promise<void>
  onExerciseOption?: () => Promise<void>
  onTerminate?: () => void
  /** Ångra uppsägning och radera: bara i panelens röda zon */
  onReactivate?: () => void
  onDelete?: () => void
  /** paper = läsning på pappret (default), settings = formulären öppna i panelen */
  mode?: SectionMode
  onOpenSettings?: () => void
}

/** Bevakningen: vilket datum kräver beslut och när kundansvarig påminns. Delas av § 9 och pulsen. */
export function termWatch(contract: RecordContract, today: string = todayKey()) {
  const start = contract.contract_start_date ?? contract.start_date ?? null
  const end = contract.contract_end_date ?? null
  const notice = contract.notice_period_months ?? null
  const lastDay = lastTerminationDay(end, notice)
  const months = start && end ? monthsBetween(start, end) : null
  const mode: RenewalMode = contract.renewal_mode ?? 'rolling'
  const reminderDays = contract.renewal_reminder_days ?? 90
  const decisionDate =
    mode === 'option' ? (contract.option_decision_deadline ?? null) : mode === 'fixed' ? end : lastDay
  const decisionKind = mode === 'option' ? 'Beslut om option' : mode === 'fixed' ? 'Slutdatum' : 'Sista uppsägningsdag'
  const remindDate = decisionDate ? shiftDays(decisionDate, -(mode === 'rolling' ? 30 : reminderDays)) : null
  const daysLeft = decisionDate ? daysUntil(decisionDate, today) : null
  const urgent = daysLeft !== null && daysLeft <= (mode === 'rolling' ? 30 : reminderDays)
  const optionExhausted = mode === 'option' && !!contract.option_until && !!end && end >= contract.option_until
  const modeLabel =
    mode === 'option'
      ? `option${contract.option_until ? `, längst till ${formatDateSv(contract.option_until)}` : ''}`
      : mode === 'fixed'
        ? 'fast slutdatum, löper vidare tills uppsägning'
        : 'rullar vidare efter slutdatumet tills avtalet sägs upp'
  return { today, start, end, notice, lastDay, months, mode, reminderDays, decisionDate, decisionKind, remindDate, daysLeft, urgent, optionExhausted, modeLabel }
}

export default function ContractTermSection({ contract, ink, archived, onSaveTerm, onSaveRenewal, onExerciseOption, onTerminate, onReactivate, onDelete, mode: sectionMode = 'paper', onOpenSettings }: Props) {
  const settings = sectionMode === 'settings'
  const inputClass = settings ? PANEL_INPUT_CLASS : PAPER_INPUT_CLASS
  const w = termWatch(contract)
  const { today, start, end, notice, lastDay, months, mode, reminderDays, decisionDate, decisionKind, remindDate, daysLeft, urgent, optionExhausted, modeLabel } = w
  const [editing, setEditing] = useState(settings)
  const [startInput, setStartInput] = useState(settings ? (start ?? '') : '')
  const [endInput, setEndInput] = useState(settings ? (end ?? '') : '')
  const [noticeInput, setNoticeInput] = useState(settings && notice ? String(notice) : '')
  const [editingRenewal, setEditingRenewal] = useState(settings)
  const [modeInput, setModeInput] = useState<RenewalMode>(mode)
  const [optionUntilInput, setOptionUntilInput] = useState(settings ? (contract.option_until ?? '') : '')
  const [deadlineInput, setDeadlineInput] = useState(settings ? (contract.option_decision_deadline ?? (lastDay ?? '')) : '')
  const [reminderInput, setReminderInput] = useState(String(reminderDays))
  const [saving, setSaving] = useState(false)

  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }


  const save = async () => {
    if (!onSaveTerm) return
    setSaving(true)
    try {
      await onSaveTerm({ startDate: startInput || null, endDate: endInput || null, noticePeriodMonths: noticeInput ? Number(noticeInput) : null })
      if (!settings) setEditing(false)
    } finally {
      setSaving(false)
    }
  }


  const saveRenewal = async () => {
    if (!onSaveRenewal) return
    setSaving(true)
    try {
      await onSaveRenewal({
        renewalMode: modeInput,
        optionUntil: optionUntilInput || null,
        optionDecisionDeadline: deadlineInput || null,
        reminderDays: reminderInput ? Number(reminderInput) : null,
      })
      if (!settings) setEditingRenewal(false)
    } finally {
      setSaving(false)
    }
  }

  const exercise = async () => {
    if (!onExerciseOption) return
    setSaving(true)
    try {
      await onExerciseOption()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={settings ? '' : 'mt-3.5 group/para'}>
      {!settings && (
        <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
          <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
            § 9 · Löptid och option
          </h4>
          {onOpenSettings && !archived && (
            <button type="button" onClick={onOpenSettings} className={PAPER_GEAR_CLASS} style={{ borderColor: ink.rule, color: ink.muted }} title="Inställningar för löptid" aria-label="Inställningar för löptid">
              ⚙
            </button>
          )}
          <span className="ml-auto font-sans text-[10.5px]" style={{ color: ink.muted }}>
            {mode === 'option' ? 'ramavtal med option' : end ? (end < today ? 'slutdatum passerat · rullar vidare' : 'fast period') : 'löper tills vidare'}
          </span>
        </div>
      )}

      {!editing ? (
        <>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>9.1</span>
            <span className="font-semibold">Avtalstid</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px] tabular-nums" style={{ color: start ? ink.secondary : ink.warn }}>
              {start ? (
                <>
                  <b style={{ color: ink.primary }}>{formatDateSv(start)}</b> t.o.m.{' '}
                  <b style={{ color: ink.primary }}>{end ? formatDateSv(end) : 'tills vidare'}</b>
                  {months ? ` · ${months} mån` : ''}
                </>
              ) : (
                'startdatum saknas'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>9.2</span>
            <span className="font-semibold">Uppsägningstid</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px] tabular-nums" style={{ color: notice ? ink.secondary : ink.warn }}>
              {notice ? `${notice} mån${lastDay ? ` · sista uppsägningsdag ${formatDateSv(lastDay)}` : ''}` : 'ej satt'}
            </span>
          </div>
        </>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`term-start-${contract.id}`}>Startdatum</label>
          <DateField id={`term-start-${contract.id}`} className={`${inputClass} pl-7 w-full`} value={startInput} onChange={setStartInput} autoFocus />
          <label htmlFor={`term-end-${contract.id}`}>Slutdatum</label>
          <DateField id={`term-end-${contract.id}`} className={`${inputClass} pl-7 w-full`} value={endInput} onChange={setEndInput} clearable />
          <label htmlFor={`term-notice-${contract.id}`}>Uppsägningstid (mån)</label>
          <input id={`term-notice-${contract.id}`} className={inputClass} inputMode="numeric" value={noticeInput} onChange={(e) => setNoticeInput(e.target.value)} placeholder="t.ex. 6" />
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            {!settings && (
              <button onClick={() => setEditing(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                Avbryt
              </button>
            )}
            <span className="ml-auto text-[10.5px]" style={{ color: ink.muted }}>
              Tomt slutdatum = tills vidare.
            </span>
          </div>
        </div>
      )}

      {!editingRenewal ? (
        <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
          <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>9.3</span>
          <span className="font-semibold">Förlängning</span>
          <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
          <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
            {modeLabel}
            {mode === 'option' && contract.option_decision_deadline ? ` · beslut senast ${formatDateSv(contract.option_decision_deadline)}` : ''}
          </span>
        </div>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`renew-mode-${contract.id}`}>Förlängning</label>
          <select id={`renew-mode-${contract.id}`} className={inputClass} value={modeInput} onChange={(e) => setModeInput(e.target.value as RenewalMode)} autoFocus>
            <option value="rolling">Rullar vidare tills uppsägning</option>
            <option value="fixed">Fast slutdatum (påminnelse före slutet)</option>
            <option value="option">Option på förlängning</option>
          </select>
          {modeInput === 'option' && (
            <>
              <label htmlFor={`renew-until-${contract.id}`}>Längst till</label>
              <DateField id={`renew-until-${contract.id}`} className={`${inputClass} pl-7 w-full`} value={optionUntilInput} onChange={setOptionUntilInput} clearable />
              <label htmlFor={`renew-deadline-${contract.id}`}>Beslut senast</label>
              <DateField id={`renew-deadline-${contract.id}`} className={`${inputClass} pl-7 w-full`} value={deadlineInput} onChange={setDeadlineInput} clearable />
            </>
          )}
          {modeInput !== 'rolling' && (
            <>
              <label htmlFor={`renew-remind-${contract.id}`}>Påminn dagar före</label>
              <input id={`renew-remind-${contract.id}`} className={inputClass} inputMode="numeric" value={reminderInput} onChange={(e) => setReminderInput(e.target.value)} />
            </>
          )}
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button onClick={() => void saveRenewal()} disabled={saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            {!settings && (
              <button onClick={() => setEditingRenewal(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                Avbryt
              </button>
            )}
            <span className="ml-auto text-[10.5px]" style={{ color: ink.muted }}>
              Avtalet stoppas aldrig automatiskt; läget styr påminnelsen.
            </span>
          </div>
        </div>
      )}

      {/* Bevakning: i panelen. På pappret bor den i pulsen. */}
      {settings && decisionDate && !archived && (
        <div
          className="flex items-center gap-2.5 mt-2 px-3 py-2 rounded-md font-sans text-[11.5px] leading-relaxed"
          style={{
            // Panelen är mörk: pappersvit bakgrund blev en grå dimma här
            border: `1px solid ${urgent ? 'rgba(251,191,36,.45)' : ink.rule}`,
            background: urgent ? 'rgba(251,191,36,.08)' : 'rgba(255,255,255,.04)',
            color: urgent ? '#fbbf24' : ink.secondary,
          }}
        >
          <span>
            {decisionKind} <b className="tabular-nums">{formatDateSv(decisionDate)}</b>.
            {remindDate ? ` Påminnelse till kundansvarig ${formatDateSv(remindDate)}.` : ''}
            {mode === 'option' ? ' Bokningar och fakturor fortsätter tills avtalet sägs upp.' : ''}
          </span>
          {daysLeft !== null && (
            <span className="ml-auto shrink-0 text-right">
              <b className="block text-[15px] tabular-nums leading-none" style={{ color: urgent ? '#9b3535' : ink.primary }}>
                {daysLeft < 0 ? 'passerat' : daysLeft === 0 ? 'Idag' : daysLeft}
              </b>
              {daysLeft > 0 && (
                <span className="block text-[9px] uppercase tracking-[0.14em]" style={{ color: ink.muted }}>
                  dagar kvar
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {settings && !archived && (onExerciseOption || onSaveRenewal) && (
        <div className="flex gap-2 flex-wrap pt-2 font-sans">
          {mode === 'option' && onExerciseOption && !optionExhausted && (
            <button
              onClick={() => void exercise()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-md px-2.5 py-1.5 bg-[#fff]/60 hover:bg-[#fff]/90 disabled:opacity-50"
              style={{ borderColor: ink.rule, color: ink.primary }}
              title="Flytta slutdatumet ett år framåt inom optionen"
            >
              Nyttja option
            </button>
          )}
          {mode !== 'rolling' && onSaveRenewal && (
            <button
              onClick={() => void onSaveRenewal({ renewalMode: 'rolling', optionUntil: null, optionDecisionDeadline: null, reminderDays: reminderDays })}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-md px-2.5 py-1.5 bg-[#fff]/60 hover:bg-[#fff]/90 disabled:opacity-50"
              style={{ borderColor: ink.rule, color: ink.primary }}
              title="Avtalet löper vidare tills det sägs upp, utan optionsbevakning"
            >
              Förläng tills vidare
            </button>
          )}
        </div>
      )}
      {settings && (onTerminate || onReactivate || onDelete) && (
        <div className="mt-4 pt-3 font-sans" style={{ borderTop: `1px solid ${ink.danger}55` }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: ink.danger }}>
            Avsluta
          </div>
          <div className="flex gap-2 flex-wrap">
            {onTerminate && (
              <button
                onClick={onTerminate}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold border rounded-md px-2.5 py-1.5 hover:bg-red-500/10 disabled:opacity-50"
                style={{ borderColor: `${ink.danger}80`, color: ink.danger }}
                title="Säg upp avtalet, det bevaras som historik"
              >
                Säg upp avtalet
              </button>
            )}
            {onReactivate && (
              <button
                onClick={onReactivate}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold border rounded-md px-2.5 py-1.5 disabled:opacity-50"
                style={{ borderColor: ink.rule, color: ink.positive }}
                title="Ångra uppsägningen"
              >
                Ångra uppsägning
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-[11.5px] border rounded-md px-2.5 py-1.5 hover:bg-red-500/10 disabled:opacity-50"
                style={{ borderColor: `${ink.danger}55`, color: ink.danger }}
                title="Radera avtalet"
              >
                Radera avtalet
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
