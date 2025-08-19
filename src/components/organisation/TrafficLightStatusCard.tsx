// src/components/organisation/TrafficLightStatusCard.tsx
import React from 'react'
import { AlertTriangle, MapPin, User, Calendar, FileText } from 'lucide-react'
import Card from '../ui/Card'
import RecommendationAcknowledgment from './RecommendationAcknowledgment'

interface TrafficLightStatusCardProps {
  caseData: {
    id: string
    case_number: string
    title: string
    status: string
    pest_level?: number | null
    problem_rating?: number | null
    recommendations?: string | null
    recommendations_acknowledged?: boolean
    recommendations_acknowledged_at?: string | null
    recommendations_acknowledged_by?: string | null
    work_report?: string | null
    pest_type?: string | null
    address?: string | null
    assessment_date?: string | null
    assessed_by?: string | null
    primary_technician_name?: string | null
  }
  isCustomerView?: boolean
  onAcknowledgmentUpdate?: () => void
}

const TrafficLightStatusCard: React.FC<TrafficLightStatusCardProps> = ({ 
  caseData, 
  isCustomerView = true,
  onAcknowledgmentUpdate 
}) => {
  // Beräkna trafikljusstatus baserat på pest_level och problem_rating
  const getTrafficLightStatus = () => {
    const pestLevel = caseData.pest_level ?? -1
    const problemRating = caseData.problem_rating ?? -1
    
    if (pestLevel === -1 && problemRating === -1) return null
    
    if (pestLevel >= 3 || problemRating >= 4) return 'red'
    if (pestLevel === 2 || problemRating === 3) return 'yellow'
    return 'green'
  }

  const trafficLightStatus = getTrafficLightStatus()

  // Om ingen trafikljusdata finns, visa inte kortet
  if (!trafficLightStatus) return null

  // Statusfärger och stilar
  const statusStyles = {
    green: {
      container: 'bg-green-500/20 border-green-500/50',
      text: 'text-green-400',
      icon: '🟢',
      label: 'OK - Kontrollerad situation',
      glow: 'shadow-green-500/25'
    },
    yellow: {
      container: 'bg-yellow-500/20 border-yellow-500/50',
      text: 'text-yellow-400',
      icon: '🟡',
      label: 'VARNING - Övervakning krävs',
      glow: 'shadow-yellow-500/25'
    },
    red: {
      container: 'bg-red-500/20 border-red-500/50',
      text: 'text-red-400',
      icon: '🔴',
      label: 'KRITISK - Omedelbar åtgärd krävs',
      glow: 'shadow-red-500/25'
    }
  }

  const currentStyle = statusStyles[trafficLightStatus]

  // Formatera datum
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Ej angivet'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Pest level beskrivning
  const getPestLevelDescription = (level: number | null | undefined) => {
    switch(level) {
      case 0: return 'Ingen förekomst'
      case 1: return 'Låg nivå - Minimal aktivitet'
      case 2: return 'Måttlig nivå - Synlig förekomst'
      case 3: return 'Hög nivå - Infestation'
      default: return 'Ej bedömt'
    }
  }

  // Problem rating beskrivning
  const getProblemRatingDescription = (rating: number | null | undefined) => {
    switch(rating) {
      case 1: return 'Utmärkt - Inga problem'
      case 2: return 'Bra - Under kontroll'
      case 3: return 'OK - Kräver övervakning'
      case 4: return 'Allvarligt - Åtgärd krävs'
      case 5: return 'Kritiskt - Brådskande åtgärd'
      default: return 'Ej bedömt'
    }
  }

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10 p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg">
      {/* Header med ärendeinfo */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Ärende: {caseData.case_number}
          </h3>
          <p className="text-sm text-slate-400">{caseData.title}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${currentStyle.container} ${currentStyle.text}`}>
          <span className="mr-2">{currentStyle.icon}</span>
          {caseData.status}
        </div>
      </div>

      {/* Trafikljusstatus */}
      <div className={`p-4 rounded-lg border ${currentStyle.container} mb-6`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">Teknikerns bedömning:</span>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${currentStyle.text}`}>
            <span className="text-xl">{currentStyle.icon}</span>
            <span>{currentStyle.label}</span>
          </div>
        </div>

        {/* Förklarande text */}
        <p className="text-xs text-slate-500 mb-3">
          Baserat på inspektion och expertis har vår tekniker bedömt situationen enligt nedan:
        </p>

        {/* Detaljerad bedömning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {caseData.pest_level !== null && caseData.pest_level !== undefined && (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-300">Skadedjursnivå</p>
              </div>
              <p className="text-lg font-bold text-white">
                Nivå {caseData.pest_level}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {getPestLevelDescription(caseData.pest_level)}
              </p>
            </div>
          )}

          {caseData.problem_rating !== null && caseData.problem_rating !== undefined && (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-medium text-slate-300">Övergripande status</p>
              </div>
              <p className="text-lg font-bold text-white">
                Betyg {caseData.problem_rating}/5
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {getProblemRatingDescription(caseData.problem_rating)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ärendedetaljer */}
      <div className="space-y-3 mb-6">
        {caseData.pest_type && (
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Skadedjur</p>
              <p className="text-sm text-white">{caseData.pest_type}</p>
            </div>
          </div>
        )}

        {caseData.address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Omfattning</p>
              <p className="text-sm text-white">{caseData.address}</p>
            </div>
          </div>
        )}

        {caseData.primary_technician_name && (
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Tekniker</p>
              <p className="text-sm text-white">{caseData.primary_technician_name}</p>
            </div>
          </div>
        )}

        {caseData.assessment_date && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400">Bedömningsdatum</p>
              <p className="text-sm text-white">{formatDate(caseData.assessment_date)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Teknikerns rekommendationer */}
      {caseData.recommendations && (
        <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
            Teknikerns rekommendation
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {caseData.recommendations}
          </p>
          {caseData.assessed_by && (
            <p className="text-xs text-slate-500 mt-3 text-right">
              - {caseData.assessed_by}, BeGone
            </p>
          )}
        </div>
      )}

      {/* Bekräftelsekomponent för kunder */}
      {isCustomerView && caseData.recommendations && (
        <RecommendationAcknowledgment
          caseId={caseData.id}
          recommendations={caseData.recommendations}
          isAcknowledged={caseData.recommendations_acknowledged || false}
          acknowledgedAt={caseData.recommendations_acknowledged_at}
          onAcknowledgmentUpdate={onAcknowledgmentUpdate}
        />
      )}

      {/* Om inga rekommendationer finns */}
      {!caseData.recommendations && isCustomerView && (
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-400">
            Detaljerade rekommendationer kommer att läggas till efter nästa inspektion
          </p>
        </div>
      )}
    </Card>
  )
}

export default TrafficLightStatusCard