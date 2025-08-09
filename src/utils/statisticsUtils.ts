// src/utils/statisticsUtils.ts - Utility functions for customer statistics processing
import jsPDF from 'jspdf'
import { isCompletedStatus, getCustomerStatusDisplay } from '../types/database'

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
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 25
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
  
  // Customer info card
  drawRoundedRect(margin, yPosition, contentWidth, 35, 5, [248, 250, 252]) // bg-slate-50 equivalent
  
  doc.setTextColor(...darkBlue)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(customer.company_name, margin + 15, yPosition + 15)
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...mediumGray)
  doc.text(`Rapportperiod: ${getPeriodLabel(period)}`, margin + 15, yPosition + 27)
  
  yPosition += 55
  
  // Executive Summary
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkBlue)
  doc.text('Sammanfattning', margin, yPosition)
  
  yPosition += 20
  
  // Key metrics in attractive cards
  const metricsData = [
    { label: 'Totalt antal ärenden', value: statistics.totalCases.toString(), color: brandPurple },
    { label: 'Avslutade ärenden', value: statistics.completedCases.toString(), color: accentTeal },
    { label: 'Avslutningsgrad', value: `${statistics.completionRate}%`, color: brandPurple },
    { label: 'Aktiva ärenden', value: statistics.activeCases.toString(), color: [245, 158, 11] } // amber-500
  ]
  
  const cardWidth = (contentWidth - 30) / 2
  const cardHeight = 45
  
  metricsData.forEach((metric, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const cardX = margin + (col * (cardWidth + 15))
    const cardY = yPosition + (row * (cardHeight + 15))
    
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
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(metric.value, cardX + 15, cardY + 20)
    
    // Metric label
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    doc.text(metric.label, cardX + 15, cardY + 32)
  })
  
  yPosition += 120
  
  // Additional insights
  const insights = [
    `Genomsnittlig responstid: ${statistics.avgResponseTime} dagar`,
    `Vanligaste skadedjur: ${statistics.topPestType}`,
    `Total kontraktsvärde: ${statistics.totalCost.toLocaleString('sv-SE')} kr`,
    `Serviceeffektivitet: ${Math.round((statistics.completedCases / statistics.totalCases) * 100)}%`
  ]
  
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...darkBlue)
  doc.text('Viktiga insikter', margin, yPosition)
  
  yPosition += 15
  
  insights.forEach((insight) => {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...mediumGray)
    
    // Bullet point
    doc.setFillColor(...brandPurple)
    doc.circle(margin + 3, yPosition - 3, 2, 'F')
    
    doc.text(insight, margin + 12, yPosition)
    yPosition += 12
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
    
    // Page title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...darkBlue)
    doc.text('Ärendedetaljer', margin, yPosition)
    
    yPosition += 25
    
    // Table header
    const tableHeaders = ['Ärendetitel', 'Status', 'Skadedjur', 'Pris', 'Datum']
    const colWidths = [70, 35, 30, 25, 30]
    const headerHeight = 25
    
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
      const rowHeight = 18
      
      // Alternating row background
      if (isEvenRow) {
        doc.setFillColor(248, 250, 252) // Very light gray
        doc.rect(margin, yPosition - 3, contentWidth, rowHeight, 'F')
      }
      
      // Row data
      doc.setTextColor(...darkBlue)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      
      xPosition = margin + 8
      
      const rowData = [
        (caseItem.title || '').substring(0, 35) + ((caseItem.title || '').length > 35 ? '...' : ''),
        getCustomerStatusDisplay(caseItem.status),
        caseItem.pest_type || 'Okänt',
        caseItem.price ? `${caseItem.price.toLocaleString('sv-SE')} kr` : 'N/A',
        caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('sv-SE') : 'N/A'
      ]
      
      rowData.forEach((data, colIndex) => {
        // Special formatting for status
        if (colIndex === 1) {
          const isCompleted = isCompletedStatus(caseItem.status)
          doc.setTextColor(...(isCompleted ? accentTeal : [245, 158, 11]))
          doc.setFont('helvetica', 'bold')
        } else {
          doc.setTextColor(...darkBlue)
          doc.setFont('helvetica', 'normal')
        }
        
        doc.text(data, xPosition, yPosition + 5)
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
    '3m': 'Senaste 3 månaderna',
    '6m': 'Senaste 6 månaderna',
    '1y': 'Senaste året',
    'all': 'Hela tiden'
  }
  return periodMap[period] || period
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