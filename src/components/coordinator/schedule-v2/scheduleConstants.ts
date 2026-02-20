// scheduleConstants.ts — Konstanter för egenbyggd schemavy

export const HOUR_WIDTH = 120       // px per timme (dagvy)
export const ROW_HEIGHT = 88        // px per teknikerrad
export const TECH_COL_WIDTH = 224   // px teknikerkolumn (sticky)
export const DAY_START_HOUR = 6     // 06:00
export const DAY_END_HOUR = 20      // 20:00
export const SNAP_MINUTES = 15
export const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR // 14h
export const GRID_WIDTH = TOTAL_HOURS * HOUR_WIDTH        // 1680px

// Unika färger per tekniker (cykliskt)
export const TECH_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
] as const

// Statusfärger — semi-transparenta bakgrunder + solid border-left
export function getStatusStyle(status: string, caseType?: string) {
  const ls = (status || '').toLowerCase()

  if (ls.includes('avtalsärende') || caseType === 'contract') {
    if (ls.includes('avslutat')) return { bg: 'bg-purple-700/25', border: 'border-l-purple-600', text: 'text-purple-200' }
    if (ls.includes('pågående')) return { bg: 'bg-purple-500/20', border: 'border-l-purple-500', text: 'text-purple-200' }
    return { bg: 'bg-purple-500/20', border: 'border-l-purple-500', text: 'text-purple-200' }
  }

  if (ls.includes('avslutat'))   return { bg: 'bg-emerald-600/20', border: 'border-l-emerald-500', text: 'text-emerald-200' }
  if (ls.startsWith('återbesök'))return { bg: 'bg-blue-500/20', border: 'border-l-blue-500', text: 'text-blue-200' }
  if (ls.includes('signerad'))   return { bg: 'bg-[#20c58f]/20', border: 'border-l-[#20c58f]', text: 'text-emerald-200' }
  if (ls.includes('offert'))     return { bg: 'bg-orange-500/20', border: 'border-l-orange-500', text: 'text-orange-200' }
  if (ls.includes('bokad') || ls.includes('bokat'))
    return { bg: 'bg-amber-500/20', border: 'border-l-amber-500', text: 'text-amber-200' }
  if (ls.includes('review'))     return { bg: 'bg-violet-500/20', border: 'border-l-violet-500', text: 'text-violet-200' }
  if (ls.includes('stängt'))     return { bg: 'bg-red-500/20', border: 'border-l-red-500', text: 'text-red-300' }

  return { bg: 'bg-slate-500/15', border: 'border-l-slate-500', text: 'text-slate-300' }
}

// Legend-poster för StatusLegend
export const STATUS_LEGEND = [
  { label: 'Öppen',      color: 'bg-sky-500' },
  { label: 'Bokad',      color: 'bg-amber-500' },
  { label: 'Offert',     color: 'bg-orange-500' },
  { label: 'Signerad',   color: 'bg-[#20c58f]' },
  { label: 'Återbesök',  color: 'bg-blue-500' },
  { label: 'Avtal',      color: 'bg-purple-500' },
  { label: 'Avslutat',   color: 'bg-emerald-600' },
] as const
