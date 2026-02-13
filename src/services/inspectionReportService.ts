// src/services/inspectionReportService.ts
// Generering av kontrollrapporter (PDF + Excel) för kundportalen

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  getInspectionSession,
  getOutdoorInspectionsForSession,
  getIndoorInspectionsForSession,
  getSessionInspectionSummary
} from './inspectionSessionService'
import type { InspectionSessionWithRelations, OutdoorInspectionWithRelations } from '../types/inspectionSession'
import type { IndoorStationInspectionWithRelations } from '../types/indoor'
import { INSPECTION_STATUS_CONFIG } from '../types/indoor'
import type { InspectionStatus } from '../types/indoor'

// ============================================
// TYPES
// ============================================

interface InspectionReportData {
  session: InspectionSessionWithRelations
  outdoorInspections: OutdoorInspectionWithRelations[]
  indoorInspections: IndoorStationInspectionWithRelations[]
  summary: { ok: number; warning: number; critical: number; total: number }
}

// ============================================
// COMPANY INFO
// ============================================

const BEGONE_INFO = {
  name: 'BeGone Skadedjur & Sanering AB',
  orgNr: '559378-9208',
  phone: '010 280 44 10',
  email: 'info@begone.se',
  address: 'Bläcksvampsvägen 17, 141 60 Huddinge',
  website: 'www.begone.se'
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
// PDF GENERATION
// ============================================

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

export async function generateInspectionPDF(sessionId: string): Promise<void> {
  const data = await getReportData(sessionId)
  if (!data) throw new Error('Kunde inte hämta sessionsdata')

  const { session, outdoorInspections, indoorInspections, summary } = data

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // === COLORS ===
  const primary: [number, number, number] = [10, 19, 40]
  const accent: [number, number, number] = [32, 197, 143]
  const white: [number, number, number] = [255, 255, 255]
  const darkGray: [number, number, number] = [51, 65, 85]
  const mediumGray: [number, number, number] = [148, 163, 184]
  const lightGray: [number, number, number] = [241, 245, 249]

  // === HEADER ===
  // Green accent bar
  pdf.setFillColor(...accent)
  pdf.rect(0, 0, pageWidth, 3, 'F')

  y = 12

  // Title
  pdf.setFontSize(18)
  pdf.setFont(undefined as any, 'bold')
  pdf.setTextColor(...primary)
  pdf.text('KONTROLLRAPPORT', margin, y)

  // Company name right-aligned
  pdf.setFontSize(10)
  pdf.setFont(undefined as any, 'bold')
  pdf.setTextColor(...accent)
  pdf.text(BEGONE_INFO.name, pageWidth - margin, y, { align: 'right' })

  y += 6
  pdf.setFontSize(12)
  pdf.setFont(undefined as any, 'normal')
  pdf.setTextColor(...darkGray)
  pdf.text(session.customer?.company_name || 'Okänd kund', margin, y)

  pdf.setFontSize(8)
  pdf.setTextColor(...mediumGray)
  pdf.text(`Org.nr: ${BEGONE_INFO.orgNr}  |  Tel: ${BEGONE_INFO.phone}  |  ${BEGONE_INFO.email}`, pageWidth - margin, y, { align: 'right' })

  y += 4
  pdf.setDrawColor(...accent)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 6

  // === INFO SECTION (two columns) ===
  const col1 = margin
  const col2 = margin + contentWidth / 2 + 5

  // Left: Utförare
  pdf.setFontSize(8)
  pdf.setFont(undefined as any, 'bold')
  pdf.setTextColor(...mediumGray)
  pdf.text('UTFÖRARE', col1, y)
  pdf.text('KUND', col2, y)
  y += 4

  pdf.setFontSize(9)
  pdf.setFont(undefined as any, 'normal')
  pdf.setTextColor(...darkGray)
  const techName = session.technician?.name || 'Okänd tekniker'
  const techEmail = session.technician?.email || ''
  pdf.text(`Tekniker: ${techName}`, col1, y)
  pdf.text(`Kontakt: ${session.customer?.contact_person || '-'}`, col2, y)
  y += 4
  if (techEmail) {
    pdf.text(`Email: ${techEmail}`, col1, y)
  } else {
    pdf.text(`Tel: ${BEGONE_INFO.phone}`, col1, y)
  }
  pdf.text(`Adress: ${session.customer?.contact_address || '-'}`, col2, y)
  y += 4
  pdf.text(`Datum: ${formatDate(session.completed_at)}`, col1, y)
  pdf.text(`Tel: ${session.customer?.contact_phone || '-'}`, col2, y)
  y += 4
  pdf.text(`${BEGONE_INFO.address}`, col1, y)
  pdf.text(`Email: ${session.customer?.contact_email || '-'}`, col2, y)

  y += 7

  // === SUMMARY SECTION ===
  pdf.setFillColor(...lightGray)
  pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F')

  pdf.setFontSize(9)
  pdf.setFont(undefined as any, 'bold')
  pdf.setTextColor(...primary)
  const summaryY = y + 7.5
  pdf.text(`Totalt inspekterade: ${summary.total}`, margin + 5, summaryY)
  pdf.setTextColor(34, 197, 94)
  pdf.text(`OK: ${summary.ok}`, margin + 60, summaryY)
  pdf.setTextColor(245, 158, 11)
  pdf.text(`Varning: ${summary.warning}`, margin + 80, summaryY)
  pdf.setTextColor(239, 68, 68)
  pdf.text(`Kritisk: ${summary.critical}`, margin + 110, summaryY)

  if (session.notes) {
    pdf.setTextColor(...mediumGray)
    pdf.setFont(undefined as any, 'normal')
    pdf.text(`Anteckningar: ${session.notes}`, margin + 140, summaryY)
  }

  y += 17

  // === OUTDOOR STATIONS TABLE ===
  if (outdoorInspections.length > 0) {
    pdf.setFontSize(11)
    pdf.setFont(undefined as any, 'bold')
    pdf.setTextColor(...primary)
    pdf.text(`Utomhusstationer (${outdoorInspections.length} st)`, margin, y)
    y += 3

    const outdoorRows = outdoorInspections.map(insp => [
      insp.station?.serial_number || '-',
      insp.station?.station_type_data?.name || insp.station?.equipment_type || '-',
      getStatusLabel(insp.status),
      insp.station?.station_type_data?.measurement_label || '-',
      insp.measurement_value !== null && insp.measurement_value !== undefined ? String(insp.measurement_value) : '-',
      insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-',
      insp.findings || '-',
      insp.preparation?.name || '-',
      formatDateTime(insp.inspected_at)
    ])

    pdf.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Nr', 'Typ', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Kontrollerad']],
      body: outdoorRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [203, 213, 225],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: primary,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 7
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 14 },
        6: { cellWidth: 'auto' },
        7: { cellWidth: 28 },
        8: { cellWidth: 32 }
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string
          if (val.includes('OK')) data.cell.styles.textColor = [34, 197, 94]
          else if (val.includes('Aktivitet')) data.cell.styles.textColor = [245, 158, 11]
          else if (val.includes('service')) data.cell.styles.textColor = [249, 115, 22]
        }
      }
    })

    y = pdf.lastAutoTable.finalY + 8
  }

  // === INDOOR STATIONS TABLE ===
  if (indoorInspections.length > 0) {
    // Gruppera per planritning
    const byFloorPlan = new Map<string, { name: string; building: string | null; inspections: IndoorStationInspectionWithRelations[] }>()

    for (const insp of indoorInspections) {
      const fp = (insp.station as any)?.floor_plan
      const fpId = fp?.id || 'unknown'
      if (!byFloorPlan.has(fpId)) {
        byFloorPlan.set(fpId, {
          name: fp?.name || 'Okänd planritning',
          building: fp?.building_name || null,
          inspections: []
        })
      }
      byFloorPlan.get(fpId)!.inspections.push(insp)
    }

    for (const [, group] of byFloorPlan) {
      // Check page break
      if (y > pageHeight - 30) {
        pdf.addPage()
        y = margin
      }

      const sectionTitle = group.building
        ? `Inomhusstationer — ${group.name} (${group.building}) (${group.inspections.length} st)`
        : `Inomhusstationer — ${group.name} (${group.inspections.length} st)`

      pdf.setFontSize(11)
      pdf.setFont(undefined as any, 'bold')
      pdf.setTextColor(...primary)
      pdf.text(sectionTitle, margin, y)
      y += 3

      const indoorRows = group.inspections.map(insp => [
        (insp.station as any)?.station_number || '-',
        (insp.station as any)?.station_type_data?.name || (insp.station as any)?.station_type || '-',
        getStatusLabel(insp.status),
        (insp.station as any)?.station_type_data?.measurement_label || '-',
        insp.measurement_value !== null && insp.measurement_value !== undefined ? String(insp.measurement_value) : '-',
        insp.measurement_unit || (insp.station as any)?.station_type_data?.measurement_unit || '-',
        insp.findings || '-',
        insp.preparation?.name || '-',
        formatDateTime(insp.inspected_at)
      ])

      pdf.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Nr', 'Typ', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Kontrollerad']],
        body: indoorRows,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 2,
          textColor: darkGray,
          lineColor: [203, 213, 225],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: primary,
          textColor: white,
          fontStyle: 'bold',
          fontSize: 7
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 28 },
          4: { cellWidth: 18, halign: 'right' },
          5: { cellWidth: 14 },
          6: { cellWidth: 'auto' },
          7: { cellWidth: 28 },
          8: { cellWidth: 32 }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = data.cell.raw as string
            if (val.includes('OK')) data.cell.styles.textColor = [34, 197, 94]
            else if (val.includes('Aktivitet')) data.cell.styles.textColor = [245, 158, 11]
            else if (val.includes('service')) data.cell.styles.textColor = [249, 115, 22]
          }
        }
      })

      y = pdf.lastAutoTable.finalY + 8
    }
  }

  // === FOOTER on each page ===
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(...mediumGray)
    pdf.text(
      `Genererad: ${new Date().toLocaleDateString('sv-SE')}  •  ${BEGONE_INFO.name}  •  ${BEGONE_INFO.website}`,
      margin,
      pageHeight - 8
    )
    pdf.text(
      `Sida ${i} av ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    )

    // Bottom accent bar
    pdf.setFillColor(...accent)
    pdf.rect(0, pageHeight - 3, pageWidth, 3, 'F')
  }

  // === SAVE ===
  const customerName = (session.customer?.company_name || 'kund').replace(/[^a-zåäöA-ZÅÄÖ0-9]/g, '_')
  const dateStr = session.completed_at ? new Date(session.completed_at).toISOString().slice(0, 10) : 'okänt-datum'
  const filename = `Kontrollrapport_${customerName}_${dateStr}.pdf`

  pdf.save(filename)
}

// ============================================
// EXCEL GENERATION
// ============================================

export async function generateInspectionExcel(sessionId: string): Promise<void> {
  const data = await getReportData(sessionId)
  if (!data) throw new Error('Kunde inte hämta sessionsdata')

  const { session, outdoorInspections, indoorInspections, summary } = data

  const wb = XLSX.utils.book_new()

  // === FLIK 1: Sammanfattning ===
  const summaryData = [
    ['KONTROLLRAPPORT'],
    [],
    ['Utförare', BEGONE_INFO.name],
    ['Org.nr', BEGONE_INFO.orgNr],
    ['Telefon', BEGONE_INFO.phone],
    ['Email', BEGONE_INFO.email],
    ['Adress', BEGONE_INFO.address],
    [],
    ['Tekniker', session.technician?.name || '-'],
    ['Tekniker email', session.technician?.email || '-'],
    [],
    ['Kund', session.customer?.company_name || '-'],
    ['Kundadress', session.customer?.contact_address || '-'],
    ['Kontaktperson', session.customer?.contact_person || '-'],
    ['Kundtelefon', session.customer?.contact_phone || '-'],
    ['Kundemail', session.customer?.contact_email || '-'],
    [],
    ['Kontrolldatum', formatDate(session.completed_at)],
    ['Anteckningar', session.notes || '-'],
    [],
    ['Totalt inspekterade', summary.total],
    ['OK', summary.ok],
    ['Varning', summary.warning],
    ['Kritisk', summary.critical],
    ['Utomhusstationer', outdoorInspections.length],
    ['Inomhusstationer', indoorInspections.length]
  ]

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  // Bredda kolumner
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Sammanfattning')

  // === FLIK 2: Utomhusstationer ===
  if (outdoorInspections.length > 0) {
    const outdoorHeaders = ['Nr', 'Typ', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Preparat reg.nr', 'Kontrollerad']
    const outdoorRows = outdoorInspections.map(insp => [
      insp.station?.serial_number || '-',
      insp.station?.station_type_data?.name || insp.station?.equipment_type || '-',
      getStatusLabel(insp.status),
      insp.station?.station_type_data?.measurement_label || '-',
      insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '',
      insp.measurement_unit || insp.station?.station_type_data?.measurement_unit || '-',
      insp.findings || '',
      insp.preparation?.name || '',
      insp.preparation?.registration_number || '',
      formatDateTime(insp.inspected_at)
    ])

    const wsOutdoor = XLSX.utils.aoa_to_sheet([outdoorHeaders, ...outdoorRows])
    wsOutdoor['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      { wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 20 },
      { wch: 16 }, { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, wsOutdoor, 'Utomhusstationer')
  }

  // === FLIK 3: Inomhusstationer ===
  if (indoorInspections.length > 0) {
    const indoorHeaders = ['Nr', 'Typ', 'Planritning', 'Byggnad', 'Status', 'Mätvärde avser', 'Mätvärde', 'Enhet', 'Anteckning', 'Preparat', 'Preparat reg.nr', 'Kontrollerad']
    const indoorRows = indoorInspections.map(insp => {
      const station = insp.station as any
      return [
        station?.station_number || '-',
        station?.station_type_data?.name || station?.station_type || '-',
        station?.floor_plan?.name || '-',
        station?.floor_plan?.building_name || '',
        getStatusLabel(insp.status),
        station?.station_type_data?.measurement_label || '-',
        insp.measurement_value !== null && insp.measurement_value !== undefined ? insp.measurement_value : '',
        insp.measurement_unit || station?.station_type_data?.measurement_unit || '-',
        insp.findings || '',
        insp.preparation?.name || '',
        insp.preparation?.registration_number || '',
        formatDateTime(insp.inspected_at)
      ]
    })

    const wsIndoor = XLSX.utils.aoa_to_sheet([indoorHeaders, ...indoorRows])
    wsIndoor['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
      { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 8 },
      { wch: 40 }, { wch: 20 }, { wch: 16 }, { wch: 20 }
    ]
    XLSX.utils.book_append_sheet(wb, wsIndoor, 'Inomhusstationer')
  }

  // === SAVE ===
  const customerName = (session.customer?.company_name || 'kund').replace(/[^a-zåäöA-ZÅÄÖ0-9]/g, '_')
  const dateStr = session.completed_at ? new Date(session.completed_at).toISOString().slice(0, 10) : 'okänt-datum'
  const filename = `Kontrollrapport_${customerName}_${dateStr}.xlsx`

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, filename)
}
