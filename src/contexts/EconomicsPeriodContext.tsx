import React, { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

export type PeriodType = '1m' | '3m' | '6m' | '12m' | 'ytd'

interface DateRange {
  start: string
  end: string
}

interface EconomicsPeriodContextType {
  periodType: PeriodType
  setPeriodType: (p: PeriodType) => void
  dateRange: DateRange
  previousDateRange: DateRange
  monthsInPeriod: number
}

const EconomicsPeriodContext = createContext<EconomicsPeriodContextType | undefined>(undefined)

function computeDateRange(periodType: PeriodType): { dateRange: DateRange; previousDateRange: DateRange; monthsInPeriod: number } {
  const now = new Date()
  const end = now.toISOString().split('T')[0]

  let monthsBack: number
  if (periodType === 'ytd') {
    monthsBack = now.getMonth() + 1
  } else {
    monthsBack = parseInt(periodType)
  }

  // Current period start
  const startDate = periodType === 'ytd'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1)
  const start = startDate.toISOString().split('T')[0]

  // Previous period (same length, shifted backward)
  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setMonth(prevStart.getMonth() - monthsBack + 1)
  prevStart.setDate(1)

  return {
    dateRange: { start, end },
    previousDateRange: {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    },
    monthsInPeriod: monthsBack
  }
}

export function EconomicsPeriodProvider({ children }: { children: ReactNode }) {
  const [periodType, setPeriodType] = useState<PeriodType>('6m')

  const computed = useMemo(() => computeDateRange(periodType), [periodType])

  const value: EconomicsPeriodContextType = {
    periodType,
    setPeriodType,
    dateRange: computed.dateRange,
    previousDateRange: computed.previousDateRange,
    monthsInPeriod: computed.monthsInPeriod
  }

  return (
    <EconomicsPeriodContext.Provider value={value}>
      {children}
    </EconomicsPeriodContext.Provider>
  )
}

export function useEconomicsPeriod(): EconomicsPeriodContextType {
  const context = useContext(EconomicsPeriodContext)
  if (!context) {
    throw new Error('useEconomicsPeriod must be used within EconomicsPeriodProvider')
  }
  return context
}
