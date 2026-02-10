// src/components/admin/contracts/ContractFilesModal.tsx - Modal för att visa kontraktsfiler
import React, { useEffect, useState } from 'react'
import { X, Download, File, Loader, RefreshCw } from 'lucide-react'
import Button from '../../ui/Button'
import { ContractFile } from '../../../types/database'
import {
  getFileTypeIcon,
  getFileTypeLabel,
  getDownloadStatusColor,
  getDownloadStatusLabel,
  formatFileSize
} from '../../../services/contractFilesService'
import { useContracts } from '../../../hooks/useContracts'
import toast from 'react-hot-toast'

interface ContractFilesModalProps {
  isOpen: boolean
  onClose: () => void
  contractId: string | null
  contractName?: string
}

// Enstaka fil-komponent
const FileRow: React.FC<{
  file: ContractFile
  onDownload: (fileId: string) => void
  isDownloading: boolean
}> = ({ file, onDownload, isDownloading }) => {
  const statusColor = getDownloadStatusColor(file.download_status)

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-800/30 rounded-lg border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <span className="text-lg" title={getFileTypeLabel(file.file_type)}>
          {getFileTypeIcon(file.file_type)}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {file.file_name}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{getFileTypeLabel(file.file_type)}</span>
            {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
            {file.downloaded_at && (
              <span>Nedladdad {new Date(file.downloaded_at).toLocaleDateString('sv-SE')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium border"
          style={{
            color: statusColor,
            backgroundColor: `${statusColor}20`,
            borderColor: `${statusColor}30`
          }}
        >
          {getDownloadStatusLabel(file.download_status)}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(file.id)}
          disabled={isDownloading}
          className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {isDownloading ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

export default function ContractFilesModal({ isOpen, onClose, contractId, contractName }: ContractFilesModalProps) {
  const {
    contractFiles,
    filesLoading,
    downloadingFiles,
    loadContractFiles,
    downloadContractFile
  } = useContracts()

  const [isRefreshing, setIsRefreshing] = useState(false)

  const currentContractFiles = contractId ? contractFiles[contractId] || [] : []
  const isLoading = contractId ? filesLoading[contractId] || false : false

  useEffect(() => {
    if (isOpen && contractId) {
      handleLoadFiles()
    }
  }, [isOpen, contractId])

  const handleLoadFiles = async () => {
    if (!contractId) return

    try {
      setIsRefreshing(true)
      await loadContractFiles(contractId)
    } catch (error) {
      console.error('Fel vid laddning av filer:', error)
      toast.error('Kunde inte ladda filer')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDownload = async (fileId: string) => {
    if (!contractId) return

    try {
      await downloadContractFile(contractId, fileId)
    } catch (error) {
      console.error('Fel vid nedladdning:', error)
    }
  }

  const handleClose = () => {
    setIsRefreshing(false)
    onClose()
  }

  if (!isOpen || !contractId) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4 text-blue-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">Kontraktsfiler</h3>
              {contractName && (
                <p className="text-xs text-slate-400">{contractName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadFiles}
              disabled={isLoading || isRefreshing}
              className="text-slate-400"
            >
              <RefreshCw className={`w-4 h-4 ${(isLoading || isRefreshing) ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-slate-400"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-slate-400 text-sm">Laddar filer...</span>
            </div>
          ) : currentContractFiles.length === 0 ? (
            <div className="text-center py-4">
              <File className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Inga filer tillgängliga</p>
              <p className="text-xs text-slate-500 mt-1">
                Detta kontrakt har inga associerade filer i OneFlow
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {currentContractFiles.map(file => (
                <FileRow
                  key={file.id}
                  file={file}
                  onDownload={handleDownload}
                  isDownloading={downloadingFiles[file.id] || false}
                />
              ))}
            </div>
          )}

          {/* Stats */}
          {currentContractFiles.length > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-700/50">
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  {currentContractFiles.length} fil{currentContractFiles.length !== 1 ? 'er' : ''} totalt
                </span>
                <span>
                  {currentContractFiles.filter(f => f.download_status === 'completed').length} nedladdade
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
