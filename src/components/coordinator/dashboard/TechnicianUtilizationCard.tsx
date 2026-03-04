import React from 'react'
import { motion } from 'framer-motion'
import { Users, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { TechnicianUtilizationData } from '../../../services/coordinatorAnalyticsService'

interface TechnicianUtilizationCardProps {
  data: TechnicianUtilizationData[]
  loading: boolean
}

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

const TechnicianUtilizationCard: React.FC<TechnicianUtilizationCardProps> = ({ data, loading }) => {
  const sorted = [...data].sort((a, b) => b.utilization_percent - a.utilization_percent)
  const top5 = sorted.slice(0, 5)
  const avgUtilization = data.length > 0
    ? Math.round(data.reduce((sum, d) => sum + d.utilization_percent, 0) / data.length)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800/80 rounded-lg border border-slate-700">
            <Users className="w-4 h-4 text-[#20c58f]" />
          </div>
          <h3 className="text-sm font-semibold text-white">Teknikerbeläggning</h3>
        </div>
        <span className="text-2xl font-bold text-white">{avgUtilization}%</span>
      </div>

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
