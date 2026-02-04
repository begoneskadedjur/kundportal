// api/embeddings.ts
// Hanterar generering och sökning av embeddings för RAG i Team Chat
// Använder Google Gemini gemini-embedding-001 modell

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel function config - 5 minuters timeout för sync
export const config = {
  maxDuration: 300,
};
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generera embedding för en text
async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

  const result = await model.embedContent({
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT' as any,
  });

  return result.embedding.values;
}

// Generera embedding för en sökfråga
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

  const result = await model.embedContent({
    content: { parts: [{ text: query }] },
    taskType: 'RETRIEVAL_QUERY' as any,
  });

  return result.embedding.values;
}

// Formatera kunddata till sökbar text
function formatCustomerForEmbedding(customer: any): string {
  return `
Kund: ${customer.company_name || 'Okänt företag'}
Kontaktperson: ${customer.contact_person || '-'}
Email: ${customer.contact_email || '-'}
Telefon: ${customer.contact_phone || '-'}
Adress: ${customer.contact_address || '-'}
Årsvärde: ${customer.annual_value?.toLocaleString('sv-SE') || 0} kr
Kontraktsstart: ${customer.contract_start_date || '-'}
Kontraktsslut: ${customer.contract_end_date || '-'}
Faktureringsfrekvens: ${customer.billing_frequency || '-'}
  `.trim();
}

// Formatera ärendedata till sökbar text
function formatCaseForEmbedding(caseData: any, type: string): string {
  return `
Ärende: ${caseData.title || 'Utan titel'}
Typ: ${type === 'privat' ? 'Privatärende' : 'Företagsärende'}
Status: ${caseData.status || '-'}
Skadedjur: ${caseData.skadedjur || '-'}
Pris: ${caseData.pris?.toLocaleString('sv-SE') || 0} kr
Adress: ${caseData.adress || '-'}
Kontaktperson: ${caseData.kontaktperson || '-'}
Telefon: ${caseData.telefon_kontaktperson || '-'}
Email: ${caseData.e_post_kontaktperson || '-'}
Tilldelad tekniker: ${caseData.primary_assignee_name || '-'}
Skapad: ${caseData.created_at ? new Date(caseData.created_at).toLocaleDateString('sv-SE') : '-'}
Avslutad: ${caseData.completed_date ? new Date(caseData.completed_date).toLocaleDateString('sv-SE') : '-'}
Faktureringsstatus: ${caseData.billing_status || '-'}
  `.trim();
}

