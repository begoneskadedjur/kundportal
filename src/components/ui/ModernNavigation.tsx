// 📁 src/components/ui/ModernNavigation.tsx - Period och Datum Navigation
import React from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'
import ModernCard from './ModernCard'

interface PeriodSelectorProps {
  periods: Array<{
    key: string
    label: string
    shortLabel?: string
  }>
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  className?: string
  compact?: boolean
}

interface MonthNavigatorProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
  canGoPrevious: boolean
  canGoNext: boolean
  onGoToCurrent?: () => void
  isCurrentMonth: boolean
  className?: string
}

interface CalendarWidgetProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
  canGoPrevious: boolean
  canGoNext: boolean
  className?: string
  highlightedDates?: string[] // Array of dates to highlight (YYYY-MM-DD format)
}

interface CombinedNavigationProps {
  selectedMonth: string
  onMonthChange: (month: string) => void
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  periods: Array<{
    key: string
    label: string
    shortLabel?: string
  }>
  canGoPrevious: boolean
  canGoNext: boolean
  onGoToCurrent?: () => void
  isCurrentMonth: boolean
  className?: string
  compact?: boolean
}

// Period Selector Component
const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  periods,
  selectedPeriod,
  onPeriodChange,
  className = '',
  compact = false
}) => {
  return (
    <div className={`flex bg-slate-800/80 backdrop-blur-sm rounded-xl p-1 shadow-lg ${className}`}>
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onPeriodChange(period.key)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${selectedPeriod === period.key
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }
            ${compact ? 'px-2 py-1 text-xs' : ''}
          `}
        >
          {compact && period.shortLabel ? period.shortLabel : period.label}
        </button>
      ))}
    </div>
  )
}

// Month Navigator Component
const MonthNavigator: React.FC<MonthNavigatorProps> = ({
  selectedMonth,
  onMonthChange,
  canGoPrevious,
  canGoNext,
  onGoToCurrent,
  isCurrentMonth,
  className = ''
}) => {
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  const goToPrevious = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevDate = new Date(year, month - 2)
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    onMonthChange(newMonth)
  }

  const goToNext = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month)
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    onMonthChange(newMonth)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center bg-slate-800/80 backdrop-blur-sm rounded-xl p-1 shadow-lg">
        <button
          onClick={goToPrevious}
          disabled={!canGoPrevious}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${canGoPrevious 
              ? 'text-slate-300 hover:text-white hover:bg-slate-700/50 hover:scale-110' 
              : 'text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="px-4 py-2 text-white font-medium min-w-[140px] text-center">
          {formatMonth(selectedMonth)}
        </div>
        
        <button
          onClick={goToNext}
          disabled={!canGoNext}
          className={`
            p-2 rounded-lg transition-all duration-200
            ${canGoNext 
              ? 'text-slate-300 hover:text-white hover:bg-slate-700/50 hover:scale-110' 
              : 'text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {onGoToCurrent && !isCurrentMonth && (
        <button
          onClick={onGoToCurrent}
          className="px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg shadow-lg shadow-green-500/25 hover:scale-105 transition-all duration-200"
        >
          Idag
        </button>
      )}
    </div>
  )
}

// Calendar Widget Component
const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  selectedMonth,
  onMonthChange,
  canGoPrevious,
  canGoNext,
  className = '',
  highlightedDates = []
}) => {
  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  }

  const goToPrevious = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevDate = new Date(year, month - 2)
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    onMonthChange(newMonth)
  }

  const goToNext = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month)
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    onMonthChange(newMonth)
  }

  // Generate calendar days
  const [year, month] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Monday = 0

  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const currentDay = today.getDate()

  return (
    <ModernCard className={`min-w-[280px] ${className}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          <span className="text-white font-semibold">{formatMonth(selectedMonth)}</span>
          <div className="flex gap-1">
            <button 
              onClick={goToPrevious}
              disabled={!canGoPrevious}
              className={`p-1 rounded hover:bg-slate-700 transition-colors ${
                !canGoPrevious ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={goToNext}
              disabled={!canGoNext}
              className={`p-1 rounded hover:bg-slate-700 transition-colors ${
                !canGoNext ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(day => (
            <div key={day} className="text-center text-slate-500 py-1 font-medium">{day}</div>
          ))}
          
          {/* Empty cells for days before month starts */}
          {Array.from({ length: adjustedFirstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="py-1"></div>
          ))}
          
          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = isCurrentMonth && day === currentDay
            const isHighlighted = highlightedDates.includes(dateString)
            
            return (
              <div 
                key={day} 
                className={`
                  text-center py-1 rounded cursor-pointer transition-all hover:bg-slate-700 text-slate-400
                  ${isToday ? 'bg-blue-600 text-white font-bold shadow-lg' : ''}
                  ${isHighlighted ? 'bg-green-600/50 text-green-200' : ''}
                `}
              >
                {day}
              </div>
            )
          })}
        </div>
      </div>
    </ModernCard>
  )
}

// Combined Navigation Component
const CombinedNavigation: React.FC<CombinedNavigationProps> = ({
  selectedMonth,
  onMonthChange,
  selectedPeriod,
  onPeriodChange,
  periods,
  canGoPrevious,
  canGoNext,
  onGoToCurrent,
  isCurrentMonth,
  className = '',
  compact = false
}) => {
  return (
    <div className={`flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between ${className}`}>
      <MonthNavigator
        selectedMonth={selectedMonth}
        onMonthChange={onMonthChange}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        onGoToCurrent={onGoToCurrent}
        isCurrentMonth={isCurrentMonth}
      />
      
      <PeriodSelector
        periods={periods}
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
        compact={compact}
      />
    </div>
  )
}

// Export components
export {
  PeriodSelector,
  MonthNavigator,
  CalendarWidget,
  CombinedNavigation
}