// 📁 src/components/admin/commissions/CommissionTechnicianFilter.tsx - Dropdown för tekniker-val (Alla eller enskild)
import React, { useState } from 'react'
import { Users, ChevronDown, Check, Search, X } from 'lucide-react'
import type { TechnicianFilter } from '../../../types/commission'

interface CommissionTechnicianFilterProps {
  selectedTechnician: TechnicianFilter
  availableTechnicians: TechnicianFilter[]
  onTechnicianChange: (technician: TechnicianFilter) => void
  loading?: boolean
  className?: string
  compact?: boolean
}

const CommissionTechnicianFilter: React.FC<CommissionTechnicianFilterProps> = ({
  selectedTechnician,
  availableTechnicians,
  onTechnicianChange,
  loading = false,
  className = "",
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Filtrera tekniker baserat på sökterm
  const filteredTechnicians = availableTechnicians.filter(tech =>
    tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tech.email && tech.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSelect = (technician: TechnicianFilter) => {
    onTechnicianChange(technician)
    setIsOpen(false)
    setSearchTerm('')
  }

  const clearSearch = () => {
    setSearchTerm('')
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      {compact ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/30 border border-slate-700
            rounded-lg text-left hover:border-slate-500 focus:ring-2 focus:ring-[#20c58f]
            focus:outline-none transition-colors text-xs font-medium
            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? 'border-[#20c58f] ring-1 ring-[#20c58f]/30' : ''}
          `}
        >
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-white truncate max-w-[140px]">{selectedTechnician.name}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
          className={`
            flex items-center justify-between w-full px-4 py-3 bg-slate-800 border border-slate-600
            rounded-lg text-left hover:border-slate-500 focus:border-green-500 focus:ring-1
            focus:ring-green-500 focus:outline-none transition-all duration-200
            ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? 'border-green-500 ring-1 ring-green-500' : ''}
          `}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-4 h-4 text-green-400" />
            </div>

            <div>
              <p className="text-sm text-slate-400">Filtrera per tekniker</p>
              <p className="text-white font-medium">
                {selectedTechnician.name}
                {selectedTechnician.id !== 'all' && (
                  <span className="text-slate-400 text-sm ml-2">
                    ({availableTechnicians.filter(t => t.id !== 'all').length} tekniker)
                  </span>
                )}
              </p>
            </div>
          </div>

          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden ${compact ? 'min-w-[220px]' : 'right-0 mt-2'}`}>
          {/* Search bar */}
          {availableTechnicians.length > 5 && (
            <div className={`${compact ? 'p-2' : 'p-3'} border-b border-slate-700`}>
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400`} />
                <input
                  type="text"
                  placeholder="Sök tekniker..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full ${compact ? 'pl-8 pr-8 py-1.5 text-xs' : 'pl-10 pr-10 py-2'} bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#20c58f] focus:ring-1 focus:ring-[#20c58f] focus:outline-none`}
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-600 rounded"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTechnicians.length === 0 ? (
              <div className={`${compact ? 'p-3 text-xs' : 'p-4'} text-center text-slate-400`}>
                {searchTerm ? 'Inga tekniker hittades' : 'Inga tekniker tillgängliga'}
              </div>
            ) : (
              filteredTechnicians.map((technician) => (
                <button
                  key={technician.id}
                  onClick={() => handleSelect(technician)}
                  className={`
                    w-full flex items-center justify-between text-left hover:bg-slate-700/50
                    transition-colors duration-150 group
                    ${compact ? 'px-2.5 py-2' : 'p-3'}
                    ${selectedTechnician.id === technician.id ? 'bg-[#20c58f]/10' : ''}
                  `}
                >
                  <div className={`flex items-center ${compact ? 'gap-2' : 'space-x-3'}`}>
                    {!compact && (
                      <div className={`
                        p-2 rounded-lg transition-colors duration-150
                        ${technician.id === 'all'
                          ? 'bg-blue-500/20 group-hover:bg-blue-500/30'
                          : 'bg-green-500/20 group-hover:bg-green-500/30'
                        }
                      `}>
                        <Users className={`w-4 h-4 ${
                          technician.id === 'all' ? 'text-blue-400' : 'text-green-400'
                        }`} />
                      </div>
                    )}

                    <div>
                      <p className={`${compact ? 'text-xs' : ''} font-medium ${
                        selectedTechnician.id === technician.id ? 'text-[#20c58f]' : 'text-white'
                      }`}>
                        {technician.name}
                      </p>
                      {technician.email && !compact && (
                        <p className="text-sm text-slate-400">
                          {technician.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedTechnician.id === technician.id && (
                    <Check className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} text-[#20c58f]`} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredTechnicians.length > 1 && !compact && (
            <div className="p-3 border-t border-slate-700 bg-slate-700/30">
              <p className="text-xs text-slate-400 text-center">
                {filteredTechnicians.length - 1} aktiva tekniker med provisioner
                {searchTerm && ` (filtrerat från ${availableTechnicians.length - 1})`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Overlay för att stänga dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default CommissionTechnicianFilter