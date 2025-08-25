// src/components/organisation/CompactCasesList.tsx
// Skalbar kompakt ärendelista för organisationsroller

import React from 'react'
import { ChevronRight, Calendar, User, DollarSign } from 'lucide-react'
import PDFExportButton from '../shared/PDFExportButton'

interface CaseRowData {
  // Kärn-info
  id: string
  case_number?: string
  title?: string
  status: string
  created_at: string
  updated_at?: string
  
  // Trafikljus (bara för legacy cases)
  pest_level?: number | null
  problem_rating?: number | null
  
  // Kontext  
  price?: number | null
  primary_technician_name?: string | null
  
  // Från customers via join eller manuell fetch
  customers?: {
    company_name?: string
    site_name?: string
  }
}

interface CompactCasesListProps {
  cases: CaseRowData[]
  onCaseClick: (caseData: CaseRowData) => void
  loading?: boolean
  className?: string
  userRole?: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
  customerData?: any
  showPDFExport?: boolean
}

export default function CompactCasesList({ 
  cases, 
  onCaseClick, 
  loading = false, 
  className = '',
  userRole = 'platsansvarig',
  customerData,
  showPDFExport = true
}: CompactCasesListProps) {
  
  // PDF Export functionality
  const handlePDFExport = async () => {
    try {
      const response = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportType: 'multiple',
          cases: cases,
          customerData: customerData,
          userRole: userRole,
          period: 'aktuell visning'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.pdf) {
        // Create blob and download
        const pdfBlob = new Blob([
          Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))
        ], { type: 'application/pdf' })
        
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || 'BeGone_Arenderapport.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        throw new Error(data.error || 'PDF generation failed')
      }
    } catch (error) {
      console.error('PDF export failed:', error)
      throw error
    }
  }
  
  // Trafikljussystem baserat på pest_level och problem_rating
  const getTrafficLightStatus = (pest_level?: number | null, problem_rating?: number | null) => {
    if (pest_level === null && problem_rating === null) {
      return { color: 'bg-slate-600', emoji: '⚪', label: 'Ej bedömd' }
    }
    
    if ((pest_level && pest_level >= 3) || (problem_rating && problem_rating >= 4)) {
      return { color: 'bg-red-500', emoji: '🔴', label: 'Kritisk' }
    }
    
    if ((pest_level && pest_level === 2) || (problem_rating && problem_rating === 3)) {
      return { color: 'bg-yellow-500', emoji: '🟡', label: 'Varning' }
    }
    
    return { color: 'bg-green-500', emoji: '🟢', label: 'OK' }
  }

  // Status badge färger
  const getStatusBadgeColor = (status: string) => {
    if (status === 'Slutförd' || status === 'Stängd') return 'bg-green-500/20 text-green-400 border-green-500/50'
    if (status === 'Bokad' || status === 'Bokat' || status.startsWith('Återbesök')) return 'bg-amber-500/20 text-amber-400 border-amber-500/50'
    if (status === 'Öppen') return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    if (status === 'Pågående') return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
    return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
  }

  // Formatera datum relativt
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return diffInHours < 1 ? 'Just nu' : 
             diffInHours < 2 ? '1h sedan' : 
             `${Math.floor(diffInHours)}h sedan`
    }
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays === 1) return 'Igår'
    if (diffInDays < 7) return `${diffInDays} dagar sedan`
    
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
  }

  // Formatera kostnad
  const formatPrice = (price?: number | null) => {
    if (!price || price === 0) return 'Ingår i avtal'
    return `${price.toLocaleString('sv-SE')} kr`
  }

  // Loading state
  if (loading) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-lg ${className}`}>
        <div className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-4 h-4 bg-slate-700 rounded-full"></div>
                <div className="w-20 h-4 bg-slate-700 rounded"></div>
                <div className="flex-1 h-4 bg-slate-700 rounded"></div>
                <div className="w-16 h-6 bg-slate-700 rounded-full"></div>
                <div className="w-16 h-4 bg-slate-700 rounded"></div>
                <div className="w-16 h-4 bg-slate-700 rounded"></div>
                <div className="w-4 h-4 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!cases || cases.length === 0) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700 rounded-lg ${className}`}>
        <div className="p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">Inga ärenden hittades</p>
          <p className="text-slate-500 text-sm mt-1">Prova att ändra filtreringen eller kontrollera tillgängligheten</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Ärenden ({cases.length})
          </h3>
          {showPDFExport && cases.length > 0 && (
            <PDFExportButton
              onExport={handlePDFExport}
              variant="secondary"
              size="sm"
              label="Exportera rapport"
              className="ml-4"
              tooltip="Exportera alla ärenden som PDF-rapport"
            />
          )}
        </div>
      </div>

      {/* Cases list */}
      <div className="divide-y divide-slate-700/50">
        {cases.map((caseData, index) => {
          const trafficLight = getTrafficLightStatus(caseData.pest_level, caseData.problem_rating)
          
          return (
            <div
              key={caseData.id || index}
              onClick={() => onCaseClick(caseData)}
              className={`
                group flex items-center gap-4 px-6 py-3 cursor-pointer transition-all duration-200
                hover:bg-slate-700/30 hover:border-l-4 hover:border-l-emerald-500
                ${index % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/40'}
              `}
            >
              {/* Trafikljus indikator */}
              <div 
                className={`w-3 h-3 rounded-full flex-shrink-0 ${trafficLight.color}`}
                title={trafficLight.label}
              />

              {/* Ärendenummer */}
              <div className="w-20 flex-shrink-0">
                <span className="text-purple-400 font-mono text-sm font-medium">
                  {caseData.case_number || 'N/A'}
                </span>
              </div>

              {/* Titel */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">
                  {caseData.title || 'Ingen titel'}
                </p>
                {/* Företag/site som subtitle på mobil */}
                <p className="text-slate-400 text-xs truncate lg:hidden">
                  {caseData.customers?.company_name}
                  {caseData.customers?.site_name && ` - ${caseData.customers.site_name}`}
                </p>
              </div>

              {/* Status badge */}
              <div className="hidden sm:block flex-shrink-0">
                <span className={`
                  px-2 py-1 rounded text-xs font-medium border
                  ${getStatusBadgeColor(caseData.status)}
                `}>
                  {caseData.status}
                </span>
              </div>

              {/* Tekniker (dold på tablet) */}
              <div className="hidden lg:block w-16 flex-shrink-0">
                {caseData.primary_technician_name ? (
                  <div className="flex items-center gap-1" title={caseData.primary_technician_name}>
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-300 text-xs truncate">
                      {caseData.primary_technician_name.split(' ')[0]}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs">Ej tilldelad</span>
                )}
              </div>

              {/* Kostnad (dold på mobil) */}
              <div className="hidden md:block w-20 flex-shrink-0">
                <div className="flex items-center gap-1" title="Kostnad">
                  <DollarSign className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-300 text-xs">
                    {formatPrice(caseData.price)}
                  </span>
                </div>
              </div>

              {/* Datum */}
              <div className="w-16 flex-shrink-0 text-right">
                <span className="text-slate-400 text-xs">
                  {formatRelativeDate(caseData.created_at)}
                </span>
              </div>

              {/* Chevron */}
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />
            </div>
          )
        })}
      </div>

      {/* Footer med totaler */}
      {cases.length > 0 && (
        <div className="bg-slate-900/50 px-6 py-3 border-t border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Visar {cases.length} ärenden</span>
            <span>Sorterat efter datum (nyast först)</span>
          </div>
        </div>
      )}
    </div>
  )
}