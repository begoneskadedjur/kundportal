// src/components/technician/ScheduleInfoPanel.tsx
// Bottom sheet (mobil) / sidopanel (desktop) för schema-info per kund

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  X, Repeat, Clock, CalendarDays, Pencil, AlertCircle, Loader2
} from 'lucide-react'
import { getCustomerScheduleInfo } from '../../services/recurringScheduleService'
import { FREQUENCY_CONFIG, DAY_PATTERN_CONFIG } from '../../types/recurringSchedule'
import type { CustomerScheduleInfo } from '../../types/recurringSchedule'

interface SiteTarget {
  customerId: string
  siteName: string
}

interface ScheduleInfoPanelProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  customerName: string
  siteCustomerIds?: SiteTarget[]
  onEditSchedule: (scheduleId: string) => void
}

export function ScheduleInfoPanel({
  isOpen,
  onClose,
  customerId,
  customerName,
  siteCustomerIds,
  onEditSchedule
}: ScheduleInfoPanelProps) {
  const [loading, setLoading] = useState(false)
  const [scheduleInfos, setScheduleInfos] = useState<(CustomerScheduleInfo | null)[]>([])
  const [labels, setLabels] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (siteCustomerIds && siteCustomerIds.length > 0) {
        // Multisite: fetch per site
        const results = await Promise.all(
          siteCustomerIds.map(s => getCustomerScheduleInfo(s.customerId))
        )
        setScheduleInfos(results)
        setLabels(siteCustomerIds.map(s => s.siteName))
      } else {
        // Single customer
        const info = await getCustomerScheduleInfo(customerId)
        setScheduleInfos([info])
        setLabels([customerName])
      }
    } catch (err) {
      console.error('Error fetching schedule info:', err)
    } finally {
      setLoading(false)
    }
  }, [customerId, customerName, siteCustomerIds])

  useEffect(() => {
    if (isOpen) {
      fetchData()
    } else {
      setScheduleInfos([])
      setLabels([])
    }
  }, [isOpen, fetchData])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 150) {
      onClose()
    }
  }

  const totalRemaining = scheduleInfos.reduce((sum, s) => sum + (s?.remainingSessions ?? 0), 0)
  const hasAnySchedule = scheduleInfos.some(s => s !== null)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel — bottom sheet on mobile, side panel on desktop */}
          <motion.div
            className="fixed z-50 bg-slate-900 border-slate-700
              bottom-0 left-0 right-0 border-t rounded-t-2xl
              md:bottom-auto md:top-0 md:left-auto md:right-0 md:w-96 md:border-t-0 md:border-l md:rounded-t-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ maxHeight: '85vh' }}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-200">{customerName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Schema och kontroller</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              {loading ? (
                <LoadingSkeleton count={siteCustomerIds?.length ?? 1} />
              ) : !hasAnySchedule ? (
                <NoScheduleState />
              ) : (
                <>
                  {/* Summary */}
                  {scheduleInfos.length > 1 && totalRemaining > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#20c58f]/10 border border-[#20c58f]/20 rounded-xl">
                      <Repeat className="w-3.5 h-3.5 text-[#20c58f]" />
                      <span className="text-sm text-[#20c58f] font-medium">
                        Totalt {totalRemaining} kontroller kvar
                      </span>
                    </div>
                  )}

                  {/* Per-site cards */}
                  {scheduleInfos.map((info, idx) => (
                    <SiteScheduleCard
                      key={labels[idx] || idx}
                      siteName={labels[idx]}
                      info={info}
                      onEditSchedule={onEditSchedule}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-700/50">
              <button
                onClick={onClose}
                className="w-full py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Stäng
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================
// Sub-components
// ============================================

function SiteScheduleCard({
  siteName,
  info,
  onEditSchedule
}: {
  siteName: string
  info: CustomerScheduleInfo | null
  onEditSchedule: (scheduleId: string) => void
}) {
  const [showAllDates, setShowAllDates] = useState(false)

  if (!info) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <p className="text-sm font-medium text-slate-300">{siteName}</p>
        <p className="text-xs text-slate-500 mt-1">Inget aktivt schema</p>
      </div>
    )
  }

  const freqConfig = FREQUENCY_CONFIG[info.frequency]
  const dayConfig = DAY_PATTERN_CONFIG[info.dayPattern]
  const visibleSessions = showAllDates ? info.futureSessions : info.futureSessions.slice(0, 4)

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2.5">
      {/* Site header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">{siteName}</p>
        <button
          onClick={() => onEditSchedule(info.scheduleId)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-[#20c58f] hover:bg-slate-800 rounded-lg transition-colors"
          title="Redigera schema"
        >
          <Pencil className="w-3 h-3" />
          <span>Ändra</span>
        </button>
      </div>

      {/* Schedule meta */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Repeat className="w-3 h-3 text-[#20c58f]" />
          <span className="text-xs text-slate-300">{freqConfig?.label ?? info.frequency}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-300">
            kl {info.preferredTime} ({info.estimatedDurationMinutes} min)
          </span>
        </div>
      </div>

      {/* Day pattern */}
      <p className="text-[10px] text-slate-500">{dayConfig?.label ?? info.dayPattern}</p>

      {/* Stats row */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-700/50">
        <div>
          <p className="text-xs text-slate-400">Kvar</p>
          <p className="text-sm font-semibold text-slate-200">{info.remainingSessions}</p>
        </div>
        {info.nextSessionDate && (
          <div>
            <p className="text-xs text-slate-400">Nästa</p>
            <p className="text-sm font-semibold text-slate-200">
              {format(new Date(info.nextSessionDate), 'd MMM yyyy', { locale: sv })}
            </p>
          </div>
        )}
      </div>

      {/* Upcoming dates */}
      {info.futureSessions.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Kommande datum</p>
          <div className="space-y-1">
            {visibleSessions.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CalendarDays className="w-3 h-3 text-slate-500" />
                <span className="text-slate-300">
                  {format(new Date(s.scheduled_at), 'EEE d MMM', { locale: sv })}
                </span>
                <span className="text-slate-500">
                  {format(new Date(s.scheduled_at), 'HH:mm')}–{s.scheduled_end ? format(new Date(s.scheduled_end), 'HH:mm') : ''}
                </span>
              </div>
            ))}
          </div>
          {info.futureSessions.length > 4 && (
            <button
              onClick={() => setShowAllDates(!showAllDates)}
              className="text-[10px] text-[#20c58f] hover:text-[#20c58f]/80 mt-1"
            >
              {showAllDates ? 'Visa färre' : `Visa alla ${info.futureSessions.length} datum`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NoScheduleState() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-300">Inget aktivt schema</p>
      <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
        Denna kund har inget återkommande kontrollschema ännu.
      </p>
    </div>
  )
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse space-y-2">
          <div className="h-4 w-32 bg-slate-700/50 rounded" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 w-20 bg-slate-700/30 rounded" />
            <div className="h-3 w-24 bg-slate-700/30 rounded" />
          </div>
          <div className="flex gap-4 pt-1">
            <div className="h-8 w-16 bg-slate-700/30 rounded" />
            <div className="h-8 w-24 bg-slate-700/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
