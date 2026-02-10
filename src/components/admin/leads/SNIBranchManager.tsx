// src/components/admin/leads/SNIBranchManager.tsx - Multi-select SNI branch component

import React, { useState, useEffect, useRef } from 'react'
import { Search, Plus, X, Building2, ChevronDown, Check, Edit3, Type } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { toast } from 'react-hot-toast'
import { LeadSniCode } from '../../../types/database'

// Mock SNI data - i produktion skulle detta komma från en API eller databas
const SNI_CODES = [
  { code: '68201', description: 'Uthyrning och förvaltning av egna eller arrenderade bostäder' },
  { code: '68202', description: 'Uthyrning och förvaltning av egna eller arrenderade lokaler' },
  { code: '81100', description: 'Fastighetstjänster' },
  { code: '81210', description: 'Allmän städning av byggnader' },
  { code: '81290', description: 'Annan städning' },
  { code: '81300', description: 'Anläggning och skötsel av trädgårdar och parker' },
  { code: '43210', description: 'Elinstallationer' },
  { code: '43220', description: 'VVS-arbeten' },
  { code: '46190', description: 'Övrig specialiserad grossisthandel' },
  { code: '47190', description: 'Övrig detaljhandel i icke-specialiserade butiker' },
  { code: '56101', description: 'Restauranger och fik' },
  { code: '56210', description: 'Cateringverksamhet' },
  { code: '55100', description: 'Hotell och pensionat' },
  { code: '10130', description: 'Tillverkning av charkuterier' },
  { code: '10200', description: 'Tillverkning av fiskprodukter' },
]

interface SNIBranchManagerProps {
  leadId?: string
  selectedSniCodes: LeadSniCode[]
  onSelectionChange: (sniCodes: LeadSniCode[]) => void
  disabled?: boolean
  className?: string
}

