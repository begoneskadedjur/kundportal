// api/test-oneflow.ts - Testa Oneflow-anslutning
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_API_URL = process.env.ONEFLOW_API_URL || 'https://api.oneflow.com/v1'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    console.log('🧪 Testing Oneflow API connection...')

    // Test 1: Hämta avtal (detta är det grundläggande API-anropet)
    const contractsResponse = await fetch(`${ONEFLOW_API_URL}/contracts?limit=5`, {
      headers: {
        'Authorization': `Bearer ${ONEFLOW_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    console.log(`API Request: GET ${ONEFLOW_API_URL}/contracts?limit=5`)
    console.log(`Response Status: ${contractsResponse.status}`)

    if (!contractsResponse.ok) {
      const errorText = await contractsResponse.text()
      console.error(`API Error Response: ${errorText}`)
      throw new Error(`Contracts API error: ${contractsResponse.status} ${contractsResponse.statusText}\nDetails: ${errorText}`)
    }

    const contractsData = await contractsResponse.json()
    console.log('✅ Contracts test passed')
    console.log(`Found ${contractsData.data?.length || 0} contracts`)

    // Test 2: Analysera datafält från första avtalet
    const firstContract = contractsData.data?.[0]
    let dataFieldsAnalysis = null
    
    if (firstContract) {
      // Hämta detaljerad kontraktinfo
      const detailResponse = await fetch(`${ONEFLOW_API_URL}/contracts/${firstContract.id}`, {
        headers: {
          'Authorization': `Bearer ${ONEFLOW_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })

      if (detailResponse.ok) {
        const detailData = await detailResponse.json()
        dataFieldsAnalysis = {
          contract_name: detailData.name,
          contract_id: detailData.id,
          state: detailData.state,
          data_fields: detailData.data_fields?.map((field: any) => ({
            key: field.key,
            type: field.type,
            value: typeof field.value === 'string' ? field.value.substring(0, 50) + '...' : field.value
          })) || [],
          participants: detailData.participants?.map((p: any) => ({
            email: p.email,
            company_name: p.company_name,
            organization_number: p.organization_number
          })) || []
        }
        console.log('✅ Data fields analysis completed')
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Oneflow API connection successful',
      tests: {
        workspace: {
          status: 'passed',
          workspace_count: workspaceData.data?.length || 0
        },
        contracts: {
          status: 'passed',
          contract_count: contractsData.data?.length || 0,
          total_available: contractsData.meta?.total || 0
        },
        data_fields: {
          status: dataFieldsAnalysis ? 'passed' : 'no_contracts',
          analysis: dataFieldsAnalysis
        }
      },
      recommendations: [
        'API-anslutning fungerar korrekt',
        'Webhook kan nu sättas upp i Oneflow',
        dataFieldsAnalysis ? `${dataFieldsAnalysis.data_fields.length} datafält hittades i första avtalet` : 'Inga avtal att analysera',
        'Implementera webhook för real-time uppdateringar'
      ]
    })

  } catch (error) {
    console.error('❌ Oneflow test failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Oneflow API test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: [
        'Kontrollera att ONEFLOW_API_TOKEN är korrekt',
        'Verifiera att API-token har rätt behörigheter',
        'Kontrollera att Oneflow-kontot är aktivt',
        'Testa API-token direkt i Oneflow-dokumentationen'
      ]
    })
  }
}