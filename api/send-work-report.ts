// api/send-work-report.ts - API för att skicka saneringsrapporter via email
import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import { jsPDF } from 'jspdf'
import * as fs from 'fs'
import * as path from 'path'

// Environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY!

interface TaskDetails {
  task_id: string;
  task_info: {
    name: string;
    status: string;
    description: string;
    created: string;
    updated: string;
  };
  assignees: Array<{
    name: string;
    email: string;
  }>;
  custom_fields: Array<{
    id: string;
    name: string;
    type: string;
    value: any;
    has_value: boolean;
    type_config?: {
      options?: Array<{
        id: string;
        name: string;
        color: string;
        orderindex: number;
      }>;
    };
  }>;
}

interface CustomerInfo {
  company_name: string;
  org_number: string;
  contact_person: string;
}

// Optimerad hjälpfunktion för textbredd-beräkning som kompenserar för jsPDF:s konservativa mätningar
const calculateOptimalTextWidth = (pdf: any, availableWidth: number, fontSize: number): number => {
  // Mycket konservativ för att undvika utstickande text
  const compensationFactor = fontSize <= 10 ? 1.02 : fontSize <= 12 ? 1.01 : 1.005
  
  // Ingen bonus för svenska tecken - håll det säkert
  const swedishCharBonus = 1.0
  
  return availableWidth * compensationFactor * swedishCharBonus
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== SEND WORK REPORT API START ===')
    
    const { 
      taskDetails, 
      customerInfo, 
      recipientType, 
      recipientEmail, 
      recipientName 
    }: {
      taskDetails: TaskDetails;
      customerInfo: CustomerInfo;
      recipientType: 'technician' | 'contact';
      recipientEmail: string;
      recipientName?: string;
    } = req.body

    console.log('Report request:', { 
      taskId: taskDetails.task_id, 
      recipientType, 
      recipientEmail, 
      recipientName 
    })

    // Validera inkommande data
    if (!taskDetails || !customerInfo || !recipientType || !recipientEmail) {
      return res.status(400).json({ 
        error: 'Alla fält är obligatoriska: taskDetails, customerInfo, recipientType, recipientEmail' 
      })
    }

    // Validera e-post format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({ error: 'Ogiltig e-postadress' })
    }

    // Generera PDF-rapport
    console.log('Generating PDF report...')
    const pdfBuffer = await generatePDFReportBuffer(taskDetails, customerInfo)

    // Skicka email med PDF bifogad
    console.log('Sending email with PDF attachment...')
    await sendReportEmail({
      recipientEmail,
      recipientName,
      recipientType,
      taskDetails,
      customerInfo,
      pdfBuffer
    })

    console.log('Report email sent successfully')
    return res.status(200).json({
      success: true,
      message: `Saneringsrapport skickad till ${recipientName || recipientEmail}`
    })

  } catch (error: any) {
    console.error('=== SEND WORK REPORT API ERROR ===')
    console.error('Error:', error)
    
    return res.status(500).json({
      error: error.message || 'Ett fel uppstod vid skickande av saneringsrapport'
    })
  }
}

