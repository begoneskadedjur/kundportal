import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME!
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY!

function formatSwedishPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+46')) return cleaned
  if (cleaned.startsWith('0046')) return '+46' + cleaned.slice(4)
  if (cleaned.startsWith('0')) return '+46' + cleaned.slice(1)
  return cleaned
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { to, templateSlug, variables, body: directBody } = req.body

    if (!to) return res.status(400).json({ error: 'Telefonnummer saknas' })

    let messageBody: string

    if (templateSlug) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      const { data: template, error } = await supabase
        .from('sms_templates')
        .select('body')
        .eq('slug', templateSlug)
        .eq('is_active', true)
        .single()

      if (error || !template) {
        return res.status(404).json({ error: `Mall '${templateSlug}' hittades inte` })
      }

      messageBody = replaceVariables(template.body, variables || {})
    } else if (directBody) {
      messageBody = directBody
    } else {
      return res.status(400).json({ error: 'Ange templateSlug eller body' })
    }

    const formattedPhone = formatSwedishPhone(to)

    const clicksendResponse = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64')
      },
      body: JSON.stringify({
        messages: [{
          source: 'begone-kundportal',
          from: 'Begone',
          body: messageBody,
          to: formattedPhone
        }]
      })
    })

    const result = await clicksendResponse.json()

    if (result.response_code === 'SUCCESS') {
      console.log(`SMS skickat till ${formattedPhone}`)
      return res.status(200).json({ success: true, message: 'SMS skickat' })
    } else {
      console.error('ClickSend error:', result)
      return res.status(500).json({ error: 'Kunde inte skicka SMS', details: result })
    }
  } catch (error: any) {
    console.error('SMS API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
