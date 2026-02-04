// /api/ai-technician-analysis.ts
// UPPDATERAD: 2025-02-04 - Migrerad från OpenAI till Google Gemini

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

// =================================================================================
// SECTION 1: CONFIGURATION & INITIALIZATION
// =================================================================================

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Definition av den förväntade JSON-strukturen.
// Detta är hjärtat av vår nya, djupgående analys.
const systemPrompt = `Du är en elit-analytiker och strategisk coach för BeGone, ett ledande skadedjursföretag. Ditt uppdrag är att genomföra en djupgående, datadriven analys av en enskild tekniker. Du måste vara ärlig, direkt och ge konkreta, handlingsbara rekommendationer.

Analysen ska generera ett JSON-objekt och **ENDAST** ett JSON-objekt, som strikt följer denna TypeScript-interface:

interface AIAnalysis {
  executiveSummary: { headline: string; summary: string; };
  performanceDashboard: { overall_performance_grade: 'A+' | 'A' | 'B' | 'C' | 'D'; key_metrics: Array<{ metric: string; value: string; comparison_to_team_avg: number; comparison_to_top_performer: number; }>; };
  revenueDeepDive: { breakdown: Array<{ source: 'Privat' | 'Företag' | 'Avtal'; revenue: number; case_count: number; avg_value: number; }>; profitability_analysis: string; };
  specializationAnalysis: { primary_specialization: string; specialization_revenue: number; specialization_avg_case_value: number; comparison_to_team_avg_for_pest: number; recommendation: string; };
  historicalTrends: { six_month_revenue_trend: 'stark uppgång' | 'stabil' | 'svag nedgång' | 'data saknas'; consistency_score: 'mycket konsekvent' | 'varierande' | 'oförutsägbar'; trend_analysis: string; };
  strengths: Array<{ area: string; description: string; evidence: string; }>;
  developmentAreas: Array<{ area: string; description: string; potential_impact: string; }>;
  actionableDevelopmentPlan: { primary_focus_30_days: string; actions: Array<{ action: string; priority: 'Hög' | 'Medium' | 'Låg'; expected_outcome: string; how_to_measure: string; }>; };
  mentorshipProfile: { profile: 'Idealisk Mentor' | 'Aktiv Adept' | 'Självgående Expert' | 'Potential att leda'; should_mentor: boolean; mentoring_areas: string[]; needs_mentoring: boolean; learning_focus: string[]; };
  riskAssessment: { key_risks: Array<{ risk: string; mitigation_strategy: string; }>; retention_factor: 'Hög' | 'Medium' | 'Låg'; };
}

INSTRUKTIONER FÖR DIN ANALYS:
- **executiveSummary**: Var brutal-ärlig. Ge en skarp, insiktsfull sammanfattning som en VD kan läsa på 10 sekunder.
- **performanceDashboard**: Använd datan för att beräkna procentuella jämförelser mot teamets snitt och toppen. Var exakt. Betygsätt från A+ (exceptionell) till D (underpresterande).
- **revenueDeepDive**: Analysera intäktsströmmarna. Identifiera var teknikern är mest (och minst) lönsam.
- **specializationAnalysis**: Identifiera inte bara den vanligaste skadedjurstypen. Analysera den ekonomiska prestandan inom den nischen. Ge en strategisk rekommendation.
- **historicalTrends**: Analysera de senaste 6 månadernas data. Är prestandan på väg upp eller ner? Är den stabil eller volatil? Förklara varför.
- **actionableDevelopmentPlan**: VIKTIGAST. Skapa en 30-dagarsplan med SPECIFIKA, MÄTBARA mål. Exempel: "Öka genomsnittligt pris på privatärenden från 1800 kr till 2100 kr."
- **mentorshipProfile**: Baserat på all data, definiera teknikerns roll. Är hen redo att leda? Behöver hen en mentor? Var specifik.
- **riskAssessment**: Tänk som en företagsledare. Vilka är riskerna? Utbrändhet? Beroende av en kund? Stagnation?

Du måste leverera en komplett, felfri JSON utan extra text före eller efter. Analysen ska vara på svenska.`;


