// src/components/admin/technicians/IndividualTechnicianAnalysis.tsx - FIXED IMPORTS
import React, { useState, useEffect } from 'react'
import { 
  User, BarChart3, TrendingUp, CheckCircle, AlertCircle, 
  Target, Brain, Sparkles, Clock, ArrowRight, RefreshCw,
  Bot, Lightbulb, Users, Award, Zap
} from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { formatCurrency } from '../../../utils/formatters'

// 🔧 CRITICAL FIX: Use correct hooks and types
import { useCompleteTechnicianDashboard } from '../../../hooks/useTechnicianDashboard'
import type { TechnicianPerformance } from '../../../services/technicianAnalyticsService'

// AI Analysis Types
interface AIStrength {
  area: string
  description: string
  evidence: string
}

interface AIDevelopmentArea {
  area: string
  description: string
  impact: string
}

interface AINextStep {
  action: string
  timeline: string
  priority: 'high' | 'medium' | 'low'
  expected_outcome: string
}

interface AIMentorshipRecommendations {
  should_mentor: boolean
  mentoring_areas: string[]
  needs_mentoring: boolean
  learning_focus: string[]
}

interface AIPerformancePredictions {
  next_quarter_outlook: string
  growth_potential: string
  key_risk_factors: string[]
}

interface AIAnalysis {
  summary: string
  strengths: AIStrength[]
  development_areas: AIDevelopmentArea[]
  next_steps: AINextStep[]
  mentorship_recommendations: AIMentorshipRecommendations
  performance_predictions: AIPerformancePredictions
  metadata?: {
    generated_at: string
    technician_name: string
    analysis_version: string
    data_points_analyzed: number
  }
}

interface IndividualTechnicianAnalysisProps {
  selectedTechnicianName: string
  setSelectedTechnicianName: (name: string) => void
}