// Formatera teknikerdata till sökbar text
function formatTechnicianForEmbedding(tech: any): string {
  return `
Tekniker: ${tech.name || 'Okänt namn'}
Roll: ${tech.role || '-'}
Email: ${tech.email || '-'}
Direkttelefon: ${tech.direct_phone || '-'}
Kontorstelefon: ${tech.office_phone || '-'}
Adress: ${tech.address || '-'}
Aktiv: ${tech.is_active ? 'Ja' : 'Nej'}
  `.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, query, filter_type, limit = 10 } = req.body;

    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google AI API-nyckel saknas'
      });
    }

    // Sök efter liknande dokument
    if (action === 'search') {
      if (!query) {
        return res.status(400).json({ success: false, error: 'Sökfråga krävs' });
      }

      console.log('[Embeddings] Searching for:', query);

      // Generera embedding för frågan
      const queryEmbedding = await generateQueryEmbedding(query);

      // Sök i databasen
      const { data, error } = await supabase.rpc('search_similar_documents', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_count: limit,
        filter_type: filter_type || null
      });

      if (error) {
        console.error('[Embeddings] Search error:', error);
        throw error;
      }

      console.log('[Embeddings] Found', data?.length || 0, 'results');

      return res.status(200).json({
        success: true,
        results: data || [],
        query,
        timestamp: new Date().toISOString()
      });
    }

    // Synkronisera alla embeddings
    if (action === 'sync') {
      console.log('[Embeddings] Starting sync with batch processing...');

      let stats = {
        customers: 0,
        privateCases: 0,
        businessCases: 0,
        technicians: 0,
        errors: 0
      };

      // Batch-inställningar för parallell bearbetning
      const batchSize = 25;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Hämta all data
      const [customersRes, techsRes, privateCasesRes, businessCasesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('is_active', true),
        supabase.from('technicians').select('*').eq('is_active', true),
        supabase.from('private_cases').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('business_cases').select('*').order('created_at', { ascending: false }).limit(300)
      ]);

      // Rensa gamla embeddings
      await supabase.from('document_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Processa kunder i batchar
      const customers = customersRes.data || [];
      console.log(`[Embeddings] Processing ${customers.length} customers in batches of ${batchSize}`);
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        await Promise.all(batch.map(async (customer) => {
          try {
            const text = formatCustomerForEmbedding(customer);
            const embedding = await generateEmbedding(text);
            await supabase.from('document_embeddings').insert({
              content: text,
              content_type: 'customer',
              source_id: customer.id,
              source_table: 'customers',
              embedding: `[${embedding.join(',')}]`,
              metadata: { company_name: customer.company_name, annual_value: customer.annual_value }
            });
            stats.customers++;
          } catch (err) {
            stats.errors++;
          }
        }));
        if (i + batchSize < customers.length) await delay(500);
      }

      // Processa tekniker i batchar
      const technicians = techsRes.data || [];
      console.log(`[Embeddings] Processing ${technicians.length} technicians`);
      for (let i = 0; i < technicians.length; i += batchSize) {
        const batch = technicians.slice(i, i + batchSize);
        await Promise.all(batch.map(async (tech) => {
          try {
            const text = formatTechnicianForEmbedding(tech);
            const embedding = await generateEmbedding(text);
            await supabase.from('document_embeddings').insert({
              content: text,
              content_type: 'technician',
              source_id: tech.id,
              source_table: 'technicians',
              embedding: `[${embedding.join(',')}]`,
              metadata: { name: tech.name, role: tech.role }
            });
            stats.technicians++;
          } catch (err) {
            stats.errors++;
          }
        }));
        if (i + batchSize < technicians.length) await delay(500);
      }

      // Processa privatärenden i batchar (senaste 200)
      const privateCases = (privateCasesRes.data || []).slice(0, 200);
      console.log(`[Embeddings] Processing ${privateCases.length} private cases`);
      for (let i = 0; i < privateCases.length; i += batchSize) {
        const batch = privateCases.slice(i, i + batchSize);
        await Promise.all(batch.map(async (caseData) => {
          try {
            const text = formatCaseForEmbedding(caseData, 'privat');
            const embedding = await generateEmbedding(text);
            await supabase.from('document_embeddings').insert({
              content: text,
              content_type: 'case',
              source_id: caseData.id,
              source_table: 'private_cases',
              embedding: `[${embedding.join(',')}]`,
              metadata: { title: caseData.title, status: caseData.status, skadedjur: caseData.skadedjur, case_type: 'privat' }
            });
            stats.privateCases++;
          } catch (err) {
            stats.errors++;
          }
        }));
        if (i + batchSize < privateCases.length) await delay(500);
      }

      // Processa företagsärenden i batchar (senaste 200)
      const businessCases = (businessCasesRes.data || []).slice(0, 200);
      console.log(`[Embeddings] Processing ${businessCases.length} business cases`);
      for (let i = 0; i < businessCases.length; i += batchSize) {
        const batch = businessCases.slice(i, i + batchSize);
        await Promise.all(batch.map(async (caseData) => {
          try {
            const text = formatCaseForEmbedding(caseData, 'företag');
            const embedding = await generateEmbedding(text);
            await supabase.from('document_embeddings').insert({
              content: text,
              content_type: 'case',
              source_id: caseData.id,
              source_table: 'business_cases',
              embedding: `[${embedding.join(',')}]`,
              metadata: { title: caseData.title, status: caseData.status, skadedjur: caseData.skadedjur, case_type: 'företag' }
            });
            stats.businessCases++;
          } catch (err) {
            stats.errors++;
          }
        }));
        if (i + batchSize < businessCases.length) await delay(500);
      }

      console.log('[Embeddings] Sync complete:', stats);

      return res.status(200).json({
        success: true,
        stats,
        message: `Synkroniserat ${stats.customers} kunder, ${stats.technicians} tekniker, ${stats.privateCases} privatärenden, ${stats.businessCases} företagsärenden`,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Ogiltig action. Använd "search" eller "sync".'
    });

  } catch (error) {
    console.error('[Embeddings] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';

    return res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}
