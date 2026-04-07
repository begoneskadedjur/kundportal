// api/oneflow/view-file-direct.ts
// Skapar en temporär view-URL för en Oneflow-fil direkt via oneflow_contract_id
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Endast POST tillåtet' })

  const { oneflowContractId, fileId } = req.body
  if (!oneflowContractId || !fileId) {
    return res.status(400).json({ success: false, error: 'oneflowContractId och fileId krävs' })
  }

  const headers = {
    'x-oneflow-api-token': ONEFLOW_API_TOKEN,
    'x-oneflow-user-email': 'info@begone.se',
    Accept: 'application/json',
  }

  try {
    // Hämta fil-metadata – kan innehålla download_url
    const metaRes = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${fileId}`,
      { headers }
    )

    if (metaRes.ok) {
      const meta = await metaRes.json() as any
      if (meta.download_url) {
        return res.status(200).json({ success: true, viewUrl: meta.download_url })
      }
    }

    // Fallback: redirect-URL via download?download=true
    const dlRes = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${fileId}?download=true`,
      { headers: { ...headers }, redirect: 'manual' }
    )

    if (dlRes.status >= 300 && dlRes.status < 400) {
      const location = dlRes.headers.get('location')
      if (location) {
        return res.status(200).json({ success: true, viewUrl: location })
      }
    }

    return res.status(500).json({ success: false, error: 'Kunde inte skapa view-URL från Oneflow' })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internt serverfel', details: err.message })
  }
}
