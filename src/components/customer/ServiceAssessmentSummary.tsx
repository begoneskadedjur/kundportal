// src/components/customer/ServiceAssessmentSummary.tsx - Service Assessment Summary Card
import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, ChevronRight, Eye, AlertCircle, CalendarCheck } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case } from '../../types/cases'
import ReassuranceMessage from '../shared/ReassuranceMessage'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

interface ServiceAssessmentSummaryProps {
  customerId: string
  className?: string
  onOpenCaseDetails?: (caseId: string) => void
}

interface UpcomingVisit {
  id: string
  case_number: string
  title: string
  scheduled_start: string
  pest_type?: string
}

interface AssessmentSummary {
  latestAssessment: Case | null
  totalCases: number
  casesWithAssessments: number
  criticalCases: number
  warningCases: number
  okCases: number
  recentTrend: 'improving' | 'stable' | 'worsening' | null
  unacknowledgedCriticalCases: Case[]
  upcomingVisits: UpcomingVisit[]
}

const ServiceAssessmentSummary: React.FC<ServiceAssessmentSummaryProps> = ({
  customerId,
  className = '',
  onOpenCaseDetails
}) => {
  const { profile } = useAuth()
  const [summary, setSummary] = useState<AssessmentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.customer_id) {
      fetchAssessmentSummary()
    }
  }, [profile?.customer_id])

  const fetchAssessmentSummary = async () => {
    if (!profile?.customer_id) return

    try {
      // Hämta alla ärenden
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .order('assessment_date', { ascending: false })

      if (error) throw error

      // Beräkna statistik
      const casesWithAssessments = cases?.filter(c =>
        (c.pest_level !== null && c.pest_level !== undefined) ||
        (c.problem_rating !== null && c.problem_rating !== undefined)
      ) || []

      // Identifiera kritiska ärenden
      const criticalCasesList = casesWithAssessments.filter(c =>
        (c.pest_level && c.pest_level >= 3) ||
        (c.problem_rating && c.problem_rating >= 4)
      )

      const warningCases = casesWithAssessments.filter(c =>
        !((c.pest_level && c.pest_level >= 3) || (c.problem_rating && c.problem_rating >= 4)) &&
        ((c.pest_level === 2) || (c.problem_rating === 3))
      ).length

      const okCases = casesWithAssessments.filter(c =>
        ((c.pest_level !== null && c.pest_level !== undefined) ||
         (c.problem_rating !== null && c.problem_rating !== undefined)) &&
        !((c.pest_level && c.pest_level >= 3) || (c.problem_rating && c.problem_rating >= 4)) &&
        !(c.pest_level === 2 || c.problem_rating === 3)
      ).length

      // Hämta bekräftelser för kritiska ärenden
      let unacknowledgedCriticalCases: Case[] = []

      if (criticalCasesList.length > 0 && profile?.id) {
        const criticalCaseIds = criticalCasesList.map(c => c.id)

        const { data: acknowledgments } = await supabase
          .from('case_acknowledgments')
          .select('case_id')
          .in('case_id', criticalCaseIds)
          .eq('user_id', profile.id)

        const acknowledgedCaseIds = new Set(acknowledgments?.map(a => a.case_id) || [])
        unacknowledgedCriticalCases = criticalCasesList.filter(c => !acknowledgedCaseIds.has(c.id))
      }

      // Senaste bedömning och trend
      const latestAssessment = casesWithAssessments.length > 0 ? casesWithAssessments[0] : null
      const recentTrend = latestAssessment?.pest_level_trend || null

      // Hämta kommande besök (schemalagda i framtiden)
      const now = new Date().toISOString()
      const upcomingVisits: UpcomingVisit[] = (cases || [])
        .filter(c => c.scheduled_start && new Date(c.scheduled_start) > new Date())
        .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
        .slice(0, 3)
        .map(c => ({
          id: c.id,
          case_number: c.case_number || '',
          title: c.title || 'Servicebesök',
          scheduled_start: c.scheduled_start!,
          pest_type: c.pest_type
        }))

      setSummary({
        latestAssessment,
        totalCases: cases?.length || 0,
        casesWithAssessments: casesWithAssessments.length,
        criticalCases: criticalCasesList.length,
        warningCases,
        okCases,
        recentTrend,
        unacknowledgedCriticalCases,
        upcomingVisits
      })
    } catch (error: any) {
      console.error('Error fetching assessment summary:', error)
      toast.error('Kunde inte hämta bedömningsöversikt')
    } finally {
      setLoading(false)
    }
  }

  // Hjälpfunktion för att avgöra status-nivå
  const getCaseStatusLevel = (caseItem: Case): 'critical' | 'warning' | 'ok' => {
    if ((caseItem.pest_level && caseItem.pest_level >= 3) ||
        (caseItem.problem_rating && caseItem.problem_rating >= 4)) {
      return 'critical'
    }
    if (caseItem.pest_level === 2 || caseItem.problem_rating === 3) {
      return 'warning'
    }
    return 'ok'
  }

  // Status-emoji baserat på nivå
  const getStatusEmoji = (level: 'critical' | 'warning' | 'ok') => {
    switch (level) {
      case 'critical': return '🔴'
      case 'warning': return '🟡'
      case 'ok': return '🟢'
    }
  }

  // Status-text baserat på nivå
  const getStatusText = (level: 'critical' | 'warning' | 'ok') => {
    switch (level) {
      case 'critical': return 'Kritisk'
      case 'warning': return 'Varning'
      case 'ok': return 'OK'
    }
  }

  if (loading) {
    return (
      <Card className={`bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    )
  }

  if (!summary || summary.casesWithAssessments === 0) {
    return (
      <Card className={`bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">🚦</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Er skadedjurssituation</h3>
            <p className="text-sm text-slate-400">Inga bedömningar än</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400">Inga bedömningar att visa</p>
          <p className="text-sm text-slate-500 mt-1">
            Bedömningar visas efter att våra tekniker utfört servicearenden
          </p>
        </div>
      </Card>
    )
  }

  const getTrendIcon = () => {
    switch (summary.recentTrend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-400" />
      case 'worsening':
        return <TrendingDown className="w-4 h-4 text-red-400" />
      case 'stable':
        return <Minus className="w-4 h-4 text-yellow-400" />
      default:
        return null
    }
  }

  const getTrendText = () => {
    switch (summary.recentTrend) {
      case 'improving':
        return 'Förbättring'
      case 'worsening':
        return 'Försämring'
      case 'stable':
        return 'Stabilt'
      default:
        return null
    }
  }

  const handleOpenCase = (caseId: string) => {
    if (onOpenCaseDetails) {
      onOpenCaseDetails(caseId)
    }
  }

  // Kontrollera om senaste ärendet är bekräftat
  const isLatestCaseAcknowledged = summary.latestAssessment
    ? !summary.unacknowledgedCriticalCases.some(c => c.id === summary.latestAssessment?.id)
    : true

  const latestCaseStatus = summary.latestAssessment
    ? getCaseStatusLevel(summary.latestAssessment)
    : 'ok'

  const latestCaseNeedsAcknowledgment = latestCaseStatus === 'critical'

  return (
    <Card className={`bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 ${className}`}>
      <div className="p-6">
        {/* Header med nya rubriker */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">🚦</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Er skadedjurssituation</h3>
              <p className="text-sm text-slate-400">
                Sammanfattning av {summary.casesWithAssessments} bedömda ärenden
              </p>
            </div>
          </div>

          {summary.recentTrend && getTrendText() && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {getTrendIcon()}
              <span>{getTrendText()}</span>
            </div>
          )}
        </div>

        {/* Bekräftelse-banner för obekräftade kritiska ärenden */}
        {summary.unacknowledgedCriticalCases.length > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">
                  {summary.unacknowledgedCriticalCases.length} ärende{summary.unacknowledgedCriticalCases.length > 1 ? 'n' : ''} kräver er bekräftelse
                </span>
              </div>
              {onOpenCaseDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenCase(summary.unacknowledgedCriticalCases[0].id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1"
                >
                  Visa ärende
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Critical Cases */}
          <div className={`text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg ${
            summary.unacknowledgedCriticalCases.length > 0 ? 'ring-1 ring-red-500/50' : ''
          }`}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xl font-bold text-red-400">{summary.criticalCases}</span>
              {summary.unacknowledgedCriticalCases.length > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <p className="text-xs text-red-300">Kritiska</p>
          </div>

          {/* Warning Cases */}
          <div className="text-center p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xl font-bold text-yellow-400">{summary.warningCases}</span>
            </div>
            <p className="text-xs text-yellow-300">Varningar</p>
          </div>

          {/* OK Cases */}
          <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xl font-bold text-green-400">{summary.okCases}</span>
            </div>
            <p className="text-xs text-green-300">OK</p>
          </div>
        </div>

        {/* Kommande besök */}
        {summary.upcomingVisits.length > 0 && (
          <div className="mb-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="w-4 h-4 text-teal-400" />
              <h4 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">
                Kommande besök
              </h4>
            </div>
            <div className="space-y-2">
              {summary.upcomingVisits.map((visit) => (
                <div
                  key={visit.id}
                  className={`flex items-center justify-between p-2 rounded-lg bg-slate-800/30 ${
                    onOpenCaseDetails ? 'cursor-pointer hover:bg-slate-700/50' : ''
                  }`}
                  onClick={() => onOpenCaseDetails && handleOpenCase(visit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-teal-400">
                        {format(new Date(visit.scheduled_start), 'd', { locale: sv })}
                      </span>
                      <span className="text-[10px] text-teal-400/70 uppercase">
                        {format(new Date(visit.scheduled_start), 'MMM', { locale: sv })}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {visit.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(visit.scheduled_start), 'HH:mm', { locale: sv })}
                        {visit.pest_type && ` • ${visit.pest_type}`}
                      </p>
                    </div>
                  </div>
                  {onOpenCaseDetails && (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lugnande meddelande för kritiska/varning-situationer */}
        {(summary.criticalCases > 0 || summary.warningCases > 0) && (
          <div className="mb-4">
            <ReassuranceMessage
              level={summary.criticalCases > 0 ? 'critical' : 'warning'}
              compact={true}
            />
          </div>
        )}

        {/* Senaste bedömda ärende - kompakt kort */}
        {summary.latestAssessment && (
          <div
            className={`p-4 rounded-lg border transition-all ${
              onOpenCaseDetails
                ? 'cursor-pointer hover:bg-slate-700/30 border-slate-700/50 hover:border-slate-600'
                : 'border-slate-700/50'
            }`}
            onClick={() => onOpenCaseDetails && handleOpenCase(summary.latestAssessment!.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Senaste bedömda ärende
              </h4>
              {onOpenCaseDetails && (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">
                  #{summary.latestAssessment.case_number}
                  {summary.latestAssessment.service_type && (
                    <span className="text-slate-400 font-normal ml-2">
                      - {summary.latestAssessment.service_type === 'inspection' ? 'Inspektion' : 'Rutinbesök'}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm">
                    {getStatusEmoji(latestCaseStatus)} {getStatusText(latestCaseStatus)}
                  </span>
                  {latestCaseNeedsAcknowledgment && (
                    <>
                      <span className="text-slate-600">•</span>
                      {isLatestCaseAcknowledged ? (
                        <span className="text-emerald-400 text-sm flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Bekräftad
                        </span>
                      ) : (
                        <span className="text-red-400 text-sm flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ej bekräftad
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {summary.latestAssessment.assessment_date && (
                <span className="text-xs text-slate-500">
                  {new Date(summary.latestAssessment.assessment_date).toLocaleDateString('sv-SE', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </span>
              )}
            </div>

            {/* Visa ärendedetaljer-knapp */}
            {onOpenCaseDetails && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-3 justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenCase(summary.latestAssessment!.id)
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Visa ärendedetaljer
              </Button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500">
            {summary.casesWithAssessments} av {summary.totalCases} ärenden bedömda
          </div>
        </div>
      </div>
    </Card>
  )
}

export default ServiceAssessmentSummary
