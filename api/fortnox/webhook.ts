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

  const { Type, EntityId } = req.body || {}

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
    const now = new Date().toISOString()

    // Bestäm ny status baserat på Fortnox-fakturans tillstånd
    // Fortnox-livscykel: draft (Booked=false) → booked (Booked=true) → sent (Sent=true) → paid (Balance=0)
    const isPaid = invoice.Balance === 0 && invoice.FinalPayDate != null
    const isSent = invoice.Sent === true
    const isBooked = invoice.Booked === true
    const dueDate = invoice.DueDate ? new Date(invoice.DueDate) : null
    const isOverdue = isSent && !isPaid && dueDate != null && dueDate < new Date()

    // Bestäm målstatus + tidsstämpelfält i prioritetsordning (paid vinner över overdue vinner över sent vinner över booked)
    let targetStatus: 'paid' | 'overdue' | 'sent' | 'booked' | null = null
    let timestamp: string = now
    if (isPaid) {
      targetStatus = 'paid'
      timestamp = new Date(invoice.FinalPayDate).toISOString()
    } else if (isOverdue) {
      targetStatus = 'overdue'
    } else if (isSent) {
      targetStatus = 'sent'
    } else if (isBooked) {
      targetStatus = 'booked'
    }

    if (!targetStatus) {
      // Utkast i Fortnox — inget att synka
      return res.status(200).json({ ok: true, skipped: 'draft-only' })
    }

    // Statusar som INTE ska skrivas över (terminala eller längre gångna i flödet)
    // Ex: om faktura redan är 'paid' vill vi inte skriva tillbaka till 'sent'
    const protectedByTarget: Record<typeof targetStatus & string, string[]> = {
      paid:    ['paid', 'cancelled'],
      overdue: ['paid', 'cancelled', 'overdue'],
      sent:    ['paid', 'cancelled', 'overdue', 'sent'],
      booked:  ['paid', 'cancelled', 'overdue', 'sent', 'booked', 'invoiced'],
    }
    const protectedStatuses = protectedByTarget[targetStatus]

    // --- contract_billing_items ---
    const contractUpdateData: Record<string, unknown> = { status: targetStatus, updated_at: now }
    if (targetStatus === 'paid') contractUpdateData.paid_at = timestamp
    else if (targetStatus === 'overdue') contractUpdateData.overdue_at = timestamp
    else if (targetStatus === 'sent') contractUpdateData.fortnox_sent_at = timestamp
    else if (targetStatus === 'booked') contractUpdateData.booked_at = timestamp

    const protectedList = `(${protectedStatuses.map(s => `"${s}"`).join(',')})`
    const { data: contractItems } = await supabase
      .from('contract_billing_items')
      .select('id')
      .eq('fortnox_document_number', documentNumber)
      .not('status', 'in', protectedList)

    if (contractItems && contractItems.length > 0) {
      const ids = contractItems.map((i: { id: string }) => i.id)
      await supabase
        .from('contract_billing_items')
        .update(contractUpdateData)
        .in('id', ids)
      console.log(`Webhook: ${ids.length} contract_billing_items → ${targetStatus} (Fortnox nr ${documentNumber})`)
    }

    // --- invoices (privat/företag) ---
    const invoiceUpdateData: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === 'paid') invoiceUpdateData.paid_at = timestamp
    else if (targetStatus === 'sent') invoiceUpdateData.sent_at = timestamp
    else if (targetStatus === 'booked') invoiceUpdateData.booked_at = timestamp
    // obs: 'overdue' finns inte som status i invoices-tabellen — skippa den uppdateringen där
    if (targetStatus !== 'overdue') {
      const { data: invoiceRows } = await supabase
        .from('invoices')
        .select('id')
        .eq('fortnox_document_number', documentNumber)
        .not('status', 'in', protectedList)

      if (invoiceRows && invoiceRows.length > 0) {
        const ids = invoiceRows.map((i: { id: string }) => i.id)
        await supabase
          .from('invoices')
          .update(invoiceUpdateData)
          .in('id', ids)
        console.log(`Webhook: ${ids.length} invoices → ${targetStatus} (Fortnox nr ${documentNumber})`)
      }
    }

    return res.status(200).json({ ok: true, status: targetStatus })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('Fortnox webhook fel:', message)
    // Returnera 200 så Fortnox inte försöker igen i onödan
    return res.status(200).json({ ok: false, error: message })
  }
}
