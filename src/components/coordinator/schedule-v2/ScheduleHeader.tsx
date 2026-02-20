// ScheduleHeader.tsx — Header med datumnavigation, vy-växlare och knappar
import { CalendarDays, ChevronLeft, ChevronRight, FileText, CalendarOff } from 'lucide-react'
import Button from '../../ui/Button'
import { StatusLegend } from './StatusLegend'
import { getWeekNumber } from './scheduleUtils'

export type ViewMode = 'day' | 'week'

interface ScheduleHeaderProps {
  currentDate: Date
  viewMode: ViewMode
  onChangeDate: (date: Date) => void
  onChangeView: (mode: ViewMode) => void
  onCreateCase: () => void
  onCreateAbsence: () => void
  stats: { scheduled: number; toBook: number; technicians: number }
}

export function ScheduleHeader({
  currentDate,
  viewMode,
  onChangeDate,
  onChangeView,
  onCreateCase,
  onCreateAbsence,
  stats,
}: ScheduleHeaderProps) {
  const weekNum = getWeekNumber(currentDate)

  const navigateDate = (delta: number) => {
    const d = new Date(currentDate)
    if (viewMode === 'day') d.setDate(d.getDate() + delta)
    else d.setDate(d.getDate() + delta * 7)
    onChangeDate(d)
  }

  const goToday = () => onChangeDate(new Date())

  const dateLabel = viewMode === 'day'
    ? currentDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `Vecka ${weekNum}`

  const dateSubLabel = viewMode === 'week'
    ? (() => {
        const start = new Date(currentDate)
        const day = start.getDay() || 7
        start.setDate(start.getDate() - day + 1)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        return `${start.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}`
      })()
    : null

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between gap-4 z-10 flex-shrink-0">
      {/* Vänster: titel + stats */}
      <div className="flex items-center gap-3 min-w-0">
        <CalendarDays className="w-5 h-5 text-blue-400 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white truncate">Schemaöversikt</h1>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{stats.scheduled} schemalagda</span>
            {stats.toBook > 0 && (
              <>
                <span className="w-1 h-1 bg-slate-600 rounded-full" />
                <span className="text-amber-400">{stats.toBook} att boka in</span>
              </>
            )}
            <span className="w-1 h-1 bg-slate-600 rounded-full" />
            <span>{stats.technicians} tekniker</span>
          </div>
        </div>
      </div>

      {/* Mitten: datum-navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigateDate(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center min-w-[180px]">
          <p className="text-sm font-semibold text-white">{dateLabel}</p>
          {dateSubLabel && <p className="text-[10px] text-slate-400">{dateSubLabel}</p>}
        </div>

        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Vy-växlare */}
        <div className="flex rounded-lg bg-slate-800/50 border border-slate-700/50 p-0.5 ml-2">
          {(['day', 'week'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => onChangeView(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === mode
                  ? 'bg-[#20c58f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode === 'day' ? 'Dag' : 'Vecka'}
            </button>
          ))}
        </div>

        <button
          onClick={goToday}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 border border-slate-700/50 transition-colors ml-1"
        >
          Idag
        </button>
      </div>

      {/* Höger: legend + knappar */}
      <div className="flex items-center gap-3">
        <div className="hidden xl:block">
          <StatusLegend />
        </div>
        <Button onClick={onCreateCase} variant="primary" className="text-sm">
          <FileText className="w-4 h-4 mr-1.5" />
          Nytt ärende
        </Button>
        <Button onClick={onCreateAbsence} variant="secondary" className="text-sm">
          <CalendarOff className="w-4 h-4 mr-1.5" />
          Frånvaro
        </Button>
      </div>
    </header>
  )
}
