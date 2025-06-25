// src/utils/pdfReportGenerator.ts - Förbättrad version
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

// Hjälpfunktion för att formatera datum KORREKT
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

// Hjälpfunktion för rundade hörn (simulerat med flera rektanglar)
const drawRoundedRect = (
  pdf: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  radius: number,
  style: 'S' | 'F' | 'FD' = 'F'
) => {
  // jsPDF stöder inte rundade hörn direkt, så vi skapar en approximation
  // genom att rita huvudrektangeln och små rektanglar i hörnen
  
  // Huvudrektangel
  pdf.rect(x + radius, y, width - 2 * radius, height, style)
  pdf.rect(x, y + radius, width, height - 2 * radius, style)
  
  // Små rektanglar för att "runda" hörnen (ger en mjukare look)
  if (radius > 0) {
    pdf.rect(x + radius, y, width - 2 * radius, radius, style)
    pdf.rect(x + radius, y + height - radius, width - 2 * radius, radius, style)
  }
}

export const generatePDFReport = async (
  taskDetails: TaskDetails, 
  customerInfo?: CustomerInfo
): Promise<void> => {
  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    let yPosition = 25

    // FÄRGER (BeGone varumärke)
    const primaryColor = [34, 68, 102] // Mörk blå
    const accentColor = [52, 168, 83]  // Grön
    const lightGray = [245, 245, 245]  // Ljusare grå för bättre kontrast
    const darkGray = [60, 60, 60]     // Mörkare grå för bättre läsbarhet

    // Hämta custom fields
    const addressField = getFieldValue(taskDetails, 'adress')
    const pestField = getFieldValue(taskDetails, 'skadedjur')
    const caseTypeField = getFieldValue(taskDetails, 'ärende')
    const priceField = getFieldValue(taskDetails, 'pris')
    const reportField = getFieldValue(taskDetails, 'rapport')

    // === HEADER MED BEGONE LOGOTYP ===
    pdf.setFillColor(...primaryColor)
    pdf.rect(0, 0, pageWidth, 45, 'F')
    
    // === HEADER MED BEGONE LOGOTYP ===
    pdf.setFillColor(...primaryColor)
    pdf.rect(0, 0, pageWidth, 45, 'F')
    
    // === HEADER MED BEGONE LOGOTYP ===
    pdf.setFillColor(...primaryColor)
    pdf.rect(0, 0, pageWidth, 45, 'F')
    
    // Försök lägga till header-bilden från public/images mappen
    try {
      // Ladda bilden från public mappen (i webbläsaren blir detta /images/begone-header.png)
      const logoPath = '/images/begone-header.png'
      
      // Ladda bilden och lägg till i PDF
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            // Skapa en canvas för att konvertera bilden till base64
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.width = img.width
            canvas.height = img.height
            ctx?.drawImage(img, 0, 0)
            
            const dataURL = canvas.toDataURL('image/png')
            
            // Beräkna storlek och position för att fylla hela header-området
            const headerHeight = 40  // Lite mindre än hela header-området (45px)
            const aspectRatio = img.width / img.height
            const headerWidth = headerHeight * aspectRatio
            
            // Centrera bilden både horisontellt och vertikalt
            const centerX = (pageWidth - headerWidth) / 2
            const centerY = (45 - headerHeight) / 2 + 2 // +2 för lite padding från toppen
            
            // Lägg till header-bilden (ersätter ALL text)
            pdf.addImage(dataURL, 'PNG', centerX, centerY, headerWidth, headerHeight)
            
            resolve(true)
          } catch (error) {
            reject(error)
          }
        }
        
        img.onerror = () => reject(new Error('Kunde inte ladda header-bild'))
        img.src = logoPath
      })
      
    } catch (error) {
      console.warn('Kunde inte ladda header-bild, använder text istället:', error)
      
      // Fallback till centrerad text-baserad header
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(26)
      pdf.setFont(undefined, 'bold')
      pdf.text('BeGone', pageWidth/2, 20, { align: 'center' })
      
      // Subtitel under BeGone (också centrerad)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'normal')
      pdf.text('SKADEDJUR & SANERING AB', pageWidth/2, 28, { align: 'center' })
      
      // Huvudrubrik
      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.text('SANERINGSRAPPORT', pageWidth/2, 36, { align: 'center' })
    }
    
    // Huvudrubrik
    pdf.setFontSize(24)
    pdf.setFont(undefined, 'bold')
    pdf.text('SANERINGSRAPPORT', pageWidth/2, 28, { align: 'center' })
    
    yPosition = 65

    // ADRESS SEKTION
    if (addressField) {
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'italic')
      pdf.text(addressField.value.formatted_address, pageWidth/2, yPosition, { align: 'center' })
      yPosition += 20
    }

    // === KUNDUPPGIFTER SEKTION ===
    yPosition += 5
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...darkGray)
    pdf.text('Kunduppgifter', 20, yPosition)
    yPosition += 10

    // Rundad kunduppgifter box
    const customerBoxHeight = 35
    pdf.setFillColor(...lightGray)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, customerBoxHeight, 3, 'F')
    pdf.setDrawColor(200, 200, 200)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, customerBoxHeight, 3, 'S')

    // Kunduppgifter innehåll
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    
    const leftCol = 25
    const rightCol = pageWidth/2 + 10
    let boxY = yPosition + 8

    pdf.setFont(undefined, 'bold')
    pdf.text('Uppdragsgivare', leftCol, boxY)
    pdf.text('Kontaktperson', rightCol, boxY)
    
    pdf.setFont(undefined, 'normal')
    // Använd kundinfo från databasen om tillgänglig
    pdf.text(customerInfo?.company_name || '[Kundnamn]', leftCol, boxY + 6)
    pdf.text(customerInfo?.contact_person || '[Kontaktperson]', rightCol, boxY + 6)

    pdf.setFont(undefined, 'bold')
    pdf.text('Ärende ID', leftCol, boxY + 15)
    pdf.text('Org nummer', rightCol, boxY + 15)
    
    pdf.setFont(undefined, 'normal')
    pdf.text(taskDetails.task_id, leftCol, boxY + 21)
    pdf.text(customerInfo?.org_number || '[Org nummer]', rightCol, boxY + 21)

    yPosition += customerBoxHeight + 15

    // === LEVERANTÖRSUPPGIFTER SEKTION ===
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...darkGray)
    pdf.text('Leverantörsuppgifter', 20, yPosition)
    yPosition += 10

    // Rundad leverantör box
    const supplierBoxHeight = 50
    pdf.setFillColor(...lightGray)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, supplierBoxHeight, 3, 'F')
    pdf.setDrawColor(200, 200, 200)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, supplierBoxHeight, 3, 'S')

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    boxY = yPosition + 8

    pdf.setFont(undefined, 'bold')
    pdf.text('Företag', leftCol, boxY)
    pdf.text('Org nr', rightCol, boxY)
    pdf.setFont(undefined, 'normal')
    pdf.text('BeGone Skadedjur & Sanering AB', leftCol, boxY + 6)
    pdf.text('559378-9208', rightCol, boxY + 6)

    pdf.setFont(undefined, 'bold')
    pdf.text('Adress', leftCol, boxY + 15)
    pdf.text('Telefonnummer', rightCol, boxY + 15)
    pdf.setFont(undefined, 'normal')
    pdf.text('Kavlevägen 45, 141 59 Huddinge', leftCol, boxY + 21)
    pdf.text('010 280 44 10', rightCol, boxY + 21)

    // Ansvarig tekniker
    if (taskDetails.assignees.length > 0) {
      pdf.setFont(undefined, 'bold')
      pdf.text('Ansvarig tekniker', leftCol, boxY + 30)
      pdf.text('E-post tekniker', rightCol, boxY + 30)
      pdf.setFont(undefined, 'normal')
      pdf.text(taskDetails.assignees[0].name, leftCol, boxY + 36)
      pdf.text(taskDetails.assignees[0].email, rightCol, boxY + 36)
    }

    yPosition += supplierBoxHeight + 15

    // Kontroll: Ny sida om nödvändigt
    if (yPosition > pageHeight - 100) {
      pdf.addPage()
      yPosition = 30
    }

    // === ARBETSINFORMATION SEKTION ===
    pdf.setFillColor(...accentColor)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, 15, 3, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.text('ARBETSINFORMATION', pageWidth/2, yPosition + 10, { align: 'center' })
    
    yPosition += 25

    // Rundad arbetsinformation box
    const workBoxHeight = 40
    pdf.setFillColor(...lightGray)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, workBoxHeight, 3, 'F')
    pdf.setDrawColor(200, 200, 200)
    drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, workBoxHeight, 3, 'S')

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    boxY = yPosition + 8

    pdf.setFont(undefined, 'bold')
    pdf.text('Datum för utförande', leftCol, boxY)
    pdf.text('Utförande adress', rightCol, boxY)
    pdf.setFont(undefined, 'normal')
    // FIXAT: Använd den korrekta formatDate funktionen
    pdf.text(formatDate(taskDetails.task_info.created), leftCol, boxY + 6)
    if (addressField) {
      const addressText = addressField.value.formatted_address
      const maxWidth = (pageWidth/2) - 30
      const addressLines = pdf.splitTextToSize(addressText, maxWidth)
      pdf.text(addressLines.slice(0, 2), rightCol, boxY + 6)
    }

    pdf.setFont(undefined, 'bold')
    pdf.text('Skadedjur', leftCol, boxY + 20)
    if (caseTypeField) {
      pdf.text('Typ av ärende', rightCol, boxY + 20)
    }
    pdf.setFont(undefined, 'normal')
    pdf.text(pestField ? getDropdownText(pestField) : 'Ej specificerat', leftCol, boxY + 26)
    if (caseTypeField) {
      pdf.text(getDropdownText(caseTypeField), rightCol, boxY + 26)
    }

    yPosition += workBoxHeight + 20

    // === SANERINGSRAPPORT SEKTION ===
    if (reportField && reportField.value) {
      if (yPosition > pageHeight - 60) {
        pdf.addPage()
        yPosition = 30
      }

      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.setTextColor(...darkGray)
      pdf.text('Saneringsrapport', 20, yPosition)
      yPosition += 15
      
      // Rundad rapport-box
      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(0, 0, 0)
      
      const reportText = reportField.value.toString()
      const lines = pdf.splitTextToSize(reportText, pageWidth - 50)
      
      // Beräkna boxhöjd baserat på antal rader
      const lineHeight = 5
      const reportBoxHeight = Math.max(30, lines.length * lineHeight + 15)
      
      // Rita rundad bakgrund för rapporten
      pdf.setFillColor(...lightGray)
      drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, reportBoxHeight, 3, 'F')
      pdf.setDrawColor(200, 200, 200)
      drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, reportBoxHeight, 3, 'S')
      
      // Skriv rapport-text med padding
      let textY = yPosition + 10
      lines.forEach((line: string) => {
        if (textY > pageHeight - 30) {
          pdf.addPage()
          textY = 30
        }
        pdf.text(line, 25, textY)
        textY += lineHeight
      })
      
      yPosition += reportBoxHeight + 20
    }

    // === KOSTNAD ===
    if (priceField && priceField.has_value) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = 30
      }
      
      pdf.setFillColor(...accentColor)
      drawRoundedRect(pdf, 20, yPosition, pageWidth - 40, 20, 3, 'F')
      
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text(`Kostnad: ${priceField.value} kr`, pageWidth/2, yPosition + 12, { align: 'center' })
    }

    // === FOOTER på alla sidor ===
    const pageCount = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      
      // Footer linje
      pdf.setDrawColor(...primaryColor)
      pdf.setLineWidth(1)
      pdf.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20)
      
      pdf.setTextColor(...darkGray)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'normal')
      pdf.text(`BeGone Skadedjur & Sanering AB - ${new Date().toLocaleDateString('sv-SE')}`, 20, pageHeight - 10)
      pdf.text(`010 280 44 10 | info@begone.se`, pageWidth - 20, pageHeight - 10, { align: 'right' })
      pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - 20, pageHeight - 5, { align: 'right' })
    }

    // Ladda ner PDF
    const fileName = `BeGone_Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Kunde inte generera PDF-rapport')
  }
}