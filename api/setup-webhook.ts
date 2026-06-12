// api/setup-webhook.ts - Skapa ClickUp webhook programmatiskt
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from './_lib/auth'

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN!
const TEAM_ID = '31641430' // Begone team ID

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Död endpoint utan UI-anropare - låst till admin (säkerhetsaudit juni 2026)
  const auth = await requireAuth(req, res, ['admin'])
  if (!auth) return

  try {
    console.log('🔧 Setting up ClickUp webhook...')

    // 1. Först, ta bort befintlig webhook (om den finns)
    await deleteExistingWebhooks()

    // 2. Skapa ny webhook med rätt events
    const webhookData = {
      endpoint: 'https://kundportal.vercel.app/api/clickup-webhook',
      events: [
        'taskCreated',
        'taskUpdated', 
        'taskDeleted',
        'taskStatusUpdated',
        'taskAssigneeUpdated',
        'taskPriorityUpdated',
        'taskCommentPosted'
      ]
      // Ingen location filter = lyssna på hela workspace
    }

    const response = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/webhook`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ClickUp API error:', response.status, errorText)
      throw new Error(`ClickUp API error: ${response.status} ${errorText}`)
    }

    const webhook = await response.json()
    console.log('✅ Webhook created successfully:', webhook)

    return res.status(200).json({
      success: true,
      webhook: webhook,
      message: 'Webhook skapad framgångsrikt!'
    })

  } catch (error) {
    console.error('❌ Error setting up webhook:', error)
    return res.status(500).json({
      error: 'Failed to setup webhook',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Hjälpfunktion för att ta bort befintliga webhooks
async function deleteExistingWebhooks() {
  try {
    // Hämta befintliga webhooks
    const response = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/webhook`, {
      headers: {
        'Authorization': CLICKUP_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.log('Could not fetch existing webhooks')
      return
    }

    const data = await response.json()
    const webhooks = data.webhooks || []

    // Ta bort webhooks som pekar på vår URL
    for (const webhook of webhooks) {
      if (webhook.endpoint && webhook.endpoint.includes('kundportal.vercel.app')) {
        console.log(`🗑️ Deleting existing webhook: ${webhook.id}`)
        
        await fetch(`https://api.clickup.com/api/v2/webhook/${webhook.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': CLICKUP_API_TOKEN
          }
        })
      }
    }

  } catch (error) {
    console.error('Error deleting existing webhooks:', error)
  }
}