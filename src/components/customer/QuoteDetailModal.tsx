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
  begone_employee_name?: string | null
  begone_employee_email?: string | null
  created_by_name?: string | null
  created_by_email?: string | null
  address?: string | null
  case_number?: string | null
  quote_reference_number?: string | null
  contact_address?: string | null
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

      // Försök med contracts först för att få all rik data, fallback till quotes_secure_view
      let quoteData, quoteError
      
      // Försök med contracts först (innehåller rik produktdata och avtalsinformation)
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select(`
          *,
          customers!inner(id, organization_id)
        `)
        .eq('id', quoteId)
        .eq('customers.id', customerId)
        .maybeSingle()

      if (contractError || !contractData) {
        // Om contracts inte fungerar, försök med quotes_secure_view som fallback
        const { data: secureViewData, error: secureViewError } = await supabase
          .from('quotes_secure_view')
          .select('*')
          .eq('id', quoteId)
          .eq('customer_id', customerId)
          .maybeSingle()
        
        quoteData = secureViewData
        quoteError = secureViewError
      } else {
        quoteData = contractData
        quoteError = contractError
      }

      if (quoteError) throw quoteError
      
      if (!quoteData) {
        throw new Error('Offerten kunde inte hittas eller du har inte behörighet att se den')
      }

      // Transformera till Quote format - smart hantering av contracts vs quotes_secure_view
      const isFromContracts = quoteData.agreement_text !== undefined // contracts har detta fält
      
      const transformedQuote: Quote = {
        id: quoteData.id,
        oneflow_contract_id: quoteData.oneflow_contract_id,
        type: quoteData.type || (quoteData.oneflow_contract_id ? 'contract' : 'quote'),
        status: quoteData.status || quoteData.quote_status || 'pending',
        company_name: quoteData.company_name || quoteData.title || 'Ej specificerat',
        contact_person: quoteData.contact_person || 'Ej specificerat',
        contact_email: quoteData.contact_email || '',
        contact_phone: quoteData.contact_phone || null,
        billing_email: quoteData.billing_email || null,
        total_value: quoteData.total_value || quoteData.price,
        // Parsa selected_products JSON om det är en sträng från contracts
        selected_products: isFromContracts && typeof quoteData.selected_products === 'string' 
          ? JSON.parse(quoteData.selected_products || '[]')
          : (quoteData.selected_products || []),
        agreement_text: quoteData.agreement_text,
        start_date: quoteData.start_date || quoteData.scheduled_start,
        contract_length: quoteData.contract_length,
        validity_period: quoteData.validity_period,
        document_url: quoteData.document_url,
        signing_deadline: quoteData.signing_deadline,
        created_at: quoteData.created_at || quoteData.quote_generated_at || new Date().toISOString(),
        updated_at: quoteData.updated_at || quoteData.quote_signed_at || quoteData.quote_sent_at || quoteData.quote_generated_at || new Date().toISOString(),
        template_id: quoteData.template_id,
        begone_employee_name: quoteData.begone_employee_name,
        begone_employee_email: quoteData.begone_employee_email,
        created_by_name: quoteData.created_by_name,
        created_by_email: quoteData.created_by_email,
        address: quoteData.contact_address || quoteData.address,
        case_number: quoteData.case_number,
        quote_reference_number: quoteData.quote_reference_number,
        contact_address: quoteData.contact_address
      }

      setQuote(transformedQuote)
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
    
    // Hantera olika produktstrukturer
    const extractedProducts: Array<{name: string, description: string, quantity: number, totalPrice: number | null}> = []
    
    products.forEach(p => {
      // OneFlow-struktur med products array
      if (p.products && Array.isArray(p.products)) {
        p.products.forEach((product: any) => {
          const servicePrice = parseInt(product.price_1?.amount?.amount || '0')
          const materialPrice = parseInt(product.price_2?.amount?.amount || '0')
          
          // Ta det pris som faktiskt har ett värde, föredra servicePrice om båda finns
          let actualPrice = null
          if (servicePrice > 0) {
            actualPrice = servicePrice
          } else if (materialPrice > 0) {
            actualPrice = materialPrice
          }
          
          extractedProducts.push({
            name: product.name || 'Unnamed Product',
            description: product.description || '',
            quantity: product.quantity?.amount || 1,
            totalPrice: actualPrice
          })
        })
      }
      // Enkel struktur med direkta produktnamn (för multisite)
      else if (typeof p === 'string') {
        extractedProducts.push({
          name: p,
          description: '',
          quantity: 1,
          totalPrice: null
        })
      }
      // Om produkten har name direkt
      else if (p.name) {
        extractedProducts.push({
          name: p.name,
          description: p.description || '',
          quantity: p.quantity || 1,
          totalPrice: p.price || p.totalPrice || null
        })
      }
      // Om produkten är ett objekt med title istället för name
      else if (p.title) {
        extractedProducts.push({
          name: p.title,
          description: p.description || '',
          quantity: p.quantity || 1,
          totalPrice: p.price || p.totalPrice || null
        })
      }
    })
    
    return extractedProducts
  }

  const getProductSummary = (products: any[]) => {
    if (!products || products.length === 0) return 'Inga produkter specificerade'
    
    const extractedProducts = getProductDetails(products)
    if (extractedProducts.length === 0) return 'Inga produkter specificerade'
    
    const names = extractedProducts.map(p => p.name).filter(name => name && name !== 'Unnamed Product')
    if (names.length === 0) return 'Inga produkter specificerade'
    
    // Visa max 2 produktnamn + antal ytterligare
    if (names.length <= 2) {
      return names.join(', ')
    } else {
      return `${names.slice(0, 2).join(', ')} + ${names.length - 2} till`
    }
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
                <div className="space-y-1">
                  <p className="text-slate-400">
                    {getStatusText(quote.status)} • {formatDate(quote.created_at)}
                  </p>
                  <p className="text-sm text-slate-300 font-medium">
                    {quote.selected_products && quote.selected_products.length > 0 
                      ? getProductSummary(quote.selected_products)
                      : quote.address 
                        ? `📍 ${quote.address}`
                        : quote.case_number
                          ? `🔢 Ärende: ${quote.case_number}`
                          : 'Skadedjursbekämpning'
                    }
                  </p>
                </div>
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
                  <User className="w-5 h-5 text-blue-400" />
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
                  {(quote.begone_employee_name || quote.created_by_name) && (
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Säljare/Ansvarig</label>
                      <p className="text-white">{quote.begone_employee_name || quote.created_by_name}</p>
                      {(quote.begone_employee_email || quote.created_by_email) && (
                        <p className="text-sm text-slate-400">{quote.begone_employee_email || quote.created_by_email}</p>
                      )}
                    </div>
                  )}
                  {quote.total_value && (
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Totalt värde</label>
                      <p className="text-white font-semibold text-lg">{formatCurrency(quote.total_value)}</p>
                    </div>
                  )}
                  {quote.quote_reference_number && (
                    <div>
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Referensnummer</label>
                      <p className="text-white font-mono text-sm">{quote.quote_reference_number}</p>
                    </div>
                  )}
                  {quote.billing_email && quote.billing_email !== quote.contact_email && (
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-500 uppercase tracking-wide">Fakturamail</label>
                      <p className="text-sm text-slate-400">{quote.billing_email}</p>
                    </div>
                  )}
                </div>
              </Card>


              {/* Project Details - Visa endast om vi har detaljerade produkter ELLER om vi har adress/ärendenummer */}
              {(quote.selected_products && quote.selected_products.length > 0) ? (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-400" />
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
              ) : (quote.address || quote.case_number) && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-400" />
                    Projektdetaljer
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {quote.address && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Plats/Adress</label>
                        <p className="text-white">{quote.address}</p>
                      </div>
                    )}
                    {quote.case_number && (
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide">Ärendenummer</label>
                        <p className="text-white">{quote.case_number}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Agreement Text */}
              {quote.agreement_text && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Offertbeskrivning
                  </h3>
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {quote.agreement_text}
                    </p>
                  </div>
                </Card>
              )}

              {/* Timestamps */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
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

              {/* Status Information */}
              <Card className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600">
                <div className="flex items-start gap-4">
                  {getStatusIcon(quote.status)}
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-2">
                      Status: {getStatusText(quote.status)}
                    </h4>
                    
                    {quote.status === 'pending' && (
                      <div className="space-y-3 text-sm">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                          <p className="text-blue-200 font-medium mb-2">
                            📧 <strong>Viktigt - Kontrollera e-post</strong>
                          </p>
                          <p className="text-blue-100">
                            Offerten har skickats via OneFlow till <span className="text-white font-medium">{quote.contact_email}</span> för digital signering.
                          </p>
                          <p className="text-blue-200 mt-2">
                            <strong>Nästa steg:</strong> Gå till er e-postinkorg och leta efter meddelande från OneFlow för att granska och signera offerten.
                          </p>
                        </div>
                        {quote.signing_deadline && (
                          <p className="text-amber-400">
                            <strong>Signeringsfrist:</strong> {formatDate(quote.signing_deadline)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {quote.status === 'signed' && (
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-300">
                          <strong>Klart!</strong> Offerten har signerats och kontraktet är aktivt.
                        </p>
                        <p className="text-slate-400">
                          Nästa steg är implementation och uppstart av tjänsterna.
                        </p>
                      </div>
                    )}
                    
                    {quote.status === 'rejected' && (
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-300">
                          <strong>Avvisad:</strong> Kunden har avvisat offerten.
                        </p>
                        <p className="text-slate-400">
                          Kontakta säljaren för eventuell omförhandling eller förtydliganden.
                        </p>
                      </div>
                    )}
                    
                    {quote.status === 'expired' && (
                      <div className="space-y-2 text-sm">
                        <p className="text-slate-300">
                          <strong>Utgången:</strong> Offertens giltighetsperiod har passerat.
                        </p>
                        <p className="text-slate-400">
                          Kontakta säljaren för att förnya offerten vid intresse.
                        </p>
                      </div>
                    )}

                    {quote.oneflow_contract_id && (
                      <div className="mt-4 pt-4 border-t border-slate-600">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <ExternalLink className="w-4 h-4" />
                          <span>OneFlow-ID: {quote.oneflow_contract_id}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default QuoteDetailModal