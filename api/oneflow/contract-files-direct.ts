// api/oneflow/contract-files-direct.ts
// Listar filer för ett Oneflow-kontrakt direkt via oneflow_contract_id (utan contracts-tabell)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Endast GET tillåtet' })

  const { oneflowContractId } = req.query
  if (!oneflowContractId || typeof oneflowContractId !== 'string') {
    return res.status(400).json({ success: false, error: 'oneflowContractId krävs' })
  }

  try {
    const response = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/`,
      {
        headers: {
          'x-oneflow-api-token': ONEFLOW_API_TOKEN,
          'x-oneflow-user-email': 'info@begone.se',
          Accept: 'application/json',
        },
      }
    )

    if (response.status === 404) {
      return res.status(200).json({ success: true, files: [] })
    }

    if (!response.ok) {
      return res.status(500).json({ success: false, error: 'Oneflow API-fel: ' + response.status })
    }

    const data = await response.json() as { data: any[]; count: number }
    return res.status(200).json({ success: true, files: data.data ?? [] })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internt serverfel', details: err.message })
  }
}
