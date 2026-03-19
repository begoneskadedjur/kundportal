import React from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../../utils/formatters'
import type { JourneyStage } from '../../../pages/admin/CustomerJourney'

interface Props {
  stages: JourneyStage[]
  selectedStageId: string | null
  onSelectStage: (id: string) => void
}

// ─── Layout config ───────────────────────────────────────
// Main flow: created → booked → offer_sent → [branch] → completed → invoiced → paid
// Branch from offer_sent: accepted (left) / declined (right)
// Side branch: closed (shown separately)

const MAIN_FLOW = ['created', 'booked', 'offer_sent']
const BRANCH_LEFT = 'accepted'
const BRANCH_RIGHT = 'declined'
const POST_BRANCH = ['completed', 'invoiced', 'paid']
const SIDE_NODE = 'closed'

function getConversionRate(from: number, to: number): string {
  if (from === 0) return '0%'
  return `${Math.round((to / from) * 100)}%`
}

// ─── Connector arrow (vertical) ──────────────────────────

function VerticalConnector({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center py-1 ${className || ''}`}>
      <div className="w-px h-6 bg-slate-600" />
      {label && (
        <span className="text-[10px] text-slate-500 my-0.5">{label}</span>
      )}
      <svg width="12" height="8" viewBox="0 0 12 8" className="text-slate-600">
        <path d="M6 8L0 0h12z" fill="currentColor" />
      </svg>
    </div>
  )
}

// ─── Stage node ──────────────────────────────────────────

function StageNode({
  stage,
  isSelected,
  onClick,
  delay,
  compact,
}: {
  stage: JourneyStage
  isSelected: boolean
  onClick: () => void
  delay: number
  compact?: boolean
}) {
  const Icon = stage.icon
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-[#20c58f] bg-[#20c58f]/10 ring-1 ring-[#20c58f]/30'
          : 'border-slate-700 bg-slate-800/30 hover:border-slate-500 hover:bg-slate-800/50'
      } ${compact ? '' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${stage.bgColor} shrink-0`}>
          <Icon className={`w-4 h-4 ${stage.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-white truncate">{stage.label}</span>
            <span className={`text-lg font-bold ${stage.textColor}`}>{stage.count}</span>
          </div>
          {!compact && (
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-slate-500">{stage.percentage}% av totalt</span>
              {stage.totalValue > 0 && (
                <span className="text-xs text-slate-400">{formatCurrency(stage.totalValue)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
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
            'bg-slate-500'
          }`}
        />
      </div>
    </motion.button>
  )
}

// ─── Main component ──────────────────────────────────────

export default function CustomerJourneyFunnel({ stages, selectedStageId, onSelectStage }: Props) {
  const stageMap = new Map(stages.map(s => [s.id, s]))
  const getStage = (id: string) => stageMap.get(id)

  const mainStages = MAIN_FLOW.map(id => getStage(id)).filter(Boolean) as JourneyStage[]
  const leftBranch = getStage(BRANCH_LEFT)
  const rightBranch = getStage(BRANCH_RIGHT)
  const postBranch = POST_BRANCH.map(id => getStage(id)).filter(Boolean) as JourneyStage[]
  const sideNode = getStage(SIDE_NODE)

  let delayIdx = 0

  return (
    <div className="p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl">
      <div className="max-w-lg mx-auto">
        {/* Main flow: created → booked → offer_sent */}
        {mainStages.map((stage, i) => {
          const d = delayIdx++ * 0.08
          const nextStage = mainStages[i + 1]
          return (
            <React.Fragment key={stage.id}>
              <StageNode
                stage={stage}
                isSelected={selectedStageId === stage.id}
                onClick={() => onSelectStage(stage.id)}
                delay={d}
              />
              {nextStage && (
                <VerticalConnector
                  label={`↓ ${getConversionRate(stage.count, nextStage.count)}`}
                />
              )}
            </React.Fragment>
          )
        })}

        {/* Branch: accepted / declined */}
        {(leftBranch || rightBranch) && (
          <>
            {/* Branch connector */}
            <div className="flex items-start justify-center py-1">
              <div className="flex items-end gap-0">
                {/* Left branch line */}
                <div className="flex flex-col items-center w-1/2">
                  <svg width="100%" height="24" className="text-slate-600" preserveAspectRatio="none">
                    <line x1="50%" y1="0" x2="25%" y2="24" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </div>
                {/* Right branch line */}
                <div className="flex flex-col items-center w-1/2">
                  <svg width="100%" height="24" className="text-slate-600" preserveAspectRatio="none">
                    <line x1="50%" y1="0" x2="75%" y2="24" stroke="currentColor" strokeWidth="1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {leftBranch && (
                <div>
                  <StageNode
                    stage={leftBranch}
                    isSelected={selectedStageId === leftBranch.id}
                    onClick={() => onSelectStage(leftBranch.id)}
                    delay={delayIdx++ * 0.08}
                    compact
                  />
                </div>
              )}
              {rightBranch && (
                <div>
                  <StageNode
                    stage={rightBranch}
                    isSelected={selectedStageId === rightBranch.id}
                    onClick={() => onSelectStage(rightBranch.id)}
                    delay={delayIdx++ * 0.08}
                    compact
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Post-branch flow: completed → invoiced → paid */}
        {postBranch.map((stage, i) => {
          const d = delayIdx++ * 0.08
          const prevStage = i === 0
            ? (getStage('offer_sent') || mainStages[mainStages.length - 1])
            : postBranch[i - 1]
          const nextStage = postBranch[i + 1]
          return (
            <React.Fragment key={stage.id}>
              <VerticalConnector
                label={prevStage ? `↓ ${getConversionRate(prevStage.count, stage.count)}` : undefined}
              />
              <StageNode
                stage={stage}
                isSelected={selectedStageId === stage.id}
                onClick={() => onSelectStage(stage.id)}
                delay={d}
              />
            </React.Fragment>
          )
        })}

        {/* Closed (side node) */}
        {sideNode && sideNode.count > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delayIdx++ * 0.08 }}
            className="mt-4 pt-3 border-t border-slate-700/50"
          >
            <StageNode
              stage={sideNode}
              isSelected={selectedStageId === sideNode.id}
              onClick={() => onSelectStage(sideNode.id)}
              delay={0}
              compact
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
