// api/coordinator-chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_MESSAGE = `Du är en AI-assistent specialiserad på att hjälpa koordinatorer inom skadedjursbekämpning att förstå och analysera deras data.

Du har tillgång till följande realtidsdata:
- KPI-data: schemaläggningseffektivitet, tekniker-utnyttjande, ombokningsfrekvens
- Effektivitetstrender över tid
- Tekniker-specifik data: arbetstimmar, utnyttjandegrad, tilldelade ärenden
- Affärspåverkan: intäkter, genomsnittliga ärendevärden
- Datumperiod för analysen

Din uppgift är att:
1. Svara på frågor om datan på ett insiktsfullt och hjälpsamt sätt
2. Identifiera mönster och trender
3. Ge konkreta, handlingsbara rekommendationer
4. Förklara komplexa koncept på ett enkelt sätt
5. Alltid basera dina svar på den faktiska datan

Svara alltid på svenska och var vänlig men professionell. Använd siffror och procentsatser från datan för att stödja dina påståenden.`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, analyticsData, conversationHistory } = req.body;

    if (!message || !analyticsData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Meddelande och analytics-data krävs' 
      });
    }

    // Förbered konversationshistorik
    const messages: any[] = [
      { role: 'system', content: SYSTEM_MESSAGE },
      { 
        role: 'system', 
        content: `Aktuell analytics-data för perioden ${analyticsData.dateRange.startDate} till ${analyticsData.dateRange.endDate}:
        
KPI-DATA:
- Genomsnittlig schemaläggning: ${analyticsData.kpiData?.scheduling_efficiency?.avg_hours_to_schedule?.toFixed(1) || 'N/A'} timmar
- Schemalagda inom 3 dagar: ${analyticsData.kpiData?.scheduling_efficiency?.scheduled_within_72h_percent?.toFixed(1) || 'N/A'}%
- Tekniker-utnyttjande: ${analyticsData.kpiData?.technician_utilization?.avg_utilization_percent?.toFixed(1) || 'N/A'}%
- Ombokningsfrekvens: ${analyticsData.kpiData?.rescheduling_metrics?.reschedule_rate_percent?.toFixed(1) || 'N/A'}%
- Antal underutnyttjade tekniker: ${analyticsData.kpiData?.technician_utilization?.underutilized_technicians || 0}
- Antal överutnyttjade tekniker: ${analyticsData.kpiData?.technician_utilization?.overutilized_technicians || 0}

TEKNIKER-DETALJER:
${analyticsData.utilizationData?.map((tech: any) => 
  `- ${tech.technician_name}: ${tech.utilization_percent?.toFixed(1)}% utnyttjande, ${tech.cases_assigned} ärenden, ${tech.scheduled_hours?.toFixed(1)}h schemalagt av ${tech.total_work_hours?.toFixed(1)}h tillgängligt`
).join('\n') || 'Ingen teknikerdata tillgänglig'}

AFFÄRSPÅVERKAN:
- Total intäkt hanterad: ${analyticsData.businessImpact?.total_revenue_managed?.toLocaleString('sv-SE') || 'N/A'} kr
- Genomsnittligt ärendevärde: ${analyticsData.businessImpact?.avg_case_value?.toFixed(0) || 'N/A'} kr
- Intäkt per schemalagd timme: ${analyticsData.businessImpact?.revenue_per_scheduled_hour?.toFixed(0) || 'N/A'} kr

Använd denna data för att ge insiktsfulla och databaserade svar.` 
      }
    ];

    // Lägg till konversationshistorik (begränsa till de senaste 10 meddelandena)
    const recentHistory = conversationHistory.slice(-10);
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
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;

    return res.status(200).json({
      success: true,
      response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Coordinator Chat Error:', error);
    
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