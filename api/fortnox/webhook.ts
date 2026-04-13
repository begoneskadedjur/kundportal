// Fortnox webhook — tar emot statusuppdateringar och synkar till vårt system
// Konfigureras i Fortnox developer-portal under Webhooks
// URL: https://kundportal.vercel.app/api/fortnox/webhook

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './refresh'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FORTNOX_API = 'https://api.fortnox.se/3'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { Type, Action, EntityId } = req.body || {}

  // Vi bryr oss bara om faktura-händelser
  if (Type !== 'INVOICE') {
    return res.status(200).json({ ok: true, skipped: true })
  }

  if (!EntityId) {
    return res.status(400).json({ error: 'Saknar EntityId' })
  }

  try {
    // Hämta fakturan från Fortnox för att kolla aktuell status
    const accessToken = await getValidAccessToken()
    const fortnoxRes = await fetch(`${FORTNOX_API}/invoices/${EntityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!fortnoxRes.ok) {
      console.error(`Kunde inte hämta Fortnox-faktura ${EntityId}: ${fortnoxRes.status}`)
      return res.status(200).json({ ok: true, skipped: true })
    }

    const data = await fortnoxRes.json()
    const invoice = data.Invoice

    if (!invoice) {
      return res.status(200).json({ ok: true, skipped: true })
    }

    const documentNumber = String(EntityId)
    const isPaid = invoice.Balance === 0 && invoice.FinalPayDate != null

    if (!isPaid) {
      // Fakturan är inte betald än — inget att göra
      return res.status(200).json({ ok: true, skipped: true })
    }

    const paidAt = new Date(invoice.FinalPayDate).toISOString()

    // Uppdatera contract_billing_items
    const { data: contractItems } = await supabase
      .from('contract_billing_items')
      .select('id')
      .eq('fortnox_document_number', documentNumber)
      .neq('status', 'paid')

    if (contractItems && contractItems.length > 0) {
      const ids = contractItems.map((i: { id: string }) => i.id)
      await supabase
        .from('contract_billing_items')
        .update({ status: 'paid', paid_at: paidAt, updated_at: new Date().toISOString() })
        .in('id', ids)

      console.log(`Webhook: ${ids.length} contract_billing_items markerade betalda (Fortnox nr ${documentNumber})`)
    }

    // Uppdatera invoices
    const { data: invoiceRows } = await supabase
      .from('invoices')
      .select('id')
      .eq('fortnox_document_number', documentNumber)
      .neq('status', 'paid')

    if (invoiceRows && invoiceRows.length > 0) {
      const ids = invoiceRows.map((i: { id: string }) => i.id)
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: paidAt })
        .in('id', ids)

      console.log(`Webhook: ${ids.length} invoices markerade betalda (Fortnox nr ${documentNumber})`)
    }

    return res.status(200).json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('Fortnox webhook fel:', message)
    // Returnera 200 så Fortnox inte försöker igen i onödan
    return res.status(200).json({ ok: false, error: message })
  }
}
