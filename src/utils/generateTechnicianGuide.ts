// src/utils/generateTechnicianGuide.ts - Genererar PDF-guide för tekniker (v2.0)
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

// Hjälpfunktion för sektionsrubrik
const drawSectionTitle = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  style: 'h1' | 'h2' | 'h3' = 'h2'
): number => {
  if (style === 'h1') {
    pdf.setFillColor(...colors.accent)
    pdf.roundedRect(x, y, width, 24, 3, 3, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x + width / 2, y + 16, { align: 'center' })
    return y + 32
  } else if (style === 'h2') {
    pdf.setFillColor(...colors.charcoal)
    pdf.roundedRect(x, y, width, 18, 2, 2, 'F')
    pdf.setTextColor(...colors.white)
    pdf.setFontSize(11)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x + 8, y + 12)
    return y + 26
  } else {
    pdf.setTextColor(...colors.charcoal)
    pdf.setFontSize(10)
    pdf.setFont(undefined, 'bold')
    pdf.text(text, x, y + 4)
    return y + 12
  }
}

// Hjälpfunktion för brödtext med automatisk höjdberäkning
const drawParagraph = (
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): number => {
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  const lines = pdf.splitTextToSize(text, maxWidth)
  pdf.text(lines, x, y + 4)
  return y + lines.length * 4.5 + 6
}

// Hjälpfunktion för punktlista med dynamisk höjd
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
    pdf.circle(x + 2, currentY + 2.5, 1.2, 'F')

    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')
    const lines = pdf.splitTextToSize(item, maxWidth - 10)
    pdf.text(lines, x + 8, currentY + 4)

    currentY += lines.length * 4.5 + 3
  })

  return currentY + 4
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
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text(`${index + 1}.`, x, currentY + 4)

    pdf.setTextColor(...colors.darkGray)
    pdf.setFont(undefined, 'normal')
    const lines = pdf.splitTextToSize(item, maxWidth - 10)
    pdf.text(lines, x + 8, currentY + 4)

    currentY += lines.length * 4.5 + 3
  })

  return currentY + 4
}

// Hjälpfunktion för tabell med dynamisk höjd
const drawTable = (
  pdf: jsPDF,
  headers: string[],
  rows: string[][],
  x: number,
  y: number,
  colWidths: number[]
): number => {
  const rowHeight = 12
  const headerHeight = 14
  const totalWidth = colWidths.reduce((a, b) => a + b, 0)

  // Header
  pdf.setFillColor(...colors.charcoal)
  pdf.rect(x, y, totalWidth, headerHeight, 'F')

  pdf.setTextColor(...colors.white)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'bold')

  let colX = x
  headers.forEach((header, i) => {
    pdf.text(header, colX + 3, y + 9)
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
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')

    colX = x
    row.forEach((cell, i) => {
      pdf.text(cell, colX + 3, currentY + 8)
      colX += colWidths[i]
    })

    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.2)
    pdf.line(x, currentY + rowHeight, x + totalWidth, currentY + rowHeight)

    currentY += rowHeight
  })

  return currentY + 8
}

// Hjälpfunktion för tips/info/varning-ruta
const drawInfoBox = (
  pdf: jsPDF,
  title: string,
  text: string,
  x: number,
  y: number,
  width: number,
  type: 'tip' | 'warning' | 'info' = 'tip'
): number => {
  const bgColor = type === 'warning' ? [254, 249, 195] : type === 'info' ? [219, 234, 254] : [220, 252, 231]
  const borderColor = type === 'warning' ? colors.yellow : type === 'info' ? colors.blue : colors.green

  pdf.setFontSize(8)
  const textLines = pdf.splitTextToSize(text, width - 16)
  const boxHeight = 18 + textLines.length * 4

  pdf.setFillColor(...(bgColor as [number, number, number]))
  pdf.roundedRect(x, y, width, boxHeight, 2, 2, 'F')

  pdf.setDrawColor(...borderColor)
  pdf.setLineWidth(0.8)
  pdf.line(x, y, x, y + boxHeight)

  pdf.setTextColor(...borderColor)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'bold')
  pdf.text(title, x + 6, y + 10)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFont(undefined, 'normal')
  pdf.text(textLines, x + 6, y + 18)

  return y + boxHeight + 8
}

