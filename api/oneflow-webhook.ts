// api/oneflow-webhook.ts - Legacy endpoint som redirectar till nya webhook handler
// Detta behövs eftersom OneFlow är konfigurerat att använda denna URL

import type { VercelRequest, VercelResponse } from '@vercel/node'

// Importera huvudwebhook handler
import webhookHandler from './oneflow/webhook'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔀 Legacy webhook endpoint anropad, redirectar till huvudhandler...')
  
  // Skicka vidare till huvudwebhook handler
  return await webhookHandler(req, res)
}