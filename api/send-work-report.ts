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

    // Helper function för cards
    const drawCard = (x: number, y: number, width: number, height: number) => {
      pdf.setFillColor(...beGoneColors.white)
      pdf.roundedRect(x, y, width, height, 6, 6, 'F')
      pdf.setDrawColor(...beGoneColors.lightGray)
      pdf.setLineWidth(0.8)
      pdf.roundedRect(x, y, width, height, 6, 6, 'S')
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
    drawCard(margins.left, yPosition, contentWidth, customerCardHeight)
    
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
    drawCard(margins.left, yPosition, contentWidth, supplierCardHeight)
    
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

    // Lägg till arbetsinformation direkt i leverantörsuppgifter-kortet (kortare version)
    if (hasAssignee) {
      cardY += spacing.md
    }
    
    // Arbetsinformation som tillägg i leverantörskortet
    cardY += spacing.md
    pdf.setTextColor(100, 100, 100)
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'bold')
    pdf.text('ÄRENDE', leftCol, cardY)
    pdf.text('STATUS', rightCol, cardY)
    
    pdf.setTextColor(20, 20, 20)
    pdf.setFontSize(typography.body.size)
    pdf.setFont(undefined, 'normal')
    pdf.text(taskDetails.task_info.name, leftCol, cardY + spacing.sm)
    pdf.text(taskDetails.task_info.status, rightCol, cardY + spacing.sm)

    yPosition += supplierCardHeight + spacing.md + 20 // Extra plats för arbetsinformation

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
      // Använd contentWidth för box men maximal textbredd inom boxen
      const maxTextWidth = contentWidth - 10 // Bara 5px marginal på varje sida inom boxen
      const textLines = pdf.splitTextToSize(reportText, maxTextWidth)
      const lineHeight = 5.5
      const reportPadding = 5 // Minimal padding för maximal textbredd inom box
      const reportBoxHeight = Math.max(60, textLines.length * lineHeight + reportPadding * 2)
      
      // Rita card med samma bredd som andra sektioner
      drawCard(margins.left, yPosition, contentWidth, reportBoxHeight)
      
      pdf.setFontSize(typography.body.size)
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(20, 20, 20) // Säker mörk färg för email
      
      let textY = yPosition + reportPadding
      textLines.forEach((line: string) => {
        if (textY > pageHeight - 40) {
          pdf.addPage()
          textY = spacing.xl
        }
        pdf.text(line, margins.left + 5, textY) // Text 5px från boxens vänsterkant
        textY += lineHeight
      })
      
      yPosition += reportBoxHeight + spacing.md // Minska section-avstånd
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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📋 Saneringsrapport klar</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">BeGone Skadedjur & Sanering</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #f97316; margin-top: 0;">Hej ${technicianName}!</h2>
          
          <p>Här är saneringsrapporten för ditt genomförda arbete. Rapporten är genererad automatiskt och kan användas av kunden som intyg för försäkringsbolag eller arbetsgivare.</p>

          <div style="background-color: #fed7aa; border: 1px solid #f97316; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #f97316; margin: 0 0 15px 0;">📝 Ärendedetaljer</h3>
            <div style="background-color: white; padding: 15px; border-radius: 8px;">
              <p style="margin: 5px 0;"><strong>Ärende:</strong> ${taskDetails.task_info.name}</p>
              <p style="margin: 5px 0;"><strong>Ärende ID:</strong> ${taskDetails.task_id}</p>
              <p style="margin: 5px 0;"><strong>Kund:</strong> ${customerInfo.company_name}</p>
              <p style="margin: 5px 0;"><strong>Kontakt:</strong> ${customerInfo.contact_person}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${taskDetails.task_info.status}</p>
            </div>
          </div>

          <p>Saneringsrapporten är bifogad som PDF-fil och innehåller alla detaljer om det utförda arbetet enligt BeGone:s professionella standard.</p>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p><strong>Frågor om rapporten?</strong> Kontakta koordinatorn eller ring huvudkontoret.</p>
            <p>📧 <a href="mailto:teknik@begone.se" style="color: #f97316;">teknik@begone.se</a> | 📞 <a href="tel:010-280-44-10" style="color: #f97316;">010 280 44 10</a></p>
            <p style="margin-top: 20px;">
              Med vänliga hälsningar,<br>
              <strong>BeGone Koordination</strong> 🐛🚫
            </p>
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
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Saneringsrapport för ${customerInfo.company_name}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📋 Saneringsrapport</h1>
          <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">BeGone Skadedjur & Sanering</p>
        </div>

        <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #8b5cf6; margin-top: 0;">Hej ${contactName}!</h2>
          
          <p>BeGone har genomfört sanering/skadedjursbekämpning för <strong>${customerInfo.company_name}</strong>. Bifogad saneringsrapport kan användas som intyg för försäkringsbolag, myndigheter eller andra som behöver dokumentation av det utförda arbetet.</p>

          <div style="background-color: #ede9fe; border: 1px solid #8b5cf6; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #8b5cf6; margin: 0 0 15px 0;">📋 Sammanfattning</h3>
            <div style="background-color: white; padding: 15px; border-radius: 8px;">
              <p style="margin: 5px 0;"><strong>Ärende:</strong> ${taskDetails.task_info.name}</p>
              <p style="margin: 5px 0;"><strong>Ärende ID:</strong> ${taskDetails.task_id}</p>
              <p style="margin: 5px 0;"><strong>Företag:</strong> ${customerInfo.company_name}</p>
              <p style="margin: 5px 0;"><strong>Org.nummer:</strong> ${customerInfo.org_number}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${taskDetails.task_info.status}</p>
            </div>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0ea5e9; margin: 0 0 10px 0;">📄 Om saneringsrapporten</h3>
            <ul style="margin: 0; padding-left: 20px; color: #64748b;">
              <li>Professionell dokumentation av utfört arbete</li>
              <li>Kan användas för försäkringsärenden</li>
              <li>Godkänd som intyg för myndigheter</li>
              <li>Innehåller alla relevanta tekniska detaljer</li>
              <li>Signerad av ansvarig tekniker</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; font-size: 14px; color: #64748b;">
            <p><strong>Frågor om rapporten eller behöver du ytterligare dokumentation?</strong></p>
            <p>📧 <a href="mailto:info@begone.se" style="color: #8b5cf6;">info@begone.se</a> | 📞 <a href="tel:010-280-44-10" style="color: #8b5cf6;">010 280 44 10</a></p>
            <p style="margin-top: 20px;">
              Tack för förtroendet!<br>
              <strong>BeGone Skadedjur & Sanering AB</strong> 🐛🚫
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}