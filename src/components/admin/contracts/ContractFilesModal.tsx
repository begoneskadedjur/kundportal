// src/components/admin/contracts/ContractFilesModal.tsx - Modal för att visa kontraktsfiler
import React, { useEffect, useState } from 'react'
import { X, Download, File, Loader, RefreshCw } from 'lucide-react'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
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
    <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        {/* Filikon */}
        <span className="text-2xl" title={getFileTypeLabel(file.file_type)}>
          {getFileTypeIcon(file.file_type)}
        </span>
        
        {/* Filinfo */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">
            {file.file_name}
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{getFileTypeLabel(file.file_type)}</span>
            {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
            {file.downloaded_at && (
              <span>Nedladdad {new Date(file.downloaded_at).toLocaleDateString('sv-SE')}</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Status och åtgärder */}
      <div className="flex items-center gap-3">
        {/* Status badge */}
        <span 
          className="px-2 py-1 rounded-full text-xs font-medium border"
          style={{ 
            color: statusColor,
            backgroundColor: `${statusColor}20`,
            borderColor: `${statusColor}30`
          }}
        >
          {getDownloadStatusLabel(file.download_status)}
        </span>
        
        {/* Download knapp */}
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

  // Ladda filer när modal öppnas
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
      // Toast hanteras i hook:en
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <File className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Kontraktsfiler</h3>
              {contractName && (
                <p className="text-sm text-slate-400">{contractName}</p>
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
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-slate-400">Laddar filer...</span>
            </div>
          ) : currentContractFiles.length === 0 ? (
            <div className="text-center py-12">
              <File className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">Inga filer tillgängliga</p>
              <p className="text-sm text-slate-500 mt-1">
                Detta kontrakt har inga associerade filer i OneFlow
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
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
            <div className="mt-6 pt-4 border-t border-slate-700">
              <div className="flex justify-between text-sm text-slate-400">
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
      </Card>
    </div>
  )
}