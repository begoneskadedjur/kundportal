import React from 'react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../../utils/formatters'
import type { JourneyStage } from '../../../pages/admin/CustomerJourney'

interface Props {
  stages: JourneyStage[]
  selectedStageId: string | null
  onSelectStage: (id: string) => void
}

// ─── Layout ──────────────────────────────────────────────
// Row 1: [created] (full width)
// Row 2: [direct | offer_sent | no_result] (3-col)
// Row 3: under offer_sent → [accepted | declined] (2-col)
// Row 4-5: [invoiced → paid] (full width)
// Separate: [closed]

function getConversionRate(from: number, to: number): string {
  if (from === 0) return '0%'
  return `${Math.round((to / from) * 100)}%`
}

// ─── Connector ───────────────────────────────────────────

function VerticalConnector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-5 bg-slate-600" />
      {label && <span className="text-[10px] text-slate-500 my-0.5">{label}</span>}
      <svg width="12" height="8" viewBox="0 0 12 8" className="text-slate-600">
        <path d="M6 8L0 0h12z" fill="currentColor" />
      </svg>
    </div>
  )
}

// ─── Stage node ──────────────────────────────────────────

function StageNode({
  stage, isSelected, onClick, delay, compact,
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
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${stage.bgColor} shrink-0`}>
          <Icon className={`w-4 h-4 ${stage.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-white truncate`}>{stage.label}</span>
            <span className={`${compact ? 'text-base' : 'text-lg'} font-bold ${stage.textColor}`}>{stage.count}</span>
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
            stage.color === 'orange' ? 'bg-orange-500' :
            'bg-slate-500'
          }`}
        />
      </div>
    </motion.button>
  )
}

// ─── Branch connector (1 → 3) ────────────────────────────

function TripleBranchConnector() {
  return (
    <div className="py-1">
      <svg width="100%" height="28" className="text-slate-600" preserveAspectRatio="none">
        {/* Center stem */}
        <line x1="50%" y1="0" x2="50%" y2="8" stroke="currentColor" strokeWidth="1" />
        {/* Horizontal bar */}
        <line x1="16.67%" y1="8" x2="83.33%" y2="8" stroke="currentColor" strokeWidth="1" />
        {/* Left drop */}
        <line x1="16.67%" y1="8" x2="16.67%" y2="28" stroke="currentColor" strokeWidth="1" />
        {/* Center drop */}
        <line x1="50%" y1="8" x2="50%" y2="28" stroke="currentColor" strokeWidth="1" />
        {/* Right drop */}
        <line x1="83.33%" y1="8" x2="83.33%" y2="28" stroke="currentColor" strokeWidth="1" />
        {/* Arrowheads */}
        <polygon points="14.17,28 16.67,34 19.17,28" fill="currentColor" />
        <polygon points="47.5,28 50,34 52.5,28" fill="currentColor" />
        <polygon points="80.83,28 83.33,34 85.83,28" fill="currentColor" />
      </svg>
    </div>
  )
}

function DoubleBranchConnector() {
  return (
    <div className="py-1">
      <svg width="100%" height="28" className="text-slate-600" preserveAspectRatio="none">
        <line x1="50%" y1="0" x2="50%" y2="8" stroke="currentColor" strokeWidth="1" />
        <line x1="25%" y1="8" x2="75%" y2="8" stroke="currentColor" strokeWidth="1" />
        <line x1="25%" y1="8" x2="25%" y2="28" stroke="currentColor" strokeWidth="1" />
        <line x1="75%" y1="8" x2="75%" y2="28" stroke="currentColor" strokeWidth="1" />
        <polygon points="22.5,28 25,34 27.5,28" fill="currentColor" />
        <polygon points="72.5,28 75,34 77.5,28" fill="currentColor" />
      </svg>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────

export default function CustomerJourneyFunnel({ stages, selectedStageId, onSelectStage }: Props) {
  const stageMap = new Map(stages.map(s => [s.id, s]))
  const get = (id: string) => stageMap.get(id)

  const created = get('created')
  const direct = get('direct')
  const offerSent = get('offer_sent')
  const noResult = get('no_result')
  const accepted = get('accepted')
  const declined = get('declined')
  const invoiced = get('invoiced')
  const paid = get('paid')
  const closed = get('closed')

  let d = 0

  return (
    <div className="p-4 bg-slate-800/20 border border-slate-700/50 rounded-xl">
      <div className="max-w-2xl mx-auto">

        {/* Row 1: Created (full width) */}
        {created && (
          <StageNode
            stage={created}
            isSelected={selectedStageId === 'created'}
            onClick={() => onSelectStage('created')}
            delay={d++ * 0.08}
          />
        )}

        {/* Triple branch connector */}
        <TripleBranchConnector />

        {/* Row 2: direct | offer_sent | no_result */}
        <div className="grid grid-cols-3 gap-2">
          {direct && (
            <StageNode
              stage={direct}
              isSelected={selectedStageId === 'direct'}
              onClick={() => onSelectStage('direct')}
              delay={d++ * 0.08}
              compact
            />
          )}
          {offerSent && (
            <StageNode
              stage={offerSent}
              isSelected={selectedStageId === 'offer_sent'}
              onClick={() => onSelectStage('offer_sent')}
              delay={d++ * 0.08}
              compact
            />
          )}
          {noResult && (
            <StageNode
              stage={noResult}
              isSelected={selectedStageId === 'no_result'}
              onClick={() => onSelectStage('no_result')}
              delay={d++ * 0.08}
              compact
            />
          )}
        </div>

        {/* Sub-branch under offer_sent: accepted / declined */}
        {offerSent && offerSent.count > 0 && (accepted || declined) && (
          <div className="grid grid-cols-3 gap-2">
            {/* Empty left column (under direct) */}
            <div />
            {/* Center column: branch connector + sub-nodes */}
            <div>
              <DoubleBranchConnector />
              <div className="grid grid-cols-2 gap-1.5">
                {accepted && (
                  <StageNode
                    stage={accepted}
                    isSelected={selectedStageId === 'accepted'}
                    onClick={() => onSelectStage('accepted')}
                    delay={d++ * 0.08}
                    compact
                  />
                )}
                {declined && (
                  <StageNode
                    stage={declined}
                    isSelected={selectedStageId === 'declined'}
                    onClick={() => onSelectStage('declined')}
                    delay={d++ * 0.08}
                    compact
                  />
                )}
              </div>
            </div>
            {/* Empty right column (under no_result) */}
            <div />
          </div>
        )}

        {/* Bottom flow: invoiced → paid */}
        {invoiced && (
          <>
            <VerticalConnector
              label={created ? `↓ ${getConversionRate(created.count, invoiced.count)}` : undefined}
            />
            <StageNode
              stage={invoiced}
              isSelected={selectedStageId === 'invoiced'}
              onClick={() => onSelectStage('invoiced')}
              delay={d++ * 0.08}
            />
          </>
        )}
        {paid && (
          <>
            <VerticalConnector
              label={invoiced ? `↓ ${getConversionRate(invoiced.count, paid.count)}` : undefined}
            />
            <StageNode
              stage={paid}
              isSelected={selectedStageId === 'paid'}
              onClick={() => onSelectStage('paid')}
              delay={d++ * 0.08}
            />
          </>
        )}

        {/* Closed (separate section) */}
        {closed && closed.count > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: d++ * 0.08 }}
            className="mt-4 pt-3 border-t border-slate-700/50"
          >
            <StageNode
              stage={closed}
              isSelected={selectedStageId === 'closed'}
              onClick={() => onSelectStage('closed')}
              delay={0}
              compact
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
