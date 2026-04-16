import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, ChevronRight, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import { sv } from 'date-fns/locale'
import { getTechnicianUtilizationData, type TechnicianUtilizationData } from '../../../services/coordinatorAnalyticsService'

type Period = 'day' | 'week' | 'month' | 'custom'

const ratingColor = (rating: 'low' | 'optimal' | 'overbooked') => {
  switch (rating) {
    case 'low': return 'bg-red-500'
    case 'optimal': return 'bg-emerald-500'
    case 'overbooked': return 'bg-amber-500'
  }
}

const ratingLabel = (rating: 'low' | 'optimal' | 'overbooked') => {
  switch (rating) {
    case 'low': return 'text-red-400'
    case 'optimal': return 'text-emerald-400'
    case 'overbooked': return 'text-amber-400'
  }
}

function getPeriodDates(period: Period, customStart: Date | null, customEnd: Date | null): { start: Date; end: Date } {
  const now = new Date()
  if (period === 'day') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() + 1) // Måndag
    start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }
  // custom
  return {
    start: customStart ?? new Date(),
    end: customEnd ?? new Date(),
  }
}

const periodLabel = (period: Period, start: Date, end: Date): string => {
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  if (period === 'day') return fmt(start)
  if (period === 'week') return `${fmt(start)} – ${fmt(end)}`
  if (period === 'month') return start.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

const TechnicianUtilizationCard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('week')
  const [customStart, setCustomStart] = useState<Date | null>(null)
  const [customEnd, setCustomEnd] = useState<Date | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [data, setData] = useState<TechnicianUtilizationData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (period === 'custom' && (!customStart || !customEnd)) return
    setLoading(true)
    try {
      const { start, end } = getPeriodDates(period, customStart, customEnd)
      const result = await getTechnicianUtilizationData(
        start.toISOString(),
        end.toISOString()
      )
      setData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  const { start, end } = getPeriodDates(period, customStart, customEnd)
  const sorted = [...data].sort((a, b) => b.utilization_percent - a.utilization_percent)
  const top5 = sorted.slice(0, 5)
  const avgUtilization = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.utilization_percent, 0) / data.length)
    : 0

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'day', label: 'Dag' },
    { key: 'week', label: 'Vecka' },
    { key: 'month', label: 'Månad' },
    { key: 'custom', label: 'Anpassad' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <Users className="w-4 h-4 text-[#20c58f]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Teknikerbeläggning</h3>
            <p className="text-[11px] text-slate-500">{periodLabel(period, start, end)}</p>
          </div>
        </div>
        <span className="text-2xl font-bold text-white">{loading ? '–' : `${avgUtilization}%`}</span>
      </div>

      {/* Period-väljare */}
      <div className="flex gap-1 mb-3">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setPeriod(key)
              setShowCustom(key === 'custom')
            }}
            className={`flex-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
              period === key
                ? 'bg-[#20c58f] text-slate-900'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Anpassad datumväljare */}
      {showCustom && (
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <DatePicker
            selected={customStart}
            onChange={(date) => setCustomStart(date)}
            selectsStart
            startDate={customStart}
            endDate={customEnd}
            locale={sv}
            dateFormat="yyyy-MM-dd"
            placeholderText="Från"
            className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
          <span className="text-slate-500 text-xs">–</span>
          <DatePicker
            selected={customEnd}
            onChange={(date) => setCustomEnd(date)}
            selectsEnd
            startDate={customStart}
            endDate={customEnd}
            minDate={customStart ?? undefined}
            locale={sv}
            dateFormat="yyyy-MM-dd"
            placeholderText="Till"
            className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white"
          />
        </div>
      )}

      {/* Teknikerlista */}
      {loading ? (
        <div className="text-sm text-slate-500">Laddar...</div>
      ) : top5.length === 0 ? (
        <div className="text-sm text-slate-500">Ingen data tillgänglig</div>
      ) : (
        <div className="space-y-2.5">
          {top5.map((tech) => (
            <div key={tech.technician_id} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-24 truncate">{tech.technician_name}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ratingColor(tech.efficiency_rating)}`}
                  style={{ width: `${Math.min(tech.utilization_percent, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-medium w-10 text-right ${ratingLabel(tech.efficiency_rating)}`}>
                {Math.round(tech.utilization_percent)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {data.length > 5 && (
        <Link
          to="/koordinator/analytics"
          className="mt-3 flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
        >
          Visa alla {data.length} tekniker
          <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </motion.div>
  )
}

export default TechnicianUtilizationCard
