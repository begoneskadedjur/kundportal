// api/geolocate.ts
// Proxy för Google Geolocation API — håller API-nyckeln server-side

import { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' })

  // Död endpoint utan UI-anropare - låst till admin (säkerhetsaudit juni 2026)
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  const body: Record<string, unknown> = { considerIp: true }
  if (req.body?.wifiAccessPoints) body.wifiAccessPoints = req.body.wifiAccessPoints
  if (req.body?.cellTowers) body.cellTowers = req.body.cellTowers

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Google Maps API-nyckel saknas i miljövariabler' })

  try {
    const response = await fetch(
      `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('[geolocate] Google API fel:', response.status, errText)
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json() as {
      location: { lat: number; lng: number }
      accuracy: number
    }

    return res.status(200).json({
      lat: data.location.lat,
      lng: data.location.lng,
      accuracy: data.accuracy,
    })
  } catch (err: any) {
    console.error('[geolocate] Fel:', err)
    return res.status(500).json({ error: err.message || 'Internt serverfel' })
  }
}
