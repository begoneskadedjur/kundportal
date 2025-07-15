// /api/ai-technician-analysis.ts - AI-driven tekniker analys med ChatGPT
import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      technician, 
      allTechnicians, 
      monthlyData, 
      pestSpecialization, 
      teamStats,
      validate 
    } = req.body

    // API Health Check
    if (validate === true) {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured',
          health: 'unhealthy' 
        })
      }
      return res.status(200).json({ 
        health: 'healthy',
        openai_configured: true,
        timestamp: new Date().toISOString()
      })
    }

    // Validera input
    if (!technician || !allTechnicians) {
      return res.status(400).json({ 
        error: 'Tekniker data saknas',
        details: 'Både technician och allTechnicians krävs'
      })
    }

    // Validera OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OpenAI API inte konfigurerad',
        details: 'OPENAI_API_KEY environment variable saknas'
      })
    }

    // Validera tekniker data struktur
    if (!technician.name || !technician.rank || typeof technician.total_revenue !== 'number') {
      return res.status(400).json({ 
        error: 'Ogiltig tekniker data struktur',
        details: 'Tekniker måste ha name, rank och total_revenue'
      })
    }

    // Skapa omfattande datakontext för AI:n
    const analysisContext = {
      technician: {
        name: technician.name,
        role: technician.role,
        rank: technician.rank,
        total_revenue: technician.total_revenue,
        total_cases: technician.total_cases,
        avg_case_value: technician.avg_case_value,
        private_revenue: technician.private_revenue,
        business_revenue: technician.business_revenue,
        contract_revenue: technician.contract_revenue,
        private_cases: technician.private_cases,
        business_cases: technician.business_cases,
        contract_cases: technician.contract_cases
      },
      team_context: {
        total_technicians: allTechnicians.length,
        team_avg_revenue: allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length,
        team_avg_cases: allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length,
        team_avg_case_value: allTechnicians.reduce((sum, t) => sum + t.avg_case_value, 0) / allTechnicians.length,
        top_performer: allTechnicians.find(t => t.rank === 1),
        technician_percentile: ((allTechnicians.length - technician.rank + 1) / allTechnicians.length * 100).toFixed(1)
      },
      performance_trends: monthlyData?.slice(-6) || [], // Senaste 6 månaderna
      specializations: pestSpecialization || [],
      company_context: {
        total_revenue_all: allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0),
        business_type: 'Skadedjursbekämpning',
        service_areas: ['Privatpersoner', 'Företag', 'Avtalskunder']
      }
    }

    // Skapa AI prompt för djupanalys
    const systemPrompt = `Du är en expert inom personalutveckling och performance coaching för skadedjursbekämpningsföretag. 

Din uppgift är att analysera en teknikers prestanda och skapa personliga, konkreta utvecklingsrekommendationer baserat på verklig data.

Analysera följande aspekter:
1. Styrkor baserat på ranking, intäkt per ärende, specialisering
2. Förbättringsområden jämfört med teamet
3. Trender i månadsdata (om tillgänglig)
4. Konkreta nästa steg inom 30 dagar
5. Långsiktiga utvecklingsmål

Svara ENDAST med en JSON-struktur enligt detta format:
{
  "summary": "Kort sammanfattning av teknikerns position och potential",
  "strengths": [
    {
      "area": "Område (t.ex. Specialisering, Prissättning, Konsistens)",
      "description": "Konkret beskrivning med siffror",
      "evidence": "Specifik data som stödjer detta"
    }
  ],
  "development_areas": [
    {
      "area": "Utvecklingsområde",
      "description": "Vad som kan förbättras",
      "impact": "Potential påverkan på prestanda"
    }
  ],
  "next_steps": [
    {
      "action": "Konkret åtgärd",
      "timeline": "30 dagar/3 månader/6 månader",
      "priority": "high/medium/low",
      "expected_outcome": "Förväntad förbättring"
    }
  ],
  "mentorship_recommendations": {
    "should_mentor": boolean,
    "mentoring_areas": ["Area1", "Area2"],
    "needs_mentoring": boolean,
    "learning_focus": ["Focus1", "Focus2"]
  },
  "performance_predictions": {
    "next_quarter_outlook": "Positiv/Neutral/Behöver fokus",
    "growth_potential": "Hög/Medium/Stabil",
    "key_risk_factors": ["Risk1", "Risk2"]
  }
}`

    const userPrompt = `Analysera följande teknikerdata:

${JSON.stringify(analysisContext, null, 2)}

Fokusera på att:
- Jämföra med teamgenomsnittet (${analysisContext.team_context.team_avg_revenue.toFixed(0)} kr, ${analysisContext.team_context.team_avg_cases} ärenden)
- Identifiera styrkor i specialisering och prissättning
- Ge konkreta, actionable råd för nästa 30 dagar
- Föreslå mentorskap-möjligheter (både att ge och ta emot)
- Använd svenska och branschspecifika termer för skadedjursbekämpning`

    // Anropa OpenAI med timeout och retry logic
    let completion
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        attempts++
        
        completion = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            timeout: 45000 // 45 second timeout
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI request timeout')), 50000)
          )
        ])
        
        break // Success, exit retry loop
        
      } catch (apiError: any) {
        console.error(`OpenAI API attempt ${attempts} failed:`, apiError.message)
        
        if (attempts === maxAttempts) {
          // Final attempt failed, return fallback
          console.log('All OpenAI attempts failed, using fallback analysis')
          
          const fallbackAnalysis = createFallbackAnalysis(technician, allTechnicians)
          
          return res.status(200).json({
            success: true,
            analysis: fallbackAnalysis,
            ai_model: 'fallback-template',
            timestamp: new Date().toISOString(),
            warning: 'AI-tjänsten var otillgänglig, fallback-analys användes'
          })
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempts * 2000))
      }
    }

    const aiResponse = completion?.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('Tom respons från OpenAI')
    }

    // Parse AI respons med förbättrad error handling
    let analysis
    try {
      // Remove any potential markdown code blocks
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      analysis = JSON.parse(cleanedResponse)
      
      // Validera att alla required fields finns
      if (!analysis.summary || !analysis.strengths || !analysis.next_steps) {
        throw new Error('AI response missing required fields')
      }
      
    } catch (parseError: any) {
      console.error('JSON Parse Error:', parseError.message)
      console.log('Raw AI Response:', aiResponse)
      
      // Fallback till template om parsing misslyckas
      analysis = createFallbackAnalysis(technician, allTechnicians)
      analysis.summary = `AI-parsning misslyckades för ${technician.name}. Template-analys användes baserat på ranking #${technician.rank} och prestanda-data.`
    }

    // Lägg till metadata
    analysis.metadata = {
      generated_at: new Date().toISOString(),
      technician_name: technician.name,
      analysis_version: '1.0',
      data_points_analyzed: Object.keys(analysisContext).length
    }

    return res.status(200).json({
      success: true,
      analysis,
      ai_model: 'gpt-4o',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('AI Analysis Error:', error)
    
    // Försök skapa fallback analys även vid kritiska fel
    try {
      const { technician, allTechnicians } = req.body
      
      if (technician && allTechnicians) {
        const fallbackAnalysis = createFallbackAnalysis(technician, allTechnicians)
        
        return res.status(200).json({
          success: true,
          analysis: fallbackAnalysis,
          ai_model: 'emergency-fallback',
          timestamp: new Date().toISOString(),
          warning: `AI-tjänsten otillgänglig (${error.message}). Emergency fallback användes.`
        })
      }
    } catch (fallbackError: any) {
      console.error('Fallback creation failed:', fallbackError)
    }
    
    return res.status(500).json({
      error: 'AI-analys misslyckades helt',
      details: error.message,
      fallback_message: 'Manuell analys rekommenderas för denna tekniker'
    })
  }
}

