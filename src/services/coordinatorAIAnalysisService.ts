// src/services/coordinatorAIAnalysisService.ts
// AI-driven analystjänst för koordinatorns analytics dashboard

import { toast } from 'react-hot-toast';

// =================================================================================
// SECTION 1: DATA STRUCTURES & TYPES
// =================================================================================

//#region --- AI Analysis Interfaces ---

interface AICoordinatorSummary {
  headline: string;
  summary: string;
  period: string;
}

interface AISchedulingInsight {
  metric: string;
  value: string;
  trend: 'positive' | 'negative' | 'neutral';
  insight: string;
}

interface AISchedulingAnalysis {
  overall_efficiency_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  key_insights: AISchedulingInsight[];
}

interface AITechnicianUtilizationInsight {
  technician_name: string;
  utilization_percent: number;
  status: 'optimal' | 'underutilized' | 'overutilized';
  recommendation: string;
}

interface AIUtilizationAnalysis {
  team_balance_score: 'utmärkt' | 'bra' | 'behöver förbättring' | 'kritisk';
  insights: AITechnicianUtilizationInsight[];
  overall_recommendation: string;
}

interface AIBusinessImpactMetric {
  metric: string;
  current_value: string;
  potential_value: string;
  improvement_opportunity: string;
}

interface AIBusinessImpact {
  revenue_impact_analysis: string;
  key_opportunities: AIBusinessImpactMetric[];
}

interface AIGeographicInsight {
  area: string;
  efficiency_score: number;
  travel_time_impact: string;
  optimization_potential: string;
}

interface AIGeographicOptimization {
  overall_routing_efficiency: 'optimal' | 'god' | 'kan förbättras' | 'ineffektiv';
  insights: AIGeographicInsight[];
  cost_saving_potential: string;
}

interface AIImprovement {
  area: string;
  current_state: string;
  recommended_action: string;
  expected_impact: string;
  priority: 'Hög' | 'Medium' | 'Låg';
}

interface AIActionPlan {
  immediate_actions: AIImprovement[];
  long_term_improvements: AIImprovement[];
  success_metrics: string[];
}

interface AICoordinatorMetadata {
  generated_at: string;
  analysis_period: { start: string; end: string };
  data_completeness: number;
  confidence_level: 'hög' | 'medium' | 'låg';
}

/**
 * Huvudinterface för koordinatorns AI-analys
 */
export interface AICoordinatorAnalysis {
  summary: AICoordinatorSummary;
  schedulingAnalysis: AISchedulingAnalysis;
  utilizationAnalysis: AIUtilizationAnalysis;
  businessImpact: AIBusinessImpact;
  geographicOptimization: AIGeographicOptimization;
  actionPlan: AIActionPlan;
  metadata: AICoordinatorMetadata;
}

//#endregion --- AI Analysis Interfaces ---

//#region --- API Communication Interfaces ---

export interface AICoordinatorAnalysisRequest {
  kpiData: any;
  efficiencyTrend: any[];
  utilizationData: any[];
  businessImpact: any;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  coordinatorId?: string;
}

export interface AICoordinatorAnalysisResponse {
  success: boolean;
  analysis: AICoordinatorAnalysis;
  ai_model: string;
  timestamp: string;
  error?: string;
  warning?: string;
}

//#endregion --- API Communication Interfaces ---

// =================================================================================
// SECTION 2: AI ANALYSIS SERVICE CLASS
// =================================================================================

class AICoordinatorAnalysisService {
  private readonly baseUrl = '/api';

