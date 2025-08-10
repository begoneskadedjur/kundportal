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

  // BeGone brand colors (enhanced palette)
  const brandPurple = [139, 92, 246] // #8b5cf6
  const darkBlue = [10, 19, 40] // #0a1328
  const lightGray = [226, 232, 240] // #e2e8f0
  const mediumGray = [100, 116, 139] // #64748b
  const accentTeal = [32, 197, 143] // #20c58f
  const softPurple = [168, 142, 255] // Lighter purple for gradients
  const warmGray = [248, 250, 252] // Very light background
  const successGreen = [34, 197, 94] // Green for positive metrics
  const warningAmber = [245, 158, 11] // Amber for attention items

  // Helper function to draw a rounded rectangle with optional shadow
  const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number, fillColor?: number[], withShadow = false) => {
    if (withShadow) {
      // Draw subtle shadow
      doc.setFillColor(220, 220, 220)
      doc.roundedRect(x + 1, y + 1, width, height, radius, radius, 'F')
    }
    
    if (fillColor) {
      doc.setFillColor(...fillColor)
    }
    doc.roundedRect(x, y, width, height, radius, radius, 'F')
  }

  // Helper function to add premium header to each page
  const addPageHeader = () => {
    // Premium header background with subtle gradient
    doc.setFillColor(...brandPurple)
    doc.rect(0, 0, pageWidth, 50, 'F')
    
    // Add gradient overlay effect
    doc.setFillColor(...softPurple)
    doc.rect(0, 0, pageWidth, 25, 'F')
    
    // Enhanced BeGone logo area with professional styling
    doc.setFillColor(255, 255, 255)
    doc.circle(margin + 18, 25, 15, 'F')
    
    // Logo shadow effect
    doc.setFillColor(0, 0, 0, 0.1)
    doc.circle(margin + 19, 26, 15, 'F')
    doc.setFillColor(255, 255, 255)
    doc.circle(margin + 18, 25, 15, 'F')
    
    // BeGone logo text with better styling
    doc.setTextColor(...brandPurple)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('BG', margin + 12, 30)
    
    // Add decorative elements around logo
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(2)
    doc.circle(margin + 18, 25, 15, 'S')

    // Main title with enhanced typography
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('BeGone', margin + 42, 25)
    
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.text('Statistikrapport', margin + 42, 35)
    
    // Tagline
    doc.setFontSize(10)
    doc.setTextColor(220, 220, 220)
    doc.text('Professionell skadedjurshantering', margin + 42, 43)

    // Date stamp with better formatting
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'normal')
    const dateText = `Genererad: ${new Date().toLocaleDateString('sv-SE')}`
    const dateWidth = doc.getTextWidth(dateText)
    doc.text(dateText, pageWidth - margin - dateWidth, 28)
    
    // Add decorative line under header
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(3)
    doc.line(0, 50, pageWidth, 50)
  }

  // Helper function to add premium footer
  const addPageFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 18
    
    // Premium footer background
    doc.setFillColor(...warmGray)
    doc.rect(0, footerY - 8, pageWidth, 25, 'F')
    
    // Footer accent line
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(2)
    doc.line(0, footerY - 8, pageWidth, footerY - 8)
    
    // Enhanced footer text
    doc.setTextColor(...mediumGray)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('BeGone Kundportal • Professionell skadedjurshantering', margin, footerY)
    
    // Contact info
    doc.setFontSize(8)
    doc.setTextColor(...mediumGray)
    doc.text('www.begone.se • info@begone.se', margin, footerY + 8)
    
    // Page number with better styling
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...brandPurple)
    const pageText = `Sida ${pageNumber} av ${totalPages}`
    const pageTextWidth = doc.getTextWidth(pageText)
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY + 4)
  }

  // Calculate total pages needed with better pagination
  const casesPerPage = 12 // Reduced for better readability with enhanced spacing
  const totalPages = Math.ceil(cases.length / casesPerPage) + 1

  // PAGE 1: Executive Summary and Key Metrics
  addPageHeader()
  
  let yPosition = 75 // More space after enhanced header
  
  // Customer info card with premium design
  drawRoundedRect(margin, yPosition, contentWidth, 45, 10, warmGray, true) // With shadow
  
  // Add gradient-like border effect
  doc.setDrawColor(...accentTeal)
  doc.setLineWidth(2)
  doc.roundedRect(margin, yPosition, contentWidth, 45, 10, 10, 'S')
  
  // Top accent stripe
  doc.setFillColor(...accentTeal)
  doc.roundedRect(margin, yPosition, contentWidth, 4, 10, 10, 'F')
  
  doc.setTextColor(...darkBlue)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(customer.company_name, margin + 15, yPosition + 22)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Rapportperiod: ${getPeriodLabel(period)}`, margin + 15, yPosition + 35)
  
  yPosition += 65
  
  // Executive Summary with icon
  doc.setFillColor(...accentTeal)
  doc.circle(margin + 6, yPosition - 2, 4, 'F')
  doc.setFillColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('✓', margin + 4.5, yPosition + 0.5) // Checkmark icon
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkBlue)
  doc.text('Sammanfattning', margin + 15, yPosition)
  
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
    
    // Card background with shadow
    drawRoundedRect(cardX, cardY, cardWidth, cardHeight, 10, [255, 255, 255], true)
    
    // Card border with gradient effect
    doc.setDrawColor(...metric.color)
    doc.setLineWidth(1.5)
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10, 10, 'S')
    
    // Top accent stripe (full width)
    doc.setFillColor(...metric.color)
    doc.roundedRect(cardX, cardY, cardWidth, 5, 10, 10, 'F')
    
    // Side accent stripe
    doc.roundedRect(cardX, cardY + 5, 4, cardHeight - 5, 0, 0, 'F')
    
    // Metric value with better positioning
    doc.setTextColor(...darkBlue)
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, cardX + 15, cardY + 25)
    
    // Metric label with improved formatting
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    
    // Handle long labels with better line wrapping
    const words = metric.label.split(' ')
    if (words.length > 2) {
      doc.text(words.slice(0, 2).join(' '), cardX + 15, cardY + 37)
      doc.text(words.slice(2).join(' '), cardX + 15, cardY + 45)
    } else {
      doc.text(metric.label, cardX + 15, cardY + 41)
    }
  })
  
  yPosition += 140
  
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
  
  // Enhanced insights section with cards
  const insightsPerRow = 2
  const insightCardWidth = (contentWidth - 15) / insightsPerRow
  const insightCardHeight = 35
  
  insights.forEach((insight, index) => {
    const col = index % insightsPerRow
    const row = Math.floor(index / insightsPerRow)
    const cardX = margin + (col * (insightCardWidth + 15))
    const cardY = yPosition + (row * (insightCardHeight + 10))
    
    // Insight card background with subtle gradient effect
    doc.setFillColor(255, 255, 255)
    drawRoundedRect(cardX, cardY, insightCardWidth, insightCardHeight, 6, [255, 255, 255])
    
    // Card border with brand accent
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(1)
    doc.roundedRect(cardX, cardY, insightCardWidth, insightCardHeight, 6, 6, 'S')
    
    // Left accent bar
    doc.setFillColor(...accentTeal)
    doc.roundedRect(cardX, cardY, 3, insightCardHeight, 6, 6, 'F')
    
    // Icon placeholder (decorative circle)
    doc.setFillColor(...brandPurple)
    doc.circle(cardX + 12, cardY + 12, 4, 'F')
    doc.setFillColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('i', cardX + 10.5, cardY + 14)
    
    // Insight text with better formatting
    doc.setTextColor(...darkBlue)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Split insight into title and value for better formatting
    const parts = insight.split(': ')
    if (parts.length === 2) {
      // Title
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...mediumGray)
      doc.text(parts[0], cardX + 22, cardY + 12)
      
      // Value
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...darkBlue)
      doc.setFontSize(11)
      doc.text(parts[1], cardX + 22, cardY + 24)
    } else {
      // Single line fallback
      const words = insight.split(' ')
      if (words.length > 4) {
        doc.text(words.slice(0, 4).join(' '), cardX + 22, cardY + 12)
        doc.text(words.slice(4).join(' '), cardX + 22, cardY + 22)
      } else {
        doc.text(insight, cardX + 22, cardY + 17)
      }
    }
  })
  
  // Update yPosition to account for insight cards
  const totalRows = Math.ceil(insights.length / insightsPerRow)
  yPosition += (totalRows * (insightCardHeight + 10)) + 5
  
  addPageFooter(1, totalPages)

  // SUBSEQUENT PAGES: Detailed Case Data
  let currentPage = 1
  let caseIndex = 0
  
  while (caseIndex < cases.length) {
    doc.addPage()
    currentPage++
    addPageHeader()
    
    yPosition = 75 // Consistent with first page
    
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
    
    // Enhanced header background
    doc.setFillColor(...brandPurple)
    doc.roundedRect(margin, yPosition - 5, contentWidth, headerHeight, 8, 8, 'F')
    
    // Gradient overlay
    doc.setFillColor(...softPurple)
    doc.roundedRect(margin, yPosition - 5, contentWidth, headerHeight/2, 8, 8, 'F')
    
    // Enhanced header text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    let xPosition = margin + 10
    tableHeaders.forEach((header, index) => {
      if (index === 3) { // Price column - right align
        const headerWidth = doc.getTextWidth(header)
        doc.text(header, xPosition + colWidths[index] - headerWidth - 4, yPosition + 10)
      } else {
        doc.text(header, xPosition, yPosition + 10)
      }
      xPosition += colWidths[index]
    })
    
    yPosition += headerHeight + 5
    
    // Table rows with enhanced styling
    const pageCases = cases.slice(caseIndex, caseIndex + casesPerPage)
    
    pageCases.forEach((caseItem, rowIndex) => {
      const isEvenRow = rowIndex % 2 === 0
      const rowHeight = 22 // Increased row height for better readability
      
      // Enhanced alternating row background
      if (isEvenRow) {
        doc.setFillColor(...warmGray) // Very light gray
        doc.roundedRect(margin, yPosition - 4, contentWidth, rowHeight, 3, 3, 'F')
      }
      
      // Add subtle row separator
      if (rowIndex > 0) {
        doc.setDrawColor(...lightGray)
        doc.setLineWidth(0.3)
        doc.line(margin + 5, yPosition - 4, pageWidth - margin - 5, yPosition - 4)
      }
      
      // Row data with improved formatting and proper Swedish characters
      const rowData = [
        truncateText(caseItem.title, 32), // More space for titles
        getCustomerStatusDisplay(caseItem.status),
        truncateText(caseItem.pest_type, 20) || 'Okänt',
        formatSwedishCurrency(caseItem.price),
        caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('sv-SE') : '—'
      ]
      
      xPosition = margin + 10 // Consistent padding
      
      rowData.forEach((data, colIndex) => {
        // Determine text styling based on column
        if (colIndex === 1) { // Status column
          const isCompleted = isCompletedStatus(caseItem.status)
          
          // Create enhanced status badge
          const statusWidth = doc.getTextWidth(data) + 10
          const statusHeight = 12
          const statusY = yPosition - 3
          
          // Choose colors based on status
          if (isCompleted) {
            doc.setFillColor(...successGreen)
          } else if (caseItem.status.toLowerCase().includes('bokad')) {
            doc.setFillColor(...warningAmber)
          } else if (caseItem.status.toLowerCase().includes('pågående')) {
            doc.setFillColor(59, 130, 246) // Blue for in progress
          } else {
            doc.setFillColor(...mediumGray)
          }
          
          // Badge shadow
          doc.setFillColor(0, 0, 0, 0.15)
          doc.roundedRect(xPosition + 1, statusY + 1, statusWidth, statusHeight, 5, 5, 'F')
          
          // Main badge
          if (isCompleted) {
            doc.setFillColor(...successGreen)
          } else if (caseItem.status.toLowerCase().includes('bokad')) {
            doc.setFillColor(...warningAmber)
          } else if (caseItem.status.toLowerCase().includes('pågående')) {
            doc.setFillColor(59, 130, 246)
          } else {
            doc.setFillColor(...mediumGray)
          }
          
          doc.roundedRect(xPosition, statusY, statusWidth, statusHeight, 5, 5, 'F')
          
          // Status text with better positioning
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(data, xPosition + 5, yPosition + 3)
        } else {
          // Enhanced cell styling
          doc.setTextColor(...darkBlue)
          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          
          // Special formatting for price column (right align)
          if (colIndex === 3) {
            doc.setFont('helvetica', 'bold')
            if (data !== '—' && data !== 'N/A') {
              const textWidth = doc.getTextWidth(data)
              doc.text(data, xPosition + colWidths[colIndex] - textWidth - 4, yPosition + 5)
            } else {
              const textWidth = doc.getTextWidth(data)
              doc.setTextColor(...mediumGray)
              doc.text(data, xPosition + colWidths[colIndex] - textWidth - 4, yPosition + 5)
            }
          } else {
            doc.text(data, xPosition, yPosition + 5)
          }
        }
        
        xPosition += colWidths[colIndex]
      })
      
      yPosition += rowHeight + 2 // Extra spacing between rows
    })
    
    // Add subtle bottom border to table
    doc.setDrawColor(...brandPurple)
    doc.setLineWidth(1)
    doc.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5)
    
    caseIndex += casesPerPage
    addPageFooter(currentPage, totalPages)
  }

  // Add document metadata for professionalism
  doc.setProperties({
    title: `BeGone Statistikrapport - ${customer.company_name}`,
    subject: 'Skadedjurshantering Statistikrapport',
    author: 'BeGone Kundportal',
    keywords: 'skadedjur, statistik, rapport, begone',
    creator: 'BeGone Kundportal',
    producer: 'BeGone PDF Generator'
  })

  // Save with professional filename that preserves Swedish characters
  const safeCompanyName = customer.company_name
    .replace(/[^a-zA-Z0-9À-ſ\s]/g, '') // Allow Swedish characters
    .replace(/\s+/g, '_')
    .substring(0, 30) // Reasonable length limit
  
  const filename = `BeGone_Rapport_${safeCompanyName}_${new Date().toISOString().split('T')[0]}.pdf`
  
  try {
    doc.save(filename)
  } catch (error) {
    console.error('PDF generation error:', error)
    // Fallback with simpler filename
    doc.save(`BeGone_Rapport_${new Date().toISOString().split('T')[0]}.pdf`)
  }
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

// Helper function for safe text rendering (PRESERVE Swedish characters)
const safeText = (text: string | null | undefined): string => {
  if (!text) return ''
  
  // Clean text without destroying Swedish characters - preserve å, ä, ö, Å, Ä, Ö
  return text
    .replace(/[\u0000-\u001F]/g, '') // Remove control characters only
    .replace(/[\u007F-\u009F]/g, '') // Remove extended control characters
    .replace(/[\uFEFF]/g, '') // Remove BOM
    .trim()
    .substring(0, 200) // Prevent extremely long text
}

// Helper function to safely truncate text for table cells
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  const safe = safeText(text)
  if (safe.length <= maxLength) return safe
  return safe.substring(0, maxLength - 1) + '…' // Use proper ellipsis character
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