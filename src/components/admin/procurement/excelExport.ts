// src/components/admin/procurement/excelExport.ts
// Excel-export från portalens listor (beslutat tillägg, docs/upphandlingsportal-ux-plan.md
// avsnitt 5 Tabeller och tavla): ikonknappen upphandling.excel i sidhuvudet på
// Annonser och Anbud. Samma mönster som prisbilagans export (exceljs laddas
// först när någon exporterar).

import { todaySwedish } from '../../../shared/procurementRules'
import { downloadBlob } from './detail/helpers'

export interface ExcelColumn {
  header: string
  width?: number
  /** Talformat, t.ex. '# ##0' för kronor */
  numFmt?: string
}

export type ExcelCell = string | number | null

export async function exportXlsx(opts: {
  fileBase: string
  sheetName: string
  title: string
  subtitle?: string
  columns: ExcelColumn[]
  rows: ExcelCell[][]
}): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BeGone'
  wb.created = new Date()
  const ws = wb.addWorksheet(opts.sheetName.slice(0, 31))
  ws.addRow([opts.title]).font = { bold: true, size: 13 }
  ws.addRow([opts.subtitle ?? `Exporterad ${todaySwedish()} ur upphandlingsportalen.`])
  ws.addRow([])
  const header = ws.addRow(opts.columns.map((c) => c.header))
  header.font = { bold: true }
  header.eachCell((c) => {
    c.border = { bottom: { style: 'thin' } }
  })
  for (const r of opts.rows) ws.addRow(r)
  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.width ?? 16
    if (c.numFmt) col.numFmt = c.numFmt
  })
  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${opts.fileBase}_${todaySwedish()}.xlsx`
  )
}
