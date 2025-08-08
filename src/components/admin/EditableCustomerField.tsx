// src/components/admin/EditableCustomerField.tsx
import { useState, useEffect, useRef } from 'react'
import { Edit3, Check, X, ChevronDown, Mail, Phone, MapPin, User, Building } from 'lucide-react'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { BUSINESS_TYPES, getBusinessTypeLabel, getBusinessTypeIcon } from '../../constants/businessTypes'
import toast from 'react-hot-toast'

interface EditableCustomerFieldProps {
  label: string
  value: string | null | undefined
  onSave: (value: string) => Promise<void>
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'business_type' | 'technician'
  placeholder?: string
  icon?: React.ReactNode
  options?: { value: string; label: string; icon?: string }[]
  technicians?: { name: string; email?: string }[]
  disabled?: boolean
  multiline?: boolean
}

export default function EditableCustomerField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder = '',
  icon,
  options = [],
  technicians = [],
  disabled = false,
  multiline = false
}: EditableCustomerFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fokusera input när redigering börjar
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (type !== 'textarea') {
        inputRef.current.select()
      }
    }
  }, [isEditing, type])

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleEdit = () => {
    if (disabled) return
    setEditValue(value || '')
    setIsEditing(true)
    if (type === 'select' || type === 'business_type' || type === 'technician') {
      setShowDropdown(true)
    }
  }

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    try {
      await onSave(editValue)
      setIsEditing(false)
      setShowDropdown(false)
      toast.success(`${label} uppdaterad`)
    } catch (error) {
      console.error('Error saving field:', error)
      toast.error(`Kunde inte uppdatera ${label.toLowerCase()}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setIsEditing(false)
    setShowDropdown(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const handleOptionSelect = (optionValue: string) => {
    setEditValue(optionValue)
    setShowDropdown(false)
    // Auto-save för dropdowns
    setTimeout(() => handleSave(), 100)
  }

  const getDisplayValue = () => {
    if (!value) return '-'
    
    if (type === 'business_type') {
      return (
        <div className="flex items-center gap-2">
          <span>{getBusinessTypeIcon(value)}</span>
          <span>{getBusinessTypeLabel(value)}</span>
        </div>
      )
    }
    
    if (type === 'select') {
      const option = options.find(opt => opt.value === value)
      return option ? option.label : value
    }

    return value
  }

  const getIcon = () => {
    if (icon) return icon
    
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-slate-400" />
      case 'tel':
        return <Phone className="w-4 h-4 text-slate-400" />
      case 'text':
        if (label.toLowerCase().includes('adress')) {
          return <MapPin className="w-4 h-4 text-slate-400" />
        }
        if (label.toLowerCase().includes('kontakt')) {
          return <User className="w-4 h-4 text-slate-400" />
        }
        return <Building className="w-4 h-4 text-slate-400" />
      default:
        return null
    }
  }

  const renderDropdownOptions = () => {
    let dropdownOptions: { value: string; label: string; icon?: string }[] = []

    if (type === 'business_type') {
      dropdownOptions = BUSINESS_TYPES.map(bt => ({
        value: bt.value,
        label: bt.label,
        icon: bt.icon
      }))
    } else if (type === 'technician') {
      dropdownOptions = technicians.map(tech => ({
        value: tech.name,
        label: tech.email ? `${tech.name} (${tech.email})` : tech.name
      }))
    } else {
      dropdownOptions = options
    }

    return dropdownOptions.map((option) => (
      <button
        key={option.value}
        onClick={() => handleOptionSelect(option.value)}
        className="w-full px-3 py-2 text-left text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
      >
        {option.icon && <span>{option.icon}</span>}
        <span>{option.label}</span>
      </button>
    ))
  }

  return (
    <div className="group">
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      
      {!isEditing ? (
        <div
          onClick={handleEdit}
          className={`
            min-h-[2.5rem] p-3 rounded-lg border transition-all duration-200 cursor-pointer
            ${disabled 
              ? 'bg-slate-800/30 border-slate-700 cursor-not-allowed opacity-50' 
              : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
            }
            flex items-center justify-between
            ${!value ? 'text-slate-500' : 'text-white'}
          `}
        >
          <div className="flex items-center gap-2 flex-1">
            {getIcon()}
            <div className="flex-1">
              {getDisplayValue()}
            </div>
          </div>
          
          {!disabled && (
            <Edit3 className="w-4 h-4 text-slate-500 group-hover:text-slate-400 transition-colors" />
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Input-fält */}
          {(type === 'select' || type === 'business_type' || type === 'technician') ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-green-500 rounded-lg text-white text-left flex items-center justify-between focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  {getIcon()}
                  <span>{getDisplayValue()}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {renderDropdownOptions()}
                </div>
              )}
            </div>
          ) : (
            <Input
              ref={inputRef as any}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={placeholder}
              as={multiline || type === 'textarea' ? 'textarea' : 'input'}
              rows={multiline || type === 'textarea' ? 3 : undefined}
              className="focus:ring-green-500 focus:border-green-500"
              icon={getIcon()}
            />
          )}
          
          {/* Spara/Avbryt knappar */}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Sparar...
                </div>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Spara
                </>
              )}
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}