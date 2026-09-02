// src/components/admin/customers/record/ContractTermSection.tsx
// § 9 Löptid på avtalspappret i Avtalskartan.
//
// Start, slut och uppsägningstid (contracts.contract_start_date,
// contract_end_date, notice_period_months). Sista uppsägningsdag härleds ur
// slutdatum minus uppsägningstid. Option, förlängningsläge och bevakning
// kommer i fas 3 (docs/avtalskarta-motor-plan.md); tills dess visar 9.3 att
// avtalet rullar vidare efter slutdatumet, vilket är dagens beteende.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatDateSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import { todayKey } from '../../../../utils/contractLifecycle'
import { PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk } from './paperInk'

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

interface Props {
  contract: RecordContract
  ink: PaperInk
  archived: boolean
  onSaveTerm?: (input: { startDate: string | null; endDate: string | null; noticePeriodMonths: number | null }) => Promise<void>
}

export default function ContractTermSection({ contract, ink, archived, onSaveTerm }: Props) {
  const [editing, setEditing] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [noticeInput, setNoticeInput] = useState('')
  const [saving, setSaving] = useState(false)

  const today = todayKey()
  const start = contract.contract_start_date ?? contract.start_date ?? null
  const end = contract.contract_end_date ?? null
  const notice = contract.notice_period_months ?? null
  const lastDay = lastTerminationDay(end, notice)
  const months = start && end ? monthsBetween(start, end) : null
  const canEdit = !archived && !!onSaveTerm
  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }

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
      await onSaveTerm({
        startDate: startInput || null,
        endDate: endInput || null,
        noticePeriodMonths: noticeInput ? Number(noticeInput) : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 9 · Löptid
        </h4>
        <span className="ml-auto font-sans text-[10.5px]" style={{ color: ink.muted }}>
          {end ? (end < today ? 'slutdatum passerat · rullar vidare' : 'fast period') : 'löper tills vidare'}
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
          <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
            <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>9.3</span>
            <span className="font-semibold">Förlängning</span>
            <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
            <span className="font-sans text-[12px]" style={{ color: ink.secondary }}>
              rullar vidare efter slutdatumet tills avtalet sägs upp
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
            <button
              onClick={() => void save()}
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
              Tomt slutdatum = tills vidare.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
