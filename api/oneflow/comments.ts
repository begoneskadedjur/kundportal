// api/oneflow/comments.ts — Proxy för Oneflow Comments API (GET + POST)
import type { VercelRequest, VercelResponse } from '@vercel/node'

const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = process.env.ONEFLOW_USER_EMAIL || 'info@begone.se'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { contractId } = req.query

  if (!contractId || typeof contractId !== 'string') {
    return res.status(400).json({ error: 'contractId krävs' })
  }

  const baseUrl = `https://api.oneflow.com/v1/contracts/${contractId}/comments`
  const headers: Record<string, string> = {
    'x-oneflow-api-token': ONEFLOW_API_TOKEN,
    'x-oneflow-user-email': (req.headers['x-sender-email'] as string) || ONEFLOW_USER_EMAIL,
    'Content-Type': 'application/json',
  }

  try {
    if (req.method === 'GET') {
      const response = await fetch(baseUrl, { headers })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Oneflow comments GET error: ${response.status}`, errorBody)
        return res.status(response.status).json({ error: 'Kunde inte hämta kommentarer', details: errorBody })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      const { body, parentId, isPrivate, participants } = req.body

      if (!body || typeof body !== 'string') {
        return res.status(400).json({ error: 'body (kommentarstext) krävs' })
      }

      const payload: Record<string, any> = {
        body,
        private: isPrivate ?? false,
      }

      if (parentId) {
        payload.parent_id = parentId
      }

      if (participants && Array.isArray(participants)) {
        payload.participants = participants.map((pid: number) => ({ participant_id: pid }))
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`Oneflow comments POST error: ${response.status}`, errorBody)
        return res.status(response.status).json({ error: 'Kunde inte skapa kommentar', details: errorBody })
      }

      const data = await response.json()
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Oneflow comments proxy error:', error)
    return res.status(500).json({ error: 'Internt serverfel' })
  }
}
