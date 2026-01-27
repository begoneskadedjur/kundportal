// src/components/shared/CustomerAcknowledgmentIndicator.tsx
// Diskret indikator för teknikervyn som visar om kunden har bekräftat kritiska ärenden

import React, { useState, useEffect } from 'react'
import { CheckCircle, Clock, Info, X } from 'lucide-react'
import { AcknowledgmentService } from '../../services/acknowledgmentService'
import { CaseAcknowledgment, requiresAcknowledgment } from '../../types/acknowledgment'

interface CustomerAcknowledgmentIndicatorProps {
  caseId: string
  pestLevel: number | undefined
  problemRating: number | undefined
}

const CustomerAcknowledgmentIndicator: React.FC<CustomerAcknowledgmentIndicatorProps> = ({
  caseId,
  pestLevel,
  problemRating
}) => {
  const [acknowledgments, setAcknowledgments] = useState<CaseAcknowledgment[]>([])
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  // Kontrollera om ärendet är kritiskt
  const isCritical = requiresAcknowledgment(pestLevel ?? null, problemRating ?? null)

  useEffect(() => {
    if (!caseId || !isCritical) {
      setLoading(false)
      return
    }

    const fetchAcknowledgments = async () => {
      try {
        const data = await AcknowledgmentService.getCaseAcknowledgments(caseId)
        setAcknowledgments(data)
      } catch (error) {
        console.error('Error fetching acknowledgments:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAcknowledgments()
  }, [caseId, isCritical])

  // Visa ingenting om ärendet inte är kritiskt
  if (!isCritical) return null

  // Loading state
  if (loading) {
    return (
      <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Laddar bekräftelsestatus...</span>
        </div>
      </div>
    )
  }

  const hasAcknowledgment = acknowledgments.length > 0
  const latestAck = acknowledgments[0]

  // Formatera datum
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Förkorta namn (Anna Andersson -> Anna A.)
  const shortenName = (name: string | null) => {
    if (!name) return 'Okänd'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0]
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`
  }

  if (hasAcknowledgment && latestAck) {
    return (
      <div className="mb-4 relative">
        {/* Huvudindikator */}
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-300 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Bekräftad av kunden</span>
            <span className="text-emerald-400/60">•</span>
            <span className="text-emerald-400/80">{shortenName(latestAck.user_name)}</span>
            <span className="text-emerald-400/60">•</span>
            <span className="text-emerald-400/80">{formatDate(latestAck.acknowledged_at)}</span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 hover:bg-emerald-500/20 rounded transition-colors"
            title="Visa detaljer"
          >
            <Info className="w-4 h-4 text-emerald-400/60 hover:text-emerald-300" />
          </button>
        </div>

        {/* Detaljpanel */}
        {showDetails && (
          <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Bekräftelsedetaljer</h4>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Bekräftad av</p>
                <p className="text-white">{latestAck.user_name || 'Okänd användare'}</p>
                <p className="text-slate-400 text-xs">{latestAck.user_email}</p>
              </div>

              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Tidpunkt</p>
                <p className="text-white">
                  {new Date(latestAck.acknowledged_at).toLocaleDateString('sv-SE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {(latestAck.pest_level_at_acknowledgment !== null || latestAck.problem_rating_at_acknowledgment !== null) && (
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Bedömning vid bekräftelse</p>
                  <div className="flex gap-4">
                    {latestAck.pest_level_at_acknowledgment !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Nivå:</span>
                        <span className="text-white font-medium">{latestAck.pest_level_at_acknowledgment}/3</span>
                      </div>
                    )}
                    {latestAck.problem_rating_at_acknowledgment !== null && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Betyg:</span>
                        <span className="text-white font-medium">{latestAck.problem_rating_at_acknowledgment}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Ingen bekräftelse - visa "väntar"
  return (
    <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-center gap-2 text-amber-400 text-sm">
        <Clock className="w-4 h-4" />
        <span>Väntar på kundbekräftelse</span>
      </div>
    </div>
  )
}

export default CustomerAcknowledgmentIndicator
