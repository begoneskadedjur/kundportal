// 📁 src/components/ui/ModernList.tsx - Modern Lista för Tekniker/Performance
import React, { useState } from 'react'
import { Search, Filter, SortDesc, SortAsc, Users, ChevronDown } from 'lucide-react'
import ModernCard from './ModernCard'

interface ListItem {
  id: string | number
  name: string
  avatar?: string
  primaryValue: string | number
  secondaryValue?: string | number
  status?: 'active' | 'inactive' | 'warning'
  rank?: number
  badge?: string
  metadata?: Array<{
    label: string
    value: string | number
    color?: string
  }>
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'danger'
  }>
}

interface ModernListProps {
  items: ListItem[]
  title: string
  subtitle?: string
  searchable?: boolean
  filterable?: boolean
  sortable?: boolean
  showRanking?: boolean
  maxHeight?: string
  emptyMessage?: string
  formatPrimaryValue?: (value: string | number) => string
  formatSecondaryValue?: (value: string | number) => string
  onItemClick?: (item: ListItem) => void
  className?: string
}

interface ListItemComponentProps {
  item: ListItem
  showRanking: boolean
  formatPrimaryValue?: (value: string | number) => string
  formatSecondaryValue?: (value: string | number) => string
  onItemClick?: (item: ListItem) => void
}

interface ListHeaderProps {
  title: string
  subtitle?: string
  itemCount: number
  searchable: boolean
  filterable: boolean
  sortable: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  sortDirection: 'asc' | 'desc'
  onSortChange: () => void
}

