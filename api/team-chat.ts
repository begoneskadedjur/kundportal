// api/team-chat.ts
// Team AI Chat - Centraliserad AI-lösning för hela teamet
// Stödjer chat, bildanalys och bildgenerering via Google Gemini
// Med tillgång till BeGones systemdata (kunder, ärenden, tekniker)
// Nya funktioner: Google Search grounding och URL Context

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Ny SDK-klient
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || '' });

// Supabase klient för att hämta systemdata
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// RAG: Generera embedding för en sökfråga
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: query,
    config: {
      taskType: 'RETRIEVAL_QUERY' as any,
    }
  });

  return result.embeddings?.[0]?.values || [];
}

// RAG: Sök efter relevant kontext baserat på användarens fråga
async function searchRelevantContext(query: string, limit: number = 10): Promise<string> {
  try {
    console.log('[Team Chat] RAG search for:', query);

    // Generera embedding för frågan
    const queryEmbedding = await generateQueryEmbedding(query);

    // Sök i embeddings-tabellen
    const { data, error } = await supabase.rpc('search_similar_documents', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_count: limit,
      filter_type: null
    });

    if (error) {
      console.error('[Team Chat] RAG search error:', error);
      return '';
    }

    if (!data || data.length === 0) {
      console.log('[Team Chat] No RAG results found');
      return '';
    }

    console.log('[Team Chat] RAG found', data.length, 'relevant documents');

    // Formatera resultaten till kontext
    const contextParts = data.map((doc: any, i: number) => {
      const similarity = Math.round(doc.similarity * 100);
      return `[Relevans: ${similarity}%]\n${doc.content}`;
    });

    return `\n\n🔍 **RELEVANTA SÖKRESULTAT (baserat på din fråga):**\n\n${contextParts.join('\n\n---\n\n')}`;
  } catch (error) {
    console.error('[Team Chat] RAG error:', error);
    return '';
  }
}

