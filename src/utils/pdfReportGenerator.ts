// src/utils/pdfReportGenerator.ts - Professional SANERINGSRAPPORT design
import { jsPDF } from 'jspdf'

interface TaskDetails {
  task_id: string
  task_info: {
    name: string
    status: string
    description: string
    created: string
    updated: string
  }
  assignees: Array<{
    name: string
    email: string
  }>
  custom_fields: Array<{
    id: string
    name: string
    type: string
    value: any
    has_value: boolean
    type_config?: {
      options?: Array<{
        id: string
        name: string
        color: string
        orderindex: number
      }>
    }
  }>
}

interface CustomerInfo {
  company_name: string
  org_number: string
  contact_person: string
}

// BeGone Professional Color Palette (optimerad för print och digital)
const beGoneColors = {
  // Huvudfärger
  primary: [10, 19, 40],        // BeGone Dark Blue (#0A1328)
  accent: [32, 197, 143],       // BeGone Green (#20C58F) 
  accentDark: [16, 185, 129],   // Darker green för kontrast
  
  // Neutral palette för text och bakgrunder
  white: [255, 255, 255],
  lightestGray: [248, 250, 252], // Slate-50 för ljusa ytor
  lightGray: [241, 245, 249],     // Slate-100 för cards
  mediumGray: [148, 163, 184],    // Slate-400 för muted text
  darkGray: [51, 65, 85],         // Slate-700 för primary text
  charcoal: [30, 41, 59],         // Slate-800 för headers
  
  // Borders och separatorer
  border: [203, 213, 225],        // Slate-300 för tydligare borders
  divider: [226, 232, 240],       // Slate-200 för subtila linjer
  
  // Status färger för professionell rapportering
  success: [34, 197, 94],         // Emerald-500
  info: [59, 130, 246],           // Blue-500  
  warning: [245, 158, 11],        // Amber-500
  
  // Shadow för depth
  shadow: [0, 0, 0, 0.1]          // Subtle shadow för cards
}

// Professional spacing system för optimal läsbarhet
const spacing = {
  xs: 3,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 36,
  section: 28  // Konsekvent avstånd mellan sektioner
}

// Typography system för hierarki och läsbarhet
const typography = {
  title: { size: 20, weight: 'bold' },
  sectionHeader: { size: 16, weight: 'bold' },
  subheader: { size: 12, weight: 'bold' },
  body: { size: 10, weight: 'normal' },
  caption: { size: 9, weight: 'normal' },
  label: { size: 8, weight: 'bold' }
}

// Hjälpfunktion för dropdown-text
const getDropdownText = (field: any): string => {
  if (!field || !field.has_value) return 'Ej specificerat'
  
  if (field.type_config?.options && Array.isArray(field.type_config.options)) {
    const selectedOption = field.type_config.options.find((option: any) => 
      option.orderindex === field.value
    )
    if (selectedOption) {
      return selectedOption.name
    }
  }
  
  return field.value?.toString() || 'Ej specificerat'
}

// Hjälpfunktion för att formatera datum
const formatDate = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp))
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// Hjälpfunktion för att hitta custom field
const getFieldValue = (taskDetails: TaskDetails, fieldName: string) => {
  return taskDetails.custom_fields.find(field => 
    field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
  )
}

