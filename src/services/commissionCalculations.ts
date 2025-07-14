// 📁 src/services/commissionCalculations.ts - Hjälpfunktioner för provisionsberäkningar och formatering
import type { CommissionCaseDetail, CommissionExportData } from '../types/commission'

// 1. Provisionsberäkning (samma logik som webhook)
export const calculateCommission = (price: number, caseType: 'private' | 'business'): number => {
  if (!price || price <= 0) return 0
  
  let netAmount: number
  
  if (caseType === 'business') {
    // Företag: Ta bort 25% moms först
    netAmount = price / 1.25
  } else {
    // Privatperson: Ingen moms
    netAmount = price
  }
  
  // 5% provision på nettobeloppet, avrunda till 2 decimaler
  const commission = Math.round(netAmount * 0.05 * 100) / 100
  
  return commission
}

// 2. Valutaformatering
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export const formatCurrencyDetailed = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// 3. Datumformatering
export const formatSwedishDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE')
}

export const formatSwedishDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('sv-SE') + ' ' + date.toLocaleTimeString('sv-SE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// 4. Adressformatering (samma logik som BillingManagement)
export const formatAddress = (address: any): string => {
  if (!address) return 'Ingen adress angiven'
  
  // Om det är en sträng, returnera direkt
  if (typeof address === 'string') {
    // Om strängen ser ut som JSON, försök parsa den
    if (address.startsWith('{') && address.includes('formatted_address')) {
      try {
        const parsed = JSON.parse(address)
        return parsed.formatted_address || 'Ingen adress angiven'
      } catch (e) {
        return address
      }
    }
    return address
  }
  
  // Om det är ett objekt
  if (typeof address === 'object') {
    // Kolla efter formatted_address direkt
    if (address.formatted_address) {
      return address.formatted_address
    }
    
    // Fallback till manuell formatering
    const parts = []
    if (address.street) parts.push(address.street)
    if (address.city) parts.push(address.city)
    if (address.postalCode || address.postal_code) parts.push(address.postalCode || address.postal_code)
    if (address.country) parts.push(address.country)
    
    return parts.length > 0 ? parts.join(', ') : 'Ingen adress angiven'
  }
  
  return 'Ingen adress angiven'
}

// 5. Kundinfo-formatering
export const formatCustomerInfo = (case_: CommissionCaseDetail): string => {
  const parts = []
  
  if (case_.type === 'business') {
    // Företag: Använd bestallare eller kontaktperson
    if (case_.bestallare) {
      parts.push(case_.bestallare)
    } else if (case_.kontaktperson) {
      parts.push(case_.kontaktperson)
    }
    
    if (case_.org_nr) {
      parts.push(`(${case_.org_nr})`)
    }
  } else {
    // Privatperson: Använd kontaktperson
    if (case_.kontaktperson) {
      parts.push(case_.kontaktperson)
    }
  }
  
  return parts.length > 0 ? parts.join(' ') : 'Okänd kund'
}

// 6. Månadsnavigation helpers
export const getMonthNavigation = (currentMonth: string) => {
  const [year, month] = currentMonth.split('-').map(Number)
  
  // Föregående månad
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const previousMonth = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`
  
  // Nästa månad
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const followingMonth = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`
  
  // Månadsnamn
  const monthNames = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]
  
  return {
    previous: {
      value: previousMonth,
      display: `${monthNames[prevMonth - 1]} ${prevYear}`
    },
    current: {
      value: currentMonth,
      display: `${monthNames[month - 1]} ${year}`
    },
    next: {
      value: followingMonth,
      display: `${monthNames[nextMonth - 1]} ${nextYear}`
    },
    canGoNext: followingMonth <= new Date().toISOString().slice(0, 7) // Inte framtid
  }
}

// 7. Statistiska beräkningar
export const calculateStatistics = (commissions: number[]) => {
  if (commissions.length === 0) {
    return {
      total: 0,
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0
    }
  }
  
  const total = commissions.reduce((sum, c) => sum + c, 0)
  const average = total / commissions.length
  
  // Median
  const sorted = [...commissions].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]
  
  const min = Math.min(...commissions)
  const max = Math.max(...commissions)
  
  // Standardavvikelse
  const variance = commissions.reduce((sum, c) => sum + Math.pow(c - average, 2), 0) / commissions.length
  const standardDeviation = Math.sqrt(variance)
  
  return {
    total,
    average,
    median,
    min,
    max,
    standardDeviation
  }
}

