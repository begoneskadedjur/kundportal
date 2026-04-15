// 📁 src/components/admin/commissions/CommissionMonthSelector.tsx - Månadsnavigation med pilar (← Juni 2025 | Juli 2025 | Augusti 2025 →)
import React from 'react'
import Select from '../../ui/Select'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'
import type { MonthSelection } from '../../../types/commission'

interface CommissionMonthSelectorProps {
  selectedMonth: MonthSelection
  monthOptions: MonthSelection[]
  onMonthChange: (month: MonthSelection) => void
  onNavigate: (direction: 'prev' | 'next') => void
  canNavigatePrev: boolean
  canNavigateNext: boolean
  loading?: boolean
}

const CommissionMonthSelector: React.FC<CommissionMonthSelectorProps> = ({
  selectedMonth,
  monthOptions,
  onMonthChange,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  loading = false
}) => {
  const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth.value)
  const previousMonth = canNavigatePrev ? monthOptions[currentIndex + 1] : null
  const nextMonth = canNavigateNext ? monthOptions[currentIndex - 1] : null

  return (
    <div className="flex items-center justify-between mb-8">
      {/* Vänster sida - Navigation */}
      <div className="flex items-center space-x-4">
        {/* Föregående månad knapp */}
        <button
          onClick={() => onNavigate('prev')}
          disabled={!canNavigatePrev || loading}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
            ${canNavigatePrev && !loading
              ? 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-500 text-slate-300 hover:text-white'
              : 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">
            {previousMonth ? previousMonth.display : 'Tidigare'}
          </span>
        </button>

        {/* Aktuell månad - stor display */}
        <div className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Calendar className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Vald period</p>
            <h2 className="text-xl font-bold text-white">{selectedMonth.display}</h2>
          </div>
          {loading && (
            <div className="ml-2">
              <Clock className="w-4 h-4 text-green-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Nästa månad knapp */}
        <button
          onClick={() => onNavigate('next')}
          disabled={!canNavigateNext || loading}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
            ${canNavigateNext && !loading
              ? 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-500 text-slate-300 hover:text-white'
              : 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          <span className="text-sm">
            {nextMonth ? nextMonth.display : 'Senare'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Höger sida - Snabb månadsväljare */}
      <div className="flex items-center space-x-3">
        {/* Quick access - senaste 3 månaderna */}
        <div className="flex items-center space-x-1">
          <span className="text-sm text-slate-400 mr-2">Snabbal:</span>
          {monthOptions.slice(0, 3).map((month) => (
            <button
              key={month.value}
              onClick={() => onMonthChange(month)}
              disabled={loading}
              className={`
                px-3 py-1 text-sm rounded-lg border transition-all duration-200
                ${month.value === selectedMonth.value
                  ? 'border-green-500/50 bg-green-500/20 text-green-400'
                  : 'border-slate-600 bg-slate-800/30 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {getShortMonthName(month.display)}
            </button>
          ))}
        </div>

        {/* Dropdown för alla månader */}
        <div className="relative">
          <Select
            value={selectedMonth.value}
            onChange={(v) => {
              const month = monthOptions.find(m => m.value === v)
              if (month) onMonthChange(month)
            }}
            disabled={loading}
            options={monthOptions.map(month => ({ value: month.value, label: month.display }))}
          />

        </div>
      </div>
    </div>
  )
}

// Helper function för korta månadsnamn
const getShortMonthName = (fullName: string): string => {
  const monthMap: { [key: string]: string } = {
    'Januari': 'Jan',
    'Februari': 'Feb', 
    'Mars': 'Mar',
    'April': 'Apr',
    'Maj': 'Maj',
    'Juni': 'Jun',
    'Juli': 'Jul',
    'Augusti': 'Aug',
    'September': 'Sep',
    'Oktober': 'Okt',
    'November': 'Nov',
    'December': 'Dec'
  }
  
  for (const [full, short] of Object.entries(monthMap)) {
    if (fullName.includes(full)) {
      return short + ' ' + fullName.split(' ')[1] // "Jul 2025"
    }
  }
  
  return fullName.split(' ')[0].slice(0, 3) + ' ' + fullName.split(' ')[1]
}

export default CommissionMonthSelector