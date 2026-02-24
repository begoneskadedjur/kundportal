// api/oneflow/delete-offer.ts - Radera offert/avtal från Oneflow + uppdatera DB
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface DeleteOfferRequestBody {
  contractId: string // Supabase UUID (contracts.id)
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { contractId } = req.body as DeleteOfferRequestBody

  if (!contractId) {
    return res.status(400).json({ message: 'contractId krävs' })
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
    // 1. Hämta kontraktet från DB
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, oneflow_contract_id, source_id, source_type, company_name, contact_person, type, status')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      console.error('Kunde inte hitta kontraktet:', fetchError)
      return res.status(404).json({ message: 'Kontraktet hittades inte' })
    }

    // 2. Radera från Oneflow API
    if (contract.oneflow_contract_id) {
      try {
        const deleteResponse = await fetch(
          `https://api.oneflow.com/v1/contracts/${contract.oneflow_contract_id}`,
          {
            method: 'DELETE',
            headers: {
              'x-oneflow-api-token': token,
              'x-oneflow-user-email': userEmail,
              Accept: 'application/json',
            },
          }
        )

        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}))
          console.error('Oneflow DELETE misslyckades:', deleteResponse.status, errorData)
          // Fortsätt ändå — vi markerar som deleted i DB
          // (Oneflow kan redan ha raderat kontraktet)
          if (deleteResponse.status !== 404) {
            return res.status(deleteResponse.status).json({
              message: 'Kunde inte radera från Oneflow',
              oneflow_error: errorData
            })
          }
        } else {
          console.log(`Oneflow-kontrakt ${contract.oneflow_contract_id} raderat`)
        }
      } catch (oneflowError) {
        console.error('Oneflow API-anrop misslyckades:', oneflowError)
        // Fortsätt — markera som deleted i DB ändå
      }
    }

    // 3. Uppdatera status i DB till 'deleted'
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId)

    if (updateError) {
      console.error('Kunde inte uppdatera kontraktet i DB:', updateError)
      return res.status(500).json({ message: 'Kunde inte uppdatera databasen' })
    }

    console.log(`Kontrakt ${contractId} markerat som deleted`)

    return res.status(200).json({
      success: true,
      source_id: contract.source_id || null,
      source_type: contract.source_type || null,
      company_name: contract.company_name || contract.contact_person || null,
    })
  } catch (error) {
    console.error('Internt serverfel vid radering:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