  /**
   * Genererar en AI-driven analys av koordinatorns data
   */
  public async generateCoordinatorAnalysis(request: AICoordinatorAnalysisRequest): Promise<AICoordinatorAnalysis> {
    const loadingToast = toast.loading('AI analyserar koordinator-data...', {
      style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
    });

    try {
      const response = await fetch(`${this.baseUrl}/ai-coordinator-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data: AICoordinatorAnalysisResponse = await response.json();
      toast.dismiss(loadingToast);

      if (!response.ok || !data.success) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }
      
      if (data.warning) {
        toast(`Varning: ${data.warning}`, {
          duration: 6000,
          icon: '⚠️',
          style: {
            background: '#f59e0b',
            color: '#ffffff',
          },
        });
      } else {
        toast.success('AI-analys klar!', {
          style: { background: '#059669', color: '#ffffff' },
        });
      }

      return data.analysis;

    } catch (error: any) {
      console.error('AI Coordinator Analysis Service Error:', error);
      toast.dismiss(loadingToast);

      toast.error(`AI-analys misslyckades: ${error.message}. Visar en förenklad fallback-analys.`, {
        duration: 8000,
        style: { background: '#dc2626', color: '#ffffff' },
      });
      
      return this.createFallbackAnalysis(request);
    }
  }

  /**
   * Skapar en fallback-analys när AI-tjänsten inte är tillgänglig
   */
  private createFallbackAnalysis(request: AICoordinatorAnalysisRequest): AICoordinatorAnalysis {
    const { kpiData, dateRange } = request;
    const avgSchedulingTime = kpiData?.scheduling_efficiency?.avg_hours_to_schedule || 24;
    const utilizationPercent = kpiData?.technician_utilization?.avg_utilization_percent || 70;
    const rescheduleRate = kpiData?.rescheduling_metrics?.reschedule_rate_percent || 10;

    return {
      summary: {
        headline: "Förenklad Koordinator-analys",
        summary: `Baserat på data från ${dateRange.startDate} till ${dateRange.endDate}. AI-tjänsten var inte tillgänglig, så denna analys är baserad på grundläggande beräkningar.`,
        period: `${dateRange.startDate} - ${dateRange.endDate}`,
      },
      schedulingAnalysis: {
        overall_efficiency_grade: avgSchedulingTime < 24 ? 'A' : avgSchedulingTime < 48 ? 'B' : 'C',
        key_insights: [
          {
            metric: "Genomsnittlig schemaläggning",
            value: `${avgSchedulingTime.toFixed(1)} timmar`,
            trend: avgSchedulingTime < 24 ? 'positive' : 'negative',
            insight: avgSchedulingTime < 24 ? "Utmärkt responstid på nya ärenden" : "Möjlighet att förbättra schemaläggningshastigheten",
          },
          {
            metric: "Ombokningsfrekvens",
            value: `${rescheduleRate.toFixed(1)}%`,
            trend: rescheduleRate < 15 ? 'positive' : 'negative',
            insight: rescheduleRate < 15 ? "Låg ombokningsfrekvens visar på god initial planering" : "Hög ombokningsfrekvens påverkar effektiviteten",
          },
        ],
      },
      utilizationAnalysis: {
        team_balance_score: utilizationPercent > 80 ? 'utmärkt' : utilizationPercent > 60 ? 'bra' : 'behöver förbättring',
        insights: [],
        overall_recommendation: "Detaljerad teknikeranalys kräver fullständig AI-analys.",
      },
      businessImpact: {
        revenue_impact_analysis: "Fullständig intäktsanalys inte tillgänglig utan AI.",
        key_opportunities: [],
      },
      geographicOptimization: {
        overall_routing_efficiency: 'kan förbättras',
        insights: [],
        cost_saving_potential: "Beräkning kräver AI-analys",
      },
      actionPlan: {
        immediate_actions: [
          {
            area: "Schemaläggning",
            current_state: `${avgSchedulingTime.toFixed(1)}h genomsnitt`,
            recommended_action: "Implementera automatiserad schemaläggning för standardärenden",
            expected_impact: "30% snabbare schemaläggning",
            priority: 'Hög',
          },
        ],
        long_term_improvements: [],
        success_metrics: ["Schemaläggning inom 24h", "Ombokningsfrekvens under 10%", "Tekniker-utnyttjande över 75%"],
      },
      metadata: {
        generated_at: new Date().toISOString(),
        analysis_period: { start: dateRange.startDate, end: dateRange.endDate },
        data_completeness: 50,
        confidence_level: 'låg',
      },
    };
  }
}

// =================================================================================
// SECTION 3: SINGLETON INSTANCE & EXPORT
// =================================================================================

export const aiCoordinatorAnalysisService = new AICoordinatorAnalysisService();
export default aiCoordinatorAnalysisService;