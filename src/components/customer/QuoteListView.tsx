// src/components/customer/QuoteListView.tsx - Quote management for customers
import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Eye, Download, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import QuoteDetailModal from './QuoteDetailModal'

interface Quote {
  id: string
  oneflow_contract_id: string | null
  type: 'quote' | 'contract'
  status: string
  company_name: string
  contact_person: string
  contact_email: string
  total_value: number | null
  selected_products: any[]
  agreement_text: string | null
  start_date: string | null
  contract_length: string | null
  validity_period: string | null
  document_url: string | null
  signing_deadline: string | null
  created_at: string
  updated_at: string
}

interface QuoteListViewProps {
  customerId: string
}

const QuoteListView: React.FC<QuoteListViewProps> = ({ customerId }) => {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  useEffect(() => {
    fetchQuotes()
  }, [customerId])

  const fetchQuotes = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('quotes_secure_view')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setQuotes(data || [])
    } catch (error: any) {
      console.error('Error fetching quotes:', error)
      setError(`Kunde inte hämta offerter: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-amber-500" />
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'signed':
        return 'Signerad'
      case 'pending':
        return 'Väntar på svar'
      case 'rejected':
        return 'Avvisad'
      case 'expired':
        return 'Utgången'
      default:
        return status
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Ej specificerat'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Ej specificerat'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount)
  }

  const getProductSummary = (products: any[]) => {
    if (!products || products.length === 0) return 'Inga produkter'
    
    const productNames = products
      .flatMap(p => p.products || [])
      .map(p => p.name)
      .filter(Boolean)
    
    if (productNames.length === 0) return 'Inga produkter'
    if (productNames.length === 1) return productNames[0]
    if (productNames.length <= 3) return productNames.join(', ')
    
    return `${productNames.slice(0, 2).join(', ')} och ${productNames.length - 2} andra`
  }

  const openInOneflow = (oneflowContractId: string) => {
    window.open(`https://app.oneflow.com/contract/${oneflowContractId}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Ett fel uppstod</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchQuotes} className="bg-emerald-500 hover:bg-emerald-600">
            Försök igen
          </Button>
        </div>
      </Card>
    )
  }

  if (quotes.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Inga offerter</h3>
          <p className="text-slate-400">
            Du har inga offerter eller kontrakt än. De kommer att visas här när de skapas.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Offerter & Kontrakt</h1>
          <p className="text-slate-400">Hantera dina offerter och avtalsförhandlingar</p>
        </div>
        <div className="text-sm text-slate-400">
          {quotes.length} {quotes.length === 1 ? 'offert' : 'offerter'}
        </div>
      </div>

      {/* Quote Cards */}
      <div className="grid gap-6">
        {quotes.map((quote) => (
          <Card key={quote.id} className="p-6 hover:bg-slate-800/60 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(quote.status)}
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {quote.type === 'contract' ? 'Kontrakt' : 'Offert'} - {quote.company_name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {getStatusText(quote.status)} • {formatDate(quote.created_at)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {quote.oneflow_contract_id && (
                  <Button
                    onClick={() => openInOneflow(quote.oneflow_contract_id!)}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Öppna i OneFlow
                  </Button>
                )}
              </div>
            </div>

            {/* Quote Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Kontaktperson</p>
                <p className="text-white">{quote.contact_person}</p>
                <p className="text-sm text-slate-400">{quote.contact_email}</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Produkter</p>
                <p className="text-white">{getProductSummary(quote.selected_products)}</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Startdatum</p>
                <p className="text-white">{formatDate(quote.start_date)}</p>
              </div>
            </div>

            {/* Contract Details (if applicable) */}
            {quote.type === 'contract' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pt-4 border-t border-slate-700">
                {quote.contract_length && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Kontraktslängd</p>
                    <p className="text-white">{quote.contract_length}</p>
                  </div>
                )}
                
                {quote.total_value && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Värde</p>
                    <p className="text-white font-semibold">{formatCurrency(quote.total_value)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Agreement Text Preview */}
            {quote.agreement_text && (
              <div className="mb-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Avtalstext</p>
                <p className="text-slate-300 text-sm line-clamp-3">
                  {quote.agreement_text}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedQuoteId(quote.id)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Visa detaljer
              </Button>
              
              {quote.document_url && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(quote.document_url!, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Ladda ner PDF
                </Button>
              )}
              
              <div className="ml-auto text-xs text-slate-500">
                <Calendar className="w-3 h-3 inline mr-1" />
                Uppdaterad {formatDate(quote.updated_at)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quote Detail Modal */}
      {selectedQuoteId && (
        <QuoteDetailModal
          isOpen={true}
          onClose={() => setSelectedQuoteId(null)}
          quoteId={selectedQuoteId}
          customerId={customerId}
        />
      )}
    </div>
  )
}

export default QuoteListView