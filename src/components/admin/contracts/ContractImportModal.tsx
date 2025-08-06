// src/components/admin/contracts/ContractImportModal.tsx - Modal för import av OneFlow-kontrakt
import React, { useState, useEffect } from 'react'
import { X, Download, Upload, RefreshCw, CheckCircle, AlertCircle, Eye, ExternalLink, Filter } from 'lucide-react'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import toast from 'react-hot-toast'

interface OneFlowContract {
  id: string
  name: string
  state: string
  template_name: string
  created_time: string
  updated_time: string
  is_imported: boolean
  type: 'contract' | 'offer'
}

interface ImportResult {
  contract_id: string
  contract_name?: string
  success: boolean
  error?: string
  type?: 'contract' | 'offer'
  status?: string
}

interface ContractImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

export default function ContractImportModal({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: ContractImportModalProps) {
  const [contracts, setContracts] = useState<OneFlowContract[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set())
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Filter states
  const [typeFilter, setTypeFilter] = useState<'all' | 'contract' | 'offer'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'imported' | 'not_imported'>('all')

  // Ladda kontrakt när modal öppnas
  useEffect(() => {
    if (isOpen) {
      loadContracts()
    } else {
      // Rensa state när modal stängs
      setContracts([])
      setSelectedContracts(new Set())
      setImportResults([])
      setCurrentPage(1)
    }
  }, [isOpen])

  const loadContracts = async (page: number = 1) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/oneflow/import-contracts?action=list&page=${page}&limit=50`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Kunde inte hämta kontrakt från OneFlow')
      }

      if (page === 1) {
        setContracts(data.data.contracts)
      } else {
        setContracts(prev => [...prev, ...data.data.contracts])
      }

      setTotalCount(data.data.pagination.total_count)
      setHasMore(data.data.pagination.has_more)
      setCurrentPage(page)

    } catch (error: any) {
      console.error('Fel vid laddning av kontrakt:', error)
      toast.error('Kunde inte hämta kontrakt från OneFlow')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreContracts = () => {
    if (hasMore && !loading) {
      loadContracts(currentPage + 1)
    }
  }

  const toggleContractSelection = (contractId: string) => {
    setSelectedContracts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(contractId)) {
        newSet.delete(contractId)
      } else {
        newSet.add(contractId)
      }
      return newSet
    })
  }

  const selectAllVisible = () => {
    const visibleContracts = getFilteredContracts().filter(c => !c.is_imported)
    const allVisible = visibleContracts.every(c => selectedContracts.has(c.id))
    
    if (allVisible) {
      // Avmarkera alla synliga
      setSelectedContracts(prev => {
        const newSet = new Set(prev)
        visibleContracts.forEach(c => newSet.delete(c.id))
        return newSet
      })
    } else {
      // Markera alla synliga
      setSelectedContracts(prev => {
        const newSet = new Set(prev)
        visibleContracts.forEach(c => newSet.add(c.id))
        return newSet
      })
    }
  }

  const importSelectedContracts = async () => {
    if (selectedContracts.size === 0) {
      toast.error('Välj minst ett kontrakt att importera')
      return
    }

    setImporting(true)
    setImportResults([])

    try {
      const contractIds = Array.from(selectedContracts)
      
      const response = await fetch('/api/oneflow/import-contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'import',
          contractIds
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Import misslyckades')
      }

      setImportResults(data.data.results)
      
      const successCount = data.data.summary.successful
      const failCount = data.data.summary.failed

      if (successCount > 0 && failCount === 0) {
        toast.success(`🎉 ${successCount} kontrakt importerade framgångsrikt!`)
      } else if (successCount > 0 && failCount > 0) {
        toast.success(`✅ ${successCount} kontrakt importerade, ${failCount} misslyckades`)
      } else {
        toast.error(`❌ Alla ${failCount} import-försök misslyckades`)
      }

      // Uppdatera kontrakt-lista för att reflektera importerade kontrakt
      setContracts(prev => prev.map(contract => ({
        ...contract,
        is_imported: data.data.results.some((r: ImportResult) => 
          r.contract_id === contract.id && r.success
        ) || contract.is_imported
      })))

      // Rensa urval
      setSelectedContracts(new Set())

      // Notifiera om import slutförd
      if (onImportComplete && successCount > 0) {
        onImportComplete()
      }

    } catch (error: any) {
      console.error('Import error:', error)
      toast.error(`Import misslyckades: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const getFilteredContracts = () => {
    return contracts.filter(contract => {
      const matchesType = typeFilter === 'all' || contract.type === typeFilter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'imported' && contract.is_imported) ||
        (statusFilter === 'not_imported' && !contract.is_imported)
      
      return matchesType && matchesStatus
    })
  }

  const getStatusIcon = (contract: OneFlowContract) => {
    if (contract.is_imported) {
      return <CheckCircle className="w-4 h-4 text-green-400" />
    }
    return <Upload className="w-4 h-4 text-slate-400" />
  }

  const getStatusText = (contract: OneFlowContract) => {
    if (contract.is_imported) {
      return 'Importerat'
    }
    return 'Inte importerat'
  }

  const getStateColor = (state: string) => {
    const colors: { [key: string]: string } = {
      'draft': 'text-slate-400',
      'pending': 'text-yellow-400', 
      'published': 'text-blue-400',
      'signed': 'text-green-400',
      'completed': 'text-emerald-400',
      'declined': 'text-red-400',
      'cancelled': 'text-red-400',
      'expired': 'text-orange-400'
    }
    return colors[state] || 'text-slate-400'
  }

  if (!isOpen) {
    return null
  }

  const filteredContracts = getFilteredContracts()
  const availableForImport = filteredContracts.filter(c => !c.is_imported)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Importera OneFlow Kontrakt</h3>
              <p className="text-sm text-slate-400">
                {totalCount > 0 ? `${totalCount} kontrakt tillgängliga i OneFlow` : 'Laddar kontrakt...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadContracts(1)}
              disabled={loading}
              className="text-slate-400"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-800/30 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filter:</span>
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alla typer</option>
              <option value="contract">Avtal</option>
              <option value="offer">Offerter</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alla status</option>
              <option value="not_imported">Inte importerade</option>
              <option value="imported">Importerade</option>
            </select>

            <div className="flex-1" />

            {availableForImport.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllVisible}
                className="text-xs"
              >
                {availableForImport.every(c => selectedContracts.has(c.id)) ? 'Avmarkera alla' : 'Markera alla'}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && contracts.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-slate-400">Laddar kontrakt från OneFlow...</span>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-20">
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">Inga kontrakt matchade filtren</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[500px]">
              <div className="space-y-2 p-4">
                {filteredContracts.map(contract => (
                  <div
                    key={contract.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      contract.is_imported
                        ? 'bg-green-500/10 border-green-500/20'
                        : selectedContracts.has(contract.id)
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700/50'
                    }`}
                  >
                    {/* Checkbox */}
                    {!contract.is_imported && (
                      <input
                        type="checkbox"
                        checked={selectedContracts.has(contract.id)}
                        onChange={() => toggleContractSelection(contract.id)}
                        className="rounded border-slate-600 text-blue-500 focus:ring-blue-500"
                      />
                    )}
                    
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {getStatusIcon(contract)}
                    </div>
                    
                    {/* Contract Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white truncate">{contract.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          contract.type === 'offer' 
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {contract.type === 'offer' ? 'Offert' : 'Avtal'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>Mall: {contract.template_name}</span>
                        <span className={getStateColor(contract.state)}>
                          Status: {contract.state}
                        </span>
                        <span>{getStatusText(contract)}</span>
                        <span>
                          Skapad: {new Date(contract.created_time).toLocaleDateString('sv-SE')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://app.oneflow.com/contracts/${contract.id}`, '_blank')}
                        className="text-slate-400 hover:text-slate-300"
                        title="Öppna i OneFlow"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="text-center p-4 border-t border-slate-700">
                  <Button
                    variant="outline"
                    onClick={loadMoreContracts}
                    disabled={loading}
                    className="text-sm"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Laddar...
                      </>
                    ) : (
                      `Ladda fler kontrakt`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Import Results */}
        {importResults.length > 0 && (
          <div className="border-t border-slate-700 p-4 bg-slate-900/50 max-h-40 overflow-y-auto">
            <h4 className="font-medium text-white mb-3">Import Resultat:</h4>
            <div className="space-y-1 text-sm">
              {importResults.map((result, index) => (
                <div key={index} className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-slate-300">
                    {result.contract_name || `Kontrakt ${result.contract_id}`}:
                  </span>
                  <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                    {result.success ? 'Importerat' : result.error}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <div className="text-sm text-slate-400">
            {selectedContracts.size > 0 ? (
              `${selectedContracts.size} kontrakt valda för import`
            ) : (
              `${availableForImport.length} kontrakt tillgängliga för import`
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={importing}
            >
              Stäng
            </Button>
            
            {selectedContracts.size > 0 && (
              <Button
                onClick={importSelectedContracts}
                disabled={importing}
                className="flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importerar...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importera ({selectedContracts.size})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}