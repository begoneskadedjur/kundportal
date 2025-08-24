// src/components/organisation/MetricExplanation.tsx - Förbättrad förklaringskomponent
import React, { useState } from 'react'
import { Bug, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'

interface MetricExplanationProps {
  compact?: boolean
  showBothMetrics?: boolean
}

interface ExplanationItem {
  value: number | string
  label: string
  description: string
  color: 'green' | 'yellow' | 'red'
  emoji: string
}

const MetricExplanation: React.FC<MetricExplanationProps> = ({ 
  compact = false, 
  showBothMetrics = true 
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact)

  // Förklaringar för skadedjursnivå (0-3)
  const pestLevelExplanations: ExplanationItem[] = [
    {
      value: '0-1',
      label: 'Under kontroll',
      description: 'Inga eller minimal aktivitet, situationen är under kontroll',
      color: 'green',
      emoji: '🟢'
    },
    {
      value: '2',
      label: 'Måttlig aktivitet',
      description: 'Måttlig aktivitet, kräver uppmärksamhet och uppföljning',
      color: 'yellow', 
      emoji: '🟡'
    },
    {
      value: '3',
      label: 'Hög aktivitet',
      description: 'Hög aktivitet, omedelbar åtgärd rekommenderas',
      color: 'red',
      emoji: '🔴'
    }
  ]

  // Förklaringar för övergripande problembild (1-5)
  const problemRatingExplanations: ExplanationItem[] = [
    {
      value: '1-2',
      label: 'Utmärkt/Bra',
      description: 'Situation väl hanterad, inga åtgärder krävs',
      color: 'green',
      emoji: '🟢'
    },
    {
      value: '3', 
      label: 'Övervakning krävs',
      description: 'OK situation som kräver kontinuerlig övervakning',
      color: 'yellow',
      emoji: '🟡'
    },
    {
      value: '4-5',
      label: 'Kritisk situation',
      description: 'Problematisk till kritisk situation, brådskande åtgärd krävs',
      color: 'red',
      emoji: '🔴'
    }
  ]

  const colorStyles = {
    green: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: 'text-green-400'
    },
    yellow: {
      bg: 'bg-yellow-500/20', 
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: 'text-yellow-400'
    },
    red: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/30', 
      text: 'text-red-400',
      icon: 'text-red-400'
    }
  }

  const ExplanationSection = ({ 
    title, 
    icon: Icon, 
    explanations, 
    subtitle 
  }: { 
    title: string
    icon: React.ElementType
    explanations: ExplanationItem[]
    subtitle: string
  }) => (
    <div className="flex-1">
      {/* Sektionshuvud */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-slate-700/50 rounded-lg">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h4 className="font-semibold text-white text-sm">{title}</h4>
          <p className="text-slate-400 text-xs">{subtitle}</p>
        </div>
      </div>

      {/* Förklaringar */}
      <div className="space-y-3">
        {explanations.map((item, index) => {
          const styles = colorStyles[item.color]
          return (
            <div 
              key={index}
              className={`p-3 rounded-lg border ${styles.bg} ${styles.border} transition-all duration-200 hover:scale-[1.02]`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{item.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${styles.text}`}>
                      Nivå {item.value}
                    </span>
                    <span className="text-slate-300 text-sm font-medium">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Kompakt vy för mobil
  if (compact && !isExpanded) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
            <span className="text-slate-300 font-medium text-sm">
              Vad betyder bedömningarna?
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
      {/* Header med toggle för kompakt läge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
          <span className="text-slate-300 font-medium text-sm">
            Vad betyder bedömningarna?
          </span>
        </div>
        {compact && (
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-slate-700/50 rounded"
          >
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {showBothMetrics ? (
        /* Två kolumner för båda mätningarna */
        <div className={`grid gap-6 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          <ExplanationSection
            title="SKADEDJURSNIVÅ (0-3)"
            subtitle="Direktmätning av aktivitet"
            icon={Bug}
            explanations={pestLevelExplanations}
          />
          
          <ExplanationSection
            title="ÖVERGRIPANDE PROBLEMBILD (1-5)"
            subtitle="Helhetsbedömning av situation"
            icon={AlertTriangle}
            explanations={problemRatingExplanations}
          />
        </div>
      ) : (
        /* Enkel vy med kombinerade förklaringar (behåller originaldesign) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-lg">🟢</span>
            <div>
              <p className="font-medium text-green-400">OK - Kontrollerad situation</p>
              <p className="text-slate-500">Inga eller minimal aktivitet, situationen är under kontroll</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🟡</span>
            <div>
              <p className="font-medium text-yellow-400">Varning - Övervakning krävs</p>
              <p className="text-slate-500">Måttlig aktivitet, kräver uppmärksamhet och uppföljning</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-lg">🔴</span>
            <div>
              <p className="font-medium text-red-400">Kritisk - Åtgärd krävs</p>
              <p className="text-slate-500">Hög aktivitet, omedelbar åtgärd rekommenderas</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer-info */}
      <div className="mt-4 pt-3 border-t border-slate-700/50">
        <p className="text-slate-500 text-xs text-center">
          Bedömningarna görs av våra certifierade tekniker vid varje besök baserat på expertis och fältobservationer
        </p>
      </div>
    </div>
  )
}

export default MetricExplanation