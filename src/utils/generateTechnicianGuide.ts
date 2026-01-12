// src/utils/generateTechnicianGuide.ts - Genererar PDF-guide för tekniker
import { jsPDF } from 'jspdf'

// BeGone Professional Color Palette
const colors = {
  primary: [10, 19, 40] as [number, number, number],
  accent: [32, 197, 143] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  mediumGray: [148, 163, 184] as [number, number, number],
  darkGray: [51, 65, 85] as [number, number, number],
  charcoal: [30, 41, 59] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  yellow: [234, 179, 8] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number]
}

// Spacing
const spacing = {
  xs: 3,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24
}

// Hjälpfunktion för att rita en rubrik
const drawSectionTitle = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  style: 'h1' | 'h2' | 'h3' = 'h2'
): number => {
  if (style === 'h1') {
    // Stor rubrik med accent-bakgrund
    pdf.setFillColor(...colors.accent)
    pdf.roundedRect(x, y, width, 28, 4, 4, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x + width / 2, y + 18, { align: 'center' })
    return y + 28 + spacing.md
  } else if (style === 'h2') {
    // Mellanrubrik med mörk bakgrund
    pdf.setFillColor(...colors.charcoal)
    pdf.roundedRect(x, y, width, 22, 3, 3, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x + spacing.md, y + 15)
    return y + 22 + spacing.sm
  } else {
    // Liten rubrik
    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(11)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x, y + 4)
    return y + spacing.md
  }
}

// Hjälpfunktion för brödtext
const drawParagraph = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: { indent?: boolean; bullet?: boolean } = {}
): number => {
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')

  const effectiveX = options.indent || options.bullet ? x + 8 : x
  const effectiveWidth = options.indent || options.bullet ? maxWidth - 8 : maxWidth

  if (options.bullet) {
    pdf.setFillColor(...colors.accent)
    pdf.circle(x + 3, y + 3, 1.5, 'F')
  }

  const lines = pdf.splitTextToSize(text, effectiveWidth)
  pdf.text(lines, effectiveX, y + 4)

  return y + lines.length * 5 + spacing.xs
}

// Hjälpfunktion för numrerad lista
const drawNumberedList = (
  pdf: jsPDF,
  items: string[],
  x: number,
  y: number,
  maxWidth: number
): number => {
  let currentY = y

  items.forEach((item, index) => {
    pdf.setTextColor(...colors.accent)
    pdf.setFontSize(10)
    pdf.setFont(undefined, 'bold')
    pdf.text(`${index + 1}.`, x, currentY + 4)

    pdf.setTextColor(...colors.darkGray)
    pdf.setFont(undefined, 'normal')
    const lines = pdf.splitTextToSize(item, maxWidth - 12)
    pdf.text(lines, x + 10, currentY + 4)

    currentY += lines.length * 5 + spacing.xs
  })

  return currentY + spacing.xs
}

// Hjälpfunktion för punktlista
const drawBulletList = (
  pdf: jsPDF,
  items: string[],
  x: number,
  y: number,
  maxWidth: number
): number => {
  let currentY = y

  items.forEach((item) => {
    pdf.setFillColor(...colors.accent)
    pdf.circle(x + 3, currentY + 3, 1.5, 'F')

    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    const lines = pdf.splitTextToSize(item, maxWidth - 12)
    pdf.text(lines, x + 10, currentY + 4)

    currentY += lines.length * 5 + spacing.xs
  })

  return currentY + spacing.xs
}

