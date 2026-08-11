// src/components/shared/IntranetLink.tsx
// "Intranät & Hjälpcenter"-länk för sidofältens nedre sektion och mobilmenyer.
// Ersätter gamla Hjälpcenter-länken. Badge visar antal okvitterade
// obligatoriska dokument.

import { Link } from 'react-router-dom'
import { Landmark } from 'lucide-react'
import { useIntranetBadge } from '../../hooks/useIntranetBadge'

interface IntranetLinkProps {
  /** Rollprefix, t.ex. '/admin' eller '/technician' */
  basePath: string
  collapsed?: boolean
  variant?: 'sidebar' | 'mobile'
  onNavigate?: () => void
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function IntranetLink({ basePath, collapsed = false, variant = 'sidebar', onNavigate }: IntranetLinkProps) {
  const count = useIntranetBadge()
  const to = `${basePath}/intranat`

  if (variant === 'mobile') {
    return (
      <Link
        to={to}
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
      >
        <Landmark className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">Intranät & Hjälpcenter</span>
        <Badge count={count} />
      </Link>
    )
  }

  return (
    <Link
      to={to}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors relative
        focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
        ${collapsed ? 'justify-center' : ''}
      `}
      title={collapsed ? 'Intranät & Hjälpcenter' : undefined}
    >
      <Landmark className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="text-sm">Intranät & Hjälpcenter</span>}
      {collapsed ? (
        count > 0 && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500" />
      ) : (
        <Badge count={count} />
      )}
    </Link>
  )
}
