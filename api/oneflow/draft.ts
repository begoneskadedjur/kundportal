// api/oneflow/draft.ts - Utkast i Oneflow som hanteras från portalen
//
// Avtalswizarden skapar ALLTID ett utkast (create-contract med sendForSigning
// false) och visar Oneflows egen PDF innan något skickas. Härifrån kan utkastet
// sedan skickas eller tas bort, både direkt i wizarden och från Dokumentsignering.
//
//   GET  ?oneflowContractId=…                 → utkastets PDF (application/pdf, inline)
//   POST { action: 'publish', oneflowContractId } → skicka för signering, contracts.status = 'pending'
//   POST { action: 'delete',  oneflowContractId } → ta bort utkastet i Oneflow + contracts-raden
//
// Alla Oneflow-anrop görs som info@begone.se (en licens). Endast utkast (state
// 'draft') får publiceras eller tas bort här, och tekniker/säljare bara sina egna.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { requireAuth, type AuthContext } from '../_lib/auth'

const ONEFLOW_API = 'https://api.oneflow.com/v1'
const ONEFLOW_USER_EMAIL = 'info@begone.se'

type ContractRow = {
  id: string
  oneflow_contract_id: string
  type: string | null
  status: string | null
  contact_person: string | null
  created_by_email: string | null
  created_by_name: string | null
  begone_employee_email: string | null
  begone_employee_name: string | null
}

type OneflowParticipant = { id: number; signatory?: boolean; _permissions?: Record<string, boolean> }
type OneflowParty = { id: number; my_party?: boolean; participants?: OneflowParticipant[]; participant?: OneflowParticipant }

function oneflowHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {
    'x-oneflow-api-token': process.env.ONEFLOW_API_TOKEN!,
    'x-oneflow-user-email': ONEFLOW_USER_EMAIL,
  }
  if (json) {
    h.Accept = 'application/json'
    h['Content-Type'] = 'application/json'
  }
  return h
}

