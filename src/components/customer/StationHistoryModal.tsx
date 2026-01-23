// src/components/customer/StationHistoryModal.tsx
// Modal för att visa historisk trend för en enskild station

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import { IndoorStationService } from '../../services/indoorStationService'
import { getOutdoorInspectionsByStation } from '../../services/inspectionSessionService'
import { calculateStatus } from '../../utils/equipmentStatisticsUtils'
import { CALCULATED_STATUS_CONFIG } from '../../types/stationTypes'

interface StationHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  stationId: string
  locationType: 'indoor' | 'outdoor'
  stationName: string
  stationType: string
  stationTypeColor: string
  thresholdWarning: number | null
  thresholdCritical: number | null
  thresholdDirection?: 'above' | 'below'
  measurementUnit: string
  measurementLabel: string | null
}

interface HistoryDataPoint {
  date: string
  dateFormatted: string
  value: number | null
  status: 'ok' | 'warning' | 'critical'
}

export function StationHistoryModal({
  isOpen,
  onClose,
  stationId,
  locationType,
  stationName,
  stationType,
  stationTypeColor,
  thresholdWarning,
  thresholdCritical,
  thresholdDirection = 'above',
  measurementUnit,
  measurementLabel
}: StationHistoryModalProps) {
  const [loading, setLoading] = useState(true)
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([])

  useEffect(() => {
    if (!isOpen || !stationId) return

    const fetchHistory = async () => {
      try {
        setLoading(true)

        let inspections: any[] = []

        if (locationType === 'indoor') {
          inspections = await IndoorStationService.getInspectionsByStation(stationId, 50)
        } else {
          inspections = await getOutdoorInspectionsByStation(stationId, 50)
        }

        // Transformera till HistoryDataPoint
        const dataPoints: HistoryDataPoint[] = inspections
          .filter(insp => insp.inspected_at || insp.created_at)
          .map(insp => {
            const date = new Date(insp.inspected_at || insp.created_at)
            const value = insp.measurement_value
            const status = calculateStatus(
              value,
              thresholdWarning,
              thresholdCritical,
              thresholdDirection
            )

            return {
              date: insp.inspected_at || insp.created_at,
              dateFormatted: date.toLocaleDateString('sv-SE', {
                day: 'numeric',
                month: 'short',
                year: '2-digit'
              }),
              value,
              status
            }
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        setHistoryData(dataPoints)
      } catch (error) {
        console.error('Error fetching station history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [isOpen, stationId, locationType, thresholdWarning, thresholdCritical, thresholdDirection])

  // Beräkna statistik
  const stats = useMemo(() => {
    const valuesWithData = historyData.filter(d => d.value !== null)
    if (valuesWithData.length === 0) {
      return { min: null, max: null, avg: null, trend: null, trendDirection: 'stable' as const }
    }

    const values = valuesWithData.map(d => d.value!)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10

    // Beräkna trend (senaste vs första halvan av data)
    let trend: number | null = null
    let trendDirection: 'up' | 'down' | 'stable' = 'stable'

    if (valuesWithData.length >= 2) {
      const latest = valuesWithData[valuesWithData.length - 1].value!
      const previous = valuesWithData[valuesWithData.length - 2].value!
      trend = latest - previous
      if (trend > 0) trendDirection = 'up'
      else if (trend < 0) trendDirection = 'down'
    }

    return { min, max, avg, trend, trendDirection }
  }, [historyData])

  if (!isOpen) return null

  const unitLabel = measurementUnit === 'gram' ? 'g' : measurementUnit === 'st' ? '' : measurementUnit

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${stationTypeColor}20` }}
            >
              <Activity className="w-6 h-6" style={{ color: stationTypeColor }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{stationName}</h2>
              <p className="text-sm text-slate-400">
                {stationType} • {locationType === 'indoor' ? 'Inomhus' : 'Utomhus'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Ingen historik tillgänglig för denna station
            </div>
          ) : (
            <>
              {/* Statistik-kort */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1">Kontroller</p>
                  <p className="text-2xl font-bold text-white">{historyData.length}</p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1">Genomsnitt</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.avg !== null ? `${stats.avg}${unitLabel}` : '-'}
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1">Min / Max</p>
                  <p className="text-lg font-bold text-white">
                    {stats.min !== null && stats.max !== null
                      ? `${stats.min} / ${stats.max}${unitLabel}`
                      : '-'}
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1">Senaste trend</p>
                  <div className={`flex items-center gap-1 text-xl font-bold ${
                    stats.trendDirection === 'down' ? 'text-emerald-400' :
                    stats.trendDirection === 'up' ? 'text-red-400' :
                    'text-slate-400'
                  }`}>
                    {stats.trendDirection === 'down' && <TrendingDown className="w-5 h-5" />}
                    {stats.trendDirection === 'up' && <TrendingUp className="w-5 h-5" />}
                    {stats.trendDirection === 'stable' && <Minus className="w-5 h-5" />}
                    <span>
                      {stats.trend !== null
                        ? `${stats.trend > 0 ? '+' : ''}${stats.trend}${unitLabel}`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trendgraf */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  {measurementLabel || 'Mätvärden'} över tid
                </h3>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="dateFormatted"
                        stroke="#9ca3af"
                        fontSize={12}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                        formatter={(value: number) => [`${value}${unitLabel}`, measurementLabel || 'Mätvärde']}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#22d3ee"
                        strokeWidth={3}
                        dot={{ fill: '#22d3ee', strokeWidth: 0, r: 5 }}
                        activeDot={{ r: 7, stroke: '#22d3ee', strokeWidth: 2, fill: '#0891b2' }}
                      />
                      {/* Tröskelvärden */}
                      {thresholdWarning !== null && (
                        <ReferenceLine
                          y={thresholdWarning}
                          stroke="#f59e0b"
                          strokeDasharray="5 5"
                          label={{
                            value: 'Varning',
                            fill: '#f59e0b',
                            fontSize: 11,
                            position: 'right'
                          }}
                        />
                      )}
                      {thresholdCritical !== null && (
                        <ReferenceLine
                          y={thresholdCritical}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          label={{
                            value: 'Kritisk',
                            fill: '#ef4444',
                            fontSize: 11,
                            position: 'right'
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Historiktabell */}
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Senaste kontroller
                  </h3>
                </div>
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="border-b border-slate-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Datum</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">{measurementLabel || 'Mätvärde'}</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {[...historyData].reverse().slice(0, 20).map((item, index) => {
                        const statusConfig = CALCULATED_STATUS_CONFIG[item.status]
                        return (
                          <tr key={index} className="hover:bg-slate-700/30">
                            <td className="px-4 py-3 text-slate-300">
                              {new Date(item.date).toLocaleDateString('sv-SE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-right text-white font-medium">
                              {item.value !== null ? `${item.value}${unitLabel}` : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center">
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: `${statusConfig.color}20`,
                                    color: statusConfig.color
                                  }}
                                >
                                  {item.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {item.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5" />}
                                  {item.status === 'critical' && <AlertTriangle className="w-3.5 h-3.5" />}
                                  {statusConfig.label}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  )
}

export default StationHistoryModal