// Generera PDF som buffer för email-bilaga
async function generatePDFReportBuffer(
  taskDetails: TaskDetails, 
  customerInfo: CustomerInfo
): Promise<Buffer> {
  try {
    // Importera PDF-genererings logik från pdfReportGenerator.ts
    // (Detta är en förenklad version för server-sidan utan DOM-beroenden)
    
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    
    // BeGone Professional Color Palette
    const beGoneColors = {
      primary: [10, 19, 40],        // BeGone Dark Blue
      accent: [32, 197, 143],       // BeGone Green
      white: [255, 255, 255],
      lightGray: [241, 245, 249],
      darkGray: [51, 65, 85],
      charcoal: [30, 41, 59]
    }
    
    const spacing = { sm: 6, md: 12, lg: 18, xl: 24, section: 28 }
    const typography = {
      title: { size: 20, weight: 'bold' },
      sectionHeader: { size: 16, weight: 'bold' },
      body: { size: 10, weight: 'normal' },
      caption: { size: 9, weight: 'normal' }
    }
    
    const margins = { left: spacing.lg, right: spacing.lg, top: spacing.xl, bottom: spacing.xl }
    const contentWidth = pageWidth - (margins.left + margins.right)
    let yPosition = 50 // Minska för mindre header (40px + lite utrymme)

    // === HEADER - bara bild, ingen text ===
    let headerSuccessful = false
    try {
      // Försök läsa header-bilden från public/images
      const imagePath = path.join(process.cwd(), 'public', 'images', 'begone-header.png')
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath)
        const base64Image = imageBuffer.toString('base64')
        const dataURL = `data:image/png;base64,${base64Image}`
        
        // Header-bild från toppen, full bredd, korrekt höjd
        const headerImageHeight = 40 // Minska höjden för att inte sträcka bilden
        
        // Positionera från absolut topp, full bredd
        pdf.addImage(dataURL, 'PNG', 0, 0, pageWidth, headerImageHeight)
        headerSuccessful = true
        console.log('Header image loaded successfully for email PDF')
      }
    } catch (error) {
      console.warn('Failed to load header image for email PDF, using minimal background:', error)
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

    // Metadata
    pdf.setTextColor(...beGoneColors.darkGray)
    pdf.setFontSize(typography.caption.size)
    pdf.setFont(undefined, 'normal')
    
    const reportDate = new Date().toLocaleDateString('sv-SE', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    pdf.text(`Rapport genererad: ${reportDate}`, pageWidth/2, yPosition, { align: 'center' })
    pdf.text(`Ärende ID: ${taskDetails.task_id}`, pageWidth/2, yPosition + spacing.sm, { align: 'center' })
    
    // Lägg till adress i metadata (hämta från custom fields)
    const addressField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'adress' && f.has_value
    )
    if (addressField) {
      const formattedAddress = formatAddress(addressField.value)
      pdf.text(`Adress: ${formattedAddress}`, pageWidth/2, yPosition + spacing.md, { align: 'center' })
    }
    
    yPosition += spacing.section

    // Helper function för section headers
    const drawSectionHeader = (text: string, y: number) => {
      pdf.setFillColor(...beGoneColors.charcoal)
      pdf.roundedRect(margins.left, y, contentWidth, 22, 4, 4, 'F')
      pdf.setTextColor(...beGoneColors.white)
      pdf.setFontSize(typography.sectionHeader.size)
      pdf.setFont(undefined, typography.sectionHeader.weight)
      pdf.text(text, pageWidth/2, y + 14, { align: 'center' })
      return y + 22 + spacing.sm
    }

    // Professional card system med subtle shadows och borders
    const drawCard = (x: number, y: number, width: number, height: number, options: {
      radius?: number
      shadow?: boolean
      borderWeight?: number
      backgroundColor?: 'light' | 'white'
    } = {}) => {
      const { radius = 6, shadow = true, borderWeight = 0.8, backgroundColor = 'white' } = options
      
      // Subtle drop shadow för depth
      if (shadow) {
        pdf.setFillColor(0, 0, 0, 0.08)
        pdf.roundedRect(x + 1.5, y + 1.5, width, height, radius, radius, 'F')
      }
      
      // Main card background
      const bgColor = backgroundColor === 'white' ? beGoneColors.white : [248, 250, 252] // lightestGray
      pdf.setFillColor(...bgColor)
      pdf.roundedRect(x, y, width, height, radius, radius, 'F')
      
      // Professional border
      pdf.setDrawColor(203, 213, 225) // border color
      pdf.setLineWidth(borderWeight)
      pdf.roundedRect(x, y, width, height, radius, radius, 'S')
    }

    // Kunduppgifter sektion
    yPosition = drawSectionHeader('KUNDUPPGIFTER', yPosition)
    
    // Avgör om det är privatperson eller företag baserat på case_type
    const orgNumber = customerInfo.org_number || ''
    const caseTypeField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'case_type' && f.has_value
    )
    const isCompany = caseTypeField?.value === 'business' || false
    
    const customerCardHeight = isCompany ? 65 : 55 // Minskad höjd för mindre tom yta
    drawCard(margins.left, yPosition, contentWidth, customerCardHeight, {
      backgroundColor: 'white',
      shadow: true
    })
    
    const leftCol = margins.left + spacing.md
    const rightCol = margins.left + (contentWidth/2) + spacing.sm
    let cardY = yPosition + spacing.md
    
    // Hämta telefon och email från custom fields
    const phoneField = taskDetails.custom_fields.find(f => 
      (f.name.toLowerCase() === 'telefon' || f.name.toLowerCase() === 'telefon_kontaktperson') && f.has_value
    )
    const emailField = taskDetails.custom_fields.find(f => 
      (f.name.toLowerCase() === 'email' || f.name.toLowerCase() === 'e_post_kontaktperson') && f.has_value
    )
    const phoneText = phoneField ? phoneField.value : '[Telefon ej angiven]'
    const emailText = emailField ? emailField.value : '[Email ej angiven]'

    if (isCompany) {
      // FÖRETAGSLAYOUT
      // Row 1: Företag och kontaktperson
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      pdf.text('UPPDRAGSGIVARE', leftCol, cardY)
      pdf.text('KONTAKTPERSON', rightCol, cardY)
      
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.text(customerInfo.company_name || '[Företagsnamn saknas]', leftCol, cardY + spacing.sm)
      pdf.text(customerInfo.contact_person || '[Kontaktperson saknas]', rightCol, cardY + spacing.sm)

      // Row 2: Org nr och telefon
      cardY += spacing.md // Korrekt avstånd mellan rader
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      pdf.text('ORG NR', leftCol, cardY)
      pdf.text('TELEFON', rightCol, cardY)
      
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.text(orgNumber || '[Org.nr saknas]', leftCol, cardY + spacing.sm)
      pdf.text(phoneText, rightCol, cardY + spacing.sm)

      // Row 3: Email
      cardY += spacing.md // Korrekt avstånd mellan rader
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      pdf.text('EMAIL', leftCol, cardY)
      
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.text(emailText, leftCol, cardY + spacing.sm)
      
    } else {
      // PRIVATPERSONLAYOUT  
      // Row 1: Namn och personnummer
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      pdf.text('UPPDRAGSGIVARE', leftCol, cardY)
      pdf.text('PERSONNUMMER', rightCol, cardY)
      
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.text(customerInfo.contact_person || '[Namn saknas]', leftCol, cardY + spacing.sm)
      pdf.text(orgNumber || '[Personnummer saknas]', rightCol, cardY + spacing.sm)

      // Row 2: Telefon och email
      cardY += spacing.md // Korrekt avstånd mellan rader
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      pdf.text('TELEFON', leftCol, cardY)
      pdf.text('EMAIL', rightCol, cardY)
      
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.text(phoneText, leftCol, cardY + spacing.sm)
      pdf.text(emailText, rightCol, cardY + spacing.sm)
    }

    // Row sist: Ärende ID (ensam rad)
    cardY += spacing.md // Korrekt avstånd mellan rader
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('ÄRENDE ID', leftCol, cardY)
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    pdf.text(taskDetails.task_id, leftCol, cardY + spacing.sm)

    yPosition += customerCardHeight + spacing.md // Minska section-avstånd

    // Leverantörsuppgifter sektion
    yPosition = drawSectionHeader('LEVERANTÖRSUPPGIFTER', yPosition)
    
    const hasAssignee = taskDetails.assignees.length > 0
    const supplierCardHeight = hasAssignee ? 85 : 70 // Minskad höjd för mindre tom yta
    drawCard(margins.left, yPosition, contentWidth, supplierCardHeight, {
      backgroundColor: 'white',
      shadow: true
    })
    
    cardY = yPosition + spacing.md
    
    // Använd säkrare färger för email-kompatibilitet
    pdf.setTextColor(100, 100, 100) // Grå för labels
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    
    pdf.text('FÖRETAG', leftCol, cardY)
    pdf.text('ORG.NUMMER', rightCol, cardY)
    
    // Mörk text för värden
    pdf.setTextColor(20, 20, 20) // Nästan svart för bästa kontrast
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    
    pdf.text('BeGone Skadedjur & Sanering AB', leftCol, cardY + spacing.sm)
    pdf.text('559378-9208', rightCol, cardY + spacing.sm)
    
    cardY += spacing.lg
    
    // Labels igen
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    
    pdf.text('BESÖKSADRESS', leftCol, cardY)
    pdf.text('TELEFON', rightCol, cardY)
    
    // Värden
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    
    pdf.text('Bläcksvampsvägen 17, 141 60 Huddinge', leftCol, cardY + spacing.sm)
    pdf.text('010 280 44 10', rightCol, cardY + spacing.sm)
    
    // Email på nästa rad
    cardY += spacing.md // Korrekt avstånd mellan rader
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('EMAIL', leftCol, cardY)
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    pdf.text('info@begone.se', leftCol, cardY + spacing.sm)

    // Ansvarig tekniker
    if (hasAssignee) {
      cardY += spacing.md // Korrekt avstånd mellan rader
      
      // Labels för tekniker
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      
      pdf.text('ANSVARIG TEKNIKER', leftCol, cardY)
      pdf.text('TEKNIKER KONTAKT', rightCol, cardY)
      
      // Tekniker värden
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      
      pdf.text(taskDetails.assignees[0].name, leftCol, cardY + spacing.sm)
      pdf.text(taskDetails.assignees[0].email, rightCol, cardY + spacing.sm)
    }

    yPosition += supplierCardHeight + spacing.md

    // Sidbrytning om nödvändigt
    if (yPosition > pageHeight - 140) {
      pdf.addPage()
      yPosition = spacing.xl
    }

    // === ARBETSINFORMATION SEKTION ===
    yPosition = drawSectionHeader('ARBETSINFORMATION', yPosition)

    const workCardHeight = 70 // Minskad höjd för mindre tom yta
    drawCard(margins.left, yPosition, contentWidth, workCardHeight, {
      backgroundColor: 'light',
      shadow: true
    })

    cardY = yPosition + spacing.md

    // Hämta relevanta fält
    const workAddressField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'adress' && f.has_value
    )
    const pestField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'skadedjur' && f.has_value
    )
    const workCaseTypeField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'ärende' && f.has_value
    )
    const startDateField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'start_date' && f.has_value
    )
    const priorityField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'prioritet' && f.has_value
    )

    // Rad 1: Datum och adress
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('DATUM FÖR UTFÖRANDE', leftCol, cardY)
    pdf.text('ARBETSPLATS', rightCol, cardY)
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    
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
      const createdDate = new Date(parseInt(taskDetails.task_info.created))
      if (!isNaN(createdDate.getTime())) {
        workDate = createdDate.toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit'
        })
      }
    }
    pdf.text(workDate, leftCol, cardY + spacing.sm)
    
    // Använd formatAddress för konsistent adresshantering
    const addressText = workAddressField ? formatAddress(workAddressField.value) : '[Adress ej angiven]'
    
    const maxAddressWidth = (contentWidth/2) - spacing.lg
    const addressLines = pdf.splitTextToSize(addressText, maxAddressWidth)
    pdf.text(addressLines.slice(0, 2), rightCol, cardY + spacing.sm)

    // Rad 2: Skadedjur och ärendetyp
    cardY += spacing.md
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('ÄRENDET AVSER', leftCol, cardY)
    if (workCaseTypeField) {
      pdf.text('TYP AV INSATS', rightCol, cardY)
    }
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    
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
    
    pdf.text(pestField ? getDropdownText(pestField) : 'Ej specificerat', leftCol, cardY + spacing.sm)
    if (workCaseTypeField) {
      pdf.text(getDropdownText(workCaseTypeField), rightCol, cardY + spacing.sm)
    }

    // Rad 3: Status och prioritet  
    cardY += spacing.md
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('ARBETSSTATUS', leftCol, cardY)
    if (priorityField) {
      pdf.text('PRIORITETSNIVÅ', rightCol, cardY)
    }
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    pdf.text(taskDetails.task_info.status || 'Okänd status', leftCol, cardY + spacing.sm)
    if (priorityField) {
      pdf.text(getDropdownText(priorityField), rightCol, cardY + spacing.sm)
    }

    yPosition += workCardHeight + spacing.md

    // Saneringsrapport sektion (om det finns rapport-data)
    const reportField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'rapport' && f.has_value
    )
    
    if (reportField && reportField.value) {
      if (yPosition > pageHeight - 100) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      yPosition = drawSectionHeader('DETALJERAD SANERINGSRAPPORT', yPosition)
      
      const reportText = reportField.value.toString()
      
      // OPTIMERAD TEXTBREDD-UTNYTTJANDE:
      // Problem: Balansera vänstermarginal med textbredd för centrerad layout
      // Lösning: Mindre padding men ännu mer konservativ textbredd
      const reportPadding = 5 // Mindre vänstermarginal
      const effectiveTextWidth = contentWidth - (reportPadding * 3) // Mer konservativ textbredd (5px vänster, 10px höger)
      
      // Sätt font först för korrekta mätningar
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, typography.body.weight)
      
      // Använd optimerad textbredd-beräkning
      const adjustedTextWidth = calculateOptimalTextWidth(pdf, effectiveTextWidth, typography.body.size)
      const textLines = pdf.splitTextToSize(reportText, adjustedTextWidth)
      const lineHeight = 5.8 // Något ökat radavstånd för bättre läsbarhet
      const reportBoxHeight = Math.max(60, textLines.length * lineHeight + reportPadding * 2)
      
      // Rita card med samma bredd som andra sektioner
      // Rita card med samma bredd som andra sektioner
      drawCard(margins.left, yPosition, contentWidth, reportBoxHeight, {
        backgroundColor: 'white',
        shadow: true,
        borderWeight: 1.2
      })
      
      // Rapport innehåll med professionell formatering (font redan satt)
      pdf.setTextColor(20, 20, 20) // Säker mörk färg för email
      
      let textY = yPosition + reportPadding
      textLines.forEach((line: string) => {
        if (textY > pageHeight - 40) {
          pdf.addPage()
          textY = spacing.xl
        }
        pdf.text(line, margins.left + reportPadding, textY) // Text med korrekt padding från boxkant
        textY += lineHeight
      })
      
      yPosition += reportBoxHeight + spacing.md
    } else {
      // Placeholder om ingen rapport finns
      yPosition = drawSectionHeader('SANERINGSRAPPORT', yPosition)
      
      drawCard(margins.left, yPosition, contentWidth, 40, {
        backgroundColor: 'light',
        shadow: false
      })
      
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'italic')
      pdf.setTextColor(100, 100, 100) // mediumGray
      pdf.text('Ingen detaljerad rapport registrerad för detta ärende.', margins.left + spacing.md, yPosition + spacing.lg)
      
      yPosition += 40 + spacing.md
    }

    // === BEHANDLINGSMETODER OCH ÅTGÄRDER ===
    const treatmentMethodField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'behandlingsmetod' && f.has_value
    )
    const followUpField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'uppföljning' && f.has_value
    )
    
    if (treatmentMethodField || followUpField) {
      // Sidbrytning om nödvändigt
      if (yPosition > pageHeight - 80) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      yPosition = drawSectionHeader('BEHANDLINGSMETODER & ÅTGÄRDER', yPosition)
      
      const treatmentCardHeight = 50
      drawCard(margins.left, yPosition, contentWidth, treatmentCardHeight, {
        backgroundColor: 'light',
        shadow: true
      })

      cardY = yPosition + spacing.md

      if (treatmentMethodField) {
        pdf.setTextColor(100, 100, 100)
        pdf.setFontSize(8)
        pdf.setFont(undefined, 'bold')
        pdf.text('BEHANDLINGSMETOD', leftCol, cardY)
        
        pdf.setTextColor(20, 20, 20)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'normal')
        pdf.text(getDropdownText(treatmentMethodField), leftCol, cardY + spacing.sm)
      }

      if (followUpField) {
        pdf.setTextColor(100, 100, 100)
        pdf.setFontSize(8)
        pdf.setFont(undefined, 'bold')
        pdf.text('UPPFÖLJNING', rightCol, cardY)
        
        pdf.setTextColor(20, 20, 20)
        pdf.setFontSize(typography.body.size)
        pdf.setFont(undefined, 'normal')
        pdf.text(getDropdownText(followUpField), rightCol, cardY + spacing.sm)
      }

      yPosition += treatmentCardHeight + spacing.md
    }

    // === EKONOMISK SAMMANFATTNING ===
    const priceField = taskDetails.custom_fields.find(f => 
      f.name.toLowerCase() === 'pris' && f.has_value
    )
    
    if (priceField && priceField.has_value) {
      // Sidbrytning om nödvändigt
      if (yPosition > pageHeight - 60) {
        pdf.addPage()
        yPosition = spacing.xl
      }
      
      yPosition = drawSectionHeader('EKONOMISK SAMMANFATTNING', yPosition)
      
      const costCardHeight = 35
      drawCard(margins.left, yPosition, contentWidth, costCardHeight, {
        backgroundColor: 'white',
        shadow: true,
        borderWeight: 1.5
      })
      
      // Professional kostnadspresentation
      pdf.setTextColor(20, 20, 20)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'bold')
      pdf.text('Totalkostnad för utförd sanering:', margins.left + spacing.md, yPosition + spacing.md)
      
      pdf.setTextColor(...beGoneColors.accent)
      pdf.setFontSize(18)
      pdf.setFont(undefined, 'bold')
      pdf.text(`${priceField.value} SEK`, contentWidth - margins.right, yPosition + spacing.lg, { align: 'right' })
      
      yPosition += costCardHeight + spacing.md
    }

    // Footer - bara på sista sidan med säkra färger
    const pageCount = pdf.internal.getNumberOfPages()
    const currentDate = new Date().toLocaleDateString('sv-SE', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    })
    
    // Footer bara på sista sidan
    pdf.setPage(pageCount)
    
    // Footer separator
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.8)
    pdf.line(margins.left, pageHeight - 28, pageWidth - margins.right, pageHeight - 28)
    
    // Footer content med säkra färger
    pdf.setTextColor(100, 100, 100) // Grå text för bättre email-kompatibilitet
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

    // Konvertera PDF till buffer
    const pdfArrayBuffer = pdf.output('arraybuffer')
    return Buffer.from(pdfArrayBuffer)

  } catch (error) {
    console.error('Error generating PDF buffer:', error)
    throw new Error('Kunde inte generera PDF-rapport')
  }
}

