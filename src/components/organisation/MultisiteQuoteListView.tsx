// src/components/organisation/MultisiteQuoteListView.tsx - Quote management for multisite organizations
import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Eye, Download, CheckCircle, Clock, AlertCircle, ExternalLink, Crown, MapPin, Building2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMultisite } from '../../contexts/MultisiteContext'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import QuoteDetailModal from '../customer/QuoteDetailModal'

interface MultisiteQuote {
  quote_id: string
  recipient_role: string
  organization_id: string
  site_ids: string[]
  user_id: string
  oneflow_contract_id: string | null
  contract_status: string
  company_name: string
  contact_person: string
  total_value: number | null
  quote_created_at: string
  is_seen: boolean
  is_dismissed: boolean
  seen_at: string | null
  dismissed_at: string | null
  notification_type: 'direct' | 'cascade'
  cascade_reason: string | null
}

interface MultisiteQuoteListViewProps {
  userRole: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const MultisiteQuoteListView: React.FC<MultisiteQuoteListViewProps> = ({ userRole }) => {
  const { organization } = useMultisite()
  const [quotes, setQuotes] = useState<MultisiteQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)

  useEffect(() => {
    if (organization) {
      fetchQuotes()
    }
  }, [organization])

  const fetchQuotes = async () => {
    if (!organization) {
      console.log('MultisiteQuoteListView: Ingen organisation tillgänglig')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('MultisiteQuoteListView: Hämtar offerter för organisation', organization.organization_id)

      // Använd samma logik som fungerar i Regionchef.tsx
      const orgId = organization.organization_id || organization.id
      
      const { data: quoteRecipients, error: recipientsError } = await supabase
        .from('quote_recipients')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)

      if (recipientsError) {
        console.error('Error fetching quote recipients:', recipientsError)
        throw recipientsError
      }

      console.log(`MultisiteQuoteListView: Hittade ${quoteRecipients?.length || 0} quote recipients`)

      if (!quoteRecipients || quoteRecipients.length === 0) {
        setQuotes([])
        return
      }

      // Separate quote IDs by source type
      const caseQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'case')
        .map(qr => qr.quote_id)
      
