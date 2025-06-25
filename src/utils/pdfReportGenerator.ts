// src/utils/pdfReportGenerator.ts - Modern design version
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

// Modern färgpallett
const modernColors = {
  primary: [15, 23, 42],       // Slate-900 
  accent: [34, 197, 94],       // Emerald-500
  lightGray: [248, 250, 252],  // Slate-50
  mediumGray: [241, 245, 249], // Slate-100
  darkGray: [51, 65, 85],      // Slate-700
  border: [226, 232, 240],     // Slate-200
  textMuted: [100, 116, 139]   // Slate-500
}

// Modern spacing system
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
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

// Modern rundade rektanglar med shadows
const drawModernCard = (
  pdf: jsPDF, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  radius: number = 8
) => {
  // Subtle shadow effect
  pdf.setFillColor(0, 0, 0, 0.05)
  pdf.roundedRect(x + 1, y + 1, width, height, radius, radius, 'F')
  
  // Main card
  pdf.setFillColor(...modernColors.lightGray)
  pdf.roundedRect(x, y, width, height, radius, radius, 'F')
  
  // Border
  pdf.setDrawColor(...modernColors.border)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(x, y, width, height, radius, radius, 'S')
}

// Modern header med gradient-effekt
const drawModernHeader = (pdf: jsPDF, pageWidth: number) => {
  // Gradient bakgrund (simulerad med flera lager)
  for (let i = 0; i < 50; i++) {
    const alpha = 1 - (i / 50) * 0.3
    const color = modernColors.primary.map(c => Math.min(255, c + i))
    pdf.setFillColor(color[0], color[1], color[2])
    pdf.rect(0, i, pageWidth, 1, 'F')
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
    let yPosition = 60

    // Hämta custom fields
    const addressField = getFieldValue(taskDetails, 'adress')
    const pestField = getFieldValue(taskDetails, 'skadedjur')
    const caseTypeField = getFieldValue(taskDetails, 'ärende')
    const priceField = getFieldValue(taskDetails, 'pris')
    const reportField = getFieldValue(taskDetails, 'rapport')

    // === MODERN HEADER ===
    drawModernHeader(pdf, pageWidth)
    
    let headerSuccessful = false
    
    // Försök ladda header-bild
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
            
            // Beräkna optimal storlek för header-bilden
            const maxHeaderHeight = 35
            const aspectRatio = img.width / img.height
            const headerWidth = maxHeaderHeight * aspectRatio
            
            // Centrera bilden
            const centerX = (pageWidth - headerWidth) / 2
            const centerY = (50 - maxHeaderHeight) / 2 + 5
            
            pdf.addImage(dataURL, 'PNG', centerX, centerY, headerWidth, maxHeaderHeight)
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
      console.warn('Header image failed, using styled text fallback')
      headerSuccessful = false
    }
    
    // Elegant text fallback om bild misslyckas
    if (!headerSuccessful) {
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(22)
      pdf.setFont(undefined, 'bold')
      pdf.text('BeGone', pageWidth/2, 20, { align: 'center' })
      
      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.text('SKADEDJUR & SANERING AB', pageWidth/2, 28, { align: 'center' })
      
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text('SANERINGSRAPPORT', pageWidth/2, 38, { align: 'center' })
    }

    // === ADRESS SEKTION ===
    if (addressField) {
      pdf.setTextColor(...modernColors.textMuted)
      pdf.setFontSize(11)
      pdf.setFont(undefined, 'italic')
      pdf.text(addressField.value.formatted_address, pageWidth/2, yPosition, { align: 'center' })
      yPosition += spacing.lg
    }

    // === KUNDUPPGIFTER SEKTION ===
    yPosition += spacing.sm
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.text('Kunduppgifter', spacing.lg, yPosition)
    yPosition += spacing.md

    // Modern kunduppgifter card
    const customerBoxHeight = 42
    drawModernCard(pdf, spacing.lg, yPosition, pageWidth - (spacing.lg * 2), customerBoxHeight)

    // Kunduppgifter innehåll med bättre typografi
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(9)
    
    const leftCol = spacing.lg + spacing.sm
    const rightCol = pageWidth/2 + spacing.sm
    let boxY = yPosition + spacing.sm

    // Labels med modern styling
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.text('UPPDRAGSGIVARE', leftCol, boxY)
    pdf.text('KONTAKTPERSON', rightCol, boxY)
    
    // Values
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text(customerInfo?.company_name || '[Kundnamn]', leftCol, boxY + spacing.sm)
    pdf.text(customerInfo?.contact_person || '[Kontaktperson]', rightCol, boxY + spacing.sm)

    // Second row
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.setFontSize(9)
    pdf.text('ÄRENDE ID', leftCol, boxY + spacing.lg)
    pdf.text('ORG NUMMER', rightCol, boxY + spacing.lg)
    
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text(taskDetails.task_id, leftCol, boxY + spacing.lg + spacing.sm)
    pdf.text(customerInfo?.org_number || '[Org nummer]', rightCol, boxY + spacing.lg + spacing.sm)

    yPosition += customerBoxHeight + spacing.lg

    // === LEVERANTÖRSUPPGIFTER SEKTION ===
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.text('Leverantörsuppgifter', spacing.lg, yPosition)
    yPosition += spacing.md

    const supplierBoxHeight = 58
    drawModernCard(pdf, spacing.lg, yPosition, pageWidth - (spacing.lg * 2), supplierBoxHeight)

    boxY = yPosition + spacing.sm

    // Leverantör info med clean typography
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.setFontSize(9)
    pdf.text('FÖRETAG', leftCol, boxY)
    pdf.text('ORG NR', rightCol, boxY)
    
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text('BeGone Skadedjur & Sanering AB', leftCol, boxY + spacing.sm)
    pdf.text('559378-9208', rightCol, boxY + spacing.sm)

    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.setFontSize(9)
    pdf.text('ADRESS', leftCol, boxY + spacing.lg)
    pdf.text('TELEFONNUMMER', rightCol, boxY + spacing.lg)
    
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text('Kavlevägen 45, 141 59 Huddinge', leftCol, boxY + spacing.lg + spacing.sm)
    pdf.text('010 280 44 10', rightCol, boxY + spacing.lg + spacing.sm)

    // Ansvarig tekniker
    if (taskDetails.assignees.length > 0) {
      pdf.setFont(undefined, 'bold')
      pdf.setTextColor(...modernColors.textMuted)
      pdf.setFontSize(9)
      pdf.text('ANSVARIG TEKNIKER', leftCol, boxY + spacing.xl)
      pdf.text('E-POST TEKNIKER', rightCol, boxY + spacing.xl)
      
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(...modernColors.darkGray)
      pdf.setFontSize(10)
      pdf.text(taskDetails.assignees[0].name, leftCol, boxY + spacing.xl + spacing.sm)
      pdf.text(taskDetails.assignees[0].email, rightCol, boxY + spacing.xl + spacing.sm)
    }

    yPosition += supplierBoxHeight + spacing.lg

    // Ny sida check
    if (yPosition > pageHeight - 120) {
      pdf.addPage()
      yPosition = spacing.xl
    }

    // === ARBETSINFORMATION SEKTION ===
    // Modern accent header
    pdf.setFillColor(...modernColors.accent)
    pdf.roundedRect(spacing.lg, yPosition, pageWidth - (spacing.lg * 2), 20, 6, 6, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(14)
    pdf.setFont(undefined, 'bold')
    pdf.text('ARBETSINFORMATION', pageWidth/2, yPosition + 13, { align: 'center' })
    
    yPosition += 30

    const workBoxHeight = 48
    drawModernCard(pdf, spacing.lg, yPosition, pageWidth - (spacing.lg * 2), workBoxHeight)

    boxY = yPosition + spacing.sm

    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.setFontSize(9)
    pdf.text('DATUM FÖR UTFÖRANDE', leftCol, boxY)
    pdf.text('UTFÖRANDE ADRESS', rightCol, boxY)
    
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text(formatDate(taskDetails.task_info.created), leftCol, boxY + spacing.sm)
    
    if (addressField) {
      const addressText = addressField.value.formatted_address
      const maxWidth = (pageWidth/2) - spacing.xl
      const addressLines = pdf.splitTextToSize(addressText, maxWidth)
      pdf.text(addressLines.slice(0, 2), rightCol, boxY + spacing.sm)
    }

    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...modernColors.textMuted)
    pdf.setFontSize(9)
    pdf.text('SKADEDJUR', leftCol, boxY + spacing.lg + spacing.xs)
    if (caseTypeField) {
      pdf.text('TYP AV ÄRENDE', rightCol, boxY + spacing.lg + spacing.xs)
    }
    
    pdf.setFont(undefined, 'normal')
    pdf.setTextColor(...modernColors.darkGray)
    pdf.setFontSize(10)
    pdf.text(pestField ? getDropdownText(pestField) : 'Ej specificerat', leftCol, boxY + spacing.lg + spacing.md)
    if (caseTypeField) {
      pdf.text(getDropdownText(caseTypeField), rightCol, boxY + spacing.lg + spacing.md)
    }

    yPosition += workBoxHeight + spacing.lg

    // === SANERINGSRAPPORT SEKTION ===
    if (reportField && reportField.value) {
      if (yPosition > pageHeight - 80) {
        pdf.addPage()
        yPosition = spacing.xl
      }

      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.setTextColor(...modernColors.darkGray)
      pdf.text('Saneringsrapport', spacing.lg, yPosition)
      yPosition += spacing.md
      
      const reportText = reportField.value.toString()
      const lines = pdf.splitTextToSize(reportText, pageWidth - (spacing.lg * 3))
      
      const lineHeight = 6
      const reportBoxHeight = Math.max(40, lines.length * lineHeight + spacing.lg)
      
      drawModernCard(pdf, spacing.lg, yPosition, pageWidth - (spacing.lg * 2), reportBoxHeight)
      
      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(...modernColors.darkGray)
      
      let textY = yPosition + spacing.md
      lines.forEach((line: string) => {
        if (textY > pageHeight - 30) {
          pdf.addPage()
          textY = spacing.xl
        }
        pdf.text(line, spacing.lg + spacing.sm, textY)
        textY += lineHeight
      })
      
      yPosition += reportBoxHeight + spacing.lg
    }

    // === KOSTNAD ===
    if (priceField && priceField.has_value) {
      if (yPosition > pageHeight - 50) {
        pdf.addPage()
        yPosition = spacing.xl
      }
      
      pdf.setFillColor(...modernColors.accent)
      pdf.roundedRect(spacing.lg, yPosition, pageWidth - (spacing.lg * 2), 24, 8, 8, 'F')
      
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.text(`Kostnad: ${priceField.value} kr`, pageWidth/2, yPosition + 15, { align: 'center' })
    }

    // === MODERN FOOTER ===
    const pageCount = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      
      // Clean footer line
      pdf.setDrawColor(...modernColors.border)
      pdf.setLineWidth(1)
      pdf.line(spacing.lg, pageHeight - 25, pageWidth - spacing.lg, pageHeight - 25)
      
      pdf.setTextColor(...modernColors.textMuted)
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'normal')
      pdf.text(`BeGone Skadedjur & Sanering AB • ${new Date().toLocaleDateString('sv-SE')}`, spacing.lg, pageHeight - 15)
      pdf.text(`010 280 44 10 • info@begone.se`, pageWidth - spacing.lg, pageHeight - 15, { align: 'right' })
      pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - spacing.lg, pageHeight - 8, { align: 'right' })
    }

    // Ladda ner PDF med tidsstämpel
    const fileName = `BeGone_Saneringsrapport_${taskDetails.task_id}_${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Kunde inte generera PDF-rapport')
  }
}