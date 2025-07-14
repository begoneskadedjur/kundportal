// 📁 src/components/admin/commissions/CommissionExportButtons.tsx - Export-knappar (Excel/PDF) med loading states
import React, { useState } from 'react'
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Mail, 
  Download, 
  Users, 
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown
} from 'lucide-react'
import { useCommissionExport } from '../../../hooks/useCommissionExport'
import type { CommissionCaseDetail } from '../../../types/commission'

interface CommissionExportButtonsProps {
  cases: CommissionCaseDetail[]
  month: string
  monthDisplay: string
  disabled?: boolean
  className?: string
}

const CommissionExportButtons: React.FC<CommissionExportButtonsProps> = ({
  cases,
  month,
  monthDisplay,
  disabled = false,
  className = ""
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  
  const {
    exportState,
    exportExcel,
    exportPdf,
    exportPayroll,
    exportSummary,
    prepareEmail,
    printCommissionReport,
    quickActions,
    validateCases,
    canExport
  } = useCommissionExport()

  const { isExporting, exportProgress, exportError } = exportState
  const validationResult = validateCases(cases)
  const isDisabled = disabled || !canExport(cases) || cases.length === 0

  // Action handlers
  const handleExportExcel = async () => {
    setLastAction('excel')
    const result = await exportExcel(cases, { month })
    if (result.success) {
      console.log('Excel export successful')
    }
    setDropdownOpen(false)
  }

  const handleExportPdf = async () => {
    setLastAction('pdf')
    const result = await exportPdf(cases, { month })
    if (result.success) {
      console.log('PDF export successful')
    }
    setDropdownOpen(false)
  }

  const handleExportPayroll = async () => {
    setLastAction('payroll')
    const result = await exportPayroll(cases, { month })
    if (result.success) {
      console.log('Payroll export successful')
    }
    setDropdownOpen(false)
  }

  const handleExportSummary = async () => {
    setLastAction('summary')
    const result = await exportSummary(cases, { month })
    if (result.success) {
      console.log('Summary export successful')
    }
    setDropdownOpen(false)
  }

  const handlePrepareEmail = async () => {
    setLastAction('email')
    const result = await prepareEmail(cases, { month })
    if (result.success) {
      console.log('Email preparation successful')
    }
    setDropdownOpen(false)
  }

  const handlePrint = () => {
    setLastAction('print')
    printCommissionReport(cases, month)
    setDropdownOpen(false)
  }

  const exportOptions = [
    {
      id: 'excel',
      label: 'Excel (CSV)',
      description: 'Detaljerad data för kalkylprogram',
      icon: FileSpreadsheet,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      action: handleExportExcel
    },
    {
      id: 'pdf',
      label: 'PDF Rapport',
      description: 'Formaterad rapport för presentation',
      icon: FileText,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      action: handleExportPdf
    },
    {
      id: 'payroll',
      label: 'Löneunderlag',
      description: 'CSV för import till lönesystem',
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      action: handleExportPayroll
    },
    {
      id: 'summary',
      label: 'Sammanfattning',
      description: 'Textrapport med nyckeltal',
      icon: FileText,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      action: handleExportSummary
    },
    {
      id: 'email',
      label: 'Email-mall',
      description: 'Förberedd email för utsändning',
      icon: Mail,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      action: handlePrepareEmail
    },
    {
      id: 'print',
      label: 'Skriv ut',
      description: 'Öppna utskriftsvänlig vy',
      icon: Printer,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      action: handlePrint
    }
  ]

  return (
    <div className={`relative ${className}`}>
      {/* Validation errors */}
      {!validationResult.isValid && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">Export-problem</span>
          </div>
          <ul className="text-sm text-red-300 space-y-1">
            {validationResult.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Export progress */}
      {isExporting && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-blue-400 font-medium">
              Exporterar {lastAction}...
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Export error */}
      {exportError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">Export misslyckades</span>
          </div>
          <p className="text-sm text-red-300 mt-1">{exportError}</p>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Quick Excel */}
        <button
          onClick={handleExportExcel}
          disabled={isDisabled || isExporting}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
            ${isDisabled || isExporting
              ? 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
              : 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500'
            }
          `}
        >
          {isExporting && lastAction === 'excel' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          <span>Excel</span>
        </button>

        {/* Quick Print */}
        <button
          onClick={handlePrint}
          disabled={isDisabled}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
            ${isDisabled
              ? 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
              : 'border-slate-500/50 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 hover:border-slate-500'
            }
          `}
        >
          <Printer className="w-4 h-4" />
          <span>Skriv ut</span>
        </button>

        {/* Dropdown för alla alternativ */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={isDisabled || isExporting}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200
              ${isDisabled || isExporting
                ? 'border-slate-700 bg-slate-800/20 text-slate-500 cursor-not-allowed'
                : 'border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500'
              }
            `}
          >
            <Download className="w-4 h-4" />
            <span>Fler alternativ</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-white font-medium">Export-alternativ</h3>
                <p className="text-sm text-slate-400">
                  {monthDisplay} • {cases.length} ärenden
                </p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {exportOptions.map((option) => {
                  const Icon = option.icon
                  const isCurrentlyExporting = isExporting && lastAction === option.id
                  
                  return (
                    <button
                      key={option.id}
                      onClick={option.action}
                      disabled={isDisabled || isExporting}
                      className={`
                        w-full flex items-center space-x-3 p-4 text-left hover:bg-slate-700/50
                        transition-colors duration-150 group
                        ${isDisabled || isExporting ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className={`
                        p-2 rounded-lg transition-colors duration-150
                        ${option.bgColor} group-hover:opacity-80
                      `}>
                        {isCurrentlyExporting ? (
                          <Loader2 className={`w-5 h-5 ${option.color} animate-spin`} />
                        ) : (
                          <Icon className={`w-5 h-5 ${option.color}`} />
                        )}
                      </div>
                      
                      <div>
                        <p className="font-medium text-white">
                          {option.label}
                        </p>
                        <p className="text-sm text-slate-400">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="p-3 border-t border-slate-700 bg-slate-700/30">
                <p className="text-xs text-slate-400">
                  💡 Tips: Excel-filen kan öppnas i Google Sheets eller Numbers
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info om export */}
      <div className="text-sm text-slate-400">
        <div className="flex items-center space-x-4">
          <span>
            📊 {cases.length} ärenden att exportera
          </span>
          {cases.length > 0 && (
            <span>
              💰 {new Intl.NumberFormat('sv-SE', { 
                style: 'currency', 
                currency: 'SEK', 
                minimumFractionDigits: 0 
              }).format(
                cases.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
              )} total provision
            </span>
          )}
        </div>
      </div>

      {/* Click outside overlay */}
      {dropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  )
}

export default CommissionExportButtons