// Get rank styling
const getRankStyling = (rank?: number) => {
  if (!rank) return { icon: '#?', color: 'text-slate-400', bg: 'bg-slate-700' }
  
  switch (rank) {
    case 1:
      return { icon: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    case 2:
      return { icon: '🥈', color: 'text-slate-300', bg: 'bg-slate-500/20' }
    case 3:
      return { icon: '🥉', color: 'text-amber-400', bg: 'bg-amber-500/20' }
    default:
      return { icon: `#${rank}`, color: 'text-slate-300', bg: 'bg-slate-700' }
  }
}

// Status styling
const getStatusStyling = (status?: string) => {
  switch (status) {
    case 'active':
      return { color: 'text-green-400', bg: 'bg-green-500/20', dot: 'bg-green-500' }
    case 'inactive':
      return { color: 'text-slate-400', bg: 'bg-slate-500/20', dot: 'bg-slate-500' }
    case 'warning':
      return { color: 'text-yellow-400', bg: 'bg-yellow-500/20', dot: 'bg-yellow-500' }
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-700', dot: 'bg-slate-500' }
  }
}

// List Header Component
const ListHeader: React.FC<ListHeaderProps> = ({
  title,
  subtitle,
  itemCount,
  searchable,
  filterable,
  sortable,
  searchQuery,
  onSearchChange,
  sortDirection,
  onSortChange
}) => {
  return (
    <div className="space-y-4">
      {/* Title and count */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            {title}
            <span className="text-sm text-slate-400 font-normal">({itemCount} objekt)</span>
          </h3>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>

        {/* Sort button */}
        {sortable && (
          <button
            onClick={onSortChange}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700 transition-colors"
          >
            {sortDirection === 'desc' ? (
              <SortDesc className="w-4 h-4 text-slate-400" />
            ) : (
              <SortAsc className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-sm text-slate-400">Sortera</span>
          </button>
        )}
      </div>

      {/* Search and filters */}
      {(searchable || filterable) && (
        <div className="flex gap-3">
          {searchable && (
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Sök..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>
          )}
          
          {filterable && (
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-700 transition-colors">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filter</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Individual List Item Component
const ListItemComponent: React.FC<ListItemComponentProps> = ({
  item,
  showRanking,
  formatPrimaryValue,
  formatSecondaryValue,
  onItemClick
}) => {
  const rankStyling = getRankStyling(item.rank)
  const statusStyling = getStatusStyling(item.status)
  
  const displayPrimaryValue = formatPrimaryValue ? formatPrimaryValue(item.primaryValue) : item.primaryValue
  const displaySecondaryValue = item.secondaryValue && formatSecondaryValue 
    ? formatSecondaryValue(item.secondaryValue) 
    : item.secondaryValue

  return (
    <div 
      className={`
        flex items-center justify-between p-4 rounded-lg border transition-all duration-200
        ${item.rank && item.rank <= 3 
          ? 'bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-slate-600 shadow-lg' 
          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
        }
        ${onItemClick ? 'cursor-pointer hover:scale-[1.01]' : ''}
      `}
      onClick={() => onItemClick?.(item)}
    >
      {/* Left side - Rank, Avatar, Name */}
      <div className="flex items-center gap-4">
        {/* Rank */}
        {showRanking && (
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
            ${rankStyling.bg} ${rankStyling.color}
          `}>
            {typeof rankStyling.icon === 'string' && rankStyling.icon.startsWith('#') ? (
              rankStyling.icon
            ) : (
              <span className="text-lg">{rankStyling.icon}</span>
            )}
          </div>
        )}

        {/* Avatar or placeholder */}
        {item.avatar ? (
          <img 
            src={item.avatar} 
            alt={item.name}
            className="w-10 h-10 rounded-full border-2 border-slate-600"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
            {item.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name and metadata */}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-white font-semibold">{item.name}</h4>
            
            {/* Badge */}
            {item.badge && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                {item.badge}
              </span>
            )}
            
            {/* Status indicator */}
            {item.status && (
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${statusStyling.dot}`}></div>
              </div>
            )}
          </div>
          
          {/* Metadata */}
          {item.metadata && (
            <div className="flex items-center gap-3 mt-1">
              {item.metadata.slice(0, 3).map((meta, index) => (
                <span 
                  key={index} 
                  className={`text-sm ${meta.color || 'text-slate-400'}`}
                >
                  {meta.label}: {meta.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Values and actions */}
      <div className="text-right">
        <div className="mb-1">
          <p className="text-green-400 font-bold text-lg">{displayPrimaryValue}</p>
          {displaySecondaryValue && (
            <p className="text-slate-400 text-sm">{displaySecondaryValue}</p>
          )}
        </div>

        {/* Actions */}
        {item.actions && (
          <div className="flex gap-2 mt-2">
            {item.actions.map((action, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick()
                }}
                className={`
                  px-3 py-1 text-xs rounded-lg transition-colors
                  ${action.variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  ${action.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  ${!action.variant || action.variant === 'secondary' ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : ''}
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Main ModernList Component
const ModernList: React.FC<ModernListProps> = ({
  items,
  title,
  subtitle,
  searchable = true,
  filterable = false,
  sortable = true,
  showRanking = true,
  maxHeight = 'max-h-96',
  emptyMessage = 'Inga objekt att visa',
  formatPrimaryValue,
  formatSecondaryValue,
  onItemClick,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    let filtered = [...items]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Sort
    if (sortable) {
      filtered.sort((a, b) => {
        const aValue = typeof a.primaryValue === 'number' ? a.primaryValue : 0
        const bValue = typeof b.primaryValue === 'number' ? b.primaryValue : 0
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue
      })
    }

    return filtered
  }, [items, searchQuery, sortDirection, sortable])

  const handleSortChange = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')
  }

  return (
    <ModernCard className={className}>
      <div className="p-6">
        <ListHeader
          title={title}
          subtitle={subtitle}
          itemCount={filteredItems.length}
          searchable={searchable}
          filterable={filterable}
          sortable={sortable}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
        />

        {/* List content */}
        <div className={`space-y-2 overflow-y-auto ${maxHeight} mt-6`}>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-slate-500 mb-3" />
              <p className="text-slate-400">{emptyMessage}</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-blue-400 text-sm mt-2 hover:underline"
                >
                  Rensa sökning
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => (
              <ListItemComponent
                key={item.id}
                item={item}
                showRanking={showRanking}
                formatPrimaryValue={formatPrimaryValue}
                formatSecondaryValue={formatSecondaryValue}
                onItemClick={onItemClick}
              />
            ))
          )}
        </div>
      </div>
    </ModernCard>
  )
}

export default ModernList

// Utility function to create list items
export const createListItem = (
  id: string | number,
  name: string,
  primaryValue: string | number,
  secondaryValue?: string | number,
  options?: {
    avatar?: string
    status?: 'active' | 'inactive' | 'warning'
    rank?: number
    badge?: string
    metadata?: Array<{ label: string; value: string | number; color?: string }>
    actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger' }>
  }
): ListItem => ({
  id,
  name,
  primaryValue,
  secondaryValue,
  ...options
})