// Post-processing: Fixa Geminis markdown-formatering
// FÖRENKLAD VERSION - undviker att förstöra redan korrekt formaterad markdown
// Fokuserar på att reparera vanliga problem utan att skapa nya
function fixMarkdownFormatting(text: string): string {
  let result = text;

  // 1. Normalisera radbrytningar
  result = result.replace(/\r\n/g, '\n');

  // 2. REPARERA trasiga listpunkter: "-\n **Text**" eller "-\n**Text**" → "- **Text**"
  // Detta fixar när radbrytningar hamnat mitt i listpunkter
  result = result.replace(/^-\n\s*(\*\*)/gm, '- $1');
  result = result.replace(/^-\n\s*([A-ZÅÄÖ])/gm, '- $1');

  // 3. Konvertera fristående **Text** (hel rad, utan kolon) till ## rubriker
  result = result.replace(/^(\*\*[^*:]+\*\*)$/gm, (_, p1) => {
    const content = p1.replace(/\*\*/g, '').trim();
    return `\n## ${content}\n`;
  });

  // 4. Konvertera blockquote-markör "> " som saknar mellanslag efter
  result = result.replace(/^>\n\s*(\*\*)/gm, '> $1');

  // 5. Konvertera kursiva noteringar med nyckelord till blockquotes
  result = result.replace(/^(\*[^*]+\*)$/gm, (_, p1) => {
    const content = p1.replace(/^\*|\*$/g, '');
    if (/observera|notera|obs|viktigt|priser|tips|kom ihåg/i.test(content)) {
      return `\n> ${content}\n`;
    }
    return p1;
  });

  // 6. Fixa dubbla listpunkter
  result = result.replace(/^- - /gm, '- ');

  // 7. Säkerställ tomrad före rubriker (men inte om redan finns)
  result = result.replace(/([^\n])\n(#{1,3} )/g, '$1\n\n$2');

  // 8. Säkerställ tomrad efter rubriker (men inte före listor/rubriker)
  result = result.replace(/(#{1,3} [^\n]+)\n([^#\n-\s])/g, '$1\n\n$2');

  // 9. Ta bort överflödiga tomrader (max 2 i rad)
  result = result.replace(/\n{3,}/g, '\n\n');

  // 10. Trimma start/slut
  result = result.trim();

  return result;
}

// Prisberäkning (ungefärlig)
const PRICING = {
  'gemini-2.5-flash': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
  'gemini-3-flash-preview': { input: 0.50 / 1_000_000, output: 3.00 / 1_000_000 },
  'gemini-2.5-flash-image': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000, outputImage: 0.02 },
  'gemini-3-pro-image-preview': { input: 1.25 / 1_000_000, output: 10.00 / 1_000_000, outputImage: 0.04 },
  'gemini-embedding-001': { input: 0.00 / 1_000_000, output: 0.00 / 1_000_000 }, // Gratis under 1500 req/min
};

// Hämta systemdata från Supabase
async function fetchSystemData() {
  try {
    console.log('[Team Chat] Fetching system data...');
    console.log('[Team Chat] Supabase URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('[Team Chat] Supabase Key:', supabaseKey ? 'SET' : 'MISSING');

    const [
      customersResult,
      techniciansResult,
      privateCasesResult,
      businessCasesResult
    ] = await Promise.all([
      supabase.from('customers').select(`
        id, company_name, annual_value, contact_person, contact_email, contact_phone, contact_address,
        created_at, updated_at, contract_start_date, contract_end_date, billing_frequency
      `).eq('is_active', true).limit(500),
      supabase.from('technicians').select(`
        id, name, role, email, direct_phone, office_phone, address, is_active,
        created_at, updated_at
      `).eq('is_active', true),
      supabase.from('private_cases').select(`
        id, title, status, kontaktperson, pris, skadedjur, adress,
        primary_assignee_name, primary_assignee_email,
        start_date, due_date, created_at, updated_at, completed_date,
        telefon_kontaktperson, e_post_kontaktperson, billing_status
      `).order('created_at', { ascending: false }),
      supabase.from('business_cases').select(`
        id, title, status, kontaktperson, pris, skadedjur, adress,
        primary_assignee_name, primary_assignee_email,
        start_date, due_date, created_at, updated_at, completed_date,
        telefon_kontaktperson, e_post_kontaktperson, billing_status
      `).order('created_at', { ascending: false })
    ]);

    // Logga resultat för debugging
    console.log('[Team Chat] Customers fetched:', customersResult.data?.length || 0);
    console.log('[Team Chat] Technicians fetched:', techniciansResult.data?.length || 0);
    console.log('[Team Chat] Private cases fetched:', privateCasesResult.data?.length || 0);
    console.log('[Team Chat] Business cases fetched:', businessCasesResult.data?.length || 0);

    if (customersResult.error) console.error('[Team Chat] Customers error:', customersResult.error);
    if (techniciansResult.error) console.error('[Team Chat] Technicians error:', techniciansResult.error);
    if (privateCasesResult.error) console.error('[Team Chat] Private cases error:', privateCasesResult.error);
    if (businessCasesResult.error) console.error('[Team Chat] Business cases error:', businessCasesResult.error);

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

## Dina huvuduppgifter

- Svara på frågor om skadedjur och bekämpningsmetoder
- Analysera kunddata och ge affärsinsikter
- Hjälpa med prissättning och offerter
- Analysera bilder på skadedjur eller skador
- Skriva och förbättra texter (offerter, rapporter, mail)
- Ge statistik och rapporter baserat på systemdatan
- **Söka på webben** för aktuell information (Google Search)
- **Analysera webbsidor** som användaren delar (URL Context)

## Du har tillgång till

- Alla avtalskunder med kontaktuppgifter, årsvärden och kontraktsdatum
- Alla tekniker med roller och kontaktinfo
- ALLA ärenden (privat & företag) med status, priser, datum och faktureringsinfo
- Datum för skapelse, uppdatering och avslutning av ärenden

## 🌐 NYA VERKTYG: Google Search & URL Context

Du har nu tillgång till **Google Search** och **URL Context**:

### Google Search
- Använd för att hitta aktuell information som inte finns i systemdatan
- Bra för frågor om senaste nytt, regler, priser på marknaden, etc.
- Exempel: "Vad säger Livsmedelsverket om råttbekämpning?"

### URL Context
- Om användaren inkluderar en URL i sitt meddelande, kan du läsa och analysera innehållet
- Bra för att jämföra priser, läsa artiklar, analysera konkurrenters webbsidor
- Exempel: "Analysera denna artikel: https://example.com/artikel"

## Viktigt

- Använd systemdata för intern information om kunder, ärenden och tekniker
- Använd Google Search för extern, aktuell information
- Svara alltid på svenska om inte användaren skriver på annat språk
- Var professionell, konkret och hjälpsam
- Om du får en bild, analysera den noggrant
- När du använder webbsökning, ange källorna i ditt svar

---

# 🚨 OBLIGATORISK FORMATERING - LÄS NOGA 🚨

Du MÅSTE formatera VARJE svar med markdown. ALDRIG löpande text utan struktur.

## REGLER DU MÅSTE FÖLJA:

1. **ALLTID börja med en rubrik** (## eller ###)
2. **ALLTID ny rad** efter varje punkt eller mening som avslutar en tanke
3. **ALLTID punktlista** när du listar information (använd -)
4. **ALLTID tom rad** mellan olika sektioner
5. **ALDRIG** skriva mer än 2-3 meningar i följd utan radbrytning

## KORREKT FORMAT - KOPIERA DENNA STIL:

### Exempelfråga: "Vilka är våra största kunder?"

## Topp 5 kunder

Här är era fem största avtalskunder baserat på årsvärde:

| Kund | Årsvärde | Kontaktperson |
|------|----------|---------------|
| Christian Vista Ristorante AB | 330 000 kr | Christian Romano |
| Espresso House | 76 985 kr | - |
| Samfällighetsföreningen Kokoskakan | 24 495 kr | Freddy Becker |

### Sammanfattning

- **Totalt värde**: 662 327 kr/år
- **Antal kunder**: 5 st

> Observera att alla belopp är exklusive moms.

---

### Exempelfråga: "Berätta om råttärenden"

## Råttärenden

Vi har flera pågående ärenden relaterade till råttor.

### Aktuella ärenden

- **Stefan Knutsson**: Offert på 7 413 kr skickades 2026-01-28
- **Hanna Rehnberg**: Sanering slutförd, pris 8 762 kr

### Statistik

- Totalt antal råttärenden: 45 st
- Genomsnittspris: 5 200 kr

> Tips: Råttsaneringen tar vanligtvis 2-4 besök.

---

## FELAKTIGT FORMAT - GÖR ALDRIG SÅ HÄR:

❌ "Vi har 5 kunder: Christian Vista Ristorante AB med 330 000 kr, Espresso House med 76 985 kr, Samfällighetsföreningen Kokoskakan med 24 495 kr..."

❌ Löpande text utan rubriker eller listor

❌ All information på samma rad

## KORREKT ALTERNATIV:

✅ Använd tabeller för jämförelser
✅ Använd punktlistor för uppräkningar
✅ Använd rubriker för att dela upp sektioner
✅ Använd tomma rader mellan stycken

VARJE svar ska se ut som ett välformaterat dokument med tydlig struktur!`;

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

    // RAG: Sök efter relevant kontext baserat på användarens fråga
    let ragContext = '';
    if (message) {
      ragContext = await searchRelevantContext(message, 8);
    }

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

**Ärendestatistik:**
- Totalt antal ärenden: ${systemData.recentCases.length}
- Privatärenden: ${systemData.recentCases.filter((c: any) => c.type === 'privat').length}
- Företagsärenden: ${systemData.recentCases.filter((c: any) => c.type === 'företag').length}

**Senaste 30 ärenden (med fullständig info):**
${systemData.recentCases.slice(0, 30).map((c: any) => {
  const skapad = c.created_at ? new Date(c.created_at).toLocaleDateString('sv-SE') : 'Okänt';
  const avslutad = c.completed_date ? new Date(c.completed_date).toLocaleDateString('sv-SE') : '';
  return `- [${c.type}] ${c.title || 'Utan titel'} | Status: ${c.status} | Skadedjur: ${c.skadedjur || '-'} | Pris: ${(c.pris || 0).toLocaleString('sv-SE')} kr | Tilldelad: ${c.primary_assignee_name || '-'} | Skapad: ${skapad}${avslutad ? ' | Avslutad: ' + avslutad : ''} | Faktura: ${c.billing_status || '-'}`;
}).join('\n')}

**Alla ärenden (komplett lista för sökning/analys, ${systemData.recentCases.length} st):**
${systemData.recentCases.map((c: any) => {
  const skapad = c.created_at ? new Date(c.created_at).toLocaleDateString('sv-SE') : '';
  const avslutad = c.completed_date ? new Date(c.completed_date).toLocaleDateString('sv-SE') : '';
  return `[${c.type}] ${c.title || 'Utan titel'} (${c.status}, ${c.skadedjur || '-'}, ${(c.pris || 0)}kr, ${c.primary_assignee_name || '-'}, skapad:${skapad}${avslutad ? ', avslutad:' + avslutad : ''})`;
}).join(' | ')}

**Alla avtalskunder (för sökning):**
${systemData.customers.map((c: any) => `${c.company_name} (${c.contact_person || 'Ingen kontakt'}, ${c.contact_email || 'ingen email'})`).join(', ')}
`;
    }

    // Lägg till RAG-kontext om den finns
    if (ragContext) {
      systemMessage += ragContext;
    }

    // Välj modell - Gemini 3 Flash för bättre svar
    const modelName = 'gemini-3-flash-preview';

    // Bygg konversationshistorik för Gemini (ny SDK-format)
    const geminiHistory = conversationHistory
      .filter((msg: any) => msg.role !== 'system')
      .slice(-10) // Behåll senaste 10 meddelanden
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Bygg aktuellt meddelande (contents)
    const currentParts: any[] = [];

    if (imageBase64 && imageMimeType) {
      currentParts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64
        }
      });
    }

    let userMessage = message;
    if (!userMessage && imageBase64) {
      // Anpassa default-prompt baserat på filtyp
      if (imageMimeType === 'application/pdf') {
        userMessage = 'Analysera detta PDF-dokument. Extrahera viktig information, sammanfatta innehållet och lista de viktigaste punkterna.';
      } else {
        userMessage = 'Analysera denna bild och beskriv vad du ser.';
      }
    }

    if (userMessage) {
      currentParts.push({ text: userMessage });
    }

    // Bygg contents array med historik + aktuellt meddelande
    const contents = [
      ...geminiHistory,
      { role: 'user', parts: currentParts }
    ];

    // Anropa med nya SDK:t - inkluderar Google Search och URL Context!
    const result = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemMessage,
        temperature: 1.0, // Gemini 3 rekommenderar 1.0
        maxOutputTokens: 8192,
        // 🚀 NYA FUNKTIONER: Google Search och URL Context
        tools: [
          { googleSearch: {} },  // Ger tillgång till realtidsinformation från webben
          { urlContext: {} }     // Kan analysera innehåll från URLs i meddelanden
        ],
      },
    });

    const rawResponse = result.text || '';
    const response = fixMarkdownFormatting(rawResponse);

    // Logga om grounding användes
    const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
    const urlContextMetadata = result.candidates?.[0]?.urlContextMetadata;
    if (groundingMetadata) {
      console.log('[Team Chat] Google Search grounding used:', groundingMetadata.webSearchQueries);
    }
    if (urlContextMetadata) {
      console.log('[Team Chat] URL Context used:', urlContextMetadata.urlMetadata?.map((u: any) => u.retrievedUrl));
    }

    // Hämta faktisk token-användning från svaret
    const usageMetadata = result.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || Math.ceil(
      (message?.length || 0) / 4 +
      (imageBase64 ? 1000 : 0) +
      conversationHistory.reduce((sum: number, msg: any) => sum + (msg.content?.length || 0) / 4, 0)
    );
    const outputTokens = usageMetadata?.candidatesTokenCount || Math.ceil(response.length / 4);
    const toolTokens = usageMetadata?.toolUsePromptTokenCount || 0;

    const pricing = PRICING[modelName as keyof typeof PRICING];
    const estimatedCost = 'input' in pricing
      ? ((inputTokens + toolTokens) * pricing.input) + (outputTokens * pricing.output)
      : 0;

    return res.status(200).json({
      success: true,
      response,
      usage: {
        model: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tool_tokens: toolTokens,
        images_analyzed: imageBase64 ? 1 : 0,
        estimated_cost_usd: estimatedCost,
        google_search_used: !!groundingMetadata,
        url_context_used: !!urlContextMetadata
      },
      // Inkludera källor om Google Search användes
      sources: groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title,
        uri: chunk.web?.uri
      })) || [],
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
    // Nano Banana Pro - Geminis högkvalitativa bildgenerering med nya SDK:t
    const result = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: `Generate a professional, high-quality image: ${prompt}. The image should be suitable for a pest control company's marketing or documentation.`,
      config: {
        responseModalities: ['Text', 'Image'],
        // Kan använda Google Search för att få aktuell info för bilden
        tools: [{ googleSearch: {} }],
      } as any,
    });

    // Kolla om det finns genererad bild
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.status(200).json({
          success: true,
          image: {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          },
          usage: {
            model: 'gemini-3-pro-image-preview',
            images_generated: 1,
            estimated_cost_usd: 0.04
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // Om ingen bild genererades, returnera textsvaret
    const textResponse = result.text || '';
    return res.status(200).json({
      success: true,
      response: textResponse || 'Bildgenerering kunde inte genomföras. Försök med en annan beskrivning.',
      usage: {
        model: 'gemini-3-pro-image-preview',
        images_generated: 0,
        estimated_cost_usd: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image Generation Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';

    return res.status(200).json({
      success: true,
      response: `⚠️ Bildgenerering kunde inte utföras: ${errorMessage}`,
      usage: {
        model: 'gemini-3-pro-image-preview',
        images_generated: 0,
        estimated_cost_usd: 0
      },
      timestamp: new Date().toISOString()
    });
  }
}