// Hjälpfunktion för steg-box
const drawStepBox = (
  pdf: jsPDF,
  title: string,
  steps: string[],
  x: number,
  y: number,
  width: number
): number => {
  const stepLineHeight = 12
  const boxHeight = 22 + steps.length * stepLineHeight

  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(x, y, width, boxHeight, 3, 3, 'F')

  pdf.setTextColor(...colors.charcoal)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text(title, x + 8, y + 14)

  let currentY = y + 22

  steps.forEach((step, index) => {
    // Nummer-cirkel
    pdf.setFillColor(...colors.accent)
    pdf.circle(x + 12, currentY + 3, 4, 'F')

    pdf.setTextColor(...colors.white)
    pdf.setFontSize(7)
    pdf.setFont(undefined, 'bold')
    pdf.text(`${index + 1}`, x + 12, currentY + 5, { align: 'center' })

    // Text
    pdf.setTextColor(...colors.darkGray)
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'normal')
    pdf.text(step, x + 22, currentY + 5)

    currentY += stepLineHeight
  })

  return y + boxHeight + 8
}

// Hjälpfunktion för felsökningsruta
const drawErrorBox = (
  pdf: jsPDF,
  errorMsg: string,
  cause: string,
  solution: string,
  x: number,
  y: number,
  width: number
): number => {
  pdf.setFontSize(8)
  const solutionLines = pdf.splitTextToSize(solution, width - 16)
  const boxHeight = 38 + solutionLines.length * 4

  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(x, y, width, boxHeight, 3, 3, 'F')

  pdf.setTextColor(...colors.red)
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'bold')
  pdf.text(`"${errorMsg}"`, x + 8, y + 12)

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text(`Orsak: ${cause}`, x + 8, y + 22)

  pdf.setFont(undefined, 'bold')
  pdf.text('Lösning:', x + 8, y + 32)
  pdf.setFont(undefined, 'normal')
  pdf.text(solutionLines, x + 8, y + 40)

  return y + boxHeight + 6
}

