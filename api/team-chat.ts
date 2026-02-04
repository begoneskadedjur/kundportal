// api/team-chat.ts
// Team AI Chat - Centraliserad AI-lösning för hela teamet
// Stödjer chat, bildanalys och bildgenerering via Google Gemini

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Prisberäkning (ungefärlig)
const PRICING = {
  'gemini-2.5-flash': { input: 0.50 / 1_000_000, output: 2.00 / 1_000_000 },
  'gemini-3-flash-preview': { input: 0.50 / 1_000_000, output: 3.00 / 1_000_000 },
  'gemini-3-pro-image-preview': { inputText: 2.00 / 1_000_000, outputImage: 0.134 },
};

const SYSTEM_MESSAGE = `Du är en hjälpsam AI-assistent för BeGone, ett skadedjursbekämpningsföretag.

Du kan hjälpa teamet med:
- Svara på frågor om skadedjur och bekämpningsmetoder
- Ge råd om prissättning och kundhantering
- Analysera bilder på skadedjur eller skador
- Skriva och förbättra texter (offerter, rapporter, mail)
- Allmänna frågor och brainstorming

Var professionell, konkret och hjälpsam. Svara alltid på svenska om inte användaren skriver på ett annat språk.

Om användaren skickar en bild, analysera den noggrant och beskriv vad du ser. Om det rör skadedjur, ge specifik information om arten och rekommenderade åtgärder.`;

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

    // Välj modell baserat på om det finns bild
    const modelName = 'gemini-2.5-flash';

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      systemInstruction: SYSTEM_MESSAGE,
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
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-pro-image-preview',
      generationConfig: {
        temperature: 0.7,
      },
    });

    const result = await model.generateContent([
      { text: `Generera en bild: ${prompt}` }
    ]);

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
            model: 'gemini-3-pro-image-preview',
            images_generated: 1,
            estimated_cost_usd: PRICING['gemini-3-pro-image-preview'].outputImage
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    // Om ingen bild genererades, returnera textsvaret
    return res.status(200).json({
      success: true,
      response: response.text() || 'Kunde inte generera bild. Försök med en annan prompt.',
      usage: {
        model: 'gemini-3-pro-image-preview',
        images_generated: 0,
        estimated_cost_usd: 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image Generation Error:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Kunde inte generera bild',
      timestamp: new Date().toISOString()
    });
  }
}
