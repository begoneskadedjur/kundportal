// src/components/admin/procurement/rfi/rfiExport.ts
// "Exportera ifyllt formulär" i RFI-läget (3.71.0). Svaren skrivs in i en
// kopia av köparens eget Word-formulär på de platser som lästes ut
// (src/shared/procurementRfi.ts fillRfiAnswers). Allt annat i filen lämnas
// orört: bara word/document.xml byts, övriga delar i zip-filen kopieras.
// Saknas originalet eller är det en PDF blir exporten en Excel-fil med
// avsnitt, fråga och svar.

import type { ProcurementDocument, ProcurementNotice, ProcurementRfiQuestion } from '../../../../types/procurement'
import { ProcurementService } from '../../../../services/procurementService'
import { answerAsText, fillRfiAnswers } from '../../../../shared/procurementRfi'
import { todaySwedish } from '../../../../shared/procurementRules'
import { exportXlsx } from '../excelExport'
import { downloadBlob } from '../detail/helpers'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface RfiExportResult {
  format: 'docx' | 'xlsx'
  written: number
  skipped: number
  fileName: string
}

/** Formulärets dokument: det som flest frågor lästes ur */
export function formDocumentOf(questions: ProcurementRfiQuestion[], documents: ProcurementDocument[]): ProcurementDocument | null {
  const counts = new Map<string, number>()
  for (const q of questions) if (q.document_id) counts.set(q.document_id, (counts.get(q.document_id) ?? 0) + 1)
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return documents.find((d) => d.id === best) ?? null
}

function isDocx(doc: ProcurementDocument): boolean {
  return /\.docx$/i.test(doc.file_name) || (doc.mime_type ?? '').includes('wordprocessingml')
}

function safeBase(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'RFI'
}

export async function exportRfiAnswers(
  notice: Pick<ProcurementNotice, 'title' | 'buyer_name' | 'bgu_number'>,
  questions: ProcurementRfiQuestion[],
  documents: ProcurementDocument[]
): Promise<RfiExportResult> {
  const doc = formDocumentOf(questions, documents)
  if (doc && isDocx(doc)) {
    const { default: JSZip } = await import('jszip')
    const blob = await ProcurementService.downloadDocument(doc.storage_path)
    const zip = await JSZip.loadAsync(blob)
    const main = zip.file('word/document.xml')
    if (main) {
      const xml = await main.async('string')
      const own = questions.filter((q) => q.document_id === doc.id)
      const result = fillRfiAnswers(xml, own)
      zip.file('word/document.xml', result.xml)
      const out = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' })
      const fileName = `${safeBase(doc.file_name)} BeGone ${todaySwedish()}.docx`
      downloadBlob(out, fileName)
      return { format: 'docx', written: result.written, skipped: result.skipped.length + (questions.length - own.length), fileName }
    }
  }

  const base = `RFI ${safeBase(notice.title)} BeGone ${todaySwedish()}`
  await exportXlsx({
    fileBase: base,
    sheetName: 'Svar',
    title: `Svar på RFI: ${notice.title}`,
    subtitle: `${notice.buyer_name ?? 'Okänd köpare'}, BGU-${notice.bgu_number}. Exporterad ${todaySwedish()} ur upphandlingsportalen.`,
    columns: [
      { header: 'Avsnitt', width: 28 },
      { header: 'Fråga', width: 60 },
      { header: 'Svar', width: 80 },
      { header: 'Status', width: 12 },
    ],
    rows: questions.map((q) => [q.section ?? '', q.question, answerAsText(q), q.answer_status === 'godkand' ? 'Godkänt' : 'Utkast']),
  })
  return { format: 'xlsx', written: questions.filter((q) => answerAsText(q).trim()).length, skipped: 0, fileName: `${base}.xlsx` }
}
