// api/extract-contract-data.ts
// Extraherar kunddata från avtals-PDF med Gemini AI
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

export const config = {
  maxDuration: 60,
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || '' })

const EXTRACTION_PROMPT = `Du är en expert på att extrahera data från avtalsdokument för skadedjursbekämpningsföretaget BeGone Skadedjur & Sanering AB.

Analysera bifogat PDF-dokument och extrahera följande information. Returnera ENBART giltig JSON.

Fält att extrahera (ange null om ej funnet):
- company_name: Företagsnamn/kundnamn (uppdragsgivare, INTE BeGone)
- organization_number: Organisationsnummer (format XXXXXX-XXXX)
- contact_person: Kontaktperson hos kunden
- contact_email: E-postadress till kontaktperson
- contact_phone: Telefonnummer till kontaktperson
- contact_address: Fullständig utförande-/besöksadress
- billing_email: Faktura-epost om separat från kontaktepost, annars null
- billing_address: Faktureringsadress om separat, annars null
- contract_start_date: Avtalets startdatum (format YYYY-MM-DD)
- contract_end_date: Avtalets slutdatum (format YYYY-MM-DD)
- contract_length: Avtalslängd (t.ex. "3 år", "12 månader")
- annual_value: Årligt värde i SEK (enbart siffror, null om ej angivet)
- monthly_value: Månatligt värde i SEK (enbart siffror, null om ej angivet)
- total_contract_value: Totalt avtalsvärde i SEK (enbart siffror, null om ej angivet)
- agreement_text: Sammanfattning av avtalets innehåll/tjänster som utförs
- products: Array av produkter/tjänster [{name, description, quantity, price}] eller null
- oneflow_contract_id: Oneflow avtalsnummer/ID (om synligt i dokumentet)
- assigned_account_manager: Ansvarig tekniker/kontaktperson från BeGone
- sales_person: Säljare från BeGone (om angivet)
- business_type: "business" om företagskund, "private" om privatperson
- industry_category: Branschkategori (t.ex. "Restaurang", "Butik", "Lantbruk", "Kontor")
- service_frequency: Servicefrekvens (t.ex. "Kvartalsvis", "Månadsvis", "Årsvis")
- confidence_score: 0-100, hur säker du är på extraktionen totalt sett
- extraction_notes: Eventuella problem, oklarheter eller saknade fält (på svenska)

VIKTIGT:
- Extrahera KUNDENS information, inte BeGones information
- BeGone Skadedjur & Sanering AB (org 559378-9208) är leverantören, INTE kunden
- Om dokumentet är en inspektionsrapport, extrahera uppdragsgivarens information
- Datumet "Datum för utförande" kan användas som contract_start_date om inget annat anges`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_AI_API_KEY saknas i miljövariabler' })
    }

    const { pdfBase64 } = req.body
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'pdfBase64 krävs som en base64-sträng' })
    }

    // Validera storlek (~4MB base64 max för Vercel body limit)
    if (pdfBase64.length > 6_000_000) {
      return res.status(400).json({ error: 'PDF-filen är för stor (max ~4MB)' })
    }

    console.log('=== EXTRACT CONTRACT DATA START ===')
    console.log('PDF base64 length:', pdfBase64.length)

    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
      },
    })

    const responseText = result.text || ''
    console.log('Gemini response length:', responseText.length)

    let extractedData
    try {
      extractedData = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse Gemini JSON response:', responseText.substring(0, 500))
      return res.status(500).json({
        error: 'Kunde inte tolka AI-svaret som JSON',
        rawResponse: responseText.substring(0, 1000),
      })
    }

    console.log('=== EXTRACT CONTRACT DATA SUCCESS ===')
    console.log('Extracted company:', extractedData.company_name)
    console.log('Confidence:', extractedData.confidence_score)

    return res.status(200).json({
      success: true,
      data: extractedData,
    })
  } catch (error: any) {
    console.error('=== EXTRACT CONTRACT DATA ERROR ===')
    console.error('Error:', error.message)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid extrahering av avtalsdata',
    })
  }
}
