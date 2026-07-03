// Intern proxy för alla Fortnox API-anrop från frontend
// Hanterar token-refresh automatiskt
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth'
import { getValidAccessToken } from './refresh'

const FORTNOX_API = 'https://api.fortnox.se/3'

// Bara de resurser frontendens FortnoxService faktiskt använder får proxas.
// Ny Fortnox-resurs? Lägg till här OCH kontrollera att OAuth-scopet täcker den (api/fortnox/auth.ts).
const ALLOWED_RESOURCES = new Set(['customers', 'invoices', 'articles', 'companyinformation'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req, res, ['admin', 'koordinator'])
  if (!auth) return

  const { path } = req.query

  if (!path) {
    return res.status(400).json({ error: 'Saknar path-parameter' })
  }

  const fortnoxPath = Array.isArray(path) ? path.join('/') : path

  if (!/^[A-Za-z0-9/_-]+$/.test(fortnoxPath)) {
    return res.status(400).json({ error: 'Ogiltig path-parameter' })
  }
  const resource = fortnoxPath.split('/')[0].toLowerCase()
  if (!ALLOWED_RESOURCES.has(resource)) {
    return res.status(403).json({ error: `Fortnox-resursen '${resource}' är inte tillåten via proxyn` })
  }

  let accessToken: string
  try {
    accessToken = await getValidAccessToken()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    return res.status(502).json({ error: message })
  }

  // Vidarebefordra eventuella extra query-parametrar (allt utom 'path') till Fortnox
  const extraParams = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue
    if (Array.isArray(value)) {
      value.forEach(v => extraParams.append(key, v))
    } else if (value) {
      extraParams.append(key, value)
    }
  }
  const queryString = extraParams.toString()
  const url = `${FORTNOX_API}/${fortnoxPath}${queryString ? `?${queryString}` : ''}`

  const fortnoxRes = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
  })

  const data = await fortnoxRes.json()
  return res.status(fortnoxRes.status).json(data)
}
