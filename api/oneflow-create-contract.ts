import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

interface ContractRequestBody {
  templateId: string
  contractData: Record<string, string>
  recipient: {
    name: string
    email: string
    company_name?: string
    organization_number?: string
  }
  sendForSigning: boolean
  partyType: 'company' | 'individual'
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const {
    templateId,
    contractData,
    recipient,
    sendForSigning,
    partyType,
  } = req.body as ContractRequestBody

  const token = process.env.ONEFLOW_API_TOKEN!
  const userEmail = process.env.ONEFLOW_USER_EMAIL!
  const workspaceId = process.env.ONEFLOW_WORKSPACE_ID!

  // Map all provided contractData keys to Oneflow data_fields
  const data_fields = Object.entries(contractData).map(
    ([custom_id, value]) => ({ custom_id, value })
  )

  // Build party object with participants and proper permissions
  const party: any = { type: partyType }
  if (partyType === 'company') {
    // Om parten är ett företag, använd företagsinformation
    party.name = recipient.company_name
    party.identification_number = recipient.organization_number
  } else {
    // Om parten är en privatperson, använd personens namn
    party.name = recipient.name
  }
  
  // Lägg till deltagaren (mottagaren) i parten
  party.participants = [
    {
      name: recipient.name,
      email: recipient.email,
      // ---- FIX: Nyckeln ska vara "permissions", inte "_permissions" ----
      permissions: sendForSigning
        ? ['contract:update', 'contract:sign']
        : ['contract:read'],
    },
  ]

  // Förbered den slutgiltiga payloaden som ska skickas till Oneflow
  const payload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties: [party],
    publish: sendForSigning,
  }

  // ---- FELSÖKNING: Logga payloaden för att se exakt vad som skickas ----
  console.log('Skickar följande payload till Oneflow:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(
      'https://api.oneflow.com/v1/contracts/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Oneflow-API-Token': token,
          'X-Oneflow-User-Email': userEmail,
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const body = await response.json()
    
    // Om anropet inte lyckades (status är inte 2xx)
    if (!response.ok) {
      // ---- FELSÖKNING: Logga det specifika felet från Oneflow på servern ----
      console.error('Fel från Oneflows API:', JSON.stringify(body, null, 2));
      // Skicka tillbaka Oneflows felmeddelande till klienten
      return res.status(response.status).json(body)
    }

    // Om anropet lyckades, returnera det skapade kontraktet
    return res.status(200).json({ contract: body })
    
  } catch (error) {
    // Om ett nätverksfel eller annat oväntat fel inträffar
    console.error('Internt serverfel vid anrop till Oneflow:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}