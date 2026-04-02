import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Loader2, RefreshCw, ExternalLink, Building2, Hash, Mail, Phone, MapPin } from 'lucide-react'
import { FortnoxService, FortnoxCustomer } from '../../../services/fortnoxService'
import Button from '../../../components/ui/Button'
import toast from 'react-hot-toast'

export default function FortnoxPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [connected, setConnected] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [customers, setCustomers] = useState<FortnoxCustomer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    document.title = 'Fortnox - BeGone Admin'
  }, [])

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Fortnox anslutet!')
    } else if (searchParams.get('error')) {
      toast.error(`Anslutning misslyckades: ${searchParams.get('error')}`)
    }
  }, [searchParams])

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setStatusLoading(true)
    const status = await FortnoxService.getConnectionStatus()
    setConnected(status.connected)
    setCompanyName(status.companyName ?? null)
    setStatusLoading(false)
    if (status.connected) {
      loadCustomers(1)
    }
  }

  const loadCustomers = async (page: number) => {
    setCustomersLoading(true)
    try {
      const result = await FortnoxService.getCustomers(page)
      setCustomers(result.customers)
      setTotalPages(result.totalPages)
      setCurrentPage(page)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Okänt fel'
      toast.error(`Kunde inte hämta kunder: ${message}`)
    } finally {
      setCustomersLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Fortnox</h1>
          <p className="text-sm text-slate-400">Hantera anslutning och kunddata</p>
        </div>
      </div>

      {/* Anslutningsstatus */}
      <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusLoading ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : connected ? (
              <CheckCircle className="w-5 h-5 text-[#20c58f]" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">
                {statusLoading ? 'Kontrollerar...' : connected ? 'Ansluten' : 'Ej ansluten'}
              </p>
              {connected && companyName && (
                <p className="text-xs text-slate-400">{companyName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connected && (
              <button
                onClick={() => checkStatus()}
                className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Uppdatera status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {!connected && !statusLoading && (
              <Button
                variant="primary"
                onClick={() => { window.location.href = '/api/fortnox/auth' }}
              >
                Anslut till Fortnox
              </Button>
            )}
            {connected && (
              <a
                href="https://apps.fortnox.se"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Öppna Fortnox <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Kundlista */}
      {connected && (
        <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Kunder i Fortnox</h2>
              {!customersLoading && (
                <span className="text-xs text-slate-500 ml-1">
                  ({customers.length} visade)
                </span>
              )}
            </div>
            <button
              onClick={() => loadCustomers(currentPage)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Ladda om"
            >
              <RefreshCw className={`w-4 h-4 ${customersLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {customersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Inga kunder hittades i Fortnox
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {customers.map((customer) => (
                  <div
                    key={customer.CustomerNumber}
                    className="px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        <Building2 className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">
                            {customer.Name}
                          </span>
                          {!customer.Active && (
                            <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                              Inaktiv
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {customer.OrganisationNumber && (
                            <span className="text-xs text-slate-500">{customer.OrganisationNumber}</span>
                          )}
                          {customer.Email && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="w-3 h-3" />
                              {customer.Email}
                            </span>
                          )}
                          {customer.Phone1 && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="w-3 h-3" />
                              {customer.Phone1}
                            </span>
                          )}
                          {customer.City && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" />
                              {customer.City}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Hash className="w-3 h-3 text-slate-500" />
                      <span className="text-sm font-mono text-slate-300">{customer.CustomerNumber}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-700/50">
                  <button
                    onClick={() => loadCustomers(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Föregående
                  </button>
                  <span className="text-xs text-slate-400">
                    Sida {currentPage} av {totalPages}
                  </span>
                  <button
                    onClick={() => loadCustomers(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Nästa
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
