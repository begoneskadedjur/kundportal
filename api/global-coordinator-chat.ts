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

**1. INTELLIGENT SCHEMALÄGGNING & RUTTOPTIMERING:**
- Kontrollera FAKTISKA arbetstider för tekniker
- Hitta VERKLIGA schema-luckor i databasen
- Föreslå tider baserat på BEFINTLIGA bokningar
- **GEOGRAFISK OPTIMERING**: Analysera adresser för att minimera restid
- **SAMMA GATA/OMRÅDE**: Föreslå konsekutiva bokningar på samma gata/närområde
- **RUTTLOGIK**: Boka ärenden i geografisk sekvens (t.ex. Kyles väg 9 → Kyles väg 10)
- FRÅGA om ärendets längd innan du föreslår tider

**2. TEKNIKER-MATCHNING:**
- Använd FAKTISKA specialiseringar från databasen
- Kontrollera VERKLIG tillgänglighet
- Basera på FAKTISK arbetsbelastning
- **GEOGRAFISK NÄRHET**: Matcha tekniker baserat på befintliga bokningar i området

**3. INTELLIGENT PRISSÄTTNING:**
- ENDAST använda priser från FAKTISKA liknande ärenden
- Beräkna genomsnitt från VERKLIGA case-data
- ALDRIG hitta på generiska priser
- **GENOMSNITTSFRÅGOR**: När användaren frågar "genomsnittspris för råttärenden" → analysera ALLA råttärenden med priser
- **SPECIFIKA FRÅGOR**: När användaren beskriver specifikt jobb → hitta mest liknande ärenden
- **VISA ALLTID**: Antal ärenden som analysen baseras på

🗺️ **GEOGRAFISK INTELLIGENS:**
När du föreslår schemaläggning, analysera ALLTID:
1. Befintliga bokningar för teknikern samma dag
2. Adresser för geografisk närhet (samma gata = perfekt!)
3. Optimala tidssekvenser (efter befintligt ärende på samma gata)
4. Restidsminimering mellan ärenden

**EXEMPEL:** Om tekniker har ärende på "Kyles väg 9" kl 08-10, och ny fråga gäller "Kyles väg 10" → föreslå DIREKT efter kl 10:00 för optimal rutt!

🚨 **ABSOLUTA REGLER:**
1. Har du INTE tillgång till specifik data → säg "Jag behöver kontrollera systemet för exakt data"
2. Kan du INTE hitta liknande ärenden → säg "Inga liknande ärenden i databasen"
3. Saknas schema-data → säg "Behöver mer information om teknikerns schema"
4. Osäker på prissättning → säg "Kontrollera med tidigare ärenden av samma typ"

