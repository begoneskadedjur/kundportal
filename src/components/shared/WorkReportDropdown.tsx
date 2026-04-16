// src/components/shared/WorkReportDropdown.tsx - Professional report dropdown för EditCaseModal
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileCheck, Download, Send, Mail, ChevronDown, Loader2, Clock } from 'lucide-react'
import type { SanitationReport } from '../../services/sanitationReportService'

interface WorkReportDropdownProps {
  onDownload: () => Promise<void>
  onSendToTechnician: () => Promise<void>
  onSendToContact: () => Promise<void>
  disabled?: boolean
  technicianName?: string
  contactName?: string
  // Nya props för rapporthistorik
  totalReports?: number
  hasRecentReport?: boolean
  currentReport?: SanitationReport | null
  getTimeSinceReport?: (report: SanitationReport) => string
}

type ActionType = 'download' | 'technician' | 'contact'

export default function WorkReportDropdown({
  onDownload,
  onSendToTechnician,
  onSendToContact,
  disabled = false,
  technicianName,
  contactName,
  totalReports = 0,
  hasRecentReport = false,
  currentReport = null,
  getTimeSinceReport
}: WorkReportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState<ActionType | null>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const menuWidth = Math.max(rect.width, 288)
    const menuHeight = 240
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight + 8 && rect.top > menuHeight + 8
    const rightFromEdge = window.innerWidth - rect.right
    const overflowsLeft = rightFromEdge + menuWidth > window.innerWidth - 8
    setMenuStyle({
      position: 'fixed',
      ...(overflowsLeft
        ? { left: Math.max(8, rect.left) }
        : { right: rightFromEdge }),
      width: menuWidth,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
      zIndex: 9999,
    })
    setIsOpen(true)
  }

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

  const menu = isOpen && !disabled ? createPortal(
    <div
      ref={menuRef}
      style={{ ...menuStyle, pointerEvents: 'auto' }}
      className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden"
      onMouseDown={e => e.preventDefault()}
    >
      {/* Varning om befintlig rapport */}
      {hasRecentReport && currentReport && getTimeSinceReport && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-amber-400">
                Rapport genererad {getTimeSinceReport(currentReport)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Version {currentReport.version} av {totalReports}
                {currentReport.sent_to_customer && (
                  <span className="ml-1 text-green-400">• Skickad till kund</span>
                )}
                {currentReport.sent_to_technician && (
                  <span className="ml-1 text-orange-400">• Skickad till tekniker</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="py-1">
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
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>,
    document.getElementById('modal-root') ?? document.body
  ) : null

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => !disabled && (isOpen ? setIsOpen(false) : openMenu())}
        disabled={disabled || loading !== null}
        className={`
          flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-all duration-200 active:scale-95
          ${disabled || loading !== null
            ? 'bg-slate-700/50 border-slate-600/50 text-slate-500 cursor-not-allowed'
            : 'bg-slate-700/60 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-slate-500'
          }
        `}
      >
        {loading !== null ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <FileCheck className="h-4 w-4 shrink-0" />
        )}
        <span>
          {loading === 'download' && 'Laddar ner...'}
          {loading === 'technician' && 'Skickar...'}
          {loading === 'contact' && 'Skickar...'}
          {loading === null && `Rapport${totalReports > 0 ? ` (${totalReports})` : ''}`}
        </span>
        {!disabled && loading === null && (
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {menu}
    </div>
  )
}