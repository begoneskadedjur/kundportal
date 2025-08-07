// src/components/admin/contracts/FilesColumn.tsx - Kolumn för filstatus i kontraktstabell
import React, { useEffect, useState } from 'react'
import { FileText, Download, CheckCircle, Clock, XCircle, Eye } from 'lucide-react'
import FileDownloadButton from './FileDownloadButton'
import { useContracts } from '../../../hooks/useContracts'
import { ContractFile } from '../../../types/database'

interface FilesColumnProps {
  contractId: string
  onFilesModalOpen?: () => void
  showButton?: boolean
}

export default function FilesColumn({ 
  contractId, 
  onFilesModalOpen,
  showButton = true 
}: FilesColumnProps) {
  const { contractFiles, filesLoading, downloadingFiles, viewingFiles, loadContractFiles, hasContractFiles, viewContractFile, downloadContractFile } = useContracts()
  
  const currentFiles = contractFiles[contractId] || []
  const isLoading = filesLoading[contractId] || false
  const hasCachedFiles = hasContractFiles(contractId)

  // Ladda filer automatiskt när komponenten monteras
  useEffect(() => {
    if (!hasCachedFiles && !isLoading) {
      loadContractFiles(contractId).catch(console.error)
    }
  }, [contractId, hasCachedFiles, isLoading, loadContractFiles])

  // Hämta filer manuellt (för refresh)
  const handleLoadFiles = async () => {
    if (!isLoading) {
      await loadContractFiles(contractId, true) // Force refresh
    }
  }

  // Räkna filstatus
  const getFileStats = () => {
    if (currentFiles.length === 0) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        failed: 0
      }
    }

    // 🔧 FIX: Deduplikation för att förhindra "1/2 nedladdade" för enstaka filer
    const deduplicatedFiles = currentFiles.filter((file, index, arr) => 
      arr.findIndex(f => f.oneflow_file_id === file.oneflow_file_id) === index
    )

    // Logga om deduplikation skedde
    if (deduplicatedFiles.length !== currentFiles.length) {
      console.warn(`🔧 FilesColumn deduplikation för ${contractId}: ${currentFiles.length} → ${deduplicatedFiles.length} filer`)
    }

    const stats = deduplicatedFiles.reduce((stats, file) => {
      stats.total++
      switch (file.download_status) {
        case 'completed':
          stats.completed++
          break
        case 'pending':
        case 'downloading':
          stats.pending++
          break
        case 'failed':
          stats.failed++
          break
      }
      return stats
    }, { total: 0, completed: 0, pending: 0, failed: 0 })

    // 🔧 DEBUG: Logga filstatistik för felsökning av "1/2 nedladdade" problemet
    if (stats.total > 0 && process.env.NODE_ENV === 'development') {
      console.log(`📊 Filstatus för kontrakt ${contractId}:`, {
        stats,
        originalCount: currentFiles.length,
        deduplicatedCount: deduplicatedFiles.length,
        originalFiles: currentFiles.map(f => ({
          id: f.id,
          name: f.file_name,
          status: f.download_status,
          oneflow_id: f.oneflow_file_id
        })),
        deduplicatedFiles: deduplicatedFiles.map(f => ({
          id: f.id,
          name: f.file_name,
          status: f.download_status,
          oneflow_id: f.oneflow_file_id
        }))
      })
    }

    return stats
  }

  const stats = getFileStats()

  // Visa loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div>
        <span className="text-slate-400 text-xs">Laddar...</span>
      </div>
    )
  }

  // Om inga filer laddade än, visa load-knapp
  if (!hasCachedFiles) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-500">
          <FileText className="w-4 h-4" />
          <span className="text-xs">Filer ej laddade</span>
        </div>
        <button
          onClick={handleLoadFiles}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
          title="Ladda filer för detta kontrakt"
        >
          Ladda
        </button>
      </div>
    )
  }

  // Inga filer efter laddning
  if (stats.total === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <FileText className="w-4 h-4" />
        <span className="text-xs">Inga filer</span>
      </div>
    )
  }

  // Visa filstatus med ikon
  const getStatusIcon = () => {
    if (stats.failed > 0) {
      return <XCircle className="w-4 h-4 text-red-400" />
    }
    if (stats.pending > 0) {
      return <Clock className="w-4 h-4 text-yellow-400" />
    }
    if (stats.completed > 0) {
      return <CheckCircle className="w-4 h-4 text-green-400" />
    }
    return <FileText className="w-4 h-4 text-slate-400" />
  }

  const getStatusText = () => {
    // 🔧 FIX: För enstaka filer - visa alltid ikoner (returnera null)
    if (stats.total === 1) {
      return null // Alltid visa ikoner för enstaka filer
    }

    // Flera filer - visa korrekt sammanfattning
    if (stats.total === 0) return 'Inga filer'
    
    if (stats.completed === stats.total) {
      return `${stats.total} nedladdade`
    }
    if (stats.pending > 0) {
      return `${stats.completed}/${stats.total} nedladdade`
    }
    if (stats.failed > 0) {
      return `${stats.completed}/${stats.total} (${stats.failed} fel)`
    }
    return `${stats.total} filer`
  }

  // Hantera direkt filåtgärder
  const handleViewFile = async (fileId: string, fileName: string) => {
    if (!contractId) return
    try {
      await viewContractFile(contractId, fileId)
    } catch (error) {
      console.error('Fel vid visning av fil:', error)
      // Förbättrad felhantering - visa inte toast här eftersom hook redan gör det
    }
  }

  const handleDownloadFile = async (fileId: string) => {
    if (!contractId) return
    try {
      await downloadContractFile(contractId, fileId)
    } catch (error) {
      console.error('Fel vid nedladdning av fil:', error)
    }
  }

  const statusText = getStatusText()
  const isSingleFile = stats.total === 1 // 🔧 FIX: Visa ikoner för ALLA enstaka filer, inte bara pending

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Status indikator */}
      <div className="flex items-center gap-2 min-w-0">
        {isSingleFile ? (
          // 🔧 FIX: Visa ikoner för ALLA enstaka filer med separerade loading states
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleViewFile(currentFiles[0].id, currentFiles[0].file_name)}
              className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              title={`👁️ Visa "${currentFiles[0].file_name}" i webbläsaren (markeras inte som nedladdad)`}
              disabled={viewingFiles[currentFiles[0].id] || false}
            >
              {viewingFiles[currentFiles[0].id] ? (
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => handleDownloadFile(currentFiles[0].id)}
              className="p-1 text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50"
              title={`⬇️ Ladda ner "${currentFiles[0].file_name}" (markeras som nedladdad)`}
              disabled={downloadingFiles[currentFiles[0].id] || false}
            >
              {downloadingFiles[currentFiles[0].id] ? (
                <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        ) : (
          // Standard status för andra fall
          <>
            {getStatusIcon()}
            <span 
              className="text-xs text-slate-400 truncate cursor-pointer"
              onClick={onFilesModalOpen}
              title="Klicka för att se alla filer"
            >
              {statusText}
            </span>
          </>
        )}
      </div>

      {/* Action button - endast för komplexa fall eller om inte single file */}
      {showButton && !isSingleFile && (
        <FileDownloadButton
          contractId={contractId}
          onFilesModalOpen={onFilesModalOpen}
          variant="ghost"
          size="sm"
        />
      )}
    </div>
  )
}