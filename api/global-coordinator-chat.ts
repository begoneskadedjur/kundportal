// api/global-coordinator-chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_MESSAGE = `🚨 KRITISKT: Du är en AI-assistent som ENDAST får svara baserat på FAKTISK DATA från databasen. HITTA PÅ ALDRIG siffror, tider eller priser!

📊 **DATA-ANVÄNDNING:**
Du har tillgång till REALTIDSDATA från BeGone-systemet. När du svarar måste du:
- ENDAST använda faktiska siffror från databasen
- ALDRIG gissa eller hitta på priser, tider eller schema
- ALLTID kontrollera faktisk tekniker-tillgänglighet 
- BARA föreslå tider baserat på verkliga schema-luckor
- ENDAST ge priser baserat på faktiska tidigare ärenden

🎯 **SPECIALOMRÅDEN:**

**1. SCHEMALÄGGNING:**
- Kontrollera FAKTISKA arbetstider för tekniker
- Hitta VERKLIGA schema-luckor i databasen
- Föreslå tider baserat på BEFINTLIGA bokningar
- FRÅGA om ärendets längd innan du föreslår tider

**2. TEKNIKER-MATCHNING:**
- Använd FAKTISKA specialiseringar från databasen
- Kontrollera VERKLIG tillgänglighet
- Basera på FAKTISK arbetsbelastning

**3. PRISSÄTTNING:**
- ENDAST använda priser från FAKTISKA liknande ärenden
- Beräkna genomsnitt från VERKLIGA case-data
- ALDRIG hitta på generiska priser

🚨 **ABSOLUTA REGLER:**
1. Har du INTE tillgång till specifik data → säg "Jag behöver kontrollera systemet för exakt data"
2. Kan du INTE hitta liknande ärenden → säg "Inga liknande ärenden i databasen"
3. Saknas schema-data → säg "Behöver mer information om teknikerns schema"
4. Osäker på prissättning → säg "Kontrollera med tidigare ärenden av samma typ"

📝 **SVAR-KRAV:**
- Börja med: "Baserat på systemdata..."
- Visa EXAKTA siffror från databasen
- Förklara vilken data du använt
- Ge konkreta nästa steg

VIKTIGT: Om du inte har exakt data för att svara korrekt - säg det istället för att gissa!`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, coordinatorData, currentPage, contextData, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Meddelande krävs' 
      });
    }

    // Identifiera kontext baserat på meddelandet
    const context = identifyContext(message);

    // Förbered relevant data baserat på kontext
    const relevantData = prepareRelevantData(coordinatorData, context, message);

    // Förbered konversationshistorik
    const messages: any[] = [
      { role: 'system', content: SYSTEM_MESSAGE },
      { 
        role: 'system', 
        content: `AKTUELL KONTEXT:
Sida: ${currentPage}
Tidpunkt: ${new Date().toLocaleString('sv-SE')}
Kontext: ${context}

RELEVANT DATA FÖR DENNA FÖRFRÅGAN:
${JSON.stringify(relevantData, null, 2)}

