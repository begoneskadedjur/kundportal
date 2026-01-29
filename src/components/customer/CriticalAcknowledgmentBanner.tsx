// src/components/customer/CriticalAcknowledgmentBanner.tsx - Läskvitto för kritiska ärenden

import React, { useState } from 'react'
import { AlertCircle, CheckCircle, Clock, Shield } from 'lucide-react'
import { CaseAcknowledgment } from '../../types/acknowledgment'
import Button from '../ui/Button'

interface CriticalAcknowledgmentBannerProps {
  acknowledgment: CaseAcknowledgment | null
  loading: boolean
  onAcknowledge: () => Promise<void>
}

const CriticalAcknowledgmentBanner: React.FC<CriticalAcknowledgmentBannerProps> = ({
  acknowledgment,
  loading,
  onAcknowledge
}) => {
  const [isChecked, setIsChecked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAcknowledge = async () => {
    if (!isChecked) return

    setIsSubmitting(true)
    try {
      await onAcknowledge()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Formatera datum på svenska
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Om redan bekräftad, visa bekräftelsebadge
  if (acknowledgment) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-emerald-400 font-medium">Bekräftad</p>
            <p className="text-sm text-slate-400">
              {acknowledgment.user_name || acknowledgment.user_email} bekräftade {formatDate(acknowledgment.acknowledged_at)}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">Läst & godkänd</span>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Laddar bekräftelsestatus...</span>
        </div>
      </div>
    )
  }

  // Ej bekräftad - visa formulär
  return (
    <div className="rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-red-500/20 bg-red-500/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="text-red-400 font-semibold">Kritisk situation - bekräftelse krävs</h4>
            <p className="text-sm text-blue-300">Vi har en plan och arbetar aktivt med ärendet</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
              isChecked
                ? 'bg-red-500 border-red-500'
                : 'border-slate-500 group-hover:border-red-400'
            }`}>
              {isChecked && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
            Jag har tagit del av teknikerns bedömning och rekommendationer gällande detta ärende.
            Jag förstår allvaret i situationen och de åtgärder som vidtas.
          </span>
        </label>

        {/* Button */}
        <Button
          onClick={handleAcknowledge}
          disabled={!isChecked || isSubmitting}
          className={`w-full justify-center transition-all duration-200 ${
            isChecked && !isSubmitting
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Clock className="w-4 h-4 animate-spin mr-2" />
              Bekräftar...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Bekräfta att jag har läst
            </>
          )}
        </Button>

        {/* Info text */}
        <p className="text-xs text-slate-500 text-center">
          Er bekräftelse sparas för dokumentation och kvalitetssäkring.
        </p>
      </div>
    </div>
  )
}

export default CriticalAcknowledgmentBanner
