// src/components/admin/settings/ArticleGroupFilter.tsx
// Horisontella filter-tabs för artikelgrupper

import { useState } from 'react'
import { Settings, Package, Target, Bug, Zap, Bird } from 'lucide-react'
import { ArticleGroup } from '../../../types/articles'
import { ArticleGroupManager } from './ArticleGroupManager'

// Mapping av ikonnamn till komponenter
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  Bug,
  Zap,
  Bird,
  Package
}

interface ArticleGroupFilterProps {
  groups: ArticleGroup[]
  selectedGroupId: string | 'all'
  articleCounts: Record<string, number>
  totalCount: number
  onSelectGroup: (groupId: string | 'all') => void
  onGroupsChanged: () => void
}

export function ArticleGroupFilter({
  groups,
  selectedGroupId,
  articleCounts,
  totalCount,
  onSelectGroup,
  onGroupsChanged
}: ArticleGroupFilterProps) {
  const [showManager, setShowManager] = useState(false)

  const getIconComponent = (iconName: string) => {
    return ICON_MAP[iconName] || Package
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {/* Alla */}
        <button
          onClick={() => onSelectGroup('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            selectedGroupId === 'all'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
              : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
          }`}
        >
          <Package className="w-4 h-4" />
          Alla
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            selectedGroupId === 'all' ? 'bg-cyan-500/30' : 'bg-slate-700'
          }`}>
            {totalCount}
          </span>
        </button>

        {/* Grupper */}
        {groups.map(group => {
          const IconComp = getIconComponent(group.icon)
          const count = articleCounts[group.id] || 0
          const isSelected = selectedGroupId === group.id

          return (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'border'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
              }`}
              style={isSelected ? {
                backgroundColor: `${group.color}20`,
                borderColor: `${group.color}50`,
                color: group.color
              } : undefined}
            >
              <IconComp className="w-4 h-4" />
              {group.name}
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={isSelected ? {
                  backgroundColor: `${group.color}30`
                } : {
                  backgroundColor: 'rgb(51 65 85)' // bg-slate-700
                }}
              >
                {count}
              </span>
            </button>
          )
        })}

        {/* Ingen grupp */}
        {(() => {
          const ungroupedCount = totalCount - Object.values(articleCounts).reduce((a, b) => a + b, 0)
          if (ungroupedCount > 0) {
            return (
              <button
                onClick={() => onSelectGroup('ungrouped')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedGroupId === 'ungrouped'
                    ? 'bg-slate-600/20 text-slate-300 border border-slate-500/50'
                    : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-400'
                }`}
              >
                Utan grupp
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  selectedGroupId === 'ungrouped' ? 'bg-slate-600/30' : 'bg-slate-700'
                }`}>
                  {ungroupedCount}
                </span>
              </button>
            )
          }
          return null
        })()}

        {/* Hantera grupper */}
        <button
          onClick={() => setShowManager(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-white"
          title="Hantera grupper"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Group Manager Modal */}
      <ArticleGroupManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        onGroupsChanged={() => {
          onGroupsChanged()
          setShowManager(false)
        }}
      />
    </>
  )
}