Basera ditt svar på denna specifika data och ge konkreta, handlingsbara råd.`
      }
    ];

    // Lägg till konversationshistorik (senaste 8 meddelanden)
    const recentHistory = conversationHistory.slice(-8);
    recentHistory.forEach((msg: any) => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    // Lägg till användarens nya meddelande
    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 800
    });

    const response = completion.choices[0].message.content;

    return res.status(200).json({
      success: true,
      response,
      context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Global Coordinator Chat Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    const statusCode = errorMessage.includes('API key') ? 401 : 500;
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      response: 'Tyvärr kunde jag inte bearbeta din förfrågan just nu. Försök igen senare.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Identifierar kontext baserat på användarens meddelande
 */
function identifyContext(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Specifik schemaläggning (inkluderar teknikernamn + tid/schema-relaterat)
  if ((lowerMessage.includes('schema') || lowerMessage.includes('tid') || lowerMessage.includes('ledig') || 
       lowerMessage.includes('lucka') || lowerMessage.includes('boka')) || 
      (lowerMessage.includes('måndag') || lowerMessage.includes('tisdag') || lowerMessage.includes('onsdag') ||
       lowerMessage.includes('torsdag') || lowerMessage.includes('fredag'))) {
    return 'schedule';
  }
  
  if (lowerMessage.includes('tekniker') || lowerMessage.includes('vem') || lowerMessage.includes('bäst på') || lowerMessage.includes('specialist')) {
    return 'technician';
  }
  
  if (lowerMessage.includes('pris') || lowerMessage.includes('kosta') || lowerMessage.includes('offert') || lowerMessage.includes('prissätt') ||
      lowerMessage.includes('betalt') || lowerMessage.includes('ta betalt')) {
    return 'pricing';
  }
  
  if (lowerMessage.includes('analys') || lowerMessage.includes('prestanda') || lowerMessage.includes('statistik') || lowerMessage.includes('trend')) {
    return 'analytics';
  }
  
  if (lowerMessage.includes('rutt') || lowerMessage.includes('karta') || lowerMessage.includes('avstånd') || lowerMessage.includes('geografisk')) {
    return 'routing';
  }
  
  return 'general';
}

/**
 * Förbereder relevant data baserat på kontext
 */
function prepareRelevantData(coordinatorData: any, context: string, message: string) {
  if (!coordinatorData) {
    return { error: 'Ingen koordinatordata tillgänglig' };
  }

  const baseData = {
    context,
    current_time: new Date().toISOString(),
    message_keywords: extractKeywords(message)
  };

  switch (context) {
    case 'schedule':
      // Sök efter specifik tekniker i meddelandet
      const targetTechnician = findTechnicianInMessage(message, coordinatorData.technicians || []);
      const targetGaps = targetTechnician ? 
        coordinatorData.schedule?.schedule_gaps?.filter((gap: any) => gap.technician_id === targetTechnician.id) : 
        coordinatorData.schedule?.schedule_gaps || [];
      const targetCases = targetTechnician ?
        coordinatorData.schedule?.upcoming_cases?.filter((c: any) => c.primary_assignee_id === targetTechnician.id) :
        coordinatorData.schedule?.upcoming_cases?.slice(0, 20) || [];
        
      return {
        ...baseData,
        target_technician: targetTechnician,
        schedule_gaps: targetGaps,
        technician_availability: coordinatorData.schedule?.technician_availability || [],
        upcoming_cases: targetCases,
        specific_technician_schedule: targetTechnician ? {
          name: targetTechnician.name,
          work_schedule: targetTechnician.work_schedule,
          upcoming_cases: targetCases,
          available_gaps: targetGaps,
          current_utilization: coordinatorData.schedule?.technician_availability?.find((ta: any) => ta.technician_id === targetTechnician.id)?.utilization_percent || 0
        } : null,
        all_technicians: coordinatorData.technicians?.map((t: any) => ({
          id: t.id,
          name: t.name,
          work_schedule: t.work_schedule,
          specializations: t.specializations || [],
          current_utilization: coordinatorData.schedule?.technician_availability?.find((ta: any) => ta.technician_id === t.id)?.utilization_percent || 0
        })) || [],
        current_week_summary: {
          total_technicians: coordinatorData.technicians?.length || 0,
          available_gaps: coordinatorData.schedule?.schedule_gaps?.length || 0,
          upcoming_cases_count: coordinatorData.schedule?.upcoming_cases?.length || 0,
          target_technician_gaps: targetGaps.length
        }
      };

    case 'technician':
      return {
        ...baseData,
        technicians: coordinatorData.technicians?.map((t: any) => ({
          id: t.id,
          name: t.name,
          specializations: t.specializations || [],
          work_areas: t.work_areas || [],
          role: t.role,
          is_active: t.is_active
        })) || [],
        technician_availability: coordinatorData.schedule?.technician_availability || [],
        recent_cases: [
          ...coordinatorData.cases?.private_cases?.slice(0, 10) || [],
          ...coordinatorData.cases?.business_cases?.slice(0, 10) || []
        ]
      };

    case 'pricing':
      const recentCases = coordinatorData.pricing?.recent_cases_with_prices || [];
      const pricingAnalysis = analyzePricingForMessage(recentCases, message);
      
      return {
        ...baseData,
        pricing_patterns: coordinatorData.pricing?.pricing_patterns || [],
        recent_cases_with_prices: recentCases.slice(0, 10),
        similar_cases: findSimilarCases(recentCases, message),
        pricing_analysis: pricingAnalysis,
        case_type_prices: getCaseTypePrices(recentCases),
        statistical_summary: {
          total_cases_with_prices: recentCases.length,
          avg_price_last_month: recentCases.length > 0 ? 
            Math.round(recentCases.reduce((sum: number, c: any) => sum + (c.pris || 0), 0) / recentCases.length) : 0,
          price_range: recentCases.length > 0 ? {
            min: Math.min(...recentCases.map((c: any) => c.pris || 0).filter((p: number) => p > 0)),
            max: Math.max(...recentCases.map((c: any) => c.pris || 0))
          } : null
        }
      };

    case 'analytics':
      return {
        ...baseData,
        performance_metrics: coordinatorData.analytics?.performance_metrics || {},
        utilization_data: coordinatorData.analytics?.utilization_data || [],
        all_cases_summary: {
          total_private: coordinatorData.cases?.private_cases?.length || 0,
          total_business: coordinatorData.cases?.business_cases?.length || 0,
          total_legacy: coordinatorData.cases?.legacy_cases?.length || 0
        },
        technician_summary: coordinatorData.technicians?.length || 0
      };

    case 'routing':
      return {
        ...baseData,
        upcoming_cases: coordinatorData.schedule?.upcoming_cases || [],
        technicians: coordinatorData.technicians?.map((t: any) => ({
          id: t.id,
          name: t.name,
          work_areas: t.work_areas
        })) || [],
        geographic_optimization: coordinatorData.analytics?.geographic_optimization || {}
      };

    default:
      return {
        ...baseData,
        summary: {
          total_cases: (coordinatorData.cases?.private_cases?.length || 0) + 
                     (coordinatorData.cases?.business_cases?.length || 0),
          total_technicians: coordinatorData.technicians?.length || 0,
          upcoming_cases_count: coordinatorData.schedule?.upcoming_cases?.length || 0,
          schedule_gaps_count: coordinatorData.schedule?.schedule_gaps?.length || 0
        }
      };
  }
}

/**
 * Extraherar nyckelord från meddelandet
 */
function extractKeywords(message: string): string[] {
  const keywords = [];
  const lowerMessage = message.toLowerCase();
  
  // Skadedjurstyper
  const pestTypes = ['råtta', 'mus', 'myra', 'kackerlack', 'vägglus', 'getingar', 'fågel', 'spindel'];
  pestTypes.forEach(pest => {
    if (lowerMessage.includes(pest)) keywords.push(pest);
  });
  
  // Tidsrelaterade ord
  const timeWords = ['idag', 'imorgon', 'vecka', 'månad', 'akut', 'snabbt'];
  timeWords.forEach(word => {
    if (lowerMessage.includes(word)) keywords.push(word);
  });
  
  // Områden
  const areas = ['stockholm', 'göteborg', 'malmö', 'uppsala', 'västerås', 'örebro'];
  areas.forEach(area => {
    if (lowerMessage.includes(area)) keywords.push(area);
  });
  
  return keywords;
}

/**
 * Hittar liknande ärenden baserat på meddelandet
 */
function findSimilarCases(cases: any[], message: string) {
  const keywords = extractKeywords(message);
  
  if (keywords.length === 0) return cases.slice(0, 5);
  
  return cases.filter(caseItem => {
    const caseText = `${caseItem.title || ''} ${caseItem.description || ''}`.toLowerCase();
    return keywords.some(keyword => caseText.includes(keyword));
  }).slice(0, 5);
}

/**
 * Analyserar prissättning baserat på meddelandet
 */
function analyzePricingForMessage(cases: any[], message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Identifiera ärendetyp från meddelandet
  let caseType = '';
  if (lowerMessage.includes('råtta') || lowerMessage.includes('mus')) caseType = 'gnagare';
  else if (lowerMessage.includes('myra')) caseType = 'myror';
  else if (lowerMessage.includes('vägglus')) caseType = 'vägglöss';
  else if (lowerMessage.includes('kackerlack')) caseType = 'kackerlackor';
  else if (lowerMessage.includes('getingar')) caseType = 'getingar';
  
  const relevantCases = cases.filter(c => {
    if (!caseType) return true;
    const caseText = `${c.title || ''} ${c.description || ''}`.toLowerCase();
    return caseText.includes(caseType);
  });
  
  if (relevantCases.length === 0) {
    return {
      case_type: caseType || 'allmänt',
      found_cases: 0,
      message: 'Inga liknande ärenden hittades i databasen'
    };
  }
  
  const prices = relevantCases.map(c => c.pris).filter(p => p > 0);
  
  return {
    case_type: caseType || 'allmänt',
    found_cases: relevantCases.length,
    cases_with_prices: prices.length,
    avg_price: prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : null,
    min_price: prices.length > 0 ? Math.min(...prices) : null,
    max_price: prices.length > 0 ? Math.max(...prices) : null,
    recent_examples: relevantCases.slice(0, 3).map(c => ({
      title: c.title,
      price: c.pris,
      created_at: c.created_at
    }))
  };
}

/**
 * Grupperar priser per ärendetyp
 */
function getCaseTypePrices(cases: any[]) {
  const types = {
    'gnagare': [],
    'myror': [],
    'vägglöss': [],
    'kackerlackor': [],
    'getingar': [],
    'övriga': []
  } as Record<string, any[]>;
  
  for (const caseItem of cases) {
    const text = `${caseItem.title || ''} ${caseItem.description || ''}`.toLowerCase();
    let type = 'övriga';
    
    if (text.includes('råtta') || text.includes('mus')) type = 'gnagare';
    else if (text.includes('myra')) type = 'myror';
    else if (text.includes('vägglus')) type = 'vägglöss';
    else if (text.includes('kackerlack')) type = 'kackerlackor';
    else if (text.includes('getingar')) type = 'getingar';
    
    if (caseItem.pris > 0) {
      types[type].push(caseItem.pris);
    }
  }
  
  const result: Record<string, any> = {};
  
  for (const [type, prices] of Object.entries(types)) {
    if (prices.length > 0) {
      result[type] = {
        count: prices.length,
        avg: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        min: Math.min(...prices),
        max: Math.max(...prices)
      };
    }
  }
  
  return result;
}

/**
 * Hittar specifik tekniker i meddelandet
 */
function findTechnicianInMessage(message: string, technicians: any[]) {
  const lowerMessage = message.toLowerCase();
  
  for (const tech of technicians) {
    const techName = tech.name.toLowerCase();
    // Sök efter första namnet eller hela namnet
    const firstName = techName.split(' ')[0];
    
    if (lowerMessage.includes(techName) || lowerMessage.includes(firstName)) {
      return tech;
    }
  }
  
  return null;
}