// src/components/admin/layout/MobileNavGroup.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { NavGroup } from './adminNavConfig'

interface MobileNavGroupProps {
  group: NavGroup
  currentPath: string
  onNavigate: () => void
}

export function MobileNavGroup({ group, currentPath, onNavigate }: MobileNavGroupProps) {
  const isAnyActive = group.items.some(item => currentPath.startsWith(item.path))
  const [expanded, setExpanded] = useState(isAnyActive)
  const GroupIcon = group.icon

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
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-1 mt-1 mb-2">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
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
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