// Helper function för fallback analys
function createFallbackAnalysis(technician: any, allTechnicians: any[]) {
  const teamAvgRevenue = allTechnicians.reduce((sum, t) => sum + t.total_revenue, 0) / allTechnicians.length
  const teamAvgCases = allTechnicians.reduce((sum, t) => sum + t.total_cases, 0) / allTechnicians.length
  const isTopPerformer = technician.rank <= 3
  const isAboveAverage = technician.total_revenue > teamAvgRevenue
  const percentile = ((allTechnicians.length - technician.rank + 1) / allTechnicians.length * 100).toFixed(0)

  return {
    summary: `${technician.name} presterar i topp ${percentile}% av teamet med ranking #${technician.rank} av ${allTechnicians.length} tekniker. ${isAboveAverage ? 'Över genomsnittlig intäkt indikerar stark prestanda.' : 'Finns potential för förbättring mot teamgenomsnittet.'} ${isTopPerformer ? 'Som topprestare är hen idealisk för mentorskap-roller.' : 'Kan dra nytta av coaching och målsättning.'}`,
    
    strengths: [
      {
        area: isTopPerformer ? "Elite prestanda" : isAboveAverage ? "Över genomsnitt" : "Stabil grund",
        description: `${isTopPerformer ? `Toppranking #${technician.rank} visar exceptionell prestanda` : isAboveAverage ? `Presterar ${((technician.total_revenue / teamAvgRevenue) * 100).toFixed(0)}% av teamgenomsnittet` : `Solid bas med ${technician.total_cases} genomförda ärenden`}`,
        evidence: `${technician.total_revenue.toLocaleString('sv-SE')} kr total intäkt från ${technician.total_cases} ärenden`
      },
      ...(technician.avg_case_value > (teamAvgRevenue / teamAvgCases) ? [{
        area: "Premium prissättning",
        description: `Högre ärendepris än teamgenomsnittet indikerar kvalitetsarbete eller specialisering`,
        evidence: `${technician.avg_case_value.toLocaleString('sv-SE')} kr/ärende vs team-genomsnitt ${Math.round(teamAvgRevenue / teamAvgCases).toLocaleString('sv-SE')} kr`
      }] : []),
      ...(isTopPerformer ? [{
        area: "Naturlig ledarroll",
        description: "Position som topprestare gör hen lämplig för mentorskap och kunskapsdelning",
        evidence: `Ranking #${technician.rank} placerar hen i elitgruppen`
      }] : [])
    ],

    development_areas: isTopPerformer ? [
      {
        area: "Mentorskap utveckling",
        description: "Utveckla förmågan att coacha och utbilda andra tekniker",
        impact: "Kan höja hela teamets prestanda och skapa succession planning"
      }
    ] : [
      {
        area: isAboveAverage ? "Konsistensförbättring" : "Prestationsökning",
        description: isAboveAverage ? 
          "Fokus på att bibehålla nuvarande nivå och minimera variation" : 
          "Systematisk förbättring för att närma sig topprestatorernas nivå",
        impact: isAboveAverage ? 
          "Stabilare resultat över tid" : 
          "Potential att öka intäkt med 20-40% baserat på team-gap"
      }
    ],

    next_steps: [
      {
        action: isTopPerformer ? 
          "Starta mentorskap-program: Ta ansvar för 1-2 utvecklande tekniker" :
          isAboveAverage ?
          "Prestanda-analys: Identifiera vad som driver bästa månader" :
          "Kompetensutveckling: Delta i träning för ärendehantering och prissättning",
        timeline: "30 dagar",
        priority: isTopPerformer ? "medium" : "high",
        expected_outcome: isTopPerformer ?
          "Förbättrad teamprestanda och ledarskapsförmåga" :
          "15-25% förbättring i prestanda-KPIs"
      },
      {
        action: "Månatlig 1-on-1 med chef för målsättning och feedback",
        timeline: "Återkommande",
        priority: "medium",
        expected_outcome: "Kontinuerlig utveckling och karriärplanering"
      },
      {
        action: isTopPerformer ?
          "Dokumentera best practices för teamutbildning" :
          "Benchmarking: Lär av topprestatorernas metoder",
        timeline: "3 månader",
        priority: "low",
        expected_outcome: isTopPerformer ?
          "Strukturerad kunskapsöverföring" :
          "Förbättrade arbetsmetoder och resultat"
      }
    ],

    mentorship_recommendations: {
      should_mentor: isTopPerformer,
      mentoring_areas: isTopPerformer ? [
        "Ärendehantering och prioritering",
        "Kundkommunikation och prissättning",
        "Kvalitetssäkring och rapportering"
      ] : [],
      needs_mentoring: !isTopPerformer,
      learning_focus: !isTopPerformer ? [
        "Effektiv ärendehantering",
        "Prissättningsstrategier",
        "Kundrelationer och merförsäljning",
        "Tidsplanering och prioritering"
      ] : []
    },

    performance_predictions: {
      next_quarter_outlook: isTopPerformer ? 
        "Stabil på hög nivå" : 
        isAboveAverage ? 
        "Positiv utveckling förväntad" : 
        "Förbättringspotential med rätt stöd",
      growth_potential: isTopPerformer ? 
        "Mentorskap-fokus" : 
        isAboveAverage ? 
        "Medium till hög" : 
        "Hög med strukturerat stöd",
      key_risk_factors: isTopPerformer ? [
        "Risk för mentorskap-utbrändhet",
        "Behöver nya utmaningar för motivation"
      ] : isAboveAverage ? [
        "Konsistens i leverans",
        "Undvika självbelåtenhet"
      ] : [
        "Behöver kontinuerlig coaching",
        "Risk för motivationsförlust utan tydliga mål"
      ]
    },

    metadata: {
      generated_at: new Date().toISOString(),
      technician_name: technician.name,
      analysis_version: "fallback-2.0",
      data_points_analyzed: 8
    }
  }
}