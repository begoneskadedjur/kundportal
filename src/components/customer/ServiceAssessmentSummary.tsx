import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock, ChevronRight, Eye, AlertCircle, CalendarCheck } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case } from '../../types/cases'
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
  service_type?: string
}

interface AssessmentSummary {
  latestAssessment: Case | null
  totalCases: number
  casesWithAssessments: number
  criticalCases: number
  warningCases: number
  okCases: number
  unacknowledgedCriticalCases: Case[]
  upcomingVisits: UpcomingVisit[]
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  routine: 'Rutinbesök',
  acute: 'Akut',
  other: 'Övrigt',
  inspection: 'Avtalat servicebesök',
  establishment: 'Etablering',
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
    if (customerId) {
      fetchAssessmentSummary()
    }
  }, [customerId])

  const fetchAssessmentSummary = async () => {
    if (!customerId) return

    try {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', customerId)
        .order('assessment_date', { ascending: false })

      if (error) throw error

      // Bara servicebesök (routine/acute/other) bedömer skadedjurssituation
      const assessableCases = (cases || []).filter(c =>
        c.service_type !== 'inspection' && c.service_type !== 'establishment'
      )

      const casesWithAssessments = assessableCases.filter(c =>
        (c.pest_level !== null && c.pest_level !== undefined) ||
        (c.problem_rating !== null && c.problem_rating !== undefined)
      )

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

      let unacknowledgedCriticalCases: Case[] = []
      if (criticalCasesList.length > 0 && profile?.id) {
        const { data: acknowledgments } = await supabase
          .from('case_acknowledgments')
          .select('case_id')
          .in('case_id', criticalCasesList.map(c => c.id))
          .eq('user_id', profile.id)

        const acknowledgedIds = new Set(acknowledgments?.map(a => a.case_id) || [])
        unacknowledgedCriticalCases = criticalCasesList.filter(c => !acknowledgedIds.has(c.id))
      }

      const latestAssessment = casesWithAssessments.length > 0 ? casesWithAssessments[0] : null

      const upcomingVisits: UpcomingVisit[] = (cases || [])
        .filter(c => c.scheduled_start && new Date(c.scheduled_start) > new Date())
        .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())
        .slice(0, 3)
        .map(c => ({
          id: c.id,
          case_number: c.case_number || '',
          title: c.title || 'Servicebesök',
          scheduled_start: c.scheduled_start!,
          pest_type: c.pest_type,
          service_type: c.service_type,
        }))

      setSummary({
        latestAssessment,
        totalCases: cases?.length || 0,
        casesWithAssessments: casesWithAssessments.length,
        criticalCases: criticalCasesList.length,
        warningCases,
        okCases,
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

  const getCaseStatusLevel = (caseItem: Case): 'critical' | 'warning' | 'ok' => {
    if ((caseItem.pest_level && caseItem.pest_level >= 3) ||
        (caseItem.problem_rating && caseItem.problem_rating >= 4)) return 'critical'
    if (caseItem.pest_level === 2 || caseItem.problem_rating === 3) return 'warning'
    return 'ok'
  }

  const getStatusEmoji = (level: 'critical' | 'warning' | 'ok') => {
    switch (level) {
      case 'critical': return '🔴'
      case 'warning': return '🟡'
      case 'ok': return '🟢'
    }
  }

  const getStatusText = (level: 'critical' | 'warning' | 'ok') => {
    switch (level) {
      case 'critical': return 'Kritisk'
      case 'warning': return 'Varning'
      case 'ok': return 'OK'
    }
  }

  const handleOpenCase = (caseId: string) => {
    if (onOpenCaseDetails) onOpenCaseDetails(caseId)
  }

  if (loading) {
    return (
      <div className={`bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden ${className}`}>
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (!summary) return null

  const latestCaseStatus = summary.latestAssessment ? getCaseStatusLevel(summary.latestAssessment) : 'ok'
  const latestCaseNeedsAcknowledgment = latestCaseStatus === 'critical'
  const isLatestCaseAcknowledged = summary.latestAssessment
    ? !summary.unacknowledgedCriticalCases.some(c => c.id === summary.latestAssessment?.id)
    : true

  const hasAssessments = summary.casesWithAssessments > 0
  const hasUpcomingVisits = summary.upcomingVisits.length > 0

  return (
    <div className={`bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden ${className}`}>

      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700/40">
        <h3 className="text-sm font-semibold text-white">Er skadedjurssituation</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {summary.totalCases > 0
            ? `Sammanfattning av ${summary.totalCases} ärenden`
            : 'Inga ärenden än'}
        </p>
      </div>

      {/* Trafik-ljusbadges — bara om bedömningar finns */}
      {hasAssessments && (
        <div className="grid grid-cols-3 divide-x divide-slate-700/40 border-b border-slate-700/40">
          <div className={`px-4 py-3 text-center ${summary.unacknowledgedCriticalCases.length > 0 ? 'bg-red-500/5' : ''}`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <span className="text-lg font-bold text-red-400">{summary.criticalCases}</span>
              {summary.unacknowledgedCriticalCases.length > 0 && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Kritiska</p>
          </div>
          <div className="px-4 py-3 text-center">
            <span className="text-lg font-bold text-amber-400 block mb-0.5">{summary.warningCases}</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Varningar</p>
          </div>
          <div className="px-4 py-3 text-center">
            <span className="text-lg font-bold text-emerald-400 block mb-0.5">{summary.okCases}</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">OK</p>
          </div>
        </div>
      )}

      {/* Bekräftelse-banner */}
      {summary.unacknowledgedCriticalCases.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400 font-medium">
                {summary.unacknowledgedCriticalCases.length} ärende{summary.unacknowledgedCriticalCases.length > 1 ? 'n' : ''} kräver er bekräftelse
              </span>
            </div>
            {onOpenCaseDetails && (
              <button
                onClick={() => handleOpenCase(summary.unacknowledgedCriticalCases[0].id)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 shrink-0"
              >
                Visa ärende
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Kommande besök */}
      {hasUpcomingVisits && (
        <div className={`${summary.unacknowledgedCriticalCases.length > 0 ? 'mt-4' : 'mt-0'}`}>
          <div className={`px-4 py-2.5 flex items-center gap-2 ${hasAssessments || summary.unacknowledgedCriticalCases.length > 0 ? 'border-t border-slate-700/40' : ''}`}>
            <CalendarCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Kommande besök</span>
          </div>
          <div className="px-4 pb-3 space-y-1.5">
            {summary.upcomingVisits.map((visit) => {
              const visitDate = new Date(visit.scheduled_start)
              const serviceLabel = visit.service_type ? SERVICE_TYPE_LABEL[visit.service_type] : null
              return (
                <div
                  key={visit.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40 ${
                    onOpenCaseDetails ? 'cursor-pointer hover:bg-slate-700/50 hover:border-slate-600/60 transition-colors' : ''
                  }`}
                  onClick={() => onOpenCaseDetails && handleOpenCase(visit.id)}
                >
                  <div className="w-9 h-9 bg-slate-700/60 rounded-lg flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white leading-none">
                      {format(visitDate, 'd', { locale: sv })}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase leading-none mt-0.5">
                      {format(visitDate, 'MMM', { locale: sv })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {visit.case_number && <span className="text-slate-400 mr-1.5">{visit.case_number}</span>}
                      {serviceLabel || visit.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(visitDate, 'HH:mm', { locale: sv })}
                      {visit.pest_type && ` · ${visit.pest_type}`}
                    </p>
                  </div>
                  {onOpenCaseDetails && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Senaste bedömda ärende */}
      {hasAssessments && summary.latestAssessment && (
        <div className="border-t border-slate-700/40">
          <div className="px-4 py-2.5 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Senaste bedömning</span>
          </div>
          <div
            className={`mx-4 mb-4 p-3 rounded-xl border border-slate-700/40 bg-slate-800/50 ${
              onOpenCaseDetails ? 'cursor-pointer hover:bg-slate-700/50 hover:border-slate-600/60 transition-colors' : ''
            }`}
            onClick={() => onOpenCaseDetails && handleOpenCase(summary.latestAssessment!.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">
                  #{summary.latestAssessment.case_number}
                  {summary.latestAssessment.service_type && (
                    <span className="text-slate-400 font-normal ml-2 text-xs">
                      {SERVICE_TYPE_LABEL[summary.latestAssessment.service_type] || summary.latestAssessment.service_type}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs">
                    {getStatusEmoji(latestCaseStatus)} {getStatusText(latestCaseStatus)}
                  </span>
                  {latestCaseNeedsAcknowledgment && (
                    <>
                      <span className="text-slate-600">·</span>
                      {isLatestCaseAcknowledged ? (
                        <span className="text-emerald-400 text-xs flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Bekräftad
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ej bekräftad
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {summary.latestAssessment.assessment_date && (
                <span className="text-xs text-slate-500 shrink-0">
                  {new Date(summary.latestAssessment.assessment_date).toLocaleDateString('sv-SE', {
                    day: 'numeric', month: 'short'
                  })}
                </span>
              )}
            </div>
            {onOpenCaseDetails && (
              <button
                className="w-full mt-2.5 pt-2.5 border-t border-slate-700/40 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleOpenCase(summary.latestAssessment!.id) }}
              >
                <Eye className="w-3.5 h-3.5" />
                Visa ärendedetaljer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Om inga bedömningar men ärenden finns */}
      {!hasAssessments && summary.totalCases > 0 && (
        <div className="px-4 py-4 border-t border-slate-700/40">
          <p className="text-xs text-slate-500 text-center">
            Bedömningar görs vid servicebesök när situationen kräver det.
          </p>
        </div>
      )}

      {/* Om inga ärenden alls */}
      {summary.totalCases === 0 && !hasUpcomingVisits && (
        <div className="px-4 py-8 text-center">
          <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Inga ärenden registrerade ännu</p>
        </div>
      )}

    </div>
  )
}

export default ServiceAssessmentSummary
