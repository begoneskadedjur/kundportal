// api/oneflow-webhook.ts - MINIMAL VERSION FÖR ATT TESTA ANSLUTNING
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- MILJÖVARIABLER (ENDAST DE SOM BEHÖVS FÖR TESTET) ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
// "Sign key" från Oneflows webhook-inställningar.
const ONEFLOW_SIGN_KEY = process.env.ONEFLOW_WEBHOOK_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- INTERFACE FÖR ONEFLOWS PAYLOAD ---
interface OneflowWebhookPayload {
  contract: {
    id: number;
  };
  callback_id: string;
  events: Array<{
    created_time: string;
    id: number;
    type: string;
  }>;
  signature: string;
}

// Inaktivera Vercels body parser (Korrekt och nödvändigt)
export const config = {
  api: {
    bodyParser: false,
  },
};

// --- HUVUDFUNKTION (HANDLER) ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Acceptera endast POST-anrop
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('--- 📨 Nytt webhook-anrop mottaget från Oneflow ---');

    // 2. Läs inkommande data
    const rawBody = await getRawBody(req);
    if (!rawBody) {
      console.error('❌ FEL: Tom request body mottogs.');
      return res.status(400).json({ error: 'Empty request body' });
    }

    // 3. Parsa datan från text till ett objekt
    const payload: OneflowWebhookPayload = JSON.parse(rawBody);
    console.log(`📦 Mottagen payload med callback_id: ${payload.callback_id}`);

    // 4. Verifiera signaturen för att säkerställa att anropet är äkta
    if (!verifySignature(payload)) {
      console.error('❌ FEL: Ogiltig signatur. Anropet avvisas.');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    console.log('✅ Signaturen är giltig. Anropet kommer från Oneflow.');

    // 5. Logga de händelser som togs emot
    for (const event of payload.events) {
      console.log(`🔔 Händelse upptäckt: Typ="${event.type}", Kontrakt-ID=${payload.contract.id}`);
    }

    // 6. Spara hela payloaden i databasen som bevis på lyckad mottagning
    await logReceivedPayloadToSupabase(payload);
    console.log('💾 Payload har loggats till Supabase-tabellen "oneflow_sync_log".');

    // 7. Skicka ett "OK"-svar till Oneflow
    console.log('✅ Anropet har hanterats. Skickar status 200 OK till Oneflow.');
    return res.status(200).json({
      success: true,
      message: 'Webhook received, verified, and logged successfully.',
    });

  } catch (error) {
    console.error('❌ Ett oväntat fel inträffade:', error);
    
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// --- HJÄLPFUNKTIONER ---

/**
 * Verifierar signaturen från Oneflow.
 */
function verifySignature(payload: OneflowWebhookPayload): boolean {
  if (!ONEFLOW_SIGN_KEY) {
    console.warn('⚠️ VARNING: ONEFLOW_WEBHOOK_SECRET saknas. Signaturverifiering hoppas över.');
    return true; // För att tillåta testning i en lokal miljö utan nyckel.
  }

  const expectedSignature = crypto
    .createHash('sha1')
    .update(payload.callback_id + ONEFLOW_SIGN_KEY)
    .digest('hex');

  return expectedSignature === payload.signature;
}

/**
 * Sparar den mottagna payloaden i din databas.
 */
async function logReceivedPayloadToSupabase(payload: OneflowWebhookPayload) {
  const { error } = await supabase.from('oneflow_sync_log').insert({
    event_type: payload.events.map(e => e.type).join(', '),
    oneflow_contract_id: payload.contract.id.toString(),
    status: 'received_and_verified', // Enkel status som visar att testet lyckades
    details: payload, // Spara hela payloaden för felsökning
  });

  if (error) {
    console.error('❌ FEL vid loggning till Supabase:', error.message);
  }
}

/**
 * Läser den råa texten från ett inkommande request.
 */
async function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}