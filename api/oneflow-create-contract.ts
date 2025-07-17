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
    party.name = recipient.company_name
    party.identification_number = recipient.organization_number
  } else {
    party.name = recipient.name
  }
  party.participants = [
    {
      name: recipient.name,
      email: recipient.email,
      // Signatory needs contract:update and contract:sign permissions
      _permissions: sendForSigning
        ? ['contract:update', 'contract:sign']
        : ['contract:read'],
    },
  ]

  // Prepare create-contract payload
  const payload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties: [party],
    // If sendForSigning=true, publish immediately
    publish: sendForSigning,
  }

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
    if (!response.ok) {
      return res.status(response.status).json(body)
    }

    // Return created contract
    return res.status(200).json({ contract: body })
  } catch (error) {
    console.error('Oneflow create-contract error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
