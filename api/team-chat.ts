// api/team-chat.ts
// Team AI Chat - Centraliserad AI-lösning för hela teamet
// Stödjer chat, bildanalys och bildgenerering via Google Gemini
// Med tillgång till BeGones systemdata (kunder, ärenden, tekniker)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Supabase klient för att hämta systemdata
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Prisberäkning (ungefärlig)
const PRICING = {
  'gemini-2.5-flash': { input: 0.50 / 1_000_000, output: 2.00 / 1_000_000 },
  'gemini-3-flash-preview': { input: 0.50 / 1_000_000, output: 3.00 / 1_000_000 },
  'imagen-3.0-generate-002': { outputImage: 0.04 }, // Imagen 3 pricing
};

// Hämta systemdata från Supabase
async function fetchSystemData() {
  try {
    const [
      customersResult,
      techniciansResult,
      privateCasesResult,
      businessCasesResult
    ] = await Promise.all([
      supabase.from('customers').select('id, company_name, annual_value, contact_person, contact_email, contact_phone, contact_address').eq('is_active', true).limit(100),
      supabase.from('technicians').select('id, name, role, email, direct_phone, office_phone, address, is_active').eq('is_active', true),
      supabase.from('private_cases').select('id, title, status, kontaktperson, pris, skadedjur, adress, primary_assignee_name, primary_assignee_email, start_date, due_date').order('created_at', { ascending: false }).limit(50),
      supabase.from('business_cases').select('id, title, status, kontaktperson, pris, skadedjur, adress, primary_assignee_name, primary_assignee_email, start_date, due_date').order('created_at', { ascending: false }).limit(50)
    ]);

    return {
      customers: customersResult.data || [],
      technicians: techniciansResult.data || [],
      recentCases: [
        ...(privateCasesResult.data || []).map(c => ({ ...c, type: 'privat' })),
        ...(businessCasesResult.data || []).map(c => ({ ...c, type: 'företag' }))
      ],
      summary: {
        totalCustomers: customersResult.data?.length || 0,
        totalTechnicians: techniciansResult.data?.length || 0,
        totalRevenue: customersResult.data?.reduce((sum, c) => sum + (c.annual_value || 0), 0) || 0
      }
    };
  } catch (error) {
    console.error('Error fetching system data:', error);
    return null;
  }
}

