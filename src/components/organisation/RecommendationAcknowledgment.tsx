// src/components/organisation/RecommendationAcknowledgment.tsx
import React, { useState } from 'react'
import { Check, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../ui/Button'
import toast from 'react-hot-toast'

interface RecommendationAcknowledgmentProps {
  caseId: string
  recommendations: string
  isAcknowledged: boolean
  acknowledgedAt?: string | null
  onAcknowledgmentUpdate?: () => void
}

const RecommendationAcknowledgment: React.FC<RecommendationAcknowledgmentProps> = ({
  caseId,
  recommendations,
  isAcknowledged: initialAcknowledged,
  acknowledgedAt,
  onAcknowledgmentUpdate
}) => {
  const { profile } = useAuth()
  const [acknowledged, setAcknowledged] = useState(initialAcknowledged)
  const [loading, setLoading] = useState(false)
  const [showRemindLater, setShowRemindLater] = useState(false)

  const handleAcknowledge = async () => {
    if (!profile) return

    try {
      setLoading(true)

      const { error } = await supabase
        .from('cases')
        .update({
          recommendations_acknowledged: true,
          recommendations_acknowledged_at: new Date().toISOString(),
          recommendations_acknowledged_by: profile.id
        })
        .eq('id', caseId)

      if (error) throw error

      setAcknowledged(true)
      toast.success('Tack! Vi har noterat att ni tagit del av rekommendationerna', {
        icon: '✅',
        duration: 5000
      })

      // Anropa callback om den finns
      if (onAcknowledgmentUpdate) {
        onAcknowledgmentUpdate()
      }
    } catch (error: any) {
      console.error('Error acknowledging recommendations:', error)
      toast.error('Kunde inte bekräfta. Försök igen senare.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemindLater = () => {
    setShowRemindLater(true)
    toast('Vi påminner dig nästa gång du loggar in', {
      icon: '🔔',
      duration: 3000
    })
    
    // Dölj komponenten temporärt (kommer tillbaka vid nästa inloggning)
    setTimeout(() => {
      setShowRemindLater(false)
    }, 3000)
  }

  // Formatera datum
  const formatAcknowledgedDate = (dateString: string | null | undefined) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Om redan bekräftat, visa bekräftelsestatus
  if (acknowledged) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 transition-all duration-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-400 mb-1">
              Rekommendationer bekräftade
            </p>
            {acknowledgedAt && (
              <p className="text-xs text-slate-400">
                {formatAcknowledgedDate(acknowledgedAt)}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Om användaren valt påminn senare (temporärt dold)
  if (showRemindLater) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 transition-all duration-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <p className="text-sm text-blue-400">Vi påminner dig senare...</p>
        </div>
      </div>
    )
  }

  // Visa bekräftelseuppmaning
  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4 transition-all duration-200">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-300 mb-1">
            Vänligen bekräfta att ni tagit del av rekommendationerna
          </p>
          <p className="text-xs text-slate-400">
            Detta hjälper oss att säkerställa att ni har den information ni behöver
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleAcknowledge}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-300 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin mr-2" />
              Bekräftar...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Jag har läst och förstått
            </>
          )}
        </Button>

        <Button
          onClick={handleRemindLater}
          disabled={loading}
          className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600 rounded-lg text-slate-300 transition-all duration-200 hover:scale-[1.02]"
        >
          <Clock className="w-4 h-4 mr-2" />
          Påminn senare
        </Button>
      </div>
    </div>
  )
}

export default RecommendationAcknowledgment