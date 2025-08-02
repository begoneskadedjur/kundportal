// api/ai-coordinator-analysis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Systemmeddelande för AI:n
const SYSTEM_MESSAGE = `Du är en datadriven expert på schemaläggning och koordinering inom skadedjursbekämpning.
Din uppgift är att analysera koordinatorns prestation och ge insiktsfulla rekommendationer.

Fokusera på:
1. Schemaläggningseffektivitet och responstider - analysera djupgående mönster och flaskhalsar
2. Tekniker-utnyttjande och arbetsbalans - identifiera exakt varför vissa tekniker är över/underutnyttjade
3. Geografisk optimering och ruttplanering - beräkna exakta kostnadsbesparingar
4. Affärspåverkan och intäktsmöjligheter - kvantifiera förluster och potentiella vinster
5. Konkreta förbättringsförslag med mätbara resultat och tidsramar

Viktig instruktion: Var EXTREMT specifik och datadriven. Använd exakta siffror, procentuella förändringar, och beräkningar. Undvik generella uttalanden. Varje påstående ska backas upp av specifik data. Analysera trender, avvikelser och mönster i datan.

Svara ALLTID i formatet som definieras i TypeScript-interfacet nedan, på svenska:

interface AICoordinatorAnalysis {
  summary: {
    headline: string; // Kort, slagkraftig rubrik
    summary: string; // 2-3 meningar som sammanfattar analysen
    period: string; // Tidsperioden för analysen
  };
  schedulingAnalysis: {
    overall_efficiency_grade: 'A+' | 'A' | 'B' | 'C' | 'D';
    key_insights: Array<{
      metric: string;
      value: string;
      trend: 'positive' | 'negative' | 'neutral';
      insight: string;
    }>;
  };
  utilizationAnalysis: {
    team_balance_score: 'utmärkt' | 'bra' | 'behöver förbättring' | 'kritisk';
    insights: Array<{
      technician_name: string;
      utilization_percent: number;
      status: 'optimal' | 'underutilized' | 'overutilized';
      recommendation: string;
    }>;
    overall_recommendation: string;
  };
  businessImpact: {
    revenue_impact_analysis: string;
    key_opportunities: Array<{
      metric: string;
      current_value: string;
      potential_value: string;
      improvement_opportunity: string;
    }>;
  };
  geographicOptimization: {
    overall_routing_efficiency: 'optimal' | 'god' | 'kan förbättras' | 'ineffektiv';
    insights: Array<{
      area: string;
      efficiency_score: number;
      travel_time_impact: string;
      optimization_potential: string;
    }>;
    cost_saving_potential: string;
  };
  actionPlan: {
    immediate_actions: Array<{
      area: string;
      current_state: string;
      recommended_action: string;
      expected_impact: string;
      priority: 'Hög' | 'Medium' | 'Låg';
    }>;
    long_term_improvements: Array<{
      area: string;
      current_state: string;
      recommended_action: string;
      expected_impact: string;
      priority: 'Hög' | 'Medium' | 'Låg';
    }>;
    success_metrics: string[];
  };
  metadata: {
    generated_at: string; // ISO 8601
    analysis_period: { start: string; end: string };
    data_completeness: number; // 0-100
    confidence_level: 'hög' | 'medium' | 'låg';
  };
}

KRITISKT: 
- Använd EXAKTA siffror från datan (inte avrundade)
- TIDSFORMATERING: Visa alltid tid med MAX 1 decimal (t.ex. 1.0 timme, 17.5 timmar, 104.9 timmar)
- PROCENTFORMATERING: Visa procent med MAX 1 decimal (t.ex. 67.9%, 96.6%)
- Beräkna procentuella förbättringar och konkreta mål
- Identifiera specifika tekniker och deras utmaningar
- Kvantifiera ekonomisk påverkan i kronor
- Ge tidsramar för varje rekommendation
- Jämför med branschstandarder (3 dagar för schemaläggning, 75-85% tekniker-utnyttjande)
- Analysera avvikelser och outliers i datan`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { kpiData, efficiencyTrend, utilizationData, businessImpact, dateRange } = req.body;

    if (!kpiData || !dateRange) {
      return res.status(400).json({ 
        success: false, 
        error: 'Saknar nödvändig data för analys' 
      });
    }

    // Förbered data för AI-analys
    const analysisData = {
      period: dateRange,
      scheduling: {
        avg_hours_to_schedule: kpiData.scheduling_efficiency.avg_hours_to_schedule,
        scheduled_within_72h_percent: kpiData.scheduling_efficiency.scheduled_within_72h_percent,
        total_scheduled: kpiData.scheduling_efficiency.total_scheduled,
      },
      utilization: {
        avg_utilization_percent: kpiData.technician_utilization.avg_utilization_percent,
        underutilized_technicians: kpiData.technician_utilization.underutilized_technicians,
        overutilized_technicians: kpiData.technician_utilization.overutilized_technicians,
        total_technicians: kpiData.technician_utilization.total_technicians,
        technician_details: utilizationData,
      },
      rescheduling: {
        reschedule_rate_percent: kpiData.rescheduling_metrics.reschedule_rate_percent,
        total_rescheduled: kpiData.rescheduling_metrics.total_rescheduled,
        avg_reschedules_per_case: kpiData.rescheduling_metrics.avg_reschedules_per_case,
      },
      business_impact: businessImpact,
      efficiency_trend: efficiencyTrend,
      geographic_data: kpiData.geographic_optimization,
    };

    const userMessage = `Analysera följande koordinator-data och generera en omfattande analys:

${JSON.stringify(analysisData, null, 2)}

Kom ihåg att svara i det exakta JSON-format som specificerats.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const analysisContent = completion.choices[0].message.content;
    if (!analysisContent) {
      throw new Error('Tom respons från AI');
    }

    const analysis = JSON.parse(analysisContent);

    // Säkerställ att metadata är korrekt
    if (!analysis.metadata) {
      analysis.metadata = {
        generated_at: new Date().toISOString(),
        analysis_period: { start: dateRange.startDate, end: dateRange.endDate },
        data_completeness: 100,
        confidence_level: 'hög'
      };
    }

    return res.status(200).json({
      success: true,
      analysis,
      ai_model: "gpt-4o",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Coordinator Analysis Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    const statusCode = errorMessage.includes('API key') ? 401 : 500;
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}