// Hjälpfunktion för att formatera adresser till snyggt format
const formatAddress = (addressValue: any): string => {
  if (!addressValue) return '[Adress ej angiven]'
  
  console.log('formatAddress input:', addressValue, typeof addressValue)
  
  // Om det är en string som ser ut som JSON, försök parsa den
  if (typeof addressValue === 'string') {
    // Kolla om det är en JSON-string
    if (addressValue.startsWith('{') && addressValue.includes('formatted_address')) {
      try {
        const parsed = JSON.parse(addressValue)
        if (parsed.formatted_address) {
          return parsed.formatted_address.replace(/, Sverige$/, '').trim()
        }
      } catch (e) {
        console.warn('Failed to parse address JSON string:', e)
      }
    }
    // Annars, vanlig string-adress
    return addressValue.replace(/, Sverige$/, '').trim()
  }
  
  // Om det är ett objekt
  if (typeof addressValue === 'object' && addressValue !== null) {
    // Direkt tillgång till formatted_address
    if (addressValue.formatted_address) {
      const addr = addressValue.formatted_address
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
    
    // Alternativa fält
    if (addressValue.address) {
      const addr = addressValue.address
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
    
    if (addressValue.street) {
      const addr = addressValue.street
      return typeof addr === 'string' ? addr.replace(/, Sverige$/, '').trim() : addr
    }
    
    // Om objektet bara innehåller koordinater utan adress
    if (addressValue.location && !addressValue.formatted_address) {
      return '[Adress ej angiven]'
    }
    
    // Sista utväg - försök konvertera hela objektet
    try {
      const objStr = JSON.stringify(addressValue)
      if (objStr.includes('formatted_address')) {
        const match = objStr.match(/"formatted_address":"([^"]+)"/)
        if (match && match[1]) {
          return match[1].replace(/, Sverige$/, '').trim()
        }
      }
    } catch (e) {
      console.warn('Failed to extract address from object:', e)
    }
  }
  
  // Fallback
  const fallback = addressValue?.toString()?.trim() || '[Adress ej angiven]'
  console.log('formatAddress fallback:', fallback)
  return typeof fallback === 'string' ? fallback.replace(/, Sverige$/, '') : fallback
}

// Professional card system med subtle shadows och borders
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
  
  // Subtle drop shadow för depth
  if (shadow) {
    pdf.setFillColor(0, 0, 0, 0.08)
    pdf.roundedRect(x + 1.5, y + 1.5, width, height, radius, radius, 'F')
  }
  
  // Main card background
  const bgColor = backgroundColor === 'white' ? beGoneColors.white : beGoneColors.lightestGray
  pdf.setFillColor(...bgColor)
  pdf.roundedRect(x, y, width, height, radius, radius, 'F')
  
  // Professional border
  pdf.setDrawColor(...beGoneColors.border)
  pdf.setLineWidth(borderWeight)
  pdf.roundedRect(x, y, width, height, radius, radius, 'S')
}

// Professional header med BeGone branding - fullbredd
const drawProfessionalHeader = (pdf: jsPDF, pageWidth: number, reportType: string = 'SANERINGSRAPPORT') => {
  const headerHeight = 80 // Öka för fullbredd-layout
  
  // Gradient background effect simulering med multiple rektanglar - fullbredd
  const gradientSteps = 5
  for (let i = 0; i < gradientSteps; i++) {
    const alpha = 1 - (i * 0.1)
    const stepHeight = headerHeight / gradientSteps
    const [r, g, b] = beGoneColors.primary
    pdf.setFillColor(r + (i * 5), g + (i * 3), b + (i * 8))
    pdf.rect(0, i * stepHeight, pageWidth, stepHeight, 'F')
  }
  
  // Accent line för visuell separation - fullbredd
  pdf.setFillColor(...beGoneColors.accent)
  pdf.rect(0, headerHeight - 4, pageWidth, 4, 'F')
}

// Förbättrad section header funktion
const drawSectionHeader = (
  pdf: jsPDF, 
  text: string, 
  x: number, 
  y: number, 
  width: number,
  style: 'primary' | 'accent' | 'minimal' = 'primary'
) => {
  const headerHeight = 22
  
  if (style === 'accent') {
    // Accent header med BeGone green
    pdf.setFillColor(...beGoneColors.accent)
    pdf.roundedRect(x, y, width, headerHeight, 4, 4, 'F')
    pdf.setTextColor(...beGoneColors.white)
  } else if (style === 'primary') {
    // Primary header med subtle background
    pdf.setFillColor(...beGoneColors.charcoal)
    pdf.roundedRect(x, y, width, headerHeight, 4, 4, 'F')
    pdf.setTextColor(...beGoneColors.white)
  } else {
    // Minimal header - bara text
    pdf.setTextColor(...beGoneColors.darkGray)
  }
  
  pdf.setFontSize(typography.sectionHeader.size)
  pdf.setFont(undefined, typography.sectionHeader.weight)
  pdf.text(text, x + width/2, y + headerHeight/2 + 2, { align: 'center' })
  
  return y + headerHeight + spacing.sm
}

