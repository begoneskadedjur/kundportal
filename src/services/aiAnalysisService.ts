// src/services/aiAnalysisService.ts
// UPPDATERAD: 2025-07-15 - Fullständig omskrivning med ny datastruktur och förbättrad fallback.

import { toast } from 'react-hot-toast';

// =================================================================================
// SECTION 1: DATA STRUCTURES & TYPES
// Detta är "kontraktet" som definierar formen på vår AI-analys.
// Den delas mellan frontend-komponenter och denna service.
// =================================================================================

//#region --- AI Analysis Interfaces ---

interface AIExecutiveSummary {
  headline: string;
  summary: string;
}

interface AIPerformanceMetric {
  metric: string;
  value: string;
  comparison_to_team_avg: number;
  comparison_to_top_performer: number;
}

interface AIPerformanceDashboard {
  overall_performance_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  key_metrics: AIPerformanceMetric[];
}

interface AIRevenueBreakdown {
  source: 'Privat' | 'Företag' | 'Avtal';
  revenue: number;
  case_count: number;
  avg_value: number;
}

interface AIRevenueDeepDive {
  breakdown: AIRevenueBreakdown[];
  profitability_analysis: string;
}

interface AISpecializationAnalysis {
  primary_specialization: string;
  specialization_revenue: number;
  specialization_avg_case_value: number;
  comparison_to_team_avg_for_pest: number;
  recommendation: string;
}

interface AIHistoricalTrends {
  six_month_revenue_trend: 'stark uppgång' | 'stabil' | 'svag nedgång' | 'data saknas';
  consistency_score: 'mycket konsekvent' | 'varierande' | 'oförutsägbar';
  trend_analysis: string;
}

interface AIStrength {
  area: string;
  description: string;
  evidence: string;
}

interface AIDevelopmentArea {
  area: string;
  description: string;
  potential_impact: string;
}

interface AIAction {
  action: string;
  priority: 'Hög' | 'Medium' | 'Låg';
  expected_outcome: string;
  how_to_measure: string;
}

interface AIActionableDevelopmentPlan {
  primary_focus_30_days: string;
  actions: AIAction[];
}

interface AIMentorshipProfile {
  profile: 'Idealisk Mentor' | 'Aktiv Adept' | 'Självgående Expert' | 'Potential att leda';
  should_mentor: boolean;
  mentoring_areas: string[];
  needs_mentoring: boolean;
  learning_focus: string[];
}

interface AIRisk {
    risk: string;
    mitigation_strategy: string;
}

interface AIRiskAssessment {
  key_risks: AIRisk[];
  retention_factor: 'Hög' | 'Medium' | 'Låg';
}

interface AIAnalysisMetadata {
  generated_at: string;
  technician_name: string;
  analysis_version: string;
  data_points_analyzed: number;
}

/**
 * Huvud-interfacet för hela den djupgående AI-analysen.
 * Detta är den datastruktur som frontend-komponenterna förväntar sig.
 */
export interface AIAnalysis {
  executiveSummary: AIExecutiveSummary;
  performanceDashboard: AIPerformanceDashboard;
  revenueDeepDive: AIRevenueDeepDive;
  specializationAnalysis: AISpecializationAnalysis;
  historicalTrends: AIHistoricalTrends;
  strengths: AIStrength[];
  developmentAreas: AIDevelopmentArea[];
  actionableDevelopmentPlan: AIActionableDevelopmentPlan;
  mentorshipProfile: AIMentorshipProfile;
  riskAssessment: AIRiskAssessment;
  metadata?: AIAnalysisMetadata;
}

//#endregion --- AI Analysis Interfaces ---

//#region --- API Communication Interfaces ---

/**
 * Data som skickas TILL backend för att generera en analys.
 */
export interface AIAnalysisRequest {
  technician: any;
  allTechnicians: any[];
  monthlyData?: any[];
  pestSpecialization?: any[];
  teamStats?: {
    avg_revenue: number;
    avg_cases: number;
    total_technicians: number;
  };
}

/**
 * Det förväntade svaret FRÅN backend-api:et.
 */
export interface AIAnalysisResponse {
  success: boolean;
  analysis: AIAnalysis;
  ai_model: string;
  timestamp: string;
  error?: string;
  warning?: string;
}

//#endregion --- API Communication Interfaces ---


// =================================================================================
// SECTION 2: AI ANALYSIS SERVICE CLASS
// Hanterar all kommunikation med backend för AI-analyser.
// Inkluderar anrop, felhantering, notifieringar och fallback-logik.
// =================================================================================

class AIAnalysisService {
  private readonly baseUrl = '/api';

