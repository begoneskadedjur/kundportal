// api/extract-xpert-contract-data.ts
// Extraherar kunddata från Xpert Bekämpning-avtal med Gemini AI
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

export const config = {
  maxDuration: 60,
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || '' })

const XPERT_EXTRACTION_PROMPT = `Du är en expert på att extrahera data från avtalsdokument för skadedjursbekämpningsbolaget Xpert Bekämpning Sverige AB.

Analysera bifogat PDF-dokument och extrahera följande information. Returnera ENBART giltig JSON.

VIKTIGT - Parternas roller:
- Xpert Bekämpning Sverige AB (org 559269-5901) är LEVERANTÖREN/TJÄNSTELEVERANTÖREN - extrahera INTE deras uppgifter som kunddata
- KUNDEN är den andra parten i avtalet (t.ex. Lastaren 2 och 6 KB, HSB BRF Gaffeln i Södertälje, Pizzeria Erdal & Metin HB, Grabbarnas Grönt AB)
- Dessa avtal är signerade via Visma Sign, INTE Oneflow - lämna oneflow_contract_id som null

Fält att extrahera (ange null om ej funnet):
- company_name: Kundens företagsnamn (INTE Xpert Bekämpning Sverige AB)
- organization_number: Kundens organisationsnummer (format XXXXXX-XXXX, INTE 559269-5901)
- contact_person: "Kontaktperson för avtalet" på kundsidan - detta är den primära faktureringskontakten
- contact_email: E-postadress till kontaktpersonen för avtalet
- contact_phone: Telefonnummer till kontaktpersonen för avtalet
- contact_address: Kundens besöks-/objektadress
- billing_email: Fakturamail (från "Fakturamail"-fältet), null om samma som contact_email
- billing_address: Fakturaadress (från "Fakturaadress"-fältet), null om samma som contact_address
- contract_start_date: Avtalets startdatum (format YYYY-MM-DD)
- contract_end_date: Slutdatum (format YYYY-MM-DD), beräkna utifrån startdatum + avtalslängd om ej explicit angivet
- contract_length: Avtalslängd (t.ex. "1 år", "2 år", "3 år")
- annual_value: Årligt värde i SEK från "§ Ekonomiska villkor" / "Pris / år" (enbart siffror utan kr/SEK)
- monthly_value: Beräknat månadsvärde (annual_value / 12), null om annual_value saknas
- total_contract_value: Totalt avtalsvärde för hela avtalstiden (annual_value × antal år)
- agreement_text: Sammanfattning av tjänster och "Kontaktperson för objekt" (platskontakt). Format: "Tjänster: [lista]. Objektkontakt: [namn, telefon]"
- products: Array av produkter/tjänster från tjänstetabellen [{name, description, quantity, price}], price är pris/år per tjänst
- oneflow_contract_id: null (Xpert använder Visma Sign, inte Oneflow)
- assigned_account_manager: null (dessa kunder hanteras av BeGone efter övertagande, ej känt vid import)
- sales_person: Xperts säljare/kontaktperson på XB-sidan (t.ex. Jimmy Shamon, Maikel Saliba)
- business_type: "business" för företagskunder, "organization" för bostadsrättsföreningar/HSB
- industry_category: Branschkategori baserat på kundtyp (t.ex. "Restaurang", "Bostadsrättsförening", "Livsmedel", "Fastighet")
- service_frequency: Servicefrekvens från avtalets tjänstetabell (t.ex. "Kvartalsvis", "Halvårsvis", "Månadsvis", "Årsvis")
- confidence_score: 0-100, hur säker du är på extraktionen totalt sett
- extraction_notes: Eventuella problem, oklarheter eller saknade fält (på svenska)`

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

    console.log('=== EXTRACT XPERT CONTRACT DATA START ===')
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
            { text: XPERT_EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            company_name: { type: ['string', 'null'], description: 'Företagsnamn/kundnamn (INTE Xpert Bekämpning Sverige AB)' },
            organization_number: { type: ['string', 'null'], description: 'Organisationsnummer (format XXXXXX-XXXX)' },
            contact_person: { type: ['string', 'null'], description: 'Kontaktperson för avtalet (kundsidan)' },
            contact_email: { type: ['string', 'null'], description: 'E-postadress till kontaktperson' },
            contact_phone: { type: ['string', 'null'], description: 'Telefonnummer till kontaktperson' },
            contact_address: { type: ['string', 'null'], description: 'Kundens besöks-/objektadress' },
            billing_email: { type: ['string', 'null'], description: 'Fakturamail om separat, annars null' },
            billing_address: { type: ['string', 'null'], description: 'Fakturaadress om separat, annars null' },
            contract_start_date: { type: ['string', 'null'], description: 'Startdatum (YYYY-MM-DD)' },
            contract_end_date: { type: ['string', 'null'], description: 'Slutdatum (YYYY-MM-DD)' },
            contract_length: { type: ['string', 'null'], description: 'Avtalslängd (t.ex. "1 år")' },
            annual_value: { type: ['number', 'null'], description: 'Årligt värde i SEK' },
            monthly_value: { type: ['number', 'null'], description: 'Månatligt värde i SEK' },
            total_contract_value: { type: ['number', 'null'], description: 'Totalt avtalsvärde i SEK' },
            agreement_text: { type: ['string', 'null'], description: 'Sammanfattning av tjänster och objektkontakt' },
            products: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  quantity: { type: ['number', 'null'] },
                  price: { type: ['number', 'null'] },
                },
                required: ['name'],
              },
            },
            oneflow_contract_id: { type: ['string', 'null'], description: 'null (Xpert använder Visma Sign)' },
            assigned_account_manager: { type: ['string', 'null'], description: 'null vid import av Xpert-avtal' },
            sales_person: { type: ['string', 'null'], description: 'Xperts säljare (t.ex. Jimmy Shamon)' },
            business_type: { type: ['string', 'null'], description: '"business", "private" eller "organization"' },
            industry_category: { type: ['string', 'null'], description: 'Branschkategori' },
            service_frequency: { type: ['string', 'null'], description: 'Servicefrekvens' },
            confidence_score: { type: 'integer', description: 'Konfidenspoäng 0-100' },
            extraction_notes: { type: 'string', description: 'Noteringar om extraktionen (på svenska)' },
          },
          required: [
            'company_name', 'organization_number', 'contact_person', 'contact_email',
            'contact_phone', 'contact_address', 'billing_email', 'billing_address',
            'contract_start_date', 'contract_end_date', 'contract_length',
            'annual_value', 'monthly_value', 'total_contract_value',
            'agreement_text', 'products', 'oneflow_contract_id',
            'assigned_account_manager', 'sales_person', 'business_type',
            'industry_category', 'service_frequency', 'confidence_score', 'extraction_notes',
          ],
        },
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

    console.log('=== EXTRACT XPERT CONTRACT DATA SUCCESS ===')
    console.log('Extracted company:', extractedData.company_name)
    console.log('Confidence:', extractedData.confidence_score)
    console.log('Extracted data preview:', JSON.stringify(extractedData).substring(0, 500))

    return res.status(200).json({
      success: true,
      data: extractedData,
    })
  } catch (error: any) {
    console.error('=== EXTRACT XPERT CONTRACT DATA ERROR ===')
    console.error('Error:', error.message)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid extrahering av Xpert-avtalsdata',
    })
  }
}
