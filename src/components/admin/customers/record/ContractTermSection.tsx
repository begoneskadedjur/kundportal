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
import { formatDateSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import { PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk } from './paperInk'

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
}

export default function ContractTermSection({ contract, ink, archived, onSaveTerm, onSaveRenewal, onExerciseOption, onTerminate }: Props) {
  const [editing, setEditing] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [noticeInput, setNoticeInput] = useState('')
  const [editingRenewal, setEditingRenewal] = useState(false)
  const [modeInput, setModeInput] = useState<RenewalMode>('rolling')
  const [optionUntilInput, setOptionUntilInput] = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const [reminderInput, setReminderInput] = useState('90')
  const [saving, setSaving] = useState(false)

  const today = todayKey()
  const start = contract.contract_start_date ?? contract.start_date ?? null
  const end = contract.contract_end_date ?? null
  const notice = contract.notice_period_months ?? null
  const lastDay = lastTerminationDay(end, notice)
  const months = start && end ? monthsBetween(start, end) : null
  const mode: RenewalMode = contract.renewal_mode ?? 'rolling'
  const reminderDays = contract.renewal_reminder_days ?? 90
  const canEdit = !archived && !!onSaveTerm
  const canEditRenewal = !archived && !!onSaveRenewal
  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }

  // Bevakning: vilket datum kräver beslut, och när påminns kundansvarig
  const decisionDate =
    mode === 'option' ? (contract.option_decision_deadline ?? null) : mode === 'fixed' ? end : lastDay
  const decisionKind = mode === 'option' ? 'Beslut om option' : mode === 'fixed' ? 'Slutdatum' : 'Sista uppsägningsdag'
  const remindDate = decisionDate ? shiftDays(decisionDate, -(mode === 'rolling' ? 30 : reminderDays)) : null
  const daysLeft = decisionDate ? daysUntil(decisionDate, today) : null
  const urgent = daysLeft !== null && daysLeft <= (mode === 'rolling' ? 30 : reminderDays)
  const optionExhausted = mode === 'option' && !!contract.option_until && !!end && end >= contract.option_until

  const openEdit = () => {
    setStartInput(start ?? '')
    setEndInput(end ?? '')
    setNoticeInput(notice ? String(notice) : '')
    setEditing(true)
  }

  const save = async () => {
    if (!onSaveTerm) return
    setSaving(true)
    try {
      await onSaveTerm({ startDate: startInput || null, endDate: endInput || null, noticePeriodMonths: noticeInput ? Number(noticeInput) : null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const openRenewal = () => {
    setModeInput(mode)
    setOptionUntilInput(contract.option_until ?? '')
    setDeadlineInput(contract.option_decision_deadline ?? (lastDay ?? ''))
    setReminderInput(String(reminderDays))
    setEditingRenewal(true)
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
      setEditingRenewal(false)
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

  const modeLabel =
    mode === 'option'
      ? `option${contract.option_until ? `, längst till ${formatDateSv(contract.option_until)}` : ''}`
      : mode === 'fixed'
        ? 'fast slutdatum, löper vidare tills uppsägning'
        : 'rullar vidare efter slutdatumet tills avtalet sägs upp'

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 9 · Löptid och option
        </h4>
        <span className="ml-auto font-sans text-[10.5px]" style={{ color: ink.muted }}>
          {mode === 'option' ? 'ramavtal med option' : end ? (end < today ? 'slutdatum passerat · rullar vidare' : 'fast period') : 'löper tills vidare'}
        </span>
      </div>

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
            {canEdit && (
              <button onClick={openEdit} className={PAPER_LINK_CLASS} style={{ color: ink.muted }} title="Ändra start, slut och uppsägningstid">
                ändra
              </button>
            )}
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
          <input id={`term-start-${contract.id}`} type="date" lang="sv-SE" className={PAPER_INPUT_CLASS} value={startInput} onChange={(e) => setStartInput(e.target.value)} autoFocus />
          <label htmlFor={`term-end-${contract.id}`}>Slutdatum</label>
          <input id={`term-end-${contract.id}`} type="date" lang="sv-SE" className={PAPER_INPUT_CLASS} value={endInput} onChange={(e) => setEndInput(e.target.value)} />
          <label htmlFor={`term-notice-${contract.id}`}>Uppsägningstid (mån)</label>
          <input id={`term-notice-${contract.id}`} className={PAPER_INPUT_CLASS} inputMode="numeric" value={noticeInput} onChange={(e) => setNoticeInput(e.target.value)} placeholder="t.ex. 6" />
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            <button onClick={() => setEditing(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              Avbryt
            </button>
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
          {canEditRenewal && (
            <button onClick={openRenewal} className={PAPER_LINK_CLASS} style={{ color: ink.muted }} title="Ändra förlängningsläge, option och bevakning">
              ändra
            </button>
          )}
        </div>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`renew-mode-${contract.id}`}>Förlängning</label>
          <select id={`renew-mode-${contract.id}`} className={PAPER_INPUT_CLASS} value={modeInput} onChange={(e) => setModeInput(e.target.value as RenewalMode)} autoFocus>
            <option value="rolling">Rullar vidare tills uppsägning</option>
            <option value="fixed">Fast slutdatum (påminnelse före slutet)</option>
            <option value="option">Option på förlängning</option>
          </select>
          {modeInput === 'option' && (
            <>
              <label htmlFor={`renew-until-${contract.id}`}>Längst till</label>
              <input id={`renew-until-${contract.id}`} type="date" lang="sv-SE" className={PAPER_INPUT_CLASS} value={optionUntilInput} onChange={(e) => setOptionUntilInput(e.target.value)} />
              <label htmlFor={`renew-deadline-${contract.id}`}>Beslut senast</label>
              <input id={`renew-deadline-${contract.id}`} type="date" lang="sv-SE" className={PAPER_INPUT_CLASS} value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)} />
            </>
          )}
          {modeInput !== 'rolling' && (
            <>
              <label htmlFor={`renew-remind-${contract.id}`}>Påminn dagar före</label>
              <input id={`renew-remind-${contract.id}`} className={PAPER_INPUT_CLASS} inputMode="numeric" value={reminderInput} onChange={(e) => setReminderInput(e.target.value)} />
            </>
          )}
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button onClick={() => void saveRenewal()} disabled={saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            <button onClick={() => setEditingRenewal(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              Avbryt
            </button>
            <span className="ml-auto text-[10.5px]" style={{ color: ink.muted }}>
              Avtalet stoppas aldrig automatiskt; läget styr påminnelsen.
            </span>
          </div>
        </div>
      )}

      {/* Bevakning */}
      {decisionDate && !archived && (
        <div
          className="flex items-center gap-2.5 mt-2 px-3 py-2 rounded-md font-sans text-[11.5px] leading-relaxed"
          style={{
            border: `1px solid ${urgent ? 'rgba(180,83,9,.45)' : ink.rule}`,
            background: urgent ? 'rgba(180,83,9,.08)' : 'rgba(255,255,255,.4)',
            color: urgent ? '#7a3c07' : ink.secondary,
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

      {!archived && (onExerciseOption || onSaveRenewal || onTerminate) && (
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
          {onTerminate && (
            <button
              onClick={onTerminate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-md px-2.5 py-1.5 bg-[#fff]/60 hover:bg-[#fff]/90 disabled:opacity-50"
              style={{ borderColor: ink.rule, color: '#9b3535' }}
            >
              Säg upp
            </button>
          )}
        </div>
      )}
    </div>
  )
}
