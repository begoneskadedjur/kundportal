// src/utils/customerMetrics.ts - Customer success metrics och beräkningar med tooltips

interface Customer {
  id: string
  company_name: string
  contract_status?: string
  contract_start_date?: string | null
  contract_end_date?: string | null
  contract_length?: string | null
  total_contract_value?: number | null
  annual_value?: number | null
  monthly_value?: number | null
  created_at?: string | null
  // TODO: Lägg till dessa fält när de finns i databasen
  last_communication_date?: string | null
  support_tickets_count?: number
  payment_delays_count?: number
  previous_renewals_count?: number
}

interface HealthScoreResult {
  score: number
  level: 'excellent' | 'good' | 'fair' | 'poor'
  color: string
  breakdown: {
    contractAge: { value: number; weight: number; score: number }
    communicationFrequency: { value: number; weight: number; score: number }
    supportTickets: { value: number; weight: number; score: number }
    paymentHistory: { value: number; weight: number; score: number }
  }
  tooltip: string
}

interface ChurnRiskResult {
  risk: 'low' | 'medium' | 'high'
  score: number
  color: string
  factors: string[]
  tooltip: string
}

interface RenewalProbabilityResult {
  probability: number
  confidence: 'high' | 'medium' | 'low'
  factors: {
    healthScore: number
    customerSatisfaction: number
    contractValueTrend: number
  }
  tooltip: string
}

interface ContractProgressResult {
  percentage: number
  monthsElapsed: number
  monthsTotal: number
  monthsRemaining: number
  daysRemaining: number
  tooltip: string
  status: 'just-started' | 'active' | 'expiring-soon' | 'expired'
}

interface ContractPeriodResult {
  display: string
  daysRemaining: number
  monthsRemaining: number
  isExpired: boolean
  isExpiringSoon: boolean
  tooltip: string
}

/**
 * Beräknar Health Score för en kund
 * Returnerar poäng 0-100 med breakdown och tooltip
 */
export function calculateHealthScore(customer: Customer): HealthScoreResult {
  const now = new Date()
  
  // 1. Contract Age Score (25%) - Längre kontrakt = bättre
  let contractAgeScore = 0
  let contractAgeMonths = 0
  if (customer.contract_start_date) {
    const startDate = new Date(customer.contract_start_date)
    contractAgeMonths = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    
    if (contractAgeMonths >= 36) contractAgeScore = 100
    else if (contractAgeMonths >= 24) contractAgeScore = 85
    else if (contractAgeMonths >= 12) contractAgeScore = 70
    else if (contractAgeMonths >= 6) contractAgeScore = 50
    else contractAgeScore = 30
  }
  
  // 2. Communication Frequency Score (25%) - Simulerad för nu
  const daysSinceLastComm = customer.last_communication_date 
    ? Math.floor((now.getTime() - new Date(customer.last_communication_date).getTime()) / (1000 * 60 * 60 * 24))
    : 30 // Default till 30 dagar om ingen data
  
  let communicationScore = 0
  if (daysSinceLastComm <= 7) communicationScore = 100
  else if (daysSinceLastComm <= 14) communicationScore = 85
  else if (daysSinceLastComm <= 30) communicationScore = 70
  else if (daysSinceLastComm <= 60) communicationScore = 40
  else communicationScore = 20
  
  // 3. Support Tickets Score (25%) - Färre tickets = bättre
  const ticketCount = customer.support_tickets_count || 0
  let supportScore = 0
  if (ticketCount === 0) supportScore = 100
  else if (ticketCount <= 2) supportScore = 85
  else if (ticketCount <= 5) supportScore = 60
  else if (ticketCount <= 10) supportScore = 30
  else supportScore = 10
  
  // 4. Payment History Score (25%)
  const paymentDelays = customer.payment_delays_count || 0
  let paymentScore = 0
  if (paymentDelays === 0) paymentScore = 100
  else if (paymentDelays === 1) paymentScore = 75
  else if (paymentDelays === 2) paymentScore = 50
  else paymentScore = 20
  
  // Beräkna total score
  const breakdown = {
    contractAge: { value: contractAgeMonths, weight: 0.25, score: contractAgeScore },
    communicationFrequency: { value: daysSinceLastComm, weight: 0.25, score: communicationScore },
    supportTickets: { value: ticketCount, weight: 0.25, score: supportScore },
    paymentHistory: { value: paymentDelays, weight: 0.25, score: paymentScore }
  }
  
  const totalScore = Math.round(
    contractAgeScore * 0.25 +
    communicationScore * 0.25 +
    supportScore * 0.25 +
    paymentScore * 0.25
  )
  
  // Bestäm level och färg
  let level: HealthScoreResult['level']
  let color: string
  
  if (totalScore >= 80) {
    level = 'excellent'
    color = 'text-green-400 bg-green-500/20'
  } else if (totalScore >= 60) {
    level = 'good'
    color = 'text-emerald-400 bg-emerald-500/20'
  } else if (totalScore >= 40) {
    level = 'fair'
    color = 'text-yellow-400 bg-yellow-500/20'
  } else {
    level = 'poor'
    color = 'text-red-400 bg-red-500/20'
  }
  
  const tooltip = `Health Score: ${totalScore}/100
  
Beräkning:
• Kontraktsålder (25%): ${contractAgeScore}/100 - ${contractAgeMonths} månader
• Kommunikation (25%): ${communicationScore}/100 - Senast ${daysSinceLastComm} dagar sedan
• Supportärenden (25%): ${supportScore}/100 - ${ticketCount} ärenden
• Betalningshistorik (25%): ${paymentScore}/100 - ${paymentDelays} förseningar`
  
  return {
    score: totalScore,
    level,
    color,
    breakdown,
    tooltip
  }
}

