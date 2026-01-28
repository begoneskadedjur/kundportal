// src/components/customer/CustomerAssessmentPanel.tsx - Trafikljussystem för kundbedömning

import React from 'react'
import { Activity, AlertTriangle, CheckCircle, Info, Shield, AlertCircle } from 'lucide-react'
import {
  getOverallAssessmentLevel,
  requiresAcknowledgment
} from '../../types/acknowledgment'
import AssessmentScaleBar from '../shared/AssessmentScaleBar'
import ReassuranceMessage from '../shared/ReassuranceMessage'

interface CustomerAssessmentPanelProps {
  pestLevel: number | null
  problemRating: number | null
  recommendations?: string | null
}

const CustomerAssessmentPanel: React.FC<CustomerAssessmentPanelProps> = ({
  pestLevel,
  problemRating,
  recommendations
}) => {
  // Om inga värden finns, visa inte panelen
  if (pestLevel === null && problemRating === null) {
    return null
  }

  const overallLevel = getOverallAssessmentLevel(pestLevel, problemRating)
  const needsAcknowledgment = requiresAcknowledgment(pestLevel, problemRating)

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
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              overallLevel === 'ok' ? 'bg-emerald-500/20' :
              overallLevel === 'warning' ? 'bg-amber-500/20' : 'bg-red-500/20'
            }`}>
              <Activity className={`w-5 h-5 ${overallConfig.textColor}`} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Situationsöversikt</h3>
              <p className="text-xs text-slate-400">Teknikerns bedömning</p>
            </div>
          </div>

          {/* Status badge */}
          <div className={`px-3 py-1.5 rounded-full ${
            overallLevel === 'ok' ? 'bg-emerald-500/20 text-emerald-400' :
            overallLevel === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
          } text-sm font-medium flex items-center gap-2`}>
            {overallConfig.icon}
            <span className="hidden sm:inline">
              {overallLevel === 'ok' ? 'Under kontroll' : overallLevel === 'warning' ? 'Varning' : 'Kritisk'}
            </span>
          </div>
        </div>
      </div>

      {/* Bedömningskort med segmenterade skalor */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Skadedjursnivå */}
          {pestLevel !== null && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <AssessmentScaleBar
                type="pest"
                value={pestLevel}
                size="md"
                showLabels={true}
                showTitle={true}
              />
            </div>
          )}

          {/* Övergripande problembild */}
          {problemRating !== null && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <AssessmentScaleBar
                type="problem"
                value={problemRating}
                size="md"
                showLabels={true}
                showTitle={true}
              />
            </div>
          )}
        </div>

        {/* Förklaringssektion */}
        <div className={`p-4 rounded-lg bg-slate-800/50 border border-slate-700/50`}>
          <div className="flex items-start gap-3">
            <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${overallConfig.textColor}`} />
            <div>
              <p className={`text-sm font-medium ${overallConfig.textColor}`}>
                {overallConfig.label}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {overallConfig.description}
              </p>
            </div>
          </div>
        </div>

        {/* Rekommendationer om de finns */}
        {recommendations && (
          <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-400 mb-1">Teknikerns rekommendationer</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{recommendations}</p>
              </div>
            </div>
          </div>
        )}

        {/* Lugnande meddelande för varning/kritisk */}
        {(overallLevel === 'warning' || overallLevel === 'critical') && (
          <div className="mt-4">
            <ReassuranceMessage
              level={overallLevel === 'critical' ? 'critical' : 'warning'}
            />
          </div>
        )}

        {/* Kritisk varning - bekräftelse krävs */}
        {needsAcknowledgment && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-400">
                Denna bedömning kräver er bekräftelse nedan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerAssessmentPanel
