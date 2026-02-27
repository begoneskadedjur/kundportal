// src/components/technician/RecurringScheduleWizard.tsx
// Wizard for setting up recurring inspection schedules
// Supports batch mode: multiple units scheduled back-to-back in a single pass

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronLeft, ChevronRight, Clock, Check,
  AlertTriangle, Loader2, CalendarDays, Repeat, Settings, MapPin
} from 'lucide-react'
import { format, addMonths, addMinutes } from 'date-fns'
import { sv } from 'date-fns/locale'
import DatePicker from 'react-datepicker'
import '../../styles/DatePickerDarkTheme.css'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  previewScheduleDates,
  createScheduleWithSessions
} from '../../services/recurringScheduleService'
import type {
  RecurringFrequency,
  RecurringDayPattern,
  GeneratedInspectionDate,
  CreateRecurringScheduleInput,
  CustomFrequencyConfig,
  BatchScheduleUnit
} from '../../types/recurringSchedule'
import {
  FREQUENCY_CONFIG,
  DAY_PATTERN_CONFIG,
  DURATION_OPTIONS,
  STANDARD_FREQUENCIES,
  SWEDISH_MONTH_NAMES
} from '../../types/recurringSchedule'
import type { WorkSchedule } from '../../types/database'

type WizardStep = 1 | 2 | 3 | 4 | 5

interface RecurringScheduleWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (totalSessionsCreated: number) => void
  customerId: string
  customerName: string
  technicianId: string
  contractStartDate?: string | null
  contractEndDate?: string | null
  serviceFrequency?: string | null
  batchUnits?: BatchScheduleUnit[]
}

interface BatchPreviewResult {
  unit: BatchScheduleUnit
  dates: GeneratedInspectionDate[]
}

interface GroupedDateRow {
  dateKey: string
  displayDate: Date
  unitSlots: Array<{ unit: BatchScheduleUnit; date: GeneratedInspectionDate }>
  hasWarnings: boolean
}

// Swedish day name map for work schedule display
const SWEDISH_DAY_NAMES: Record<string, string> = {
  monday: 'mån',
  tuesday: 'tis',
  wednesday: 'ons',
  thursday: 'tor',
  friday: 'fre',
  saturday: 'lör',
  sunday: 'sön'
}

// Map existing service_frequency strings to our enum
function parseServiceFrequency(sf: string | null | undefined): RecurringFrequency | null {
  if (!sf) return null
  const lower = sf.toLowerCase()
  if (lower.includes('vecko') || lower.includes('weekly')) return 'weekly'
  if (lower.includes('varannan vecka') || lower.includes('bi')) return 'bi_weekly'
  if (lower.includes('manad') || lower.includes('monthly') || lower.includes('månadsvis')) return 'monthly'
  if (lower.includes('kvartal') || lower.includes('quarter')) return 'quarterly'
  if (lower.includes('halvar') || lower.includes('semi')) return 'semi_annual'
  if (lower.includes('arsv') || lower.includes('annual') || lower.includes('årsvis')) return 'annual'
  return null
}

function formatTotalDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} tim ${m} min` : `${h} tim`
}

export function RecurringScheduleWizard({
  isOpen,
  onClose,
  onComplete,
  customerId,
  customerName,
  technicianId,
  contractStartDate,
  contractEndDate,
  serviceFrequency,
  batchUnits
}: RecurringScheduleWizardProps) {
  const { profile } = useAuth()
  const [step, setStep] = useState<WizardStep>(1)

  const isBatch = !!batchUnits && batchUnits.length > 1

  // Step 1: Start date
  const [startDate, setStartDate] = useState<Date>(
    contractStartDate ? new Date(contractStartDate) : new Date()
  )

  // Step 2: Duration (single-unit mode)
  const [durationMinutes, setDurationMinutes] = useState(60)

  // Step 2: Duration (batch mode) — per-unit durations
  const [unitDurations, setUnitDurations] = useState<Record<string, number>>({})

  // Step 3: Frequency + Day pattern (merged)
  const [frequency, setFrequency] = useState<RecurringFrequency | null>(
    parseServiceFrequency(serviceFrequency) || null
  )
  const [dayPattern, setDayPattern] = useState<RecurringDayPattern | null>(null)
  const [preferredDayOfMonth, setPreferredDayOfMonth] = useState(1)
  const [customConfig, setCustomConfig] = useState<CustomFrequencyConfig>({
    visits_per_period: 1,
    period_type: 'week'
  })
  const [showActivePeriod, setShowActivePeriod] = useState(false)

  // Step 4: Time
  const [preferredHour, setPreferredHour] = useState(9)
  const [preferredMinute, setPreferredMinute] = useState(0)
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null)

  const preferredTime = `${String(preferredHour).padStart(2, '0')}:${String(preferredMinute).padStart(2, '0')}`

  // Step 5: Preview (single-unit mode)
  const [previewDates, setPreviewDates] = useState<GeneratedInspectionDate[]>([])
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set())
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Step 5: Preview (batch mode)
  const [batchPreviewResults, setBatchPreviewResults] = useState<BatchPreviewResult[]>([])
  const [batchExcludedDates, setBatchExcludedDates] = useState<Set<string>>(new Set())

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Resolved custom config
  const resolvedCustomConfig = frequency === 'custom' ? {
    ...customConfig,
    ...(showActivePeriod ? {} : { active_months_start: undefined, active_months_end: undefined })
  } : undefined

  // Batch: effective units with updated durations
  const effectiveUnits: BatchScheduleUnit[] = useMemo(() => {
    if (isBatch) {
      return batchUnits.map(u => ({
        ...u,
        durationMinutes: unitDurations[u.customerId] ?? u.durationMinutes
      }))
    }
    return [{ customerId, customerName, address: null, durationMinutes }]
  }, [isBatch, batchUnits, unitDurations, customerId, customerName, durationMinutes])

  // Batch: group preview results by date for step 5 display
  const groupedDates: GroupedDateRow[] = useMemo(() => {
    if (!isBatch || batchPreviewResults.length === 0) return []

    const dateMap = new Map<string, GroupedDateRow>()
    for (const result of batchPreviewResults) {
      for (const d of result.dates) {
        const dateKey = format(d.date, 'yyyy-MM-dd')
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {
            dateKey,
            displayDate: d.date,
            unitSlots: [],
            hasWarnings: false
          })
        }
        const row = dateMap.get(dateKey)!
        row.unitSlots.push({ unit: result.unit, date: d })
        if (d.hasConflictWarning || d.isAdjusted) row.hasWarnings = true
      }
    }

    return Array.from(dateMap.values()).sort(
      (a, b) => a.displayDate.getTime() - b.displayDate.getTime()
    )
  }, [isBatch, batchPreviewResults])

  // Batch: count included dates/sessions
  const batchIncludedDays = groupedDates.filter(g => !batchExcludedDates.has(g.dateKey)).length
  const batchTotalSessions = groupedDates.reduce((sum, g) => {
    if (batchExcludedDates.has(g.dateKey)) return sum
    return sum + g.unitSlots.length
  }, 0)

  // Single-unit: count
  const includedCount = previewDates.length - excludedIndices.size

  // Initialize batch unit durations when opening
  useEffect(() => {
    if (isOpen && batchUnits && batchUnits.length > 1) {
      const initial: Record<string, number> = {}
      batchUnits.forEach(u => { initial[u.customerId] = u.durationMinutes })
      setUnitDurations(initial)
    }
  }, [isOpen, batchUnits])

  // Load technician work schedule on mount
  useEffect(() => {
    if (isOpen && technicianId) {
      supabase
        .from('technicians')
        .select('work_schedule')
        .eq('id', technicianId)
        .single()
        .then(({ data }) => {
          if (data?.work_schedule) {
            setWorkSchedule(data.work_schedule as WorkSchedule)
          }
        })
    }
  }, [isOpen, technicianId])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setStartDate(contractStartDate ? new Date(contractStartDate) : new Date())
      setDurationMinutes(60)
      setUnitDurations({})
      setFrequency(parseServiceFrequency(serviceFrequency) || null)
      setDayPattern(null)
      setCustomConfig({ visits_per_period: 1, period_type: 'week' })
      setShowActivePeriod(false)
      setPreferredHour(9)
      setPreferredMinute(0)
      setPreviewDates([])
      setExcludedIndices(new Set())
      setBatchPreviewResults([])
      setBatchExcludedDates(new Set())
    }
  }, [isOpen])

  // Generate preview when entering step 5
  useEffect(() => {
    if (step === 5 && frequency && dayPattern) {
      if (isBatch) {
        generateBatchPreview()
      } else {
        generatePreview()
      }
    }
  }, [step])

  const generatePreview = async () => {
    if (!frequency || !dayPattern) return
    setLoadingPreview(true)
    try {
      const previewEnd = addMonths(startDate, 14)

      const dates = await previewScheduleDates({
        technicianId,
        frequency,
        dayPattern,
        preferredDayOfMonth: dayPattern === 'specific_day' ? preferredDayOfMonth : undefined,
        preferredTime,
        estimatedDurationMinutes: durationMinutes,
        startDate,
        endDate: previewEnd,
        technicianWorkSchedule: workSchedule,
        customFrequencyConfig: resolvedCustomConfig
      })

      setPreviewDates(dates)
      setExcludedIndices(new Set())
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error('Kunde inte generera förhandsvisning')
    } finally {
      setLoadingPreview(false)
    }
  }

  const generateBatchPreview = async () => {
    if (!frequency || !dayPattern) return
    setLoadingPreview(true)
    try {
      const previewEnd = addMonths(startDate, 14)

      // Generate dates for the FIRST unit using the full conflict-aware algorithm
      const firstUnit = effectiveUnits[0]
      const firstDates = await previewScheduleDates({
        technicianId,
        frequency,
        dayPattern,
        preferredDayOfMonth: dayPattern === 'specific_day' ? preferredDayOfMonth : undefined,
        preferredTime,
        estimatedDurationMinutes: firstUnit.durationMinutes,
        startDate,
        endDate: previewEnd,
        technicianWorkSchedule: workSchedule,
        customFrequencyConfig: resolvedCustomConfig
      })

      const results: BatchPreviewResult[] = [{ unit: firstUnit, dates: firstDates }]

      // For each subsequent unit: chain directly after the previous unit's end time
      for (let i = 1; i < effectiveUnits.length; i++) {
        const unit = effectiveUnits[i]
        const unitDates: GeneratedInspectionDate[] = firstDates.map((refDate, dateIdx) => {
          // Find the latest end time among all previous units for this date
          let chainEnd = refDate.endDate
          for (let p = 1; p < i; p++) {
            const prevDate = results[p]?.dates[dateIdx]
            if (prevDate && prevDate.endDate > chainEnd) chainEnd = prevDate.endDate
          }
          const unitStart = new Date(chainEnd)
          const unitEnd = addMinutes(unitStart, unit.durationMinutes)
          return {
            date: unitStart,
            endDate: unitEnd,
            periodStart: refDate.periodStart,
            periodEnd: refDate.periodEnd,
            isAdjusted: refDate.isAdjusted,
            adjustmentReason: refDate.adjustmentReason,
            hasConflictWarning: refDate.hasConflictWarning
          }
        })
        results.push({ unit, dates: unitDates })
      }

      setBatchPreviewResults(results)
      setBatchExcludedDates(new Set())
    } catch (error) {
      console.error('Error generating batch preview:', error)
      toast.error('Kunde inte generera förhandsvisning')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSubmit = async () => {
    if (!frequency || !dayPattern || isSubmitting) return
    setIsSubmitting(true)

    try {
      if (isBatch) {
        // Batch mode: create schedule + sessions for each unit
        let totalSessions = 0
        for (const result of batchPreviewResults) {
          const includedDates = result.dates.filter(d => {
            const dateKey = format(d.date, 'yyyy-MM-dd')
            return !batchExcludedDates.has(dateKey)
          })

          if (includedDates.length === 0) continue

          const input: CreateRecurringScheduleInput = {
            customer_id: result.unit.customerId,
            technician_id: technicianId,
            frequency,
            day_pattern: dayPattern,
            preferred_day_of_month: dayPattern === 'specific_day' ? preferredDayOfMonth : undefined,
            preferred_time: preferredTime,
            estimated_duration_minutes: result.unit.durationMinutes,
            schedule_start_date: format(startDate, 'yyyy-MM-dd'),
            contract_end_date: contractEndDate || undefined,
            is_auto_renewing: true,
            created_by: profile?.id,
            custom_frequency_config: resolvedCustomConfig
          }

          const res = await createScheduleWithSessions(input, includedDates)
          if (res.schedule) {
            totalSessions += res.sessionsCreated
          } else {
            toast.error(`Misslyckades: ${result.unit.customerName}`)
          }
        }

        onComplete(totalSessions)
        onClose()
      } else {
        // Single-unit mode
        const filteredDates = previewDates.filter((_, i) => !excludedIndices.has(i))

        const input: CreateRecurringScheduleInput = {
          customer_id: customerId,
          technician_id: technicianId,
          frequency,
          day_pattern: dayPattern,
          preferred_day_of_month: dayPattern === 'specific_day' ? preferredDayOfMonth : undefined,
          preferred_time: preferredTime,
          estimated_duration_minutes: durationMinutes,
          schedule_start_date: format(startDate, 'yyyy-MM-dd'),
          contract_end_date: contractEndDate || undefined,
          is_auto_renewing: true,
          created_by: profile?.id,
          custom_frequency_config: resolvedCustomConfig
        }

        const result = await createScheduleWithSessions(input, filteredDates)

        if (result.schedule) {
          toast.success(`${result.sessionsCreated} kontrolltillfällen skapade`)
          onComplete(result.sessionsCreated)
          onClose()
        } else {
          toast.error(result.errors[0] || 'Kunde inte skapa schemat')
        }
      }
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast.error('Ett fel uppstod')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleExclude = (index: number) => {
    setExcludedIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const toggleBatchExcludeDate = (dateKey: string) => {
    setBatchExcludedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!startDate
      case 2:
        if (isBatch) {
          return effectiveUnits.every(u => (unitDurations[u.customerId] ?? 0) > 0)
        }
        return durationMinutes > 0
      case 3: return !!frequency && !!dayPattern
      case 4: return !!preferredTime
      case 5:
        if (isBatch) return batchIncludedDays > 0
        return includedCount > 0
      default: return false
    }
  }

  // Submit button label
  const submitLabel = isBatch
    ? `Skapa ${batchTotalSessions} kontrolltillfällen (${effectiveUnits.length} enheter)`
    : `Skapa ${includedCount} kontrolltillfällen`

  const stepLabels = ['Startdatum', 'Tid per besök', 'Frekvens & dag', 'Klockslag', 'Förhandsvisning']

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#20c58f]/20">
                <Repeat className="w-5 h-5 text-[#20c58f]" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Återkommande kontroller</h2>
                <p className="text-slate-400 text-xs">
                  {isBatch ? `${batchUnits.length} enheter` : customerName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="px-5 py-3 border-b border-slate-800">
            <div className="flex items-center gap-1">
              {stepLabels.map((label, i) => (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className={`h-1.5 rounded-full flex-1 ${
                    i + 1 <= step ? 'bg-[#20c58f]' : 'bg-slate-700'
                  }`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Steg {step} av 5: {stepLabels[step - 1]}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {step === 1 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      När ska kontrollerna börja? Välj startdatum för det återkommande schemat.
                    </p>
                    <div className="flex justify-center">
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => date && setStartDate(date)}
                        locale={sv}
                        inline
                        minDate={new Date()}
                      />
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Första kontroll: {format(startDate, 'EEEE d MMMM yyyy', { locale: sv })}
                    </p>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    {isBatch ? (
                      <>
                        <p className="text-slate-300 text-sm">
                          Hur lång tid tar en kontrollrunda hos <strong className="text-slate-200">varje enhet</strong>?
                          Enheterna schemaläggs i följd — enhet 2 börjar direkt när enhet 1 är klar.
                        </p>
                        <div className="space-y-3">
                          {effectiveUnits.map((unit, idx) => (
                            <div key={unit.customerId} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-slate-500 font-medium bg-slate-800 px-1.5 py-0.5 rounded">
                                  {idx + 1}
                                </span>
                                <span className="text-sm text-slate-200 font-medium truncate">
                                  {unit.customerName}
                                </span>
                                {unit.address && (
                                  <span className="text-xs text-slate-500 truncate hidden sm:flex items-center gap-1">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    {unit.address}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                {DURATION_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    onClick={() => setUnitDurations(prev => ({
                                      ...prev,
                                      [unit.customerId]: opt.value
                                    }))}
                                    className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                                      (unitDurations[unit.customerId] ?? 60) === opt.value
                                        ? 'border-[#20c58f] bg-[#20c58f]/20 text-[#20c58f]'
                                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Total time summary */}
                        <div className="p-2.5 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                          <p className="text-xs text-slate-400">
                            Total tid per besöksdag:{' '}
                            <span className="text-slate-200 font-medium">
                              {formatTotalDuration(effectiveUnits.reduce((s, u) => s + u.durationMinutes, 0))}
                            </span>
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-300 text-sm">
                          Hur lång tid tar en kontrollrunda hos denna kund?
                          Detta används för att undvika krockar med andra ärenden.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {DURATION_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setDurationMinutes(opt.value)}
                              className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                                durationMinutes === opt.value
                                  ? 'border-[#20c58f] bg-[#20c58f]/20 text-[#20c58f]'
                                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <Clock className="w-4 h-4 inline mr-2" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Hur ofta ska kontroller genomföras?
                    </p>
                    <div className="space-y-2">
                      {STANDARD_FREQUENCIES.map(key => {
                        const config = FREQUENCY_CONFIG[key]
                        return (
                          <button
                            key={key}
                            onClick={() => setFrequency(key)}
                            className={`w-full p-3 rounded-lg border text-left transition-all ${
                              frequency === key
                                ? 'border-[#20c58f] bg-[#20c58f]/20'
                                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                            }`}
                          >
                            <span className={`text-sm font-medium ${frequency === key ? 'text-[#20c58f]' : 'text-slate-300'}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">{config.description}</span>
                          </button>
                        )
                      })}

                      {/* Separator + Custom frequency */}
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-xs text-slate-500">eller</span>
                        <div className="flex-1 h-px bg-slate-700" />
                      </div>

                      <button
                        onClick={() => setFrequency('custom')}
                        className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-2 ${
                          frequency === 'custom'
                            ? 'border-[#20c58f] bg-[#20c58f]/20'
                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <Settings className={`w-4 h-4 ${frequency === 'custom' ? 'text-[#20c58f]' : 'text-slate-400'}`} />
                        <span className={`text-sm font-medium ${frequency === 'custom' ? 'text-[#20c58f]' : 'text-slate-300'}`}>
                          Anpassat intervall
                        </span>
                        <span className="text-xs text-slate-500 ml-1">Ange eget schema</span>
                      </button>

                      {/* Custom frequency config */}
                      <AnimatePresence>
                        {frequency === 'custom' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={customConfig.visits_per_period}
                                  onChange={(e) => setCustomConfig(prev => ({
                                    ...prev,
                                    visits_per_period: Math.min(10, Math.max(1, Number(e.target.value)))
                                  }))}
                                  className="w-16 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                                />
                                <span className="text-sm text-slate-300">besök per</span>
                                <select
                                  value={customConfig.period_type}
                                  onChange={(e) => setCustomConfig(prev => ({
                                    ...prev,
                                    period_type: e.target.value as CustomFrequencyConfig['period_type']
                                  }))}
                                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                                >
                                  <option value="week">vecka</option>
                                  <option value="month">månad</option>
                                  <option value="quarter">kvartal</option>
                                  <option value="year">år</option>
                                </select>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={showActivePeriod}
                                  onChange={(e) => {
                                    setShowActivePeriod(e.target.checked)
                                    if (e.target.checked && !customConfig.active_months_start) {
                                      setCustomConfig(prev => ({
                                        ...prev,
                                        active_months_start: 3,
                                        active_months_end: 11
                                      }))
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f] bg-slate-700"
                                />
                                <span className="text-sm text-slate-300">Begränsa till säsong</span>
                              </label>

                              <AnimatePresence>
                                {showActivePeriod && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={customConfig.active_months_start || 3}
                                        onChange={(e) => setCustomConfig(prev => ({
                                          ...prev,
                                          active_months_start: Number(e.target.value)
                                        }))}
                                        className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                                      >
                                        {SWEDISH_MONTH_NAMES.map((name, i) => (
                                          <option key={i} value={i + 1}>{name}</option>
                                        ))}
                                      </select>
                                      <span className="text-sm text-slate-500">–</span>
                                      <select
                                        value={customConfig.active_months_end || 11}
                                        onChange={(e) => setCustomConfig(prev => ({
                                          ...prev,
                                          active_months_end: Number(e.target.value)
                                        }))}
                                        className="flex-1 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                                      >
                                        {SWEDISH_MONTH_NAMES.map((name, i) => (
                                          <option key={i} value={i + 1}>{name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Day pattern section — appears when frequency is selected */}
                    <AnimatePresence>
                      {frequency && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 border-t border-slate-800 space-y-4">
                            <p className="text-slate-300 text-sm">
                              Vilken dag i varje period ska kontrollen läggas?
                            </p>

                            {(['recommended', 'first_week', 'second_week', 'other'] as const).map(group => {
                              const groupLabel = {
                                recommended: 'Rekommenderat',
                                first_week: 'Första veckan',
                                second_week: 'Andra veckan',
                                other: 'Övrigt'
                              }[group]

                              const patterns = (Object.entries(DAY_PATTERN_CONFIG) as [RecurringDayPattern, typeof DAY_PATTERN_CONFIG[RecurringDayPattern]][])
                                .filter(([, v]) => v.group === group)

                              if (patterns.length === 0) return null

                              return (
                                <div key={group}>
                                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{groupLabel}</p>
                                  <div className="space-y-1.5">
                                    {patterns.map(([key, config]) => (
                                      <button
                                        key={key}
                                        onClick={() => setDayPattern(key)}
                                        className={`w-full p-2.5 rounded-lg border text-left transition-all ${
                                          dayPattern === key
                                            ? 'border-[#20c58f] bg-[#20c58f]/20'
                                            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                        }`}
                                      >
                                        <span className={`text-sm ${dayPattern === key ? 'text-[#20c58f]' : 'text-slate-300'}`}>
                                          {config.label}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}

                            {dayPattern === 'specific_day' && (
                              <div className="flex items-center gap-3 mt-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
                                <label className="text-sm text-slate-300">Dag i månaden:</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={28}
                                  value={preferredDayOfMonth}
                                  onChange={(e) => setPreferredDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value))))}
                                  className="w-16 px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm text-center"
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Vilken tid på dagen ska {isBatch ? 'första kontrollen' : 'kontrollen'} börja?
                    </p>
                    <div className="flex justify-center">
                      <div className="flex items-center gap-2">
                        <select
                          value={preferredHour}
                          onChange={(e) => setPreferredHour(Number(e.target.value))}
                          className="px-3 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg text-center appearance-none cursor-pointer focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                        >
                          {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(h => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                          ))}
                        </select>
                        <span className="text-xl text-slate-400 font-bold">:</span>
                        <select
                          value={preferredMinute}
                          onChange={(e) => setPreferredMinute(Number(e.target.value))}
                          className="px-3 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg text-center appearance-none cursor-pointer focus:ring-2 focus:ring-[#20c58f] focus:border-[#20c58f]"
                        >
                          {[0, 15, 30, 45].map(m => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {isBatch && (
                      <p className="text-xs text-slate-500 text-center">
                        Efterföljande enheter schemaläggs direkt efter föregående
                      </p>
                    )}
                    {workSchedule && (
                      <div className="text-xs text-slate-500 text-center space-y-0.5">
                        <p>Dina arbetstider:</p>
                        {Object.entries(workSchedule)
                          .filter(([, v]) => (v as any).active)
                          .slice(0, 5)
                          .map(([day, v]) => (
                            <span key={day} className="inline-block mx-1">
                              {SWEDISH_DAY_NAMES[day] || day}: {(v as any).start}-{(v as any).end}
                            </span>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-4">
                    {loadingPreview ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <Loader2 className="w-8 h-8 text-[#20c58f] animate-spin" />
                        <p className="text-slate-400 text-sm">Kontrollerar tillgänglighet...</p>
                      </div>
                    ) : isBatch ? (
                      /* ===== BATCH PREVIEW ===== */
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-slate-300 text-sm">
                            {batchIncludedDays} besöksdagar
                          </p>
                          <p className="text-xs text-slate-500">
                            {batchTotalSessions} kontrolltillfällen totalt
                          </p>
                        </div>

                        {/* Warning if any conflicts */}
                        {groupedDates.some(g => g.hasWarnings && !batchExcludedDates.has(g.dateKey)) && (
                          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-400">
                              Vissa datum har justerats eller varningar. Kontrollera tiderna.
                            </p>
                          </div>
                        )}

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {groupedDates.map(({ dateKey, displayDate, unitSlots, hasWarnings }) => {
                            const excluded = batchExcludedDates.has(dateKey)
                            return (
                              <button
                                key={dateKey}
                                onClick={() => toggleBatchExcludeDate(dateKey)}
                                className={`w-full p-3 rounded-xl border text-left transition-all ${
                                  excluded
                                    ? 'border-slate-800 bg-slate-900 opacity-40'
                                    : hasWarnings
                                      ? 'border-amber-500/50 bg-amber-500/5'
                                      : 'border-slate-700 bg-slate-800/30'
                                }`}
                              >
                                {/* Date header with checkbox */}
                                <div className="flex items-center gap-2 mb-1.5">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                    excluded ? 'border-slate-600' : 'border-[#20c58f] bg-[#20c58f]'
                                  }`}>
                                    {!excluded && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <CalendarDays className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  <span className={`text-sm font-medium ${excluded ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                                    {format(displayDate, 'EEEE d MMMM yyyy', { locale: sv })}
                                  </span>
                                </div>
                                {/* Per-unit slots */}
                                <div className="space-y-1 ml-7">
                                  {unitSlots.map(({ unit, date: d }) => (
                                    <div key={unit.customerId} className="flex items-center gap-2 text-xs">
                                      <Clock className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                      <span className={`font-medium truncate ${excluded ? 'text-slate-600' : 'text-slate-300'}`}>
                                        {unit.customerName}
                                      </span>
                                      <span className={excluded ? 'text-slate-700' : 'text-slate-500'}>
                                        {format(d.date, 'HH:mm')}–{format(d.endDate, 'HH:mm')}
                                      </span>
                                      {d.isAdjusted && !excluded && (
                                        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {groupedDates.length === 0 && (
                          <div className="text-center py-6 text-slate-500 text-sm">
                            Inga datum kunde genereras för vald period
                          </div>
                        )}
                      </>
                    ) : (
                      /* ===== SINGLE-UNIT PREVIEW ===== */
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-slate-300 text-sm">
                            {includedCount} kontrolltillfällen
                          </p>
                          {previewDates.length > 0 && (
                            <p className="text-xs text-slate-500">
                              {format(previewDates[0].date, 'MMM yyyy', { locale: sv })} – {format(previewDates[previewDates.length - 1].date, 'MMM yyyy', { locale: sv })}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {previewDates.map((d, i) => {
                            const excluded = excludedIndices.has(i)
                            return (
                              <button
                                key={i}
                                onClick={() => toggleExclude(i)}
                                className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center gap-3 ${
                                  excluded
                                    ? 'border-slate-800 bg-slate-900 opacity-40'
                                    : d.hasConflictWarning
                                      ? 'border-red-500/50 bg-red-500/10'
                                      : d.isAdjusted
                                        ? 'border-amber-500/50 bg-amber-500/10'
                                        : 'border-slate-700 bg-slate-800'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  excluded ? 'border-slate-600' : 'border-[#20c58f] bg-[#20c58f]'
                                }`}>
                                  {!excluded && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <CalendarDays className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    <span className={`text-sm font-medium ${excluded ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                                      {format(d.date, 'EEEE d MMMM yyyy', { locale: sv })}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {format(d.date, 'HH:mm')}–{format(d.endDate, 'HH:mm')}
                                    </span>
                                  </div>
                                  {d.isAdjusted && d.adjustmentReason && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${d.hasConflictWarning ? 'text-red-400' : 'text-amber-400'}`} />
                                      <span className={`text-xs ${d.hasConflictWarning ? 'text-red-400' : 'text-amber-400'}`}>
                                        {d.adjustmentReason}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {previewDates.length === 0 && (
                          <div className="text-center py-6 text-slate-500 text-sm">
                            Inga datum kunde genereras för vald period
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
            <button
              onClick={() => step === 1 ? onClose() : setStep((step - 1) as WizardStep)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? 'Avbryt' : 'Tillbaka'}
            </button>

            {step < 5 ? (
              <button
                onClick={() => setStep((step + 1) as WizardStep)}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#20c58f] hover:bg-[#1ab07f] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition"
              >
                Nästa
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting || loadingPreview}
                className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] hover:bg-[#1ab07f] disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Skapar...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {submitLabel}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
