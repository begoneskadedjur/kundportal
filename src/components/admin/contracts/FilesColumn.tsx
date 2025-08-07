// src/components/admin/contracts/FilesColumn.tsx - Kolumn för filstatus i kontraktstabell
import React, { useEffect, useState } from 'react'
import { FileText, Download, CheckCircle, Clock, XCircle } from 'lucide-react'
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
  const { contractFiles, filesLoading, loadContractFiles, hasContractFiles } = useContracts()
  
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

    return currentFiles.reduce((stats, file) => {
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
    if (stats.total === 1) {
      const file = currentFiles[0]
      switch (file.download_status) {
        case 'completed':
          return 'Nedladdad'
        case 'downloading':
          return 'Laddar ner...'
        case 'failed':
          return 'Misslyckad'
        case 'pending':
        default:
          return 'Väntande'
      }
    }

    // Flera filer - visa sammanfattning
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

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Status indikator */}
      <div className="flex items-center gap-2 min-w-0">
        {getStatusIcon()}
        <span 
          className="text-xs text-slate-400 truncate cursor-pointer"
          onClick={onFilesModalOpen}
          title="Klicka för att se alla filer"
        >
          {getStatusText()}
        </span>
      </div>

      {/* Action button */}
      {showButton && (
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