function supabaseAdmin() {
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

/** Koordinator och admin når alla utkast, övriga bara dem de själva skapat. */
function maHanteraUtkast(auth: AuthContext, row: ContractRow): boolean {
  if (auth.isAdmin || auth.role === 'admin' || auth.role === 'koordinator') return true
  const egen = (auth.email || '').toLowerCase()
  if (!egen) return false
  return [row.created_by_email, row.begone_employee_email].some(e => (e || '').toLowerCase() === egen)
}

/** null = finns inte i Oneflow (404). Andra fel kastas, så att ett tillfälligt fel aldrig tolkas som borttaget. */
async function hamtaOneflowKontrakt(id: string): Promise<{ state?: string; parties?: OneflowParty[] } | null> {
  const r = await fetch(`${ONEFLOW_API}/contracts/${id}`, { headers: oneflowHeaders() })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Oneflow svarade ${r.status} för dokument ${id}`)
  return r.json() as Promise<{ state?: string; parties?: OneflowParty[] }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Samma roller som create-contract: den som kan skapa ett utkast kan också se och skicka det
  const auth = await requireAuth(req, res, ['admin', 'koordinator', 'säljare', 'technician'])
  if (!auth) return

  if (!process.env.ONEFLOW_API_TOKEN) {
    return res.status(500).json({ message: 'Server configuration error.' })
  }

  const oneflowContractId = String(
    (req.method === 'GET' ? req.query.oneflowContractId : req.body?.oneflowContractId) ?? ''
  ).trim()
  if (!/^\d+$/.test(oneflowContractId)) {
    return res.status(400).json({ message: 'oneflowContractId krävs' })
  }

  const supabase = supabaseAdmin()
  const { data: row } = await supabase
    .from('contracts')
    .select('id, oneflow_contract_id, type, status, contact_person, created_by_email, created_by_name, begone_employee_email, begone_employee_name')
    .eq('oneflow_contract_id', oneflowContractId)
    .maybeSingle<ContractRow>()

  if (!row) return res.status(404).json({ message: 'Dokumentet finns inte i portalen' })
  if (!maHanteraUtkast(auth, row)) return res.status(403).json({ message: 'Du kan bara hantera dina egna utkast' })

  try {
    if (req.method === 'GET') return await skickaPdf(oneflowContractId, res)

    const action = req.body?.action
    if (action === 'publish') return await publicera(row, res)
    if (action === 'delete') return await taBort(row, res)
    return res.status(400).json({ message: 'Okänd åtgärd' })
  } catch (err) {
    console.error('[oneflow/draft] Oväntat fel:', err)
    return res.status(500).json({ message: 'Internt serverfel' })
  }
}

/**
 * Oneflows PDF för dokumentet. Ett utkast har en fil av typen 'contract'
 * (verifierat mot API:t: GET /contracts/{id}/files ger { id: 1, type: 'contract',
 * extension: 'pdf' }). ?download=true svarar 302 till en signerad S3-länk som
 * levereras som binary/octet-stream + attachment, så den kan inte visas direkt i
 * en iframe. Därför strömmas filen igenom här med application/pdf och inline.
 * Oneflow bygger PDF:en strax efter att utkastet skapats; finns den inte än
 * svarar vi 409 så att klienten försöker igen.
 */
async function skickaPdf(oneflowContractId: string, res: VercelResponse) {
  const filesRes = await fetch(`${ONEFLOW_API}/contracts/${oneflowContractId}/files/`, { headers: oneflowHeaders() })
  if (!filesRes.ok) {
    return res.status(filesRes.status === 404 ? 404 : 502).json({ message: 'Kunde inte hämta filerna från Oneflow' })
  }
  const files = await filesRes.json() as { data?: Array<{ id: number; type: string; extension?: string }> }
  const pdf = files.data?.find(f => f.type === 'contract') ?? files.data?.find(f => f.extension === 'pdf')
  if (!pdf) return res.status(409).json({ message: 'PDF:en är inte klar ännu', retry: true })

  const dl = await fetch(`${ONEFLOW_API}/contracts/${oneflowContractId}/files/${pdf.id}?download=true`, {
    headers: oneflowHeaders(false),
    redirect: 'manual',
  })
  let fileUrl: string | null = null
  if (dl.status >= 300 && dl.status < 400) fileUrl = dl.headers.get('location')
  if (!fileUrl) return res.status(409).json({ message: 'PDF:en är inte klar ännu', retry: true })

  const fileRes = await fetch(fileUrl)
  if (!fileRes.ok) return res.status(409).json({ message: 'PDF:en är inte klar ännu', retry: true })

  const buffer = Buffer.from(await fileRes.arrayBuffer())
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="oneflow-${oneflowContractId}.pdf"`)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(buffer)
}

/**
 * Skickar utkastet för signering. Samma publish-anrop och meddelande som
 * create-contract gör när ett dokument skickas direkt. Webhooken contract:publish
 * gör resten (ärendets offertstatus m.m.), precis som för direktskickade dokument.
 */