// Huvudfunktion för att generera guiden
export const generateTechnicianGuide = async (): Promise<void> => {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.width
  const pageHeight = pdf.internal.pageSize.height
  const margins = { left: 15, right: 15, top: 18, bottom: 22 }
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

  // Header-bakgrund (mörk)
  pdf.setFillColor(...colors.primary)
  pdf.rect(0, 0, pageWidth, 45, 'F')

  // Accent-linje
  pdf.setFillColor(...colors.accent)
  pdf.rect(0, 45, pageWidth, 3, 'F')

  // BeGone text
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(22)
  pdf.setFont(undefined, 'bold')
  pdf.text('BeGone', pageWidth / 2, 22, { align: 'center' })

  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')
  pdf.text('Skadedjur & Sanering AB', pageWidth / 2, 34, { align: 'center' })

  // Titel
  let y = 70

  pdf.setTextColor(...colors.primary)
  pdf.setFontSize(24)
  pdf.setFont(undefined, 'bold')
  pdf.text('UTRUSTNINGSPLACERING', pageWidth / 2, y, { align: 'center' })

  y += 12
  pdf.setTextColor(...colors.accent)
  pdf.setFontSize(14)
  pdf.setFont(undefined, 'normal')
  pdf.text('Användarguide för Tekniker', pageWidth / 2, y, { align: 'center' })

  // Ikon-illustration
  y += 25
  pdf.setFillColor(...colors.lightGray)
  pdf.circle(pageWidth / 2, y + 25, 30, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(pageWidth / 2, y + 25, 24, 'F')

  // Kartnål-symbol
  pdf.setFillColor(...colors.white)
  pdf.circle(pageWidth / 2, y + 20, 7, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(pageWidth / 2, y + 20, 3, 'F')
  pdf.setFillColor(...colors.white)
  pdf.triangle(pageWidth / 2 - 5, y + 25, pageWidth / 2 + 5, y + 25, pageWidth / 2, y + 38, 'F')

  y += 70

  // Introduktionstext
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')
  const introText = 'Denna guide hjälper dig att effektivt registrera och hantera skadedjursbekämpningsutrustning med GPS-koordinater i BeGone Kundportal.'
  const introLines = pdf.splitTextToSize(introText, contentWidth - 30)
  pdf.text(introLines, pageWidth / 2, y, { align: 'center' })

  y += 28

  // Sammanfattningsrutor
  const boxWidth = (contentWidth - 12) / 3

  // Box 1
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, boxWidth, 45, 3, 3, 'F')
  pdf.setFillColor(...colors.green)
  pdf.circle(margins.left + boxWidth / 2, y + 14, 7, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('1', margins.left + boxWidth / 2, y + 17, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('Välj kund', margins.left + boxWidth / 2, y + 30, { align: 'center' })
  pdf.text('& navigera', margins.left + boxWidth / 2, y + 38, { align: 'center' })

  // Box 2
  const box2X = margins.left + boxWidth + 6
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(box2X, y, boxWidth, 45, 3, 3, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.circle(box2X + boxWidth / 2, y + 14, 7, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('2', box2X + boxWidth / 2, y + 17, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('Hämta position', box2X + boxWidth / 2, y + 30, { align: 'center' })
  pdf.text('& registrera', box2X + boxWidth / 2, y + 38, { align: 'center' })

  // Box 3
  const box3X = margins.left + (boxWidth + 6) * 2
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(box3X, y, boxWidth, 45, 3, 3, 'F')
  pdf.setFillColor(...colors.blue)
  pdf.circle(box3X + boxWidth / 2, y + 14, 7, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('3', box3X + boxWidth / 2, y + 17, { align: 'center' })
  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  pdf.text('Hantera', box3X + boxWidth / 2, y + 30, { align: 'center' })
  pdf.text('& exportera', box3X + boxWidth / 2, y + 38, { align: 'center' })

  // Version och datum
  y = pageHeight - 35
  pdf.setTextColor(...colors.mediumGray)
  pdf.setFontSize(9)
  pdf.text('Version 2.0 | Januari 2026', pageWidth / 2, y, { align: 'center' })

  // ============================================
  // SIDA 2: INNEHÅLLSFÖRTECKNING
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, 'INNEHÅLL', margins.left, y, contentWidth, 'h1')

  const tocItems = [
    { num: '1', title: 'Introduktion', page: '3' },
    { num: '2', title: 'Komma igång', page: '3' },
    { num: '3', title: 'Navigera till Utrustningsplacering', page: '4' },
    { num: '4', title: 'Välja kund', page: '4' },
    { num: '5', title: 'Registrera ny utrustning', page: '5' },
    { num: '6', title: 'GPS-position och Kartväljare', page: '5-6' },
    { num: '7', title: 'Kartvy och listvy', page: '6' },
    { num: '8', title: 'Statushantering', page: '7' },
    { num: '9', title: 'Exportera till PDF', page: '7' },
    { num: '10', title: 'Felsökning', page: '8' }
  ]

  tocItems.forEach((item) => {
    pdf.setTextColor(...colors.accent)
    pdf.setFontSize(11)
    pdf.setFont(undefined, 'bold')
    pdf.text(item.num + '.', margins.left, y + 6)

    pdf.setTextColor(...colors.darkGray)
    pdf.setFont(undefined, 'normal')
    pdf.text(item.title, margins.left + 10, y + 6)

    // Prickad linje
    pdf.setDrawColor(...colors.border)
    pdf.setLineDashPattern([1, 1], 0)
    pdf.line(margins.left + 75, y + 4, pageWidth - margins.right - 12, y + 4)
    pdf.setLineDashPattern([], 0)

    pdf.setTextColor(...colors.mediumGray)
    pdf.text(item.page, pageWidth - margins.right, y + 6, { align: 'right' })

    y += 14
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
    [60, 50, 50]
  )

  y = checkPageBreak(y, 70)

  y = drawSectionTitle(pdf, '2. KOMMA IGÅNG', margins.left, y, contentWidth, 'h1')

  y = drawSectionTitle(pdf, 'Förutsättningar', margins.left, y, contentWidth, 'h3')

  y = drawBulletList(
    pdf,
    [
      'Du är inloggad i teknikerportalen',
      'Platsbehörighet är aktiverad i din webbläsare/app',
      'GPS är påslagen på din mobiltelefon',
      'Du har tillgång till en kontraktskund'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawInfoBox(
    pdf,
    'Tips:',
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

  y = drawStepBox(
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

  y = drawInfoBox(
    pdf,
    'Info:',
    'Du kan även navigera direkt via URL: /technician/equipment',
    margins.left,
    y,
    contentWidth,
    'info'
  )

  y = checkPageBreak(y, 70)

  y = drawSectionTitle(pdf, '4. VÄLJA KUND', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'När du öppnar Utrustningsplacering visas först en kundväljare där du kan söka bland dina kontraktskunder.',
    margins.left,
    y,
    contentWidth
  )

  y = drawStepBox(
    pdf,
    'Steg för steg',
    [
      'Klicka på dropdown-menyn märkt "Välj kund"',
      'Sök eller bläddra bland dina kontraktskunder',
      'Välj kunden du ska arbeta med'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawInfoBox(
    pdf,
    'Info:',
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
  // SIDA 5: REGISTRERA NY UTRUSTNING & GPS
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

  y = drawNumberedList(
    pdf,
    [
      'Utrustningstyp (obligatoriskt) - Välj Mekanisk fälla, Betongstation eller Betesstation',
      'Serienummer - Obligatoriskt för mekaniska fällor, valfritt för övriga',
      'GPS-position (obligatoriskt) - Se nästa sektion för detaljer',
      'Kommentar - Lägg till relevant information (t.ex. "Placerad bakom kylskåpet")',
      'Foto - Dokumentera placeringen med foto från kameran'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = checkPageBreak(y, 90)

  y = drawSectionTitle(pdf, '6. GPS-POSITION OCH KARTVÄLJARE', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Du har två alternativ för att ange position: automatisk GPS-hämtning eller manuell kartväljare. Båda metoderna ger exakta koordinater.',
    margins.left,
    y,
    contentWidth
  )

  // Alternativ 1: GPS
  y = drawSectionTitle(pdf, 'Alternativ 1: Hämta GPS', margins.left, y, contentWidth, 'h3')

  y = drawStepBox(
    pdf,
    'Automatisk GPS-hämtning',
    [
      'Klicka på knappen "Hämta GPS"',
      'Tillåt platsbehörighet om webbläsaren frågar',
      'Vänta medan positionen hämtas (upp till 30 sekunder)',
      'Systemet förbättrar positionen kontinuerligt'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawParagraph(
    pdf,
    'Systemet visar noggrannhetsnivå: Utmärkt (<10m), Bra (<30m), OK (<100m) eller Dålig (>100m). Vid dålig noggrannhet visas en varning och du rekommenderas att använda kartväljaren.',
    margins.left,
    y,
    contentWidth
  )

  // ============================================
  // SIDA 6: KARTVÄLJARE & VYER
  // ============================================
  pdf.addPage()
  y = margins.top

  // Alternativ 2: Kartväljare
  y = drawSectionTitle(pdf, 'Alternativ 2: Välj på karta (Backup)', margins.left, y, contentWidth, 'h3')

  y = drawParagraph(
    pdf,
    'Om GPS:en ger felaktig position eller inte fungerar kan du markera platsen manuellt på kartan.',
    margins.left,
    y,
    contentWidth
  )

  y = drawStepBox(
    pdf,
    'Manuell kartväljare',
    [
      'Klicka på knappen "Välj på karta"',
      'Kartan öppnas med en blå markör',
      'Klicka på kartan eller dra markören till rätt plats',
      'Använd adresssökning eller "Min position"-knappen som hjälp',
      'Klicka "Använd denna position" för att bekräfta'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = drawInfoBox(
    pdf,
    'Tips:',
    'Kartväljaren har adresssökning - sök på t.ex. "Kungsgatan 1, Stockholm" för att snabbt hitta rätt område.',
    margins.left,
    y,
    contentWidth,
    'tip'
  )

  y = checkPageBreak(y, 90)

  y = drawSectionTitle(pdf, '7. KARTVY OCH LISTVY', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Systemet erbjuder två olika sätt att visa utrustning. Använd knapparna "Lista" och "Karta" för att byta vy.',
    margins.left,
    y,
    contentWidth
  )

  // Två kolumner för kartvy och listvy
  const halfWidth = (contentWidth - 8) / 2

  // Kartvy-box
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(margins.left, y, halfWidth, 70, 3, 3, 'F')
  pdf.setFillColor(...colors.accent)
  pdf.roundedRect(margins.left, y, halfWidth, 16, 3, 3, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('KARTVY', margins.left + halfWidth / 2, y + 11, { align: 'center' })

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  const kartText = ['Färgkodade markörer', 'Klicka för detaljer', 'Zooma in/ut', 'Centrera på min position']
  kartText.forEach((text, i) => {
    pdf.text('• ' + text, margins.left + 6, y + 28 + i * 10)
  })

  // Listvy-box
  const listX = margins.left + halfWidth + 8
  pdf.setFillColor(...colors.lightGray)
  pdf.roundedRect(listX, y, halfWidth, 70, 3, 3, 'F')
  pdf.setFillColor(...colors.charcoal)
  pdf.roundedRect(listX, y, halfWidth, 16, 3, 3, 'F')
  pdf.setTextColor(...colors.white)
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'bold')
  pdf.text('LISTVY', listX + halfWidth / 2, y + 11, { align: 'center' })

  pdf.setTextColor(...colors.darkGray)
  pdf.setFontSize(8)
  pdf.setFont(undefined, 'normal')
  const listText = ['Tabellformat', 'Filtrera på typ/status', 'Sök på serienummer', 'Sortera kolumner']
  listText.forEach((text, i) => {
    pdf.text('• ' + text, listX + 6, y + 28 + i * 10)
  })

  y += 80

  y = drawSectionTitle(pdf, 'Markörsymboler', margins.left, y, contentWidth, 'h3')

  y = drawTable(
    pdf,
    ['Symbol', 'Betydelse'],
    [
      ['Solid cirkel', 'Aktiv utrustning'],
      ['Cirkel med "?"', 'Försvunnen'],
      ['Cirkel med "✕"', 'Borttagen']
    ],
    margins.left,
    y,
    [55, 105]
  )

  // ============================================
  // SIDA 7: STATUS & PDF-EXPORT
  // ============================================
  pdf.addPage()
  y = margins.top

  y = drawSectionTitle(pdf, '8. STATUSHANTERING', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Varje utrustning har en status som spårar dess tillstånd. Statusändringen loggas automatiskt.',
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
    [40, 65, 55]
  )

  y = drawStepBox(
    pdf,
    'Ändra status',
    [
      'Öppna utrustningens detaljer',
      'Klicka på nuvarande status',
      'Välj ny status i dropdown-menyn'
    ],
    margins.left,
    y,
    contentWidth
  )

  y = checkPageBreak(y, 80)

  y = drawSectionTitle(pdf, '9. EXPORTERA TILL PDF', margins.left, y, contentWidth, 'h1')

  y = drawParagraph(
    pdf,
    'Du kan generera professionella PDF-rapporter för kunder med BeGone-branding.',
    margins.left,
    y,
    contentWidth
  )

  y = drawStepBox(
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

  y = drawSectionTitle(pdf, '10. FELSÖKNING', margins.left, y, contentWidth, 'h1')

  y = drawErrorBox(
    pdf,
    'Åtkomst till plats nekad',
    'Webbläsaren har inte behörighet att använda GPS.',
    'Öppna webbläsarens inställningar, sök efter "Platsinställningar" och tillåt platsåtkomst för BeGone-portalen. Ladda sedan om sidan.',
    margins.left,
    y,
    contentWidth
  )

  y = drawErrorBox(
    pdf,
    'Platsinformation ej tillgänglig',
    'GPS-signalen är för svag eller enheten saknar GPS.',
    'Gå närmare ett fönster eller utomhus. Vänta 10-15 sekunder. Om problemet kvarstår, använd kartväljaren ("Välj på karta") istället.',
    margins.left,
    y,
    contentWidth
  )

  y = drawErrorBox(
    pdf,
    'Dålig GPS-noggrannhet / Fel position',
    'GPS:en returnerar en ungefärlig position baserad på WiFi eller IP-adress.',
    'Vänta längre för bättre GPS-signal, gå utomhus, eller använd kartväljaren ("Välj på karta") för att manuellt markera rätt position på kartan.',
    margins.left,
    y,
    contentWidth
  )

  y = drawErrorBox(
    pdf,
    'Timeout vid hämtning av plats',
    'Det tog för lång tid att få GPS-position.',
    'Kontrollera att GPS är aktiverat på enheten. Försök på en plats med bättre mottagning. Som backup, använd kartväljaren för att markera platsen manuellt.',
    margins.left,
    y,
    contentWidth
  )

  y = checkPageBreak(y, 50)

  // Support-ruta
  pdf.setFillColor(...colors.accent)
  pdf.roundedRect(margins.left, y, contentWidth, 45, 4, 4, 'F')

  pdf.setTextColor(...colors.white)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('SUPPORT', margins.left + contentWidth / 2, y + 14, { align: 'center' })

  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text('Vid tekniska problem eller frågor, kontakta:', margins.left + contentWidth / 2, y + 26, { align: 'center' })
  pdf.text('support@begone.se | 010 280 44 10', margins.left + contentWidth / 2, y + 38, { align: 'center' })

  // ============================================
  // FOOTER PÅ ALLA SIDOR
  // ============================================
  const pageCount = pdf.internal.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)

    // Footer linje
    pdf.setDrawColor(...colors.border)
    pdf.setLineWidth(0.4)
    pdf.line(margins.left, pageHeight - 18, pageWidth - margins.right, pageHeight - 18)

    // Footer text
    pdf.setTextColor(...colors.mediumGray)
    pdf.setFontSize(7)
    pdf.setFont(undefined, 'normal')

    pdf.text('BeGone Skadedjur & Sanering AB', margins.left, pageHeight - 10)
    pdf.text('Utrustningsplacering - Användarguide v2.0', pageWidth / 2, pageHeight - 10, { align: 'center' })
    pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - margins.right, pageHeight - 10, { align: 'right' })
  }

  // Spara PDF
  const fileName = `BeGone_Teknikerguide_Utrustningsplacering_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(fileName)
}

export default generateTechnicianGuide
