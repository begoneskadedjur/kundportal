// Fortnox webhook — tar emot statusuppdateringar och synkar till vårt system
// Konfigureras i Fortnox developer-portal under Webhooks
// URL: https://kundportal.vercel.app/api/fortnox/webhook

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './refresh'
import { markMirrorMissing, upsertMirrorFromFortnoxCustomer } from '../_lib/fortnoxCustomerMirror'
import {
  decideFortnoxInvoiceSync,
  fortnoxMirrorFields,
  toPostgrestInList,
  type FortnoxInvoiceSnapshot,
} from '../../src/shared/fortnoxInvoiceSync'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FORTNOX_API = 'https://api.fortnox.se/3'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Valfri delad hemlighet (Fortnox skickar ingen HMAC-signatur):
  // sätt FORTNOX_WEBHOOK_SECRET i Vercel och registrera webhook-URL:en i
  // Fortnox developer-portal med ?secret=<värdet>. Tills env-varen är satt
  // ändras ingenting (webhooken hämtar ändå alltid sanningen från Fortnox API).
  const expectedSecret = process.env.FORTNOX_WEBHOOK_SECRET
  if (expectedSecret && req.query.secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { Type, EntityId } = req.body || {}

  if (!EntityId) {
    return res.status(400).json({ error: 'Saknar EntityId' })
  }

  // Kundhändelser: uppdaterar Fortnox-spegeln. OBS: Fortnox har ingen
  // HTTP-webhook för kunder (händelser går via websocket
  // wss://ws.fortnox.se/topics-v1), så grenen är VILANDE tills en
  // websocket-brygga postar hit. Spegeln hålls i stället färsk av
  // api/cron/sync-fortnox-customers-incremental (var 10:e min).
  // Payloaden litas aldrig på: kundkortet hämtas från API:t.
  // 404 = raderad kund, numret förblir upptaget (missing_since).
  if (typeof Type === 'string' && Type.toUpperCase().startsWith('CUSTOMER')) {
    try {
      const accessToken = await getValidAccessToken()
      const customerRes = await fetch(`${FORTNOX_API}/customers/${encodeURIComponent(String(EntityId))}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      })
      if (customerRes.status === 404) {
        await markMirrorMissing(String(EntityId))
        return res.status(200).json({ ok: true, mirror: 'missing' })
      }
      if (!customerRes.ok) {
        console.error(`Kunde inte hämta Fortnox-kund ${EntityId}: ${customerRes.status}`)
        return res.status(200).json({ ok: true, skipped: true })
      }
      const data = await customerRes.json()
      if (data?.Customer?.CustomerNumber) {
        await upsertMirrorFromFortnoxCustomer(data.Customer)
      }
      return res.status(200).json({ ok: true, mirror: 'upserted' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Okänt fel'
      console.error('Fortnox kund-webhook fel:', message)
      return res.status(200).json({ ok: false, error: message })
    }
  }

  // Övriga händelser: bara fakturor synkas
  if (Type !== 'INVOICE') {
    return res.status(200).json({ ok: true, skipped: true })
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
    const invoice = data.Invoice as FortnoxInvoiceSnapshot | undefined

    if (!invoice) {
      return res.status(200).json({ ok: true, skipped: true })
    }

    const documentNumber = String(EntityId)
    const now = new Date().toISOString()

    // Avslagen ROT/RUT-begäran gör hela saldot till kundens skuld igen
    const { data: claimRows } = await supabase
      .from('invoices')
      .select('rot_rut_claim_status')
      .eq('fortnox_document_number', documentNumber)
    const rotRutClaimStatus = ((claimRows ?? []) as { rot_rut_claim_status: string | null }[])
      .map((r) => r.rot_rut_claim_status)
      .find((s) => !!s) ?? null

    // Samma regel som edge-funktionen fortnox-sync (src/shared/fortnoxInvoiceSync.ts):
    // paid vinner över overdue vinner över sent vinner över booked, makulerad blir cancelled
    const decision = decideFortnoxInvoiceSync(invoice, { rotRutClaimStatus })
    const { status: targetStatus, timestamp } = decision

    // Saldo, förfallodag och skattereduktion speglas alltid, oavsett
    // statusskydd: en delbetalning ändrar saldot utan att ändra status, och
    // betalningsspärren räknar på återstående skuld.
    const mirror = fortnoxMirrorFields(decision)
    if (Object.keys(mirror).length > 0) {
      await supabase
        .from('invoices')
        .update(mirror)
        .eq('fortnox_document_number', documentNumber)
    }

    if (!targetStatus) {
      // Utkast i Fortnox — inget att synka
      return res.status(200).json({ ok: true, skipped: 'draft-only' })
    }

    const protectedList = toPostgrestInList(decision.protectedStatuses)

    // --- contract_billing_items (makulering rör bara invoices-raden) ---
    if (targetStatus !== 'cancelled') {
      const contractUpdateData: Record<string, unknown> = { status: targetStatus, updated_at: now }
      if (targetStatus === 'paid') contractUpdateData.paid_at = timestamp
      else if (targetStatus === 'overdue') contractUpdateData.overdue_at = timestamp
      else if (targetStatus === 'sent') contractUpdateData.fortnox_sent_at = timestamp
      else if (targetStatus === 'booked') contractUpdateData.booked_at = timestamp

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
    }

    // --- invoices (privat/företag/avtal) ---
    const invoiceUpdateData: Record<string, unknown> = { status: targetStatus }
    if (targetStatus === 'paid') invoiceUpdateData.paid_at = timestamp
    else if (targetStatus === 'sent' && !decision.rotRutCustomerPaid) invoiceUpdateData.sent_at = timestamp
    else if (targetStatus === 'booked') invoiceUpdateData.booked_at = timestamp
    else if (targetStatus === 'overdue') invoiceUpdateData.overdue_at = timestamp
    // ROT/RUT där kunden betalat sin del: inte längre förfallen för kunden
    if (decision.rotRutCustomerPaid) invoiceUpdateData.overdue_at = null

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

    return res.status(200).json({ ok: true, status: targetStatus })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('Fortnox webhook fel:', message)
    // Returnera 200 så Fortnox inte försöker igen i onödan
    return res.status(200).json({ ok: false, error: message })
  }
}
