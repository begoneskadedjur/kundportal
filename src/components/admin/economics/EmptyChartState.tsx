import React from 'react'
import { TrendingUp } from 'lucide-react'

interface EmptyChartStateProps {
  title?: string
  message?: string
  icon?: React.ReactNode
  height?: string // t.ex. "h-64"
}

const EmptyChartState: React.FC<EmptyChartStateProps> = ({
  title = 'Data ackumuleras',
  message = 'Visas när fler ärenden avslutas med den nya billing-modellen',
  icon,
  height = 'h-64',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${height} px-6`}>
      <div className="w-12 h-12 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
        {icon || <TrendingUp className="w-6 h-6 text-slate-500" />}
      </div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-[320px]">{message}</p>
    </div>
  )
}

export default EmptyChartState
