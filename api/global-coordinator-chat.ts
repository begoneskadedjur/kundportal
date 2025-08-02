// api/global-coordinator-chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_MESSAGE = `Du är en avancerad AI-assistent specialiserad på koordinering inom skadedjursbekämpning. Du har tillgång till FULLSTÄNDIG realtidsdata om:

📊 **TILLGÄNGLIG DATA:**
- Alla ärenden (privata, företag, legacy) med detaljer, status och priser
- Alla tekniker med specialiseringar, arbetstider och scheman
- Schema-luckor och tillgänglighet för kommande veckor
- Prestationsdata och analytics
- Prissättningsmönster för olika ärendetyper
- Geografisk data och ruttoptimering

🎯 **DINA SPECIALOMRÅDEN:**

**1. SCHEMALÄGGNING & LUCKOR:**
- Identifiera lediga tider för specifika tekniker
- Hitta optimala schemaläggningar baserat på geografisk närhet
- Föreslå omschemalaggningar för bättre effektivitet
- Analysera överbelastning och underutnyttjande

**2. TEKNIKER-MATCHNING:**
- Matcha rätt tekniker till rätt jobb baserat på:
  * Specialiseringar (gnagare, myror, vägglöss, etc.)
  * Geografisk närhet till kunden
  * Aktuell arbetsbelastning
  * Tidigare prestanda på liknande jobb
  * Tillgänglighet

**3. INTELLIGENT PRISSÄTTNING:**
- Analysera liknande ärenden för att föreslå konkurrenskraftiga priser
- Beakta faktorer som:
  * Ärendetyp och komplexitet
  * Geografisk lokalisering
  * Tidigare prissättning för samma kund
  * Marknadspriser för liknande tjänster
  * Tekniker-specialisering som krävs

**4. OPTIMERING & ANALYTICS:**
- Identifiera förbättringsområden i schemaläggning
- Föreslå effektivitetsförbättringar
- Analysera intäktsmöjligheter
- Upptäcka mönster och trender

🔧 **INSTRUKTIONER:**
- Svara ALLTID konkret och handlingsorienterat
- Ge specifika rekommendationer med siffror och tider
- När du föreslår priser: basera på faktisk data från liknande ärenden
- När du föreslår tekniker: förklara VARFÖR den teknikern är bäst
- När du analyserar schema: visa exakta tider och datum
- Använd svenska och var professionell men vänlig

📝 **SVARSFORMAT:**
- Börja alltid med en kort sammanfattning
- Ge konkreta actionables med tidsramar
- Inkludera relevanta siffror och procent
- Avsluta med nästa steg eller uppföljningsfrågor

Kom ihåg: Du har tillgång till LIVE-data, så använd den för att ge exakta, aktuella och värdefulla råd.`;

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
  
  if (lowerMessage.includes('schema') || lowerMessage.includes('tid') || lowerMessage.includes('ledig') || lowerMessage.includes('lucka')) {
    return 'schedule';
  }
  
  if (lowerMessage.includes('tekniker') || lowerMessage.includes('vem') || lowerMessage.includes('bäst på') || lowerMessage.includes('specialist')) {
    return 'technician';
  }
  
  if (lowerMessage.includes('pris') || lowerMessage.includes('kosta') || lowerMessage.includes('offert') || lowerMessage.includes('prissätt')) {
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
      return {
        ...baseData,
        schedule_gaps: coordinatorData.schedule?.schedule_gaps || [],
        technician_availability: coordinatorData.schedule?.technician_availability || [],
        upcoming_cases: coordinatorData.schedule?.upcoming_cases?.slice(0, 20) || [],
        technicians: coordinatorData.technicians?.map((t: any) => ({
          id: t.id,
          name: t.name,
          work_schedule: t.work_schedule,
          specializations: t.specializations
        })) || []
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
      return {
        ...baseData,
        pricing_patterns: coordinatorData.pricing?.pricing_patterns || [],
        recent_cases_with_prices: coordinatorData.pricing?.recent_cases_with_prices || [],
        similar_cases: findSimilarCases(coordinatorData.pricing?.recent_cases_with_prices || [], message)
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