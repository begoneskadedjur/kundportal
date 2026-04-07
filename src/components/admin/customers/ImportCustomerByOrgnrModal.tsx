// src/components/admin/customers/ImportCustomerByOrgnrModal.tsx
// Modal för att importera en kund via org.nummer från Fortnox + Oneflow

import React, { useState } from 'react'
import { Building2, Search, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import toast from 'react-hot-toast'

interface ImportResult {
  customer: {
    id: string
    company_name: string
    customer_number: number | null
    organization_number: string
    oneflow_contract_id: string | null
  }
  sources: { fortnox: boolean; oneflow: boolean }
  message: string
}

interface ImportCustomerByOrgnrModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: (customerId: string) => void
}

export default function ImportCustomerByOrgnrModal({
  isOpen,
  onClose,
  onImported,
}: ImportCustomerByOrgnrModalProps) {
  const [orgNr, setOrgNr] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null)

  const handleClose = () => {
    setOrgNr('')
    setResult(null)
    setError(null)
    onClose()
  }

  const handleImport = async () => {
    const trimmed = orgNr.trim()
    if (!trimmed) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/import-customer-by-orgnr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_nr: trimmed }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setError({
          message: data.error,
          existingId: data.existing_customer?.id,
          existingName: data.existing_customer?.company_name,
        })
        return
      }

      if (!res.ok || !data.success) {
        setError({ message: data.error || 'Importering misslyckades' })
        return
      }

      setResult(data)
      toast.success(`${data.customer.company_name} importerad!`)
    } catch {
      setError({ message: 'Nätverksfel – kontrollera anslutningen och försök igen' })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && orgNr.trim()) {
      handleImport()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#20c58f]" />
          <span>Importera kund via org.nummer</span>
        </div>
      }
      subtitle="Hämtar data från Fortnox och Oneflow automatiskt"
      size="md"
    >
      <div className="p-4 space-y-4">
        {/* Input */}
        {!result && (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 block">
                Organisationsnummer
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orgNr}
                  onChange={e => setOrgNr(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="t.ex. 714800-2590 eller 7148002590"
                  className="flex-1 px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
                  disabled={loading}
                  autoFocus
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImport}
                  disabled={!orgNr.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline ml-1">
                    {loading ? 'Importerar...' : 'Importera'}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Accepterar format med eller utan bindestreck
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" />
                <span>Söker i Fortnox och Oneflow...</span>
              </div>
            )}
          </div>
        )}

        {/* Fel */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-red-300 font-medium">{error.message}</p>
                {error.existingName && (
                  <p className="text-xs text-red-400">
                    Befintlig kund: <span className="font-medium text-red-300">{error.existingName}</span>
                  </p>
                )}
                {error.existingId && (
                  <button
                    onClick={() => {
                      handleClose()
                      window.location.href = `/admin/befintliga-kunder/${error.existingId}`
                    }}
                    className="flex items-center gap-1 text-xs text-[#20c58f] hover:text-[#20c58f]/80 transition-colors mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Öppna befintlig kund
                  </button>
                )}
              </div>
            </div>
            <button
              className="mt-3 text-xs text-slate-400 hover:text-white transition-colors"
              onClick={() => setError(null)}
            >
              Försök med annat org.nummer
            </button>
          </div>
        )}

        {/* Resultat */}
        {result && (
          <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#20c58f]" />
              <p className="text-sm text-[#20c58f] font-medium">{result.message}</p>
            </div>

            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Företag</span>
                <span className="text-sm font-medium text-white">{result.customer.company_name}</span>
              </div>
              {result.customer.customer_number && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Kundnummer</span>
                  <span className="text-sm text-slate-300">#{result.customer.customer_number}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Org.nummer</span>
                <span className="text-sm text-slate-300">{result.customer.organization_number}</span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div className={`flex items-center gap-1 text-xs ${result.sources.fortnox ? 'text-[#20c58f]' : 'text-slate-500'}`}>
                  <CheckCircle className="w-3 h-3" />
                  Fortnox
                </div>
                <div className={`flex items-center gap-1 text-xs ${result.sources.oneflow ? 'text-[#20c58f]' : 'text-slate-500'}`}>
                  {result.sources.oneflow ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  Oneflow {!result.sources.oneflow && '(ej hittad)'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-2">
        {result ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => { setResult(null); setOrgNr('') }}>
              Importera fler
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onImported(result.customer.id)
                handleClose()
              }}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Visa kund
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Avbryt
          </Button>
        )}
      </div>
    </Modal>
  )
}
