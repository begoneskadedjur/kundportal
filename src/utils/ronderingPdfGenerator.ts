// src/utils/ronderingPdfGenerator.ts
// PDF-periodrapport för Rondering Trafikkontoret — klient-side med jsPDF

import { jsPDF } from 'jspdf'
import { ANNOTATION_CATEGORIES, RonderingAnnotationCategory } from '../services/ronderingService'

// BeGone färgpalett (RGB)
const C = {
  primary:   [10,  19,  40]  as [number,number,number],
  accent:    [32, 197, 143]  as [number,number,number],
  white:     [255,255,255]   as [number,number,number],
  lightGray: [241,245,249]   as [number,number,number],
  medGray:   [148,163,184]   as [number,number,number],
  darkGray:  [51, 65,  85]   as [number,number,number],
  charcoal:  [30, 41,  59]   as [number,number,number],
  border:    [203,213,225]   as [number,number,number],
  success:   [34, 197,  94]  as [number,number,number],
  warning:   [245,158, 11]   as [number,number,number],
  error:     [239, 68, 68]   as [number,number,number],
  orange:    [249,115, 22]   as [number,number,number],
  amber:     [245,158, 11]   as [number,number,number],
  slate:     [100,116,139]   as [number,number,number],
}

export interface RonderingPdfCase {
  case_number: string | null
  title: string
  customer_name: string | null
  scheduled_start: string | null
  status: string
  primary_technician_name: string | null
  inspected: number
  total: number
  actionRequired: number
  missing: number
  baitSummary: { all: number; partial: number; none: number }
  annotations: { category: string; note: string | null; technician_name: string | null; created_at: string; latitude?: number | null; longitude?: number | null; address?: string | null; source?: string }[]
}

export interface RonderingPdfEkVisit {
  regionName: string
  scheduledStart: string | null
  technicianName: string | null
  totalStations: number
  checkedCount: number
  maxCount: number
  stationResults: Array<{
    serialNumber: string | null
    checkedItems: number
    note: string | null
    imageCount: number
  }>
}

export interface RonderingPdfHighRisk {
  serial_number: string | null
  station_id: string
  allCount: number
  lastInspected: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
  } catch { return iso }
}

