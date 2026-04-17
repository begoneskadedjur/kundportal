// api/oneflow/extend-signing-period.ts - Förläng signeringsperioden för en offert/avtal i Oneflow
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface ExtendSigningPeriodBody {
  contractId: string // Supabase UUID (contracts.id)
  expireDate: string // YYYY-MM-DD
}

// Oneflow state → vår status (samma mappning som sync-offers.ts)
const STATUS_MAP: Record<string, string> = {
  pending: 'pending',
  signed: 'signed',
  declined: 'declined',
  overdue: 'overdue',
  canceled: 'declined',
  published: 'pending',
  completed: 'signed',
  cancelled: 'declined',
  expired: 'overdue',
}

function isValidFutureDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return d.getTime() > today.getTime()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { contractId, expireDate } = (req.body || {}) as ExtendSigningPeriodBody

  if (!contractId || !expireDate) {
    return res.status(400).json({ message: 'contractId och expireDate krävs' })
  }

  if (!isValidFutureDate(expireDate)) {
    return res.status(400).json({
      message: 'expireDate måste vara ett giltigt framtida datum (YYYY-MM-DD)',
    })
  }

  const token = process.env.ONEFLOW_API_TOKEN!
  const userEmail = 'info@begone.se'

  if (!token) {
    return res.status(500).json({ message: 'Server configuration error: missing Oneflow token' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // 1. Hämta kontraktet
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, oneflow_contract_id, status')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      return res.status(404).json({ message: 'Kontraktet hittades inte' })
    }

    if (!contract.oneflow_contract_id) {
      return res.status(400).json({ message: 'Kontraktet saknar Oneflow-ID' })
    }

    // 2. Validera att status tillåter förlängning
    const blockedStatuses = ['signed', 'declined', 'trashed']
    if (blockedStatuses.includes(contract.status)) {
      return res.status(400).json({
        message: `Kan inte förlänga signeringsperiod för kontrakt med status "${contract.status}"`,
      })
    }

    // 3. PUT mot Oneflow för att uppdatera signing_period_expiration
    const oneflowHeaders = {
      'x-oneflow-api-token': token,
      'x-oneflow-user-email': userEmail,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }

    const updateResponse = await fetch(
      `https://api.oneflow.com/v1/contracts/${contract.oneflow_contract_id}`,
      {
        method: 'PUT',
        headers: oneflowHeaders,
        body: JSON.stringify({
          _private: {
            signing_period_expiration: {
              type: 'fixed_date',
              expire_date: expireDate,
            },
          },
        }),
      }
    )

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}))
      console.error('Oneflow PUT misslyckades:', updateResponse.status, errorData)
      return res.status(updateResponse.status >= 500 ? 502 : updateResponse.status).json({
        message: errorData.message || 'Kunde inte uppdatera signeringsperiod i Oneflow',
        oneflow_error: errorData,
      })
    }

    // 4. Hämta uppdaterad contract-info för att få nya statusen
    let newStatus = contract.status
    try {
      const detailResponse = await fetch(
        `https://api.oneflow.com/v1/contracts/${contract.oneflow_contract_id}`,
        { headers: oneflowHeaders }
      )
      if (detailResponse.ok) {
        const detail = await detailResponse.json() as { state?: string }
        if (detail.state && STATUS_MAP[detail.state]) {
          newStatus = STATUS_MAP[detail.state]
        }
      }
    } catch (detailErr) {
      console.warn('Kunde inte hämta uppdaterad status från Oneflow:', detailErr)
    }

    // 5. Uppdatera DB
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId)

    if (updateError) {
      console.error('Kunde inte uppdatera kontraktet i DB:', updateError)
      return res.status(500).json({ message: 'Kunde inte uppdatera databasen' })
    }

    return res.status(200).json({
      success: true,
      newStatus,
      expireDate,
    })
  } catch (error) {
    console.error('Internt serverfel vid förlängning:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
