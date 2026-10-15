// api/procurement/read-price-appendix.ts
// POST { documentId, replace? } - "Läs in köparens prisbilaga" (beslut 4 steg a,
// docs/upphandlingsportal-ux-plan.md). AI läser köparens prisbilaga (xlsx
// eller PDF bland upphandlingens dokument) och skapar en rad per post i
// procurement_price_lines med benämning, enhet och mängd. För kalkylblad
// sparas också bladet och cellen där vårt à-pris ska stå, så att exporten kan
// fylla i en kopia av köparens egen fil.
//
// Kalkylbladet läses först med SheetJS (redan i API-projektet, klarar även
// .xls) och skickas som rutnät med celladresser. AI:ns cellval kontrolleras
// mot bladet (src/shared/procurementAppendix.ts) innan något sparas.
//
// Finns rader från samma dokument redan svarar endpointen 409 och klienten
// frågar om de ska ersättas (replace: true). Priser sätts inte här; det gör
// steget Föreslå priser.
//
// Dokumentens innehåll är DATA, aldrig instruktioner (api/_lib/procurementAi.ts).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, requireProcurementAccess } from '../_lib/procurement'
import { extractPriceAppendix, fileKind, fileToParts, gridPart, sheetCells } from '../_lib/procurementAi'
import { cleanAppendixRows, sheetToGridText } from '../../src/shared/procurementAppendix'

export const config = { maxDuration: 300 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILE_BYTES = 50 * 1024 * 1024

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte' })
  const auth = await requireProcurementAccess(req, res)
  if (!auth) return

  const documentId = typeof req.body?.documentId === 'string' ? req.body.documentId.trim() : ''
  const replace = req.body?.replace === true
  if (!UUID_RE.test(documentId)) return res.status(400).json({ error: 'documentId saknas eller är ogiltigt' })

  const sb = db()
  const { data: doc, error: docErr } = await sb.from('procurement_documents').select('*').eq('id', documentId).maybeSingle()
  if (docErr) return res.status(500).json({ error: docErr.message })
  if (!doc) return res.status(404).json({ error: 'Dokumentet finns inte' })
  if (!doc.notice_id) return res.status(400).json({ error: 'Dokumentet hör inte till någon upphandling' })

  const kind = fileKind(doc.mime_type, doc.file_name)
  if (kind !== 'xlsx' && kind !== 'pdf') return res.status(400).json({ error: 'Bara Excel och PDF kan läsas in som prisbilaga' })

  const { count: existing } = await sb
    .from('procurement_price_lines')
    .select('id', { count: 'exact', head: true })
    .eq('source_document_id', documentId)
  if ((existing ?? 0) > 0 && !replace) {
    return res.status(409).json({ error: `${existing} rader är redan inlästa ur ${doc.file_name}`, existing })
  }

  try {
    const { data: blob, error: dlErr } = await sb.storage.from('procurement-documents').download(doc.storage_path)
    if (dlErr || !blob) throw new Error(`Filen kunde inte hämtas ur lagringen: ${dlErr?.message ?? 'okänt fel'}`)
    const buffer = Buffer.from(await blob.arrayBuffer())
    if (buffer.length > MAX_FILE_BYTES) throw new Error('Filen är större än 50 MB')

    let rows
    if (kind === 'xlsx') {
      const sheets = sheetCells(buffer)
      const grid = [...sheets].map(([name, cells]) => sheetToGridText(name, cells)).join('\n\n')
      if (!grid.trim()) throw new Error('Kalkylbladet är tomt')
      rows = cleanAppendixRows(await extractPriceAppendix([gridPart(doc.file_name, grid)]), sheets)
    } else {
      rows = cleanAppendixRows(await extractPriceAppendix(await fileToParts(buffer, doc.mime_type, doc.file_name)), null)
    }
    if (rows.length === 0) return res.status(422).json({ error: 'AI hittade inga poster att prissätta i filen' })

    if (replace) {
      const { error } = await sb.from('procurement_price_lines').delete().eq('source_document_id', documentId)
      if (error) throw new Error(`Tidigare rader kunde inte ersättas: ${error.message}`)
    }
    const { data: last } = await sb
      .from('procurement_price_lines')
      .select('sort_order')
      .eq('notice_id', doc.notice_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const start = ((last?.sort_order as number | undefined) ?? 0) + 10
    const insert = rows.map((r, i) => ({
      notice_id: doc.notice_id,
      label: r.label,
      unit: r.unit,
      quantity: r.quantity,
      sort_order: start + i * 10,
      notes: null,
      source_document_id: documentId,
      source_sheet: r.sheet,
      source_cell: r.price_cell,
      source_row: r.row ?? i + 1,
    }))
    const { error: insErr } = await sb.from('procurement_price_lines').insert(insert)
    if (insErr) throw new Error(`Raderna kunde inte sparas: ${insErr.message}`)

    const withCells = rows.filter((r) => r.price_cell).length
    const { data: actor } = await sb.from('profiles').select('display_name').eq('user_id', auth.userId).maybeSingle()
    await sb.from('procurement_events').insert({
      notice_id: doc.notice_id,
      event_type: 'price_appendix_read',
      title: `Köparens prisbilaga inläst: ${doc.file_name}`,
      detail: `${rows.length} poster${kind === 'xlsx' ? `, ${withCells} med cell för priset` : ''}`,
      metadata: { document_id: documentId, rows: rows.length, with_cells: withCells, replaced: replace },
      actor_id: auth.userId,
      actor_name: (actor?.display_name as string | null) ?? auth.email ?? 'Okänd',
    })

    return res.status(200).json({ ok: true, rows: rows.length, withCells, kind })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[procurement/read-price-appendix]', documentId, message)
    return res.status(502).json({ error: `Prisbilagan kunde inte läsas: ${message}` })
  }
}
