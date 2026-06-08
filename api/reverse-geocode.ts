// api/reverse-geocode.ts
// Server-side reverse geocoding — undviker CORS-problem med client-side Geocoding API

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { lat, lng } = req.body
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat och lng krävs' })
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY saknas i miljövariabler' })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=sv`
    const r = await fetch(url)
    const data = await r.json()

    if (data.status !== 'OK' || !data.results?.length) {
      return res.status(200).json({ address: null })
    }

    const address = data.results[0].formatted_address ?? null
    return res.status(200).json({ address })
  } catch (err: any) {
    console.error('[reverse-geocode] fel:', err)
    return res.status(500).json({ error: err.message || 'Okänt fel' })
  }
}