// =================================================================================
// SECTION 2: API HANDLER
// Huvudlogiken för Vercel Serverless Function.
// =================================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tillåt CORS för OPTIONS-anrop (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // Acceptera endast POST-anrop
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { technician, allTechnicians, monthlyData, pestSpecialization } = req.body;

    // --- Input Validering ---
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Google AI API-nyckel är inte konfigurerad på servern.' });
    }
    if (!technician || !allTechnicians || allTechnicians.length === 0) {
      return res.status(400).json({ success: false, error: 'Nödvändig tekniker-data saknas i anropet.' });
    }
    if (!technician.name || typeof technician.rank !== 'number' || typeof technician.total_revenue !== 'number') {
        return res.status(400).json({ success: false, error: 'Den valda teknikerns data är ofullständig eller korrupt.' });
    }

    // --- Bygg Datakontext ---
    const analysisContext = buildAnalysisContext(technician, allTechnicians, monthlyData, pestSpecialization);
    const userPrompt = `Analysera följande teknikerdata och generera en JSON enligt systeminstruktionen:\n\n${JSON.stringify(analysisContext, null, 2)}`;

    // --- Anropa Google Gemini ---
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',
      },
    });

    const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
    const result = await model.generateContent(combinedPrompt);
    const aiResponse = result.response.text();

    if (!aiResponse) {
      throw new Error('Tom respons från Google Gemini.');
    }

    // --- Parsa och Validera Svar ---
    let analysis;
    try {
      analysis = JSON.parse(aiResponse);
      // Simpel validering för att se om nyckel-delar finns
      if (!analysis.executiveSummary || !analysis.actionableDevelopmentPlan) {
        throw new Error('AI-svaret saknar nödvändiga nyckelfält.');
      }
    } catch (parseError: any) {
      console.error('JSON Parse Error:', parseError.message);
      console.log('Raw AI Response:', aiResponse);
      // Om parsning misslyckas, använd vår robusta fallback
      throw new Error('Misslyckades att tolka AI-svaret som giltig JSON.');
    }

    // --- Returnera Framgångsrikt Svar ---
    return res.status(200).json({
      success: true,
      analysis: {
        ...analysis,
        metadata: {
          generated_at: new Date().toISOString(),
          technician_name: technician.name,
          analysis_version: '3.1-gemini',
          data_points_analyzed: Object.keys(analysisContext).length,
        }
      },
      ai_model: 'gemini-2.0-flash',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Fullständig AI Analysis Error:', error);
    
    // --- FELHANTERING MED FALLBACK ---
    // Om något går fel (API-nyckel, anrop, parsning), skapa och returnera en fallback-analys.
    // Detta förhindrar att frontend kraschar och ger användaren ett meningsfullt svar.
    try {
      const { technician, allTechnicians } = req.body;
      if (technician && allTechnicians) {
        const fallbackAnalysis = createFallbackAnalysis(technician, allTechnicians);
        return res.status(200).json({
          success: true, // Notera: success är true eftersom vi levererar en fungerande fallback
          analysis: fallbackAnalysis,
          ai_model: 'server-fallback-generator',
          timestamp: new Date().toISOString(),
          warning: `AI-tjänsten kunde inte nås (${error.message}). En förenklad fallback-analys visas.`
        });
      }
    } catch (fallbackError: any) {
      console.error('Critical: Fallback creation also failed:', fallbackError);
    }
    
    // Om allt annat misslyckas
    return res.status(500).json({
      success: false,
      error: 'Ett kritiskt fel uppstod under AI-analysen.',
      details: error.message
    });
  }
}

// =================================================================================
// SECTION 3: HELPER FUNCTIONS
// =================================================================================

/**
 * Bygger ett rikt och kontextuellt dataobjekt som ska skickas till AI:n.
 */
function buildAnalysisContext(technician: any, allTechnicians: any[], monthlyData: any[], pestSpecialization: any[]) {
    const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length;
    const teamAvgCases = allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length;
    const topPerformer = allTechnicians.find(t => t.rank === 1) || technician;
    
    return {
        technician_to_analyze: {
            name: technician.name,
            role: technician.role,
            rank_in_team: `${technician.rank} av ${allTechnicians.length}`,
            total_revenue: technician.total_revenue,
            total_cases: technician.total_cases,
            avg_revenue_per_case: technician.avg_case_value,
            revenue_breakdown: {
                private: { revenue: technician.private_revenue, cases: technician.private_cases },
                business: { revenue: technician.business_revenue, cases: technician.business_cases },
                contract: { revenue: technician.contract_revenue, cases: technician.contract_cases },
            }
        },
        team_benchmark: {
            total_technicians: allTechnicians.length,
            average_revenue_per_technician: teamAvgRevenue,
            average_cases_per_technician: teamAvgCases,
            top_performer_stats: { name: topPerformer.name, revenue: topPerformer.total_revenue, avg_revenue_per_case: topPerformer.avg_case_value },
        },
        historical_performance_last_6_months: monthlyData?.slice(-6) || [],
        pest_specialization_data: pestSpecialization || [],
    };
}

/**
 * Skapar en fullständig, men förenklad, analys som matchar den nya datastrukturen.
 * Används när AI-anropet misslyckas av någon anledning.
 */
function createFallbackAnalysis(technician: any, allTechnicians: any[]) {
    const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length;
    const topPerformer = allTechnicians.find(t => t.rank === 1) || technician;
    const isTopPerformer = technician.rank <= 3;
    const safeAvgRevenue = teamAvgRevenue > 0 ? teamAvgRevenue : 1;
    const safeTopPerformerRevenue = topPerformer.total_revenue > 0 ? topPerformer.total_revenue : 1;


    return {
      executiveSummary: {
        headline: "Förenklad Fallback-Analys",
        summary: `Det gick inte att ansluta till AI-tjänsten. Denna analys är autogenererad. ${technician.name} har rank #${technician.rank} med en intäkt på ${technician.total_revenue.toLocaleString('sv-SE')} kr.`,
      },
      performanceDashboard: {
        overall_performance_grade: isTopPerformer ? 'A' : 'C',
        key_metrics: [
          { metric: "Total Intäkt", value: `${technician.total_revenue.toLocaleString('sv-SE')} kr`, comparison_to_team_avg: technician.total_revenue / safeAvgRevenue, comparison_to_top_performer: technician.total_revenue / safeTopPerformerRevenue },
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
    };
}