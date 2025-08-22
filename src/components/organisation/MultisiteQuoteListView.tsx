// src/components/organisation/MultisiteQuoteListView.tsx - Quote management for multisite organizations
import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Eye, Download, CheckCircle, Clock, AlertCircle, Crown, MapPin, Building2, Users, User, EyeOff, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import QuoteDetailModal from '../customer/QuoteDetailModal'
import toast from 'react-hot-toast'

interface MultisiteQuote {
  quote_id: string
  oneflow_contract_id: string | null
  contract_status: string
  company_name: string
  contact_person: string
  contact_email: string | null
  total_value: number | null
  quote_created_at: string
  selected_products: any[] | null
  agreement_text: string | null
  begone_employee_name: string | null
  begone_employee_email: string | null
  created_by_name: string | null
  created_by_email: string | null
  customer_id: string | null
  is_seen?: boolean
  seen_at?: string | null
  is_dismissed?: boolean
  dismissed_at?: string | null
}

interface MultisiteQuoteListViewProps {
  userRole: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

const MultisiteQuoteListView: React.FC<MultisiteQuoteListViewProps> = ({ userRole }) => {
  const { user } = useAuth()
  const { organization, userRole: multisiteUserRole } = useMultisite()
  const [quotes, setQuotes] = useState<MultisiteQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    if (organization && multisiteUserRole) {
      fetchQuotes()
    }
  }, [organization, multisiteUserRole])

  const fetchQuotes = async () => {
    if (!organization || !multisiteUserRole) {
      console.log('MultisiteQuoteListView: Saknar organisation eller användarroll')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const orgId = organization.organization_id || organization.id
      console.log('MultisiteQuoteListView: Hämtar offerter för organisation', orgId, 'med roll', userRole)

      // Bygg query för att hämta offerter från contracts-tabellen direkt
      let contractsQuery = supabase
        .from('contracts')
        .select(`
          id,
          oneflow_contract_id,
          status,
          type,
          company_name,
          contact_person,
          contact_email,
          total_value,
          created_at,
          selected_products,
          agreement_text,
          begone_employee_name,
          begone_employee_email,
          created_by_name,
          created_by_email,
          customer_id,
          customers!inner(
            organization_id,
            site_type,
            is_multisite,
            region,
            id
          )
        `)
        .eq('type', 'offer')
        .eq('customers.organization_id', orgId)
        .eq('customers.is_multisite', true)
        .eq('customers.is_active', true)

      // Tillämpa rollbaserad filtrering
      if (userRole === 'regionchef' && multisiteUserRole.site_ids && multisiteUserRole.site_ids.length > 0) {
        // Regionchefer ser endast offerter från sina tilldelade enheter
        contractsQuery = contractsQuery.in('customers.id', multisiteUserRole.site_ids)
      } else if (userRole === 'platsansvarig' && multisiteUserRole.site_ids && multisiteUserRole.site_ids.length > 0) {
        // Platsansvariga ser endast offerter för sin specifika enhet
        contractsQuery = contractsQuery.in('customers.id', multisiteUserRole.site_ids)
      }
      // Verksamhetschefer ser alla offerter för organisationen (ingen extra filtrering)

      const { data: contractsData, error: contractsError } = await contractsQuery
        .order('created_at', { ascending: false })

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError)
        throw contractsError
      }

      console.log(`MultisiteQuoteListView: Hittade ${contractsData?.length || 0} offerter för roll ${userRole}`)

      // Hämta quote_recipients data för notifikationsstatus
      const quoteIds = (contractsData || []).map(contract => contract.id)
      
      const { data: recipientsData, error: recipientsError } = quoteIds.length > 0 ? 
        await supabase
          .from('quote_recipients')
          .select('quote_id, seen_at, dismissed_at')
          .in('quote_id', quoteIds)
          .eq('user_email', user?.email) : { data: [], error: null }
      
      if (recipientsError) {
        console.warn('Could not fetch recipient data:', recipientsError)
      }
      
      // Skapa en map för snabbare lookup
      const recipientMap = new Map((recipientsData || []).map(r => [r.quote_id, r]))
      
      // Transformera till MultisiteQuote-format
      const transformedQuotes: MultisiteQuote[] = (contractsData || []).map(contract => {
        const recipient = recipientMap.get(contract.id)
        return {
          quote_id: contract.id,
          oneflow_contract_id: contract.oneflow_contract_id,
          contract_status: contract.status,
          company_name: contract.company_name,
          contact_person: contract.contact_person,
          contact_email: contract.contact_email,
          total_value: contract.total_value,
          quote_created_at: contract.created_at,
          selected_products: contract.selected_products,
          agreement_text: contract.agreement_text,
          begone_employee_name: contract.begone_employee_name,
          begone_employee_email: contract.begone_employee_email,
          created_by_name: contract.created_by_name,
          created_by_email: contract.created_by_email,
          customer_id: contract.customer_id,
          is_seen: !!recipient?.seen_at,
          seen_at: recipient?.seen_at,
          is_dismissed: !!recipient?.dismissed_at,
          dismissed_at: recipient?.dismissed_at
        }
      })

      setQuotes(transformedQuotes)
      console.log(`MultisiteQuoteListView: Satte ${transformedQuotes.length} offerter i state`)
    } catch (error: any) {
      console.error('Error fetching multisite quotes:', error)
      setError(`Kunde inte hämta offerter: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const openQuoteDetail = (quoteId: string, customerId: string | null) => {
    setSelectedQuoteId(quoteId)
    setSelectedCustomerId(customerId)
  }
  
  const markQuoteAsSeen = async (quoteId: string) => {
    if (!user?.email || !organization) return
    
    try {
      // Hitta eller skapa quote_recipient record
      const { data: existingRecipient, error: findError } = await supabase
        .from('quote_recipients')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('user_email', user.email)
        .single()
        
      let recipientId = existingRecipient?.id
      
      if (findError && findError.code === 'PGRST116') {
        // Record finns inte, skapa en med alla obligatoriska fält
        const { data: newRecipient, error: createError } = await supabase
          .from('quote_recipients')
          .insert({
            quote_id: quoteId,
            source_type: 'contract', // Obligatoriskt fält
            organization_id: organization.organization_id || organization.id, // Obligatoriskt fält
            recipient_role: userRole, // Obligatoriskt fält
            user_email: user.email,
            is_active: true,
            seen_at: new Date().toISOString()
          })
          .select('id')
          .single()
          
        if (createError) throw createError
        recipientId = newRecipient.id
      } else if (findError) {
        throw findError
      } else {
        // Uppdatera befintlig record
        const { error: updateError } = await supabase
          .from('quote_recipients')
          .update({ seen_at: new Date().toISOString() })
          .eq('id', recipientId)
          
        if (updateError) throw updateError
      }
      
      // Uppdatera lokal state
      setQuotes(prev => prev.map(quote => 
        quote.quote_id === quoteId 
          ? { ...quote, is_seen: true, seen_at: new Date().toISOString() }
          : quote
      ))
      
      toast.success('Offerten har markerats som läst')
    } catch (error: any) {
      console.error('Error marking quote as seen:', error)
      toast.error('Kunde inte markera som läst')
    }
  }
  
  const dismissQuote = async (quoteId: string) => {
    if (!user?.email || !organization) return
    
    try {
      // Hitta eller skapa quote_recipient record
      const { data: existingRecipient, error: findError } = await supabase
        .from('quote_recipients')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('user_email', user.email)
        .single()
        
      let recipientId = existingRecipient?.id
      
      if (findError && findError.code === 'PGRST116') {
        // Record finns inte, skapa en med alla obligatoriska fält
        const { data: newRecipient, error: createError } = await supabase
          .from('quote_recipients')
          .insert({
            quote_id: quoteId,
            source_type: 'contract', // Obligatoriskt fält
            organization_id: organization.organization_id || organization.id, // Obligatoriskt fält
            recipient_role: userRole, // Obligatoriskt fält
            user_email: user.email,
            is_active: true,
            dismissed_at: new Date().toISOString()
          })
          .select('id')
          .single()
          
        if (createError) throw createError
        recipientId = newRecipient.id
      } else if (findError) {
        throw findError
      } else {
        // Uppdatera befintlig record
        const { error: updateError } = await supabase
          .from('quote_recipients')
          .update({ dismissed_at: new Date().toISOString() })
          .eq('id', recipientId)
          
        if (updateError) throw updateError
      }
      
      // Uppdatera lokal state
      setQuotes(prev => prev.map(quote => 
        quote.quote_id === quoteId 
          ? { ...quote, is_dismissed: true, dismissed_at: new Date().toISOString() }
          : quote
      ))
      
      toast.success('Offerten har dolts')
    } catch (error: any) {
      console.error('Error dismissing quote:', error)
      toast.error('Kunde inte dölja offerten')
    }
  }

  const getStatusIcon = (status: string) => {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'signed':
        return 'Signerad'
      case 'pending':
        return 'Väntar på svar'
      case 'declined':
        return 'Avböjd'
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

  // Denna funktion har tagits bort eftersom Oneflow-länken ska tas bort

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
    <div className="space-y-8">
      {/* Header with iconic heading */}
      <div className="border-b border-slate-700 pb-6">
        <h3 className="text-2xl font-semibold text-white mb-3 flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-400" />
          Offerter & Kontrakt
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-slate-400">
            Hantera offerter för {organization?.organization_name} som {getRoleLabel(userRole)}
          </p>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={showDismissed}
                onChange={(e) => setShowDismissed(e.target.checked)}
                className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 transition-colors"
              />
              Visa dolda offerter
            </label>
            
            <div className="text-sm text-slate-400 font-medium">
              {filteredQuotes.length} {filteredQuotes.length === 1 ? 'offert' : 'offerter'}
            </div>
          </div>
        </div>
      </div>

      {/* Quote List in styled containers */}
      <div className="space-y-4">
        {filteredQuotes.map((quote) => (
          <div 
            key={quote.quote_id}
            className={`bg-slate-800/50 border border-slate-700 rounded-lg p-6 transition-all duration-200 hover:bg-slate-800/70 ${
              !quote.is_seen 
                ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/10' 
                : ''
            }`}
          >
            {/* Quote Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(quote.contract_status)}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-lg font-semibold text-white">
                      {quote.company_name}
                    </h4>
                    {!quote.is_seen && (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                        Ny
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span>{getStatusText(quote.contract_status)}</span>
                    <span>•</span>
                    <span>{formatDate(quote.quote_created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quote Details in sectioned layout */}
            <div className="border-t border-slate-700 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Kontaktperson</p>
                  <p className="text-white font-medium">{quote.contact_person}</p>
                  {quote.contact_email && (
                    <p className="text-slate-400 text-sm">{quote.contact_email}</p>
                  )}
                </div>
                
                {quote.total_value && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Kostnad</p>
                    <p className="text-white font-semibold text-lg">{formatCurrency(quote.total_value)}</p>
                  </div>
                )}
                
                {/* Skapare-information */}
                {(quote.created_by_name || quote.begone_employee_name) && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Skapare</p>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-white font-medium">
                          {quote.created_by_name || quote.begone_employee_name}
                        </p>
                        {(quote.created_by_email || quote.begone_employee_email) && (
                          <p className="text-slate-400 text-sm">
                            {quote.created_by_email || quote.begone_employee_email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Organisation</p>
                  <p className="text-white">{organization?.organization_name}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-700 mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  openQuoteDetail(quote.quote_id, quote.customer_id)
                  if (!quote.is_seen) {
                    markQuoteAsSeen(quote.quote_id)
                  }
                }}
                className="transition-colors duration-200"
              >
                <Eye className="w-4 h-4 mr-2" />
                Visa detaljer
              </Button>
              
              {!quote.is_seen && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => markQuoteAsSeen(quote.quote_id)}
                  className="transition-colors duration-200"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Markera som läst
                </Button>
              )}
              
              {!quote.is_dismissed && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => dismissQuote(quote.quote_id)}
                  className="text-slate-400 hover:text-slate-300 transition-colors duration-200"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Dölj
                </Button>
              )}
              
              <div className="ml-auto text-xs text-slate-400 flex items-center gap-2">
                {quote.is_seen && quote.seen_at && (
                  <>
                    <Calendar className="w-3 h-3" />
                    Läst {formatDate(quote.seen_at)}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quote Detail Modal */}
      {selectedQuoteId && (
        <QuoteDetailModal
          isOpen={true}
          onClose={() => {
            setSelectedQuoteId(null)
            setSelectedCustomerId(null)
          }}
          quoteId={selectedQuoteId}
          customerId={selectedCustomerId || selectedQuoteId}
        />
      )}
    </div>
  )
}

export default MultisiteQuoteListView