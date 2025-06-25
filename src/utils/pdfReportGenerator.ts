// src/utils/pdfReportGenerator.ts - Separat PDF-generator
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
  return new Date(parseInt(timestamp)).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Hjälpfunktion för att hitta custom field
const getFieldValue = (taskDetails: TaskDetails, fieldName: string) => {
  return taskDetails.custom_fields.find(field => 
    field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
  )
}

export const generatePDFReport = async (taskDetails: TaskDetails): Promise<void> => {
  try {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height
    let yPosition = 25

    // FÄRGER (BeGone varumärke)
    const primaryColor = [34, 68, 102] // Mörk blå
    const accentColor = [52, 168, 83]  // Grön
    const lightGray = [240, 240, 240]
    const darkGray = [80, 80, 80]

    // Hämta custom fields
    const addressField = getFieldValue(taskDetails, 'adress')
    const pestField = getFieldValue(taskDetails, 'skadedjur')
    const caseTypeField = getFieldValue(taskDetails, 'ärende')
    const priceField = getFieldValue(taskDetails, 'pris')
    const reportField = getFieldValue(taskDetails, 'rapport')

    // HEADER MED BEGONE BRANDING
    pdf.setFillColor(...primaryColor)
    pdf.rect(0, 0, pageWidth, 40, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(24)
    pdf.setFont(undefined, 'bold')
    pdf.text('BeGone', 20, 25)
    
    pdf.setFontSize(28)
    pdf.setFont(undefined, 'bold')
    pdf.text('SANERINGSRAPPORT', pageWidth/2, 25, { align: 'center' })
    
    yPosition = 60

    // ADRESS SEKTION
    if (addressField) {
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'italic')
      pdf.text(addressField.value.formatted_address, pageWidth/2, yPosition, { align: 'center' })
      yPosition += 20
    }

    // KUNDUPPGIFTER SEKTION
    yPosition += 10
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...darkGray)
    pdf.text('Kunduppgifter', 20, yPosition)
    yPosition += 10

    // Kunduppgifter box - FIXAD HÖJD
    const customerBoxHeight = 35
    pdf.setFillColor(...lightGray)
    pdf.rect(20, yPosition, pageWidth - 40, customerBoxHeight, 'F')
    pdf.setDrawColor(200, 200, 200)
    pdf.rect(20, yPosition, pageWidth - 40, customerBoxHeight, 'S')

    // Kunduppgifter innehåll (säker positionering)
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    
    const leftCol = 25
    const rightCol = pageWidth/2 + 10
    let boxY = yPosition + 8

    pdf.setFont(undefined, 'bold')
    pdf.text('Uppdragsgivare', leftCol, boxY)
    pdf.text('Kontaktperson', rightCol, boxY)
    
    pdf.setFont(undefined, 'normal')
    pdf.text('[Kundnamn]', leftCol, boxY + 6)
    pdf.text('[Kontaktperson]', rightCol, boxY + 6)

    pdf.setFont(undefined, 'bold')
    pdf.text('Ärende ID', leftCol, boxY + 15)
    pdf.text('Status', rightCol, boxY + 15)
    
    pdf.setFont(undefined, 'normal')
    pdf.text(taskDetails.task_id, leftCol, boxY + 21)
    pdf.text(taskDetails.task_info.status, rightCol, boxY + 21)

    yPosition += customerBoxHeight + 15

    // LEVERANTÖRSUPPGIFTER SEKTION
    pdf.setFontSize(16)
    pdf.setFont(undefined, 'bold')
    pdf.setTextColor(...darkGray)
    pdf.text('Leverantörsuppgifter', 20, yPosition)
    yPosition += 10

    // Leverantör box - FIXAD HÖJD
    const supplierBoxHeight = 50
    pdf.setFillColor(...lightGray)
    pdf.rect(20, yPosition, pageWidth - 40, supplierBoxHeight, 'F')
    pdf.setDrawColor(200, 200, 200)
    pdf.rect(20, yPosition, pageWidth - 40, supplierBoxHeight, 'S')

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

    // KONTROLL: Är vi nära sidslut? Lägg till ny sida
    if (yPosition > pageHeight - 100) {
      pdf.addPage()
      yPosition = 30
    }

    // ARBETSINFORMATION SEKTION (med grön header)
    pdf.setFillColor(...accentColor)
    pdf.rect(20, yPosition, pageWidth - 40, 15, 'F')
    
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(18)
    pdf.setFont(undefined, 'bold')
    pdf.text('ARBETSINFORMATION', pageWidth/2, yPosition + 10, { align: 'center' })
    
    yPosition += 25

    // Arbetsinformation box - FIXAD HÖJD
    const workBoxHeight = 40
    pdf.setFillColor(...lightGray)
    pdf.rect(20, yPosition, pageWidth - 40, workBoxHeight, 'F')
    pdf.setDrawColor(200, 200, 200)
    pdf.rect(20, yPosition, pageWidth - 40, workBoxHeight, 'S')

    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(10)
    boxY = yPosition + 8

    pdf.setFont(undefined, 'bold')
    pdf.text('Datum för utförande', leftCol, boxY)
    pdf.text('Utförande adress', rightCol, boxY)
    pdf.setFont(undefined, 'normal')
    pdf.text(formatDate(taskDetails.task_info.created).split(' ')[0], leftCol, boxY + 6)
    if (addressField) {
      // Begränsa adress-text till att passa i boxen
      const addressText = addressField.value.formatted_address
      const maxWidth = (pageWidth/2) - 30
      const addressLines = pdf.splitTextToSize(addressText, maxWidth)
      pdf.text(addressLines.slice(0, 2), rightCol, boxY + 6) // Max 2 rader
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

    // SANERINGSRAPPORT SEKTION (huvudinnehåll)
    if (reportField && reportField.value) {
      // Kontroll: Är vi nära sidslut?
      if (yPosition > pageHeight - 60) {
        pdf.addPage()
        yPosition = 30
      }

      pdf.setFontSize(16)
      pdf.setFont(undefined, 'bold')
      pdf.setTextColor(...darkGray)
      pdf.text('Saneringsrapport', 20, yPosition)
      yPosition += 15
      
      // Rapport innehåll
      pdf.setFontSize(10)
      pdf.setFont(undefined, 'normal')
      pdf.setTextColor(0, 0, 0)
      
      const reportText = reportField.value.toString()
      const lines = pdf.splitTextToSize(reportText, pageWidth - 40)
      
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage()
          yPosition = 30
        }
        pdf.text(line, 20, yPosition)
        yPosition += 5 // Mindre radavstånd för bättre utnyttjande
      })
      yPosition += 15
    }

    // KOSTNAD (om finns) - Grön box
    if (priceField && priceField.has_value) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = 30
      }
      
      pdf.setFillColor(...accentColor)
      pdf.rect(20, yPosition, pageWidth - 40, 20, 'F')
      
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text(`Kostnad: ${priceField.value} kr`, pageWidth/2, yPosition + 12, { align: 'center' })
    }

    // FOOTER på alla sidor (UTAN ONEFLOW)
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
      pdf.text(`BeGone AB - ${new Date().toLocaleDateString('sv-SE')}`, 20, pageHeight - 10)
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