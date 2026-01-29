// src/components/customer/CustomerAssessmentPanel.tsx - Trafikljussystem för kundbedömning

import React from 'react'
import { Activity, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'
import { getOverallAssessmentLevel } from '../../types/acknowledgment'
import AssessmentScaleBar from '../shared/AssessmentScaleBar'
import TrafficLightBadge from '../organisation/TrafficLightBadge'

interface CustomerAssessmentPanelProps {
  pestLevel: number | null
  problemRating: number | null
}

const CustomerAssessmentPanel: React.FC<CustomerAssessmentPanelProps> = ({
  pestLevel,
  problemRating
}) => {
  // Om inga värden finns, visa inte panelen
  if (pestLevel === null && problemRating === null) {
    return null
  }

  const overallLevel = getOverallAssessmentLevel(pestLevel, problemRating)

  // Övergripande konfiguration baserat på nivå
  const overallConfig = {
    ok: {
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'emerald',
      bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      label: 'Situationen är under kontroll',
      description: 'Inga kritiska problem har identifierats. Fortsätt med ordinarie kontroller.'
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'amber',
      bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-400',
      label: 'Situationen kräver uppmärksamhet',
      description: 'Uppföljning rekommenderas för att förhindra eskalering.'
    },
    critical: {
      icon: <AlertCircle className="w-6 h-6" />,
      color: 'red',
      bgGradient: 'from-red-500/10 via-red-500/5 to-transparent',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-400',
      label: 'Kritisk situation identifierad',
      description: 'Omedelbart agerande krävs. BeGone arbetar aktivt med ärendet.'
    }
  }[overallLevel]

  return (
    <div className={`rounded-xl border ${overallConfig.borderColor} bg-gradient-to-br ${overallConfig.bgGradient} overflow-hidden`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Trafikljusikon */}
            <TrafficLightBadge
              pestLevel={pestLevel}
              problemRating={problemRating}
              size="medium"
              showTooltip={false}
            />
            <div className={`p-1.5 rounded-lg ${
              overallLevel === 'ok' ? 'bg-emerald-500/20' :
              overallLevel === 'warning' ? 'bg-amber-500/20' : 'bg-red-500/20'
            }`}>
              <Activity className={`w-4 h-4 ${overallConfig.textColor}`} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Situationsöversikt</h3>
              <p className="text-xs text-slate-400">Teknikerns bedömning</p>
            </div>
          </div>

          {/* Status badge - kompaktare */}
          <div className={`px-2 py-1 rounded-full ${
            overallLevel === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
            overallLevel === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
          } text-xs font-medium`}>
            {overallLevel === 'ok' ? 'OK' : overallLevel === 'warning' ? 'Varning' : 'Kritisk'}
          </div>
        </div>
      </div>

      {/* Bedömningskort med segmenterade skalor */}
      <div className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {/* Skadedjursnivå */}
          {pestLevel !== null && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <AssessmentScaleBar
                type="pest"
                value={pestLevel}
                size="sm"
                showLabels={true}
                showTitle={true}
              />
            </div>
          )}

          {/* Övergripande problembild */}
          {problemRating !== null && (
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <AssessmentScaleBar
                type="problem"
                value={problemRating}
                size="sm"
                showLabels={true}
                showTitle={true}
              />
            </div>
          )}
        </div>

        {/* Kortfattad statustext */}
        <div className={`p-2 rounded-lg bg-slate-800/50 border border-slate-700/50`}>
          <div className="flex items-center gap-2">
            <Info className={`w-3.5 h-3.5 flex-shrink-0 ${overallConfig.textColor}`} />
            <p className={`text-xs ${overallConfig.textColor}`}>
              {overallConfig.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerAssessmentPanel
