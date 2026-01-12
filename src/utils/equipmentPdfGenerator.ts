// src/utils/equipmentPdfGenerator.ts - PDF-generator för utrustningsrapporter
import { jsPDF } from 'jspdf'
import {
  EquipmentPlacementWithRelations,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel
} from '../types/database'

interface EquipmentPdfOptions {
  customerName: string
  equipment: EquipmentPlacementWithRelations[]
}

// BeGone Professional Color Palette (samma som pdfReportGenerator)
const beGoneColors = {
  primary: [10, 19, 40] as [number, number, number],
  accent: [32, 197, 143] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightestGray: [248, 250, 252] as [number, number, number],
  lightGray: [241, 245, 249] as [number, number, number],
  mediumGray: [148, 163, 184] as [number, number, number],
  darkGray: [51, 65, 85] as [number, number, number],
  charcoal: [30, 41, 59] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],
  success: [34, 197, 94] as [number, number, number]
}

// Professional spacing system
const spacing = {
  xs: 3,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  section: 28
}

// Typography system
const typography = {
  title: { size: 20, weight: 'bold' as const },
  sectionHeader: { size: 14, weight: 'bold' as const },
  subheader: { size: 12, weight: 'bold' as const },
  body: { size: 10, weight: 'normal' as const },
  caption: { size: 9, weight: 'normal' as const },
  label: { size: 8, weight: 'bold' as const },
  tableHeader: { size: 9, weight: 'bold' as const },
  tableCell: { size: 8, weight: 'normal' as const }
}

// Hjälpfunktion för att formatera datum
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Formatera koordinater
const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

// Professional card system
const drawProfessionalCard = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    radius?: number
    shadow?: boolean
    borderWeight?: number
    backgroundColor?: 'light' | 'white'
  } = {}
) => {
  const { radius = 6, shadow = true, borderWeight = 0.8, backgroundColor = 'white' } = options

  if (shadow) {
    pdf.setFillColor(0, 0, 0)
    pdf.roundedRect(x + 1.5, y + 1.5, width, height, radius, radius, 'F')
  }

  const bgColor = backgroundColor === 'white' ? beGoneColors.white : beGoneColors.lightestGray
  pdf.setFillColor(...bgColor)
  pdf.roundedRect(x, y, width, height, radius, radius, 'F')

  pdf.setDrawColor(...beGoneColors.border)
  pdf.setLineWidth(borderWeight)
  pdf.roundedRect(x, y, width, height, radius, radius, 'S')
}

// Section header
const drawSectionHeader = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  style: 'primary' | 'accent' = 'primary'
) => {
  const headerHeight = 20

  if (style === 'accent') {
    pdf.setFillColor(...beGoneColors.accent)
  } else {
    pdf.setFillColor(...beGoneColors.charcoal)
  }
  pdf.roundedRect(x, y, width, headerHeight, 4, 4, 'F')
  pdf.setTextColor(...beGoneColors.white)

  pdf.setFontSize(typography.sectionHeader.size)
  pdf.setFont(undefined, typography.sectionHeader.weight)
  pdf.text(text, x + width / 2, y + headerHeight / 2 + 2, { align: 'center' })

  return y + headerHeight + spacing.sm
}

// Generera statistik-ruta för en utrustningstyp
const drawStatBox = (
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  count: number,
  color: string
) => {
  // Rita bakgrund
  drawProfessionalCard(pdf, x, y, width, height, {
    backgroundColor: 'light',
    shadow: false,
    radius: 4
  })

  // Rita färgad cirkel
  const circleRadius = 8
  const circleX = x + width / 2
  const circleY = y + 15

  // Konvertera hex-färg till RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [107, 114, 128]
  }

  const rgb = hexToRgb(color)
  pdf.setFillColor(...rgb)
  pdf.circle(circleX, circleY, circleRadius, 'F')

  // Antal i cirkeln
  pdf.setTextColor(...beGoneColors.white)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text(count.toString(), circleX, circleY + 3, { align: 'center' })

  // Label under cirkeln
  pdf.setTextColor(...beGoneColors.darkGray)
  pdf.setFontSize(typography.caption.size)
  pdf.setFont(undefined, 'normal')

  // Dela upp label på flera rader om det behövs
  const maxWidth = width - 6
  const lines = pdf.splitTextToSize(label, maxWidth)
  pdf.text(lines, circleX, y + 32, { align: 'center' })
}

