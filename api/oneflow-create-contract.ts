import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

interface ContractRequestBody {
  templateId: string;
  contractData: Record<string, string>;
  recipient: {
    name: string;
    email: string;
    company_name?: string;
    organization_number?: string;
  };
  sendForSigning: boolean;
  partyType: 'company' | 'individual';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const {
    templateId,
    contractData,
    recipient,
    sendForSigning,
    partyType,
  } = req.body as ContractRequestBody;

  // Hämta alla nödvändiga miljövariabler
  const token = process.env.ONEFLOW_API_TOKEN!;
  const userEmail = process.env.ONEFLOW_USER_EMAIL!;
  const workspaceId = process.env.ONEFLOW_WORKSPACE_ID!;
  
  // ---- NYTT: Hämta information om ägarparten från miljövariabler ----
  const ownerCompanyName = process.env.ONEFLOW_OWNER_COMPANY_NAME!;
  const ownerOrgNumber = process.env.ONEFLOW_OWNER_ORGANIZATION_NUMBER; // Kan vara valfri

  // Validera att nödvändiga variabler finns
  if (!token || !userEmail || !workspaceId || !ownerCompanyName) {
    console.error('Saknade miljövariabler för Oneflow-integrationen');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // Mappa datafält, precis som tidigare
  const data_fields = Object.entries(contractData).map(
    ([custom_id, value]) => ({ custom_id, value })
  );

  // ---- UPPDATERING: Bygg en komplett lista med BÅDA parter ----

  // 1. Skapa objekt för ÄGARPARTEN (ert företag)
  const ownerParty = {
    type: 'company',
    name: ownerCompanyName,
    identification_number: ownerOrgNumber || '',
    participants: [
      {
        name: 'Avsändare', // Eller ett specifikt namn om du vill
        email: userEmail,
        // Ägaren har fulla rättigheter
        permissions: ['organizer', 'contract:update', 'contract:sign'],
      },
    ],
  };

  // 2. Skapa objekt för MOTPARTEN (kunden), precis som tidigare
  const counterParty: any = { type: partyType };
  if (partyType === 'company') {
    counterParty.name = recipient.company_name;
    counterParty.identification_number = recipient.organization_number;
  } else {
    counterParty.name = recipient.name;
  }
  counterParty.participants = [
    {
      name: recipient.name,
      email: recipient.email,
      permissions: sendForSigning
        ? ['contract:update', 'contract:sign']
        : ['contract:read'],
    },
  ];

  // Förbered den slutgiltiga payloaden som ska skickas till Oneflow
  const payload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    // ---- FIX: Inkludera BÅDE ägaren och motparten ----
    parties: [ownerParty, counterParty],
    publish: sendForSigning,
  };

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
    );

    const body = await response.json();
    
    if (!response.ok) {
      console.error('Fel från Oneflows API:', JSON.stringify(body, null, 2));
      return res.status(response.status).json(body);
    }

    return res.status(200).json({ contract: body });
    
  } catch (error) {
    console.error('Internt serverfel vid anrop till Oneflow:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}