// api/_lib/begoneSeCors.ts
// CORS för publika endpoints som anropas från nya begone.se (artanalysen och förfrågningarna).
// Tillåtet: begone.se, www.begone.se, förhandsvisningar för Vercel-projektet begone-se och
// den lokala Astro-servern på port 4321. Anrop med annan eller saknad Origin nekas av anroparen (403).

import type { VercelRequest, VercelResponse } from '@vercel/node'

const TILLATNA = new Set(['https://begone.se', 'https://www.begone.se', 'http://localhost:4321', 'http://127.0.0.1:4321'])
// Vercel-projektet begone-se: begone-se-<hash>-<team>.vercel.app, begone-se-git-<gren>-<team>.vercel.app
// och begone-se-<team>.vercel.app.
const VERCEL_PREVIEW = /^https:\/\/begone-se(-[a-z0-9-]+)?\.vercel\.app$/

export function tillatenOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  return TILLATNA.has(origin) || VERCEL_PREVIEW.test(origin)
}

/** Sätter CORS-huvudena. Returnerar false när Origin inte är tillåten. */
export function satsBegoneSeCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
  res.setHeader('Vary', 'Origin')
  if (!tillatenOrigin(origin)) return false
  res.setHeader('Access-Control-Allow-Origin', origin!)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
  return true
}