/**
 * Beräknar Churn Risk för en kund
 * Returnerar risknivå med faktorer och tooltip
 */
export function calculateChurnRisk(customer: Customer): ChurnRiskResult {
  const factors: string[] = []
  let riskScore = 0
  
  // 1. Tid till kontraktsslut
  const contractProgress = getContractProgress(
    customer.contract_start_date,
    customer.contract_end_date
  )
  
  if (contractProgress.daysRemaining <= 30) {
    riskScore += 40
    factors.push('Kontrakt löper ut inom 30 dagar')
  } else if (contractProgress.daysRemaining <= 90) {
    riskScore += 25
    factors.push('Kontrakt löper ut inom 90 dagar')
  } else if (contractProgress.daysRemaining <= 180) {
    riskScore += 10
    factors.push('Kontrakt löper ut inom 6 månader')
  }
  
  // 2. Health Score
  const healthScore = calculateHealthScore(customer)
  if (healthScore.score < 40) {
    riskScore += 30
    factors.push('Låg Health Score')
  } else if (healthScore.score < 60) {
    riskScore += 15
    factors.push('Medel Health Score')
  }
  
  // 3. Kontraktsvärde (lägre värde = högre risk att förlora)
  const annualValue = customer.annual_value || 0
  if (annualValue < 50000) {
    riskScore += 15
    factors.push('Lågt kontraktsvärde')
  }
  
  // 4. Historisk förnyelserate (simulerad)
  const previousRenewals = customer.previous_renewals_count || 0
  if (previousRenewals === 0) {
    riskScore += 15
    factors.push('Första kontraktsperioden')
  }
  
  // Bestäm risknivå
  let risk: ChurnRiskResult['risk']
  let color: string
  
  if (riskScore >= 60) {
    risk = 'high'
    color = 'text-red-400 bg-red-500/20'
  } else if (riskScore >= 30) {
    risk = 'medium'
    color = 'text-yellow-400 bg-yellow-500/20'
  } else {
    risk = 'low'
    color = 'text-green-400 bg-green-500/20'
  }
  
  if (factors.length === 0) {
    factors.push('Inga identifierade riskfaktorer')
  }
  
  const tooltip = `Churn Risk: ${risk.toUpperCase()} (${riskScore}/100)
  
Riskfaktorer:
${factors.map(f => `• ${f}`).join('\n')}

Beräkningen baseras på:
• Tid till kontraktsslut (40p max)
• Health Score (30p max)
• Kontraktsvärde (15p max)
• Historisk förnyelse (15p max)`
  
  return {
    risk,
    score: riskScore,
    color,
    factors,
    tooltip
  }
}

