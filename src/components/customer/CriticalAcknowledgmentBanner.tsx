// src/components/customer/CriticalAcknowledgmentBanner.tsx - Läskvitto för kritiska ärenden

import React, { useState } from 'react'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
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

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span className="text-xs">Laddar bekräftelsestatus...</span>
        </div>
      </div>
    )
  }

  if (acknowledgment) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 flex items-center gap-2">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <p className="text-xs text-emerald-400 font-medium">
          Bekräftad av {acknowledgment.user_name || acknowledgment.user_email}
          <span className="text-emerald-600 font-normal ml-1">{formatDate(acknowledgment.acknowledged_at)}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2.5 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">Bekräftelse krävs</p>
          <p className="text-xs text-slate-400 mt-0.5">Vi har en plan och arbetar aktivt med ärendet</p>
        </div>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer group mb-3">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center ${
            isChecked
              ? 'bg-[#20c58f] border-[#20c58f]'
              : 'border-slate-500 group-hover:border-amber-400'
          }`}>
            {isChecked && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
          Jag har tagit del av teknikerns bedömning och rekommendationer gällande detta ärende.
        </span>
      </label>

      <Button
        onClick={handleAcknowledge}
        disabled={!isChecked || isSubmitting}
        className={`w-full justify-center transition-all duration-200 ${
          isChecked && !isSubmitting
            ? 'bg-[#20c58f] hover:bg-[#1aad7d] text-white'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <>
            <Clock className="w-3.5 h-3.5 animate-spin mr-2" />
            Bekräftar...
          </>
        ) : (
          <>
            <CheckCircle className="w-3.5 h-3.5 mr-2" />
            Bekräfta att jag har läst
          </>
        )}
      </Button>
    </div>
  )
}

export default CriticalAcknowledgmentBanner
