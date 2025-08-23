// src/components/organisation/CaseListItem.tsx - Kompakt ärenderad för enhetsöversikt
import React from 'react'
import { ChevronRight, Calendar } from 'lucide-react'
import TrafficLightBadge from './TrafficLightBadge'

interface CaseListItemProps {
  caseData: {
    id: string
    case_number: string
    title: string
    status: string
    pest_level?: number | null
    problem_rating?: number | null
    assessment_date?: string | null
    primary_technician_name?: string | null
  }
  onClick: () => void
}

const CaseListItem: React.FC<CaseListItemProps> = ({ caseData, onClick }) => {
  
  // Format assessment date
  const formatAssessmentDate = (dateString: string | null) => {
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
    <div 
      onClick={onClick}
      className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 transition-all duration-200 hover:bg-slate-800/50 hover:border-slate-600/50 cursor-pointer"
    >
      <div className="flex items-center justify-between">
        
        {/* Vänster: Trafikljus + Ärendeinfo */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          
          {/* Trafikljusbadge */}
          <div className="flex-shrink-0">
            <TrafficLightBadge
              pestLevel={caseData.pest_level}
              problemRating={caseData.problem_rating}
              size="small"
              showTooltip={false}
            />
          </div>
          
          {/* Ärendeinfo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-white text-sm truncate">
                {caseData.case_number}
              </h4>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-slate-300 text-xs truncate">
                {caseData.title}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="bg-slate-700/50 px-2 py-0.5 rounded text-xs">
                {caseData.status}
              </span>
              
              {caseData.primary_technician_name && (
                <>
                  <span>•</span>
                  <span>{caseData.primary_technician_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Höger: Datum + Pil */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3 h-3" />
              <span>{formatAssessmentDate(caseData.assessment_date)}</span>
            </div>
          </div>
          
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  )
}

export default CaseListItem