/**
 * Beräknar sannolikhet för förnyelse
 * Returnerar procent med konfidensgrad och tooltip
 */
export function calculateRenewalProbability(customer: Customer): RenewalProbabilityResult {
  // Health Score påverkar 40%
  const healthScore = calculateHealthScore(customer)
  const healthFactor = (healthScore.score / 100) * 0.4
  
  // Kundnöjdhet (simulerad) påverkar 30%
  // Baserat på support tickets och kommunikation
  const supportTickets = customer.support_tickets_count || 0
  let satisfactionScore = 1.0
  if (supportTickets === 0) satisfactionScore = 1.0
  else if (supportTickets <= 2) satisfactionScore = 0.85
  else if (supportTickets <= 5) satisfactionScore = 0.6
  else satisfactionScore = 0.3
  const satisfactionFactor = satisfactionScore * 0.3
  
  // Kontraktsvärde trend påverkar 30%
  // Högre värde = mer sannolikt att förnya
  const annualValue = customer.annual_value || 0
  let valueTrendScore = 0.5 // Default medel
  if (annualValue >= 200000) valueTrendScore = 1.0
  else if (annualValue >= 100000) valueTrendScore = 0.8
  else if (annualValue >= 50000) valueTrendScore = 0.6
  else valueTrendScore = 0.4
  const valueFactor = valueTrendScore * 0.3
  
  // Total sannolikhet
  const probability = Math.round((healthFactor + satisfactionFactor + valueFactor) * 100)
  
  // Bestäm konfidensgrad baserat på datatillgänglighet
  let confidence: RenewalProbabilityResult['confidence']
  if (healthScore.score > 0 && supportTickets !== undefined) {
    confidence = 'high'
  } else if (healthScore.score > 0) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }
  
  const tooltip = `Förnyelsesannolikhet: ${probability}%
  
Beräkning (Konfidens: ${confidence}):
• Health Score (40%): ${Math.round(healthFactor * 100)}% - Baserat på övergripande hälsa
• Kundnöjdhet (30%): ${Math.round(satisfactionFactor * 100)}% - ${supportTickets} supportärenden
• Värdetrend (30%): ${Math.round(valueFactor * 100)}% - ${annualValue.toLocaleString('sv-SE')} kr/år

Högre Health Score, färre supportärenden och högre kontraktsvärde 
indikerar högre sannolikhet för förnyelse.`
  
  return {
    probability,
    confidence,
    factors: {
      healthScore: Math.round(healthFactor * 100),
      customerSatisfaction: Math.round(satisfactionFactor * 100),
      contractValueTrend: Math.round(valueFactor * 100)
    },
    tooltip
  }
}

/**
 * Beräknar kontraktets progress
 * Returnerar procent, månader och tooltip
 */
