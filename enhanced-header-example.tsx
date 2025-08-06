// Föreslagen förbättrad header-sektion för EditCaseModal
// Integrerar avtal- och offertfunktionalitet med befintlig design

import { FileCheck, FileSignature, Calculator, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import WorkReportDropdown from '../shared/WorkReportDropdown'

interface EnhancedHeaderProps {
  currentCase: any
  reportGeneration: any
}

// Kompakt knapp-komponent för avtal/offert
function ActionButton({ 
  icon: Icon, 
  label, 
  onClick, 
  className = "",
  disabled = false 
}: {
  icon: any
  label: string 
  onClick: () => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group flex items-center gap-2 px-3 py-2 
        bg-slate-700/50 hover:bg-slate-600/50 
        border border-slate-600/50 hover:border-slate-500/50
        rounded-lg transition-all duration-200
        text-sm text-slate-300 hover:text-slate-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      <ChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

export default function EnhancedHeader({ currentCase, reportGeneration }: EnhancedHeaderProps) {
  const navigate = useNavigate()
  
  // Navigera till OneflowContractCreator med förfylld data
  const handleCreateContract = () => {
    const customerData = {
      // Hämta kundinformation från ärendet
      companyName: currentCase.customer?.name || '',
      contactPerson: currentCase.contact_person || '',
      email: currentCase.contact_email || '',
      phone: currentCase.contact_phone || '',
      // Fler fält som behövs...
    }
    
    // Navigera till wizard med startparametrar
    navigate('/admin/oneflow-contract-creator', {
      state: {
        startStep: 1, // Börja på dokumenttyp-steget
        preselectedType: 'contract',
        customerData: customerData,
        sourceCase: currentCase.id
      }
    })
  }
  
  const handleCreateOffer = () => {
    const customerData = {
      companyName: currentCase.customer?.name || '',
      contactPerson: currentCase.contact_person || '',
      email: currentCase.contact_email || '',
      phone: currentCase.contact_phone || '',
    }
    
    navigate('/admin/oneflow-contract-creator', {
      state: {
        startStep: 1,
        preselectedType: 'offer', // Förvälj offert
        customerData: customerData,
        sourceCase: currentCase.id
      }
    })
  }

  return (
    <div className="mb-6 -mt-6 -mx-6 px-6 py-4 bg-slate-800/30 border-b border-slate-700">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Vänster: Beskrivning */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm text-slate-300 block">
              Dokumenthantering för detta ärende
            </span>
            <span className="text-xs text-slate-500 block sm:hidden">
              Rapport • Avtal • Offert
            </span>
          </div>
        </div>

        {/* Höger: Funktioner */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Befintlig rapport-funktionalitet */}
          {reportGeneration.canGenerateReport && (
            <div className="relative">
              <WorkReportDropdown
                onDownload={reportGeneration.downloadReport}
                onSendToTechnician={reportGeneration.sendToTechnician}
                onSendToContact={reportGeneration.sendToContact}
                disabled={!reportGeneration.canGenerateReport || reportGeneration.isGenerating}
                technicianName={reportGeneration.technicianName}
                contactName={reportGeneration.contactName}
              />
            </div>
          )}

          {/* Ny avtal-funktionalitet */}
          <ActionButton
            icon={FileSignature}
            label="Skapa Avtal"
            onClick={handleCreateContract}
            className="text-purple-400 hover:text-purple-300 border-purple-500/30 hover:border-purple-400/50"
          />

          {/* Ny offert-funktionalitet */}
          <ActionButton
            icon={Calculator}
            label="Skapa Offert"
            onClick={handleCreateOffer}
            className="text-green-400 hover:text-green-300 border-green-500/30 hover:border-green-400/50"
          />
        </div>
      </div>

      {/* Varningsmeddelanden (behåll befintlig logik) */}
      {reportGeneration.canGenerateReport && (!reportGeneration.hasTechnicianEmail || !reportGeneration.hasContactEmail) && (
        <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
          {!reportGeneration.hasTechnicianEmail && '⚠️ Ingen tekniker-email tillgänglig. '}
          {!reportGeneration.hasContactEmail && '⚠️ Ingen kontaktperson-email tillgänglig.'}
        </div>
      )}
    </div>
  )
}

// Alternativ design för mobil - vertikal stack på små skärmar
export function MobileOptimizedHeader({ currentCase, reportGeneration }: EnhancedHeaderProps) {
  const navigate = useNavigate()
  
  return (
    <div className="mb-6 -mt-6 -mx-6 px-6 py-4 bg-slate-800/30 border-b border-slate-700">
      {/* Huvudbeskrivning */}
      <div className="flex items-center gap-3 mb-4">
        <FileCheck className="w-5 h-5 text-blue-400" />
        <span className="text-sm text-slate-300">
          Dokumenthantering för detta ärende
        </span>
      </div>

      {/* Funktioner i grid-layout för mobil */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {reportGeneration.canGenerateReport && (
          <div className="sm:col-span-1">
            <WorkReportDropdown
              onDownload={reportGeneration.downloadReport}
              onSendToTechnician={reportGeneration.sendToTechnician}
              onSendToContact={reportGeneration.sendToContact}
              disabled={!reportGeneration.canGenerateReport || reportGeneration.isGenerating}
              technicianName={reportGeneration.technicianName}
              contactName={reportGeneration.contactName}
            />
          </div>
        )}

        <ActionButton
          icon={FileSignature}
          label="Skapa Avtal"
          onClick={() => {/* avtal-logik */}}
          className="text-purple-400 hover:text-purple-300 border-purple-500/30"
        />

        <ActionButton
          icon={Calculator}
          label="Skapa Offert" 
          onClick={() => {/* offert-logik */}}
          className="text-green-400 hover:text-green-300 border-green-500/30"
        />
      </div>
    </div>
  )
}