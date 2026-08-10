// src/components/shared/ViewSwitcher.tsx
// Segmenterad vyväxlare för användare med flera portalroller.
// Visar alla tillgängliga vyer som en modern toggle där den aktiva är markerad,
// i stället för separata "Byt till X-vy"-knappar. Renderas inte alls om
// användaren bara har en vy.

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
  /** Vyn som layouten tillhör (markeras som aktiv) */
  currentView: ActiveView
  /** 'sidebar' = fullbredd i sidomenyn, 'header' = kompakt i topheadern, 'mobile' = fullbredd i mobilmenyn */
  variant?: 'sidebar' | 'header' | 'mobile'
  /** Sidomeny i kollapsat läge (endast ikoner, vertikalt) */
  collapsed?: boolean
  /** Anropas efter byte (t.ex. stäng mobilmeny) */
  onNavigate?: () => void
}

export function ViewSwitcher({ currentView, variant = 'sidebar', collapsed = false, onNavigate }: ViewSwitcherProps) {
  const { availableViews, setActiveView } = useAuth()
  const navigate = useNavigate()

  if (availableViews.length < 2) return null

  const switchTo = (view: ActiveView) => {
    if (view === currentView) return
    setActiveView(view)
    navigate(VIEW_PATHS[view])
    onNavigate?.()
  }

  // Kollapsad sidomeny: vertikala ikonknappar med aktiv markering
  if (variant === 'sidebar' && collapsed) {
    return (
      <div className="px-3 py-2 border-b border-slate-700/50 flex flex-col items-center gap-1">
        {availableViews.map(view => {
          const Icon = VIEW_ICONS[view]
          const isActive = view === currentView
          return (
            <button
              key={view}
              onClick={() => switchTo(view)}
              title={isActive ? `${VIEW_LABELS[view]}-vy (aktiv)` : `Byt till ${VIEW_LABELS[view]}-vy`}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-[#20c58f]/15 text-[#20c58f]'
                  : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>
    )
  }

  const segmented = (
    <div
      role="tablist"
      aria-label="Byt vy"
      className={`flex p-0.5 bg-slate-800/80 border border-slate-700/60 rounded-lg ${variant === 'header' ? '' : 'w-full'}`}
    >
      {availableViews.map(view => {
        const isActive = view === currentView
        return (
          <button
            key={view}
            role="tab"
            aria-selected={isActive}
            onClick={() => switchTo(view)}
            title={isActive ? undefined : `Byt till ${VIEW_LABELS[view]}-vy`}
            className={`
              flex-1 flex items-center justify-center px-2.5 rounded-md text-xs font-medium whitespace-nowrap
              transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#20c58f] outline-none
              ${variant === 'mobile' ? 'py-2 text-sm' : 'py-1.5'}
              ${isActive
                ? 'bg-[#20c58f] text-[#fff] shadow-sm shadow-[#20c58f]/30'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            {VIEW_LABELS[view]}
          </button>
        )
      })}
    </div>
  )

  if (variant === 'header') return segmented

  return (
    <div className={variant === 'mobile' ? 'pb-1' : 'px-3 py-2 border-b border-slate-700/50'}>
      {segmented}
    </div>
  )
}
