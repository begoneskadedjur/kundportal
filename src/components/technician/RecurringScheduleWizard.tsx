// src/components/technician/RecurringScheduleWizard.tsx
// Wizard for setting up recurring inspection schedules

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronLeft, ChevronRight, Calendar, Clock, Check,
  AlertTriangle, Loader2, CalendarDays, Repeat
} from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import DatePicker from 'react-datepicker'
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
  CreateRecurringScheduleInput
} from '../../types/recurringSchedule'
import {
  FREQUENCY_CONFIG,
  DAY_PATTERN_CONFIG,
  DURATION_OPTIONS
} from '../../types/recurringSchedule'
import type { WorkSchedule } from '../../types/database'

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

interface RecurringScheduleWizardProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (scheduleId: string, sessionsCreated: number) => void
  customerId: string
  customerName: string
  technicianId: string
  contractStartDate?: string | null
  contractEndDate?: string | null
  serviceFrequency?: string | null
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

export function RecurringScheduleWizard({
  isOpen,
  onClose,
  onComplete,
  customerId,
  customerName,
  technicianId,
  contractStartDate,
  contractEndDate,
  serviceFrequency
}: RecurringScheduleWizardProps) {
  const { profile } = useAuth()
  const [step, setStep] = useState<WizardStep>(1)

  // Step 1: Start date
  const [startDate, setStartDate] = useState<Date>(
    contractStartDate ? new Date(contractStartDate) : new Date()
  )

  // Step 2: Duration
  const [durationMinutes, setDurationMinutes] = useState(60)

  // Step 3: Frequency
  const [frequency, setFrequency] = useState<RecurringFrequency | null>(
    parseServiceFrequency(serviceFrequency) || null
  )

  // Step 4: Day pattern
  const [dayPattern, setDayPattern] = useState<RecurringDayPattern | null>(null)
  const [preferredDayOfMonth, setPreferredDayOfMonth] = useState(1)

  // Step 5: Time
  const [preferredTime, setPreferredTime] = useState('09:00')
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null)

  // Step 6: Preview
  const [previewDates, setPreviewDates] = useState<GeneratedInspectionDate[]>([])
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set())
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setFrequency(parseServiceFrequency(serviceFrequency) || null)
      setDayPattern(null)
      setPreferredTime('09:00')
      setPreviewDates([])
      setExcludedIndices(new Set())
    }
  }, [isOpen])

  // Generate preview when entering step 6
  useEffect(() => {
    if (step === 6 && frequency && dayPattern) {
      generatePreview()
    }
  }, [step])

  const generatePreview = async () => {
    if (!frequency || !dayPattern) return
    setLoadingPreview(true)
    try {
      // Always preview 14 months ahead — contract_end_date is just the binding period,
      // contracts continue until explicitly terminated
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
        technicianWorkSchedule: workSchedule
      })

      setPreviewDates(dates)
      setExcludedIndices(new Set())
    } catch (error) {
      console.error('Error generating preview:', error)
      toast.error('Kunde inte generera forhandsvisning')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSubmit = async () => {
    if (!frequency || !dayPattern || isSubmitting) return
    setIsSubmitting(true)

    try {
      const includedDates = previewDates.filter((_, i) => !excludedIndices.has(i))

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
        created_by: profile?.id
      }

      const result = await createScheduleWithSessions(input, includedDates)

      if (result.schedule) {
        toast.success(`${result.sessionsCreated} kontrolltillfallen skapade`)
        onComplete(result.schedule.id, result.sessionsCreated)
        onClose()
      } else {
        toast.error(result.errors[0] || 'Kunde inte skapa schemat')
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

  const includedCount = previewDates.length - excludedIndices.size

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!startDate
      case 2: return durationMinutes > 0
      case 3: return !!frequency
      case 4: return !!dayPattern
      case 5: return !!preferredTime
      case 6: return includedCount > 0
      default: return false
    }
  }

  const stepLabels = ['Startdatum', 'Tid per besok', 'Frekvens', 'Dagval', 'Klockslag', 'Forhandsvisning']

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
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Repeat className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Aterkommande kontroller</h2>
                <p className="text-slate-400 text-xs">{customerName}</p>
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
                    i + 1 <= step ? 'bg-blue-500' : 'bg-slate-700'
                  }`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Steg {step} av 6: {stepLabels[step - 1]}
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
                      Nar ska kontrollerna borja? Valj startdatum for det aterkommande schemat.
                    </p>
                    <div className="flex justify-center">
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => date && setStartDate(date)}
                        locale={sv}
                        inline
                        minDate={new Date()}
                        calendarClassName="!bg-slate-800 !border-slate-700"
                      />
                    </div>
                    <p className="text-xs text-slate-500 text-center">
                      Forsta kontroll: {format(startDate, 'EEEE d MMMM yyyy', { locale: sv })}
                    </p>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Hur lang tid tar en kontrollrunda hos denna kund?
                      Detta anvands for att undvika krockar med andra arenden.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {DURATION_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setDurationMinutes(opt.value)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                            durationMinutes === opt.value
                              ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <Clock className="w-4 h-4 inline mr-2" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Hur ofta ska kontroller genomforas?
                    </p>
                    <div className="space-y-2">
                      {(Object.entries(FREQUENCY_CONFIG) as [RecurringFrequency, typeof FREQUENCY_CONFIG[RecurringFrequency]][]).map(([key, config]) => (
                        <button
                          key={key}
                          onClick={() => setFrequency(key)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            frequency === key
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <span className={`text-sm font-medium ${frequency === key ? 'text-blue-300' : 'text-slate-300'}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-slate-500 ml-2">{config.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Vilken dag i varje period ska kontrollen laggas?
                    </p>

                    {/* Grouped patterns */}
                    {(['recommended', 'first_week', 'second_week', 'other'] as const).map(group => {
                      const groupLabel = {
                        recommended: 'Rekommenderat',
                        first_week: 'Forsta veckan',
                        second_week: 'Andra veckan',
                        other: 'Ovrigt'
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
                                    ? 'border-blue-500 bg-blue-500/20'
                                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                }`}
                              >
                                <span className={`text-sm ${dayPattern === key ? 'text-blue-300' : 'text-slate-300'}`}>
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
                        <label className="text-sm text-slate-300">Dag i manaden:</label>
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
                )}

                {step === 5 && (
                  <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                      Vilken tid pa dagen ska kontrollen borja?
                    </p>
                    <div className="flex justify-center">
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {workSchedule && (
                      <div className="text-xs text-slate-500 text-center space-y-0.5">
                        <p>Dina arbetstider:</p>
                        {Object.entries(workSchedule)
                          .filter(([, v]) => (v as any).active)
                          .slice(0, 5)
                          .map(([day, v]) => (
                            <span key={day} className="inline-block mx-1">
                              {day.slice(0, 3)}: {(v as any).start}-{(v as any).end}
                            </span>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}

                {step === 6 && (
                  <div className="space-y-4">
                    {loadingPreview ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        <p className="text-slate-400 text-sm">Kontrollerar tillganglighet...</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-slate-300 text-sm">
                            {includedCount} kontrolltillfallen
                          </p>
                          {previewDates.length > 0 && (
                            <p className="text-xs text-slate-500">
                              {format(previewDates[0].date, 'MMM yyyy', { locale: sv })} - {format(previewDates[previewDates.length - 1].date, 'MMM yyyy', { locale: sv })}
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
                                  excluded ? 'border-slate-600' : 'border-blue-500 bg-blue-500'
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
                                      {format(d.date, 'HH:mm')}-{format(d.endDate, 'HH:mm')}
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
                            Inga datum kunde genereras for vald period
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

            {step < 6 ? (
              <button
                onClick={() => setStep((step + 1) as WizardStep)}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition"
              >
                Nasta
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting || loadingPreview}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Skapar...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Skapa {includedCount} kontrolltillfallen
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
