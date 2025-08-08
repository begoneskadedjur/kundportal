// src/components/admin/customers/ARRForecastChart.tsx - ARR forecast visualization

import React, { useMemo } from 'react'
import { TrendingDown, TrendingUp, Calendar, DollarSign, AlertTriangle } from 'lucide-react'
import Card from '../../ui/Card'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { calculateARRForecast, calculatePortfolioImpact, formatCurrency, formatLargeNumber } from '../../../utils/arrForecast'

interface Customer {
  id: string
  company_name: string
  annual_value?: number | null
  contract_start_date?: string | null
  contract_end_date?: string | null
}

interface ARRForecastChartProps {
  customers: Customer[]
}

export default function ARRForecastChart({ customers }: ARRForecastChartProps) {
  const { forecast, portfolioImpact } = useMemo(() => {
    const forecastData = calculateARRForecast(customers)
    const impact = calculatePortfolioImpact(forecastData)
    
    return {
      forecast: forecastData,
      portfolioImpact: impact
    }
  }, [customers])

  // Calculate the maximum value for chart scaling
  const maxARR = Math.max(...forecast.map(year => year.totalARR), 1)

  return (
    <div className="space-y-4">
      {/* Header with key metrics */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          ARR Prognos (5 år)
        </h3>
        <TooltipWrapper
          content="Annual Recurring Revenue - prognos baserad på nuvarande kontraktsperioder"
          position="left"
        >
          <DollarSign className="w-4 h-4 text-slate-400 cursor-help" />
        </TooltipWrapper>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <div className="text-center">
            <p className="text-xs text-slate-400">Nuvarande ARR</p>
            <p className="text-lg font-bold text-white">
              {formatLargeNumber(portfolioImpact.currentYearARR)}
            </p>
            <p className="text-xs text-slate-500">
              {formatCurrency(portfolioImpact.currentYearARR)}
            </p>
          </div>
        </Card>
        
        <Card className="p-3 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <div className="text-center">
            <p className="text-xs text-slate-400">Risk År 5</p>
            <p className="text-lg font-bold text-red-400">
              -{formatLargeNumber(portfolioImpact.totalDrop)}
            </p>
            <p className="text-xs text-slate-500">
              -{portfolioImpact.totalDropPercentage.toFixed(1)}%
            </p>
          </div>
        </Card>
      </div>

      {/* Forecast chart */}
      <Card className="p-4">
        <div className="space-y-3">
          {forecast.map((year, index) => {
            const barWidth = maxARR > 0 ? (year.totalARR / maxARR) * 100 : 0
            const isCurrentYear = index === 0
            const isDecreasing = index > 0 && year.totalARR < forecast[index - 1].totalARR
            
            return (
              <div key={year.year} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      isCurrentYear ? 'text-green-400' : 'text-slate-300'
                    }`}>
                      {year.year}
                    </span>
                    {isCurrentYear && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                        Nu
                      </span>
                    )}
                    {isDecreasing && (
                      <TooltipWrapper
                        content={`${year.expiredContracts} kontrakt löper ut (${formatCurrency(year.expiredValue)})`}
                        position="top"
                      >
                        <AlertTriangle className="w-3 h-3 text-orange-400 cursor-help" />
                      </TooltipWrapper>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">
                      {formatLargeNumber(year.totalARR)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(year.totalARR)}
                    </p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="relative">
                  <div className="w-full h-6 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        isCurrentYear ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        isDecreasing ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                        'bg-gradient-to-r from-purple-500 to-purple-600'
                      }`}
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </div>
                  
                  {/* Contract indicators */}
                  <div className="absolute inset-0 flex items-center px-2">
                    <div className="flex items-center gap-1 text-xs">
                      {year.newContracts > 0 && (
                        <TooltipWrapper content={`${year.newContracts} nya kontrakt`} position="top">
                          <span className="bg-green-600 text-white px-1.5 py-0.5 rounded text-xs cursor-help">
                            +{year.newContracts}
                          </span>
                        </TooltipWrapper>
                      )}
                      {year.expiredContracts > 0 && (
                        <TooltipWrapper content={`${year.expiredContracts} kontrakt löper ut`} position="top">
                          <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-xs cursor-help">
                            -{year.expiredContracts}
                          </span>
                        </TooltipWrapper>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Portfolio impact summary */}
      <Card className="p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/30 border-slate-600/50">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          Portfölj Impact
        </h4>
        
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Bästa år:</span>
            <span className="text-white">
              {portfolioImpact.peakYear.year} ({formatLargeNumber(portfolioImpact.peakYear.totalARR)})
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Sämsta år:</span>
            <span className="text-white">
              {portfolioImpact.lowestYear.year} ({formatLargeNumber(portfolioImpact.lowestYear.totalARR)})
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Snitt förlust/år:</span>
            <span className="text-orange-400">
              -{formatLargeNumber(portfolioImpact.avgAnnualExpiry)}
            </span>
          </div>
          
          <div className="pt-2 mt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total risk (5 år):</span>
              <span className="text-red-400 font-medium">
                -{portfolioImpact.totalDropPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Action notice */}
      {portfolioImpact.totalDropPercentage > 20 && (
        <Card className="p-3 bg-amber-500/10 border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-400 font-medium">
                Hög förnyelse-risk upptäckt
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {portfolioImpact.totalDropPercentage.toFixed(0)}% av ARR riskerar att försvinna över 5 år. 
                Fokusera på kundvård och förnyelser.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}