// api/cron/sync-embeddings.ts
// Schemalagd synkronisering av RAG-embeddings
// Körs automatiskt varje natt kl 02:00 via Vercel Cron

import type { VercelRequest, VercelResponse } from '@vercel/node';
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

// Formatera data till sökbar text
function formatCustomer(customer: any): string {
  return `Kund: ${customer.company_name || 'Okänt'} | Kontakt: ${customer.contact_person || '-'} | Email: ${customer.contact_email || '-'} | Telefon: ${customer.contact_phone || '-'} | Årsvärde: ${customer.annual_value?.toLocaleString('sv-SE') || 0} kr`.trim();
}

function formatCase(c: any, type: string): string {
  return `Ärende: ${c.title || 'Utan titel'} | Typ: ${type} | Status: ${c.status || '-'} | Skadedjur: ${c.skadedjur || '-'} | Pris: ${c.pris?.toLocaleString('sv-SE') || 0} kr | Adress: ${c.adress || '-'} | Kontakt: ${c.kontaktperson || '-'} | Tekniker: ${c.primary_assignee_name || '-'}`.trim();
}

function formatTechnician(tech: any): string {
  return `Tekniker: ${tech.name || 'Okänt'} | Roll: ${tech.role || '-'} | Email: ${tech.email || '-'} | Telefon: ${tech.direct_phone || '-'}`.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verifiera att det är ett cron-anrop (Vercel sätter denna header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Tillåt även manuella anrop utan CRON_SECRET i dev
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('[Cron] Starting embeddings sync at', new Date().toISOString());

  try {
    let stats = { customers: 0, technicians: 0, privateCases: 0, businessCases: 0, errors: 0 };

    // Hämta all data
    const [customersRes, techsRes, privateCasesRes, businessCasesRes] = await Promise.all([
      supabase.from('customers').select('*').eq('is_active', true),
      supabase.from('technicians').select('*').eq('is_active', true),
      supabase.from('private_cases').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('business_cases').select('*').order('created_at', { ascending: false }).limit(300)
    ]);

    // Rensa gamla embeddings
    await supabase.from('document_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Batch-processa för att undvika rate limits
    const batchSize = 50;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Processa kunder
    const customers = customersRes.data || [];
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      await Promise.all(batch.map(async (customer) => {
        try {
          const text = formatCustomer(customer);
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
      if (i + batchSize < customers.length) await delay(1000); // Rate limit pause
    }

    // Processa tekniker
    for (const tech of techsRes.data || []) {
      try {
        const text = formatTechnician(tech);
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
    }

    // Processa privatärenden
    const privateCases = (privateCasesRes.data || []).slice(0, 200);
    for (let i = 0; i < privateCases.length; i += batchSize) {
      const batch = privateCases.slice(i, i + batchSize);
      await Promise.all(batch.map(async (c) => {
        try {
          const text = formatCase(c, 'Privatärende');
          const embedding = await generateEmbedding(text);
          await supabase.from('document_embeddings').insert({
            content: text,
            content_type: 'case',
            source_id: c.id,
            source_table: 'private_cases',
            embedding: `[${embedding.join(',')}]`,
            metadata: { title: c.title, status: c.status, skadedjur: c.skadedjur, case_type: 'privat' }
          });
          stats.privateCases++;
        } catch (err) {
          stats.errors++;
        }
      }));
      if (i + batchSize < privateCases.length) await delay(1000);
    }

    // Processa företagsärenden
    const businessCases = (businessCasesRes.data || []).slice(0, 200);
    for (let i = 0; i < businessCases.length; i += batchSize) {
      const batch = businessCases.slice(i, i + batchSize);
      await Promise.all(batch.map(async (c) => {
        try {
          const text = formatCase(c, 'Företagsärende');
          const embedding = await generateEmbedding(text);
          await supabase.from('document_embeddings').insert({
            content: text,
            content_type: 'case',
            source_id: c.id,
            source_table: 'business_cases',
            embedding: `[${embedding.join(',')}]`,
            metadata: { title: c.title, status: c.status, skadedjur: c.skadedjur, case_type: 'företag' }
          });
          stats.businessCases++;
        } catch (err) {
          stats.errors++;
        }
      }));
      if (i + batchSize < businessCases.length) await delay(1000);
    }

    console.log('[Cron] Embeddings sync complete:', stats);

    return res.status(200).json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Cron] Embeddings sync error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel'
    });
  }
}
