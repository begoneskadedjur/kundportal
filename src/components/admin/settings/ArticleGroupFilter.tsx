// src/components/admin/settings/ArticleGroupFilter.tsx
// Filter-chips för artikelgrupper med wrapping layout

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { ArticleGroup } from '../../../types/articles'
import { ArticleGroupManager } from './ArticleGroupManager'

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

  // Beräkna antal utan grupp
  const ungroupedCount = totalCount - Object.values(articleCounts).reduce((a, b) => a + b, 0)

  return (
    <>
      <div className="flex items-start gap-3">
        {/* Hantera grupper - alltid synlig först */}
        <button
          onClick={() => setShowManager(true)}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-white transition-all"
          title="Hantera grupper"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Separator */}
        <div className="h-8 w-px bg-slate-700/50 flex-shrink-0" />

        {/* Filter-chips med wrap */}
        <div className="flex flex-wrap gap-2">
          {/* Alla */}
          <button
            onClick={() => onSelectGroup('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              selectedGroupId === 'all'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-300'
            }`}
          >
            Alla
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              selectedGroupId === 'all' ? 'bg-cyan-500/30' : 'bg-slate-700'
            }`}>
              {totalCount}
            </span>
          </button>

          {/* Grupper */}
          {groups.map(group => {
            const count = articleCounts[group.id] || 0
            const isSelected = selectedGroupId === group.id

            return (
              <button
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
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
                {group.name}
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={isSelected ? {
                    backgroundColor: `${group.color}30`
                  } : {
                    backgroundColor: 'rgb(51 65 85)'
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}

          {/* Utan grupp */}
          {ungroupedCount > 0 && (
            <button
              onClick={() => onSelectGroup('ungrouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
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
          )}
        </div>
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