// Hjälpfunktion för tabell
const drawTable = (
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  colWidths: number[]
): number => {
  const rowHeight = 14
  const headerHeight = 16
  const totalWidth = colWidths.reduce((a, b) => a + b, 0)

  // Header
  pdf.setFillColor(...colors.charcoal)
  pdf.rect(x, y, totalWidth, headerHeight, 'F')

  pdf.setTextColor(...colors.white)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'bold')

  let colX = x
  headers.forEach((header, i) => {
    pdf.text(header, colX + 4, y + 11)
    colX += colWidths[i]
  })

  let currentY = y + headerHeight

  // Rows
  rows.forEach((row, rowIndex) => {
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(...colors.lightGray)
      pdf.rect(x, currentY, totalWidth, rowHeight, 'F')
    }

    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')

    colX = x
    row.forEach((cell, i) => {
      const lines = pdf.splitTextToSize(cell, colWidths[i] - 8)
      pdf.text(lines[0] || '', colX + 4, currentY + 10)
      colX += colWidths[i]
    })

    // Border
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.3)
    pdf.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight)

    currentY += rowHeight
  })

  return currentY + spacing.md
}

// Hjälpfunktion för tips-ruta
const drawTipBox = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  type: 'tip' | 'warning' | 'info' = 'tip'
): number => {
  const boxHeight = 28
  const bgColor = type === 'warning' ? [254, 243, 199] : type === 'info' ? [219, 234, 254] : [220, 252, 231]
  const borderColor = type === 'warning' ? colors.yellow : type === 'info' ? colors.blue : colors.green
  const label = type === 'warning' ? 'Varning:' : type === 'info' ? 'Info:' : 'Tips:'

  pdf.setFillColor(...(bgColor as [number, number, number]))
  pdf.roundedRect(x, y, width, boxHeight, 3, 3, 'F')

  pdf.setDrawColor(...borderColor)
  pdf.setLineWidth(1)
  pdf.roundedRect(x, y, width, boxHeight, 3, 3, 'S')

  pdf.setTextColor(...borderColor)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'bold')
  pdf.text(label, x + spacing.sm, y + 12)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFont(undefined, 'normal')
  const lines = pdf.splitTextToSize(text, width - spacing.lg)
  pdf.text(lines[0] || '', x + spacing.sm, y + 22)

  return y + boxHeight + spacing.md
}

// Hjälpfunktion för steg-för-steg
const drawStepByStep = (
  pdf: jsPDF,
  title: string,
  steps: string[],
  x: number,
  y: number,
  width: number
): number => {
  // Bakgrund
  pdf.setFillColor(...colors.lightGray)
  const stepHeight = steps.length * 16 + 30
  pdf.roundedRect(x, y, width, stepHeight, 4, 4, 'F')

  // Rubrik
  pdf.setTextColor(...colors.charcoal)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text(title, x + spacing.md, y + 16)

  let currentY = y + 26

  steps.forEach((step, index) => {
    // Nummer-cirkel
    pdf.setFillColor(...colors.accent)
    pdf.circle(x + spacing.md + 6, currentY + 4, 6, 'F')

    pdf.setTextColor(...colors.white)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text(`${index + 1}`, x + spacing.md + 6, currentY + 7, { align: 'center' })

    // Stegtext
    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(10)
    pdf.setFont(undefined, 'normal')
    pdf.text(step, x + spacing.md + 18, currentY + 6)

    currentY += 16
  })

  return y + stepHeight + spacing.md
}

// Huvudfunktion för att generera guiden
export const generateTechnicianGuide = async (): Promise<void> => {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const margins = { left: 18, right: 18, top: 20, bottom: 25 }
  const contentWidth = pageWidth - margins.left - margins.right

  // Sidbrytning helper
  const checkPageBreak = (y: number, needed: number): number => {
    if (y + needed > pageHeight - margins.bottom) {
      pdf.addPage()
      return margins.top
    }
    return y
  }

  // ============================================
  // SIDA 1: FRAMSIDA
  // ============================================

  // Header-bild eller bakgrund
  let headerLoaded = false
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
          pdf.addImage(dataURL, 'PNG', 0, 0, pageWidth, 50)
          headerLoaded = true
          resolve(true)
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = () => reject(new Error('Failed'))
      img.src = logoPath
    })
  } catch {
    // Fallback header
    pdf.setFillColor(...colors.primary)
    pdf.rect(0, 0, pageWidth, 50, 'F')
    pdf.setFillColor(...colors.accent)
    pdf.rect(0, 46, pageWidth, 4, 'F')
  }

  // Titel
  let y = 80

  pdf.setTextColor(...colors.primary)
  pdf.setFontSize(28)
  pdf.setFont(undefined, 'bold')
  pdf.text('UTRUSTNINGSPLACERING', pageWidth / 2, y, { align: 'center' })

  y += 15
  pdf.setTextColor(...colors.accent)
  pdf.setFontSize(18)
  pdf.setFont(undefined, 'normal')
  pdf.text('Användarguide för Tekniker', pageWidth / 2, y, { align: 'center' })

  // Ikon-illustration (cirkel med kartnål-symbol)
  y += 30
  pdf.setFillColor(...colors.lightGray)
  pdf.circle(pageWidth / 2, y + 30, 35, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(pageWidth / 2, y + 30, 28, 'F')

  // Enkel kartnål-symbol
  pdf.setFillColor(...colors.white)
  pdf.circle(pageWidth / 2, y + 25, 8, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(pageWidth / 2, y + 25, 4, 'F')

  // Triangel för nålen
  pdf.setFillColor(...colors.white)
  pdf.triangle(pageWidth / 2 - 6, y + 30, pageWidth / 2 + 6, y + 30, pageWidth / 2, y + 45, 'F')

  y += 80

  // Introduktionstext
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'normal')
  const introText =
    'Denna guide hjälper dig att effektivt registrera och hantera skadedjursbekämpningsutrustning med GPS-koordinater i BeGone Kundportal.'
  const introLines = pdf.splitTextToSize(introText, contentWidth - 40)
  pdf.text(introLines, pageWidth / 2, y, { align: 'center' })

  y += 30

  // Sammanfattningsrutor
  const boxWidth = (contentWidth - spacing.md) / 3

  // Box 1
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, boxWidth, 50, 4, 4, 'F')
  pdf.setFillColor(...colors.green)
  pdf.circle(margins.left + boxWidth / 2, y + 15, 8, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text('1', margins.left + boxWidth / 2, y + 19, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Välj kund', margins.left + boxWidth / 2, y + 35, { align: 'center' })
  pdf.text('& navigera', margins.left + boxWidth / 2, y + 43, { align: 'center' })

  // Box 2
  const box2X = margins.left + boxWidth + spacing.sm
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(box2X, y, boxWidth, 50, 4, 4, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(box2X + boxWidth / 2, y + 15, 8, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text('2', box2X + boxWidth / 2, y + 19, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Hämta GPS', box2X + boxWidth / 2, y + 35, { align: 'center' })
  pdf.text('& registrera', box2X + boxWidth / 2, y + 43, { align: 'center' })

  // Box 3
  const box3X = margins.left + (boxWidth + spacing.sm) * 2
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(box3X, y, boxWidth, 50, 4, 4, 'F')
  pdf.setFillColor(...colors.blue)
  pdf.circle(box3X + boxWidth / 2, y + 15, 8, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text('3', box3X + boxWidth / 2, y + 19, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Hantera', box3X + boxWidth / 2, y + 35, { align: 'center' })
  pdf.text('& exportera', box3X + boxWidth / 2, y + 43, { align: 'center' })

  // Version och datum
  y = pageHeight - 40
  pdf.setTextColor(...colors.mediumGray)
  pdf.setFontSize(10)
  pdf.text('Version 1.0', pageWidth / 2, y, { align: 'center' })
  pdf.text('Januari 2026', pageWidth / 2, y + 12, { align: 'center' })

  // ============================================
  // SIDA 2: INNEHÅLLSFÖRTECKNING
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, 'INNEHÅLL', margins.left, y, contentWidth, 'h1')
  y += spacing.sm

  const tocItems = [
    { num: '1', title: 'Introduktion', page: '3' },
    { num: '2', title: 'Komma igång', page: '3' },
    { num: '3', title: 'Navigera till Utrustningsplacering', page: '4' },
    { num: '4', title: 'Välja kund', page: '4' },
    { num: '5', title: 'Registrera ny utrustning', page: '5' },
    { num: '6', title: 'Kartvy och listvy', page: '6' },
    { num: '7', title: 'Statushantering', page: '7' },
    { num: '8', title: 'Exportera till PDF', page: '7' },
    { num: '9', title: 'Felsökning', page: '8' }
  ]

  tocItems.forEach((item) => {
    pdf.setTextColor(...colors.accent)
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text(item.num + '.', margins.left, y + 8)

    pdf.setTextColor(...colors.darkGray)
    pdf.setFont(undefined, 'normal')
    pdf.text(item.title, margins.left + 12, y + 8)

    // Prickad linje
    pdf.setDrawColor(...colors.border)
    pdf.setLineDashPattern([1, 2], 0)
    pdf.line(margins.left + 80, y + 6, pageWidth - margins.right - 15, y + 6)
    pdf.setLineDashPattern([], 0)

    pdf.setTextColor(...colors.mediumGray)
    pdf.text(item.page, pageWidth - margins.right, y + 8, { align: 'right' })

    y += 18
  })

  // ============================================
  // SIDA 3: INTRODUKTION & KOMMA IGÅNG
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '1. INTRODUKTION', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Utrustningsplacering är ett verktyg som låter dig som tekniker registrera och hantera all skadedjursbekämpningsutrustning som placeras hos våra kontraktskunder. Systemet använder GPS-koordinater från din mobiltelefon för att exakt dokumentera var varje fälla eller station är placerad.',
    margins.left,
    y,
    contentWidth
  )

  y += spacing.sm
  y = drawSectionTitle(pdf, 'Fördelar med systemet', margins.left, y, contentWidth, 'h3')

  y = drawBulletList(
    pdf,
    [
      'Exakt dokumentation - GPS-koordinater säkerställer att varje placering är dokumenterad',
      'Spårbarhet - Se vem som placerat utrustningen och när',
      'Kundinsyn - Kunder kan se sin utrustning i kundportalen',
      'Effektiv uppföljning - Hitta enkelt tillbaka till utrustning vid servicebesök',
      'Professionella rapporter - Exportera PDF-rapporter för kunder'
    ],
    margins.left,
    y,
    contentWidth
  )

  y += spacing.sm
  y = drawSectionTitle(pdf, 'Utrustningstyper', margins.left, y, contentWidth, 'h3')

  y = drawTable(
    pdf,
    ['Typ', 'Färgkod', 'Serienummer'],
    [
      ['Mekanisk fälla', 'Grön', 'Obligatoriskt'],
      ['Betongstation', 'Grå', 'Valfritt'],
      ['Betesstation', 'Svart', 'Valfritt']
    ],
    margins.left,
    y,
    [70, 50, 55]
  )

  y = checkPageBreak(y, 80)

  y = drawSectionTitle(pdf, '2. KOMMA IGÅNG', margins.left, y, contentWidth, 'h1')

  y = drawSectionTitle(pdf, 'Förutsättningar', margins.left, y, contentWidth, 'h3')

  y = drawBulletList(
    pdf,
    [
      'Du är inloggad i teknikerportalen',
      'Platsbehörighet är aktiverad i din webbläsare/app',
      'GPS är påslagen på din mobiltelefon',
      'Du har tillgång till en kontraktskund att registrera utrustning för'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawTipBox(
    pdf,
    'Använd en smartphone med GPS och stabil internetanslutning för bästa resultat.',
    margins.left,
    y,
    contentWidth,
    'tip'
  )

  // ============================================
  // SIDA 4: NAVIGERING & VÄLJA KUND
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '3. NAVIGERA TILL UTRUSTNINGSPLACERING', margins.left, y, contentWidth, 'h1')

  y = drawStepByStep(
    pdf,
    'Från Dashboard',
    [
      'Logga in i teknikerportalen',
      'På din Dashboard hittar du sektionen "Snabbåtgärder"',
      'Klicka på knappen "Utrustning" (grön knapp med kartnålsikon)'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawTipBox(
    pdf,
    'Du kan även navigera direkt via URL: /technician/equipment',
    margins.left,
    y,
    contentWidth,
    'info'
  )

  y = checkPageBreak(y, 80)

  y = drawSectionTitle(pdf, '4. VÄLJA KUND', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'När du öppnar Utrustningsplacering visas först en kundväljare där du kan söka bland dina kontraktskunder.',
    margins.left,
    y,
    contentWidth
  )

  y = drawStepByStep(
    pdf,
    'Steg för steg',
    ['Klicka på dropdown-menyn märkt "Välj kund"', 'Sök eller bläddra bland dina kontraktskunder', 'Välj kunden du ska arbeta med'],
    margins.left,
    y,
    contentWidth
  )

  y = drawTipBox(
    pdf,
    'Endast kunder med aktiva kontrakt visas i listan. Om en kund saknas, kontakta koordinatorn.',
    margins.left,
    y,
    contentWidth,
    'info'
  )

  y = drawParagraph(
    pdf,
    'När du valt en kund laddas automatiskt all befintlig utrustning, statistik och kartan centreras på kundens placeringar.',
    margins.left,
    y,
    contentWidth
  )

  // ============================================
  // SIDA 5: REGISTRERA NY UTRUSTNING
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '5. REGISTRERA NY UTRUSTNING', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Klicka på den gröna knappen "+ Ny placering" i verktygsfältet för att öppna registreringsformuläret.',
    margins.left,
    y,
    contentWidth
  )

  y = drawSectionTitle(pdf, 'Fyll i uppgifter', margins.left, y, contentWidth, 'h3')

  // Utrustningstyp
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, contentWidth, 55, 4, 4, 'F')

  pdf.setTextColor(...colors.accent)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('1. Utrustningstyp (obligatoriskt)', margins.left + spacing.sm, y + 12)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Välj typ av utrustning:', margins.left + spacing.sm, y + 24)
  pdf.text('• Mekanisk fälla - Traditionella slagfällor', margins.left + spacing.md, y + 34)
  pdf.text('• Betongstation - Fasta betongstationer', margins.left + spacing.md, y + 42)
  pdf.text('• Betesstation - Betesstationer för gnagare', margins.left + spacing.md, y + 50)

  y += 62

  // GPS-position
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, contentWidth, 65, 4, 4, 'F')

  pdf.setTextColor(...colors.accent)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('2. GPS-position (obligatoriskt)', margins.left + spacing.sm, y + 12)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Automatisk positionshämtning:', margins.left + spacing.sm, y + 24)
  pdf.text('1. Klicka på knappen "Hämta GPS-position"', margins.left + spacing.md, y + 34)
  pdf.text('2. Tillåt platsbehörighet om webbläsaren frågar', margins.left + spacing.md, y + 42)
  pdf.text('3. Vänta medan positionen hämtas (kan ta några sekunder)', margins.left + spacing.md, y + 50)
  pdf.text('4. När positionen är hämtad visas koordinaterna', margins.left + spacing.md, y + 58)

  y += 72

  y = drawTipBox(
    pdf,
    'Systemet visar GPS-noggrannheten (t.ex. ±5m). Vänta tills noggrannheten är under 10 meter för bästa resultat.',
    margins.left,
    y,
    contentWidth,
    'tip'
  )

  // Serienummer och kommentar
  y = drawSectionTitle(pdf, 'Övriga fält', margins.left, y, contentWidth, 'h3')

  y = drawBulletList(
    pdf,
    [
      'Serienummer - Obligatoriskt för mekaniska fällor, valfritt för övriga',
      'Kommentar - Lägg till relevant information (t.ex. "Placerad bakom kylskåpet")',
      'Foto - Dokumentera placeringen med foto från kameran'
    ],
    margins.left,
    y,
    contentWidth
  )

  // ============================================
  // SIDA 6: KARTVY OCH LISTVY
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '6. KARTVY OCH LISTVY', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Systemet erbjuder två olika sätt att visa utrustning. Använd knapparna "Lista" och "Karta" i verktygsfältet för att byta vy.',
    margins.left,
    y,
    contentWidth
  )

  // Kartvy
  const halfWidth = (contentWidth - spacing.md) / 2

  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, halfWidth, 90, 4, 4, 'F')

  pdf.setFillColor(...colors.accent)
  pdf.roundedRect(margins.left, y, halfWidth, 20, 4, 4, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('KARTVY', margins.left + halfWidth / 2, y + 13, { align: 'center' })

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  const kartText = [
    '• Färgkodade markörer',
    '• Klicka för detaljer',
    '• Zooma in/ut',
    '• Centrera på min position'
  ]
  kartText.forEach((text, i) => {
    pdf.text(text, margins.left + spacing.sm, y + 35 + i * 12)
  })

  // Listvy
  const listX = margins.left + halfWidth + spacing.md
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(listX, y, halfWidth, 90, 4, 4, 'F')

  pdf.setFillColor(...colors.charcoal)
  pdf.roundedRect(listX, y, halfWidth, 20, 4, 4, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('LISTVY', listX + halfWidth / 2, y + 13, { align: 'center' })

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  const listText = [
    '• Tabellformat',
    '• Filtrera på typ/status',
    '• Sök på serienummer',
    '• Sortera kolumner'
  ]
  listText.forEach((text, i) => {
    pdf.text(text, listX + spacing.sm, y + 35 + i * 12)
  })

  y += 100

  y = drawSectionTitle(pdf, 'Markörsymboler på kartan', margins.left, y, contentWidth, 'h3')

  y = drawTable(
    pdf,
    ['Symbol', 'Betydelse'],
    [
      ['Solid cirkel', 'Aktiv utrustning'],
      ['Cirkel med "?"', 'Försvunnen utrustning'],
      ['Cirkel med "✕"', 'Borttagen utrustning']
    ],
    margins.left,
    y,
    [60, 115]
  )

  // ============================================
  // SIDA 7: STATUSHANTERING & PDF-EXPORT
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '7. STATUSHANTERING', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Varje utrustning har en status som spårar dess tillstånd. Statusändringen loggas automatiskt med datum och tekniker.',
    margins.left,
    y,
    contentWidth
  )

  y = drawTable(
    pdf,
    ['Status', 'Beskrivning', 'När använda'],
    [
      ['Aktiv', 'Utrustningen är på plats', 'Standard vid ny placering'],
      ['Borttagen', 'Har plockats bort', 'Vid avslutad behandling'],
      ['Försvunnen', 'Kunde inte hittas', 'Vid servicebesök']
    ],
    margins.left,
    y,
    [45, 70, 60]
  )

  y = drawStepByStep(
    pdf,
    'Ändra status',
    ['Öppna utrustningens detaljer', 'Klicka på nuvarande status', 'Välj ny status i dropdown-menyn'],
    margins.left,
    y,
    contentWidth
  )

  y = checkPageBreak(y, 80)

  y = drawSectionTitle(pdf, '8. EXPORTERA TILL PDF', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Du kan generera professionella PDF-rapporter för kunder med BeGone-branding.',
    margins.left,
    y,
    contentWidth
  )

  y = drawStepByStep(
    pdf,
    'Skapa PDF-rapport',
    [
      'Se till att rätt kund är vald',
      'Klicka på "PDF"-knappen i verktygsfältet',
      'PDF:en genereras och laddas ner automatiskt'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawSectionTitle(pdf, 'Rapportens innehåll', margins.left, y, contentWidth, 'h3')

  y = drawBulletList(
    pdf,
    [
      'BeGone-header med företagslogotyp',
      'Sammanfattning med antal per utrustningstyp',
      'Detaljerad lista med typ, serienummer, GPS, status och datum',
      'Kommentarer för placeringar med anteckningar',
      'Professionell footer med kontaktuppgifter'
    ],
    margins.left,
    y,
    contentWidth
  )

  // ============================================
  // SIDA 8: FELSÖKNING
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '9. FELSÖKNING', margins.left, y, contentWidth, 'h1')

  // Fel 1
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, contentWidth, 50, 4, 4, 'F')

  pdf.setTextColor(...colors.red)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('"Åtkomst till plats nekad"', margins.left + spacing.sm, y + 14)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Orsak: Webbläsaren har inte behörighet att använda GPS.', margins.left + spacing.sm, y + 26)
  pdf.text('Lösning: Öppna webbläsarens inställningar, sök efter "Platsinställningar"', margins.left + spacing.sm, y + 36)
  pdf.text('och tillåt platsåtkomst för BeGone-portalen.', margins.left + spacing.sm, y + 44)

  y += 58

  // Fel 2
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, contentWidth, 50, 4, 4, 'F')

  pdf.setTextColor(...colors.red)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('"Platsinformation ej tillgänglig"', margins.left + spacing.sm, y + 14)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Orsak: GPS-signalen är för svag.', margins.left + spacing.sm, y + 26)
  pdf.text('Lösning: Gå närmare ett fönster eller utomhus och vänta 10-15 sekunder.', margins.left + spacing.sm, y + 36)
  pdf.text('Starta om webbläsaren om problemet kvarstår.', margins.left + spacing.sm, y + 44)

  y += 58

  // Fel 3
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, contentWidth, 50, 4, 4, 'F')

  pdf.setTextColor(...colors.red)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('"Timeout vid hämtning av plats"', margins.left + spacing.sm, y + 14)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Orsak: Det tog för lång tid att få GPS-position.', margins.left + spacing.sm, y + 26)
  pdf.text('Lösning: Kontrollera att GPS är aktiverat på enheten.', margins.left + spacing.sm, y + 36)
  pdf.text('Försök på en plats med bättre mottagning eller ange koordinater manuellt.', margins.left + spacing.sm, y + 44)

  y += 65

  // Support-ruta
  pdf.setFillColor(...colors.accent)
  pdf.roundedRect(margins.left, y, contentWidth, 55, 6, 6, 'F')

  pdf.setTextColor(...colors.white)
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text('SUPPORT', margins.left + contentWidth / 2, y + 18, { align: 'center' })

  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')
  pdf.text('Vid tekniska problem eller frågor, kontakta:', margins.left + contentWidth / 2, y + 32, { align: 'center' })
  pdf.text('support@begone.se | 010 280 44 10', margins.left + contentWidth / 2, y + 44, { align: 'center' })

  // ============================================
  // FOOTER PÅ ALLA SIDOR
  // ============================================
  const pageCount = pdf.internal.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)

    // Footer linje
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.5)
    pdf.line(margins.left, pageHeight - 20, pageWidth - margins.right, pageHeight - 20)

    // Footer text
    pdf.setTextColor(...colors.mediumGray)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')

    pdf.text('BeGone Skadedjur & Sanering AB', margins.left, pageHeight - 12)
    pdf.text('Utrustningsplacering - Användarguide', pageWidth / 2, pageHeight - 12, { align: 'center' })
    pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - margins.right, pageHeight - 12, { align: 'right' })
  }

  // Spara PDF
  const fileName = `BeGone_Teknikerguide_Utrustningsplacering_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(fileName)
}

export default generateTechnicianGuide
