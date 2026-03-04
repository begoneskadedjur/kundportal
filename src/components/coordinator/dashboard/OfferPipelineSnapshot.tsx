import React from 'react'
import { motion } from 'framer-motion'
import { FileSignature, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { OfferStats } from '../../../types/casePipeline'
import { formatCurrency } from '../../../utils/formatters'

interface OfferPipelineSnapshotProps {
  stats: OfferStats | null
  loading: boolean
}

const COLORS = {
  pending: '#f59e0b',   // amber
  signed: '#10b981',    // emerald
  declined: '#ef4444',  // red
  overdue: '#f97316',   // orange
}

const signRateColor = (rate: number) => {
  if (rate >= 60) return 'text-emerald-400'
  if (rate >= 40) return 'text-amber-400'
  return 'text-red-400'
}

const OfferPipelineSnapshot: React.FC<OfferPipelineSnapshotProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <FileSignature className="w-4 h-4 text-[#20c58f]" />
          </div>
          <h3 className="text-sm font-semibold text-white">Offertläge</h3>
        </div>
        <div className="text-sm text-slate-500">Laddar...</div>
      </motion.div>
    )
  }

  const chartData = [
    { name: 'Väntande', value: stats.pending, color: COLORS.pending },
    { name: 'Signerade', value: stats.signed, color: COLORS.signed },
    { name: 'Avvisade', value: stats.declined, color: COLORS.declined },
    { name: 'Förfallna', value: stats.overdue, color: COLORS.overdue },
  ].filter(d => d.value > 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
          <FileSignature className="w-4 h-4 text-[#20c58f]" />
        </div>
        <h3 className="text-sm font-semibold text-white">Offertläge</h3>
      </div>

      <div className="flex gap-4">
        {/* Donut chart */}
        {chartData.length > 0 && (
          <div className="w-24 h-24 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stats grid */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-xs text-slate-500">Väntande</p>
            <p className="text-sm font-semibold text-amber-400">{stats.pending}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Förfallna</p>
            <p className={`text-sm font-semibold ${stats.overdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {stats.overdue}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Signeringsgrad</p>
            <p className={`text-sm font-semibold ${signRateColor(stats.sign_rate)}`}>
              {Math.round(stats.sign_rate)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Signerat värde</p>
            <p className="text-sm font-semibold text-emerald-400">
              {formatCurrency(stats.total_value_signed)}
            </p>
          </div>
        </div>
      </div>

      <Link
        to="/koordinator/offertuppfoljning"
        className="mt-4 flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors"
      >
        Gå till offertuppföljning
        <ChevronRight className="w-3 h-3" />
      </Link>
    </motion.div>
  )
}

export default OfferPipelineSnapshot
