// src/components/technician/EditScheduleModal.tsx
// Fullständig schema-redigeringsmodal med förhandsvisning och omgenerering

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  X, Repeat, Clock, CalendarDays, Loader2, Check, AlertTriangle, ChevronLeft, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import Select from '../ui/Select'
import {
  getRecurringSchedule,
  getFutureSessionsForSchedule,
  previewScheduleDates,
  rescheduleExistingSessions
} from '../../services/recurringScheduleService'
import {
  FREQUENCY_CONFIG,
  STANDARD_FREQUENCIES,
  DAY_PATTERN_CONFIG,
  DURATION_OPTIONS
} from '../../types/recurringSchedule'
import type {
  RecurringFrequency,
  RecurringDayPattern,
  RecurringScheduleWithRelations,
  GeneratedInspectionDate,
  UpdateRecurringScheduleInput
} from '../../types/recurringSchedule'

interface EditScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
  scheduleId: string
}

type Step = 'edit' | 'preview'

export function EditScheduleModal({
  isOpen,
  onClose,
  onUpdated,
  scheduleId
}: EditScheduleModalProps) {
  // Data
  const [schedule, setSchedule] = useState<RecurringScheduleWithRelations | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Edit state
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly')
  const [dayPattern, setDayPattern] = useState<RecurringDayPattern>('first_weekday')
  const [preferredTime, setPreferredTime] = useState('09:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [preferredDayOfMonth, setPreferredDayOfMonth] = useState<number>(15)

  // Preview state
  const [step, setStep] = useState<Step>('edit')
  const [existingCount, setExistingCount] = useState(0)
  const [previewDates, setPreviewDates] = useState<GeneratedInspectionDate[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Execution state
  const [executing, setExecuting] = useState(false)

  // Load schedule data when opened
  useEffect(() => {
    if (isOpen && scheduleId) {
      loadSchedule()
      setStep('edit')
    }
  }, [isOpen, scheduleId])

  const loadSchedule = async () => {
    setLoadingSchedule(true)
    try {
      const data = await getRecurringSchedule(scheduleId)
      if (data) {
        setSchedule(data)
        setFrequency(data.frequency)
        setDayPattern(data.day_pattern)
        setPreferredTime(data.preferred_time)
        setDurationMinutes(data.estimated_duration_minutes)
        setPreferredDayOfMonth(data.preferred_day_of_month ?? 15)
      }
    } catch (err) {
      console.error('Error loading schedule:', err)
      toast.error('Kunde inte ladda schema')
    } finally {
      setLoadingSchedule(false)
    }
  }

  const hasChanges = schedule && (
    frequency !== schedule.frequency ||
    dayPattern !== schedule.day_pattern ||
    preferredTime !== schedule.preferred_time ||
    durationMinutes !== schedule.estimated_duration_minutes ||
    (dayPattern === 'specific_day' && preferredDayOfMonth !== schedule.preferred_day_of_month)
  )

  const handlePreview = async () => {
    if (!schedule) return
    setLoadingPreview(true)
    try {
      // Get existing future session count
      const existingSessions = await getFutureSessionsForSchedule(schedule.id)
      setExistingCount(existingSessions.length)

      // Generate new dates with updated settings
      const previewEnd = addMonths(new Date(), 14)
      const newDates = await previewScheduleDates({
        technicianId: schedule.technician_id,
        frequency,
        dayPattern,
        preferredDayOfMonth: dayPattern === 'specific_day' ? preferredDayOfMonth : undefined,
        preferredTime,
        estimatedDurationMinutes: durationMinutes,
        startDate: new Date(),
        endDate: previewEnd,
        technicianWorkSchedule: schedule.technician?.work_schedule || null
      })
      setPreviewDates(newDates)
      setStep('preview')
    } catch (err) {
      console.error('Error generating preview:', err)
      toast.error('Kunde inte generera förhandsvisning')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleConfirm = async () => {
    if (!schedule) return
    setExecuting(true)
    try {
      const updates: UpdateRecurringScheduleInput = {
        frequency,
        day_pattern: dayPattern,
        preferred_time: preferredTime,
        estimated_duration_minutes: durationMinutes,
        preferred_day_of_month: dayPattern === 'specific_day' ? preferredDayOfMonth : null
      }

      const result = await rescheduleExistingSessions(
        schedule.id,
        updates,
        previewDates
      )

      if (result.errors.length > 0) {
        console.error('Reschedule errors:', result.errors)
        toast.error(`${result.created} skapade, ${result.errors.length} fel`)
      } else {
        toast.success(`${result.deleted} raderade, ${result.created} nya skapade`)
      }

      onUpdated()
    } catch (err) {
      console.error('Error rescheduling:', err)
      toast.error('Fel vid ombokning')
    } finally {
      setExecuting(false)
    }
  }

  // Group day patterns
  const dayPatternGroups = {
    recommended: Object.entries(DAY_PATTERN_CONFIG).filter(([, v]) => v.group === 'recommended'),
    first_week: Object.entries(DAY_PATTERN_CONFIG).filter(([, v]) => v.group === 'first_week'),
    second_week: Object.entries(DAY_PATTERN_CONFIG).filter(([, v]) => v.group === 'second_week'),
    other: Object.entries(DAY_PATTERN_CONFIG).filter(([, v]) => v.group === 'other'),
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                {step === 'preview' && (
                  <button
                    onClick={() => setStep('edit')}
                    className="p-1 text-slate-400 hover:text-white transition-colors rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <Repeat className="w-4 h-4 text-[#20c58f]" />
                <h3 className="text-sm font-semibold text-slate-200">
                  {step === 'edit' ? 'Redigera schema' : 'Bekräfta ändringar'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white transition-colors rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {loadingSchedule ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#20c58f] animate-spin" />
                </div>
              ) : step === 'edit' ? (
                <EditStep
                  frequency={frequency}
                  setFrequency={setFrequency}
                  dayPattern={dayPattern}
                  setDayPattern={setDayPattern}
                  preferredTime={preferredTime}
                  setPreferredTime={setPreferredTime}
                  durationMinutes={durationMinutes}
                  setDurationMinutes={setDurationMinutes}
                  preferredDayOfMonth={preferredDayOfMonth}
                  setPreferredDayOfMonth={setPreferredDayOfMonth}
                  dayPatternGroups={dayPatternGroups}
                />
              ) : (
                <PreviewStep
                  existingCount={existingCount}
                  newCount={previewDates.length}
                  previewDates={previewDates}
                  frequency={frequency}
                  preferredTime={preferredTime}
                  durationMinutes={durationMinutes}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-700/50 flex-shrink-0">
              {step === 'edit' ? (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={handlePreview}
                    disabled={!hasChanges || loadingPreview}
                    className="flex-1 py-2 text-sm font-medium text-[#0a1328] bg-[#20c58f] rounded-xl hover:bg-[#1ab37e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {loadingPreview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Beräknar...
                      </>
                    ) : (
                      'Förhandsgranska'
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep('edit')}
                    disabled={executing}
                    className="flex-1 py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Tillbaka
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={executing}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Genomför...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Bekräfta
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================
// Step 1: Edit
// ============================================

function EditStep({
  frequency, setFrequency,
  dayPattern, setDayPattern,
  preferredTime, setPreferredTime,
  durationMinutes, setDurationMinutes,
  preferredDayOfMonth, setPreferredDayOfMonth,
  dayPatternGroups
}: {
  frequency: RecurringFrequency
  setFrequency: (f: RecurringFrequency) => void
  dayPattern: RecurringDayPattern
  setDayPattern: (d: RecurringDayPattern) => void
  preferredTime: string
  setPreferredTime: (t: string) => void
  durationMinutes: number
  setDurationMinutes: (d: number) => void
  preferredDayOfMonth: number
  setPreferredDayOfMonth: (d: number) => void
  dayPatternGroups: Record<string, [string, { label: string; description: string; group: string }][]>
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Frekvens */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Frekvens</label>
        <div className="grid grid-cols-2 gap-1.5">
          {STANDARD_FREQUENCIES.map(freq => {
            const config = FREQUENCY_CONFIG[freq]
            const isSelected = frequency === freq
            return (
              <button
                key={freq}
                onClick={() => setFrequency(freq)}
                className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-[#20c58f] bg-[#20c58f]/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <p className={`text-xs font-medium ${isSelected ? 'text-[#20c58f]' : 'text-slate-300'}`}>
                  {config.label}
                </p>
                <p className="text-[9px] text-slate-500">{config.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dagmönster */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-1 block">Dagmönster</label>
        <select
          value={dayPattern}
          onChange={e => setDayPattern(e.target.value as RecurringDayPattern)}
          className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]/50"
        >
          <optgroup label="Rekommenderade">
            {dayPatternGroups.recommended.map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </optgroup>
          <optgroup label="Första veckan">
            {dayPatternGroups.first_week.map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </optgroup>
          <optgroup label="Andra veckan">
            {dayPatternGroups.second_week.map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </optgroup>
          <optgroup label="Övrigt">
            {dayPatternGroups.other.map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Specifik dag (om valt) */}
      {dayPattern === 'specific_day' && (
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Dag i månaden</label>
          <input
            type="number"
            min={1}
            max={28}
            value={preferredDayOfMonth}
            onChange={e => setPreferredDayOfMonth(parseInt(e.target.value) || 15)}
            className="w-20 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>
      )}

      {/* Tid + varaktighet */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Tid</label>
          <input
            type="time"
            value={preferredTime}
            onChange={e => setPreferredTime(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">Varaktighet</label>
          <Select
            value={String(durationMinutes)}
            onChange={(v) => setDurationMinutes(parseInt(v))}
            options={DURATION_OPTIONS.map(opt => ({ value: String(opt.value), label: opt.label }))}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Step 2: Preview + Confirm
// ============================================

function PreviewStep({
  existingCount,
  newCount,
  previewDates,
  frequency,
  preferredTime,
  durationMinutes
}: {
  existingCount: number
  newCount: number
  previewDates: GeneratedInspectionDate[]
  frequency: RecurringFrequency
  preferredTime: string
  durationMinutes: number
}) {
  const freqLabel = FREQUENCY_CONFIG[frequency]?.label ?? frequency
  const visibleDates = previewDates.slice(0, 5)

  return (
    <div className="p-4 space-y-3">
      {/* Varning */}
      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-red-400">Denna åtgärd kan inte ångras</p>
          <p className="text-[10px] text-red-400/70 mt-0.5">
            Befintliga sessioner och ärenden raderas permanent.
          </p>
        </div>
      </div>

      {/* Sammanfattning */}
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
        {/* Raderas */}
        <div className="flex items-center gap-2">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
          <span className="text-sm text-red-400">
            {existingCount} {existingCount === 1 ? 'kontroll' : 'kontroller'} raderas
          </span>
        </div>

        {/* Skapas */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-[#20c58f]" />
          <span className="text-sm text-[#20c58f]">
            {newCount} nya {newCount === 1 ? 'kontroll skapas' : 'kontroller skapas'}
          </span>
        </div>

        {/* Nytt schema */}
        <div className="pt-1 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Repeat className="w-3 h-3" />
            <span>{freqLabel}</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>kl {preferredTime} ({durationMinutes} min)</span>
          </div>
        </div>
      </div>

      {/* Nya datum */}
      {visibleDates.length > 0 && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
            Nya kontroller (urval)
          </p>
          <div className="space-y-1">
            {visibleDates.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CalendarDays className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300">
                  {format(d.date, 'EEE d MMM yyyy', { locale: sv })}
                </span>
                <span className="text-slate-500">
                  {format(d.date, 'HH:mm')}–{format(d.endDate, 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
          {previewDates.length > 5 && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              ...och {previewDates.length - 5} till
            </p>
          )}
        </div>
      )}
    </div>
  )
}
