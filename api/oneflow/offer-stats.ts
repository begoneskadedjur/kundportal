// api/oneflow/offer-stats.ts — Offertstatistik med Supabase-cache
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Offer template IDs
const OFFER_TEMPLATE_IDS = new Set(['8598798', '8919037', '8919012', '8919059'])

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minuter

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

interface OneFlowContract {
  id: number
  state: string
  _private_ownerside?: {
    template_id?: number
  }
  template?: {
    id: number
  }
}

/** Hämta alla offerter från Oneflow API med paginering */
async function fetchAllOffersFromOneflow(): Promise<OneFlowContract[]> {
  const allOffers: OneFlowContract[] = []
  let offset = 0
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const response = await fetch(
      `https://api.oneflow.com/v1/contracts?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': 'info@begone.se',
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(`Oneflow API error: ${response.status}`)
      break
    }

    const data = await response.json() as any
    const contracts: OneFlowContract[] = Array.isArray(data) ? data : data.data || []

    // Filtrera på offer templates
    for (const contract of contracts) {
      if (contract.state === 'draft') continue

      const templateId =
        contract._private_ownerside?.template_id?.toString() ||
        contract.template?.id?.toString()

      if (templateId && OFFER_TEMPLATE_IDS.has(templateId)) {
        allOffers.push(contract)
      }
    }

    hasMore = !Array.isArray(data) && !!data._links?.next
    offset += limit

    // Säkerhetsgräns
    if (offset > 5000) break
  }

  return allOffers
}

/** Beräkna statistik från offerter */
function calculateStats(offers: OneFlowContract[]) {
  let signed = 0
  let declined = 0
  let pending = 0
  let overdue = 0

  for (const offer of offers) {
    switch (offer.state) {
      case 'signed':
        signed++
        break
      case 'declined':
      case 'cancelled':
        declined++
        break
      case 'pending':
      case 'published':
        pending++
        break
      case 'expired':
      case 'overdue':
        overdue++
        break
    }
  }

  const totalSent = offers.length
  const resolved = signed + declined + overdue
  const signRate = resolved > 0 ? Math.round((signed / resolved) * 100 * 100) / 100 : 0

  return {
    total_sent: totalSent,
    signed,
    declined,
    pending,
    overdue,
    sign_rate: signRate,
    total_value_sent: 0,
    total_value_signed: 0,
  }
}

/** Uppdatera cache i Supabase */
async function updateCache(period: string, stats: ReturnType<typeof calculateStats>) {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('offer_statistics')
    .upsert(
      {
        period,
        ...stats,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: 'period' }
    )

  if (error) {
    console.error(`Cache update error for ${period}:`, error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (!ONEFLOW_API_TOKEN) {
    return res.status(500).json({ success: false, error: 'ONEFLOW_API_TOKEN saknas' })
  }

  try {
    const forceRefresh = req.method === 'POST'

    // Kolla om cachen är aktuell
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('offer_statistics')
        .select('*')
        .eq('period', 'all_time')
        .maybeSingle()

      if (cached) {
        const age = Date.now() - new Date(cached.last_synced_at).getTime()
        if (age < CACHE_TTL_MS) {
          return res.status(200).json({
            success: true,
            data: cached,
            cached: true,
          })
        }
      }
    }

    // Hämta från Oneflow API
    console.log('Hämtar offertstatistik från Oneflow API...')
    const offers = await fetchAllOffersFromOneflow()
    console.log(`Hittade ${offers.length} offerter i Oneflow`)

    const stats = calculateStats(offers)

    // Spara i cache
    await updateCache('all_time', stats)

    // Hämta uppdaterad cache-post
    const { data: updated } = await supabase
      .from('offer_statistics')
      .select('*')
      .eq('period', 'all_time')
      .single()

    return res.status(200).json({
      success: true,
      data: updated || stats,
      cached: false,
    })
  } catch (error: any) {
    console.error('Offer stats error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internt serverfel',
    })
  }
}