// 8. Export data preparation
export const prepareExportData = (cases: CommissionCaseDetail[]): CommissionExportData[] => {
  // Gruppera per tekniker
  const technicianMap: { [technicianId: string]: CommissionExportData } = {}
  
  cases.forEach(case_ => {
    if (!case_.primary_assignee_id) return
    
    const techId = case_.primary_assignee_id
    
    if (!technicianMap[techId]) {
      technicianMap[techId] = {
        technician_name: case_.primary_assignee_name || 'Okänd tekniker',
        technician_email: case_.primary_assignee_email || '',
        case_count: 0,
        total_commission: 0,
        private_commission: 0,
        business_commission: 0,
        cases: []
      }
    }
    
    const tech = technicianMap[techId]
    tech.case_count += 1
    tech.total_commission += case_.commission_amount || 0
    
    if (case_.type === 'private') {
      tech.private_commission += case_.commission_amount || 0
    } else {
      tech.business_commission += case_.commission_amount || 0
    }
    
    tech.cases.push({
      case_number: case_.case_number || case_.id.slice(0, 8),
      title: case_.title,
      type: case_.type === 'private' ? 'Privatperson' : 'Företag',
      case_price: case_.case_price,
      commission_amount: case_.commission_amount || 0,
      completed_date: formatSwedishDate(case_.completed_date),
      customer_info: formatCustomerInfo(case_)
    })
  })
  
  // Sortera tekniker efter total provision
  const exportData = Object.values(technicianMap)
    .sort((a, b) => b.total_commission - a.total_commission)
  
  // Sortera cases inom varje tekniker efter datum
  exportData.forEach(tech => {
    tech.cases.sort((a, b) => b.completed_date.localeCompare(a.completed_date))
  })
  
  return exportData
}

// 9. Performance metrics
export const calculatePerformanceMetrics = (
  technicianCommission: number,
  teamAverage: number,
  caseCount: number,
  teamCaseAverage: number
) => {
  const revenuePerformance = teamAverage > 0 
    ? ((technicianCommission - teamAverage) / teamAverage) * 100 
    : 0
    
  const casePerformance = teamCaseAverage > 0
    ? ((caseCount - teamCaseAverage) / teamCaseAverage) * 100
    : 0
    
  const efficiency = caseCount > 0 ? technicianCommission / caseCount : 0
  const teamEfficiency = teamCaseAverage > 0 ? teamAverage / teamCaseAverage : 0
  const efficiencyPerformance = teamEfficiency > 0
    ? ((efficiency - teamEfficiency) / teamEfficiency) * 100
    : 0
  
  return {
    revenuePerformance: Math.round(revenuePerformance * 10) / 10,
    casePerformance: Math.round(casePerformance * 10) / 10,
    efficiencyPerformance: Math.round(efficiencyPerformance * 10) / 10,
    efficiency: Math.round(efficiency * 100) / 100,
    isAboveAverage: revenuePerformance > 0
  }
}

// 10. Validation helpers
export const validateCommissionData = (commission: number, price: number, caseType: 'private' | 'business'): boolean => {
  if (commission <= 0 || price <= 0) return false
  
  const expectedCommission = calculateCommission(price, caseType)
  const tolerance = 0.01 // 1 öre tolerans för avrundning
  
  return Math.abs(commission - expectedCommission) <= tolerance
}

export const getCommissionValidationMessage = (commission: number, price: number, caseType: 'private' | 'business'): string => {
  const expectedCommission = calculateCommission(price, caseType)
  
  if (Math.abs(commission - expectedCommission) > 0.01) {
    return `⚠️ Provision verkar felaktig. Förväntat: ${formatCurrencyDetailed(expectedCommission)}, Faktisk: ${formatCurrencyDetailed(commission)}`
  }
  
  return '✅ Provision korrekt beräknad'
}