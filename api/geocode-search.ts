// api/geocode-search.ts
// Server-side adresssökning — undviker CORS-problem med client-side Geocoding API

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query?.trim()) {
    return res.status(400).json({ error: 'query krävs' })
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY saknas i miljövariabler' })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}&language=sv&region=se&components=country:SE`
    const r = await fetch(url)
    const data = await r.json()

    if (data.status === 'ZERO_RESULTS' || data.status !== 'OK') {
      return res.status(200).json({ results: [] })
    }

    const results = (data.results ?? []).slice(0, 5).map((item: any) => ({
      location: { lat: item.geometry.location.lat, lng: item.geometry.location.lng },
      formatted_address: item.formatted_address,
      place_id: item.place_id,
    }))

    return res.status(200).json({ results })
  } catch (err: any) {
    console.error('[geocode-search] fel:', err)
    return res.status(500).json({ error: err.message || 'Okänt fel' })
  }
}
