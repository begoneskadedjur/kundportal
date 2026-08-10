// src/components/shared/ViewSwitcher.tsx
// Generell vyväxlare för användare med flera portalroller (admin/koordinator/tekniker/säljare).
// Ersätter de tidigare hårdkodade "Byt till X-vy"-knapparna som bara hanterade
// kombinationen tekniker+admin. Renderar en knapp per tillgänglig vy utom den aktiva.

import { useNavigate } from 'react-router-dom'
import { Shield, CalendarDays, Wrench, TrendingUp } from 'lucide-react'
import { useAuth, VIEW_PATHS, VIEW_LABELS, type ActiveView } from '../../contexts/AuthContext'

const VIEW_ICONS: Record<ActiveView, React.ElementType> = {
  admin: Shield,
  koordinator: CalendarDays,
  technician: Wrench,
  säljare: TrendingUp,
}

interface ViewSwitcherProps {
  /** Vyn som layouten tillhör (visas inte som knapp) */
  currentView: ActiveView
  /** 'sidebar' = fullbreddsknappar, 'header' = kompakta knappar, 'mobile' = fullbredd med onNavigate */
  variant?: 'sidebar' | 'header' | 'mobile'
  /** Sidomeny i kollapsat läge (endast ikoner) */
  collapsed?: boolean
  /** Anropas efter byte (t.ex. stäng mobilmeny) */
  onNavigate?: () => void
}

export function ViewSwitcher({ currentView, variant = 'sidebar', collapsed = false, onNavigate }: ViewSwitcherProps) {
  const { availableViews, setActiveView } = useAuth()
  const navigate = useNavigate()

  const otherViews = availableViews.filter(v => v !== currentView)
  if (otherViews.length === 0) return null

  const switchTo = (view: ActiveView) => {
    setActiveView(view)
    navigate(VIEW_PATHS[view])
    onNavigate?.()
  }

  if (variant === 'header') {
    return (
      <>
        {otherViews.map(view => {
          const Icon = VIEW_ICONS[view]
          return (
            <button
              key={view}
              onClick={() => switchTo(view)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
              title={`Byt till ${VIEW_LABELS[view]}-vy`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{VIEW_LABELS[view]}-vy</span>
            </button>
          )
        })}
      </>
    )
  }

  // sidebar / mobile
  return (
    <div className={`px-3 py-2 border-b border-slate-700/50 ${collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}`}>
      {otherViews.map(view => {
        const Icon = VIEW_ICONS[view]
        if (collapsed) {
          return (
            <button
              key={view}
              onClick={() => switchTo(view)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
              title={`Byt till ${VIEW_LABELS[view]}-vy`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        }
        return (
          <button
            key={view}
            onClick={() => switchTo(view)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-all"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Byt till {VIEW_LABELS[view]}-vy</span>
          </button>
        )
      })}
    </div>
  )
}
