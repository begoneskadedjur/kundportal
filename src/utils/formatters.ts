// 📁 src/utils/formatters.ts - UPPDATERAD med nya intäktslabels
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export const formatNumber = (number: number): string => {
  return new Intl.NumberFormat('sv-SE').format(number)
}

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('sv-SE')
}

export const formatMonth = (monthString: string): string => {
  const date = new Date(monthString + '-01')
  return date.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' })
}

export const formatFullMonth = (monthString: string): string => {
  const date = new Date(monthString + '-01')
  return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
}

// Kompakt nummer formatering för charts (1000 -> 1k, 1000000 -> 1M)
export const formatCompactNumber = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`
  }
  return value.toString()
}

// Formatera för Y-axis i charts (ta bort "kr" från valuta)
export const formatCurrencyAxis = (value: number): string => {
  return formatCurrency(value).replace('kr', '').trim()
}

// Formatera stora valutabelopp med enhet
export const formatLargeCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)} mkr`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}k kr`
  }
  return formatCurrency(amount)
}

// Förkortade månadsnamn på svenska
export const getShortMonthName = (monthIndex: number): string => {
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return months[monthIndex] || ''
}

// Formatera tidsperiod (dagar)
export const formatDays = (days: number): string => {
  if (days === 1) return '1 dag'
  if (days < 7) return `${days} dagar`
  if (days < 30) return `${Math.round(days / 7)} veckor`
  return `${Math.round(days / 30)} månader`
}

// Formatera tekniker namn från email
export const formatTechnicianName = (email: string): string => {
  const name = email.split('@')[0]
  return name.split('.').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ')
}

// Account Manager namn formatering
export const formatAccountManagerName = (email: string): string => {
  if (!email || !email.includes('@')) return email || 'Ej tilldelad'
  
  const username = email.split('@')[0]
  const parts = username.split('.')
  
  return parts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' ')
}

// Formatera risk level med färgkoder
export const formatRiskLevel = (level: 'high' | 'medium' | 'low'): { text: string; color: string } => {
  switch (level) {
    case 'high':
      return { text: 'Hög risk', color: 'text-red-500' }
    case 'medium':
      return { text: 'Medel risk', color: 'text-yellow-500' }
    case 'low':
      return { text: 'Låg risk', color: 'text-green-500' }
    default:
      return { text: 'Okänd', color: 'text-slate-500' }
  }
}

// Formatera avtalsstatus
export const formatContractStatus = (status: string): { text: string; color: string } => {
  switch (status.toLowerCase()) {
    case 'active':
      return { text: 'Aktivt', color: 'text-green-500' }
    case 'pending':
      return { text: 'Väntande', color: 'text-yellow-500' }
    case 'expired':
      return { text: 'Utgånget', color: 'text-red-500' }
    case 'cancelled':
      return { text: 'Uppsagt', color: 'text-slate-500' }
    default:
      return { text: status, color: 'text-slate-400' }
  }
}

// BeGone case status formatering
export const formatCaseStatus = (status: string): { text: string; color: string } => {
  switch (status.toLowerCase()) {
    case 'avslutat':
      return { text: 'Avslutat', color: 'text-green-500' }
    case 'pågående':
      return { text: 'Pågående', color: 'text-blue-500' }
    case 'väntar':
      return { text: 'Väntar', color: 'text-yellow-500' }
    case 'pausad':
      return { text: 'Pausad', color: 'text-orange-500' }
    default:
      return { text: status, color: 'text-slate-400' }
  }
}

// Formatera svenskt datum från YYYY-MM-DD
export const formatSwedishDate = (dateString?: string): string => {
  if (!dateString) return 'Ej angivet'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('sv-SE')
  } catch {
    return dateString
  }
}

// Relativt datum (t.ex. "3 dagar sedan")
export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} veckor sedan`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} månader sedan`
  
  return `${Math.floor(diffDays / 365)} år sedan`
}

// Formatera tidsåtgång (för completion time)
export const formatCompletionTime = (days: number): string => {
  if (days < 1) return 'Samma dag'
  if (days === 1) return '1 dag'
  if (days < 7) return `${Math.round(days)} dagar`
  if (days < 30) return `${Math.round(days / 7)} veckor`
  
  return `${Math.round(days / 30)} månader`
}

// Formatera CAC (Customer Acquisition Cost) med kontext
export const formatCAC = (cac: number, trend?: number): { value: string; trend?: string; trendColor?: string } => {
  const value = formatCurrency(cac)
  
  if (trend === undefined) return { value }
  
  const trendText = trend >= 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`
  const trendColor = trend <= 0 ? 'text-green-500' : 'text-red-500' // Lägre CAC är bättre
  
  return { value, trend: trendText, trendColor }
}

