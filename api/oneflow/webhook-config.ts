// api/oneflow/webhook-config.ts - OneFlow Webhook Konfiguration Management
import type { VercelRequest, VercelResponse } from '@vercel/node'
import fetch from 'node-fetch'

// Miljövariabler
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const ONEFLOW_USER_EMAIL = 'info@begone.se'
const WEBHOOK_URL = 'https://kundportal.vercel.app/api/oneflow-webhook'
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
  try {
    console.log('🔍 Hämtar webhooks från OneFlow API...')
    
    const response = await fetch('https://api.oneflow.com/v1/webhooks', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-oneflow-api-token': ONEFLOW_API_TOKEN,
        'x-oneflow-user-email': ONEFLOW_USER_EMAIL
      }
    })

    console.log(`📡 OneFlow API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ OneFlow API error: ${response.status} - ${errorText}`)
      throw new Error(`OneFlow API error: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log('📦 Raw OneFlow response:', JSON.stringify(data, null, 2))
    
    // OneFlow kan returnera antingen en array eller ett objekt med data property
    let webhooks: OneFlowWebhook[]
    if (Array.isArray(data)) {
      webhooks = data
    } else if (data && Array.isArray(data.data)) {
      webhooks = data.data
    } else if (data && data.webhooks && Array.isArray(data.webhooks)) {
      webhooks = data.webhooks
    } else {
      console.log('⚠️ Unexpected data structure from OneFlow API, treating as empty array')
      webhooks = []
    }
    
    console.log(`✅ Processed ${webhooks.length} webhooks`)
    return webhooks
    
  } catch (error) {
    console.error('💥 Error in getWebhooks:', error)
    throw error
  }
}

// Uppdatera webhook med nya event filters
async function updateWebhook(webhookId: number, updates: Partial<OneFlowWebhook>) {
  try {
    console.log(`🔄 Uppdaterar webhook ID: ${webhookId}`)
    console.log('📝 Update data:', JSON.stringify(updates, null, 2))
    
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

    console.log(`📡 Update response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ OneFlow update error: ${response.status} - ${errorText}`)
      throw new Error(`OneFlow API error: ${response.status} - ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ Webhook uppdaterad')
    return result
    
  } catch (error) {
    console.error('💥 Error in updateWebhook:', error)
    throw error
  }
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
        
        console.log(`📊 Analyserar ${webhooks.length} webhooks...`)
        
        const analysis = (webhooks || []).map(webhook => {
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
            is_our_webhook: (webhook.callback_url?.includes('kundportal.vercel.app') && 
                           (webhook.callback_url?.includes('/api/oneflow/webhook') || 
                            webhook.callback_url?.includes('/api/oneflow-webhook'))) || false
          }
        })

        console.log('✅ Webhook analys klar')

        res.json({
          success: true,
          data: {
            webhooks: webhooks || [],
            analysis: analysis || [],
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

        } else if (action === 'auto_fix_webhook') {
          // Hitta vår webhook automatiskt och uppdatera den
          console.log('🔍 Söker efter BeGone webhook...')
          const webhooks = await getWebhooks()
          
          console.log(`📋 Alla webhooks (${webhooks.length}):`)
          webhooks.forEach((webhook, i) => {
            console.log(`  ${i + 1}. ID: ${webhook.id}, URL: ${webhook.callback_url}`)
          })
          
          const ourWebhook = webhooks.find(webhook => 
            webhook.callback_url?.includes('kundportal.vercel.app')
          )

          console.log('🎯 Hittad BeGone webhook:', ourWebhook ? `ID: ${ourWebhook.id}` : 'Ingen hittad')

          if (!ourWebhook) {
            return res.status(404).json({
              success: false,
              error: 'Ingen BeGone webhook hittad. Skapa en ny webhook istället.',
              debug: {
                total_webhooks: webhooks.length,
                webhook_urls: webhooks.map(w => w.callback_url)
              }
            })
          }

          console.log(`🔧 Förbereder uppdatering av webhook ID: ${ourWebhook.id}`)
          
          const updateData = {
            // Behåll befintlig callback_url - ändra inte den
            callback_url: ourWebhook.callback_url,
            sign_key: WEBHOOK_SECRET,
            filters: RECOMMENDED_EVENT_FILTERS
          }

          const result = await updateWebhook(ourWebhook.id, updateData)
          
          res.json({
            success: true,
            message: `Webhook #${ourWebhook.id} automatiskt uppdaterad med alla events`,
            data: result
          })

        } else if (action === 'test_webhook_ids') {
          // Testa att hämta varje webhook individuellt för debugging
          const webhooks = await getWebhooks()
          const testResults = []

          for (const webhook of webhooks) {
            try {
              console.log(`🧪 Testar webhook ID: ${webhook.id}`)
              const response = await fetch(`https://api.oneflow.com/v1/webhooks/${webhook.id}`, {
                method: 'GET',
                headers: {
                  'accept': 'application/json',
                  'x-oneflow-api-token': ONEFLOW_API_TOKEN,
                  'x-oneflow-user-email': ONEFLOW_USER_EMAIL
                }
              })

              testResults.push({
                id: webhook.id,
                callback_url: webhook.callback_url,
                accessible: response.ok,
                status: response.status,
                is_our_webhook: webhook.callback_url?.includes('kundportal.vercel.app')
              })

            } catch (error) {
              testResults.push({
                id: webhook.id,
                callback_url: webhook.callback_url,
                accessible: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                is_our_webhook: webhook.callback_url?.includes('kundportal.vercel.app')
              })
            }
          }

          res.json({
            success: true,
            data: {
              webhook_tests: testResults,
              total_webhooks: webhooks.length
            }
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