// Skicka email med PDF bifogad
async function sendReportEmail({
  recipientEmail,
  recipientName,
  recipientType,
  taskDetails,
  customerInfo,
  pdfBuffer
}: {
  recipientEmail: string;
  recipientName?: string;
  recipientType: 'technician' | 'contact';
  taskDetails: TaskDetails;
  customerInfo: CustomerInfo;
  pdfBuffer: Buffer;
}) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: RESEND_API_KEY
    }
  })

  const recipientDisplayName = recipientName || recipientEmail
  const isForTechnician = recipientType === 'technician'
  
  // Olika email-innehåll beroende på mottagare
  const emailHtml = isForTechnician 
    ? getTechnicianEmailTemplate(recipientDisplayName, taskDetails, customerInfo)
    : getContactEmailTemplate(recipientDisplayName, taskDetails, customerInfo)

  const subject = isForTechnician 
    ? `📋 Saneringsrapport - ${taskDetails.task_info.name} (${taskDetails.task_id})`
    : `📋 Saneringsrapport för ${customerInfo.company_name} (${taskDetails.task_id})`

  // Säker filnamnsformatering
  const customerName = customerInfo.company_name
    .replace(/[^\w\s-åäöÅÄÖ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 25)
  
  const reportDate = new Date().toISOString().split('T')[0]
  const fileName = `Saneringsrapport_${taskDetails.task_id}_${customerName}_${reportDate}.pdf`

  const mailOptions = {
    from: 'BeGone Saneringsrapporter <noreply@begone.se>',
    to: recipientEmail,
    subject: subject,
    html: emailHtml,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  }

  await transporter.sendMail(mailOptions)
  console.log(`Report email sent to ${recipientType}:`, recipientEmail)
}

