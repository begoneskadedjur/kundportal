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

// Export to PDF functionality
export const exportStatisticsToPDF = (
  customer: Customer,
  cases: CaseData[],
  statistics: any,
  period: string
) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // Header
  doc.setFontSize(20)
  doc.setTextColor(31, 41, 55) // slate-800
  doc.text('BeGone - Statistikrapport', margin, 30)

  doc.setFontSize(14)
  doc.setTextColor(71, 85, 105) // slate-600
  doc.text(`Kund: ${customer.company_name}`, margin, 45)
  doc.text(`Period: ${getPeriodLabel(period)}`, margin, 55)
  doc.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')}`, margin, 65)

  // Key Statistics
  let yPosition = 85
  doc.setFontSize(16)
  doc.setTextColor(31, 41, 55)
  doc.text('Nyckelstatistik', margin, yPosition)

  yPosition += 15
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  
  const keyStats = [
    `Totalt antal ärenden: ${statistics.totalCases}`,
    `Avslutade ärenden: ${statistics.completedCases}`,
    `Avslutningsgrad: ${statistics.completionRate}%`,
    `Aktiva ärenden: ${statistics.activeCases}`,
    `Genomsnittlig responstid: ${statistics.avgResponseTime} dagar`,
    `Vanligaste skadedjur: ${statistics.topPestType}`,
    `Total kostnad: ${statistics.totalCost.toLocaleString('sv-SE')} kr`
  ]

  keyStats.forEach((stat) => {
    doc.text(stat, margin, yPosition)
    yPosition += 10
  })

  // Case Details Table
  yPosition += 20
  doc.setFontSize(16)
  doc.setTextColor(31, 41, 55)
  doc.text('Ärendedetaljer', margin, yPosition)

  yPosition += 15
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)

  // Table headers
  const headers = ['Titel', 'Status', 'Skadedjur', 'Datum']
  const colWidths = [60, 40, 40, 40]
  let xPosition = margin

  headers.forEach((header, index) => {
    doc.text(header, xPosition, yPosition)
    xPosition += colWidths[index]
  })

  yPosition += 10
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  // Table rows
  cases.slice(0, 20).forEach((caseItem) => {
    if (yPosition > 270) {
      doc.addPage()
      yPosition = 30
    }

    xPosition = margin
    const rowData = [
      caseItem.title.substring(0, 25) + (caseItem.title.length > 25 ? '...' : ''),
      getCustomerStatusDisplay(caseItem.status),
      caseItem.pest_type || 'Okänt',
      caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString('sv-SE') : 'N/A'
    ]

    rowData.forEach((data, index) => {
      doc.text(data, xPosition, yPosition)
      xPosition += colWidths[index]
    })

    yPosition += 8
  })

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text(
    'Denna rapport genererades automatiskt av BeGone Kundportal',
    margin,
    doc.internal.pageSize.getHeight() - 20
  )

  doc.save(`${customer.company_name}_statistik_${new Date().toISOString().split('T')[0]}.pdf`)
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
      `"${caseItem.title.replace(/"/g, '""')}"`,
      getCustomerStatusDisplay(caseItem.status),
      caseItem.pest_type || 'Okänt',
      caseItem.price || 0,
      caseItem.created_at || '',
      caseItem.scheduled_start || '',
      caseItem.completed_date || '',
      `"${(caseItem.address || '').replace(/"/g, '""')}"`
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