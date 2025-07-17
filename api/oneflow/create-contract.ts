import type { VercelRequest, VercelResponse } from '@vercel/node'
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
  req: VercelRequest,
  res: VercelResponse
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

  if (!token || !userEmail || !workspaceId) {
    console.error('Saknade miljövariabler för Oneflow-integrationen')
    return res.status(500).json({ message: 'Server configuration error.' })
  }

  const data_fields = Object.entries(contractData).map(
    ([custom_id, value]) => ({ custom_id, value })
  )

  const parties = []

  if (partyType === 'individual') {
    // KORRIGERAD STRUKTUR FÖR PRIVATPERSON ENLIGT DOKUMENTATION
    // Använder ett 'participant'-objekt (singular).
    parties.push({
      type: 'individual',
      participant: {
        name: recipient.name,
        email: recipient.email,
        _permissions: {
          'contract:update': sendForSigning
        },
        signatory: sendForSigning,
        delivery_channel: 'email'
      }
    })
  } else {
    // KORREKT STRUKTUR FÖR FÖRETAG (BEVARAD)
    // Använder en 'participants'-array (plural).
    parties.push({
      type: 'company',
      name: recipient.company_name,
      identification_number: recipient.organization_number,
      participants: [
        {
          name: recipient.name,
          email: recipient.email,
          _permissions: {
            'contract:update': sendForSigning
          },
          signatory: sendForSigning,
          delivery_channel: 'email'
        }
      ]
    })
  }

  const createPayload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties
  }

  console.log('Skickar följande create payload till Oneflow:', JSON.stringify(createPayload, null, 2))

  try {
    const createResponse = await fetch(
      'https://api.oneflow.com/v1/contracts/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oneflow-api-token': token,
          'x-oneflow-user-email': userEmail,
          Accept: 'application/json',
        },
        body: JSON.stringify(createPayload),
      }
    )

    const createdContract = await createResponse.json()
    
    if (!createResponse.ok) {
      console.error('Fel vid skapande av kontrakt:', JSON.stringify(createdContract, null, 2))
      return res.status(createResponse.status).json(createdContract)
    }

    console.log('✅ Kontrakt skapat framgångsrikt:', createdContract.id)

    if (sendForSigning) {
      console.log('🚀 Publicerar kontrakt för signering...')
      
      const publishPayload = {
        subject: `Avtal från BeGone Skadedjur & Sanering AB`,
        message: `Hej ${recipient.name}!\n\nBifogat finner du vårt avtal för signering.\n\nVänliga hälsningar,\nBeGone Skadedjur & Sanering AB`
      }

      const publishResponse = await fetch(
        `https://api.oneflow.com/v1/contracts/${createdContract.id}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-oneflow-api-token': token,
            'x-oneflow-user-email': userEmail,
            Accept: 'application/json',
          },
          body: JSON.stringify(publishPayload),
        }
      )

      if (!publishResponse.ok) {
        const publishError = await publishResponse.json()
        console.error('⚠️ Kontrakt skapat men kunde inte publiceras:', JSON.stringify(publishError, null, 2))
        
        return res.status(200).json({ 
          contract: createdContract,
          warning: 'Kontrakt skapat men kunde inte skickas för signering automatiskt',
          publishError: publishError
        })
      }

      console.log('✅ Kontrakt publicerat och skickat för signering')
    }

    return res.status(200).json({ contract: createdContract })
    
  } catch (error) {
    console.error('Internt serverfel vid anrop till Oneflow:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}