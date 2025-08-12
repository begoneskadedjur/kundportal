// src/components/multisite/TrafficLightSystem.tsx - Professional Traffic Light Assessment System
import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, Minus, Info, Building2 } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'

interface TrafficLightAssessment {
  site_id: string
  site_name: string
  region: string
  overall_status: 'green' | 'yellow' | 'red'
  pest_control_score: number
  compliance_score: number
  service_quality_score: number
  customer_satisfaction_score: number
  last_assessment: string
  next_assessment: string
  critical_issues: number
  recommendations: string[]
}

const TrafficLightSystem: React.FC = () => {
  const { accessibleSites, userRole } = useMultisite()
  const [assessments, setAssessments] = useState<TrafficLightAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<string | null>(null)

  useEffect(() => {
    fetchTrafficLightAssessments()
  }, [accessibleSites])

  const fetchTrafficLightAssessments = async () => {
    if (accessibleSites.length === 0) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const siteIds = accessibleSites.map(site => site.id)

      // Get traffic light assessments for accessible sites
      const { data: assessmentData, error } = await supabase
        .from('multisite_traffic_light_assessments')
        .select('*')
        .in('site_id', siteIds)
        .order('last_assessment', { ascending: false })

      if (error) throw error

      // Map the data with site information
      const mappedAssessments: TrafficLightAssessment[] = (assessmentData || []).map(assessment => {
        const site = accessibleSites.find(s => s.id === assessment.site_id)
        return {
          ...assessment,
          site_name: site?.site_name || 'Okänd enhet',
          region: site?.region || 'Okänd region'
        }
      })

      setAssessments(mappedAssessments)
    } catch (error) {
      console.error('Error fetching traffic light assessments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'yellow':
        return <Clock className="w-6 h-6 text-yellow-500" />
      case 'red':
        return <AlertTriangle className="w-6 h-6 text-red-500" />
    }
  }

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return 'bg-green-500'
      case 'yellow':
        return 'bg-yellow-500'
      case 'red':
        return 'bg-red-500'
    }
  }

  const getStatusText = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return 'Utmärkt'
      case 'yellow':
        return 'Uppmärksamhet krävs'
      case 'red':
        return 'Akut åtgärd krävs'
    }
  }

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="w-4 h-4 text-green-400" />
    if (score >= 60) return <Minus className="w-4 h-4 text-yellow-400" />
    return <TrendingDown className="w-4 h-4 text-red-400" />
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    )
  }

  const selectedAssessment = selectedSite 
    ? assessments.find(a => a.site_id === selectedSite)
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-green-500/20 via-yellow-500/20 to-red-500/20 rounded-2xl p-6 border border-slate-700/50 backdrop-blur">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-xl flex items-center justify-center">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <div className="w-2 h-6 bg-gradient-to-b from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Trafikljusbedömning</h1>
              <p className="text-slate-300">Professionell bedömning av kvalitet och efterlevnad</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-slate-400">Grönt ljus</p>
                <p className="font-semibold text-white">
                  {assessments.filter(a => a.overall_status === 'green').length} enheter
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-slate-400">Gult ljus</p>
                <p className="font-semibold text-white">
                  {assessments.filter(a => a.overall_status === 'yellow').length} enheter
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-slate-400">Rött ljus</p>
                <p className="font-semibold text-white">
                  {assessments.filter(a => a.overall_status === 'red').length} enheter
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sites List */}
        <div className="lg:col-span-2">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Enhetsöversikt
            </h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {assessments.map(assessment => (
                <div 
                  key={assessment.site_id}
                  onClick={() => setSelectedSite(assessment.site_id)}
                  className={`
                    p-4 rounded-lg border transition-all cursor-pointer
                    ${selectedSite === assessment.site_id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white">{assessment.site_name}</h4>
                      <p className="text-sm text-slate-400">{assessment.region}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(assessment.overall_status)}
                      <div className={`w-3 h-3 ${getStatusColor(assessment.overall_status)} rounded-full`}></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-slate-400">Skadedjur</p>
                      <p className={`font-semibold ${getScoreColor(assessment.pest_control_score)}`}>
                        {assessment.pest_control_score}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400">Efterlevnad</p>
                      <p className={`font-semibold ${getScoreColor(assessment.compliance_score)}`}>
                        {assessment.compliance_score}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400">Service</p>
                      <p className={`font-semibold ${getScoreColor(assessment.service_quality_score)}`}>
                        {assessment.service_quality_score}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-400">Nöjdhet</p>
                      <p className={`font-semibold ${getScoreColor(assessment.customer_satisfaction_score)}`}>
                        {assessment.customer_satisfaction_score}%
                      </p>
                    </div>
                  </div>
                  
                  {assessment.critical_issues > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">{assessment.critical_issues} kritiska problem</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {assessments.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Inga bedömningar tillgängliga</p>
                <p className="text-sm">Trafikljusbedömningar kommer att visas här när de är tillgängliga</p>
              </div>
            )}
          </Card>
        </div>

        {/* Selected Site Details */}
        <div>
          {selectedAssessment ? (
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  {getStatusIcon(selectedAssessment.overall_status)}
                  <h3 className="font-semibold text-white">{selectedAssessment.site_name}</h3>
                </div>
                <p className="text-sm text-slate-400 mb-1">{selectedAssessment.region}</p>
                <p className={`text-sm font-medium ${
                  selectedAssessment.overall_status === 'green' ? 'text-green-400' :
                  selectedAssessment.overall_status === 'yellow' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {getStatusText(selectedAssessment.overall_status)}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-white mb-3">Detaljerad bedömning</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(selectedAssessment.pest_control_score)}
                        <span className="text-sm text-slate-300">Skadedjursbekämpning</span>
                      </div>
                      <span className={`font-semibold ${getScoreColor(selectedAssessment.pest_control_score)}`}>
                        {selectedAssessment.pest_control_score}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(selectedAssessment.compliance_score)}
                        <span className="text-sm text-slate-300">Regelefterlevnad</span>
                      </div>
                      <span className={`font-semibold ${getScoreColor(selectedAssessment.compliance_score)}`}>
                        {selectedAssessment.compliance_score}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(selectedAssessment.service_quality_score)}
                        <span className="text-sm text-slate-300">Servicekvalitet</span>
                      </div>
                      <span className={`font-semibold ${getScoreColor(selectedAssessment.service_quality_score)}`}>
                        {selectedAssessment.service_quality_score}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getScoreIcon(selectedAssessment.customer_satisfaction_score)}
                        <span className="text-sm text-slate-300">Kundnöjdhet</span>
                      </div>
                      <span className={`font-semibold ${getScoreColor(selectedAssessment.customer_satisfaction_score)}`}>
                        {selectedAssessment.customer_satisfaction_score}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-600">
                  <h4 className="font-medium text-white mb-2">Tidsplan</h4>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p>Senaste bedömning: {new Date(selectedAssessment.last_assessment).toLocaleDateString('sv-SE')}</p>
                    <p>Nästa bedömning: {new Date(selectedAssessment.next_assessment).toLocaleDateString('sv-SE')}</p>
                  </div>
                </div>

                {selectedAssessment.recommendations.length > 0 && (
                  <div className="pt-4 border-t border-slate-600">
                    <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Rekommendationer
                    </h4>
                    <div className="space-y-2">
                      {selectedAssessment.recommendations.map((recommendation, index) => (
                        <p key={index} className="text-sm text-slate-300 bg-slate-700/30 p-2 rounded">
                          {recommendation}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <div className="text-center py-8 text-slate-400">
                <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Välj en enhet för att se detaljerad bedömning</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default TrafficLightSystem