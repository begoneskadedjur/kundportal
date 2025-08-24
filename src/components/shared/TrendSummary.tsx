// src/components/shared/TrendSummary.tsx - Aktuell status och trend-indikator
import React from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface TrendSummaryProps {
  currentPestLevel?: number | null
  currentProblemRating?: number | null
  pestLevelTrend?: 'up' | 'down' | 'stable' | null
  problemRatingTrend?: 'up' | 'down' | 'stable' | null
  totalCases: number
  criticalCases: number
  warningCases: number
  okCases: number
  unacknowledgedCount?: number
  lastAssessment?: string | null
}

const TrendSummary: React.FC<TrendSummaryProps> = ({
  currentPestLevel,
  currentProblemRating,
  pestLevelTrend,
  problemRatingTrend,
  totalCases,
  criticalCases,
  warningCases,
  okCases,
  unacknowledgedCount = 0,
  lastAssessment
}) => {

  // Få färg för trafikljusstatus
  const getStatusColor = (level: number | null, isPestLevel: boolean = true) => {
    if (level === null || level === undefined) return 'text-slate-400'
    
    if (isPestLevel) {
      if (level >= 3) return 'text-red-400'
      if (level === 2) return 'text-yellow-400'
      return 'text-green-400'
    } else {
      if (level >= 4) return 'text-red-400'
      if (level === 3) return 'text-yellow-400'  
      return 'text-green-400'
    }
  }

  // Få bakgrundsfärg för status
  const getStatusBg = (level: number | null, isPestLevel: boolean = true) => {
    if (level === null || level === undefined) return 'bg-slate-500/20 border-slate-500/30'
    
    if (isPestLevel) {
      if (level >= 3) return 'bg-red-500/20 border-red-500/30'
      if (level === 2) return 'bg-yellow-500/20 border-yellow-500/30'
      return 'bg-green-500/20 border-green-500/30'
    } else {
      if (level >= 4) return 'bg-red-500/20 border-red-500/30'
      if (level === 3) return 'bg-yellow-500/20 border-yellow-500/30'
      return 'bg-green-500/20 border-green-500/30'
    }
  }

  // Trend-ikon
  const TrendIcon = ({ trend, className }: { trend?: 'up' | 'down' | 'stable' | null, className?: string }) => {
    if (!trend) return null
    
    switch (trend) {
      case 'up':
        return <TrendingUp className={`w-4 h-4 text-red-400 ${className}`} />
      case 'down':
        return <TrendingDown className={`w-4 h-4 text-green-400 ${className}`} />
      case 'stable':
        return <Minus className={`w-4 h-4 text-slate-400 ${className}`} />
      default:
        return null
    }
  }

  // Formatera datum
  const formatLastAssessment = (dateString: string | null) => {
    if (!dateString) return 'Ej bedömt'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Igår'
    if (diffDays < 7) return `${diffDays} dagar sedan`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} veckor sedan`
    return date.toLocaleDateString('sv-SE')
  }

  return (
    <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-6">
      
      {/* Header med sammanfattning */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Aktuell Status & Trends</h3>
          <p className="text-slate-400 text-sm">
            Sammanfattning av tekniska bedömningar och utvecklingstrender
          </p>
        </div>
        
        {unacknowledgedCount > 0 && (
          <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg px-3 py-2 text-amber-400 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{unacknowledgedCount} obekräftad{unacknowledgedCount !== 1 ? 'e' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Aktuella värden med trender */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Skadedjursnivå */}
        <div className={`p-4 rounded-lg border ${getStatusBg(currentPestLevel, true)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 font-medium text-sm">Aktuell Skadedjursnivå</span>
            <TrendIcon trend={pestLevelTrend} />
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${getStatusColor(currentPestLevel, true)}`}>
              {currentPestLevel ?? '—'}
            </span>
            <div className="text-xs text-slate-400">
              <p>av 3 möjliga</p>
              {pestLevelTrend && (
                <p className="mt-1">
                  {pestLevelTrend === 'up' && 'Försämring'}
                  {pestLevelTrend === 'down' && 'Förbättring'}
                  {pestLevelTrend === 'stable' && 'Stabil'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Övergripande problembild */}
        <div className={`p-4 rounded-lg border ${getStatusBg(currentProblemRating, false)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 font-medium text-sm">Övergripande Problembild</span>
            <TrendIcon trend={problemRatingTrend} />
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${getStatusColor(currentProblemRating, false)}`}>
              {currentProblemRating ?? '—'}
            </span>
            <div className="text-xs text-slate-400">
              <p>av 5 möjliga</p>
              {problemRatingTrend && (
                <p className="mt-1">
                  {problemRatingTrend === 'up' && 'Försämring'}
                  {problemRatingTrend === 'down' && 'Förbättring'}
                  {problemRatingTrend === 'stable' && 'Stabil'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ärendefördelning */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-400 text-sm">Ärendefördelning ({totalCases} totalt)</span>
          {lastAssessment && (
            <span className="text-slate-500 text-xs">
              Senast bedömt: {formatLastAssessment(lastAssessment)}
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-lg">🔴</span>
              <span className="text-red-400 font-bold text-lg">{criticalCases}</span>
            </div>
            <p className="text-red-400 text-xs font-medium">Kritiska</p>
          </div>
          
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-lg">🟡</span>
              <span className="text-yellow-400 font-bold text-lg">{warningCases}</span>
            </div>
            <p className="text-yellow-400 text-xs font-medium">Varningar</p>
          </div>
          
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-lg">🟢</span>
              <span className="text-green-400 font-bold text-lg">{okCases}</span>
            </div>
            <p className="text-green-400 text-xs font-medium">Under kontroll</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrendSummary