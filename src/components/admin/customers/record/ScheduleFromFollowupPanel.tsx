// src/components/admin/customers/record/ScheduleFromFollowupPanel.tsx
// "Skapa schema ur § 3": avtalet ska spawna besöken, inte koordinatorn.
// Ett återkommande schema per enhet som saknar schema, ur avtalets rytm och
// vald startmånad, kopplat till avtalet (contract_id på schema och session).
// Förhandsvisning innan något skrivs (antal enheter, besök, första datum),
// idempotent: enheter som redan har ett aktivt schema på avtalet hoppas över.

import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { createScheduleWithSessions, previewScheduleDates } from '../../../../services/recurringScheduleService'
import type { RecurringFrequency, GeneratedInspectionDate } from '../../../../types/recurringSchedule'
import { VISIT_FREQUENCY_LABEL, formatDateSv, type RecordContract } from '../../../../hooks/useCustomerRecord'
import { PANEL_INPUT_CLASS } from './paperInk'
import type { UnitFollowup } from './ContractMapSection'

const FREQUENCIES: RecurringFrequency[] = ['monthly', 'quarterly', 'semi_annual', 'annual']

function firstOfNextMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

function plusMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export default function ScheduleFromFollowupPanel({
  contract,
  units,
  staff,
  onCreated,
}: {
  contract: RecordContract
  units: UnitFollowup[]
  staff: { id: string; name: string }[]
  onCreated?: () => void | Promise<void>
}) {
  const needing = useMemo(() => units.filter((u) => u.serviceMode === 'inspection' && !u.nextVisitAt), [units])
  const defaultFreq = (contract.visit_frequency && FREQUENCIES.includes(contract.visit_frequency as RecurringFrequency)
    ? contract.visit_frequency
    : 'semi_annual') as RecurringFrequency
  const [technicianId, setTechnicianId] = useState('')
  const [frequency, setFrequency] = useState<RecurringFrequency>(defaultFreq)
  const [startDate, setStartDate] = useState(firstOfNextMonth())
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [preview, setPreview] = useState<{ dates: GeneratedInspectionDate[]; skipped: number } | null>(null)
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null)
  const [open, setOpen] = useState(false)

  if (needing.length === 0) return null

  const endDate = contract.contract_end_date ?? plusMonths(startDate, 14)

  const alreadyScheduled = async (): Promise<Set<string>> => {
    const { data } = await supabase
      .from('recurring_schedules')
      .select('customer_id')
      .eq('contract_id', contract.id)
      .eq('status', 'active')
      .in('customer_id', needing.map((u) => u.unitId))
    return new Set(((data ?? []) as { customer_id: string }[]).map((r) => r.customer_id))
  }

  const doPreview = async () => {
    if (!technicianId) {
      toast.error('Välj tekniker först')
      return
    }
    setBusy('preview')
    try {
      const dates = await previewScheduleDates({
        technicianId,
        frequency,
        dayPattern: 'first_weekday',
        preferredTime: time,
        estimatedDurationMinutes: duration,
        startDate: new Date(startDate + 'T12:00:00'),
        endDate: new Date(endDate + 'T12:00:00'),
      })
      const skipped = (await alreadyScheduled()).size
      setPreview({ dates, skipped })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte förhandsvisa')
    } finally {
      setBusy(null)
    }
  }

  const doCreate = async () => {
    if (!preview || !technicianId) return
    setBusy('create')
    try {
      const skip = await alreadyScheduled()
      const targets = needing.filter((u) => !skip.has(u.unitId))
      let created = 0
      const errors: string[] = []
      for (const u of targets) {
        const res = await createScheduleWithSessions(
          {
            customer_id: u.unitId,
            technician_id: technicianId,
            frequency,
            day_pattern: 'first_weekday',
            preferred_time: time,
            estimated_duration_minutes: duration,
            schedule_start_date: startDate,
            contract_end_date: endDate,
            contract_id: contract.id,
            notes: 'Skapat ur § 3 i avtalskartan',
          },
          preview.dates
        )
        if (res.schedule) created += 1
        errors.push(...res.errors)
      }
      toast.success(`Schema skapat för ${created} enhet${created === 1 ? '' : 'er'} · ${created * preview.dates.length} besök`)
      if (errors.length > 0) toast.error(`${errors.length} fel vid skapandet, se konsolen`)
      if (errors.length > 0) console.warn('[Schema ur § 3]', errors)
      setPreview(null)
      setOpen(false)
      await onCreated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skapa schemat')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 mb-3">
      <div className="flex items-baseline gap-2">
        <div className="text-[12.5px] font-semibold text-white">
          {needing.length} enhet{needing.length === 1 ? '' : 'er'} saknar schema
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="ml-auto text-[12px] text-[#20c58f] underline decoration-dotted">
            skapa schema ur § 3
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-0.5">Tekniker</span>
              <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className={PANEL_INPUT_CLASS}>
                <option value="">Välj</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-0.5">Rytm</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className={PANEL_INPUT_CLASS}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{VISIT_FREQUENCY_LABEL[f] ?? f}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-0.5">Första besök från</span>
              <input type="date" lang="sv-SE" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={PANEL_INPUT_CLASS} />
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-400 mb-0.5">Klockslag · längd</span>
              <div className="flex gap-1.5">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={PANEL_INPUT_CLASS} />
                <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 60)} className={`${PANEL_INPUT_CLASS} w-20`} />
              </div>
            </label>
          </div>
          <div className="text-[11px] text-slate-500">
            Till {formatDateSv(endDate)} ({contract.contract_end_date ? 'avtalsslut' : '14 månader'}). Besöken läggs samma dag per rytm och flyttas sedan i teknikerschemat.
          </div>
          {preview && (
            <div className="text-[12px] text-slate-200 tabular-nums">
              {needing.length - preview.skipped} enheter · {(needing.length - preview.skipped) * preview.dates.length} besök · första{' '}
              {preview.dates[0] ? formatDateSv(preview.dates[0].date.toISOString().slice(0, 10)) : '–'}
              {preview.skipped > 0 ? ` · ${preview.skipped} har redan schema, hoppas över` : ''}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={busy !== null} onClick={doPreview} className="text-[12px] px-3 py-1 rounded-md border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50">
              {busy === 'preview' ? 'Räknar…' : 'Förhandsvisa'}
            </button>
            <button
              type="button"
              disabled={!preview || preview.dates.length === 0 || busy !== null}
              onClick={doCreate}
              className="text-[12px] px-3 py-1 rounded-md bg-[#20c58f] text-[#0b1220] font-semibold hover:brightness-110 disabled:opacity-50"
            >
              {busy === 'create' ? 'Skapar…' : 'Skapa schema'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setPreview(null) }} className="ml-auto text-[12px] text-slate-400 underline decoration-dotted">
              avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
