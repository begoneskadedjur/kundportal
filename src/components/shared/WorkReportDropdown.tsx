// src/components/shared/WorkReportDropdown.tsx - Professional report dropdown för EditCaseModal
import { useState, useRef, useEffect } from 'react'
import { FileCheck, Download, Send, Mail, ChevronDown, Loader2 } from 'lucide-react'

interface WorkReportDropdownProps {
  onDownload: () => Promise<void>
  onSendToTechnician: () => Promise<void>
  onSendToContact: () => Promise<void>
  disabled?: boolean
  technicianName?: string
  contactName?: string
}

type ActionType = 'download' | 'technician' | 'contact'

export default function WorkReportDropdown({
  onDownload,
  onSendToTechnician,
  onSendToContact,
  disabled = false,
  technicianName,
  contactName
}: WorkReportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState<ActionType | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAction = async (action: ActionType, handler: () => Promise<void>) => {
    try {
      setLoading(action)
      setIsOpen(false)
      await handler()
    } catch (error) {
      console.error(`Error during ${action} action:`, error)
    } finally {
      setLoading(null)
    }
  }

  const dropdownItems = [
    {
      key: 'download',
      label: 'Ladda ner',
      icon: Download,
      color: 'text-green-400 hover:text-green-300',
      bgColor: 'hover:bg-green-500/20',
      action: () => handleAction('download', onDownload),
      description: 'Ladda ner PDF-rapport'
    },
    {
      key: 'technician',
      label: 'Skicka till ansvarig tekniker',
      icon: Send,
      color: 'text-orange-400 hover:text-orange-300',
      bgColor: 'hover:bg-orange-500/20',
      action: () => handleAction('technician', onSendToTechnician),
      description: technicianName ? `Skicka till ${technicianName}` : 'Skicka till ansvarig tekniker'
    },
    {
      key: 'contact',
      label: 'Skicka till kontaktperson',
      icon: Mail,
      color: 'text-purple-400 hover:text-purple-300',
      bgColor: 'hover:bg-purple-500/20',
      action: () => handleAction('contact', onSendToContact),
      description: contactName ? `Skicka till ${contactName}` : 'Skicka till kontaktperson'
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main Report Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading !== null}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
          ${disabled || loading !== null
            ? 'bg-slate-700/50 border-slate-600 text-slate-500 cursor-not-allowed'
            : 'bg-slate-800/50 border-slate-600 text-blue-400 hover:bg-slate-700/50 hover:border-slate-500 hover:text-blue-300'
          }
        `}
        title="Generera och skicka saneringsrapport"
      >
        {loading !== null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileCheck className="h-4 w-4" />
        )}
        
        <span className="text-sm font-medium hidden sm:inline">
          {loading === 'download' && 'Laddar ner...'}
          {loading === 'technician' && 'Skickar...'}
          {loading === 'contact' && 'Skickar...'}
          {loading === null && 'Rapport'}
        </span>
        
        {!disabled && loading === null && (
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="py-2">
            {dropdownItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  onClick={item.action}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200
                    ${item.color} ${item.bgColor}
                    border-l-4 border-transparent hover:border-current
                  `}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {item.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Footer info */}
          <div className="border-t border-slate-700 px-4 py-2 bg-slate-900/50">
            <p className="text-xs text-slate-400">
              Genererar professionell saneringsrapport för försäkring/chef
            </p>
          </div>
        </div>
      )}
    </div>
  )
}