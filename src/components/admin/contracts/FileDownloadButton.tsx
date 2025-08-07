// src/components/admin/contracts/FileDownloadButton.tsx - Knapp för att ladda ner kontraktsfiler
import React, { useState, useEffect } from 'react'
import { FileText, Loader, Download } from 'lucide-react'
import Button from '../../ui/Button'
import { useContracts } from '../../../hooks/useContracts'
import { ContractFile } from '../../../types/database'

interface FileDownloadButtonProps {
  contractId: string
  showLabel?: boolean
  variant?: 'ghost' | 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  onFilesModalOpen?: () => void
  className?: string
}

export default function FileDownloadButton({ 
  contractId, 
  showLabel = false,
  variant = 'ghost',
  size = 'sm',
  onFilesModalOpen,
  className = ''
}: FileDownloadButtonProps) {
  const { 
    contractFiles, 
    filesLoading, 
    downloadingFiles,
    loadContractFiles,
    downloadContractFile,
    hasContractFiles
  } = useContracts()
  
  const currentFiles = contractFiles[contractId] || []
  const isLoading = filesLoading[contractId] || false
  const hasCachedFiles = hasContractFiles(contractId)
  const hasDownloading = Object.keys(downloadingFiles).some(fileId => 
    downloadingFiles[fileId] && currentFiles.some(f => f.id === fileId)
  )

  // Ladda filer automatiskt när komponenten monteras
  useEffect(() => {
    if (!hasCachedFiles && !isLoading) {
      loadContractFiles(contractId).catch(console.error)
    }
  }, [contractId, hasCachedFiles, isLoading, loadContractFiles])

  // Hantera fil-laddning och nedladdning
  const handleQuickDownload = async () => {
    try {
      // Om filer inte är laddade, ladda dem först
      if (!hasCachedFiles) {
        const files = await loadContractFiles(contractId)
        
        // Efter laddning, kolla resultatet
        if (files.length === 0) {
          return // Inga filer att ladda ner
        }
        
        if (files.length === 1) {
          // Ladda ner direkt om endast en fil
          await downloadContractFile(contractId, files[0].id)
        } else {
          // Öppna modal om flera filer
          onFilesModalOpen?.()
        }
        return
      }
      
      // Filer redan laddade - hantera baserat på antal
      if (currentFiles.length === 0) {
        return // Inga filer att ladda ner
      }
      
      if (currentFiles.length === 1) {
        // Ladda ner direkt om endast en fil
        const file = currentFiles[0]
        await downloadContractFile(contractId, file.id)
      } else {
        // Öppna modal om flera filer
        onFilesModalOpen?.()
      }
    } catch (error) {
      console.error('Fel vid hantering av filer:', error)
    }
  }

  // Räkna ut status
  const getButtonState = () => {
    if (isLoading) {
      return {
        icon: Loader,
        text: 'Laddar...',
        disabled: true,
        spin: true
      }
    }
    
    if (hasDownloading) {
      return {
        icon: Loader,
        text: 'Laddar ner...',
        disabled: true,
        spin: true
      }
    }
    
    // Om filer inte laddade än
    if (!hasCachedFiles) {
      return {
        icon: FileText,
        text: 'Ladda filer',
        disabled: false,
        spin: false
      }
    }
    
    // Inga filer efter laddning
    if (currentFiles.length === 0) {
      return {
        icon: FileText,
        text: 'Inga filer',
        disabled: true,
        spin: false
      }
    }
    
    const completedCount = currentFiles.filter(f => f.download_status === 'completed').length
    
    return {
      icon: currentFiles.length === 1 ? Download : FileText,
      text: currentFiles.length === 1 
        ? (completedCount > 0 ? 'Ladda ner igen' : 'Ladda ner')
        : `${currentFiles.length} filer`,
      disabled: false,
      spin: false
    }
  }

  const buttonState = getButtonState()
  const IconComponent = buttonState.icon

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleQuickDownload}
      disabled={buttonState.disabled}
      className={`${variant === 'ghost' ? 'text-slate-400 hover:text-slate-300' : ''} ${className}`}
      title={
        !hasCachedFiles
          ? 'Klicka för att ladda kontraktsfiler'
          : currentFiles.length === 0 
            ? 'Inga filer tillgängliga'
            : currentFiles.length === 1
              ? `Ladda ner: ${currentFiles[0].file_name}`
              : `Visa ${currentFiles.length} filer`
      }
    >
      <IconComponent 
        className={`w-4 h-4 ${showLabel ? 'mr-2' : ''} ${buttonState.spin ? 'animate-spin' : ''}`} 
      />
      {showLabel && (
        <span className="text-xs">{buttonState.text}</span>
      )}
    </Button>
  )
}