const BASE_SYSTEM_MESSAGE = `Du är en hjälpsam AI-assistent för BeGone, ett skadedjursbekämpningsföretag i Sverige.

🎯 **DINA HUVUDUPPGIFTER:**
- Svara på frågor om skadedjur och bekämpningsmetoder
- Analysera kunddata och ge affärsinsikter
- Hjälpa med prissättning och offerter
- Analysera bilder på skadedjur eller skador
- Skriva och förbättra texter (offerter, rapporter, mail)
- Ge statistik och rapporter baserat på systemdatan

📊 **DU HAR TILLGÅNG TILL:**
- Alla avtalskunder med kontaktuppgifter och årsvärden
- Alla tekniker med roller och kontaktinfo
- Senaste ärenden (privat & företag) med status och priser

⚠️ **VIKTIGT:**
- Använd ENDAST data från systemet - hitta aldrig på information
- Svara alltid på svenska om inte användaren skriver på annat språk
- Var professionell, konkret och hjälpsam
- Om du får en bild, analysera den noggrant

💡 **EXEMPEL PÅ VAD DU KAN HJÄLPA MED:**
- "Vilka är våra 10 största kunder?"
- "Hur många ärenden har vi med råttor?"
- "Skriv en offert för sanering av vägglöss"
- "Analysera denna bild på skadedjur"`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message,
      conversationHistory = [],
      imageBase64,
      imageMimeType,
      generateImage = false,
      imagePrompt
    } = req.body;

    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google AI API-nyckel är inte konfigurerad'
      });
    }

    // Bildgenerering
    if (generateImage && imagePrompt) {
      return handleImageGeneration(imagePrompt, res);
    }

    // Chat (med eller utan bildanalys)
    if (!message && !imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Meddelande eller bild krävs'
      });
    }

    // Hämta systemdata för att ge AI:n kontext
    const systemData = await fetchSystemData();

    // Bygg system message med aktuell data
    let systemMessage = BASE_SYSTEM_MESSAGE;

    if (systemData) {
      systemMessage += `

---

📈 **AKTUELL SYSTEMDATA (${new Date().toLocaleDateString('sv-SE')}):**

**Sammanfattning:**
- Totalt ${systemData.summary.totalCustomers} aktiva avtalskunder
- ${systemData.summary.totalTechnicians} tekniker
- Totalt årsvärde: ${systemData.summary.totalRevenue.toLocaleString('sv-SE')} kr

**Topp 10 Avtalskunder (efter årsvärde):**
${systemData.customers
  .sort((a: any, b: any) => (b.annual_value || 0) - (a.annual_value || 0))
  .slice(0, 10)
  .map((c: any, i: number) => `${i + 1}. ${c.company_name} - ${(c.annual_value || 0).toLocaleString('sv-SE')} kr/år`)
  .join('\n')}

**Tekniker och kontaktinfo:**
${systemData.technicians.map((t: any) => `- ${t.name} (${t.role}) - ${t.email}${t.direct_phone ? ' - ' + t.direct_phone : ''}`).join('\n')}

**Senaste 20 ärenden med tilldelade tekniker:**
${systemData.recentCases.slice(0, 20).map((c: any) =>
  `- [${c.type}] ${c.title || 'Utan titel'} - ${c.status} - ${c.skadedjur || 'Ej angivet'} - ${(c.pris || 0).toLocaleString('sv-SE')} kr - Tilldelad: ${c.primary_assignee_name || 'Ej tilldelad'}`
).join('\n')}

**Alla avtalskunder (för sökning):**
${systemData.customers.map((c: any) => `${c.company_name} (${c.contact_person || 'Ingen kontakt'}, ${c.contact_email || 'ingen email'})`).join(', ')}
`;
    }

    // Välj modell
    const modelName = 'gemini-2.5-flash';

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      systemInstruction: systemMessage,
    });

    // Bygg konversationshistorik för Gemini
    const geminiHistory: Content[] = conversationHistory
      .filter((msg: any) => msg.role !== 'system')
      .slice(-10) // Behåll senaste 10 meddelanden
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Bygg aktuella meddelande-parts
    const messageParts: Part[] = [];

    if (imageBase64 && imageMimeType) {
      messageParts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64
        }
      });
    }

    if (message) {
      messageParts.push({ text: message });
    } else if (imageBase64) {
      messageParts.push({ text: 'Analysera denna bild och beskriv vad du ser.' });
    }

    // Starta chat och skicka meddelande
    const chat = model.startChat({
      history: geminiHistory,
    });

    const result = await chat.sendMessage(messageParts);
    const response = result.response.text();

    // Uppskatta tokens (grov uppskattning: ~4 tecken per token)
    const inputTokens = Math.ceil(
      (message?.length || 0) / 4 +
      (imageBase64 ? 1000 : 0) + // Bilder kostar ca 1000 tokens
      conversationHistory.reduce((sum: number, msg: any) => sum + (msg.content?.length || 0) / 4, 0)
    );
    const outputTokens = Math.ceil(response.length / 4);

    const pricing = PRICING[modelName as keyof typeof PRICING];
    const estimatedCost = 'input' in pricing
      ? (inputTokens * pricing.input) + (outputTokens * pricing.output)
      : 0;

    return res.status(200).json({
      success: true,
      response,
      usage: {
        model: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        images_analyzed: imageBase64 ? 1 : 0,
        estimated_cost_usd: estimatedCost
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Team Chat Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';

    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleImageGeneration(prompt: string, res: VercelResponse) {
  try {
    // Använd Imagen 3 för bildgenerering via Vertex AI endpoint
    // OBS: Imagen 3 kräver Vertex AI-konfiguration
    // För nu använder vi Gemini 2.0 Flash med bildgenerering som fallback

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Experimentell modell med bildgenerering
      generationConfig: {
        temperature: 1,
      },
    });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Generate an image: ${prompt}. Create a professional, high-quality image suitable for a pest control company.` }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'] as any,
      } as any,
    });

    const response = result.response;

    // Kolla om det finns genererad bild
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ('inlineData' in part && part.inlineData) {
        return res.status(200).json({
          success: true,
          image: {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          },
          usage: {
            model: 'gemini-2.0-flash-exp',
            images_generated: 1,
            estimated_cost_usd: 0.04
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // Om ingen bild genererades, returnera textsvaret
    const textResponse = response.text();
    return res.status(200).json({
      success: true,
      response: textResponse || 'Bildgenerering är för närvarande inte tillgänglig. Gemini 2.0 Flash Experimental stödjer inte bildgenerering i denna konfiguration. Kontakta admin för att konfigurera Imagen 3 via Vertex AI.',
      usage: {
        model: 'gemini-2.0-flash-exp',
        images_generated: 0,
        estimated_cost_usd: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image Generation Error:', error);

    // Ge ett mer informativt felmeddelande
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';

    return res.status(200).json({
      success: true,
      response: `⚠️ Bildgenerering kunde inte utföras: ${errorMessage}\n\nFör att aktivera bildgenerering behöver du konfigurera Imagen 3 via Google Cloud Vertex AI. Kontakta systemadministratören.`,
      usage: {
        model: 'imagen-3',
        images_generated: 0,
        estimated_cost_usd: 0
      },
      timestamp: new Date().toISOString()
    });
  }
}
