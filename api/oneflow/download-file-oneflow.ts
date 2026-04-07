// api/oneflow/download-file-oneflow.ts
// Streamar en Oneflow-fil direkt till klienten via oneflow_contract_id (utan contracts-tabell)
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

  const { oneflowContractId, fileId, fileName } = req.body
  if (!oneflowContractId || !fileId) {
    return res.status(400).json({ success: false, error: 'oneflowContractId och fileId krävs' })
  }

  const headers = {
    'x-oneflow-api-token': ONEFLOW_API_TOKEN,
    'x-oneflow-user-email': 'info@begone.se',
  }

  try {
    // Hämta download_url från fil-metadata
    let downloadUrl: string | null = null

    const metaRes = await fetch(
      `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${fileId}`,
      { headers: { ...headers, Accept: 'application/json' } }
    )

    if (metaRes.ok) {
      const meta = await metaRes.json() as any
      if (meta.download_url) {
        downloadUrl = meta.download_url
      }
    }

    // Fallback: redirect-URL
    if (!downloadUrl) {
      const dlRes = await fetch(
        `https://api.oneflow.com/v1/contracts/${oneflowContractId}/files/${fileId}?download=true`,
        { headers, redirect: 'manual' }
      )
      if (dlRes.status >= 300 && dlRes.status < 400) {
        downloadUrl = dlRes.headers.get('location')
      }
    }

    if (!downloadUrl) {
      return res.status(500).json({ success: false, error: 'Kunde inte hämta nedladdnings-URL från Oneflow' })
    }

    // Streama filen
    const fileRes = await fetch(downloadUrl)
    if (!fileRes.ok) {
      return res.status(500).json({ success: false, error: 'Nedladdning från Oneflow misslyckades' })
    }

    const safeFileName = ((fileName as string) || `avtal-${fileId}`).replace(/[^\w.\-åäöÅÄÖ ]/g, '_')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.pdf"`)
    res.setHeader('Cache-Control', 'no-cache')

    const arrayBuffer = await fileRes.arrayBuffer()
    return res.status(200).send(Buffer.from(arrayBuffer))
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internt serverfel', details: err.message })
  }
}
