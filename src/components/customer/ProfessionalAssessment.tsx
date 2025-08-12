// src/components/customer/ProfessionalAssessment.tsx - Professional Assessment Display Component
import React from 'react'
import { Lightbulb, AlertTriangle } from 'lucide-react'

// Types for assessment display
export type PestLevel = 0 | 1 | 2 | 3
export type ProblemRating = 1 | 2 | 3 | 4 | 5
export type TrafficLightColor = 'green' | 'yellow' | 'red'

export interface AssessmentData {
  pest_level?: PestLevel | null
  problem_rating?: ProblemRating | null  
  recommendations?: string | null
  assessment_date?: string | null
  assessed_by?: string | null
}

interface ProfessionalAssessmentProps {
  assessment: AssessmentData
  className?: string
  compact?: boolean
}

// Helper functions for assessment display
const getTrafficLightStatus = (pestLevel?: PestLevel | null, problemRating?: ProblemRating | null) => {
  const pest = pestLevel ?? undefined
  const problem = problemRating ?? undefined
  
  if ((problem && problem >= 4) || (pest && pest >= 3)) {
    return { 
      level: 'critical' as const, 
      emoji: '🔴', 
      text: 'Kritisk situation - Åtgärd krävs omgående', 
      color: 'red' as TrafficLightColor 
    }
  } else if ((problem && problem === 3) || (pest && pest === 2)) {
    return { 
      level: 'warning' as const, 
      emoji: '🟡', 
      text: 'Varning - Övervakning krävs', 
      color: 'yellow' as TrafficLightColor 
    }
  } else if (pest !== undefined || problem !== undefined) {
    return { 
      level: 'ok' as const, 
      emoji: '🟢', 
      text: 'OK - Situation under kontroll', 
      color: 'green' as TrafficLightColor 
    }
  }
  return null
}

const getPestLevelDisplay = (level: PestLevel) => {
  const displays = {
    0: { emoji: '✅', label: 'Ingen förekomst', desc: 'Ingen aktivitet upptäckt' },
    1: { emoji: '🟢', label: 'Låg nivå', desc: 'Minimal aktivitet' },
    2: { emoji: '🟡', label: 'Måttlig nivå', desc: 'Synlig förekomst' },
    3: { emoji: '🔴', label: 'Hög nivå/Infestation', desc: 'Omfattande problem' }
  }
  return displays[level] || displays[0]
}

const getProblemRatingDisplay = (rating: ProblemRating) => {
  const displays = {
    1: { label: 'Utmärkt', desc: 'Inga problem' },
    2: { label: 'Bra', desc: 'Under kontroll' },
    3: { label: 'Kräver uppmärksamhet', desc: 'Övervakning behövs' },
    4: { label: 'Allvarligt', desc: 'Åtgärd krävs' },
    5: { label: 'Kritiskt', desc: 'Brådskande åtgärd' }
  }
  return displays[rating] || displays[1]
}

const ProfessionalAssessment: React.FC<ProfessionalAssessmentProps> = ({ 
  assessment, 
  className = '',
  compact = false 
}) => {
  const { pest_level, problem_rating, recommendations, assessment_date, assessed_by } = assessment

  // Don't render if no assessment data
  if (!pest_level && !problem_rating && !recommendations) {
    return null
  }

  const status = getTrafficLightStatus(pest_level, problem_rating)

  if (compact) {
    // Compact version for summary displays
    return (
      <div className={`p-3 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg ${className}`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg flex-shrink-0">
            <span className="text-sm">🚦</span>
          </div>
          <div className="flex-1 min-w-0">
            <h6 className="text-xs font-semibold text-amber-400 truncate">
              Professionell bedömning
            </h6>
            {status && (
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-1">
                <span>{status.emoji}</span>
                <span className="truncate">{status.text}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`p-4 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg flex-shrink-0 mt-1">
          <span className="text-lg">🚦</span>
        </div>
        <div className="flex-1">
          <h5 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            Professionell bedömning & rekommendationer
          </h5>
          
          {/* Assessment Results */}
          {(pest_level !== null && pest_level !== undefined) || 
           (problem_rating !== null && problem_rating !== undefined) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {(pest_level !== null && pest_level !== undefined) && (() => {
                const pestDisplay = getPestLevelDisplay(pest_level)
                return (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg transition-colors hover:bg-slate-800/50">
                    <div className="text-xl">{pestDisplay.emoji}</div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-400">Skadedjursnivå</p>
                      <p className="text-sm font-bold text-white leading-tight">{pestDisplay.label}</p>
                      <p className="text-xs text-slate-500">{pestDisplay.desc}</p>
                    </div>
                  </div>
                )
              })()}
              
              {(problem_rating !== null && problem_rating !== undefined) && (() => {
                const problemDisplay = getProblemRatingDisplay(problem_rating)
                return (
                  <div className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg transition-colors hover:bg-slate-800/50">
                    <div className="text-xl font-bold text-white">{problem_rating}</div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-400">Övergripande status</p>
                      <p className="text-sm font-bold text-white leading-tight">{problemDisplay.label}</p>
                      <p className="text-xs text-slate-500">{problemDisplay.desc}</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : null}
          
          {/* Overall Status Indicator */}
          {(() => {
            if (!status) return null
            
            const statusColors = {
              critical: 'bg-red-500/10 border-red-500/30 text-red-400',
              warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', 
              ok: 'bg-green-500/10 border-green-500/30 text-green-400'
            }
            
            return (
              <div className={`p-4 rounded-lg border mb-4 transition-colors ${statusColors[status.level]}`}>
                <p className="font-semibold text-sm flex items-center gap-3">
                  <span className="text-lg">{status.emoji}</span>
                  <span className="leading-tight">{status.text}</span>
                </p>
                {status.level === 'critical' && (
                  <p className="text-xs mt-2 opacity-90 leading-relaxed">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Denna bedömning kräver er uppmärksamhet och eventuellt samarbete för att lösa problemet effektivt.
                  </p>
                )}
              </div>
            )
          })()}
          
          {/* Recommendations */}
          {recommendations && (
            <div className="bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
              <h6 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Våra professionella rekommendationer för er
              </h6>
              <div className="prose prose-slate prose-sm max-w-none">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {recommendations}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                    Baserat på vår professionella bedömning av situationen
                  </p>
                  {assessment_date && (
                    <p className="text-xs text-slate-500">
                      {new Date(assessment_date).toLocaleDateString('sv-SE')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfessionalAssessment