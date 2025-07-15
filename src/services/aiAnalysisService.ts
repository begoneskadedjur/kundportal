// src/services/aiAnalysisService.ts - Frontend service för AI-analys
import { toast } from 'react-hot-toast'

export interface AIAnalysisRequest {
  technician: any
  allTechnicians: any[]
  monthlyData?: any[]
  pestSpecialization?: any[]
  teamStats?: {
    avg_revenue: number
    avg_cases: number
    total_technicians: number
  }
}

export interface AIAnalysisResponse {
  success: boolean
  analysis: AIAnalysis
  ai_model: string
  timestamp: string
  error?: string
}

export interface AIAnalysis {
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

export interface AIStrength {
  area: string
  description: string
  evidence: string
}

export interface AIDevelopmentArea {
  area: string
  description: string
  impact: string
}

export interface AINextStep {
  action: string
  timeline: string
  priority: 'high' | 'medium' | 'low'
  expected_outcome: string
}

export interface AIMentorshipRecommendations {
  should_mentor: boolean
  mentoring_areas: string[]
  needs_mentoring: boolean
  learning_focus: string[]
}

export interface AIPerformancePredictions {
  next_quarter_outlook: string
  growth_potential: string
  key_risk_factors: string[]
}

class AIAnalysisService {
  private readonly baseUrl = '/api'

  async generateTechnicianAnalysis(request: AIAnalysisRequest): Promise<AIAnalysis> {
    try {
      // Visa loading toast
      const loadingToast = toast.loading('AI analyserar tekniker-data...', {
        duration: 0, // Infinite duration
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #334155'
        }
      })

      const response = await fetch(`${this.baseUrl}/ai-technician-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      // Dismiss loading toast
      toast.dismiss(loadingToast)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data: AIAnalysisResponse = await response.json()

      if (!data.success || !data.analysis) {
        throw new Error(data.error || 'AI-analys returnerade inga resultat')
      }

      // Success toast
      toast.success(`AI-analys klar för ${request.technician.name}!`, {
        duration: 4000,
        style: {
          background: '#059669',
          color: '#ffffff'
        }
      })

      return data.analysis

    } catch (error: any) {
      console.error('AI Analysis Service Error:', error)
      
      // Error toast
      toast.error(`AI-analys misslyckades: ${error.message}`, {
        duration: 6000,
        style: {
          background: '#dc2626',
          color: '#ffffff'
        }
      })
      
      throw error
    }
  }

  async validateAIConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-technician-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validate: true
        })
      })

      return response.status !== 500
    } catch {
      return false
    }
  }

  // Helper för att skapa mock-analys vid fallback
  createFallbackAnalysis(technician: any, allTechnicians: any[]): AIAnalysis {
    const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length
    const isTopPerformer = technician.rank <= 3
    const isAboveAverage = technician.total_revenue > teamAvgRevenue

    return {
      summary: `${technician.name} presterar ${isAboveAverage ? 'över' : 'under'} teamgenomsnittet med en ranking på #${technician.rank} av ${allTechnicians.length} tekniker. ${isTopPerformer ? 'Som topprestare har hen stor potential för mentorskap.' : 'Det finns goda möjligheter för utveckling och förbättring.'}`,
      
      strengths: [
        {
          area: isTopPerformer ? "Toppranking" : "Stabil prestanda",
          description: `${isTopPerformer ? `Ranking #${technician.rank} indikerar stark prestanda` : `Konsistent arbete med ${technician.total_cases} genomförda ärenden`}`,
          evidence: `${technician.total_revenue.toLocaleString()} kr total intäkt`
        },
        ...(technician.avg_case_value > teamAvgRevenue/allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) * allTechnicians.length ? [{
          area: "Högt ärendepris",
          description: "Över genomsnittligt pris per ärende",
          evidence: `${technician.avg_case_value.toLocaleString()} kr/ärende`
        }] : [])
      ],

      development_areas: isTopPerformer ? [] : [
        {
          area: "Prestandaoptimering",
          description: "Möjlighet att närma sig topprestatorernas nivå",
          impact: "Kan öka både intäkt och kundnöjdhet"
        }
      ],

      next_steps: [
        {
          action: isTopPerformer ? "Mentorskap: Dela expertis med andra tekniker" : "Förbättra ärendehantering och prissättning",
          timeline: "30 dagar",
          priority: isTopPerformer ? "medium" : "high",
          expected_outcome: isTopPerformer ? "Höjd teamprestanda" : "Förbättrad individuell prestanda"
        },
        {
          action: "Månadsvis prestanda-genomgång med chef",
          timeline: "Återkommande",
          priority: "medium",
          expected_outcome: "Kontinuerlig utveckling och måluppföljning"
        }
      ],

      mentorship_recommendations: {
        should_mentor: isTopPerformer,
        mentoring_areas: isTopPerformer ? ["Ärendehantering", "Kundkommunikation"] : [],
        needs_mentoring: !isTopPerformer,
        learning_focus: !isTopPerformer ? ["Effektivitet", "Prissättningsstrategier"] : []
      },

      performance_predictions: {
        next_quarter_outlook: isAboveAverage ? "Positiv" : "Förbättringspotential",
        growth_potential: isTopPerformer ? "Stabil" : "Hög",
        key_risk_factors: isTopPerformer ? [] : ["Behöver fokus på prestanda"]
      },

      metadata: {
        generated_at: new Date().toISOString(),
        technician_name: technician.name,
        analysis_version: "fallback-1.0",
        data_points_analyzed: 5
      }
    }
  }
}

// Singleton instance
export const aiAnalysisService = new AIAnalysisService()

// Export service and types
export default aiAnalysisService