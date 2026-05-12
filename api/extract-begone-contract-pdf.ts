// api/extract-begone-contract-pdf.ts
// Extraherar kunddata från BeGone-avtal med Gemini AI
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'

export const config = {
  maxDuration: 60,
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || '' })

const BEGONE_EXTRACTION_PROMPT = `Du är en expert på att extrahera data från avtalsdokument för skadedjursbekämpningsbolaget BeGone.

Analysera bifogat PDF-avtal och extrahera följande information. Returnera ENBART giltig JSON.

VIKTIGT — Parternas roller:
- BeGone (eller BeGone Skadedjurskontroll) är LEVERANTÖREN/TJÄNSTELEVERANTÖREN — extrahera INTE deras uppgifter som kunddata
- KUNDEN är den andra parten i avtalet (företaget, föreningen eller privatpersonen som köper tjänsten)

Fält att extrahera (ange null om ej funnet):
- company_name: Kundens företagsnamn/namn (INTE BeGone)
- organization_number: Kundens organisationsnummer (format XXXXXX-XXXX), null om privatperson
- contact_person: Kontaktperson på kundsidan
- contact_email: E-postadress till kontaktpersonen
- contact_phone: Telefonnummer till kontaktpersonen
- contact_address: Kundens besöks-/objektadress (utförande-adress)
- billing_email: Fakturamail om separat angivet, annars null
- billing_address: Fakturaadress om separat angivet, annars null
- contract_start_date: Avtalets startdatum (format YYYY-MM-DD)
- contract_end_date: Slutdatum (format YYYY-MM-DD) — beräkna utifrån startdatum + avtalslängd om ej explicit angivet
- contract_length: Avtalslängd som text (t.ex. "1 år", "2 år", "3 år", "6 månader")
- annual_value: Årligt pris i SEK (enbart siffror utan kr/SEK/moms)
- agreement_text: Kortfattad sammanfattning av tjänster och objekt/platskontakt
- products: Array av tjänster/produkter [{name, description, quantity, price}], price är pris/år per tjänst
- sales_person: BeGones säljare/kontaktperson på BeGone-sidan
- sales_person_email: BeGones säljarens e-postadress, null om ej angivet
- assigned_account_manager: null (sätts automatiskt till samma som sales_person)
- account_manager_email: null (sätts automatiskt till samma som sales_person_email)
- business_type: "business" för företag/AB/HB, "organization" för bostadsrättsföreningar/HSB/kommuner, "private" för privatpersoner
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

    if (pdfBase64.length > 6_000_000) {
      return res.status(400).json({ error: 'PDF-filen är för stor (max ~4MB)' })
    }

    console.log('=== EXTRACT BEGONE CONTRACT PDF START ===')
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
            { text: BEGONE_EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 4000,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            company_name: { type: ['string', 'null'], description: 'Kundens företagsnamn (INTE BeGone)' },
            organization_number: { type: ['string', 'null'], description: 'Organisationsnummer (format XXXXXX-XXXX)' },
            contact_person: { type: ['string', 'null'], description: 'Kontaktperson på kundsidan' },
            contact_email: { type: ['string', 'null'], description: 'E-postadress till kontaktperson' },
            contact_phone: { type: ['string', 'null'], description: 'Telefonnummer till kontaktperson' },
            contact_address: { type: ['string', 'null'], description: 'Kundens besöks-/objektadress' },
            billing_email: { type: ['string', 'null'], description: 'Fakturamail om separat, annars null' },
            billing_address: { type: ['string', 'null'], description: 'Fakturaadress om separat, annars null' },
            contract_start_date: { type: ['string', 'null'], description: 'Startdatum (YYYY-MM-DD)' },
            contract_end_date: { type: ['string', 'null'], description: 'Slutdatum (YYYY-MM-DD)' },
            contract_length: { type: ['string', 'null'], description: 'Avtalslängd (t.ex. "1 år", "6 månader")' },
            annual_value: { type: ['number', 'null'], description: 'Årligt värde i SEK (exkl. moms)' },
            agreement_text: { type: ['string', 'null'], description: 'Sammanfattning av tjänster och objekt' },
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
            sales_person: { type: ['string', 'null'], description: 'BeGones säljare' },
            sales_person_email: { type: ['string', 'null'], description: 'BeGones säljarens e-post' },
            assigned_account_manager: { type: ['string', 'null'], description: 'Account manager på BeGone' },
            account_manager_email: { type: ['string', 'null'], description: 'Account managers e-post' },
            business_type: { type: ['string', 'null'], description: '"business", "organization" eller "private"' },
            confidence_score: { type: 'integer', description: 'Konfidenspoäng 0-100' },
            extraction_notes: { type: 'string', description: 'Noteringar om extraktionen (på svenska)' },
          },
          required: [
            'company_name', 'organization_number', 'contact_person', 'contact_email',
            'contact_phone', 'contact_address', 'billing_email', 'billing_address',
            'contract_start_date', 'contract_end_date', 'contract_length',
            'annual_value', 'agreement_text', 'products',
            'sales_person', 'sales_person_email', 'assigned_account_manager', 'account_manager_email',
            'business_type', 'confidence_score', 'extraction_notes',
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

    // Post-processing: ersätt @xbekampning.se med @begone.se (bolagsövergång)
    const replaceXpert = (email: string | null) =>
      email ? email.replace(/@xbekampning\.se$/i, '@begone.se') : email

    extractedData.sales_person_email = replaceXpert(extractedData.sales_person_email)
    extractedData.account_manager_email = replaceXpert(extractedData.account_manager_email)

    // Säljare = account manager (alltid samma person)
    extractedData.assigned_account_manager = extractedData.sales_person
    extractedData.account_manager_email = extractedData.sales_person_email

    console.log('=== EXTRACT BEGONE CONTRACT PDF SUCCESS ===')
    console.log('Extracted company:', extractedData.company_name)
    console.log('Confidence:', extractedData.confidence_score)

    return res.status(200).json({
      success: true,
      data: extractedData,
    })
  } catch (error: any) {
    console.error('=== EXTRACT BEGONE CONTRACT PDF ERROR ===')
    console.error('Error:', error.message)
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid extrahering av avtalsdata',
    })
  }
}
