// src/components/customer/ServiceAssessmentSummary.tsx - Service Assessment Summary Card
import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Case } from '../../types/cases'
import ProfessionalAssessment from './ProfessionalAssessment'
import LoadingSpinner from '../shared/LoadingSpinner'
import toast from 'react-hot-toast'

interface ServiceAssessmentSummaryProps {
  customerId: string
  className?: string
}

interface AssessmentSummary {
  latestAssessment: Case | null
  totalCases: number
  casesWithAssessments: number
  criticalCases: number
  warningCases: number
  okCases: number
  recentTrend: 'improving' | 'stable' | 'worsening' | null
}

const ServiceAssessmentSummary: React.FC<ServiceAssessmentSummaryProps> = ({ 
  customerId, 
  className = '' 
}) => {
  const { profile } = useAuth()
  const [summary, setSummary] = useState<AssessmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (profile?.customer_id) {
      fetchAssessmentSummary()
    }
  }, [profile?.customer_id])

  const fetchAssessmentSummary = async () => {
    if (!profile?.customer_id) return

    try {
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .order('assessment_date', { ascending: false })

      if (error) throw error

      // Calculate summary statistics
      const casesWithAssessments = cases?.filter(c => 
        (c.pest_level !== null && c.pest_level !== undefined) || 
        (c.problem_rating !== null && c.problem_rating !== undefined)
      ) || []

      const criticalCases = casesWithAssessments.filter(c => 
        (c.pest_level && c.pest_level >= 3) || 
        (c.problem_rating && c.problem_rating >= 4)
      ).length

      const warningCases = casesWithAssessments.filter(c => 
        (c.pest_level === 2) || (c.problem_rating === 3)
      ).length

      const okCases = casesWithAssessments.filter(c => 
        ((c.pest_level !== null && c.pest_level !== undefined) || 
         (c.problem_rating !== null && c.problem_rating !== undefined)) &&
        !((c.pest_level && c.pest_level >= 3) || (c.problem_rating && c.problem_rating >= 4)) &&
        !(c.pest_level === 2 || c.problem_rating === 3)
      ).length

      // Get latest assessment and trend
      const latestAssessment = casesWithAssessments.length > 0 ? casesWithAssessments[0] : null
      const recentTrend = latestAssessment?.pest_level_trend || null

      setSummary({
        latestAssessment,
        totalCases: cases?.length || 0,
        casesWithAssessments: casesWithAssessments.length,
        criticalCases,
        warningCases,
        okCases,
        recentTrend
      })
    } catch (error: any) {
      console.error('Error fetching assessment summary:', error)
      toast.error('Kunde inte hämta bedömningsöversikt')
    } finally {
      setLoading(false)
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
            <h3 className="text-lg font-semibold text-white">Servicebedömningar</h3>
            <p className="text-sm text-slate-400">Professionella utvärderingar av er situation</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-400">Inga bedömningar än</p>
          <p className="text-sm text-slate-500 mt-1">
            Bedömningar kommer att visas efter att våra tekniker har utfört servicearenden
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
        return 'Okänd trend'
    }
  }

  return (
    <Card className={`bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg">🚦</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Servicebedömningar</h3>
              <p className="text-sm text-slate-400">Professionella utvärderingar av er situation</p>
            </div>
          </div>
          
          {summary.recentTrend && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {getTrendIcon()}
              <span>{getTrendText()}</span>
            </div>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Critical Cases */}
          <div className="text-center p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xl font-bold text-red-400">{summary.criticalCases}</span>
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

        {/* Latest Assessment Preview */}
        {summary.latestAssessment && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Senaste bedömning</h4>
              <span className="text-xs text-slate-500">
                Ärende #{summary.latestAssessment.case_number}
              </span>
            </div>
            
            {showDetails ? (
              <ProfessionalAssessment 
                assessment={{
                  pest_level: summary.latestAssessment.pest_level,
                  problem_rating: summary.latestAssessment.problem_rating,
                  recommendations: summary.latestAssessment.recommendations,
                  assessment_date: summary.latestAssessment.assessment_date,
                  assessed_by: summary.latestAssessment.assessed_by
                }}
              />
            ) : (
              <ProfessionalAssessment 
                assessment={{
                  pest_level: summary.latestAssessment.pest_level,
                  problem_rating: summary.latestAssessment.problem_rating,
                  recommendations: summary.latestAssessment.recommendations,
                  assessment_date: summary.latestAssessment.assessment_date,
                  assessed_by: summary.latestAssessment.assessed_by
                }}
                compact
              />
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500">
            {summary.casesWithAssessments} av {summary.totalCases} ärenden bedömda
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2"
          >
            <span>{showDetails ? 'Dölj detaljer' : 'Visa detaljer'}</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ServiceAssessmentSummary