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
  
  // Hämta information om ägarparten från miljövariabler
  const ownerCompanyName = process.env.ONEFLOW_OWNER_COMPANY_NAME!;
  const ownerOrgNumber = process.env.ONEFLOW_OWNER_ORGANIZATION_NUMBER; // Kan vara valfri

  // Validera att nödvändiga variabler finns
  if (!token || !userEmail || !workspaceId || !ownerCompanyName) {
    console.error('Saknade miljövariabler för Oneflow-integrationen');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // Mappa datafält
  const data_fields = Object.entries(contractData).map(
    ([custom_id, value]) => ({ custom_id, value })
  );

  // Skapa objekt för ÄGARPARTEN (ert företag)
  const ownerParty = {
    type: 'company',
    name: ownerCompanyName,
    identification_number: ownerOrgNumber || '',
    participants: [
      {
        name: 'Avsändare',
        email: userEmail,
        // Korrekt struktur enligt Oneflow dokumentation
        _permissions: {
          'contract:update': true
        },
        signatory: true,        // Ägaren ska signera
        organizer: false,       // Explicit false för ägaren
        delivery_channel: 'email'
      },
    ],
  };

  // Skapa objekt för MOTPARTEN (kunden)
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
      // Korrekt struktur för motpart
      _permissions: {
        'contract:update': sendForSigning  // true om ska signera, false för viewer
      },
      signatory: sendForSigning,           // true om ska signera
      organizer: false,                    // Alltid false för counterparty
      delivery_channel: 'email'
    },
  ];

  // *** FIX: Ta bort "publish" parametern från payload ***
  const createPayload = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties: [ownerParty, counterParty],
    // publish: sendForSigning, // ❌ TA BORT DENNA RAD
  };

  console.log('Skickar följande create payload till Oneflow:', JSON.stringify(createPayload, null, 2));

  try {
    // STEG 1: Skapa kontraktet
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
    );

    const createdContract = await createResponse.json();
    
    if (!createResponse.ok) {
      console.error('Fel vid skapande av kontrakt:', JSON.stringify(createdContract, null, 2));
      return res.status(createResponse.status).json(createdContract);
    }

    console.log('✅ Kontrakt skapat framgångsrikt:', createdContract.id);

    // STEG 2: Publicera kontraktet (endast om sendForSigning är true)
    if (sendForSigning) {
      console.log('🚀 Publicerar kontrakt för signering...');
      
      const publishPayload = {
        subject: `Avtal från ${ownerCompanyName}`,
        message: `Hej ${recipient.name}!\n\nBifogat finner du vårt avtal för signering.\n\nVänliga hälsningar,\n${ownerCompanyName}`
      };

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
      );

      if (!publishResponse.ok) {
        const publishError = await publishResponse.json();
        console.error('⚠️ Kontrakt skapat men kunde inte publiceras:', JSON.stringify(publishError, null, 2));
        
        // Returnera kontraktet ändå, men med en varning
        return res.status(200).json({ 
          contract: createdContract,
          warning: 'Kontrakt skapat men kunde inte skickas för signering automatiskt',
          publishError: publishError
        });
      }

      console.log('✅ Kontrakt publicerat och skickat för signering');
    }

    return res.status(200).json({ contract: createdContract });
    
  } catch (error) {
    console.error('Internt serverfel vid anrop till Oneflow:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}