function getTechnicianEmailTemplate(
  technicianName: string, 
  taskDetails: TaskDetails, 
  customerInfo: CustomerInfo
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Saneringsrapport - ${taskDetails.task_info.name}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0a1328, #1e293b); color: white; padding: 32px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Saneringsrapport klar</h1>
            <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 500;">BeGone Skadedjur & Sanering AB</p>
          </div>

          <!-- Content -->
          <div style="padding: 32px 30px;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Bästa ${technicianName},</h2>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px;">
              Vi bekräftar härmed att saneringsrapporten för ditt genomförda uppdrag har genererats och är redo för leverans till kunden. Rapporten följer våra professionella standarder och innehåller all nödvändig dokumentation.
            </p>

            <!-- Case Details Card -->
            <div style="background-color: #f1f5f9; border-left: 4px solid #20c58f; padding: 24px; margin: 24px 0; border-radius: 8px;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Ärendesammanfattning</h3>
              <div style="background-color: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Ärende: </span>
                    <span style="color: #1e293b; text-align: right; max-width: 300px;">${taskDetails.task_info.name}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Ärende ID: </span>
                    <span style="color: #1e293b; font-family: monospace;">${taskDetails.task_id}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Kund: </span>
                    <span style="color: #1e293b; text-align: right; max-width: 300px;">${customerInfo.company_name}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Kontaktperson: </span>
                    <span style="color: #1e293b; text-align: right; max-width: 300px;">${customerInfo.contact_person}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="font-weight: 500; color: #64748b;">Status: </span>
                    <span style="color: #20c58f; font-weight: 500;">${taskDetails.task_info.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <p style="margin: 24px 0; color: #475569; font-size: 16px;">
              Den bifogade PDF-rapporten innehåller all teknisk dokumentation och kan överlämnas direkt till kunden. Rapporten uppfyller branschstandarder för professionell skadedjursbekämpning och sanering.
            </p>

            <!-- Support Section -->
            <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 32px 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Support och kontakt</h3>
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
                För frågor om rapporten eller teknisk support, kontakta vårt koordinationsteam.
              </p>
              <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                <a href="mailto:teknik@begone.se" style="color: #20c58f; text-decoration: none; font-weight: 500; font-size: 14px;">
                  ✉ teknik@begone.se
                </a>
                <a href="tel:010-280-44-10" style="color: #20c58f; text-decoration: none; font-weight: 500; font-size: 14px;">
                  ✆ 010 280 44 10
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 32px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                Med vänliga hälsningar,<br>
                <strong style="color: #1e293b;">BeGone Koordinationsteam</strong><br>
                <span style="font-size: 13px; color: #94a3b8;">BeGone Skadedjur & Sanering AB</span>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

function getContactEmailTemplate(
  contactName: string, 
  taskDetails: TaskDetails, 
  customerInfo: CustomerInfo
): string {
  // Hämta ansvarig tekniker
  const assignedTechnician = taskDetails.assignees.length > 0 ? taskDetails.assignees[0] : null
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Saneringsrapport för ${customerInfo.company_name}</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0a1328, #1e293b); color: white; padding: 32px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.025em;">Saneringsrapport</h1>
            <p style="margin: 12px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 500;">BeGone Skadedjur & Sanering AB</p>
          </div>

          <!-- Content -->
          <div style="padding: 32px 30px;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Bästa ${contactName},</h2>
            
            <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px;">
              Vi bekräftar härmed att BeGone Skadedjur & Sanering AB har slutfört ärendet för <strong>${customerInfo.company_name}</strong>. 
              Bifogad saneringsrapport utgör fullständig dokumentation av det utförda arbetet.
            </p>

            <p style="margin: 0 0 32px 0; color: #475569; font-size: 16px;">
              Vi tackar för möjligheten att få utföra denna tjänst åt er och hoppas att resultatet motsvarar era förväntningar.
            </p>

            <!-- Case Summary Card -->
            <div style="background-color: #f1f5f9; border-left: 4px solid #20c58f; padding: 24px; margin: 24px 0; border-radius: 8px;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Uppdragssammanfattning</h3>
              <div style="background-color: white; padding: 20px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Ärende: </span>
                    <span style="color: #1e293b; text-align: right; max-width: 350px;">${taskDetails.task_info.name}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Referensnummer: </span>
                    <span style="color: #1e293b; font-family: monospace; font-size: 14px;">${taskDetails.task_id}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">Kund: </span>
                    <span style="color: #1e293b; text-align: right; max-width: 350px;">${customerInfo.company_name}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 500; color: #64748b;">${taskDetails.custom_fields.find(f => f.name.toLowerCase() === 'case_type')?.value === 'private' ? 'Personnummer: ' : 'Organisationsnummer: '}</span>
                    <span style="color: #1e293b; font-family: monospace;">${customerInfo.org_number}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span style="font-weight: 500; color: #64748b;">Status: </span>
                    <span style="color: #20c58f; font-weight: 500;">${taskDetails.task_info.status}</span>
                  </div>
                </div>
              </div>
            </div>

            ${assignedTechnician ? `
            <!-- Technician Information -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 24px; margin: 24px 0; border-radius: 8px;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Ansvarig tekniker</h3>
              <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                  <span style="font-weight: 500; color: #64748b;">Tekniker: </span>
                  <span style="color: #1e293b; font-weight: 500;">${assignedTechnician.name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
                  <span style="font-weight: 500; color: #64748b;">Certifiering: </span>
                  <span style="color: #1e293b;">Auktoriserad skadedjurstekniker</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                  <span style="font-weight: 500; color: #64748b;">Kontakt: </span>
                  <a href="mailto:${assignedTechnician.email}" style="color: #20c58f; text-decoration: none; font-weight: 500;">${assignedTechnician.email}</a>
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Report Information -->
            <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; padding: 24px; border-radius: 8px; margin: 24px 0;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Om rapporten</h3>
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
                Den bifogade rapporten innehåller fullständig dokumentation av det utförda arbetet enligt branschstandarder för professionell skadedjursbekämpning och sanering.
              </p>
              <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 14px;">
                <li style="margin: 6px 0;">Teknisk dokumentation av genomförda åtgärder</li>
                <li style="margin: 6px 0;">Detaljerad beskrivning av behandlingsmetoder</li>
                <li style="margin: 6px 0;">Professionell kvalitetssäkring och signering</li>
                <li style="margin: 6px 0;">Uppfyller branschkrav för dokumentation</li>
              </ul>
            </div>

            <!-- Contact Information -->
            <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 32px 0; border: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">Kontakt och support</h3>
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
                För frågor om rapporten eller framtida tjänster, tveka inte att kontakta oss.
              </p>
              <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                <a href="mailto:info@begone.se" style="color: #20c58f; text-decoration: none; font-weight: 500; font-size: 14px;">
                  ✉ info@begone.se
                </a>
                <a href="tel:010-280-44-10" style="color: #20c58f; text-decoration: none; font-weight: 500; font-size: 14px;">
                  ✆ 010 280 44 10
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
                Vi tackar för förtroendet och står till er tjänst för framtida behov.
              </p>
              <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">
                BeGone Skadedjur & Sanering AB
              </p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">
                Org.nr: 559378-9208 | Bläcksvampsvägen 17, 141 60 Huddinge
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}