📝 **SVAR-KRAV:**
- Börja med: "Baserat på systemdata och geografisk analys..."
- Visa EXAKTA siffror från databasen
- Förklara geografiska fördelar i förslaget
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

    // Begränsa datastorlek för att undvika API-gränser
    const relevantDataString = JSON.stringify(relevantData, null, 2);
    const truncatedData = relevantDataString.length > 8000 
      ? relevantDataString.slice(0, 8000) + '\n...(data truncated due to size)'
      : relevantDataString;

    // TEMPORARY: Log vad som skickas till AI för debugging
    if (context === 'pricing') {
      console.log('📤 Data being sent to AI for pricing:');
      console.log(`- Original data length: ${relevantDataString.length} chars`);
      console.log(`- Truncated data length: ${truncatedData.length} chars`);
      console.log(`- Data was truncated: ${relevantDataString.length > 8000}`);
      console.log(`- Sample of data being sent:`, JSON.stringify(relevantData, null, 2).slice(0, 500) + '...');
    }

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
${truncatedData}

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
    
    // Mer detaljerad felhantering
    let errorMessage = 'Okänt fel';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Specifik felhantering för olika fel
      if (errorMessage.includes('API key')) {
        statusCode = 401;
      } else if (errorMessage.includes('JSON')) {
        statusCode = 400;
        errorMessage = 'Fel vid databehandling';
      } else if (errorMessage.includes('timeout')) {
        statusCode = 408;
        errorMessage = 'Timeout - för stor datamängd';
      }
    }
    
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
  
  // FÖRBÄTTRAD PRICING-DETECTION - inkluderar fler nyckelord
  if (lowerMessage.includes('pris') || lowerMessage.includes('kosta') || lowerMessage.includes('offert') || lowerMessage.includes('prissätt') ||
      lowerMessage.includes('betalt') || lowerMessage.includes('ta betalt') || lowerMessage.includes('debitera') || 
      lowerMessage.includes('genomsnitt') || lowerMessage.includes('snitt') || lowerMessage.includes('faktura') ||
      lowerMessage.includes('avgift') || lowerMessage.includes('timkostnad') || lowerMessage.includes('kostnad') ||
      (lowerMessage.includes('vad') && (lowerMessage.includes('rått') || lowerMessage.includes('myra') || 
       lowerMessage.includes('vägglus') || lowerMessage.includes('fågel') || lowerMessage.includes('getingar'))) ||
      (lowerMessage.includes('hur mycket') && lowerMessage.includes('ärenden'))) {
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
      const targetAddress = extractAddressFromMessage(message);
      const allUpcomingCases = coordinatorData.schedule?.upcoming_cases || [];
      
      // Analysera geografisk optimering
      const geographicAnalysis = analyzeGeographicOptimization(
        targetTechnician, 
        targetAddress, 
        allUpcomingCases, 
        message
      );
      
      const targetGaps = targetTechnician ? 
        coordinatorData.schedule?.schedule_gaps?.filter((gap: any) => gap.technician_id === targetTechnician.id) : 
        coordinatorData.schedule?.schedule_gaps || [];
      const targetCases = targetTechnician ?
        allUpcomingCases.filter((c: any) => c.primary_assignee_id === targetTechnician.id) :
        allUpcomingCases.slice(0, 20);
        
      return {
        ...baseData,
        target_technician: targetTechnician,
        target_address: targetAddress,
        geographic_analysis: geographicAnalysis,
        schedule_gaps: targetGaps,
        technician_availability: coordinatorData.schedule?.technician_availability || [],
        upcoming_cases: targetCases,
        specific_technician_schedule: targetTechnician ? {
          name: targetTechnician.name,
          work_schedule: targetTechnician.work_schedule,
          upcoming_cases: targetCases,
          available_gaps: targetGaps,
          current_utilization: coordinatorData.schedule?.technician_availability?.find((ta: any) => ta.technician_id === targetTechnician.id)?.utilization_percent || 0,
          same_day_cases: targetCases.filter((c: any) => {
            const requestDate = extractDateFromMessage(message);
            return requestDate && c.start_date?.startsWith(requestDate);
          })
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
          target_technician_gaps: targetGaps.length,
          geographic_opportunities: geographicAnalysis.opportunities?.length || 0
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
      const optimizedPestData = coordinatorData.pricing?.optimized_by_pest_type || {};
      
      // Identifiera skadedjurstyp från meddelandet
      const requestedPestType = identifyPestTypeFromMessage(message);
      const pestSpecificData = requestedPestType ? optimizedPestData[requestedPestType] : null;
      
      // TEMPORARY: Debug logging för prissättning (också i produktion för debugging)
      console.log('🔍 Pricing Query Analysis:');
      console.log(`- Message: "${message}"`);
      console.log(`- Detected pest type: ${requestedPestType || 'None'}`);
      console.log(`- Available pest types in data:`, Object.keys(optimizedPestData));
      console.log(`- Pest-specific data found: ${!!pestSpecificData}`);
      if (pestSpecificData) {
        console.log(`- Cases for ${requestedPestType}: ${pestSpecificData.case_count}`);
        console.log(`- Price stats: avg ${pestSpecificData.price_statistics?.avg_price}, range ${pestSpecificData.price_statistics?.min_price}-${pestSpecificData.price_statistics?.max_price}`);
      }
      console.log(`- Total recent cases: ${recentCases.length}`);
      console.log(`- Optimized pest data keys: ${Object.keys(optimizedPestData).join(', ')}`);
      
      // Extra debugging för att se vad som skickas till AI
      console.log(`- Relevant cases being sent to AI: ${(pestSpecificData ? pestSpecificData.recent_cases : recentCases.slice(0, 75)).length}`);
      console.log(`- Sample of relevant cases:`, (pestSpecificData ? pestSpecificData.recent_cases : recentCases.slice(0, 75)).slice(0, 3).map(c => ({id: c.id, pris: c.pris, skadedjur: c.skadedjur})));
      
      // Använd skadedjurs-specifik data om tillgänglig, annars generell analys
      const relevantCases = pestSpecificData ? 
        pestSpecificData.recent_cases : 
        recentCases.slice(0, 75); // Begränsa om ingen specifik typ (mer för bättre variation)
      
      const pricingAnalysis = analyzePricingForMessage(relevantCases, message);
      
      return {
        ...baseData,
        requested_pest_type: requestedPestType,
        pest_specific_data: pestSpecificData,
        pricing_patterns: coordinatorData.pricing?.pricing_patterns || [],
        optimized_pest_data: optimizedPestData,
        relevant_cases: relevantCases,
        similar_cases: findSimilarCases(relevantCases, message),
        pricing_analysis: pricingAnalysis,
        case_type_prices: getCaseTypePrices(relevantCases),
        efficiency_note: pestSpecificData ? 
          `Analyserade ${pestSpecificData.case_count} ${requestedPestType}-ärenden för exakt prissättning` :
          `Analyserade ${relevantCases.length} generella ärenden - specificera skadedjurstyp för bättre precision`,
        statistical_summary: pestSpecificData ? {
          total_cases_with_prices: pestSpecificData.case_count,
          avg_price: pestSpecificData.price_statistics.avg_price,
          median_price: pestSpecificData.price_statistics.median_price,
          price_range: {
            min: pestSpecificData.price_statistics.min_price,
            max: pestSpecificData.price_statistics.max_price
          },
          complexity_distribution: pestSpecificData.complexity_distribution,
          technician_requirements: pestSpecificData.technician_requirements,
          duration_patterns: pestSpecificData.duration_patterns
        } : {
          total_cases_with_prices: relevantCases.length,
          avg_price_last_month: relevantCases.length > 0 ? 
            Math.round(relevantCases.reduce((sum: number, c: any) => sum + (c.pris || 0), 0) / relevantCases.length) : 0,
          price_range: relevantCases.length > 0 ? {
            min: Math.min(...relevantCases.map((c: any) => c.pris || 0).filter((p: number) => p > 0)),
            max: Math.max(...relevantCases.map((c: any) => c.pris || 0))
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
 * Avancerad prissättningsanalys baserat på meddelandet
 */
function analyzePricingForMessage(cases: any[], message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Identifiera skadedjurstyp från meddelandet
  let pestType = '';
  if (lowerMessage.includes('råtta') || lowerMessage.includes('mus')) pestType = 'gnagare';
  else if (lowerMessage.includes('myra')) pestType = 'myror';
  else if (lowerMessage.includes('vägglus') || lowerMessage.includes('vägglöss')) pestType = 'Vägglöss';
  else if (lowerMessage.includes('kackerlack')) pestType = 'kackerlackor';
  else if (lowerMessage.includes('getingar')) pestType = 'getingar';
  else if (lowerMessage.includes('fågelsäkring') || lowerMessage.includes('fågel')) pestType = 'fågelsäkring';
  
  // Extrahera storleksinformation från meddelandet
  const sizeInfo = extractSizeFromMessage(message);
  const complexityInfo = extractComplexityFromMessage(message);
  
  // Filtrera relevanta ärenden och exkludera framtida/ofullständiga ärenden
  const relevantCases = cases.filter(c => {
    // Exkludera ärenden utan pris
    if (!c.pris || c.pris <= 0) return false;
    
    // Exkludera ärenden i framtiden (endast om start_date finns och är i framtiden)
    if (c.start_date) {
      const caseDate = new Date(c.start_date);
      const now = new Date();
      if (caseDate > now) return false;
    }
    
    if (!pestType) return true;
    
    // Prioritera skadedjur-kolumnen
    if (c.skadedjur) {
      return c.skadedjur.toLowerCase().includes(pestType);
    }
    
    // Fallback till textanalys
    const caseText = `${c.title || ''} ${c.description || ''}`.toLowerCase();
    return caseText.includes(pestType);
  });
  
  if (relevantCases.length === 0) {
    return {
      pest_type: pestType || 'allmänt',
      found_cases: 0,
      message: `Inga ${pestType ? pestType + '-' : ''}ärenden med priser hittades i databasen`
    };
  }
  
  // Avancerad analys av alla faktorer
  const casesWithPrices = relevantCases.filter(c => c.pris > 0);
  const prices = casesWithPrices.map(c => c.pris);
  
  // Analysera tekniker-påverkan
  const technicianAnalysis = analyzeTechnicianCountPricing(casesWithPrices);
  
  // Analysera komplexitets-påverkan
  const complexityAnalysis = analyzeComplexityPricing(casesWithPrices);
  
  // Analysera duration-påverkan
  const durationAnalysis = analyzeDurationPricing(casesWithPrices);
  
  // Hitta mest liknande ärenden baserat på alla faktorer
  const similarCases = findMostSimilarCases(casesWithPrices, {
    pestType,
    sizeInfo,
    complexityInfo,
    message
  });
  
  return {
    pest_type: pestType || 'allmänt',
    found_cases: relevantCases.length,
    cases_with_prices: casesWithPrices.length,
    price_statistics: {
      avg_price: prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : null,
      median_price: prices.length > 0 ? calculateMedianPrice(prices) : null,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      max_price: prices.length > 0 ? Math.max(...prices) : null,
      price_range: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0
    },
    technician_impact: technicianAnalysis,
    complexity_impact: complexityAnalysis,
    duration_impact: durationAnalysis,
    most_similar_cases: similarCases,
    pricing_factors: {
      size_mentioned: sizeInfo.size || 'ej angiven',
      complexity_level: complexityInfo.level || 'standard',
      special_circumstances: extractSpecialCircumstances(message)
    },
    pricing_recommendation: generatePricingRecommendation(casesWithPrices, {
      pestType,
      sizeInfo,
      complexityInfo
    })
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
    else if (text.includes('vägglus') || text.includes('vägglöss')) type = 'vägglöss';
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

/**
 * Extraherar adress från meddelandet
 */
function extractAddressFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Sök efter adressmönster
  const addressPatterns = [
    /([a-zåäö\s]+väg\s*\d+)/gi,
    /([a-zåäö\s]+gata\s*\d+)/gi,
    /([a-zåäö\s]+plan\s*\d+)/gi,
    /([a-zåäö\s]+strand\s*\d+)/gi,
    /([a-zåäö\s]+torg\s*\d+)/gi,
    /(sollentuna|stockholm|göteborg|malmö|uppsala|västerås|örebro)/gi
  ];
  
  for (const pattern of addressPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Extraherar datum från meddelandet
 */
function extractDateFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  const today = new Date();
  
  if (lowerMessage.includes('måndag')) {
    const nextMonday = getNextWeekday(today, 1);
    return nextMonday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('tisdag')) {
    const nextTuesday = getNextWeekday(today, 2);
    return nextTuesday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('onsdag')) {
    const nextWednesday = getNextWeekday(today, 3);
    return nextWednesday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('torsdag')) {
    const nextThursday = getNextWeekday(today, 4);
    return nextThursday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('fredag')) {
    const nextFriday = getNextWeekday(today, 5);
    return nextFriday.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Hittar nästa veckodag
 */
function getNextWeekday(date: Date, targetDay: number) {
  const result = new Date(date);
  const currentDay = result.getDay();
  const daysUntilTarget = targetDay - currentDay;
  
  if (daysUntilTarget <= 0) {
    result.setDate(result.getDate() + 7 + daysUntilTarget);
  } else {
    result.setDate(result.getDate() + daysUntilTarget);
  }
  
  return result;
}

/**
 * Analyserar geografisk optimering för schemaläggning
 */
function analyzeGeographicOptimization(technician: any, targetAddress: string | null, upcomingCases: any[], message: string) {
  if (!technician || !targetAddress) {
    return {
      has_analysis: false,
      message: 'Ingen geografisk analys möjlig utan tekniker och adress'
    };
  }
  
  const requestDate = extractDateFromMessage(message);
  if (!requestDate) {
    return {
      has_analysis: false,
      message: 'Kunde inte identifiera datum för geografisk analys'
    };
  }
  
  // Hitta befintliga ärenden för tekniker samma dag
  const sameDayCases = upcomingCases.filter(c => 
    c.primary_assignee_id === technician.id && 
    c.start_date?.startsWith(requestDate) &&
    c.adress
  );
  
  const opportunities = [];
  
  for (const existingCase of sameDayCases) {
    const existingAddress = existingCase.adress?.toString() || '';
    const proximity = calculateAddressProximity(targetAddress, existingAddress);
    
    if (proximity.is_same_street) {
      opportunities.push({
        type: 'same_street',
        existing_case: {
          address: existingAddress,
          start_time: existingCase.start_date,
          end_time: existingCase.due_date,
          title: existingCase.title
        },
        target_address: targetAddress,
        recommendation: `PERFEKT RUTT: Boka direkt efter befintligt ärende (${existingCase.due_date?.slice(11, 16)}) för minimal restid`,
        efficiency_gain: 'Eliminerar restid mellan ärenden på samma gata',
        suggested_start_time: existingCase.due_date
      });
    } else if (proximity.is_nearby) {
      opportunities.push({
        type: 'nearby',
        existing_case: {
          address: existingAddress,
          start_time: existingCase.start_date,
          end_time: existingCase.due_date,
          title: existingCase.title
        },
        target_address: targetAddress,
        recommendation: `BRA RUTT: Boka nära befintligt ärende för kort restid`,
        efficiency_gain: `Kort restid mellan ${existingAddress} och ${targetAddress}`,
        suggested_start_time: existingCase.due_date
      });
    }
  }
  
  return {
    has_analysis: true,
    technician_name: technician.name,
    target_address: targetAddress,
    request_date: requestDate,
    same_day_cases: sameDayCases.length,
    opportunities,
    optimization_summary: opportunities.length > 0 ? 
      `Hittade ${opportunities.length} geografiska optimeringsmöjligheter` :
      'Inga geografiska optimeringsmöjligheter hittades för denna dag'
  };
}

/**
 * Beräknar närhet mellan adresser
 */
function calculateAddressProximity(address1: string, address2: string) {
  const addr1 = address1.toLowerCase().trim();
  const addr2 = address2.toLowerCase().trim();
  
  // Extrahera gatnamn (innan siffror)
  const street1 = addr1.replace(/\d+.*$/, '').trim();
  const street2 = addr2.replace(/\d+.*$/, '').trim();
  
  // Samma gata = perfekt
  if (street1 && street2 && street1 === street2) {
    return {
      is_same_street: true,
      is_nearby: true,
      similarity_score: 1.0,
      reason: 'Samma gata'
    };
  }
  
  // Kontrollera liknande gatnamn
  const similarity = calculateStringSimilarity(street1, street2);
  if (similarity > 0.8) {
    return {
      is_same_street: false,
      is_nearby: true,
      similarity_score: similarity,
      reason: 'Liknande gatnamn'
    };
  }
  
  // Kontrollera samma område/stad
  const areas = ['sollentuna', 'stockholm', 'göteborg', 'malmö', 'uppsala'];
  for (const area of areas) {
    if (addr1.includes(area) && addr2.includes(area)) {
      return {
        is_same_street: false,
        is_nearby: true,
        similarity_score: 0.5,
        reason: `Samma område: ${area}`
      };
    }
  }
  
  return {
    is_same_street: false,
    is_nearby: false,
    similarity_score: 0,
    reason: 'Olika områden'
  };
}

/**
 * Beräknar likhet mellan strängar
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Beräknar Levenshtein-avstånd
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extraherar storleksinformation från meddelandet
 */
function extractSizeFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Sök efter kvadratmeter
  const sqmMatch = message.match(/(\d+)\s*kvm|(\d+)\s*m2|(\d+)\s*kvadratmeter/i);
  if (sqmMatch) {
    const size = parseInt(sqmMatch[1] || sqmMatch[2] || sqmMatch[3]);
    return {
      size: `${size} kvm`,
      area_sqm: size,
      size_category: size < 50 ? 'liten' : size < 100 ? 'medel' : 'stor'
    };
  }
  
  // Sök efter rum/lägenhet storlek
  if (lowerMessage.includes('rum')) {
    const roomMatch = message.match(/(\d+)\s*rum/i);
    if (roomMatch) {
      return { size: `${roomMatch[1]} rum`, size_category: 'lägenhet' };
    }
  }
  
  // Generisk storleksbeskrivning
  if (lowerMessage.includes('liten')) return { size: 'liten', size_category: 'liten' };
  if (lowerMessage.includes('stor')) return { size: 'stor', size_category: 'stor' };
  if (lowerMessage.includes('omfattande')) return { size: 'omfattande', size_category: 'stor' };
  
  return { size: null, size_category: 'okänd' };
}

/**
 * Extraherar komplexitetsinformation från meddelandet
 */
function extractComplexityFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  let score = 0;
  const factors = [];
  
  // Hög komplexitet
  if (lowerMessage.includes('sanering')) { score += 3; factors.push('sanering'); }
  if (lowerMessage.includes('infestation')) { score += 3; factors.push('infestation'); }
  if (lowerMessage.includes('omfattande')) { score += 2; factors.push('omfattande'); }
  if (lowerMessage.includes('problem')) { score += 2; factors.push('problem'); }
  if (lowerMessage.includes('återbesök')) { score += 2; factors.push('återbesök'); }
  
  // Medium komplexitet
  if (lowerMessage.includes('kontroll')) { score += 1; factors.push('kontroll'); }
  if (lowerMessage.includes('förebyggande')) { score += 1; factors.push('förebyggande'); }
  
  let level = 'standard';
  if (score >= 3) level = 'hög';
  else if (score >= 1) level = 'medium';
  else if (lowerMessage.includes('enkel') || lowerMessage.includes('rutinmässig')) level = 'låg';
  
  return {
    level,
    score,
    factors,
    is_complex: score >= 3
  };
}

/**
 * Extraherar speciala omständigheter från meddelandet
 */
function extractSpecialCircumstances(message: string) {
  const lowerMessage = message.toLowerCase();
  const circumstances = [];
  
  if (lowerMessage.includes('akut')) circumstances.push('akut');
  if (lowerMessage.includes('helg')) circumstances.push('helgarbete');
  if (lowerMessage.includes('kväll')) circumstances.push('kvällsarbete');
  if (lowerMessage.includes('natt')) circumstances.push('nattarbete');
  if (lowerMessage.includes('svårtillgänglig')) circumstances.push('svårtillgänglig');
  if (lowerMessage.includes('allergi')) circumstances.push('allergihänsyn');
  
  return circumstances;
}

/**
 * Analyserar tekniker-antal påverkan på prissättning
 */
function analyzeTechnicianCountPricing(cases: any[]) {
  const byTechCount = { 1: [], 2: [], 3: [] } as Record<number, number[]>;
  
  for (const caseItem of cases) {
    let techCount = 0;
    if (caseItem.primary_assignee_id) techCount++;
    if (caseItem.secondary_assignee_id) techCount++;
    if (caseItem.tertiary_assignee_id) techCount++;
    
    if (techCount >= 1 && techCount <= 3) {
      byTechCount[techCount].push(caseItem.pris);
    }
  }
  
  const result: any = {};
  
  for (const [count, prices] of Object.entries(byTechCount)) {
    if (prices.length > 0) {
      result[`${count}_tekniker`] = {
        antal_ärenden: prices.length,
        genomsnittspris: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        prisintervall: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };
    }
  }
  
  return result;
}

/**
 * Analyserar komplexitets påverkan på prissättning
 */
function analyzeComplexityPricing(cases: any[]) {
  const byComplexity = { low: [], medium: [], high: [] } as Record<string, number[]>;
  
  for (const caseItem of cases) {
    const text = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    let complexity = 'medium';
    
    if (text.includes('sanering') || text.includes('omfattande') || text.includes('komplex')) {
      complexity = 'high';
    } else if (text.includes('enkel') || text.includes('rutinmässig')) {
      complexity = 'low';
    }
    
    byComplexity[complexity].push(caseItem.pris);
  }
  
  const result: any = {};
  
  for (const [level, prices] of Object.entries(byComplexity)) {
    if (prices.length > 0) {
      result[`${level}_komplexitet`] = {
        antal_ärenden: prices.length,
        genomsnittspris: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        prisintervall: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };
    }
  }
  
  return result;
}

/**
 * Analyserar duration påverkan på prissättning
 */
function analyzeDurationPricing(cases: any[]) {
  const casesWithDuration = cases.filter(c => c.start_date && c.due_date);
  
  if (casesWithDuration.length === 0) {
    return { message: 'Ingen durationsdata tillgänglig' };
  }
  
  const durationsAndPrices = casesWithDuration.map(c => ({
    duration: (new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60),
    price: c.pris
  }));
  
  // Gruppera efter duration
  const shortJobs = durationsAndPrices.filter(d => d.duration <= 2);
  const mediumJobs = durationsAndPrices.filter(d => d.duration > 2 && d.duration <= 4);
  const longJobs = durationsAndPrices.filter(d => d.duration > 4);
  
  return {
    kort_jobb: shortJobs.length > 0 ? {
      antal: shortJobs.length,
      genomsnittspris: Math.round(shortJobs.reduce((sum, j) => sum + j.price, 0) / shortJobs.length),
      genomsnittslängd: Math.round((shortJobs.reduce((sum, j) => sum + j.duration, 0) / shortJobs.length) * 10) / 10
    } : null,
    
    medel_jobb: mediumJobs.length > 0 ? {
      antal: mediumJobs.length,
      genomsnittspris: Math.round(mediumJobs.reduce((sum, j) => sum + j.price, 0) / mediumJobs.length),
      genomsnittslängd: Math.round((mediumJobs.reduce((sum, j) => sum + j.duration, 0) / mediumJobs.length) * 10) / 10
    } : null,
    
    långa_jobb: longJobs.length > 0 ? {
      antal: longJobs.length,
      genomsnittspris: Math.round(longJobs.reduce((sum, j) => sum + j.price, 0) / longJobs.length),
      genomsnittslängd: Math.round((longJobs.reduce((sum, j) => sum + j.duration, 0) / longJobs.length) * 10) / 10
    } : null
  };
}

/**
 * Hittar mest liknande ärenden baserat på alla faktorer
 */
function findMostSimilarCases(cases: any[], criteria: any) {
  return cases
    .map(c => ({
      ...c,
      similarity_score: calculateCaseSimilarity(c, criteria)
    }))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 5) // Öka till 5 mest liknande för bättre variation
    .map(c => ({
      id: c.id,
      title: c.title,
      price: c.pris,
      skadedjur: c.skadedjur,
      duration_hours: c.start_date && c.due_date ? 
        Math.round(((new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60)) * 10) / 10 : null,
      technician_count: [c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id].filter(Boolean).length,
      similarity_score: c.similarity_score,
      case_type: c.case_type,
      created_at: c.created_at
    }));
}

/**
 * Beräknar likhet mellan ärende och kriterier
 */
function calculateCaseSimilarity(caseItem: any, criteria: any): number {
  let score = 0;
  
  // Skadedjur match (viktigast)
  if (criteria.pestType && caseItem.skadedjur) {
    if (caseItem.skadedjur.toLowerCase().includes(criteria.pestType)) score += 50;
  }
  
  // Storlek match
  if (criteria.sizeInfo?.area_sqm) {
    const caseText = `${caseItem.description || ''} ${caseItem.rapport || ''}`;
    const caseSizeMatch = caseText.match(/(\d+)\s*kvm/i);
    if (caseSizeMatch) {
      const caseSize = parseInt(caseSizeMatch[1]);
      const sizeDiff = Math.abs(criteria.sizeInfo.area_sqm - caseSize);
      score += Math.max(0, 20 - sizeDiff / 5); // Minska poäng för stor skillnad
    }
  }
  
  // Komplexitet match
  if (criteria.complexityInfo?.level) {
    const caseText = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    const caseComplexity = caseText.includes('sanering') || caseText.includes('omfattande') ? 'hög' :
                          caseText.includes('enkel') ? 'låg' : 'medium';
    
    if (caseComplexity === criteria.complexityInfo.level) score += 20;
  }
  
  // Nyhet (nyare ärenden är mer relevanta)
  const ageInDays = (Date.now() - new Date(caseItem.created_at).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 10 - ageInDays / 7); // Minska poäng för gamla ärenden
  
  return Math.round(score);
}

/**
 * Beräknar median för priser
 */
function calculateMedianPrice(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  } else {
    return sorted[middle];
  }
}

/**
 * Genererar prissättningsrekommendation
 */
function generatePricingRecommendation(cases: any[], criteria: any) {
  if (cases.length < 3) {
    return {
      confidence: 'låg',
      message: 'För få liknande ärenden för säker prissättning'
    };
  }
  
  const prices = cases.map(c => c.pris);
  const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const medianPrice = calculateMedianPrice(prices);
  
  let adjustedPrice = medianPrice;
  const adjustments = [];
  
  // Justera för komplexitet
  if (criteria.complexityInfo?.level === 'hög') {
    adjustedPrice *= 1.3;
    adjustments.push('Komplex sanering: +30%');
  } else if (criteria.complexityInfo?.level === 'låg') {
    adjustedPrice *= 0.85;
    adjustments.push('Enkel åtgärd: -15%');
  }
  
  // Justera för storlek
  if (criteria.sizeInfo?.area_sqm) {
    if (criteria.sizeInfo.area_sqm > 100) {
      adjustedPrice *= 1.2;
      adjustments.push('Stor yta (>100kvm): +20%');
    } else if (criteria.sizeInfo.area_sqm < 30) {
      adjustedPrice *= 0.9;
      adjustments.push('Liten yta (<30kvm): -10%');
    }
  }
  
  return {
    confidence: cases.length >= 10 ? 'hög' : cases.length >= 5 ? 'medel' : 'låg',
    base_price: medianPrice,
    recommended_price: Math.round(adjustedPrice),
    price_range: {
      min: Math.round(adjustedPrice * 0.9),
      max: Math.round(adjustedPrice * 1.1)
    },
    adjustments,
    similar_cases_count: cases.length
  };
}

/**
 * Identifierar skadedjurstyp från meddelandet (optimerad version)
 */
function identifyPestTypeFromMessage(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Exakta matchningar först (mest specifika)
  if (lowerMessage.includes('vägglus') || lowerMessage.includes('vägglöss') || lowerMessage.includes('bedbug')) return 'Vägglöss';
  if (lowerMessage.includes('fågelsäkring')) return 'Fågelsäkring';
  if (lowerMessage.includes('kackerlack') || lowerMessage.includes('cockroach')) return 'Kackerlackor';
  if (lowerMessage.includes('getingar') || lowerMessage.includes('hornets nest')) return 'Getingar';
  
  // Mer generella matchningar
  if (lowerMessage.includes('råtta') || lowerMessage.includes('mus')) return 'Gnagare';
  if (lowerMessage.includes('myra')) return 'Myror';
  if (lowerMessage.includes('fågel') || lowerMessage.includes('bird')) return 'Fåglar';
  if (lowerMessage.includes('spindel') || lowerMessage.includes('spider')) return 'Spindlar';
  
  // Tjänstetyp-matchningar
  if (lowerMessage.includes('sanering')) return 'Sanering';
  
  return null; // Ingen specifik typ identifierad
}