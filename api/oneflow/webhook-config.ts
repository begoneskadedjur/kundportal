// api/oneflow/webhook-config.ts - OneFlow Webhook Konfiguration Management
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

// Miljövariabler
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se'
const WEBHOOK_URL = 'https://kundportal.vercel.app/api/oneflow/webhook'
const WEBHOOK_SECRET = process.env.ONEFLOW_WEBHOOK_SECRET!

interface OneFlowWebhookFilter {
  filter_rules: Array<{
    type: string
    values: string[]
  }>
}

interface OneFlowWebhook {
  id: number
  callback_url: string
  sign_key: string | null
  template_group_id: number | null
  integration_process_id: number | null
  filters: OneFlowWebhookFilter[] | null
}

// Hämta alla webhooks
async function getWebhooks(): Promise<OneFlowWebhook[]> {
  const response = await fetch('https://api.oneflow.com/v1/webhooks', {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL
    }
  })

  if (!response.ok) {
    throw new Error(`OneFlow API error: ${response.status} - ${response.statusText}`)
  }

  const data = await response.json()
  return data as OneFlowWebhook[]
}

// Uppdatera webhook med nya event filters
async function updateWebhook(webhookId: number, updates: Partial<OneFlowWebhook>) {
  const response = await fetch(`https://api.oneflow.com/v1/webhooks/${webhookId}`, {
    method: 'PUT',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    throw new Error(`OneFlow API error: ${response.status} - ${response.statusText}`)
  }

  return await response.json()
}

// Skapa ny webhook
async function createWebhook(webhookData: Omit<OneFlowWebhook, 'id'>) {
  const response = await fetch('https://api.oneflow.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-oneflow-api-token': ONEFLOW_API_TOKEN,
      'x-oneflow-user-email': ONEFLOW_USER_EMAIL
    },
    body: JSON.stringify(webhookData)
  })

  if (!response.ok) {
    throw new Error(`OneFlow API error: ${response.status} - ${response.statusText}`)
  }

  return await response.json()
}

// Rekommenderade event filters för vårt system
const RECOMMENDED_EVENT_FILTERS: OneFlowWebhookFilter[] = [
  {
    filter_rules: [
      {
        type: "EVENT_TYPE",
        values: [
          "contract:create",
          "contract:publish",
          "contract:sign",
          "contract:decline",
          "contract:lifecycle_state:start",
          "contract:lifecycle_state:end",
          "contract:lifecycle_state:terminate",
          "contract:signing_period_expire",
          "contract:content_update"
        ]
      }
    ]
  }
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { method } = req

    switch (method) {
      case 'GET':
        // Hämta och visa nuvarande webhook-konfiguration
        const webhooks = await getWebhooks()
        
        const analysis = webhooks.map(webhook => {
          const eventTypes = webhook.filters?.flatMap(filter => 
            filter.filter_rules.flatMap(rule => rule.values)
          ) || []
          
          return {
            id: webhook.id,
            callback_url: webhook.callback_url,
            sign_key_configured: !!webhook.sign_key,
            sign_key_matches: webhook.sign_key === WEBHOOK_SECRET,
            template_group_id: webhook.template_group_id,
            configured_events: eventTypes,
            missing_events: [
              "contract:create",
              "contract:publish", 
              "contract:sign"
            ].filter(event => !eventTypes.includes(event)),
            is_our_webhook: webhook.callback_url.includes('kundportal.vercel.app')
          }
        })

        res.json({
          success: true,
          data: {
            webhooks,
            analysis,
            recommended_events: RECOMMENDED_EVENT_FILTERS[0].filter_rules[0].values
          }
        })
        break

      case 'POST':
        // Uppdatera webhook-konfiguration
        const { action, webhook_id } = req.body

        if (action === 'update_events') {
          if (!webhook_id) {
            return res.status(400).json({
              success: false,
              error: 'webhook_id krävs för update_events'
            })
          }

          const updateData = {
            callback_url: WEBHOOK_URL,
            sign_key: WEBHOOK_SECRET,
            filters: RECOMMENDED_EVENT_FILTERS
          }

          const result = await updateWebhook(webhook_id, updateData)
          
          res.json({
            success: true,
            message: 'Webhook uppdaterad med nya event filters',
            data: result
          })

        } else if (action === 'create_webhook') {
          const newWebhook = {
            callback_url: WEBHOOK_URL,
            sign_key: WEBHOOK_SECRET,
            filters: RECOMMENDED_EVENT_FILTERS,
            template_group_id: null,
            integration_process_id: null
          }

          const result = await createWebhook(newWebhook)
          
          res.json({
            success: true,
            message: 'Ny webhook skapad',
            data: result
          })

        } else {
          res.status(400).json({
            success: false,
            error: 'Okänd action. Använd "update_events" eller "create_webhook"'
          })
        }
        break

      default:
        res.setHeader('Allow', ['GET', 'POST'])
        res.status(405).json({
          success: false,
          error: `Method ${method} not allowed`
        })
        break
    }

  } catch (error) {
    console.error('❌ Webhook config error:', error)
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel',
      details: 'Kontrollera OneFlow API token och user email'
    })
  }
}