// src/components/customer/QuoteDetailModal.tsx - Detailed quote modal with OneFlow integration
import React, { useState, useEffect } from 'react'
import { X, ExternalLink, Download, Calendar, User, Building2, Package, FileText, CheckCircle, Clock, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'

interface Quote {
  id: string
  oneflow_contract_id: string | null
  type: 'quote' | 'contract'
  status: string
  company_name: string
  contact_person: string
  contact_email: string
  contact_phone?: string
  billing_email?: string
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
  template_id: string | null
}

interface QuoteDetailModalProps {
  isOpen: boolean
  onClose: () => void
  quoteId: string
  customerId: string
}

const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  isOpen,
  onClose,
  quoteId,
  customerId
}) => {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingAsSeen, setMarkingAsSeen] = useState(false)

  useEffect(() => {
    if (isOpen && quoteId) {
      fetchQuoteDetails()
      markQuoteAsSeen()
    }
  }, [isOpen, quoteId])

  const fetchQuoteDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      // Först försök hämta från contracts-tabellen (för multisite)
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', quoteId)
        .eq('type', 'offer')
        .maybeSingle()

      if (contractData && !contractError) {
        // Transformera contracts data till Quote format
        const transformedQuote: Quote = {
          id: contractData.id,
          oneflow_contract_id: contractData.oneflow_contract_id,
          type: contractData.type as 'quote' | 'contract',
          status: contractData.status,
          company_name: contractData.company_name || '',
          contact_person: contractData.contact_person || '',
          contact_email: contractData.contact_email || '',
          contact_phone: contractData.contact_phone || null,
          billing_email: contractData.billing_email || null,
          total_value: contractData.total_value,
          selected_products: contractData.selected_products || [],
          agreement_text: contractData.agreement_text,
          start_date: contractData.start_date,
          contract_length: contractData.contract_length,
          validity_period: null, // Finns inte i contracts
          document_url: null, // Finns inte i contracts
          signing_deadline: null, // Finns inte i contracts
          created_at: contractData.created_at,
          updated_at: contractData.updated_at,
          template_id: contractData.template_id
        }
        setQuote(transformedQuote)
        return
      }

      // Om inte contracts, försök customer_quotes (för vanliga kunder)
      if (contractError && contractError.code !== 'PGRST116') {
        throw contractError
      }

      const { data: quoteData, error: quoteError } = await supabase
        .from('customer_quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle()

      if (quoteError) throw quoteError
      
      if (!quoteData) {
        throw new Error('Offerten kunde inte hittas')
      }

      setQuote(quoteData)
    } catch (error: any) {
      console.error('Error fetching quote details:', error)
      setError(`Kunde inte hämta offertdetaljer: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const markQuoteAsSeen = async () => {
    // Detta hanteras nu från parent component (MultisiteQuoteListView)
    // så vi behöver inte göra något här
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle className="w-6 h-6 text-emerald-500" />
      case 'pending':
        return <Clock className="w-6 h-6 text-amber-500" />
      case 'rejected':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      default:
        return <FileText className="w-6 h-6 text-slate-400" />
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
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Ej specificerat'
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount)
  }

  const getProductDetails = (products: any[]) => {
    if (!products || products.length === 0) return []
    
    return products.flatMap(p => 
      (p.products || []).map((product: any) => {
        const servicePrice = parseInt(product.price_1?.amount?.amount || '0')
        const materialPrice = parseInt(product.price_2?.amount?.amount || '0')
        const totalPrice = servicePrice + materialPrice
        
        return {
          name: product.name || 'Unnamed Product',
          description: product.description || '',
          quantity: product.quantity?.amount || 0,
          totalPrice: totalPrice > 0 ? totalPrice : null
        }
      })
    )
  }


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {quote && getStatusIcon(quote.status)}
            <div>
              <h2 className="text-xl font-bold text-white">
                {quote ? `${quote.type === 'contract' ? 'Kontrakt' : 'Offert'} - ${quote.company_name}` : 'Laddar offert...'}
              </h2>
              {quote && (
                <p className="text-slate-400">
                  {getStatusText(quote.status)} • {formatDate(quote.created_at)}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {markingAsSeen && (
              <div className="flex items-center gap-2 text-slate-400">
                <Eye className="w-4 h-4" />
                <span className="text-sm">Markerar som läst...</span>
              </div>
            )}
            
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <Card className="p-6">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ett fel uppstod</h3>
                <p className="text-slate-400 mb-4">{error}</p>
                <Button onClick={fetchQuoteDetails} className="bg-emerald-500 hover:bg-emerald-600">
                  Försök igen
                </Button>
              </div>
            </Card>
          ) : quote ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Grundläggande information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Företag</label>
                    <p className="text-white font-medium">{quote.company_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Kontaktperson</label>
                    <p className="text-white">{quote.contact_person}</p>
                    <p className="text-sm text-slate-400">{quote.contact_email}</p>
                    {quote.contact_phone && (
                      <p className="text-sm text-slate-400">{quote.contact_phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Typ</label>
                    <p className="text-white">{quote.type === 'contract' ? 'Kontrakt' : 'Offert'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Status</label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(quote.status)}
                      <span className="text-white">{getStatusText(quote.status)}</span>
                    </div>
                  </div>
                  {quote.billing_email && quote.billing_email !== quote.contact_email && (
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Fakturamail</label>
                      <p className="text-sm text-slate-400">{quote.billing_email}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Contract Details */}
              {quote.type === 'contract' && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Kontraktdetaljer
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Startdatum</label>
                      <p className="text-white">{formatDate(quote.start_date)}</p>
                    </div>
                    {quote.contract_length && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Kontraktslängd</label>
                        <p className="text-white">{quote.contract_length}</p>
                      </div>
                    )}
                    {quote.total_value && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Kostnad</label>
                        <p className="text-white font-semibold text-lg">{formatCurrency(quote.total_value)}</p>
                      </div>
                    )}
                  </div>
                  
                  {quote.validity_period && (
                    <div className="mt-4">
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Giltighetsperiod</label>
                      <p className="text-white">{quote.validity_period}</p>
                    </div>
                  )}
                  
                  {quote.signing_deadline && (
                    <div className="mt-4">
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Signeringsfrist</label>
                      <p className="text-white">{formatDate(quote.signing_deadline)}</p>
                    </div>
                  )}
                </Card>
              )}

              {/* Products */}
              {quote.selected_products && quote.selected_products.length > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Produkter & Tjänster
                  </h3>
                  <div className="space-y-4">
                    {getProductDetails(quote.selected_products).map((product, index) => (
                      <div key={index} className="border border-slate-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium">{product.name}</h4>
                            {product.description && (
                              <p className="text-slate-400 text-sm mt-1">{product.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-slate-400 text-sm">Antal: {product.quantity}</span>
                              {product.totalPrice && (
                                <span className="text-slate-400 text-sm">
                                  Pris: {formatCurrency(product.totalPrice)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Agreement Text */}
              {quote.agreement_text && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Offertbeskrivning
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {quote.agreement_text}
                    </p>
                  </div>
                </Card>
              )}

              {/* Timestamps */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Tidsstämplar
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Skapad</label>
                    <p className="text-white">{formatDate(quote.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wide">Senast uppdaterad</label>
                    <p className="text-white">{formatDate(quote.updated_at)}</p>
                  </div>
                </div>
              </Card>

              {/* Information instead of actions */}
              <div className="flex items-center justify-center pt-4 border-t border-slate-700">
                <div className="text-center text-slate-400">
                  <Package className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">
                    Offerten har skickats via e-post till kontaktpersonen.
                  </p>
                  <p className="text-xs mt-1">
                    Kontrollera e-postinkorgen för att se offertdokumentet.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default QuoteDetailModal