export const generateEquipmentPdf = async (options: EquipmentPdfOptions): Promise<void> => {
  const { customerName, equipment } = options

  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    const margins = { left: spacing.lg, right: spacing.lg, top: spacing.xl, bottom: spacing.xl }
    const contentWidth = pageWidth - (margins.left + margins.right)
    let yPosition = 50

    // === HEADER ===
    let headerSuccessful = false

    try {
      const logoPath = '/images/begone-header.png'
      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.width = img.width
            canvas.height = img.height
            ctx?.drawImage(img, 0, 0)

            const dataURL = canvas.toDataURL('image/png')
            const headerImageHeight = 40

            pdf.addImage(dataURL, 'PNG', 0, 0, pageWidth, headerImageHeight)
            headerSuccessful = true
            resolve(true)
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => reject(new Error('Header image failed'))
        img.src = logoPath
      })
    } catch (error) {
      console.warn('Header image failed, using minimal background')
      headerSuccessful = false
    }

    if (!headerSuccessful) {
      pdf.setFillColor(...beGoneColors.primary)
      pdf.rect(0, 0, pageWidth, 40, 'F')

      pdf.setTextColor(...beGoneColors.white)
      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.text('BeGone Skadedjur & Sanering', pageWidth / 2, 25, { align: 'center' })
    }

    // === RAPPORT METADATA ===
    yPosition += spacing.sm

    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.caption.size)
    pdf.setFont(undefined, 'normal')

    const reportDate = new Date().toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    pdf.text(`Rapport genererad: ${reportDate}`, pageWidth / 2, yPosition, { align: 'center' })

    yPosition += spacing.lg

    // === RAPPORTTITEL ===
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.title.size)
    pdf.setFont(undefined, 'bold')
    pdf.text('UTRUSTNINGSPLACERING', pageWidth / 2, yPosition, { align: 'center' })

    yPosition += spacing.sm

    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.subheader.size)
    pdf.setFont(undefined, 'normal')
    pdf.text(customerName, pageWidth / 2, yPosition, { align: 'center' })

    yPosition += spacing.section

    // === SAMMANFATTNING ===
    yPosition = drawSectionHeader(pdf, 'SAMMANFATTNING', margins.left, yPosition, contentWidth, 'accent')

    // Beräkna statistik
    const stats = {
      total: equipment.length,
      byType: {
        mechanical_trap: equipment.filter((e) => e.equipment_type === 'mechanical_trap').length,
        concrete_station: equipment.filter((e) => e.equipment_type === 'concrete_station').length,
        bait_station: equipment.filter((e) => e.equipment_type === 'bait_station').length
      },
      byStatus: {
        active: equipment.filter((e) => e.status === 'active').length,
        removed: equipment.filter((e) => e.status === 'removed').length,
        missing: equipment.filter((e) => e.status === 'missing').length
      }
    }

    // Rita statistik-rutor
    const statBoxWidth = (contentWidth - spacing.md * 3) / 4
    const statBoxHeight = 50

    drawStatBox(
      pdf,
      margins.left,
      yPosition,
      statBoxWidth,
      statBoxHeight,
      EQUIPMENT_TYPE_CONFIG.mechanical_trap.labelPlural,
      stats.byType.mechanical_trap,
      EQUIPMENT_TYPE_CONFIG.mechanical_trap.color
    )

    drawStatBox(
      pdf,
      margins.left + statBoxWidth + spacing.md,
      yPosition,
      statBoxWidth,
      statBoxHeight,
      EQUIPMENT_TYPE_CONFIG.concrete_station.labelPlural,
      stats.byType.concrete_station,
      EQUIPMENT_TYPE_CONFIG.concrete_station.color
    )

    drawStatBox(
      pdf,
      margins.left + (statBoxWidth + spacing.md) * 2,
      yPosition,
      statBoxWidth,
      statBoxHeight,
      EQUIPMENT_TYPE_CONFIG.bait_station.labelPlural,
      stats.byType.bait_station,
      EQUIPMENT_TYPE_CONFIG.bait_station.color
    )

    drawStatBox(
      pdf,
      margins.left + (statBoxWidth + spacing.md) * 3,
      yPosition,
      statBoxWidth,
      statBoxHeight,
      'Aktiva',
      stats.byStatus.active,
      '#22c55e'
    )

    yPosition += statBoxHeight + spacing.section

    // === UTRUSTNINGSLISTA ===
    yPosition = drawSectionHeader(pdf, 'UTRUSTNINGSLISTA', margins.left, yPosition, contentWidth, 'primary')

    if (equipment.length === 0) {
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, 40, {
        backgroundColor: 'light',
        shadow: false
      })

      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'italic')
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.text('Ingen utrustning registrerad för denna kund.', margins.left + spacing.md, yPosition + spacing.lg)

      yPosition += 40 + spacing.md
    } else {
      // Tabellhuvud
      const colWidths = {
        type: 40,
        serial: 35,
        coordinates: 50,
        status: 25,
        date: 25
      }

      const tableHeaderHeight = 18
      const tableRowHeight = 14

      // Rita tabellhuvud
      pdf.setFillColor(...beGoneColors.charcoal)
      pdf.rect(margins.left, yPosition, contentWidth, tableHeaderHeight, 'F')

      pdf.setTextColor(...beGoneColors.white)
      pdf.setFontSize(typography.tableHeader.size)
      pdf.setFont(undefined, 'bold')

      let colX = margins.left + spacing.xs
      pdf.text('Typ', colX, yPosition + 12)
      colX += colWidths.type
      pdf.text('Serienr', colX, yPosition + 12)
      colX += colWidths.serial
      pdf.text('GPS-koordinater', colX, yPosition + 12)
      colX += colWidths.coordinates
      pdf.text('Status', colX, yPosition + 12)
      colX += colWidths.status
      pdf.text('Placerad', colX, yPosition + 12)

      yPosition += tableHeaderHeight

      // Rita tabellrader
      equipment.forEach((item, index) => {
        // Kontrollera sidbrytning
        if (yPosition + tableRowHeight > pageHeight - 40) {
          pdf.addPage()
          yPosition = spacing.xl

          // Rita tabellhuvud igen på ny sida
          pdf.setFillColor(...beGoneColors.charcoal)
          pdf.rect(margins.left, yPosition, contentWidth, tableHeaderHeight, 'F')

          pdf.setTextColor(...beGoneColors.white)
          pdf.setFontSize(typography.tableHeader.size)
          pdf.setFont(undefined, 'bold')

          let newColX = margins.left + spacing.xs
          pdf.text('Typ', newColX, yPosition + 12)
          newColX += colWidths.type
          pdf.text('Serienr', newColX, yPosition + 12)
          newColX += colWidths.serial
          pdf.text('GPS-koordinater', newColX, yPosition + 12)
          newColX += colWidths.coordinates
          pdf.text('Status', newColX, yPosition + 12)
          newColX += colWidths.status
          pdf.text('Placerad', newColX, yPosition + 12)

          yPosition += tableHeaderHeight
        }

        // Alternerande radfärg
        if (index % 2 === 0) {
          pdf.setFillColor(...beGoneColors.lightestGray)
          pdf.rect(margins.left, yPosition, contentWidth, tableRowHeight, 'F')
        }

        // Rita rad
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.tableCell.size)
        pdf.setFont(undefined, 'normal')

        colX = margins.left + spacing.xs

        // Typ med färgad prick
        const typeConfig = EQUIPMENT_TYPE_CONFIG[item.equipment_type]
        const hexToRgb = (hex: string): [number, number, number] => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result
            ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
            : [107, 114, 128]
        }
        const typeRgb = hexToRgb(typeConfig.color)
        pdf.setFillColor(...typeRgb)
        pdf.circle(colX + 3, yPosition + 7, 2.5, 'F')
        pdf.text(getEquipmentTypeLabel(item.equipment_type), colX + 8, yPosition + 9)

        colX += colWidths.type
        pdf.text(item.serial_number || '-', colX, yPosition + 9)

        colX += colWidths.serial
        pdf.text(formatCoordinates(item.latitude, item.longitude), colX, yPosition + 9)

        colX += colWidths.coordinates
        pdf.text(getEquipmentStatusLabel(item.status), colX, yPosition + 9)

        colX += colWidths.status
        pdf.text(formatDate(item.placed_at), colX, yPosition + 9)

        // Tabellkant
        pdf.setDrawColor(...beGoneColors.divider)
        pdf.setLineWidth(0.3)
        pdf.line(margins.left, yPosition + tableRowHeight, margins.left + contentWidth, yPosition + tableRowHeight)

        yPosition += tableRowHeight
      })

      yPosition += spacing.md
    }

    // === DETALJERAD LISTA MED KOMMENTARER ===
    const itemsWithComments = equipment.filter((e) => e.comment)
    if (itemsWithComments.length > 0) {
      // Kontrollera sidbrytning
      if (yPosition > pageHeight - 80) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      yPosition = drawSectionHeader(pdf, 'KOMMENTARER', margins.left, yPosition, contentWidth, 'accent')

      itemsWithComments.forEach((item) => {
        // Kontrollera sidbrytning
        if (yPosition > pageHeight - 50) {
          pdf.addPage()
          yPosition = spacing.xl
        }

        const commentCardHeight = 35
        drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, commentCardHeight, {
          backgroundColor: 'light',
          shadow: false,
          radius: 4
        })

        // Utrustningsinfo
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'bold')
        pdf.text(
          `${getEquipmentTypeLabel(item.equipment_type)}${item.serial_number ? ` (${item.serial_number})` : ''}`,
          margins.left + spacing.sm,
          yPosition + spacing.md
        )

        // GPS-länk
        pdf.setTextColor(...beGoneColors.mediumGray)
        pdf.setFontSize(typography.caption.size)
        pdf.setFont(undefined, 'normal')
        pdf.text(
          `GPS: ${formatCoordinates(item.latitude, item.longitude)}`,
          margins.left + contentWidth - spacing.sm,
          yPosition + spacing.md,
          { align: 'right' }
        )

        // Kommentar
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'italic')
        const commentLines = pdf.splitTextToSize(`"${item.comment}"`, contentWidth - spacing.lg)
        pdf.text(commentLines.slice(0, 2), margins.left + spacing.sm, yPosition + spacing.xl)

        yPosition += commentCardHeight + spacing.sm
      })
    }

    // === FOOTER PÅ ALLA SIDOR ===
    const pageCount = pdf.internal.getNumberOfPages()
    const currentDate = new Date().toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)

      // Footer separator
      pdf.setDrawColor(...beGoneColors.divider)
      pdf.setLineWidth(0.8)
      pdf.line(margins.left, pageHeight - 28, pageWidth - margins.right, pageHeight - 28)

      // Footer content
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.caption.size)
      pdf.setFont(undefined, 'normal')

      // Vänster sida
      pdf.text('BeGone Skadedjur & Sanering AB', margins.left, pageHeight - 18)
      pdf.text('Org.nr: 559378-9208', margins.left, pageHeight - 12)

      // Mitten
      const centerX = pageWidth / 2
      pdf.text('010 280 44 10', centerX, pageHeight - 18, { align: 'center' })
      pdf.text('info@begone.se', centerX, pageHeight - 12, { align: 'center' })

      // Höger sida
      pdf.text(`Genererad: ${currentDate}`, pageWidth - margins.right, pageHeight - 18, { align: 'right' })
      pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - margins.right, pageHeight - 12, { align: 'right' })
    }

    // === SPARA PDF ===
    const cleanCustomerName = customerName
      .replace(/[^\w\s-åäöÅÄÖ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 25)

    const fileDate = new Date().toISOString().split('T')[0]
    const fileName = `Utrustningsplacering_${cleanCustomerName}_${fileDate}.pdf`
    pdf.save(fileName)
  } catch (error) {
    console.error('Error generating equipment PDF:', error)
    throw new Error('Kunde inte generera utrustnings-PDF')
  }
}
