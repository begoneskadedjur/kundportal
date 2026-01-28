// src/components/shared/ReassuranceMessage.tsx
// Lugnande meddelande för kritiska nivåer - "vi hanterar det"

import React from 'react'
import { Shield, CheckCircle, Wrench } from 'lucide-react'

type ReassuranceLevel = 'warning' | 'critical'

interface ReassuranceMessageProps {
  level: ReassuranceLevel
  compact?: boolean
}

const REASSURANCE_CONFIG = {
  warning: {
    icon: Wrench,
    title: 'Vi arbetar förebyggande',
    message: 'En varning innebär att vi identifierat något som kräver uppmärksamhet. ' +
      'Med rätt förebyggande åtgärder och regelbunden uppföljning håller vi situationen under kontroll.',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-300'
  },
  critical: {
    icon: Shield,
    title: 'Situationen kräver åtgärd – men vi har en plan',
    message: 'Detta är en situation vi har hanterat många gånger tidigare. ' +
      'Med rätt åtgärder och ert samarbete återgår läget till normalt inom kort. ' +
      'Vi prioriterar detta ärende.',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-300'
  }
}

const ReassuranceMessage: React.FC<ReassuranceMessageProps> = ({
  level,
  compact = false
}) => {
  const config = REASSURANCE_CONFIG[level]
  const Icon = config.icon

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
        <Icon className={`w-4 h-4 ${config.iconColor} flex-shrink-0`} />
        <p className={`text-sm ${config.textColor}`}>
          {config.title}
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl ${config.bgColor} ${config.borderColor} border overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.iconBg} flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${config.textColor} mb-1`}>
              {config.title}
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              {config.message}
            </p>
          </div>
        </div>

        {/* Tilläggsinformation för kritisk nivå */}
        {level === 'critical' && (
          <div className="mt-4 pt-3 border-t border-blue-500/20">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>BeGone arbetar aktivt med ert ärende</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReassuranceMessage
