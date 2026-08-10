// src/components/admin/layout/MobileNavGroup.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { NavGroup, NavItem } from './adminNavConfig'
import { useIncidentBadge } from '../../../hooks/useIncidentBadge'

interface MobileNavGroupProps {
  group: NavGroup
  currentPath: string
  onNavigate: () => void
}

export function MobileNavGroup({ group, currentPath, onNavigate }: MobileNavGroupProps) {
  const isAnyActive = group.items.some(item => currentPath.startsWith(item.path))
  const [expanded, setExpanded] = useState(isAnyActive)
  const GroupIcon = group.icon
  const incidentCount = useIncidentBadge()

  const badgeCountFor = (item: NavItem) => (item.badgeKey === 'incidents' ? incidentCount : 0)
  const groupBadgeCount = group.items.reduce((sum, item) => sum + badgeCountFor(item), 0)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200
          ${isAnyActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {!expanded && groupBadgeCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {expanded && (
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-1 mt-1 mb-2">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            const badgeCount = badgeCountFor(item)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                  ${isActive ? 'bg-teal-500/15 text-teal-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {badgeCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