async function publicera(row: ContractRow, res: VercelResponse) {
  if (row.status !== 'draft') {
    return res.status(409).json({ message: 'Dokumentet är redan skickat' })
  }

  const kontrakt = await hamtaOneflowKontrakt(row.oneflow_contract_id)
  if (!kontrakt) return res.status(502).json({ message: 'Kunde inte läsa dokumentet i Oneflow' })
  if (kontrakt.state !== 'draft') {
    return res.status(409).json({ message: 'Dokumentet är inte längre ett utkast i Oneflow' })
  }

  // Utkast skapade före 3.40.0 fick motpartens deltagare som icke-signerande
  // (signatory: false). Publiceras de så kan kunden bara läsa, inte signera.
  // Rätta dem innan publicering: alla deltagare på motparten blir signerande
  // med rätt att fylla i fält (samma som create-contract gör sedan 3.40.0).
  for (const part of kontrakt.parties ?? []) {
    if (part.my_party) continue
    const deltagare = part.participants ?? (part.participant ? [part.participant] : [])
    for (const p of deltagare) {
      if (p.signatory && p._permissions?.['contract:update']) continue
      const upd = await fetch(
        `${ONEFLOW_API}/contracts/${row.oneflow_contract_id}/parties/${part.id}/participants/${p.id}`,
        {
          method: 'PUT',
          headers: oneflowHeaders(),
          body: JSON.stringify({ signatory: true, _permissions: { 'contract:update': true } }),
        }
      )
      if (!upd.ok) {
        const fel = await upd.json().catch(() => ({}))
        console.error('[oneflow/draft] Kunde inte göra deltagaren signerande:', upd.status, fel)
        return res.status(502).json({
          message: 'Kunden kunde inte sättas som signerande part i Oneflow. Skicka utkastet från Oneflow i stället.',
          oneflow_error: fel,
        })
      }
    }
  }

  const arOffert = row.type === 'offer'
  const mottagare = row.contact_person || ''
  const avsandare = row.begone_employee_name || row.created_by_name || 'BeGone Medarbetare'
  const publishPayload = {
    subject: `${arOffert ? 'Offert' : 'Avtal'} från BeGone Skadedjur & Sanering AB`,
    message: `Hej ${mottagare}!\n\nBifogat finner du vår${arOffert ? 't offertförslag' : 't avtal'} för ${arOffert ? 'granskning' : 'signering'}.\n\nMed vänliga hälsningar,\n${avsandare}\nBeGone Skadedjur & Sanering AB`,
  }

  const pub = await fetch(`${ONEFLOW_API}/contracts/${row.oneflow_contract_id}/publish`, {
    method: 'POST',
    headers: oneflowHeaders(),
    body: JSON.stringify(publishPayload),
  })
  if (!pub.ok) {
    const fel = await pub.json().catch(() => ({}))
    console.error('[oneflow/draft] Publicering misslyckades:', pub.status, fel)
    return res.status(pub.status >= 500 ? 502 : pub.status).json({
      message: (fel as { detail?: string }).detail || 'Oneflow kunde inte skicka dokumentet',
      oneflow_error: fel,
    })
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('contracts')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', row.id)
  if (error) console.error('[oneflow/draft] Kunde inte sätta status pending:', error.code, error.message)

  return res.status(200).json({
    success: true,
    contract: { id: Number(row.oneflow_contract_id), state: 'published' },
  })
}

/**
 * Tar bort ett utkast: först i Oneflow, sedan raden i contracts och de
 * case_billing_items som create-contract sparade för den (case_type 'contract').
 * Bara utkast; ett skickat dokument raderas via Dokumentsigneringens Radera.
 */
async function taBort(row: ContractRow, res: VercelResponse) {
  if (row.status !== 'draft') {
    return res.status(409).json({ message: 'Bara utkast kan tas bort här' })
  }

  const kontrakt = await hamtaOneflowKontrakt(row.oneflow_contract_id)
  if (kontrakt && kontrakt.state !== 'draft') {
    return res.status(409).json({ message: 'Dokumentet är inte längre ett utkast i Oneflow' })
  }

  if (kontrakt) {
    const del = await fetch(`${ONEFLOW_API}/contracts/${row.oneflow_contract_id}`, {
      method: 'DELETE',
      headers: oneflowHeaders(),
    })
    // 404 = redan borta i Oneflow, då städas portalen ändå
    if (!del.ok && del.status !== 404) {
      const fel = await del.json().catch(() => ({}))
      console.error('[oneflow/draft] DELETE i Oneflow misslyckades:', del.status, fel)
      return res.status(502).json({ message: 'Kunde inte ta bort utkastet i Oneflow', oneflow_error: fel })
    }
  }

  const supabase = supabaseAdmin()
  await supabase.from('case_billing_items').delete().eq('case_id', row.id).eq('case_type', 'contract')
  // Koordinatorns åtgärdsrad har en FK utan kaskad mot contracts
  await supabase.from('coordinator_case_actions').delete().eq('contract_id', row.id)
  const { error } = await supabase.from('contracts').delete().eq('id', row.id)
  if (error) {
    // Något annat pekar på raden: markera den som borttagen i stället, som delete-offer gör
    console.error('[oneflow/draft] Kunde inte radera contracts-raden:', error.code, error.message)
    await supabase.from('contracts').update({ status: 'trashed', updated_at: new Date().toISOString() }).eq('id', row.id)
  }

  return res.status(200).json({ success: true })
}
