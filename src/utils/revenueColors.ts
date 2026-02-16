// Revenue stream color constants - used consistently across all economics charts
export const REVENUE_COLORS = {
  contract: '#20c58f',   // brand green - Avtalsintäkter
  case: '#60a5fa',       // blue-400 - Merförsäljning/Case
  engangsjobb: '#c084fc'  // purple-400 - Engångsjobb
} as const

export const REVENUE_LABELS = {
  contract: 'Avtalsintäkter',
  case: 'Merförsäljning',
  engangsjobb: 'Engångsjobb'
} as const
