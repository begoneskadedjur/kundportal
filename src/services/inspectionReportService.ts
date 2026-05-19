// src/services/inspectionReportService.ts
// Generering av kontrollrapporter (PDF via Puppeteer + Excel via ExcelJS) för kundportalen

import ExcelJS from 'exceljs'
import {
  getInspectionSession,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession,
  getSessionInspectionSummary
} from './inspectionSessionService'
import type { OutdoorInspectionWithRelations } from '../types/inspectionSession'
import type { IndoorStationInspectionWithRelations } from '../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../types/indoor'
import type { InspectionStatus } from '../types/indoor'

// ============================================
// TYPES
// ============================================

interface InspectionReportData {
  session: any
  outdoorInspections: OutdoorInspectionWithRelations[]
  indoorInspections: IndoorStationInspectionWithRelations[]
  summary: { ok: number; warning: number; critical: number; total: number }
}

// ============================================
// DATA COLLECTION
// ============================================

async function getReportData(sessionId: string): Promise<InspectionReportData | null> {
  const [session, outdoorInspections, indoorInspections, summary] = await Promise.all([
    getInspectionSession(sessionId),
    getOutdoorInspectionsForSession(sessionId),
    getIndoorInspectionsForSession(sessionId),
    getSessionInspectionSummary(sessionId)
  ])

  if (!session) return null

  return { session, outdoorInspections, indoorInspections, summary }
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function getStatusLabel(status: string): string {
  return INSPECTION_STATUS_CONFIG[status as InspectionStatus]?.label || status || '-'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================================
// PDF GENERATION (via Puppeteer API endpoint)
// ============================================

export async function generateInspectionPDF(sessionId: string): Promise<void> {
  const data = await getReportData(sessionId)
  if (!data) throw new Error('Kunde inte hämta sessionsdata')

  const { session, outdoorInspections, indoorInspections, summary } = data

  const response = await fetch('/api/generate-inspection-report-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: {
        id: session.id,
        completed_at: session.completed_at || session.created_at,
        notes: session.notes
      },
      customer: session.customer ? {
        company_name: session.customer.company_name,
        contact_address: session.customer.contact_address,
        contact_person: session.customer.contact_person,
        contact_phone: session.customer.contact_phone,
        contact_email: session.customer.contact_email
      } : null,
      technician: session.technician ? {
        name: session.technician.name,
        email: session.technician.email
      } : null,
      outdoorInspections,
      indoorInspections,
      summary
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `PDF-generering misslyckades (${response.status})`)
  }

  const result = await response.json()

  if (!result.success || !result.pdf) {
    throw new Error('Ogiltig PDF-respons från servern')
  }

  // Convert base64 to blob and download
  const pdfBytes = Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  downloadBlob(blob, result.filename)
}

// ============================================
// EXCEL GENERATION
// ============================================

const BG_DARK = '0A1328'
const BG_GREEN = '20C58F'
const BG_WHITE = 'FFFFFF'
const TEXT_MUTED = '94A3B8'
const TEXT_DARK = '334155'
const STATUS_OK = '22C55E'
const STATUS_WARNING = 'F59E0B'
const STATUS_ERROR = 'EF4444'
const STATUS_REPLACED = '3B82F6'
const ROW_ALT = 'F8FAFC'

function statusFill(status: string): string {
  switch (status) {
    case 'OK': return STATUS_OK
    case 'Aktivitet': return STATUS_WARNING
    case 'Behöver service': return STATUS_ERROR
    case 'Utbytt': return STATUS_REPLACED
    default: return TEXT_MUTED
  }
}

function applyHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 22
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > colCount) return
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BG_DARK } }
    cell.font = { bold: true, color: { argb: 'FF' + BG_WHITE }, size: 9 }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF' + BG_GREEN } }
    }
  })
}

function applyDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.height = 18
  row.eachCell({ includeEmpty: true }, cell => {
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ROW_ALT } }
    }
    cell.font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }
    cell.alignment = { vertical: 'middle' }
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
    }
  })
}

