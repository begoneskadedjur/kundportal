// src/components/customer/QuoteListView.tsx - Quote management for customers
import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Eye, Download, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import QuoteDetailModal from './QuoteDetailModal'

// Matches the actual columns of quotes_secure_view
interface Quote {
  id: string
  customer_id: string
  case_number: string | null
  title: string | null
  price: number | null
  quote_status: string | null
  quote_generated_at: string | null
  quote_sent_at: string | null
  quote_signed_at: string | null
  quote_rejected_at: string | null
  oneflow_contract_id: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  scheduled_start: string | null
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
        .order('quote_generated_at', { ascending: false })

      if (error) throw error

      setQuotes(data || [])
    } catch (error: any) {
      console.error('Error fetching quotes:', error)
      setError(`Kunde inte hämta offerter: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />
      case 'pending':
        return <Clock className="w-5 h-5 text-amber-500" />
      case 'declined':
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'signed':
        return 'Signerad'
      case 'pending':
        return 'Väntar på svar'
      case 'declined':
      case 'rejected':
        return 'Avvisad'
      case 'overdue':
      case 'expired':
        return 'Utgången'
      default:
        return status || 'Okänd'
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
                {getStatusIcon(quote.quote_status)}
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Offert — {quote.title || 'Utan titel'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {getStatusText(quote.quote_status)} • {formatDate(quote.quote_generated_at)}
                    {quote.case_number && <span> • {quote.case_number}</span>}
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
                <p className="text-white">{quote.contact_person || '-'}</p>
                {quote.contact_email && (
                  <p className="text-sm text-slate-400">{quote.contact_email}</p>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Värde</p>
                <p className="text-white font-semibold">{formatCurrency(quote.price)}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Startdatum</p>
                <p className="text-white">{formatDate(quote.scheduled_start)}</p>
              </div>
            </div>

            {/* Address if available */}
            {quote.address && (
              <div className="mb-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Adress</p>
                <p className="text-slate-300 text-sm">{quote.address}</p>
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

              <div className="ml-auto text-xs text-slate-500">
                <Calendar className="w-3 h-3 inline mr-1" />
                Skapad {formatDate(quote.quote_generated_at)}
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