export default function SNIBranchManager({ 
  leadId, 
  selectedSniCodes, 
  onSelectionChange, 
  disabled = false,
  className = '' 
}: SNIBranchManagerProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCodes, setFilteredCodes] = useState(SNI_CODES)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualInputText, setManualInputText] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter SNI codes based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCodes(SNI_CODES)
    } else {
      const filtered = SNI_CODES.filter(item => 
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredCodes(filtered)
    }
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleCode = (sniCode: typeof SNI_CODES[0]) => {
    const isSelected = selectedSniCodes.some(selected => selected.sni_code === sniCode.code)
    
    let newSelection: LeadSniCode[]
    
    if (isSelected) {
      // Remove from selection
      newSelection = selectedSniCodes.filter(selected => selected.sni_code !== sniCode.code)
    } else {
      // Add to selection
      const newSniCode: LeadSniCode = {
        id: `temp-${Date.now()}-${sniCode.code}`, // Temporary ID för new items
        lead_id: leadId || '',
        sni_code: sniCode.code,
        sni_description: sniCode.description,
        is_primary: selectedSniCodes.length === 0, // First one becomes primary
        created_at: new Date().toISOString(),
        created_by: null
      }
      newSelection = [...selectedSniCodes, newSniCode]
    }
    
    onSelectionChange(newSelection)
  }

  const handleRemoveCode = (sniCodeToRemove: string) => {
    const newSelection = selectedSniCodes.filter(code => code.sni_code !== sniCodeToRemove)
    
    // If we removed the primary, make the first remaining one primary
    if (newSelection.length > 0 && !newSelection.some(code => code.is_primary)) {
      newSelection[0].is_primary = true
    }
    
    onSelectionChange(newSelection)
  }

  const handleSetPrimary = (sniCode: string) => {
    const newSelection = selectedSniCodes.map(code => ({
      ...code,
      is_primary: code.sni_code === sniCode
    }))
    onSelectionChange(newSelection)
  }

  const isCodeSelected = (code: string) => 
    selectedSniCodes.some(selected => selected.sni_code === code)

  const parseManualSniInput = (text: string) => {
    // Parse SNI codes from text - supports multiple formats
    const lines = text.split(/[\n\r]+/).filter(line => line.trim())
    const parsedCodes: { code: string; description: string }[] = []
    const errors: string[] = []
    
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      // Try multiple patterns for flexibility
      const patterns = [
        /^(\d{5})\s+(.+)$/,                    // "68201 Description"
        /^(\d{5})\s*[-:]\s*(.+)$/,            // "68201 - Description" or "68201: Description"
        /^(\d{5})\s*[.]\s*(.+)$/,             // "68201. Description"
        /^(\d{5})\s*[,]\s*(.+)$/,             // "68201, Description"
        /^(\d{5})(.+)$/                       // "68201Description" (no space)
      ]
      
      let matched = false
      for (const pattern of patterns) {
        const match = trimmed.match(pattern)
        if (match) {
          const [, code, description] = match
          const cleanCode = code.trim()
          const cleanDescription = description.trim()
          
          // Validate 5-digit code
          if (cleanCode.length === 5 && /^\d{5}$/.test(cleanCode)) {
            // Check for duplicates
            if (!parsedCodes.find(p => p.code === cleanCode)) {
              parsedCodes.push({ 
                code: cleanCode, 
                description: cleanDescription 
              })
            } else {
              errors.push(`Rad ${index + 1}: Dublettkod ${cleanCode}`)
            }
          } else {
            errors.push(`Rad ${index + 1}: Ogiltig SNI-kod "${cleanCode}" (måste vara 5 siffror)`)
          }
          matched = true
          break
        }
      }
      
      if (!matched) {
        errors.push(`Rad ${index + 1}: Kunde inte parsa "${trimmed}"`)
      }
    })
    
    // Show parsing results
    if (errors.length > 0) {
      console.warn('SNI parsing errors:', errors)
      toast.error(`Parsningsfel: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
    }
    
    if (parsedCodes.length > 0) {
      // Successfully parsed SNI codes
    }
    
    return parsedCodes
  }

  const handleManualSniSubmit = () => {
    if (!manualInputText.trim()) {
      toast.error('Ingen text att parsa')
      return
    }

    const parsedCodes = parseManualSniInput(manualInputText)
    
    if (parsedCodes.length === 0) {
      toast.error('Kunde inte hitta några giltiga SNI-koder i texten. Kontrollera formatet.')
      return
    }

    // Add parsed codes to selection
    let newSelection = [...selectedSniCodes]
    let addedCount = 0
    let skippedCount = 0

    parsedCodes.forEach(({ code, description }, index) => {
      // Skip if already selected
      if (!isCodeSelected(code)) {
        const newSniCode: LeadSniCode = {
          id: `temp-${Date.now()}-${Math.random()}-${code}`, // More unique ID
          lead_id: leadId || '',
          sni_code: code,
          sni_description: description,
          is_primary: (newSelection.length + addedCount) === 0, // First one becomes primary
          created_at: new Date().toISOString(),
          created_by: null
        }
        newSelection.push(newSniCode)
        addedCount++
      } else {
        skippedCount++
      }
    })

    // Update selection
    onSelectionChange(newSelection)

    // Show detailed feedback
    if (addedCount > 0) {
      let message = `${addedCount} SNI-kod${addedCount > 1 ? 'er' : ''} tillagda`
      if (skippedCount > 0) {
        message += `, ${skippedCount} hoppades över (redan valda)`
      }
      toast.success(message)
    } else if (skippedCount > 0) {
      toast.info('Alla SNI-koder från texten är redan valda')
    }

    // Clear input and close
    setManualInputText('')
    setShowManualInput(false)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-slate-300">
        <Building2 className="inline w-4 h-4 mr-2" />
        SNI-Branschkoder
        <span className="text-slate-500 ml-2 text-xs">(Välj en eller flera branscher)</span>
      </label>

      {/* Selected SNI Codes Display */}
      {selectedSniCodes.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="flex flex-wrap gap-2">
            {selectedSniCodes.map((sniCode) => (
              <div
                key={sniCode.sni_code}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                  ${sniCode.is_primary 
                    ? 'bg-[#20c58f] text-white border border-[#20c58f]/70'
                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                  }
                `}
              >
                <span className="font-medium">{sniCode.sni_code}</span>
                <span className="truncate max-w-48">
                  {sniCode.sni_description}
                </span>
                
                {sniCode.is_primary && (
                  <span className="text-xs bg-[#20c58f]/80 px-2 py-0.5 rounded">
                    Primär
                  </span>
                )}
                
                {!sniCode.is_primary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(sniCode.sni_code)}
                    className="text-xs text-slate-400 hover:text-blue-400 underline"
                    disabled={disabled}
                  >
                    Gör primär
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => handleRemoveCode(sniCode.sni_code)}
                  className="text-slate-400 hover:text-red-400 ml-1"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Dropdown Selector Button */}
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={`
              w-full flex items-center justify-between px-3 py-2 
              bg-slate-800 border border-slate-700 rounded-lg
              text-slate-300 text-sm
              ${disabled 
                ? 'cursor-not-allowed opacity-50' 
                : 'hover:border-slate-600 focus:border-blue-500 focus:outline-none'
              }
            `}
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Välj från lista
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-80 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sök SNI-kod eller beskrivning..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredCodes.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  Inga branschkoder matchar din sökning
                </div>
              ) : (
                filteredCodes.map((sniCode) => {
                  const isSelected = isCodeSelected(sniCode.code)
                  
                  return (
                    <button
                      key={sniCode.code}
                      type="button"
                      onClick={() => handleToggleCode(sniCode)}
                      className={`
                        w-full text-left px-4 py-3 border-b border-slate-700 last:border-b-0
                        hover:bg-slate-700 transition-colors text-sm
                        ${isSelected ? 'bg-slate-700' : ''}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-blue-400">
                              {sniCode.code}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <div className="text-slate-300 mt-1 line-clamp-2">
                            {sniCode.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
          )}
        </div>

        {/* Manual Input Button */}
        <button
          type="button"
          onClick={() => !disabled && setShowManualInput(!showManualInput)}
          disabled={disabled}
          className={`
            px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg
            text-slate-300 text-sm transition-colors
            ${disabled 
              ? 'cursor-not-allowed opacity-50' 
              : 'hover:border-slate-600 focus:border-blue-500 focus:outline-none'
            }
          `}
        >
          <Type className="w-4 h-4" />
        </button>
      </div>

      {/* Manual Input Form */}
      {showManualInput && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Type className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-medium text-slate-300">Klistra in SNI-koder</h4>
          </div>
          
          <div className="space-y-3">
            <textarea
              value={manualInputText}
              onChange={(e) => setManualInputText(e.target.value)}
              placeholder="Klistra in SNI-koder här, en per rad:&#10;68201 Uthyrning och förvaltning av bostäder&#10;68203 - Förvaltning av lokaler&#10;81100: Fastighetstjänster"
              rows={4}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-sm"
            />
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Stöder format: "68201 Text", "68201 - Text", "68201: Text", "68201. Text"
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualInput(false)}
                  disabled={disabled}
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleManualSniSubmit}
                  disabled={disabled || !manualInputText.trim()}
                  className=""
                >
                  Lägg till koder
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-slate-500">
        Välj de branschkoder som bäst beskriver företagets verksamhet. 
        Den första koden blir primär, men du kan ändra detta senare.
      </p>
    </div>
  )
}