const IndividualTechnicianAnalysis: React.FC<IndividualTechnicianAnalysisProps> = ({
  selectedTechnicianName,
  setSelectedTechnicianName
}) => {
  // 🔧 FIXED: Use the correct analytics hooks
  const { performance: allTechnicians, monthlyData, pestSpecialization, loading } = useCompleteTechnicianDashboard()
  
  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAiAnalysis, setShowAiAnalysis] = useState(false)

  // Find current technician - with safe type checking
  const technician = Array.isArray(allTechnicians) 
    ? allTechnicians.find((t: TechnicianPerformance) => t.name === selectedTechnicianName)
    : undefined

  const technicianMonthlyData = Array.isArray(monthlyData)
    ? monthlyData.filter(m => m.technician_name === selectedTechnicianName)
    : []

  const technicianPestData = Array.isArray(pestSpecialization)
    ? pestSpecialization.filter(p => p.technician_name === selectedTechnicianName)
    : []

  // Trigger AI analysis when technician is selected
  useEffect(() => {
    if (technician && selectedTechnicianName) {
      setShowAiAnalysis(false)
      setAiAnalysis(null)
      setAiError(null)
    }
  }, [selectedTechnicianName, technician])

  // Generate AI Analysis
  const generateAIAnalysis = async () => {
    if (!technician || !Array.isArray(allTechnicians)) return

    setAiLoading(true)
    setAiError(null)

    try {
      const response = await fetch('/api/ai-technician-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          technician,
          allTechnicians,
          monthlyData: technicianMonthlyData,
          pestSpecialization: technicianPestData,
          teamStats: {
            avg_revenue: allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length,
            avg_cases: allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length,
            total_technicians: allTechnicians.length
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis)
        setShowAiAnalysis(true)
      } else {
        throw new Error(data.error || 'AI-analys misslyckades')
      }

    } catch (error: any) {
      console.error('AI Analysis Error:', error)
      setAiError(error.message)
    } finally {
      setAiLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      </Card>
    )
  }

  // Ingen tekniker vald - Show selection screen
  if (!selectedTechnicianName) {
    // Safe guard for empty arrays
    const safeAllTechnicians = Array.isArray(allTechnicians) ? allTechnicians : []

    return (
      <div className="space-y-6">
        {/* Tekniker-väljare med enhanced UX */}
        <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                AI-Driven Tekniker Analys
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </h2>
              <p className="text-sm text-slate-400">
                Välj en tekniker för djupgående AI-analys med personliga utvecklingsrekommendationer
              </p>
            </div>
          </div>

          {/* Enhanced tekniker-knappar med hover effects */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safeAllTechnicians.map((tech: TechnicianPerformance) => (
              <div
                key={tech.name}
                className="group relative overflow-hidden bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-orange-500/50 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10"
              >
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTechnicianName(tech.name)}
                  className="w-full h-full p-4 justify-start text-left hover:bg-transparent"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-white group-hover:text-orange-300 transition-colors">
                        {tech.name}
                      </div>
                      <div className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
                        #{tech.rank}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{tech.role}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-400">{formatCurrency(tech.total_revenue)}</span>
                      <span className="text-blue-400">{tech.total_cases} ärenden</span>
                    </div>
                    
                    {/* Performance indicator */}
                    <div className="flex items-center gap-1">
                      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            tech.rank <= 2 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                            tech.rank <= 4 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                            'bg-gradient-to-r from-slate-500 to-slate-400'
                          }`}
                          style={{ 
                            width: `${Math.max(20, 100 - (tech.rank - 1) * 15)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Button>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Quick team stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-orange-400 font-bold text-sm">{safeAllTechnicians.length}</p>
              <p className="text-orange-300 text-xs">Aktiva tekniker</p>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 font-bold text-sm">
                {formatCurrency(safeAllTechnicians.reduce((sum, t) => sum + t.total_revenue, 0))}
              </p>
              <p className="text-green-300 text-xs">Total intäkt</p>
            </div>
            <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 font-bold text-sm">
                {safeAllTechnicians.reduce((sum, t) => sum + t.total_cases, 0)}
              </p>
              <p className="text-blue-300 text-xs">Totala ärenden</p>
            </div>
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-400 font-bold text-sm">
                {safeAllTechnicians.length > 0 
                  ? formatCurrency(safeAllTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / safeAllTechnicians.length)
                  : formatCurrency(0)
                }
              </p>
              <p className="text-purple-300 text-xs">Genomsnitt/tekniker</p>
            </div>
          </div>
        </Card>

        {/* Preview of AI capabilities */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            Vad ingår i AI-analysen?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-blue-300 font-medium text-sm">Prestanda-analys</span>
              </div>
              <p className="text-slate-400 text-xs">
                Jämförelse med team, trender och förbättringsområden
              </p>
            </div>
            
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-medium text-sm">Mentorskap</span>
              </div>
              <p className="text-slate-400 text-xs">
                Rekommendationer för coaching och kompetensutveckling
              </p>
            </div>
            
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-medium text-sm">Konkreta mål</span>
              </div>
              <p className="text-slate-400 text-xs">
                30-dagars plan och långsiktiga utvecklingsstrategier
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Tekniker är vald men ingen AI-analys än
  if (!technician) {
    return (
      <Card className="p-6">
        <p className="text-red-400">Tekniker hittades inte: {selectedTechnicianName}</p>
        <Button onClick={() => setSelectedTechnicianName('')} className="mt-4">
          Tillbaka till översikt
        </Button>
      </Card>
    )
  }

  // Calculate some basic stats with safe guards
  const safeAllTechnicians = Array.isArray(allTechnicians) ? allTechnicians : []
  const teamAvgRevenue = safeAllTechnicians.length > 0 
    ? safeAllTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / safeAllTechnicians.length 
    : 0
  const teamAvgCases = safeAllTechnicians.length > 0
    ? safeAllTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / safeAllTechnicians.length
    : 0
  const teamAvgCaseValue = safeAllTechnicians.length > 0
    ? safeAllTechnicians.reduce((sum, t) => sum + t.avg_case_value, 0) / safeAllTechnicians.length
    : 0

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500/30 bg-red-500/10 text-red-300'
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
      case 'low': return 'border-green-500/30 bg-green-500/10 text-green-300'
      default: return 'border-slate-500/30 bg-slate-500/10 text-slate-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header med tekniker-info och AI-knapp */}
      <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{technician.name}</h2>
              <p className="text-slate-400">{technician.role} • {technician.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-orange-400">
                  Ranking #{technician.rank} av {safeAllTechnicians.length}
                </span>
                <span className="text-sm text-green-400">
                  {formatCurrency(technician.total_revenue)} total
                </span>
                <span className="text-sm text-blue-400">
                  {technician.total_cases} ärenden
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedTechnicianName('')}
            >
              Tillbaka
            </Button>
            
            {!showAiAnalysis && (
              <Button
                onClick={generateAIAnalysis}
                disabled={aiLoading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    AI Analyserar...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Starta AI-Analys
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Performance overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Intäkt vs Team</div>
            <div className="text-lg font-semibold text-white">
              {teamAvgRevenue > 0 
                ? ((technician.total_revenue / teamAvgRevenue) * 100).toFixed(0)
                : '0'
              }%
            </div>
            <div className="text-xs text-orange-400">
              {technician.total_revenue > teamAvgRevenue ? 'Över genomsnitt' : 'Under genomsnitt'}
            </div>
          </div>
          
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Ärendepris</div>
            <div className="text-lg font-semibold text-white">
              {formatCurrency(technician.avg_case_value || 0)}
            </div>
            <div className="text-xs text-green-400">
              {(technician.avg_case_value || 0) > teamAvgCaseValue ? 'Premium' : 'Standard'}
            </div>
          </div>
          
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Specialisering</div>
            <div className="text-lg font-semibold text-white">
              {technicianPestData.length > 0 ? technicianPestData[0]?.pest_type : 'Generalist'}
            </div>
            <div className="text-xs text-purple-400">
              {technicianPestData.length > 0 
                ? `${technicianPestData[0]?.case_count} ärenden` 
                : 'Alla typer'
              }
            </div>
          </div>
          
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Team Position</div>
            <div className="text-lg font-semibold text-white">
              Top {safeAllTechnicians.length > 0 
                ? Math.ceil((technician.rank / safeAllTechnicians.length) * 100)
                : 0
              }%
            </div>
            <div className="text-xs text-blue-400">
              {technician.rank <= 3 ? 'Elite' : technician.rank <= 6 ? 'Strong' : 'Developing'}
            </div>
          </div>
        </div>
      </Card>

      {/* AI Error */}
      {aiError && (
        <Card className="p-4 bg-red-500/10 border-red-500/20">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>AI-analys misslyckades: {aiError}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateAIAnalysis}
              className="ml-auto text-red-300 hover:text-red-200"
            >
              Försök igen
            </Button>
          </div>
        </Card>
      )}

      {/* Call-to-action when no AI analysis yet */}
      {!showAiAnalysis && !aiLoading && !aiError && (
        <Card className="p-8 text-center bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-purple-500/20">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Redo för djupanalys?
          </h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Låt vår AI analysera {technician.name}s prestanda och skapa personliga utvecklingsrekommendationer baserat på all tillgänglig data.
          </p>
          <Button
            onClick={generateAIAnalysis}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Generera AI-Analys
          </Button>
        </Card>
      )}

      {/* Rest of AI Analysis Results would go here */}
      {showAiAnalysis && aiAnalysis && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            AI-Analys Resultat för {technician.name}
          </h3>
          <p className="text-slate-300">{aiAnalysis.summary}</p>
          {/* Add the rest of the AI analysis UI components here */}
        </Card>
      )}
    </div>
  )
}

export default IndividualTechnicianAnalysis