// src/components/shared/indoor/FloorPlanSelector.tsx
// Komponent för att välja planritning (chips eller dropdown)

import { useState } from 'react'
import { ChevronDown, Image as ImageIcon, Plus, Building2 } from 'lucide-react'
import { FloorPlanWithRelations } from '../../../types/indoor'

interface FloorPlanSelectorProps {
  floorPlans: FloorPlanWithRelations[]
  selectedId?: string | null
  onSelect: (floorPlan: FloorPlanWithRelations) => void
  onAddNew?: () => void
  variant?: 'chips' | 'dropdown'
  showStationCount?: boolean
}

export function FloorPlanSelector({
  floorPlans,
  selectedId,
  onSelect,
  onAddNew,
  variant = 'chips',
  showStationCount = true
}: FloorPlanSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedPlan = floorPlans.find(p => p.id === selectedId)

  // Gruppera efter byggnad
  const groupedPlans = floorPlans.reduce((acc, plan) => {
    const building = plan.building_name || 'Övriga'
    if (!acc[building]) acc[building] = []
    acc[building].push(plan)
    return acc
  }, {} as Record<string, FloorPlanWithRelations[]>)

  const buildingNames = Object.keys(groupedPlans).sort((a, b) => {
    if (a === 'Övriga') return 1
    if (b === 'Övriga') return -1
    return a.localeCompare(b, 'sv')
  })

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-left hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-white truncate">
              {selectedPlan?.name || 'Välj planritning'}
            </span>
            {selectedPlan && showStationCount && (
              <span className="text-xs text-slate-400">
                ({selectedPlan.station_count} stationer)
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown menu */}
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {buildingNames.map((building) => (
                <div key={building}>
                  {buildingNames.length > 1 && building !== 'Övriga' && (
                    <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-900/50 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {building}
                    </div>
                  )}
                  {groupedPlans[building].map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        onSelect(plan)
                        setIsOpen(false)
                      }}
                      className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-700 transition-colors ${
                        plan.id === selectedId ? 'bg-teal-600/20 text-teal-400' : 'text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon className="w-4 h-4 flex-shrink-0 opacity-50" />
                        <span className="truncate">{plan.name}</span>
                      </div>
                      {showStationCount && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {plan.station_count || 0}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}

              {onAddNew && (
                <>
                  <div className="border-t border-slate-700" />
                  <button
                    onClick={() => {
                      onAddNew()
                      setIsOpen(false)
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-teal-400 hover:bg-teal-600/10 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ladda upp ny planritning
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  // Chips variant
  return (
    <div className="flex flex-wrap gap-2">
      {floorPlans.map((plan) => (
        <button
          key={plan.id}
          onClick={() => onSelect(plan)}
          className={`
            px-3 py-1.5 rounded-lg text-sm font-medium transition-all
            ${plan.id === selectedId
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
            }
          `}
        >
          <span>{plan.name}</span>
          {showStationCount && (
            <span className={`ml-1.5 ${plan.id === selectedId ? 'text-teal-200' : 'text-slate-400'}`}>
              ({plan.station_count || 0})
            </span>
          )}
        </button>
      ))}

      {onAddNew && (
        <button
          onClick={onAddNew}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/30 text-teal-400 hover:bg-teal-600/10 border border-dashed border-slate-600 hover:border-teal-500 transition-all flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Ny
        </button>
      )}
    </div>
  )
}

// Kompakt version för mobil header
export function FloorPlanChipSelector({
  floorPlans,
  selectedId,
  onSelect
}: {
  floorPlans: FloorPlanWithRelations[]
  selectedId?: string | null
  onSelect: (floorPlan: FloorPlanWithRelations) => void
}) {
  if (floorPlans.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {floorPlans.map((plan) => (
        <button
          key={plan.id}
          onClick={() => onSelect(plan)}
          className={`
            flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
            ${plan.id === selectedId
              ? 'bg-teal-600 text-white'
              : 'bg-slate-700/70 text-slate-300 hover:bg-slate-700'
            }
          `}
        >
          {plan.name}
          <span className={`ml-1 ${plan.id === selectedId ? 'text-teal-200' : 'text-slate-500'}`}>
            {plan.station_count || 0}
          </span>
        </button>
      ))}
    </div>
  )
}
