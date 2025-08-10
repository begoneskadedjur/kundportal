// src/utils/statisticsUtils.ts - Utility functions for customer statistics processing
import jsPDF from 'jspdf'
import { isCompletedStatus, getCustomerStatusDisplay } from '../types/database'

// Font configuration for Swedish character support
const configureSwedishFont = (doc: jsPDF) => {
  // Use Helvetica with proper encoding
  doc.setFont('helvetica', 'normal')
  // Enable Unicode support
  doc.setLanguage('sv')
}

// Helper to set font - use this EVERYWHERE
const setSwedishFont = (doc: jsPDF, weight: 'normal' | 'bold' = 'normal') => {
  doc.setFont('helvetica', weight)
}

// Process text to ensure proper Swedish character encoding
// This function handles the Swedish character mapping for jsPDF
const processSwedishText = (text: string | null | undefined): string => {
  if (!text) return ''
  
  // First clean the text
  let cleaned = text
    .replace(/[\u0000-\u001F]/g, '') // Remove control characters
    .replace(/[\u007F-\u009F]/g, '') // Remove extended control characters
    .replace(/[\uFEFF]/g, '') // Remove BOM
    .trim()
    .substring(0, 500)
  
  // Then encode Swedish characters for PDF
  // jsPDF has known issues with UTF-8, we need to ensure Latin-1 encoding
  // Swedish letters need special handling
  cleaned = cleaned
    .replace(/å/g, String.fromCharCode(229))  // å
    .replace(/ä/g, String.fromCharCode(228))  // ä
    .replace(/ö/g, String.fromCharCode(246))  // ö
    .replace(/Å/g, String.fromCharCode(197))  // Å
    .replace(/Ä/g, String.fromCharCode(196))  // Ä
    .replace(/Ö/g, String.fromCharCode(214))  // Ö
  
  return cleaned
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
  
  // Configure proper font for Swedish characters
  configureSwedishFont(doc)
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15 // Further reduced margin for optimal content space
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

  // Helper function to draw clean rounded rectangles with subtle styling
  const drawCleanRect = (x: number, y: number, width: number, height: number, radius: number, fillColor?: number[], borderColor?: number[]) => {
    // Subtle shadow effect first
    doc.setFillColor(0, 0, 0, 0.03)
    doc.roundedRect(x + 0.5, y + 0.5, width, height, radius, radius, 'F')
    
    // Main rectangle with clean fill
    if (fillColor) {
      doc.setFillColor(...fillColor)
      doc.roundedRect(x, y, width, height, radius, radius, 'F')
    }
    
    // Optional subtle border (very thin)
    if (borderColor) {
      doc.setDrawColor(...borderColor)
      doc.setLineWidth(0.2) // Ultra-thin border for professional look
      doc.roundedRect(x, y, width, height, radius, radius, 'S')
    }
  }

  // Helper function to add compact premium header to each page
  const addPageHeader = () => {
    const headerHeight = 40 // Reduced from 50
    
    // Premium header background with subtle gradient
    doc.setFillColor(...brandPurple)
    doc.rect(0, 0, pageWidth, headerHeight, 'F')
    
    // Add gradient overlay effect
    doc.setFillColor(...softPurple)
    doc.rect(0, 0, pageWidth, headerHeight/2, 'F')
    
    // Enhanced BeGone logo area with professional styling (smaller)
    const logoY = headerHeight/2
    doc.setFillColor(255, 255, 255)
    doc.circle(margin + 12, logoY, 10, 'F')
    
    // Logo shadow effect
    doc.setFillColor(0, 0, 0, 0.1)
    doc.circle(margin + 12.5, logoY + 0.5, 10, 'F')
    doc.setFillColor(255, 255, 255)
    doc.circle(margin + 12, logoY, 10, 'F')
    
    // BeGone logo text
    doc.setTextColor(...brandPurple)
    doc.setFontSize(12) // Reduced
    setSwedishFont(doc, 'bold')
    doc.text('BG', margin + 8, logoY + 3)
    
    // Add decorative elements around logo
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(1.5)
    doc.circle(margin + 12, logoY, 10, 'S')

    // Main title with Swedish-safe typography (more compact)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22) // Reduced from 28
    setSwedishFont(doc, 'bold')
    doc.text(processSwedishText('BeGone'), margin + 28, logoY - 3)
    
    doc.setFontSize(12) // Reduced from 16
    setSwedishFont(doc, 'normal')
    doc.text(processSwedishText('Statistikrapport'), margin + 28, logoY + 6)
    
    // Tagline
    doc.setFontSize(8) // Reduced from 10
    doc.setTextColor(220, 220, 220)
    doc.text(processSwedishText('Professionell skadedjurshantering'), margin + 28, logoY + 13)

    // Date stamp with Swedish formatting
    doc.setFontSize(9) // Reduced from 11
    doc.setTextColor(255, 255, 255)
    setSwedishFont(doc, 'normal')
    const dateText = processSwedishText(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`)
    const dateWidth = doc.getTextWidth(dateText)
    doc.text(dateText, pageWidth - margin - dateWidth, logoY + 2)
    
    // Add decorative line under header
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(2)
    doc.line(0, headerHeight, pageWidth, headerHeight)
  }

  // Helper function to add compact premium footer
  const addPageFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 15 // Moved up from -18
    const footerHeight = 15 // Reduced from 25
    
    // Premium footer background
    doc.setFillColor(...warmGray)
    doc.rect(0, footerY - 5, pageWidth, footerHeight, 'F')
    
    // Footer accent line
    doc.setDrawColor(...accentTeal)
    doc.setLineWidth(1)
    doc.line(0, footerY - 5, pageWidth, footerY - 5)
    
    // Footer text with Swedish font
    doc.setTextColor(...mediumGray)
    doc.setFontSize(8) // Reduced from 9
    setSwedishFont(doc, 'normal')
    doc.text(processSwedishText('BeGone Kundportal • Professionell skadedjurshantering'), margin, footerY)
    
    // Contact info
    doc.setFontSize(7) // Reduced from 8
    doc.setTextColor(...mediumGray)
    doc.text(processSwedishText('www.begone.se • info@begone.se'), margin, footerY + 6)
    
    // Page number styling
    setSwedishFont(doc, 'bold')
    doc.setTextColor(...brandPurple)
    const pageText = processSwedishText(`Sida ${pageNumber} av ${totalPages}`)
    const pageTextWidth = doc.getTextWidth(pageText)
    doc.text(pageText, pageWidth - margin - pageTextWidth, footerY + 3)
  }

  // Calculate total pages needed with better pagination
  const casesPerPage = 15 // Increased capacity due to more compact design
  const totalPages = Math.ceil(cases.length / casesPerPage) + 1

  // PAGE 1: Executive Summary and Key Metrics
  addPageHeader()
  
  let yPosition = 65 // Optimized space after header
  
  // Customer info card with clean design - optimized for space
  const customerCardHeight = 35 // Reduced height
  drawCleanRect(margin, yPosition, contentWidth, customerCardHeight, 8, [255, 255, 255], [...lightGray])
  
  // Top accent stripe (thin)
  doc.setFillColor(...accentTeal)
  doc.roundedRect(margin, yPosition, contentWidth, 2, 8, 8, 'F')
  
  doc.setTextColor(...darkBlue)
  doc.setFontSize(16) // Reduced from 20
  setSwedishFont(doc, 'bold')
  doc.text(processSwedishText(customer.company_name), margin + 12, yPosition + 18)
  
  doc.setFontSize(10) // Reduced from 12
  setSwedishFont(doc, 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(processSwedishText(`Rapportperiod: ${getPeriodLabel(period)}`), margin + 12, yPosition + 28)
  
  yPosition += 50 // Reduced from 65
  
  // Executive Summary with clean icon - more compact
  doc.setFillColor(...accentTeal)
  doc.circle(margin + 5, yPosition - 2, 3, 'F')
  doc.setFillColor(255, 255, 255)
  doc.setFontSize(6)
  setSwedishFont(doc, 'bold')
  doc.text('✓', margin + 3.5, yPosition - 0.5)
  
  doc.setFontSize(15) // Reduced from 18
  setSwedishFont(doc, 'bold')
  doc.setTextColor(...darkBlue)
  doc.text(processSwedishText('Sammanfattning'), margin + 12, yPosition)
  
  yPosition += 15 // Reduced spacing
  
  // Key metrics in attractive cards with safe text
  const completionRate = statistics.totalCases > 0 
    ? Math.round((statistics.completedCases / statistics.totalCases) * 100)
    : 0
    
  const metricsData = [
    { label: 'Totalt antal ärenden', value: statistics.totalCases.toString(), color: brandPurple },
    { label: 'Avslutade ärenden', value: statistics.completedCases.toString(), color: accentTeal },
    { label: 'Avslutningsgrad', value: `${completionRate}%`, color: brandPurple },
    { label: 'Aktiva ärenden', value: statistics.activeCases.toString(), color: [245, 158, 11] } // amber-500
  ]
  
  const cardWidth = (contentWidth - 15) / 2
  const cardHeight = 38 // Reduced height for more compact design
  
  metricsData.forEach((metric, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + (col * (cardWidth + 15))
    const cardY = yPosition + (row * (cardHeight + 8))
    
    // Clean card with subtle styling - NO thick borders
    drawCleanRect(cardX, cardY, cardWidth, cardHeight, 6, [255, 255, 255], [...lightGray])
    
    // Left accent bar instead of thick top border
    doc.setFillColor(...metric.color)
    doc.roundedRect(cardX, cardY, 2, cardHeight, 6, 6, 'F')
    
    // Metric value with proper Swedish font
    doc.setTextColor(...darkBlue)
    doc.setFontSize(20) // Reduced from 26
    setSwedishFont(doc, 'bold')
    doc.text(processSwedishText(metric.value), cardX + 12, cardY + 20)
    
    // Metric label with proper Swedish font
    doc.setFontSize(8) // Reduced from 9
    setSwedishFont(doc, 'normal')
    doc.setTextColor(...mediumGray)
    
    // Handle long labels with better line wrapping
    const words = processSwedishText(metric.label).split(' ')
    if (words.length > 2) {
      doc.text(words.slice(0, 2).join(' '), cardX + 12, cardY + 30)
      doc.text(words.slice(2).join(' '), cardX + 12, cardY + 36)
    } else {
      doc.text(processSwedishText(metric.label), cardX + 12, cardY + 32)
    }
  })
  
  yPosition += 100 // Reduced spacing after statistics cards
  
  // Calculate comprehensive insights data
  const totalCostFormatted = formatSwedishCurrency(statistics.totalCost || 0)
  const serviceEfficiency = statistics.totalCases > 0 
    ? Math.round((statistics.completedCases / statistics.totalCases) * 100)
    : 0
  
  // Get most common pest type from cases
  const pestCounts = cases.reduce((acc, caseItem) => {
    const pest = caseItem.pest_type || 'Okänt'
    acc[pest] = (acc[pest] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const topPestType = Object.entries(pestCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Okänt'
  
  // Calculate average response time properly
  const responseTimes = cases
    .filter(c => c.created_at && c.scheduled_start)
    .map(c => {
      const created = new Date(c.created_at!)
      const scheduled = new Date(c.scheduled_start!)
      return Math.max(0, (scheduled.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    })
  
  const avgResponseTime = responseTimes.length > 0 
    ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
    : 0
  
  const insights = [
    `Genomsnittlig responstid: ${avgResponseTime} dagar`,
    `Vanligaste skadedjur: ${processSwedishText(topPestType)}`,
    `Total kontraktsvärde: ${totalCostFormatted}`,
    `Serviceeffektivitet: ${serviceEfficiency}%`,
    `Aktiv period: ${processSwedishText(getPeriodLabel(period))}`,
    `Behandlade ärenden: ${statistics.completedCases}/${statistics.totalCases}`
  ]
  
  // Insights section title with icon
  doc.setFillColor(...accentTeal)
  doc.circle(margin + 5, yPosition - 2, 3, 'F')
  doc.setFillColor(255, 255, 255)
  doc.setFontSize(7)
  setSwedishFont(doc, 'bold')
  doc.text('!', margin + 3.5, yPosition + 0.5)
  
  doc.setFontSize(14) // Reduced from 16
  setSwedishFont(doc, 'bold')
  doc.setTextColor(...darkBlue)
  doc.text(processSwedishText('Viktiga insikter'), margin + 12, yPosition)
  
  yPosition += 12 // Reduced spacing
  
  // Enhanced insights section with properly sized cards - ALL insights displayed
  const insightsPerRow = 2
  const insightCardWidth = (contentWidth - 10) / insightsPerRow
  const insightCardHeight = 25 // Optimized height for better fit
  
  // FIX: Ensure we always show insights even on first page
  // Calculate available space more accurately
  const footerHeight = 35 // Space needed for footer
  const availableHeight = pageHeight - yPosition - footerHeight
  
  // FIX: Ensure we show at least 4 insights (2 rows) minimum
  const minRows = 2
  const maxRows = Math.max(minRows, Math.floor(availableHeight / (insightCardHeight + 5)))
  
  // FIX: Take all insights if they fit, otherwise paginate properly
  const maxInsights = maxRows * insightsPerRow
  const visibleInsights = insights.slice(0, Math.min(insights.length, maxInsights))
  
  visibleInsights.forEach((insight, index) => {
    const col = index % insightsPerRow
    const row = Math.floor(index / insightsPerRow)
    const cardX = margin + (col * (insightCardWidth + 10))
    const cardY = yPosition + (row * (insightCardHeight + 5))
    
    // Premium card with subtle shadow effect
    doc.setFillColor(240, 240, 245) // Very light background
    doc.roundedRect(cardX + 0.5, cardY + 0.5, insightCardWidth - 1, insightCardHeight - 1, 3, 3, 'F')
    
    // Clean card border
    doc.setDrawColor(220, 220, 230)
    doc.setLineWidth(0.2)
    doc.roundedRect(cardX, cardY, insightCardWidth, insightCardHeight, 3, 3, 'S')
    
    // Elegant left accent (gradient effect simulation)
    const accentColors = [
      index % 2 === 0 ? brandPurple : accentTeal,
      index % 2 === 0 ? accentTeal : brandPurple
    ]
    doc.setFillColor(...accentColors[0])
    doc.roundedRect(cardX, cardY, 1.5, insightCardHeight, 3, 3, 'F')
    
    // Modern icon with better positioning
    doc.setFillColor(...accentColors[1])
    doc.circle(cardX + 7, cardY + 8, 2, 'F')
    doc.setFillColor(255, 255, 255)
    doc.setFontSize(5)
    setSwedishFont(doc, 'bold')
    doc.text('✓', cardX + 6, cardY + 9)
    
    // Insight text with Swedish-safe formatting
    doc.setTextColor(...darkBlue)
    doc.setFontSize(8) // Reduced font size
    setSwedishFont(doc, 'normal')
    
    // Split insight into title and value for better formatting
    const parts = processSwedishText(insight).split(': ')
    if (parts.length === 2) {
      // Title
      setSwedishFont(doc, 'normal')
      doc.setTextColor(...mediumGray)
      doc.text(processSwedishText(parts[0]), cardX + 12, cardY + 7)
      
      // Value with better prominence
      setSwedishFont(doc, 'bold')
      doc.setTextColor(...darkBlue)
      doc.setFontSize(10)
      doc.text(processSwedishText(parts[1]), cardX + 12, cardY + 16)
    } else {
      // Single line fallback
      const words = processSwedishText(insight).split(' ')
      if (words.length > 4) {
        doc.text(words.slice(0, 4).join(' '), cardX + 15, cardY + 8)
        doc.text(words.slice(4).join(' '), cardX + 15, cardY + 16)
      } else {
        doc.text(processSwedishText(insight), cardX + 15, cardY + 14)
      }
    }
  })
  
  // Update yPosition to account for insight cards
  const actualRows = Math.ceil(visibleInsights.length / insightsPerRow)
  yPosition += (actualRows * (insightCardHeight + 6)) + 5
  
  addPageFooter(1, totalPages)

  // SUBSEQUENT PAGES: Detailed Case Data
  let currentPage = 1
  let caseIndex = 0
  
  while (caseIndex < cases.length) {
    doc.addPage()
    currentPage++
    addPageHeader()
    
    yPosition = 65 // Consistent with first page
    
    // Page title with proper Swedish font - more compact
    doc.setFontSize(15) // Reduced from 18
    setSwedishFont(doc, 'bold')
    doc.setTextColor(...darkBlue)
    
    // Clean decorative icon
    doc.setFillColor(...brandPurple)
    doc.circle(margin + 5, yPosition - 2, 3, 'F')
    doc.setFillColor(255, 255, 255)
    doc.setFontSize(8)
    setSwedishFont(doc, 'bold')
    doc.text('i', margin + 3.5, yPosition - 0.5)
    
    doc.setFontSize(15)
    setSwedishFont(doc, 'bold')
    doc.setTextColor(...darkBlue)
    doc.text(processSwedishText('Ärendedetaljer'), margin + 12, yPosition)
    
    yPosition += 20 // Reduced spacing
    
    // Table header with improved spacing and proper Swedish characters
    const tableHeaders = ['Ärendetitel', 'Status', 'Skadedjur', 'Pris', 'Datum']
    const colWidths = [60, 35, 40, 25, 30] // Better balanced proportions
    const headerHeight = 18 // Reduced from 28
    
    // Clean header background - subtle instead of overwhelming
    drawCleanRect(margin, yPosition - 3, contentWidth, headerHeight, 4, [...brandPurple], [...mediumGray])
    
    // Header text with Swedish font - clean styling
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9) // Slightly reduced
    setSwedishFont(doc, 'bold')
    
    let xPosition = margin + 8 // Reduced padding
    tableHeaders.forEach((header, index) => {
      const processedHeader = processSwedishText(header)
      if (index === 3) { // Price column - right align
        const headerWidth = doc.getTextWidth(processedHeader)
        doc.text(processedHeader, xPosition + colWidths[index] - headerWidth - 4, yPosition + 6)
      } else {
        doc.text(processedHeader, xPosition, yPosition + 6)
      }
      xPosition += colWidths[index]
    })
    
    yPosition += headerHeight + 3 // Reduced spacing
    
    // Table rows with enhanced styling
    const pageCases = cases.slice(caseIndex, caseIndex + casesPerPage)
    
    pageCases.forEach((caseItem, rowIndex) => {
      const isEvenRow = rowIndex % 2 === 0
      const rowHeight = 18 // Reduced for more compact design
      
      // Premium alternating row backgrounds with better contrast
      if (isEvenRow) {
        doc.setFillColor(248, 249, 252) // Subtle blue-gray
        doc.roundedRect(margin, yPosition - 3, contentWidth, rowHeight, 2, 2, 'F')
      } else {
        doc.setFillColor(255, 255, 255) // Pure white
        doc.roundedRect(margin, yPosition - 3, contentWidth, rowHeight, 2, 2, 'F')
      }
      
      // Add subtle row border for definition
      doc.setDrawColor(240, 240, 245)
      doc.setLineWidth(0.1)
      doc.line(margin, yPosition + rowHeight - 3, margin + contentWidth, yPosition + rowHeight - 3)
      
      // Add subtle row separator
      if (rowIndex > 0) {
        doc.setDrawColor(...lightGray)
        doc.setLineWidth(0.2)
        doc.line(margin + 5, yPosition - 2, pageWidth - margin - 5, yPosition - 2)
      }
      
      // Row data with improved formatting and proper Swedish characters
      const rowData = [
        processSwedishText(truncateText(caseItem.title, 32)),
        processSwedishText(getCustomerStatusDisplay(caseItem.status)),
        processSwedishText(truncateText(caseItem.pest_type, 20)) || processSwedishText('Okänt'),
        formatSwedishCurrency(caseItem.price),
        caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('sv-SE') : '—'
      ]
      
      xPosition = margin + 8 // Reduced padding to match header
      
      rowData.forEach((data, colIndex) => {
        // Determine text styling based on column
        if (colIndex === 1) { // Status column
          const isCompleted = isCompletedStatus(caseItem.status)
          
          // Create compact status badge
          const statusWidth = doc.getTextWidth(data) + 8 // Reduced padding
          const statusHeight = 10 // Reduced height
          const statusY = yPosition - 2
          
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
          
          // Status text with Swedish font
          doc.setTextColor(255, 255, 255)
          doc.setFontSize(7) // Reduced font size
          setSwedishFont(doc, 'bold')
          doc.text(processSwedishText(data), xPosition + 4, yPosition + 2)
        } else {
          // Cell styling with Swedish font
          doc.setTextColor(...darkBlue)
          doc.setFontSize(8) // Reduced font size
          setSwedishFont(doc, 'normal')
          
          const processedData = processSwedishText(data)
          
          // Special formatting for price column (right align)
          if (colIndex === 3) {
            setSwedishFont(doc, 'bold')
            if (data !== '—' && data !== 'N/A') {
              const textWidth = doc.getTextWidth(processedData)
              doc.text(processedData, xPosition + colWidths[colIndex] - textWidth - 4, yPosition + 4)
            } else {
              const textWidth = doc.getTextWidth(processedData)
              doc.setTextColor(...mediumGray)
              doc.text(processedData, xPosition + colWidths[colIndex] - textWidth - 4, yPosition + 4)
            }
          } else {
            doc.text(processedData, xPosition, yPosition + 4)
          }
        }
        
        xPosition += colWidths[colIndex]
      })
      
      yPosition += rowHeight + 1 // Reduced spacing between rows
    })
    
    // Add subtle bottom border to table
    doc.setDrawColor(...brandPurple)
    doc.setLineWidth(0.5)
    doc.line(margin, yPosition + 3, pageWidth - margin, yPosition + 3)
    
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
    '3m': 'Senaste 3 månaderna',
    '6m': 'Senaste 6 månaderna', 
    '1y': 'Senaste året',
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

// Helper function to safely truncate text for table cells
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  const safe = processSwedishText(text)
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