export function generateRonderingPdf(
  organizationName: string,
  cases: RonderingPdfCase[],
  highRiskStations: RonderingPdfHighRisk[],
  statusFilterLabel: string,
  ekVisits: RonderingPdfEkVisit[] = []
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const margin = 16
  const contentW = W - margin * 2

  let y = 0

  // ── Hjälpfunktioner ──────────────────────────────────────────────────────────

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number,number,number] = C.darkGray) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
    doc.setTextColor(...color)
  }

  const fillRect = (x: number, y: number, w: number, h: number, color: [number,number,number]) => {
    doc.setFillColor(...color)
    doc.rect(x, y, w, h, 'F')
  }

  const drawRect = (x: number, y: number, w: number, h: number, color: [number,number,number], lw = 0.3) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(lw)
    doc.rect(x, y, w, h, 'S')
  }

  const checkPageBreak = (needed: number) => {
    if (y + needed > H - 20) {
      doc.addPage()
      y = margin
    }
  }

  // ── FÖRSÄTTSBLAD ─────────────────────────────────────────────────────────────

  // Bakgrund
  fillRect(0, 0, W, H, C.primary)

  // Accentstreck
  fillRect(0, 0, 4, H, C.accent)

  // Titel
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('EGENKONTROLL', margin + 8, 60)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.accent)
  doc.text('Rondering Trafikkontoret', margin + 8, 72)

  // Organisationsnamn
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text(organizationName, margin + 8, 95)

  // Metadata-box
  fillRect(margin + 8, 110, contentW - 8, 40, [20, 30, 55])
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.medGray)
  doc.text('Rapport genererad', margin + 14, 122)
  doc.text('Filter', margin + 70, 122)
  doc.text('Antal rondering-tillfällen', margin + 120, 122)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text(fmtDate(new Date().toISOString()), margin + 14, 131)
  doc.text(statusFilterLabel, margin + 70, 131)
  doc.text(String(cases.length), margin + 120, 131)

  // Summering
  const totalInspected = cases.reduce((s, c) => s + c.inspected, 0)
  const totalStations = cases.reduce((s, c) => s + c.total, 0)
  const totalAnnotations = cases.reduce((s, c) => s + c.annotations.length, 0)
  const totalBaitAll = cases.reduce((s, c) => s + c.baitSummary.all, 0)

  const summaryY = 165
  const col = (contentW - 8) / 4
  const statItems = [
    { label: 'Stationer kontrollerade', value: `${totalInspected}/${totalStations}` },
    { label: 'Avvikelser totalt', value: String(totalAnnotations) },
    { label: 'Allt bete förbrukat', value: String(totalBaitAll) },
    { label: 'Högriskstationer', value: String(highRiskStations.length) },
  ]
  statItems.forEach((item, i) => {
    const x = margin + 8 + i * col
    fillRect(x, summaryY, col - 2, 28, [20, 30, 55])
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.white)
    doc.text(item.value, x + (col - 2) / 2, summaryY + 14, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medGray)
    doc.text(item.label, x + (col - 2) / 2, summaryY + 22, { align: 'center' })
  })

  // BeGone-footer
  doc.setFontSize(8)
  doc.setTextColor(...C.slate)
  doc.text('Begone Skadedjur', margin + 8, H - 15)
  doc.text('Konfidentiellt dokument', W - margin - 8, H - 15, { align: 'right' })

  // ── SIDA 2+: INNEHÅLL ─────────────────────────────────────────────────────

  doc.addPage()
  y = margin

  // Funktion för sidheader
  const drawPageHeader = () => {
    fillRect(0, 0, W, 12, C.primary)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.medGray)
    doc.text('EGENKONTROLL — ' + organizationName.toUpperCase(), margin, 8)
    doc.text(`Sida ${doc.getNumberOfPages()}`, W - margin, 8, { align: 'right' })
    y = 18
  }

  drawPageHeader()

  // ── Egenkontroll (FÖRE rondering) ────────────────────────────────────────────
  if (ekVisits.length > 0) {
    checkPageBreak(14)
    setFont(11, 'bold', C.primary)
    doc.text('Egenkontroll', margin, y); y += 4
    setFont(8, 'normal', C.medGray)
    doc.text(`${ekVisits.length} besök`, margin, y); y += 7

    ekVisits.forEach(visit => {
      checkPageBreak(14 + visit.stationResults.length * 7)
      fillRect(margin, y, contentW, 8, C.charcoal)
      setFont(8, 'bold', C.white)
      doc.text(visit.regionName, margin + 3, y + 5)
      if (visit.scheduledStart) {
        setFont(7, 'normal', C.medGray)
        doc.text(fmtDate(visit.scheduledStart), margin + 100, y + 5)
      }
      if (visit.technicianName) {
        setFont(7, 'normal', C.medGray)
        doc.text(visit.technicianName, W - margin - 3, y + 5, { align: 'right' })
      }
      y += 8
      const pct = visit.maxCount > 0 ? Math.round(visit.checkedCount / visit.maxCount * 100) : 0
      fillRect(margin, y, contentW, 6, C.lightGray)
      setFont(7, 'normal', C.medGray)
      doc.text(`${visit.totalStations} stationer kontrollerade`, margin + 3, y + 4)
      setFont(7, 'bold', C.darkGray)
      doc.text(`${pct}% godkänt`, W - margin - 3, y + 4, { align: 'right' })
      y += 6
      visit.stationResults.forEach((st, si) => {
        checkPageBreak(7)
        const rowBg: [number,number,number] = si % 2 === 0 ? C.lightGray : C.white
        fillRect(margin, y, contentW, 7, rowBg)
        setFont(7, 'normal', C.darkGray)
        doc.text(st.serialNumber ? `#${st.serialNumber}` : '—', margin + 3, y + 4.5)
        setFont(7, 'normal', C.medGray)
        doc.text(`${st.checkedItems}/9 godkända`, margin + 30, y + 4.5)
        if (st.note) {
          setFont(6.5, 'normal', C.slate)
          const note = st.note.length > 55 ? st.note.slice(0, 55) + '…' : st.note
          doc.text(note, margin + 75, y + 4.5)
        }
        if (st.imageCount > 0) {
          setFont(6, 'normal', C.accent)
          doc.text(`${st.imageCount} bild${st.imageCount !== 1 ? 'er' : ''}`, W - margin - 3, y + 4.5, { align: 'right' })
        }
        y += 7
      })
      y += 5
    })
    y += 3
  }

  // ── Ärenderapport ─────────────────────────────────────────────────────────────
  checkPageBreak(14)
  setFont(11, 'bold', C.primary)
  doc.text('Rondering-tillfällen', margin, y)
  y += 4
  setFont(8, 'normal', C.medGray)
  doc.text(`${cases.length} ärenden · Filter: ${statusFilterLabel}`, margin, y)
  y += 7

  cases.forEach((c) => {
    const pct = c.total > 0 ? Math.round((c.inspected / c.total) * 100) : 0
    const caseH = 10
    checkPageBreak(caseH + 4)

    if (y > 18 && y < margin + 1) drawPageHeader()

    // Ärende-header
    fillRect(margin, y, contentW, 9, C.charcoal)
    setFont(8, 'bold', C.white)
    doc.text(`${c.title}${c.case_number ? ' · ' + c.case_number : ''}`, margin + 3, y + 5.5)

    // Status-badge
    const isClosed = c.status.toLowerCase().includes('avslutat')
    const badgeColor = isClosed ? C.slate : C.slate
    fillRect(W - margin - 30, y + 1.5, 28, 6, badgeColor)
    setFont(6, 'bold', C.white)
    doc.text(c.status, W - margin - 16, y + 5.5, { align: 'center' })
    y += 9

    // Info-rad
    fillRect(margin, y, contentW, 7, C.lightGray)
    setFont(7, 'normal', C.medGray)
    doc.text(fmtDate(c.scheduled_start), margin + 3, y + 4.5)
    if (c.primary_technician_name) doc.text(c.primary_technician_name, margin + 45, y + 4.5)

    // Progress-text
    const progressColor = c.actionRequired > 0 ? C.warning : C.medGray
    doc.setTextColor(...progressColor)
    doc.setFont('helvetica', 'bold')
    doc.text(`${c.inspected}/${c.total} stationer (${pct}%)`, W - margin - 3, y + 4.5, { align: 'right' })
    y += 7

    // Beteåtgång-rad
    const bait = c.baitSummary
    const baitTotal = bait.all + bait.partial + bait.none
    if (baitTotal > 0) {
      fillRect(margin, y, contentW, 6, C.white)
      setFont(6.5, 'normal', C.medGray)
      doc.text('Bete:', margin + 3, y + 4)
      let bx = margin + 16
      if (bait.all > 0) {
        doc.setTextColor(...C.error)
        doc.setFont('helvetica', 'bold')
        doc.text(`Allt: ${bait.all}`, bx, y + 4)
        bx += 22
      }
      if (bait.partial > 0) {
        doc.setTextColor(...C.warning)
        doc.setFont('helvetica', 'bold')
        doc.text(`Delvis: ${bait.partial}`, bx, y + 4)
        bx += 26
      }
      if (bait.none > 0) {
        doc.setTextColor(...C.success)
        doc.setFont('helvetica', 'bold')
        doc.text(`Inget: ${bait.none}`, bx, y + 4)
      }

      // Minibeteåtgång-stapel
      const barX = W - margin - 52
      const barW = 50
      fillRect(barX, y + 1.5, barW, 3, C.border)
      let bxBar = barX
      if (baitTotal > 0) {
        if (bait.all > 0) { fillRect(bxBar, y + 1.5, (bait.all / baitTotal) * barW, 3, C.error); bxBar += (bait.all / baitTotal) * barW }
        if (bait.partial > 0) { fillRect(bxBar, y + 1.5, (bait.partial / baitTotal) * barW, 3, C.amber); bxBar += (bait.partial / baitTotal) * barW }
        if (bait.none > 0) { fillRect(bxBar, y + 1.5, (bait.none / baitTotal) * barW, 3, C.success) }
      }
      y += 6
    }

    y += 4
  })

  // ── Avvikelser ────────────────────────────────────────────────────────────────
  const allAnnotationsForPdf = cases.flatMap(c =>
    c.annotations.map(a => ({ ...a, regionName: c.title }))
  )
  if (allAnnotationsForPdf.length > 0) {
    checkPageBreak(14)
    setFont(11, 'bold', C.primary)
    doc.text('Avvikelser', margin, y); y += 4
    setFont(8, 'normal', C.medGray)
    doc.text(`${allAnnotationsForPdf.length} avvikelse${allAnnotationsForPdf.length !== 1 ? 'r' : ''} registrerade`, margin, y); y += 7

    const catKeys = [...new Set(allAnnotationsForPdf.map(a => a.category))]
    catKeys.forEach(catKey => {
      const catAnns = allAnnotationsForPdf.filter(a => a.category === catKey)
      const cat = ANNOTATION_CATEGORIES[catKey as RonderingAnnotationCategory] ?? ANNOTATION_CATEGORIES['trash_bins']
      checkPageBreak(6 + catAnns.length * 13)
      // Kategori-header
      fillRect(margin, y, contentW, 6, C.charcoal)
      setFont(7, 'bold', C.white)
      doc.text(cat.label, margin + 3, y + 4)
      setFont(6, 'normal', C.medGray)
      doc.text(`${catAnns.length} st`, W - margin - 3, y + 4, { align: 'right' })
      y += 6
      // Rader
      catAnns.forEach((ann, ai) => {
        checkPageBreak(13)
        const rowBg: [number,number,number] = ai % 2 === 0 ? [255,247,237] : [255,251,245]
        fillRect(margin, y, contentW, 13, rowBg)
        // Rad 1: regionnamn + notering + EK-label + datum
        setFont(6.5, 'bold', C.darkGray)
        doc.text(ann.regionName, margin + 3, y + 4.5)
        if (ann.note) {
          setFont(7, 'normal', C.darkGray)
          const note = ann.note.length > 45 ? ann.note.slice(0, 45) + '…' : ann.note
          doc.text(note, margin + 55, y + 4.5)
        }
        if (ann.source === 'egenkontroll') {
          setFont(6, 'normal', C.slate)
          doc.text('(Egenkontroll)', W - margin - 30, y + 4.5)
        }
        setFont(6, 'normal', C.medGray)
        doc.text(fmtDateShort(ann.created_at), W - margin - 3, y + 4.5, { align: 'right' })
        // Rad 2: adress + koordinater
        if (ann.address) {
          setFont(6.5, 'normal', C.darkGray)
          doc.text(ann.address.length > 65 ? ann.address.slice(0, 65) + '…' : ann.address, margin + 3, y + 9.5)
        }
        if (ann.latitude && ann.longitude) {
          setFont(6, 'normal', C.medGray)
          doc.text(`${ann.latitude.toFixed(5)}, ${ann.longitude.toFixed(5)}`, W - margin - 3, y + 9.5, { align: 'right' })
        }
        y += 13
      })
      y += 3
    })
    y += 5
  }

  // ── Högriskstationer ─────────────────────────────────────────────────────────
  if (highRiskStations.length > 0) {
    checkPageBreak(20 + highRiskStations.length * 8 + 10)

    setFont(11, 'bold', C.primary)
    doc.text('Högriskstationer', margin, y)
    y += 4

    setFont(8, 'normal', C.medGray)
    doc.text('Stationer med "Allt" beteåtgång vid 2 eller fler inspektionstillfällen', margin, y)
    y += 5

    fillRect(margin, y, contentW, 7, C.charcoal)
    setFont(7, 'bold', C.white)
    doc.text('Station', margin + 3, y + 4.5)
    doc.text('Antal ggr Allt', margin + 50, y + 4.5)
    doc.text('Senast inspekterad', margin + 100, y + 4.5)
    y += 7

    highRiskStations.forEach((s, i) => {
      const rowColor = i % 2 === 0 ? C.lightGray : C.white
      fillRect(margin, y, contentW, 7, rowColor)
      setFont(7, 'normal', C.darkGray)
      doc.text(s.serial_number || s.station_id.slice(0, 8), margin + 3, y + 4.5)
      setFont(7, 'bold', C.error)
      doc.text(`${s.allCount}×`, margin + 50, y + 4.5)
      setFont(7, 'normal', C.darkGray)
      doc.text(fmtDate(s.lastInspected), margin + 100, y + 4.5)
      y += 7
    })
    y += 8
  }

  // ── Sidfot sista sida ────────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setTextColor(...C.medGray)
  doc.text(
    `Rapport genererad ${fmtDate(new Date().toISOString())} av Begone Skadedjur`,
    W / 2, H - 8, { align: 'center' }
  )

  doc.save(`Egenkontroll_${organizationName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