  /**
   * Anropar backend för att generera en ny, djupgående teknikeranalys.
   * @param request Datat som behövs för analysen.
   * @returns Ett komplett AIAnalysis-objekt.
   */
  public async generateTechnicianAnalysis(request: AIAnalysisRequest): Promise<AIAnalysis> {
    const loadingToast = toast.loading('AI analyserar tekniker-data...', {
      style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
    });

    try {
      const response = await fetch(`${this.baseUrl}/ai-technician-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: AIAnalysisResponse = await response.json();
      toast.dismiss(loadingToast);

      if (!response.ok || !data.success) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }
      
      if (data.warning) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-yellow-500 text-white p-4 rounded-lg shadow-lg`}>
            <b>Varning:</b> {data.warning}
          </div>
        ), { duration: 6000 });
      } else {
        toast.success(`AI-analys klar för ${request.technician.name}!`, {
          style: { background: '#059669', color: '#ffffff' },
        });
      }

      return data.analysis;

    } catch (error: any) {
      console.error('AI Analysis Service Error:', error);
      toast.dismiss(loadingToast);

      // Vid fel, generera och returnera en robust fallback-analys
      // för att förhindra att applikationen kraschar.
      toast.error(`AI-analys misslyckades: ${error.message}. Visar en förenklad fallback-analys.`, {
        duration: 8000,
        style: { background: '#dc2626', color: '#ffffff' },
      });
      
      return this.createFallbackAnalysis(request.technician, request.allTechnicians);
    }
  }

  /**
   * En hjälpfunktion för att skapa en förenklad, men strukturellt korrekt,
   * AI-analys när det riktiga API-anropet misslyckas.
   * @param technician Den valda teknikern.
   * @param allTechnicians Alla tekniker för jämförelse.
   * @returns Ett AIAnalysis-objekt som kan renderas säkert i frontend.
   */
  private createFallbackAnalysis(technician: any, allTechnicians: any[]): AIAnalysis {
    const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length;
    const topPerformer = allTechnicians.find(t => t.rank === 1) || technician;
    const isTopPerformer = technician.rank <= 3;

    return {
      executiveSummary: {
        headline: "Förenklad Fallback-Analys",
        summary: `Det gick inte att ansluta till AI-tjänsten. Denna analys är autogenererad baserat på grundläggande data. ${technician.name} har rank #${technician.rank} och en total intäkt på ${technician.total_revenue.toLocaleString('sv-SE')} kr.`,
      },
      performanceDashboard: {
        overall_performance_grade: isTopPerformer ? 'A' : 'C',
        key_metrics: [
          { metric: "Total Intäkt", value: `${technician.total_revenue.toLocaleString('sv-SE')} kr`, comparison_to_team_avg: technician.total_revenue / teamAvgRevenue, comparison_to_top_performer: technician.total_revenue / topPerformer.total_revenue },
          { metric: "Antal Ärenden", value: `${technician.total_cases}`, comparison_to_team_avg: 1.0, comparison_to_top_performer: 1.0 },
        ],
      },
      revenueDeepDive: {
        breakdown: [{ source: 'Privat', revenue: technician.private_revenue || 0, case_count: technician.private_cases || 0, avg_value: (technician.private_revenue || 0) / (technician.private_cases || 1) }, { source: 'Företag', revenue: technician.business_revenue || 0, case_count: technician.business_cases || 0, avg_value: (technician.business_revenue || 0) / (technician.business_cases || 1) }],
        profitability_analysis: "Detaljerad lönsamhetsanalys kräver en fullständig AI-analys.",
      },
      specializationAnalysis: {
        primary_specialization: "Okänd (Fallback)",
        specialization_revenue: 0,
        specialization_avg_case_value: 0,
        comparison_to_team_avg_for_pest: 1.0,
        recommendation: "Specialist-analys är inte tillgänglig i fallback-läget.",
      },
      historicalTrends: {
        six_month_revenue_trend: 'data saknas',
        consistency_score: 'varierande',
        trend_analysis: "Historisk data kunde inte analyseras.",
      },
      strengths: [{ area: "Grundprestanda", description: "Hanterar en stadig volym ärenden.", evidence: `${technician.total_cases} ärenden totalt.` }],
      developmentAreas: [{ area: "Strategisk utveckling", description: "Möjlighet att finslipa prissättning och specialisering.", potential_impact: "Ökad lönsamhet per ärende." }],
      actionableDevelopmentPlan: {
        primary_focus_30_days: "Fokusera på att bibehålla nuvarande arbetstakt och säkerställa kundnöjdhet.",
        actions: [{ action: "Genomför en 1-on-1 med närmaste chef för att sätta personliga mål.", priority: 'Hög', expected_outcome: "Tydliga och uppföljningsbara mål för nästa kvartal.", how_to_measure: "Protokollfört möte med definierade mål." }],
      },
      mentorshipProfile: {
        profile: isTopPerformer ? 'Potential att leda' : 'Aktiv Adept',
        should_mentor: isTopPerformer,
        mentoring_areas: isTopPerformer ? ["Grundläggande ärendehantering"] : [],
        needs_mentoring: !isTopPerformer,
        learning_focus: !isTopPerformer ? ["Effektivitet", "Prissättning"] : [],
      },
      riskAssessment: {
        key_risks: [{ risk: "Avsaknad av djupdata", mitigation_strategy: "Kör en fullständig AI-analys vid ett senare tillfälle för att identifiera specifika risker och möjligheter." }],
        retention_factor: 'Medium',
      },
      metadata: {
        generated_at: new Date().toISOString(),
        technician_name: technician.name,
        analysis_version: "fallback-3.0",
        data_points_analyzed: 2,
      },
    };
  }
}

// =================================================================================
// SECTION 3: SINGLETON INSTANCE & EXPORT
// Skapar och exporterar en enda instans av servicen för att
// användas i hela applikationen.
// =================================================================================

export const aiAnalysisService = new AIAnalysisService();
export default aiAnalysisService;```