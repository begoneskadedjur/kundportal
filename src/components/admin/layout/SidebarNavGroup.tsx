// src/components/admin/layout/SidebarNavGroup.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { NavGroup } from './adminNavConfig'

interface SidebarNavGroupProps {
  group: NavGroup
  collapsed: boolean
  currentPath: string
}

export function SidebarNavGroup({ group, collapsed, currentPath }: SidebarNavGroupProps) {
  const isAnyActive = group.items.some(item => currentPath.startsWith(item.path))
  const [expanded, setExpanded] = useState(isAnyActive)
  const GroupIcon = group.icon

  if (collapsed) {
    return (
      <div className="relative group/nav">
        <button
          className={`
            w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200
            ${isAnyActive
              ? 'bg-teal-500/10 text-teal-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
            }
          `}
          title={group.label}
          aria-label={group.label}
        >
          <GroupIcon className="w-5 h-5 flex-shrink-0" />
        </button>
        <div className="absolute left-full top-0 ml-2 hidden group-hover/nav:block z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 min-w-[200px]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5 mb-1">
              {group.label}
            </p>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = currentPath.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm
                    focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 outline-none
                    ${isActive
                      ? 'bg-teal-500/15 text-teal-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
          ${isAnyActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-1 mt-1">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                  focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none
                  ${isActive
                    ? 'border-l-[3px] border-teal-400 text-white font-medium bg-teal-500/5 -ml-[3px]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
