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

// Generera statisk karta-URL med OpenStreetMap Static Map API (ingen API-nyckel krävs)
const generateStaticMapUrl = (
  equipment: EquipmentPlacementWithRelations[],
  width: number,
  height: number
): string | null => {
  if (equipment.length === 0) return null

  // Beräkna bounding box för alla koordinater
  const lats = equipment.map((e) => e.latitude)
  const lngs = equipment.map((e) => e.longitude)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  // Beräkna center
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2

  // Beräkna zoom-nivå baserat på bounding box
  const latDiff = maxLat - minLat
  const lngDiff = maxLng - minLng
  const maxDiff = Math.max(latDiff, lngDiff)

  let zoom = 15
  if (maxDiff > 0.5) zoom = 10
  else if (maxDiff > 0.2) zoom = 12
  else if (maxDiff > 0.1) zoom = 13
  else if (maxDiff > 0.05) zoom = 14
  else if (maxDiff > 0.01) zoom = 15
  else zoom = 16

  // Om bara en punkt, zooma in mer
  if (equipment.length === 1) {
    zoom = 16
  }

  // Använd staticmap.openstreetmap.de - gratis, ingen API-nyckel krävs
  // Format: markers=lat,lon,color (t.ex. ol-marker för orange-large)
  // Markörer: Använder numrerade markörer för att matcha listan
  const markers = equipment.map((e, index) => {
    // Skapa markör med nummer (1-baserat index)
    return `${e.latitude},${e.longitude},lightblue${index + 1}`
  }).join('|')

  // staticmap.openstreetmap.de format
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${width}x${height}&markers=${markers}&maptype=mapnik`
}

// Generera Google Maps-länk för en koordinat
const generateGoogleMapsLink = (lat: number, lng: number): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`
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
    // Använd enkel header med BeGone-branding (ingen bild som säger "Saneringsrapport")
    pdf.setFillColor(...beGoneColors.primary)
    pdf.rect(0, 0, pageWidth, 40, 'F')

    pdf.setTextColor(...beGoneColors.white)
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('BeGone Skadedjur & Sanering', pageWidth / 2, 25, { align: 'center' })

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

    // === ÖVERSIKTSKARTA ===
    if (equipment.length > 0) {
      // Kontrollera om det finns plats för kartan på denna sida
      const mapHeight = 80
      if (yPosition + mapHeight + 40 > pageHeight - 40) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      yPosition = drawSectionHeader(pdf, 'ÖVERSIKTSKARTA', margins.left, yPosition, contentWidth, 'primary')
      const mapWidth = Math.round(contentWidth * 2.83) // Konvertera mm till ungefärliga pixlar
      const mapHeightPx = Math.round(mapHeight * 2.83)

      // Rita platshållare för kartan med ljusgrå bakgrund
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, mapHeight, {
        backgroundColor: 'light',
        shadow: false,
        radius: 4
      })

      // Försök ladda statisk karta
      try {
        const mapUrl = generateStaticMapUrl(equipment, mapWidth, mapHeightPx)
        if (mapUrl) {
          const mapImg = new Image()
          mapImg.crossOrigin = 'anonymous'

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Map timeout')), 8000)

            mapImg.onload = () => {
              clearTimeout(timeout)
              try {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                canvas.width = mapImg.width
                canvas.height = mapImg.height
                ctx?.drawImage(mapImg, 0, 0)

                const dataURL = canvas.toDataURL('image/png')
                pdf.addImage(dataURL, 'PNG', margins.left + 2, yPosition + 2, contentWidth - 4, mapHeight - 4)
                resolve()
              } catch (error) {
                reject(error)
              }
            }

            mapImg.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('Map image failed'))
            }

            mapImg.src = mapUrl
          })
        }
      } catch (error) {
        // Om kartan inte kunde laddas, visa meddelande med info om klickbara länkar
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'normal')
        pdf.text(
          'Översiktskartan kunde inte laddas.',
          margins.left + contentWidth / 2,
          yPosition + mapHeight / 2 - 8,
          { align: 'center' }
        )
        pdf.setTextColor(59, 130, 246) // Blå
        pdf.setFont(undefined, 'bold')
        pdf.text(
          'Klicka på GPS-koordinaterna i tabellen nedan för att öppna Google Maps.',
          margins.left + contentWidth / 2,
          yPosition + mapHeight / 2 + 4,
          { align: 'center' }
        )
      }

      // Lägg till legend under kartan
      yPosition += mapHeight + spacing.sm

      // Liten legend med info om klickbara koordinater
      pdf.setFontSize(typography.caption.size)
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.text('Tips: GPS-koordinaterna i tabellen är klickbara och öppnar Google Maps.', margins.left, yPosition + 4)

      yPosition += spacing.lg
    }

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
        // GPS-koordinater som klickbar Google Maps-länk
        const coordText = formatCoordinates(item.latitude, item.longitude)
        const mapsLink = generateGoogleMapsLink(item.latitude, item.longitude)
        pdf.setTextColor(59, 130, 246) // Blå färg för länk
        pdf.textWithLink(coordText, colX, yPosition + 9, { url: mapsLink })
        pdf.setTextColor(...beGoneColors.darkGray) // Återställ färg

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

    // === UTRUSTNINGSDETALJER MED FOTON ===
    const itemsWithPhotos = equipment.filter((e) => e.photo_url)
    if (itemsWithPhotos.length > 0) {
      // Ny sida för bildgalleri
      pdf.addPage()
      yPosition = spacing.xl

      yPosition = drawSectionHeader(pdf, 'UTRUSTNINGSDETALJER', margins.left, yPosition, contentWidth, 'primary')

      // Ladda och rita bilder
      for (const item of itemsWithPhotos) {
        // Kontrollera sidbrytning (varje bild tar ca 80px)
        if (yPosition > pageHeight - 100) {
          pdf.addPage()
          yPosition = spacing.xl
        }

        const cardHeight = 75
        drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, cardHeight, {
          backgroundColor: 'light',
          shadow: false,
          radius: 4
        })

        // Vänster sida - Info
        const infoX = margins.left + spacing.md

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
        pdf.circle(infoX + 4, yPosition + 12, 4, 'F')

        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.subheader.size)
        pdf.setFont(undefined, 'bold')
        pdf.text(getEquipmentTypeLabel(item.equipment_type), infoX + 12, yPosition + 14)

        // Serienummer
        if (item.serial_number) {
          pdf.setTextColor(...beGoneColors.mediumGray)
          pdf.setFontSize(typography.caption.size)
          pdf.setFont(undefined, 'normal')
          pdf.text(`Serienr: ${item.serial_number}`, infoX + 12, yPosition + 22)
        }

        // Status
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'normal')
        pdf.text(`Status: ${getEquipmentStatusLabel(item.status)}`, infoX, yPosition + 35)

        // Datum
        pdf.text(`Placerad: ${formatDate(item.placed_at)}`, infoX, yPosition + 45)

        // Kommentar (om finns, kort version)
        if (item.comment) {
          pdf.setTextColor(...beGoneColors.mediumGray)
          pdf.setFontSize(typography.caption.size)
          pdf.setFont(undefined, 'italic')
          const shortComment = item.comment.length > 60 ? item.comment.substring(0, 57) + '...' : item.comment
          pdf.text(`"${shortComment}"`, infoX, yPosition + 58)
        }

        // Höger sida - Bild
        const imageX = margins.left + contentWidth * 0.60
        const imageWidth = contentWidth * 0.35
        const imageHeight = 60

        try {
          // Försök ladda bilden
          const img = new Image()
          img.crossOrigin = 'anonymous'

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000)

            img.onload = () => {
              clearTimeout(timeout)
              try {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                // Beräkna aspect ratio
                const aspectRatio = img.width / img.height
                let drawWidth = imageWidth
                let drawHeight = imageWidth / aspectRatio

                if (drawHeight > imageHeight) {
                  drawHeight = imageHeight
                  drawWidth = imageHeight * aspectRatio
                }

                canvas.width = img.width
                canvas.height = img.height
                ctx?.drawImage(img, 0, 0)

                const dataURL = canvas.toDataURL('image/jpeg', 0.7)

                // Centrera bilden i det tillgängliga utrymmet
                const centeredX = imageX + (imageWidth - drawWidth) / 2
                const centeredY = yPosition + spacing.sm + (imageHeight - drawHeight) / 2

                // Rita en ljusgrå bakgrund för bilden
                pdf.setFillColor(...beGoneColors.lightGray)
                pdf.roundedRect(imageX - 2, yPosition + spacing.sm - 2, imageWidth + 4, imageHeight + 4, 3, 3, 'F')

                pdf.addImage(dataURL, 'JPEG', centeredX, centeredY, drawWidth, drawHeight)
                resolve()
              } catch (error) {
                reject(error)
              }
            }

            img.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('Image load failed'))
            }

            img.src = item.photo_url!
          })
        } catch (error) {
          // Om bilden inte kunde laddas, rita en placeholder
          pdf.setFillColor(...beGoneColors.lightGray)
          pdf.roundedRect(imageX, yPosition + spacing.sm, imageWidth, imageHeight, 3, 3, 'F')

          pdf.setTextColor(...beGoneColors.mediumGray)
          pdf.setFontSize(typography.caption.size)
          pdf.setFont(undefined, 'italic')
          pdf.text('Bild ej tillgänglig', imageX + imageWidth / 2, yPosition + spacing.sm + imageHeight / 2, { align: 'center' })
        }

        yPosition += cardHeight + spacing.md
      }
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
