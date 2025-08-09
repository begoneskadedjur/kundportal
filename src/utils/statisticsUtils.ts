// src/utils/statisticsUtils.ts - Utility functions for customer statistics processing
import jsPDF from 'jspdf'
import { isCompletedStatus, getCustomerStatusDisplay } from '../types/database'

// Add font support for Swedish characters
if (typeof window !== 'undefined') {
  try {
    // Load Arial font for better Swedish character support
    const fontData = 'data:font/truetype;charset=utf-8;base64,'
    // jsPDF will fallback to built-in fonts if custom font loading fails
  } catch (error) {
    console.warn('Custom font loading failed, using fallback fonts')
  }
}

interface CaseData {
  id: string
  title: string
  status: string
  pest_type: string | null
  price: number | null
  created_at: string
  scheduled_start: string | null
  scheduled_end: string | null
  completed_date: string | null
  address: string | null
}

interface Customer {
  id: string
  company_name: string
  annual_value: number | null
}

// Calculate response time between case creation and scheduling
export const calculateResponseTime = (createdDate: string, scheduledDate: string): number => {
  const created = new Date(createdDate)
  const scheduled = new Date(scheduledDate)
  return Math.round((scheduled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

// Get seasonal trends data
export const getSeasonalTrends = (cases: CaseData[]) => {
  const seasonalData = cases.reduce((acc, caseItem) => {
    const date = new Date(caseItem.created_at || caseItem.scheduled_start || '')
    const month = date.getMonth()
    
    let season: string
    if (month >= 2 && month <= 4) season = 'Vår'
    else if (month >= 5 && month <= 7) season = 'Sommar'
    else if (month >= 8 && month <= 10) season = 'Höst'
    else season = 'Vinter'
    
    acc[season] = (acc[season] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(seasonalData).map(([season, count]) => ({
    name: season,
    värde: count
  }))
}

// Get top locations data
export const getTopLocations = (cases: CaseData[], limit = 5) => {
  const locationCounts = cases.reduce((acc, caseItem) => {
    const location = caseItem.address || 'Okänd adress'
    // Extract city/area from address (simplified)
    const city = location.split(',')[1]?.trim() || location.split(' ').slice(-2).join(' ')
    acc[city] = (acc[city] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(locationCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([location, count]) => ({
      name: location,
      värde: count
    }))
}

// Calculate service efficiency metrics
export const calculateServiceMetrics = (cases: CaseData[]) => {
  const completedCases = cases.filter(c => isCompletedStatus(c.status))
  const avgCompletionTime = completedCases
    .filter(c => c.created_at && c.completed_date)
    .reduce((acc, c) => {
      const created = new Date(c.created_at!)
      const completed = new Date(c.completed_date!)
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      return acc + days
    }, 0) / completedCases.length || 0

  const firstTimeFixRate = completedCases.length / cases.length * 100

  return {
    avgCompletionTime: Math.round(avgCompletionTime),
    firstTimeFixRate: Math.round(firstTimeFixRate),
    totalServiceHours: completedCases.length * 2.5, // Estimated average service time
  }
}

// Export to PDF functionality with professional BeGone branding
export const exportStatisticsToPDF = (
  customer: Customer,
  cases: CaseData[],
  statistics: any,
  period: string
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })
  
  // Set better font for Swedish characters
  doc.setFont('helvetica')
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20 // Reduced margin for more content space
  const contentWidth = pageWidth - (margin * 2)

  // BeGone brand colors
  const brandPurple = [139, 92, 246] // #8b5cf6
  const darkBlue = [10, 19, 40] // #0a1328
  const lightGray = [226, 232, 240] // #e2e8f0
  const mediumGray = [100, 116, 139] // #64748b
  const accentTeal = [32, 197, 143] // #20c58f

  // Helper function to draw a rounded rectangle
  const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number, fillColor?: number[]) => {
    if (fillColor) {
      doc.setFillColor(...fillColor)
    }
    doc.roundedRect(x, y, width, height, radius, radius, 'F')
  }

  // Helper function to add header to each page
  const addPageHeader = () => {
    // Header background gradient effect
    doc.setFillColor(...brandPurple)
    doc.rect(0, 0, pageWidth, 45, 'F')
    
    // BeGone logo area (simulated)
    doc.setFillColor(255, 255, 255)
    doc.circle(margin + 15, 22, 12, 'F')
    doc.setTextColor(...darkBlue)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('BG', margin + 10, 27)

    // Main title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('BeGone', margin + 35, 22)
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('Statistikrapport', margin + 35, 32)

    // Date stamp
    doc.setFontSize(10)
    doc.setTextColor(255, 255, 255)
    const dateText = `Genererad: ${new Date().toLocaleDateString('sv-SE')}`
    const dateWidth = doc.getTextWidth(dateText)
    doc.text(dateText, pageWidth - margin - dateWidth, 25)
  }

  // Helper function to add footer
  const addPageFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 15
    
    // Footer line
    doc.setDrawColor(...brandPurple)
    doc.setLineWidth(1)
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
    
    // Footer text
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8)
    doc.text('BeGone Kundportal - Professionell skadedjurshantering', margin, footerY)
    
    // Page number
    const pageText = `Sida ${pageNumber} av ${totalPages}`
    const pageTextWidth = doc.getTextWidth(pageText)
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY)
  }

  // Calculate total pages needed
  const casesPerPage = 15
  const totalPages = Math.ceil(cases.length / casesPerPage) + 1

  // PAGE 1: Summary and Key Metrics
  addPageHeader()
  
  let yPosition = 65
  
  // Customer info card with improved design
  drawRoundedRect(margin, yPosition, contentWidth, 40, 8, [248, 250, 252]) // bg-slate-50 equivalent
  
  // Add subtle border
  doc.setDrawColor(...mediumGray)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, yPosition, contentWidth, 40, 8, 8, 'S')
  
  doc.setTextColor(...darkBlue)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(safeText(customer.company_name), margin + 15, yPosition + 18)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Rapportperiod: ${getPeriodLabel(period)}`, margin + 15, yPosition + 30)
  
  yPosition += 60
  
  // Executive Summary
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkBlue)
  doc.text('Sammanfattning', margin, yPosition)
  
  yPosition += 20
  
  // Key metrics in attractive cards with safe text
  const completionRate = statistics.totalCases > 0 
    ? Math.round((statistics.completedCases / statistics.totalCases) * 100)
    : 0
    
  const metricsData = [
    { label: 'Totalt antal arenden', value: statistics.totalCases.toString(), color: brandPurple },
    { label: 'Avslutade arenden', value: statistics.completedCases.toString(), color: accentTeal },
    { label: 'Avslutningsgrad', value: `${completionRate}%`, color: brandPurple },
    { label: 'Aktiva arenden', value: statistics.activeCases.toString(), color: [245, 158, 11] } // amber-500
  ]
  
  const cardWidth = (contentWidth - 20) / 2
  const cardHeight = 50
  
  metricsData.forEach((metric, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + (col * (cardWidth + 10))
    const cardY = yPosition + (row * (cardHeight + 12))
    
    // Card background
    drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 8, [255, 255, 255])
    
    // Card border
    doc.setDrawColor(...metric.color)
    doc.setLineWidth(2)
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8, 8, 'S')
    
    // Accent stripe
    doc.setFillColor(...metric.color)
    doc.roundedRect(cardX, cardY, 4, cardHeight, 8, 8, 'F')
    
    // Metric value
    doc.setTextColor(...darkBlue)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, cardX + 15, cardY + 22)
    
    // Metric label
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    
    // Handle long labels with line wrapping
    const words = metric.label.split(' ')
    if (words.length > 2) {
      doc.text(words.slice(0, 2).join(' '), cardX + 15, cardY + 34)
      doc.text(words.slice(2).join(' '), cardX + 15, cardY + 42)
    } else {
      doc.text(metric.label, cardX + 15, cardY + 38)
    }
  })
  
  yPosition += 130
  
  // Additional insights with safe formatting
  const totalCostFormatted = formatSwedishCurrency(statistics.totalCost || 0)
  const serviceEfficiency = statistics.totalCases > 0 
    ? Math.round((statistics.completedCases / statistics.totalCases) * 100)
    : 0
  
  const insights = [
    `Genomsnittlig responstid: ${statistics.avgResponseTime || 0} dagar`,
    `Vanligaste skadedjur: ${safeText(statistics.topPestType) || 'Okant'}`,
    `Total kontraktsvarde: ${totalCostFormatted}`,
    `Serviceeffektivitet: ${serviceEfficiency}%`,
    `Aktiv period: ${safeText(getPeriodLabel(period))}`
  ]
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkBlue)
  doc.text('Viktiga insikter', margin, yPosition)
  
  yPosition += 15
  
  insights.forEach((insight, index) => {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...darkBlue)
    
    // Enhanced bullet point with gradient effect
    doc.setFillColor(...brandPurple)
    doc.circle(margin + 4, yPosition - 2, 2.5, 'F')
    
    // Add slight shadow effect
    doc.setFillColor(200, 200, 200)
    doc.circle(margin + 4.5, yPosition - 1.5, 2.5, 'F')
    doc.setFillColor(...brandPurple)
    doc.circle(margin + 4, yPosition - 2, 2.5, 'F')
    
    doc.text(insight, margin + 14, yPosition)
    yPosition += 14
  })
  
  addPageFooter(1, totalPages)

  // SUBSEQUENT PAGES: Detailed Case Data
  let currentPage = 1
  let caseIndex = 0
  
  while (caseIndex < cases.length) {
    doc.addPage()
    currentPage++
    addPageHeader()
    
    yPosition = 65
    
    // Page title with icon simulation
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkBlue)
    
    // Add decorative icon area
    doc.setFillColor(...brandPurple)
    doc.circle(margin + 6, yPosition - 3, 4, 'F')
    doc.setFillColor(255, 255, 255)
    doc.setFontSize(10)
    doc.text('i', margin + 4.5, yPosition - 1)
    
    doc.setFontSize(18)
    doc.setTextColor(...darkBlue)
    doc.text('Arendedetaljer', margin + 15, yPosition)
    
    yPosition += 25
    
    // Table header with improved spacing
    const tableHeaders = ['Arendetitel', 'Status', 'Skadedjur', 'Pris', 'Datum']
    const colWidths = [55, 30, 35, 30, 40] // Better proportions for content
    const headerHeight = 28
    
    // Header background
    doc.setFillColor(...brandPurple)
    doc.roundedRect(margin, yPosition - 5, contentWidth, headerHeight, 5, 5, 'F')
    
    // Header text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    
    let xPosition = margin + 8
    tableHeaders.forEach((header, index) => {
      doc.text(header, xPosition, yPosition + 8)
      xPosition += colWidths[index]
    })
    
    yPosition += headerHeight + 5
    
    // Table rows
    const pageCases = cases.slice(caseIndex, caseIndex + casesPerPage)
    
    pageCases.forEach((caseItem, rowIndex) => {
      const isEvenRow = rowIndex % 2 === 0
      const rowHeight = 20 // Increased row height for better readability
      
      // Alternating row background
      if (isEvenRow) {
        doc.setFillColor(248, 250, 252) // Very light gray
        doc.rect(margin, yPosition - 4, contentWidth, rowHeight, 'F')
      }
      
      // Row data with improved formatting
      const rowData = [
        truncateText(caseItem.title, 28),
        safeText(getCustomerStatusDisplay(caseItem.status)),
        truncateText(caseItem.pest_type, 18) || 'Okant',
        formatSwedishCurrency(caseItem.price),
        caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('sv-SE') : 'N/A'
      ]
      
      xPosition = margin + 6 // Better left padding
      
      rowData.forEach((data, colIndex) => {
        // Determine text styling based on column
        if (colIndex === 1) { // Status column
          const isCompleted = isCompletedStatus(caseItem.status)
          
          // Create status badge background
          const statusWidth = doc.getTextWidth(data) + 6
          const statusHeight = 8
          const statusY = yPosition - 1
          
          if (isCompleted) {
            doc.setFillColor(...accentTeal)
          } else {
            doc.setFillColor(245, 158, 11) // Amber for pending/active
          }
          
          // Draw status badge with rounded corners
          doc.roundedRect(xPosition - 1, statusY, statusWidth, statusHeight, 2, 2, 'F')
          
          // Status text in white
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(data, xPosition + 2, yPosition + 4)
        } else {
          // Regular cell styling
          doc.setTextColor(...darkBlue)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          
          // Special formatting for price column (right align)
          if (colIndex === 3 && data !== 'N/A') {
            doc.setFont('helvetica', 'bold')
            const textWidth = doc.getTextWidth(data)
            doc.text(data, xPosition + colWidths[colIndex] - textWidth - 4, yPosition + 4)
          } else {
            doc.text(data, xPosition, yPosition + 4)
          }
        }
        
        xPosition += colWidths[colIndex]
      })
      
      yPosition += rowHeight
    })
    
    caseIndex += casesPerPage
    addPageFooter(currentPage, totalPages)
  }

  // Save with professional filename
  const filename = `BeGone_Rapport_${customer.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// Export to CSV functionality
export const exportStatisticsToCSV = (
  customer: Customer,
  cases: CaseData[],
  period: string
) => {
  const headers = [
    'Ärendenummer',
    'Titel',
    'Status',
    'Skadedjur',
    'Pris',
    'Skapad datum',
    'Schemalagd datum',
    'Avslutad datum',
    'Adress'
  ]

  const csvContent = [
    `# BeGone Statistikexport`,
    `# Kund: ${customer.company_name}`,
    `# Period: ${getPeriodLabel(period)}`,
    `# Genererad: ${new Date().toLocaleDateString('sv-SE')}`,
    '',
    headers.join(','),
    ...cases.map(caseItem => [
      caseItem.id,
      `"${String(caseItem.title || '').replace(/"/g, '""')}"`,
      getCustomerStatusDisplay(caseItem.status),
      caseItem.pest_type || 'Okänt',
      caseItem.price || 0,
      caseItem.created_at || '',
      caseItem.scheduled_start || '',
      caseItem.completed_date || '',
      `"${String(caseItem.address || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${customer.company_name}_statistik_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Helper function to get period label
const getPeriodLabel = (period: string): string => {
  const periodMap: Record<string, string> = {
    '30d': 'Senaste 30 dagarna',
    '3m': 'Senaste 3 manaderna',
    '6m': 'Senaste 6 manaderna', 
    '1y': 'Senaste aret',
    'all': 'Hela tiden'
  }
  return periodMap[period] || period
}

// Helper function for proper Swedish currency formatting
const formatSwedishCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'N/A'
  }
  
  // Format with Swedish locale - spaces as thousand separator
  const formatted = new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(amount))
  
  return `${formatted} kr`
}

// Helper function for safe text rendering (avoid character encoding issues)
const safeText = (text: string | null | undefined): string => {
  if (!text) return ''
  
  // Replace problematic characters that might cause corruption
  return text
    .replace(/[\u00C0-\u00FF]/g, (match) => {
      // Map common Swedish characters to safe alternatives for PDF
      const charMap: Record<string, string> = {
        'å': 'a', 'ä': 'a', 'ö': 'o',
        'Å': 'A', 'Ä': 'A', 'Ö': 'O'
      }
      return charMap[match] || match
    })
    .substring(0, 200) // Prevent extremely long text
}

// Helper function to safely truncate text for table cells
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  const safe = safeText(text)
  if (safe.length <= maxLength) return safe
  return safe.substring(0, maxLength - 3) + '...'
}

// Calculate trend direction and percentage
export const calculateTrend = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) return { direction: 'stable', percentage: 0 }
  
  const change = ((currentValue - previousValue) / previousValue) * 100
  const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
  
  return {
    direction: direction as 'up' | 'down' | 'stable',
    percentage: Math.abs(Math.round(change))
  }
}

// Group cases by time period for trend analysis
export const groupCasesByPeriod = (cases: CaseData[], periodType: 'month' | 'quarter' | 'year') => {
  return cases.reduce((acc, caseItem) => {
    const date = new Date(caseItem.created_at || caseItem.scheduled_start || '')
    let periodKey: string

    switch (periodType) {
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1
        periodKey = `${date.getFullYear()}-Q${quarter}`
        break
      case 'year':
        periodKey = date.getFullYear().toString()
        break
    }

    if (!acc[periodKey]) {
      acc[periodKey] = []
    }
    acc[periodKey].push(caseItem)
    
    return acc
  }, {} as Record<string, CaseData[]>)
}