// api/test-webhook.ts - Test OneFlow webhook manuellt
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🧪 Testar OneFlow webhook manuellt...')

    // Test payload baserad på dokumentationen
    const testPayload = {
      "contract": {
        "id": 101
      },
      "callback_id": "eaf850991bb7c273a56dcdeb265d30006fdc9de0",
      "events": [{
        "created_time": "2020-07-06T15:14:14+0000",
        "id": 2322,
        "type": "contract:create"  // Testar contract:create event
      }],
      "signature": "7a581695d9ff8c41de4d85554b6852f7cf6f97b0"
    }

    console.log('📤 Skickar test-request till webhook...')

    // Skicka till vår webhook endpoint
    const response = await fetch('https://kundportal.vercel.app/api/oneflow-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })

    console.log(`📡 Webhook response status: ${response.status}`)
    const responseText = await response.text()
    console.log(`📝 Webhook response: ${responseText}`)

    res.json({
      success: true,
      message: 'Webhook test skickat',
      data: {
        webhook_status: response.status,
        webhook_response: responseText,
        test_payload: testPayload
      }
    })

  } catch (error) {
    console.error('❌ Fel vid webhook test:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel'
    })
  }
}