      const contractQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'contract')
        .map(qr => qr.quote_id)

      console.log(`MultisiteQuoteListView: Case quotes: ${caseQuoteIds.length}, Contract quotes: ${contractQuoteIds.length}`)

      // Fetch contracts data if we have contract quotes
      let contractsData: any[] = []
      if (contractQuoteIds.length > 0) {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select('*')
          .in('id', contractQuoteIds)

        if (contractsError) {
          console.error('Error fetching contracts:', contractsError)
        } else {
          contractsData = contracts || []
          console.log(`MultisiteQuoteListView: Hittade ${contractsData.length} contracts`)
        }
      }

      // Transform contracts to the quote format expected by the component
      const transformedQuotes = contractsData.map(contract => ({
        quote_id: contract.id,
        recipient_role: 'regionchef', // TODO: Get from quote_recipients
        organization_id: orgId,
        site_ids: [],
        user_id: '', // TODO: Map properly 
        oneflow_contract_id: contract.oneflow_contract_id,
        contract_status: contract.status,
        company_name: contract.company_name,
        contact_person: contract.contact_person,
        total_value: contract.total_value,
        quote_created_at: contract.created_at,
        is_seen: false, // TODO: Get from notification status
        is_dismissed: false,
        seen_at: null,
        dismissed_at: null,
        notification_type: 'direct' as const,
        cascade_reason: null
      }))

      setQuotes(transformedQuotes)
      console.log(`MultisiteQuoteListView: Satte ${transformedQuotes.length} quotes i state`)
    } catch (error: any) {
      console.error('Error fetching multisite quotes:', error)
      setError(`Kunde inte hämta offerter: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const markQuoteAsSeen = async (quoteId: string) => {
    try {
      // Find the quote recipient record for this quote
      const { data: recipients, error: recipientError } = await supabase
        .from('quote_recipients')
        .select('id')
        .eq('quote_id', quoteId)
        .limit(1)

      if (recipientError) throw recipientError
      
      if (recipients && recipients.length > 0) {
        // Call the database function to mark as seen
        await supabase
          .rpc('update_quote_notification_status', {
            p_quote_recipient_id: recipients[0].id,
            p_mark_as_seen: true
          })

        // Update local state
        setQuotes(prev => prev.map(q => 
          q.quote_id === quoteId ? { ...q, is_seen: true, seen_at: new Date().toISOString() } : q
        ))
      }
    } catch (error: any) {
      console.error('Error marking quote as seen:', error)
    }
  }

  const dismissQuote = async (quoteId: string) => {
    try {
      // Find the quote recipient record for this quote
      const { data: recipients, error: recipientError } = await supabase
        .from('quote_recipients')
        .select('id')
        .eq('quote_id', quoteId)
        .limit(1)

      if (recipientError) throw recipientError
      
      if (recipients && recipients.length > 0) {
        // Call the database function to mark as dismissed
        await supabase
          .rpc('update_quote_notification_status', {
            p_quote_recipient_id: recipients[0].id,
            p_mark_as_dismissed: true
          })

        // Update local state
        setQuotes(prev => prev.map(q => 
          q.quote_id === quoteId ? { ...q, is_dismissed: true, dismissed_at: new Date().toISOString() } : q
        ))
      }
    } catch (error: any) {
      console.error('Error dismissing quote:', error)
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'verksamhetschef':
        return <Crown className="w-4 h-4 text-amber-500" />
      case 'regionchef':
        return <MapPin className="w-4 h-4 text-purple-500" />
      case 'platsansvarig':
        return <Building2 className="w-4 h-4 text-blue-500" />
      default:
        return <Users className="w-4 h-4 text-slate-400" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'verksamhetschef':
        return 'Verksamhetschef'
      case 'regionchef':
        return 'Regionchef'
      case 'platsansvarig':
        return 'Platsansvarig'
      default:
        return role
    }
  }

  const getCascadeReasonText = (reason: string | null) => {
    switch (reason) {
      case 'verksamhetschef_to_regionchef':
        return 'Informerad från Verksamhetschef'
      case 'verksamhetschef_to_platsansvarig':
        return 'Informerad från Verksamhetschef'
      case 'regionchef_to_platsansvarig':
        return 'Informerad från Regionchef'
      default:
        return 'Direkt mottagare'
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

  // Filter quotes based on user preference
  const [showDismissed, setShowDismissed] = useState(false)
  const filteredQuotes = showDismissed ? quotes : quotes.filter(q => !q.is_dismissed)

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
            Det finns inga offerter för er organisation än. De kommer att visas här när de skapas.
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
          <p className="text-slate-400">
            Hantera offerter för {organization?.organization_name} som {getRoleLabel(userRole)}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-emerald-500"
            />
            Visa dolda offerter
          </label>
          
          <div className="text-sm text-slate-400">
            {filteredQuotes.length} {filteredQuotes.length === 1 ? 'offert' : 'offerter'}
          </div>
        </div>
      </div>

      {/* Quote Cards */}
      <div className="grid gap-6">
        {filteredQuotes.map((quote) => (
          <Card 
            key={`${quote.quote_id}-${quote.notification_type}`} 
            className={`p-6 transition-colors ${
              quote.is_seen 
                ? 'hover:bg-slate-800/60' 
                : 'bg-slate-800/80 hover:bg-slate-800 border-emerald-500/30'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(quote.contract_status)}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">
                      Offert - {quote.company_name}
                    </h3>
                    {!quote.is_seen && (
                      <span className="px-2 py-1 bg-emerald-500 text-white text-xs rounded-full">
                        Ny
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span>{getStatusText(quote.contract_status)}</span>
                    <span>•</span>
                    <span>{formatDate(quote.quote_created_at)}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      {getRoleIcon(quote.recipient_role)}
                      <span>{getCascadeReasonText(quote.cascade_reason)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {quote.notification_type === 'cascade' && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                    Kaskad
                  </span>
                )}
                
                {quote.oneflow_contract_id && (
                  <Button
                    onClick={() => openInOneflow(quote.oneflow_contract_id!)}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    OneFlow
                  </Button>
                )}
              </div>
            </div>

            {/* Quote Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Kontaktperson</p>
                <p className="text-white">{quote.contact_person}</p>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Organisation</p>
                <p className="text-white">{organization?.organization_name}</p>
              </div>
              
              {quote.total_value && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Värde</p>
                  <p className="text-white font-semibold">{formatCurrency(quote.total_value)}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedQuoteId(quote.quote_id)
                  if (!quote.is_seen) {
                    markQuoteAsSeen(quote.quote_id)
                  }
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Visa detaljer
              </Button>
              
              {!quote.is_seen && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => markQuoteAsSeen(quote.quote_id)}
                >
                  Markera som läst
                </Button>
              )}
              
              {!quote.is_dismissed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => dismissQuote(quote.quote_id)}
                  className="text-slate-400 hover:text-slate-300"
                >
                  Dölj
                </Button>
              )}
              
              <div className="ml-auto text-xs text-slate-500">
                {quote.is_seen && quote.seen_at && (
                  <>
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Läst {formatDate(quote.seen_at)}
                  </>
                )}
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
          customerId={selectedQuoteId} // For multisite, we'll use the quote ID as identifier
        />
      )}
    </div>
  )
}

export default MultisiteQuoteListView