export async function generateInspectionExcel(sessionId: string): Promise<void> {
  const data = await getReportData(sessionId)
  if (!data) throw new Error('Kunde inte hämta sessionsdata')

  const { session, outdoorInspections, indoorInspections, summary } = data
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BeGone Kundportal'
  wb.created = new Date()

  // ============================================================
  // FLIK 1: Sammanfattning
  // ============================================================
  const wsSummary = wb.addWorksheet('Sammanfattning')
  wsSummary.columns = [
    { width: 22 },
    { width: 40 },
    { width: 14 },
    { width: 14 },
  ]

  // Logotyprad
  const titleRow = wsSummary.addRow(['KONTROLLRAPPORT', '', '', ''])
  wsSummary.mergeCells('A1:D1')
  titleRow.height = 32
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BG_DARK } }
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF' + BG_GREEN } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  const subtitleRow = wsSummary.addRow([formatDate(session.completed_at || session.created_at), '', '', ''])
  wsSummary.mergeCells('A2:D2')
  subtitleRow.height = 18
  subtitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BG_DARK } }
  subtitleRow.getCell(1).font = { size: 10, color: { argb: 'FF' + TEXT_MUTED } }
  subtitleRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }

  wsSummary.addRow([])

  // Statusöversikt
  const statsHeaderRow = wsSummary.addRow(['RESULTATÖVERSIKT', '', '', ''])
  wsSummary.mergeCells(`A${statsHeaderRow.number}:D${statsHeaderRow.number}`)
  statsHeaderRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF' + BG_GREEN } }
  statsHeaderRow.getCell(1).alignment = { indent: 1 }
  statsHeaderRow.height = 20

  const statsColHeader = wsSummary.addRow(['', 'Totalt', 'OK', 'Varning / Kritisk'])
  applyHeaderRow(statsColHeader, 4)

  const statsRow = wsSummary.addRow(['Inspekterade stationer', summary.total, summary.ok, summary.warning + summary.critical])
  statsRow.height = 20
  statsRow.getCell(1).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }
  statsRow.getCell(2).font = { bold: true, size: 11 }
  statsRow.getCell(3).font = { bold: true, size: 11, color: { argb: 'FF' + STATUS_OK } }
  const warnCritVal = summary.warning + summary.critical
  statsRow.getCell(4).font = { bold: true, size: 11, color: { argb: 'FF' + (warnCritVal > 0 ? STATUS_ERROR : STATUS_OK) } }

  const outdoorRow = wsSummary.addRow(['Utomhusstationer', outdoorInspections.length, '', ''])
  outdoorRow.height = 18
  outdoorRow.getCell(1).font = { size: 9, color: { argb: 'FF' + TEXT_MUTED } }
  outdoorRow.getCell(2).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }

  const indoorRow = wsSummary.addRow(['Inomhusstationer', indoorInspections.length, '', ''])
  indoorRow.height = 18
  indoorRow.getCell(1).font = { size: 9, color: { argb: 'FF' + TEXT_MUTED } }
  indoorRow.getCell(2).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }

  wsSummary.addRow([])

  // Utförare + Kund sida vid sida
  const infoHeaderRow = wsSummary.addRow(['UTFÖRARE', '', 'KUND', ''])
  infoHeaderRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF' + BG_GREEN } }
  infoHeaderRow.getCell(3).font = { bold: true, size: 9, color: { argb: 'FF' + BG_GREEN } }
  infoHeaderRow.height = 20

  const infoRows: [string, string, string, string][] = [
    ['Företag', 'BeGone Skadedjur & Sanering AB', 'Kund', session.customer?.company_name || '-'],
    ['Org.nr', '559378-9208', 'Kontakt', session.customer?.contact_person || '-'],
    ['Telefon', '010 280 44 10', 'Adress', session.customer?.contact_address || '-'],
    ['Email', 'info@begone.se', 'Telefon', session.customer?.contact_phone || '-'],
    ['Tekniker', session.technician?.name || '-', 'Email', session.customer?.contact_email || '-'],
  ]

  infoRows.forEach(([labelA, valA, labelB, valB], i) => {
    const r = wsSummary.addRow([labelA, valA, labelB, valB])
    r.height = 18
    r.getCell(1).font = { size: 9, bold: true, color: { argb: 'FF' + TEXT_MUTED } }
    r.getCell(2).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }
    r.getCell(3).font = { size: 9, bold: true, color: { argb: 'FF' + TEXT_MUTED } }
    r.getCell(4).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }
    if (i % 2 === 1) {
      ;[1, 2, 3, 4].forEach(c => {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ROW_ALT } }
      })
    }
  })

  if (session.notes) {
    wsSummary.addRow([])
    const notesLabelRow = wsSummary.addRow(['ANTECKNINGAR', '', '', ''])
    wsSummary.mergeCells(`A${notesLabelRow.number}:D${notesLabelRow.number}`)
    notesLabelRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF' + BG_GREEN } }
    const notesRow = wsSummary.addRow([session.notes, '', '', ''])
    wsSummary.mergeCells(`A${notesRow.number}:D${notesRow.number}`)
    notesRow.getCell(1).font = { size: 9, color: { argb: 'FF' + TEXT_DARK } }
    notesRow.getCell(1).alignment = { wrapText: true }
    notesRow.height = 40
  }

  // ============================================================
  // FLIK 2: Utomhusstationer
  // ============================================================
  if (outdoorInspections.length > 0) {
    const sortedOutdoor = [...outdoorInspections].sort((a, b) => {
      const dateA = (a.station as any)?.placed_at || a.inspected_at || ''
      const dateB = (b.station as any)?.placed_at || b.inspected_at || ''
      return dateA.localeCompare(dateB)
    })

    const wsOut = wb.addWorksheet('Utomhusstationer')
    wsOut.columns = [
      { key: 'nr', width: 6 },
      { key: 'typ', width: 20 },
      { key: 'status', width: 18 },
      { key: 'matLabel', width: 20 },
      { key: 'matValue', width: 12 },
      { key: 'unit', width: 10 },
      { key: 'comment', width: 40 },
      { key: 'prep', width: 22 },
      { key: 'prepReg', width: 16 },
      { key: 'inspected', width: 20 },
    ]

    const headerRow = wsOut.addRow(['Nr', 'Typ', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Reg.nr', 'Kontrollerad'])
    applyHeaderRow(headerRow, 10)
    wsOut.views = [{ state: 'frozen', ySplit: 1 }]

    sortedOutdoor.forEach((insp, index) => {
      const statusLabel = getStatusLabel(insp.status)
      const matVal = insp.measurement_value !== null && insp.measurement_value !== undefined
        ? Number(insp.measurement_value)
        : ''
      const row = wsOut.addRow([
        index + 1,
        insp.station?.station_type_data?.name || (insp.station as any)?.equipment_type || '-',
        statusLabel,
        insp.station?.station_type_data?.measurement_label || '-',
        matVal,
        insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-',
        insp.findings || '',
        insp.preparation?.name || '',
        insp.preparation?.registration_number || '',
        formatDateTime(insp.inspected_at),
      ])
      applyDataRow(row, index % 2 === 1)
      row.getCell(1).font = { bold: true, size: 9 }
      row.getCell(3).font = { bold: true, size: 9, color: { argb: 'FF' + statusFill(statusLabel) } }
      row.getCell(7).alignment = { wrapText: true, vertical: 'top' }
    })
  }

  // ============================================================
  // FLIK 3: Inomhusstationer
  // ============================================================
  if (indoorInspections.length > 0) {
    const floorPlanGroups = new Map<string, typeof indoorInspections>()
    for (const insp of indoorInspections) {
      const fpId = (insp.station as any)?.floor_plan?.id || 'unknown'
      if (!floorPlanGroups.has(fpId)) floorPlanGroups.set(fpId, [])
      floorPlanGroups.get(fpId)!.push(insp)
    }

    const numberMap = new Map<string, number>()
    for (const [, group] of floorPlanGroups) {
      group.sort((a, b) =>
        ((a.station as any)?.placed_at || '').localeCompare((b.station as any)?.placed_at || '')
      )
      group.forEach((insp, i) => numberMap.set(insp.id, i + 1))
    }

    const sortedIndoor = [...indoorInspections].sort((a, b) => {
      const fpA = (a.station as any)?.floor_plan?.name || ''
      const fpB = (b.station as any)?.floor_plan?.name || ''
      if (fpA !== fpB) return fpA.localeCompare(fpB)
      return ((a.station as any)?.placed_at || '').localeCompare((b.station as any)?.placed_at || '')
    })

    const wsIn = wb.addWorksheet('Inomhusstationer')
    wsIn.columns = [
      { key: 'nr', width: 6 },
      { key: 'typ', width: 20 },
      { key: 'planritning', width: 20 },
      { key: 'plats', width: 22 },
      { key: 'status', width: 18 },
      { key: 'matLabel', width: 20 },
      { key: 'matValue', width: 12 },
      { key: 'unit', width: 10 },
      { key: 'comment', width: 40 },
      { key: 'prep', width: 22 },
      { key: 'prepReg', width: 16 },
      { key: 'inspected', width: 20 },
    ]

    const headerRow = wsIn.addRow(['Nr', 'Typ', 'Planritning', 'Plats', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Reg.nr', 'Kontrollerad'])
    applyHeaderRow(headerRow, 12)
    wsIn.views = [{ state: 'frozen', ySplit: 1 }]

    let currentFp = ''
    let rowIdx = 0

    sortedIndoor.forEach(insp => {
      const station = insp.station as any
      const fp = station?.floor_plan?.name || '-'
      const statusLabel = getStatusLabel(insp.status)

      if (fp !== currentFp) {
        // Grupprubrik per planritning
        if (currentFp !== '') wsIn.addRow([])
        const fpRow = wsIn.addRow([fp, '', '', '', '', '', '', '', '', '', '', ''])
        wsIn.mergeCells(`A${fpRow.number}:L${fpRow.number}`)
        fpRow.height = 20
        fpRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BG_DARK } }
        fpRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF' + BG_WHITE } }
        fpRow.getCell(1).alignment = { vertical: 'middle', indent: 1 }
        currentFp = fp
        rowIdx = 0
      }

      const indoorMatVal = insp.measurement_value !== null && insp.measurement_value !== undefined
        ? Number(insp.measurement_value)
        : ''
      const row = wsIn.addRow([
        numberMap.get(insp.id) ?? '-',
        station?.station_type_data?.name || station?.station_type || '-',
        fp,
        station?.location_description || '',
        statusLabel,
        station?.station_type_data?.measurement_label || '-',
        indoorMatVal,
        insp.measurement_unit || station?.station_type_data?.measurement_unit || '-',
        insp.findings || '',
        insp.preparation?.name || '',
        insp.preparation?.registration_number || '',
        formatDateTime(insp.inspected_at),
      ])
      applyDataRow(row, rowIdx % 2 === 1)
      row.getCell(1).font = { bold: true, size: 9 }
      row.getCell(5).font = { bold: true, size: 9, color: { argb: 'FF' + statusFill(statusLabel) } }
      row.getCell(9).alignment = { wrapText: true, vertical: 'top' }
      rowIdx++
    })
  }

  // ============================================================
  // SPARA
  // ============================================================
  const customerName = (session.customer?.company_name || 'kund').replace(/[^a-zåäöA-ZÅÄÖ0-9]/g, '_')
  const sessionDate = session.completed_at || session.created_at
  const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : 'okänt-datum'
  const filename = `Kontrollrapport_${customerName}_${dateStr}.xlsx`

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, filename)
}
