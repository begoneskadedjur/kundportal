// src/utils/arrForecast.ts - ARR forecast calculation utilities

interface Customer {
  id: string
  company_name: string
  annual_value?: number | null
  contract_start_date?: string | null
  contract_end_date?: string | null
}

export interface ARRForecastData {
  year: number
  yearLabel: string
  totalARR: number
  newContracts: number
  renewedContracts: number
  expiredContracts: number
  expiredValue: number
  customers: {
    id: string
    name: string
    value: number
    status: 'active' | 'expired' | 'new'
    contractEnd?: Date
  }[]
}

/**
 * Calculate ARR forecast for the next 5 years based on current contracts
 */
export function calculateARRForecast(customers: Customer[]): ARRForecastData[] {
  const currentYear = new Date().getFullYear()
  const forecast: ARRForecastData[] = []

  // Generate forecast for current year + 4 future years (5 total)
  for (let i = 0; i < 5; i++) {
    const forecastYear = currentYear + i
    const yearStart = new Date(forecastYear, 0, 1) // January 1st
    const yearEnd = new Date(forecastYear, 11, 31, 23, 59, 59) // December 31st
    
    let totalARR = 0
    let newContracts = 0
    let renewedContracts = 0
    let expiredContracts = 0
    let expiredValue = 0
    const yearCustomers: ARRForecastData['customers'] = []

    customers.forEach(customer => {
      const annualValue = customer.annual_value || 0
      if (annualValue <= 0) return

      const contractStart = customer.contract_start_date ? new Date(customer.contract_start_date) : null
      const contractEnd = customer.contract_end_date ? new Date(customer.contract_end_date) : null

      // Skip if no contract dates
      if (!contractStart || !contractEnd) return

      // Check if contract is active during this forecast year
      const contractActiveInYear = contractStart <= yearEnd && contractEnd >= yearStart

      if (contractActiveInYear) {
        // Contract is active during this year
        totalARR += annualValue
        
        // Determine status for this year
        let status: 'active' | 'expired' | 'new' = 'active'
        
        // Check if contract expires during this year
        if (contractEnd >= yearStart && contractEnd <= yearEnd) {
          expiredContracts++
          expiredValue += annualValue
          status = 'expired'
        }
        
        // Check if contract starts during this year
        if (contractStart >= yearStart && contractStart <= yearEnd) {
          newContracts++
          status = 'new'
        } else if (status === 'active') {
          renewedContracts++
        }

        yearCustomers.push({
          id: customer.id,
          name: customer.company_name,
          value: annualValue,
          status,
          contractEnd: contractEnd
        })
      }
    })

    forecast.push({
      year: forecastYear,
      yearLabel: forecastYear.toString(),
      totalARR,
      newContracts,
      renewedContracts,
      expiredContracts,
      expiredValue,
      customers: yearCustomers.sort((a, b) => b.value - a.value) // Sort by value descending
    })
  }

  return forecast
}

/**
 * Calculate total portfolio impact over forecast period
 */
export function calculatePortfolioImpact(forecast: ARRForecastData[]) {
  const currentYearARR = forecast[0]?.totalARR || 0
  const finalYearARR = forecast[forecast.length - 1]?.totalARR || 0
  
  const totalExpiredValue = forecast.reduce((sum, year) => sum + year.expiredValue, 0)
  const avgAnnualExpiry = totalExpiredValue / forecast.length
  
  return {
    currentYearARR,
    finalYearARR,
    totalDrop: currentYearARR - finalYearARR,
    totalDropPercentage: currentYearARR > 0 ? ((currentYearARR - finalYearARR) / currentYearARR) * 100 : 0,
    avgAnnualExpiry,
    peakYear: forecast.reduce((peak, year) => year.totalARR > peak.totalARR ? year : peak, forecast[0] || { totalARR: 0, year: currentYear }),
    lowestYear: forecast.reduce((lowest, year) => year.totalARR < lowest.totalARR ? year : lowest, forecast[0] || { totalARR: Infinity, year: currentYear })
  }
}

/**
 * Get contracts expiring in a specific time period
 */
export function getExpiringContracts(customers: Customer[], months: number = 12) {
  const now = new Date()
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() + months, now.getDate())
  
  return customers.filter(customer => {
    if (!customer.contract_end_date) return false
    
    const contractEnd = new Date(customer.contract_end_date)
    return contractEnd >= now && contractEnd <= cutoffDate
  }).map(customer => ({
    ...customer,
    contractEnd: new Date(customer.contract_end_date!),
    daysUntilExpiry: Math.ceil((new Date(customer.contract_end_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  })).sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Format large numbers with appropriate suffixes
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'k'
  }
  return num.toString()
}