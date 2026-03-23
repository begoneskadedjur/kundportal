import React from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../../utils/formatters'
import type { JourneyStage } from '../../../pages/admin/CustomerJourney'

interface Props {
  stages: JourneyStage[]
  selectedStageId: string | null
  onSelectStage: (id: string) => void
}

// ─── Stage node ──────────────────────────────────────────

function StageNode({
  stage, isSelected, onClick, delay, size = 'normal',
}: {
  stage: JourneyStage
  isSelected: boolean
  onClick: () => void
  delay: number
  size?: 'normal' | 'medium'
}) {
  const Icon = stage.icon
  const isMedium = size === 'medium'

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all p-3 ${
        isSelected
          ? 'border-[#20c58f] bg-[#20c58f]/10 ring-1 ring-[#20c58f]/30'
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${stage.bgColor} shrink-0`}>
          <Icon className={`w-4 h-4 ${stage.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <span className={`${isMedium ? 'text-xs' : 'text-sm'} font-medium text-white truncate`}>
              {stage.label}
            </span>
            <span className={`${isMedium ? 'text-base' : 'text-lg'} font-bold ${stage.textColor} shrink-0`}>
              {stage.count}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-slate-500">{stage.percentage}%</span>
            {stage.totalValue > 0 && (
              <span className="text-[10px] text-slate-400">{formatCurrency(stage.totalValue)}</span>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-2 w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(stage.percentage, 2)}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8 }}
          className={`h-full rounded-full ${
            stage.color === 'slate' ? 'bg-slate-500' :
            stage.color === 'amber' ? 'bg-amber-500' :
            stage.color === 'teal' ? 'bg-teal-500' :
            stage.color === 'green' ? 'bg-[#20c58f]' :
            stage.color === 'red' ? 'bg-red-500' :
            stage.color === 'blue' ? 'bg-blue-500' :
            stage.color === 'emerald' ? 'bg-emerald-500' :
            stage.color === 'orange' ? 'bg-orange-500' :
            stage.color === 'purple' ? 'bg-purple-500' :
            'bg-slate-500'
          }`}
        />
      </div>
    </motion.button>
  )
}

// ─── Branch connector (1 → N) ───────────────────────────

function BranchConnector({ count }: { count: number }) {
  const positions = Array.from({ length: count }, (_, i) => {
    const pct = count === 1 ? 50 : (i / (count - 1)) * 80 + 10
    return `${pct}%`
  })

  return (
    <div className="py-1.5">
      <svg width="100%" height="28" className="text-slate-600">
        <line x1="50%" y1="0" x2="50%" y2="10" stroke="currentColor" strokeWidth="1" />
        <line x1={positions[0]} y1="10" x2={positions[positions.length - 1]} y2="10" stroke="currentColor" strokeWidth="1" />
        {positions.map((x, i) => (
          <line key={i} x1={x} y1="10" x2={x} y2="28" stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────

export default function ClosedCasesFunnelChart({ stages, selectedStageId, onSelectStage }: Props) {
  const totalStage = stages.find(s => s.id === 'total')
  const reasonStages = stages
    .filter(s => s.id !== 'total')
    .sort((a, b) => b.count - a.count)

  let d = 0

  return (
    <div className="p-4 sm:p-6 bg-slate-800/20 border border-slate-700/50 rounded-xl">
      <div className="max-w-4xl mx-auto">
        {/* Top node: total */}
        {totalStage && (
          <StageNode
            stage={totalStage}
            isSelected={selectedStageId === 'total'}
            onClick={() => onSelectStage('total')}
            delay={d++ * 0.08}
          />
        )}

        {/* Branch connector */}
        {reasonStages.length > 0 && (
          <BranchConnector count={reasonStages.length} />
        )}

        {/* Reason nodes grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {reasonStages.map(stage => (
            <StageNode
              key={stage.id}
              stage={stage}
              isSelected={selectedStageId === stage.id}
              onClick={() => onSelectStage(stage.id)}
              delay={d++ * 0.08}
              size="medium"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
