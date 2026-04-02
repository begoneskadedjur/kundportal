// Intern proxy för alla Fortnox API-anrop från frontend
// Hanterar token-refresh automatiskt
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getValidAccessToken } from './refresh'

const FORTNOX_API = 'https://api.fortnox.se/3'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query

  if (!path) {
    return res.status(400).json({ error: 'Saknar path-parameter' })
  }

  let accessToken: string
  try {
    accessToken = await getValidAccessToken()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    return res.status(401).json({ error: message })
  }

  const fortnoxPath = Array.isArray(path) ? path.join('/') : path

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