export function getContractProgress(
  startDate?: string | null,
  endDate?: string | null
): ContractProgressResult {
  if (!startDate || !endDate) {
    return {
      percentage: 0,
      monthsElapsed: 0,
      monthsTotal: 0,
      monthsRemaining: 0,
      daysRemaining: 0,
      tooltip: 'Kontraktsdatum saknas',
      status: 'active'
    }
  }
  
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const totalMs = end.getTime() - start.getTime()
  const elapsedMs = now.getTime() - start.getTime()
  const remainingMs = end.getTime() - now.getTime()
  
  const percentage = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
  
  const monthsTotal = Math.round(totalMs / (1000 * 60 * 60 * 24 * 30))
  const monthsElapsed = Math.round(elapsedMs / (1000 * 60 * 60 * 24 * 30))
  const monthsRemaining = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60 * 24 * 30)))
  const daysRemaining = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60 * 24)))
  
  let status: ContractProgressResult['status']
  if (daysRemaining <= 0) status = 'expired'
  else if (daysRemaining <= 90) status = 'expiring-soon'
  else if (monthsElapsed <= 3) status = 'just-started'
  else status = 'active'
  
  const tooltip = `Kontraktsprogress: ${percentage}%
  
${monthsElapsed} av ${monthsTotal} månader har gått
${monthsRemaining} månader återstår (${daysRemaining} dagar)

Status: ${
    status === 'expired' ? 'Utgånget' :
    status === 'expiring-soon' ? 'Löper ut snart!' :
    status === 'just-started' ? 'Nyligen startat' :
    'Aktivt'
  }`
  
  return {
    percentage,
    monthsElapsed,
    monthsTotal,
    monthsRemaining,
    daysRemaining,
    tooltip,
    status
  }
}

/**
 * Formaterar kontraktsperiod för visning
 * Returnerar formaterad sträng med tooltip
 */
export function formatContractPeriod(
  startDate?: string | null,
  endDate?: string | null
): ContractPeriodResult {
  if (!startDate || !endDate) {
    return {
      display: 'Ingen period',
      daysRemaining: 0,
      monthsRemaining: 0,
      isExpired: false,
      isExpiringSoon: false,
      tooltip: 'Kontraktsdatum saknas'
    }
  }
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()
  
  const startStr = start.toLocaleDateString('sv-SE', { 
    month: 'short', 
    year: 'numeric' 
  })
  const endStr = end.toLocaleDateString('sv-SE', { 
    month: 'short', 
    year: 'numeric' 
  })
  
  const daysRemaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const monthsRemaining = Math.max(0, Math.round(daysRemaining / 30))
  const contractYears = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365))
  
  const isExpired = daysRemaining <= 0
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 90
  
  let statusText = ''
  if (isExpired) {
    statusText = 'Kontraktet har löpt ut!'
  } else if (isExpiringSoon) {
    statusText = `Löper ut om ${daysRemaining} dagar!`
  } else {
    statusText = `${daysRemaining} dagar kvar`
  }
  
  const tooltip = `Kontraktsperiod: ${contractYears} år
  
Start: ${start.toLocaleDateString('sv-SE')}
Slut: ${end.toLocaleDateString('sv-SE')}

${statusText}
${!isExpired ? `(${monthsRemaining} månader återstår)` : ''}`
  
  return {
    display: `${startStr} - ${endStr}`,
    daysRemaining,
    monthsRemaining,
    isExpired,
    isExpiringSoon,
    tooltip
  }
}

/**
 * Formaterar valuta för visning
 */
export function formatCurrency(value: number | null | undefined): string {
  if (!value) return '0 kr'
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Beräknar total portföljvärde
 */
export function calculatePortfolioValue(customers: Customer[]): number {
  return customers.reduce((sum, customer) => {
    return sum + (customer.total_contract_value || 0)
  }, 0)
}

/**
 * Räknar aktiva kunder
 */
export function countActiveCustomers(customers: Customer[]): number {
  return customers.filter(c => 
    c.contract_status === 'active' || c.contract_status === 'signed'
  ).length
}

/**
 * Beräknar förnyelsevärde (kontrakt som löper ut inom X dagar)
 */
export function calculateRenewalValue(customers: Customer[], daysAhead = 90): number {
  return customers
    .filter(customer => {
      const progress = getContractProgress(customer.contract_start_date, customer.contract_end_date)
      return progress.daysRemaining > 0 && progress.daysRemaining <= daysAhead
    })
    .reduce((sum, customer) => sum + (customer.total_contract_value || 0), 0)
}

/**
 * Räknar kunder med hög churn risk
 */
export function countHighRiskCustomers(customers: Customer[]): number {
  return customers.filter(customer => {
    const risk = calculateChurnRisk(customer)
    return risk.risk === 'high'
  }).length
}