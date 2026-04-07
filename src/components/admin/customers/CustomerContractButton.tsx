// src/components/admin/customers/CustomerContractButton.tsx
// Knapp för att öppna/ladda ned Oneflow-avtal direkt från kundlistan

import React, { useState, useRef, useEffect } from 'react'
import { FileText, ExternalLink, Download, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface CustomerContractButtonProps {
  oneflowContractId: string
  customerName: string
}

interface OneflowFile {
  id: number
  name: string
  type: string
  extension: string
}

export default function CustomerContractButton({
  oneflowContractId,
  customerName,
}: CustomerContractButtonProps) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<OneflowFile[] | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Stäng dropdown vid klick utanför
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const fetchFiles = async () => {
    if (files !== null) return // Redan hämtat
    setLoadingFiles(true)
    try {
      const res = await fetch(
        `/api/oneflow/contract-files-direct?oneflowContractId=${encodeURIComponent(oneflowContractId)}`
      )
      const data = await res.json()
      if (data.success) {
        setFiles(data.files ?? [])
      } else {
        toast.error('Kunde inte hämta avtalsfiler')
        setFiles([])
      }
    } catch {
      toast.error('Nätverksfel vid hämtning av avtalsfiler')
      setFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleOpen = async () => {
    setOpen(prev => !prev)
    if (!open) {
      await fetchFiles()
    }
  }

  const handleView = async (file: OneflowFile) => {
    setActionLoading(file.id)
    try {
      const res = await fetch('/api/oneflow/view-file-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oneflowContractId, fileId: file.id }),
      })
      const data = await res.json()
      if (data.success && data.viewUrl) {
        window.open(data.viewUrl, '_blank', 'noopener,noreferrer')
      } else {
        toast.error('Kunde inte öppna avtalet')
      }
    } catch {
      toast.error('Nätverksfel')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDownload = async (file: OneflowFile) => {
    setActionLoading(file.id * -1) // Negativt ID för nedladdning
    try {
      const dlRes = await fetch('/api/oneflow/download-file-oneflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oneflowContractId, fileId: file.id, fileName: file.name }),
      })

      if (!dlRes.ok) {
        toast.error('Kunde inte ladda ned avtalet')
        return
      }

      const blob = await dlRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${file.name}.${file.extension}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${file.name} nedladdad`)
    } catch {
      toast.error('Nätverksfel vid nedladdning')
    } finally {
      setActionLoading(null)
    }
  }

  // Välj den bästa filen att visa (kontrakt-PDF prioriteras)
  const primaryFile = files?.find(f => f.type === 'contract' || f.type === 'pdf') ?? files?.[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors"
        title={`Avtal – ${customerName}`}
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Avtal</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {loadingFiles ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Hämtar filer...
            </div>
          ) : files === null || files.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">
              Inga avtalsfiler hittades
            </div>
          ) : (
            <div className="py-1">
              {/* Snabbknappar för primärfil */}
              {primaryFile && (
                <>
                  <button
                    onClick={() => handleView(primaryFile)}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === primaryFile.id ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>Öppna avtal</span>
                  </button>
                  <button
                    onClick={() => handleDownload(primaryFile)}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:text-[#20c58f] hover:bg-[#20c58f]/10 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === primaryFile.id * -1 ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <Download className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>Ladda ned avtal</span>
                  </button>
                </>
              )}

              {/* Övriga filer om det finns fler */}
              {files.length > 1 && (
                <>
                  <div className="mx-4 my-1 border-t border-slate-700/50" />
                  <div className="px-4 py-1 text-xs text-slate-500">Alla filer</div>
                  {files.map(file => (
                    <div key={file.id} className="flex items-center justify-between px-4 py-1.5 hover:bg-slate-700/30">
                      <span className="text-xs text-slate-400 truncate flex-1 mr-2">{file.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleView(file)}
                          disabled={actionLoading !== null}
                          className="p-1 text-slate-500 hover:text-[#20c58f] transition-colors disabled:opacity-50"
                          title="Öppna"
                        >
                          {actionLoading === file.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={actionLoading !== null}
                          className="p-1 text-slate-500 hover:text-[#20c58f] transition-colors disabled:opacity-50"
                          title="Ladda ned"
                        >
                          {actionLoading === file.id * -1 ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