// Formatera tillväxtprocent med färg
export const formatGrowth = (current: number, previous: number): { percentage: string; color: string; arrow: string } => {
  if (previous === 0) return { percentage: 'N/A', color: 'text-slate-400', arrow: '' }
  
  const growth = ((current - previous) / previous) * 100
  const percentage = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`
  const color = growth >= 0 ? 'text-green-500' : 'text-red-500'
  const arrow = growth >= 0 ? '↗' : '↘'
  
  return { percentage, color, arrow }
}

// 🆕 UPPDATERAD: Formatera för intäktstyper med nya namn
export const formatRevenueType = (type: 'contract' | 'case' | 'engangsjobb'): { text: string; color: string; icon: string } => {
  switch (type) {
    case 'contract':
      return { text: 'Kontraktsintäkter', color: 'text-green-500', icon: '📋' }
    case 'case':
      return { text: 'Merförsäljning Avtal', color: 'text-yellow-500', icon: '💼' } // 🆕 Nytt namn
    case 'engangsjobb':
      return { text: 'Intäkter Engångsjobb', color: 'text-orange-500', icon: '🔧' } // 🆕 Nytt namn
    default:
      return { text: 'Okänt', color: 'text-slate-400', icon: '❓' }
  }
}

// 🆕 UPPDATERAD: Formatera för BeGone case types med nya namn
export const formatBeGoneCaseType = (type: 'private' | 'business'): { text: string; color: string; icon: string } => {
  switch (type) {
    case 'private':
      return { text: 'Privatperson', color: 'text-purple-500', icon: '👤' }
    case 'business':
      return { text: 'Företag', color: 'text-blue-500', icon: '🏢' }
    default:
      return { text: 'Okänt', color: 'text-slate-400', icon: '❓' }
  }
}

// 🆕 UPPDATERAD: Utility för att formatera chart tooltips med nya namn
export const formatTooltipValue = (value: any, name: string): string => {
  // Hantera nya namn
  if (name.toLowerCase().includes('merförsäljning') || 
      name.toLowerCase().includes('engångsjobb') || 
      name.toLowerCase().includes('intäkt') || 
      name.toLowerCase().includes('kostnad') || 
      name.toLowerCase().includes('pris')) {
    return formatCurrency(Number(value))
  }
  
  if (name.toLowerCase().includes('procent') || name === 'CAC' || name.includes('%')) {
    return formatPercentage(Number(value))
  }
  
  if (name.toLowerCase().includes('kunder') || 
      name.toLowerCase().includes('ärenden') || 
      name.toLowerCase().includes('antal')) {
    return Number(value).toString()
  }
  
  return String(value)
}

// 🆕 UPPDATERAD: Mappning för chart labels med nya namn
export const getRevenueChartLabel = (key: string): string => {
  const labelMap: { [key: string]: string } = {
    'contract_revenue': 'Kontraktsintäkter',
    'case_revenue': 'Merförsäljning Avtal', // 🆕 Nytt namn
    'begone_revenue': 'Intäkter Engångsjobb', // 🆕 Nytt namn
    'total_revenue': 'Total Intäkt',
    'private_revenue': 'Privatpersoner',
    'business_revenue': 'Företag',
    'total_begone_revenue': 'Totala Engångsjobb' // 🆕 Nytt namn
  }
  
  return labelMap[key] || key
}

// Export all formatters as a utility object
export const formatters = {
  currency: formatCurrency,
  number: formatNumber,
  percentage: formatPercentage,
  date: formatDate,
  month: formatMonth,
  fullMonth: formatFullMonth,
  compactNumber: formatCompactNumber,
  currencyAxis: formatCurrencyAxis,
  largeCurrency: formatLargeCurrency,
  days: formatDays,
  technicianName: formatTechnicianName,
  accountManagerName: formatAccountManagerName,
  riskLevel: formatRiskLevel,
  contractStatus: formatContractStatus,
  caseStatus: formatCaseStatus,
  swedishDate: formatSwedishDate,
  relativeDate: formatRelativeDate,
  completionTime: formatCompletionTime,
  cac: formatCAC,
  growth: formatGrowth,
  revenueType: formatRevenueType, // 🆕 Ny funktion
  begoneCaseType: formatBeGoneCaseType,
  tooltipValue: formatTooltipValue,
  revenueChartLabel: getRevenueChartLabel // 🆕 Ny funktion
}