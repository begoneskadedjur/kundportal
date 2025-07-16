return res.status(200).json({
  //...
  tests: {
    workspace: {
      status: 'passed',
      // DENNA RAD KOMMER KRASCHA - workspaceData finns inte
      workspace_count: workspaceData.data?.length || 0 
    },
    //...
  }
})
```Eftersom variabeln `workspaceData` aldrig skapas någonstans i koden, kommer programmet att krascha med ett "ReferenceError".

### Korrigerad version av `test-oneflow.ts`

Här är en komplett, korrigerad version av filen. Jag har tagit bort den trasiga referensen till `workspaceData` för att göra testet enklare och mer robust. Detta är ett utmärkt verktyg för att felsöka problem med din `API-token`.

Ersätt hela din `api/test-oneflow.ts` med denna kod:

```typescript
// api/test-oneflow.ts - KORRIGERAD VERSION
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Dessa miljövariabler behövs för detta test
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Tillåt anrop från webbläsare (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Kontrollera att API-nyckeln finns
  if (!ONEFLOW_API_TOKEN) {
      console.error('❌ FEL: Miljövariabeln ONEFLOW_API_TOKEN är inte satt.')
      return res.status(500).json({
          success: false,
          error: 'Server configuration error: ONEFLOW_API_TOKEN is not set.'
      })
  }

  try {
    console.log('🧪 Startar test av Oneflow API-anslutning...');

    // Test 1: Hämta de 5 senaste avtalen
    console.log(`API Request: GET ${ONEFLOW_API_URL}/contracts?limit=5`);
    const contractsResponse = await fetch(`${ONEFLOW_API_URL}/contracts?limit=5`, {
      headers: {
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log(`Response Status: ${contractsResponse.status}`);

    if (!contractsResponse.ok) {
      const errorText = await contractsResponse.text();
      console.error(`API Error Response: ${errorText}`);
      throw new Error(`Contracts API error: ${contractsResponse.status} ${contractsResponse.statusText}`);
    }

    const contractsData = await contractsResponse.json();
    console.log(`✅ Test 'Hämta avtal' lyckades. Hittade ${contractsData.data?.length || 0} avtal.`);

    // Test 2: Analysera datafält från det första avtalet (om det finns något)
    const firstContract = contractsData.data?.[0];
    let dataFieldsAnalysis = null;
    
    if (firstContract) {
      const detailResponse = await fetch(`${ONEFLOW_API_URL}/contracts/${firstContract.id}`, {
        headers: { 'x-oneflow-api-token': ONEFLOW_API_TOKEN }
      });

      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        dataFieldsAnalysis = {
          contract_name: detailData.name,
          contract_id: detailData.id,
          state: detailData.state,
          data_fields_count: detailData.data_fields?.length || 0,
          participants_count: detailData.participants?.length || 0,
        };
        console.log(`✅ Test 'Analysera datafält' lyckades för kontrakt ${firstContract.id}.`);
      }
    } else {
        console.log("ℹ️ Inga avtal hittades att analysera i detalj.");
    }

    // Skicka ett lyckat svar med resultaten
    return res.status(200).json({
      success: true,
      message: 'Oneflow API-anslutningstest lyckades!',
      tests: {
        fetch_contracts: {
          status: 'passed',
          contracts_found: contractsData.data?.length || 0,
          total_available_in_account: contractsData.meta?.total || 0
        },
        fetch_contract_details: {
          status: dataFieldsAnalysis ? 'passed' : 'skipped (no contracts found)',
          analysis: dataFieldsAnalysis
        }
      }
    });

  } catch (error) {
    console.error('❌ Oneflow-testet misslyckades:', error);
    return res.status(500).json({
      success: false,
      error: 'Oneflow API test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: [
        'Kontrollera att ONEFLOW_API_TOKEN är korrekt i dina miljövariabler.',
        'Verifiera att API-token har behörighet att läsa kontrakt.',
        'Kontrollera att Oneflow-kontot är aktivt.'
      ]
    });
  }
}