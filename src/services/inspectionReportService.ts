// src/services/inspectionReportService.ts
// Generering av kontrollrapporter (PDF via Puppeteer + Excel via xlsx) för kundportalen

import * as XLSX from 'xlsx'
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

export async function generateInspectionExcel(sessionId: string): Promise<void> {
  const data = await getReportData(sessionId)
  if (!data) throw new Error('Kunde inte hämta sessionsdata')

  const { session, outdoorInspections, indoorInspections, summary } = data

  const wb = XLSX.utils.book_new()

  // === FLIK 1: Sammanfattning ===
  const summaryData = [
    ['KONTROLLRAPPORT'],
    [],
    ['Utförare', 'BeGone Skadedjur & Sanering AB'],
    ['Org.nr', '559378-9208'],
    ['Telefon', '010 280 44 10'],
    ['Email', 'info@begone.se'],
    ['Adress', 'Bläcksvampsvägen 17, 141 60 Huddinge'],
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
    ['Kontrolldatum', formatDate(session.completed_at || session.created_at)],
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
  const sessionDate = session.completed_at || session.created_at
  const dateStr = sessionDate ? new Date(sessionDate).toISOString().slice(0, 10) : 'okänt-datum'
  const filename = `Kontrollrapport_${customerName}_${dateStr}.xlsx`

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, filename)
}