export const generatePDFReport = async (
  taskDetails: TaskDetails, 
  customerInfo?: CustomerInfo
): Promise<void> => {
  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    const margins = { left: spacing.lg, right: spacing.lg, top: spacing.xl, bottom: spacing.xl }
    const contentWidth = pageWidth - (margins.left + margins.right)
    let yPosition = 50 // Minska för mindre header (40px + lite utrymme)

    // Hämta alla relevanta custom fields för saneringsrapport
    const addressField = getFieldValue(taskDetails, 'adress')
    const pestField = getFieldValue(taskDetails, 'skadedjur')
    const caseTypeField = getFieldValue(taskDetails, 'ärende')
    const priceField = getFieldValue(taskDetails, 'pris')
    const reportField = getFieldValue(taskDetails, 'rapport')
    const priorityField = getFieldValue(taskDetails, 'prioritet')
    const treatmentMethodField = getFieldValue(taskDetails, 'behandlingsmetod')
    const followUpField = getFieldValue(taskDetails, 'uppföljning')
    const startDateField = getFieldValue(taskDetails, 'start_date')

    // === PROFESSIONAL HEADER - bara bild, ingen text ===
    let headerSuccessful = false
    
    // Försök ladda BeGone header-logotype
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
            
            // Header-bild från toppen, full bredd, korrekt höjd
            const headerImageHeight = 40 // Minska höjden för att inte sträcka bilden
            
            // Positionera från absolut topp, full bredd
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
    
    // Om bilden inte laddades, skapa bara en minimal bakgrund
    if (!headerSuccessful) {
      // Minimal header bakgrund
      pdf.setFillColor(...beGoneColors.primary)
      pdf.rect(0, 0, pageWidth, 40, 'F')
      
      // BeGone text som fallback
      pdf.setTextColor(...beGoneColors.white)
      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.text('BeGone Skadedjur & Sanering', pageWidth/2, 25, { align: 'center' })
    }

    // === RAPPORT METADATA (datum, ärendenummer etc.) ===
    yPosition += spacing.sm
    
    // Kompakt metadata sektion
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.caption.size)
    pdf.setFont(undefined, 'normal')
    
    const reportDate = new Date().toLocaleDateString('sv-SE', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    pdf.text(`Rapport genererad: ${reportDate}`, pageWidth/2, yPosition, { align: 'center' })
    pdf.text(`Ärende ID: ${taskDetails.task_id}`, pageWidth/2, yPosition + spacing.sm, { align: 'center' })
    
    // Använd formatAddress för korrekt adressvisning
    if (addressField) {
      const formattedAddress = formatAddress(addressField.value)
      pdf.text(`Adress: ${formattedAddress}`, pageWidth/2, yPosition + spacing.md, { align: 'center' })
    }
    
    yPosition += spacing.section

    // === KUNDUPPGIFTER SEKTION ===
    yPosition = drawSectionHeader(pdf, 'KUNDUPPGIFTER', margins.left, yPosition, contentWidth, 'primary')

    // Avgör om det är privatperson eller företag baserat på case_type
    const orgNumber = customerInfo?.org_number || ''
    // Använd case_type från taskDetails för att avgöra kundtyp
    const caseTypeField = getFieldValue(taskDetails, 'case_type') 
    const isCompany = caseTypeField?.value === 'business' || caseTypeField?.value === 'contract' || false
    
    // Professional kunduppgifter card med dynamisk layout
    const customerCardHeight = isCompany ? 85 : 75 // Mindre höjd för privatpersoner (ingen kontaktperson-rad)
    drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, customerCardHeight, {
      backgroundColor: 'white',
      shadow: true
    })

    // Professional kunduppgifter layout med tydlig hierarki
    const leftCol = margins.left + spacing.md
    const rightCol = margins.left + (contentWidth/2) + spacing.sm
    const cardPadding = spacing.md
    let cardY = yPosition + cardPadding
    
    // Hämta telefon och email från custom fields
    const phoneField = getFieldValue(taskDetails, 'telefon') || getFieldValue(taskDetails, 'telefon_kontaktperson')
    const emailField = getFieldValue(taskDetails, 'email') || getFieldValue(taskDetails, 'e_post_kontaktperson')
    const phoneText = phoneField ? phoneField.value : '[Telefon ej angiven]'
    const emailText = emailField ? emailField.value : '[Email ej angiven]'

    if (isCompany) {
      // FÖRETAGSLAYOUT
      // Row 1: Företag och kontaktperson
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('UPPDRAGSGIVARE', leftCol, cardY)
      pdf.text('KONTAKTPERSON', rightCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(customerInfo?.company_name || '[Företagsnamn saknas]', leftCol, cardY + spacing.sm)
      pdf.text(customerInfo?.contact_person || '[Kontaktperson saknas]', rightCol, cardY + spacing.sm)

      // Row 2: Org nr och telefon
      cardY += spacing.md // Minska avstånd från lg till md
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('ORG NR', leftCol, cardY)
      pdf.text('TELEFON', rightCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(orgNumber || '[Org.nr saknas]', leftCol, cardY + spacing.sm)
      pdf.text(phoneText, rightCol, cardY + spacing.sm)

      // Row 3: Email
      cardY += spacing.md // Minska avstånd från lg till md
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('EMAIL', leftCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(emailText, leftCol, cardY + spacing.sm)
      
    } else {
      // PRIVATPERSONLAYOUT  
      // Row 1: Namn och personnummer
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('UPPDRAGSGIVARE', leftCol, cardY)
      pdf.text('PERSONNUMMER', rightCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(customerInfo?.contact_person || '[Namn saknas]', leftCol, cardY + spacing.sm)
      pdf.text(orgNumber || '[Personnummer saknas]', rightCol, cardY + spacing.sm)

      // Row 2: Telefon och email
      cardY += spacing.md // Minska avstånd från lg till md
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('TELEFON', leftCol, cardY)
      pdf.text('EMAIL', rightCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(phoneText, leftCol, cardY + spacing.sm)
      pdf.text(emailText, rightCol, cardY + spacing.sm)
    }

    // Row sist: Ärende ID (ensam rad)
    cardY += spacing.md // Minska avstånd från lg till md
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('ÄRENDE ID', leftCol, cardY)
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text(taskDetails.task_id, leftCol, cardY + spacing.sm)

    yPosition += customerCardHeight + spacing.md // Minska section-avstånd

    // === LEVERANTÖRSUPPGIFTER SEKTION ===
    // Kontrollera om vi behöver sidbrytning för hela leverantörssektionen
    const hasAssignee = taskDetails.assignees.length > 0
    const supplierCardHeight = hasAssignee ? 95 : 75 // Öka höjden för separata telefon/email-rader
    const supplierSectionHeight = 22 + spacing.sm + supplierCardHeight // Section header + card
    
    if (yPosition + supplierSectionHeight > pageHeight - 40) {
      pdf.addPage()
      yPosition = spacing.xl
    }
    
    yPosition = drawSectionHeader(pdf, 'LEVERANTÖRSUPPGIFTER', margins.left, yPosition, contentWidth, 'primary')
    
    drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, supplierCardHeight, {
      backgroundColor: 'white',
      shadow: true
    })

    cardY = yPosition + cardPadding

    // BeGone företagsinformation
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('FÖRETAG', leftCol, cardY)
    pdf.text('ORGANISATIONSNUMMER', rightCol, cardY)
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text('BeGone Skadedjur & Sanering AB', leftCol, cardY + spacing.sm)
    pdf.text('559378-9208', rightCol, cardY + spacing.sm)

    // Kontaktinformation - separera telefon och email
    cardY += spacing.md // Minska avstånd från lg till md
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('BESÖKSADRESS', leftCol, cardY)
    pdf.text('TELEFON', rightCol, cardY)
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text('Bläcksvampsvägen 17, 141 60 Huddinge', leftCol, cardY + spacing.sm)
    pdf.text('010 280 44 10', rightCol, cardY + spacing.sm)
    
    // Email på nästa rad
    cardY += spacing.md
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('EMAIL', leftCol, cardY)
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text('info@begone.se', leftCol, cardY + spacing.sm)

    // Ansvarig tekniker (om tilldelad)
    if (hasAssignee) {
      cardY += spacing.md // Minska avstånd från lg till md
      pdf.setFont(undefined, typography.label.weight)
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.setFontSize(typography.label.size)
      pdf.text('ANSVARIG TEKNIKER', leftCol, cardY)
      pdf.text('TEKNIKER KONTAKT', rightCol, cardY)
      
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.body.size)
      pdf.text(taskDetails.assignees[0].name, leftCol, cardY + spacing.sm)
      pdf.text(taskDetails.assignees[0].email, rightCol, cardY + spacing.sm)
    }

    yPosition += supplierCardHeight + spacing.md // Minska section-avstånd

    // Sidbrytning om nödvändigt
    if (yPosition > pageHeight - 140) {
      pdf.addPage()
      yPosition = spacing.xl
    }

    // === ARBETSINFORMATION SEKTION ===
    yPosition = drawSectionHeader(pdf, 'ARBETSINFORMATION', margins.left, yPosition, contentWidth, 'accent')

    const workCardHeight = 95 // Mer plats för utökad information
    drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, workCardHeight, {
      backgroundColor: 'light',
      shadow: true
    })

    cardY = yPosition + cardPadding

    // Rad 1: Datum och adress
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('DATUM FÖR UTFÖRANDE', leftCol, cardY)
    pdf.text('ARBETSPLATS', rightCol, cardY)
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    
    // Använd start_date om tillgängligt, annars created datum
    let workDate = 'Ej angivet'
    if (startDateField && startDateField.value) {
      const startDate = new Date(startDateField.value)
      if (!isNaN(startDate.getTime())) {
        workDate = startDate.toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit'
        })
      }
    } else {
      workDate = formatDate(taskDetails.task_info.created)
    }
    pdf.text(workDate, leftCol, cardY + spacing.sm)
    
    // Använd formatAddress för konsistent adresshantering
    const addressText = addressField ? formatAddress(addressField.value) : '[Adress ej angiven]'
    
    const maxAddressWidth = (contentWidth/2) - spacing.lg
    const addressLines = pdf.splitTextToSize(addressText, maxAddressWidth)
    pdf.text(addressLines.slice(0, 2), rightCol, cardY + spacing.sm)

    // Rad 2: Skadedjur och ärendetyp
    cardY += spacing.md // Minska avstånd från lg till md
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('ÄRENDET AVSER', leftCol, cardY)
    if (caseTypeField) {
      pdf.text('TYP AV INSATS', rightCol, cardY)
    }
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text(pestField ? getDropdownText(pestField) : 'Ej specificerat', leftCol, cardY + spacing.sm)
    if (caseTypeField) {
      pdf.text(getDropdownText(caseTypeField), rightCol, cardY + spacing.sm)
    }

    // Rad 3: Status och prioritet
    cardY += spacing.md // Minska avstånd från lg till md
    pdf.setFont(undefined, typography.label.weight)
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.label.size)
    pdf.text('ARBETSSTATUS', leftCol, cardY)
    if (priorityField) {
      pdf.text('PRIORITETSNIVÅ', rightCol, cardY)
    }
    
    pdf.setFont(undefined, typography.body.weight)
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.body.size)
    pdf.text(taskDetails.task_info.status || 'Okänd status', leftCol, cardY + spacing.sm)
    if (priorityField) {
      pdf.text(getDropdownText(priorityField), rightCol, cardY + spacing.sm)
    }

    yPosition += workCardHeight + spacing.md // Minska section-avstånd

    // === DETALJERAD SANERINGSRAPPORT SEKTION ===
    if (reportField && reportField.value) {
      // Alltid ny sida för detaljerad rapport
      pdf.addPage()
      yPosition = spacing.xl

      yPosition = drawSectionHeader(pdf, 'DETALJERAD SANERINGSRAPPORT', margins.left, yPosition, contentWidth, 'accent')
      
      const reportText = reportField.value.toString()
      const textLines = pdf.splitTextToSize(reportText, contentWidth - (spacing.md * 2)) // Minska marginaler för mer bredd
      
      const lineHeight = 5.5
      const reportPadding = spacing.md // Minska padding för mer textutrymme
      const reportBoxHeight = Math.max(60, textLines.length * lineHeight + reportPadding * 2)
      
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, reportBoxHeight, {
        backgroundColor: 'white',
        shadow: true,
        borderWeight: 1.2
      })
      
      // Rapport innehåll med professionell formatering
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, typography.body.weight)
      pdf.setTextColor(...beGoneColors.darkGray)
      
      let textY = yPosition + reportPadding
      textLines.forEach((line: string) => {
        // Automatisk sidbrytning vid behov
        if (textY > pageHeight - 40) {
          pdf.addPage()
          textY = spacing.xl
          
          // Rita ny card på ny sida om nödvändigt
          const remainingLines = textLines.slice(textLines.indexOf(line))
          const remainingHeight = Math.max(40, remainingLines.length * lineHeight + reportPadding)
          drawProfessionalCard(pdf, margins.left, textY - reportPadding, contentWidth, remainingHeight, {
            backgroundColor: 'white',
            shadow: true,
            borderWeight: 1.2
          })
        }
        
        pdf.text(line, margins.left + spacing.sm, textY) // Minska vänstermarginal
        textY += lineHeight
      })
      
      yPosition += reportBoxHeight + spacing.md // Minska section-avstånd
    } else {
      // Placeholder om ingen rapport finns
      yPosition = drawSectionHeader(pdf, 'SANERINGSRAPPORT', margins.left, yPosition, contentWidth, 'minimal')
      
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, 40, {
        backgroundColor: 'light',
        shadow: false
      })
      
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'italic')
      pdf.setTextColor(...beGoneColors.mediumGray)
      pdf.text('Ingen detaljerad rapport registrerad för detta ärende.', margins.left + spacing.md, yPosition + spacing.lg)
      
      yPosition += 40 + spacing.md // Minska section-avstånd
    }

    // === BEHANDLINGSMETODER OCH ÅTGÄRDER ===
    if (treatmentMethodField || followUpField) {
      // Sidbrytning om nödvändigt
      if (yPosition > pageHeight - 80) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      yPosition = drawSectionHeader(pdf, 'BEHANDLINGSMETODER & ÅTGÄRDER', margins.left, yPosition, contentWidth, 'primary')
      
      const treatmentCardHeight = 50
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, treatmentCardHeight, {
        backgroundColor: 'light',
        shadow: true
      })

      cardY = yPosition + cardPadding

      if (treatmentMethodField) {
        pdf.setFont(undefined, typography.label.weight)
        pdf.setTextColor(...beGoneColors.mediumGray)
        pdf.setFontSize(typography.label.size)
        pdf.text('BEHANDLINGSMETOD', leftCol, cardY)
        
        pdf.setFont(undefined, typography.body.weight)
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.text(getDropdownText(treatmentMethodField), leftCol, cardY + spacing.sm)
      }

      if (followUpField) {
        pdf.setFont(undefined, typography.label.weight)
        pdf.setTextColor(...beGoneColors.mediumGray)
        pdf.setFontSize(typography.label.size)
        pdf.text('UPPFÖLJNING', rightCol, cardY)
        
        pdf.setFont(undefined, typography.body.weight)
        pdf.setTextColor(...beGoneColors.darkGray)
        pdf.setFontSize(typography.body.size)
        pdf.text(getDropdownText(followUpField), rightCol, cardY + spacing.sm)
      }

      yPosition += treatmentCardHeight + spacing.md // Minska section-avstånd
    }

    // === EKONOMISK SAMMANFATTNING ===
    if (priceField && priceField.has_value) {
      // Sidbrytning om nödvändigt
      if (yPosition > pageHeight - 60) {
        pdf.addPage()
        yPosition = spacing.xl
      }
      
      yPosition = drawSectionHeader(pdf, 'EKONOMISK SAMMANFATTNING', margins.left, yPosition, contentWidth, 'accent')
      
      const costCardHeight = 35
      drawProfessionalCard(pdf, margins.left, yPosition, contentWidth, costCardHeight, {
        backgroundColor: 'white',
        shadow: true,
        borderWeight: 1.5
      })
      
      // Professional kostnadspresentation
      pdf.setTextColor(...beGoneColors.darkGray)
      pdf.setFontSize(typography.subheader.size)
      pdf.setFont(undefined, typography.subheader.weight)
      pdf.text('Totalkostnad för utförd sanering:', margins.left + spacing.md, yPosition + spacing.md)
      
      pdf.setTextColor(...beGoneColors.accent)
      pdf.setFontSize(18)
      pdf.setFont(undefined, 'bold')
      pdf.text(`${priceField.value} SEK`, contentWidth - margins.right, yPosition + spacing.lg, { align: 'right' })
      
      yPosition += costCardHeight + spacing.md // Minska section-avstånd
    }

    // === PROFESSIONAL FOOTER - endast på sista sidan ===
    const pageCount = pdf.internal.getNumberOfPages()
    const currentDate = new Date().toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    // Footer bara på sista sidan
    pdf.setPage(pageCount)
    
    // Professional footer separator
    pdf.setDrawColor(...beGoneColors.divider)
    pdf.setLineWidth(0.8)
    pdf.line(margins.left, pageHeight - 28, pageWidth - margins.right, pageHeight - 28)
    
    // Footer content med BeGone branding
    pdf.setTextColor(...beGoneColors.mediumGray)
    pdf.setFontSize(typography.caption.size)
    pdf.setFont(undefined, 'normal')
    
    // Vänster sida: Företagsinfo
    pdf.text('BeGone Skadedjur & Sanering AB', margins.left, pageHeight - 18)
    pdf.text('Org.nr: 559378-9208', margins.left, pageHeight - 12)
    
    // Mitten: Kontaktinfo
    const centerX = pageWidth / 2
    pdf.text('010 280 44 10', centerX, pageHeight - 18, { align: 'center' })
    pdf.text('info@begone.se', centerX, pageHeight - 12, { align: 'center' })
    
    // Höger sida: Datum och sidnummer
    pdf.text(`Genererad: ${currentDate}`, pageWidth - margins.right, pageHeight - 18, { align: 'right' })
    pdf.text(`Sida ${pageCount} av ${pageCount}`, pageWidth - margins.right, pageHeight - 12, { align: 'right' })

    // Professional filnamn för SANERINGSRAPPORT
    const customerName = customerInfo?.company_name || 'Okänd_kund'
    const taskId = taskDetails.task_id
    const fileDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Säker filnamnsformatering
    const cleanCustomerName = customerName
      .replace(/[^\w\s-åäöÅÄÖ]/g, '') // Behåll svenska tecken men ta bort specialtecken
      .replace(/\s+/g, '_')            // Ersätt mellanslag med underscore
      .substring(0, 25)                // Begränsa längd för filsystem
    
    const fileName = `Saneringsrapport_${taskId}_${cleanCustomerName}_${fileDate}.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Kunde inte generera PDF-rapport')
  }
}