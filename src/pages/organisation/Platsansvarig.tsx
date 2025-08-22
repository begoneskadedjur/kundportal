// src/pages/organisation/Platsansvarig.tsx - Dashboard för platsansvariga
import React, { useState, useEffect } from 'react'
import { Building2, Calendar, AlertTriangle, CheckCircle, Clock, Phone } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getCustomerDisplayName, isMultisiteCustomer } from '../../utils/multisiteHelpers'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import OrganisationLayout from '../../components/organisation/OrganisationLayout'
import OrganizationServiceRequest from '../../components/organisation/OrganizationServiceRequest'
import OrganisationActiveCasesList from '../../components/organisation/OrganisationActiveCasesList'
import OrganisationServiceActivityTimeline from '../../components/organisation/OrganisationServiceActivityTimeline'
import TrafficLightCaseList from '../../components/organisation/TrafficLightCaseList'
import MultisitePendingQuoteNotification from '../../components/organisation/MultisitePendingQuoteNotification'

const PlatsansvarigDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const [loading, setLoading] = useState(true)
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<any | null>(null)
  const [caseStats, setCaseStats] = useState({
    activeCases: 0,
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    upcomingVisits: 0
  })
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [showQuoteNotification, setShowQuoteNotification] = useState(false)
  
  // Platsansvarig har bara tillgång till en enhet
  const currentSite = accessibleSites[0]

  useEffect(() => {
    if (organization && currentSite) {
      fetchCustomerAndStats()
      fetchPendingQuotes()
    } else {
      setLoading(false)
    }
  }, [organization, userRole, currentSite])

  useEffect(() => {
    if (pendingQuotes.length > 0) {
      setShowQuoteNotification(true)
    }
  }, [pendingQuotes])

  const fetchCustomerAndStats = async () => {
    if (!organization || !currentSite) return
    
    try {
      setLoading(true)
      
      // Hämta customer för platsansvarig baserat på tillgängliga sites
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', currentSite.id)
        .eq('is_multisite', true)
        .single()
      
      if (customerError || !customerData) {
        console.error('Error fetching customer:', customerError)
        setLoading(false)
        return
      }
      
      // Verifiera att det är en multisite-kund
      if (!isMultisiteCustomer(customerData)) {
        console.error('Customer is not a multisite customer')
        setLoading(false)
        return
      }
      
      setCurrentCustomer(customerData)
      
      // Hämta statistik för cases
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      
      // Hämta alla cases för statistik
      const { data: allCases } = await supabase
        .from('cases')
        .select('id, status, updated_at, scheduled_start')
        .eq('customer_id', customerData.id)
      
      if (allCases) {
        const stats = {
          activeCases: allCases.filter(c => 
            ['Öppen', 'Bokad', 'Bokat', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5'].includes(c.status)
          ).length,
          completedToday: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= today
          ).length,
          completedThisWeek: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= weekStart
          ).length,
          completedThisMonth: allCases.filter(c => 
            ['Avslutat', 'Stängt - slasklogg'].includes(c.status) &&
            new Date(c.updated_at) >= monthStart
          ).length,
          upcomingVisits: allCases.filter(c => 
            (c.status === 'Bokad' || c.status === 'Bokat') &&
            c.scheduled_start &&
            new Date(c.scheduled_start) >= now
          ).length
        }
        setCaseStats(stats)
      }
    } catch (error) {
      console.error('Error fetching customer and stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingQuotes = async () => {
    if (!organization || !userRole || !currentSite) {
      return
    }

    try {
      const siteIds = [currentSite.id]
      
      // First get quote recipients without the problematic JOIN
      const orgId = organization.organization_id || organization.id
      const { data: quoteRecipients, error: recipientsError } = await supabase
        .from('quote_recipients')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)

      if (recipientsError) {
        console.error('Error fetching quote recipients:', recipientsError)
        return
      }

      if (!quoteRecipients || quoteRecipients.length === 0) {
        setPendingQuotes([])
        return
      }

      // Separate quote IDs by source type
      const caseQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'case')
        .map(qr => qr.quote_id)
      
      const contractQuoteIds = quoteRecipients
        .filter(qr => qr.source_type === 'contract')
        .map(qr => qr.quote_id)

      // Fetch cases data if we have case quotes
      let casesData: any[] = []
      if (caseQuoteIds.length > 0) {
        const { data: cases, error: casesError } = await supabase
          .from('cases')
          .select(`
            id, case_number, title, quote_sent_at, customer_id,
            customers:customers!cases_customer_id_fkey(company_name, site_name)
          `)
          .in('id', caseQuoteIds)

        if (casesError) {
          console.error('Error fetching cases:', casesError)
        } else {
          casesData = cases || []
        }
      }

      // Fetch contracts data if we have contract quotes
      let contractsData: any[] = []
      if (contractQuoteIds.length > 0) {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id, oneflow_contract_id, company_name, total_value, 
            selected_products, created_at, customer_id
          `)
          .in('id', contractQuoteIds)

        if (contractsError) {
          console.error('Error fetching contracts:', contractsError)
        } else {
          contractsData = contracts || []
        }
      }

      // Platsansvarig sees quotes for their sites
      const relevantQuotes = (quoteRecipients || []).filter(qr =>
        qr.recipient_role === 'platsansvarig' && qr.site_ids?.some((siteId: string) => 
          siteIds.includes(siteId)
        ) ||
        // Also show quotes sent to higher levels for information
        (qr.recipient_role === 'regionchef' || qr.recipient_role === 'verksamhetschef') &&
        qr.site_ids?.some((siteId: string) => siteIds.includes(siteId))
      )

      // Transform to match MultisiteQuote interface
      const transformedQuotes = relevantQuotes.map(qr => {
        // Find the corresponding case or contract data
        let quoteData: any = {}
        let source_type = qr.source_type
        
        if (source_type === 'case') {
          const caseData = casesData.find(c => c.id === qr.quote_id)
          if (caseData) {
            quoteData = {
              case_number: caseData.case_number,
              title: caseData.title,
              quote_sent_at: caseData.quote_sent_at,
              company_name: caseData.customers?.company_name,
              site_name: caseData.customers?.site_name,
              oneflow_contract_id: ''
            }
          }
        } else if (source_type === 'contract') {
          const contractData = contractsData.find(c => c.id === qr.quote_id)
          if (contractData) {
            // Generate a case number for contract quotes
            const caseNumber = `Offert #${contractData.id.slice(-6)}`
            const products = contractData.selected_products 
              ? (Array.isArray(contractData.selected_products) 
                  ? contractData.selected_products.map((p: any) => p.name || p.title).join(', ')
                  : String(contractData.selected_products)
                )
              : ''
            
            quoteData = {
              case_number: caseNumber,
              title: contractData.company_name || 'Skadedjursbekämpning',
              quote_sent_at: contractData.created_at,
              company_name: contractData.company_name,
              site_name: currentSite.site_name || '', // Use current site name for contracts
              oneflow_contract_id: contractData.oneflow_contract_id || '',
              products: products
            }
          }
        }

        return {
          id: qr.quote_id,
          case_number: quoteData.case_number || 'Okänt ärendenummer',
          title: quoteData.title || 'Okänd titel', 
          quote_sent_at: quoteData.quote_sent_at || qr.created_at,
          oneflow_contract_id: quoteData.oneflow_contract_id || '', 
          source_type: source_type,
          company_name: quoteData.company_name,
          site_name: quoteData.site_name,
          products: quoteData.products,
          recipient_role: qr.recipient_role,
          recipient_sites: qr.site_ids ? 
            [currentSite.site_name] : 
            [],
          region: qr.region
        }
      })

      setPendingQuotes(transformedQuotes)
    } catch (error) {
      console.error('Error fetching pending quotes:', error)
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar enhetsdata..." />
      </div>
    )
  }

  if (!currentCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="p-8 bg-slate-800/50 border-slate-700 max-w-md">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white text-center mb-2">Ingen enhet tilldelad</h2>
          <p className="text-slate-400 text-center">
            Kontakta verksamhetschefen för att få tillgång till en enhet.
          </p>
        </Card>
      </div>
    )
  }


  return (
    <OrganisationLayout userRoleType="platsansvarig">
      <div className="space-y-6">
        {/* Multisite Quote Notifications */}
        {showQuoteNotification && pendingQuotes.length > 0 && (
          <MultisitePendingQuoteNotification
            quotes={pendingQuotes}
            userRole="platsansvarig"
            organizationName={organization?.organization_name}
            onDismiss={() => setShowQuoteNotification(false)}
          />
        )}
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-2xl p-6 border border-green-700/50">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {currentCustomer.company_name}
              </h1>
              <p className="text-green-200">
                {organization?.organization_name} - Platsansvarig
              </p>
              <p className="text-slate-400 text-sm mt-2">
                {currentCustomer.address}, {currentCustomer.postal_code} {currentCustomer.city}
              </p>
            </div>
            <div className="text-right space-y-3">
              {currentCustomer.contact_person && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Kontaktperson</p>
                  <p className="text-white font-medium">{currentCustomer.contact_person}</p>
                  {currentCustomer.contact_phone && (
                    <p className="text-slate-300 text-sm mt-1 flex items-center justify-end gap-1">
                      <Phone className="w-3 h-3" />
                      {currentCustomer.contact_phone}
                    </p>
                  )}
                </div>
              )}
              
              <Button
                onClick={() => setShowServiceRequestModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Begär service
              </Button>
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Aktiva ärenden</p>
                <p className="text-2xl font-bold text-white">{caseStats.activeCases}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Avklarade idag</p>
                <p className="text-2xl font-bold text-white">{caseStats.completedToday}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Denna vecka</p>
                <p className="text-2xl font-bold text-white">{caseStats.completedThisWeek}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Kommande besök</p>
                <p className="text-2xl font-bold text-white">{caseStats.upcomingVisits}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Trafikljus ärendestatus */}
        <TrafficLightCaseList 
          customerId={currentCustomer.id} 
          onCaseUpdate={fetchCustomerAndStats}
        />

        {/* Använd de nya komponenterna för ärenden */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OrganisationActiveCasesList customerId={currentCustomer.id} />
          <OrganisationServiceActivityTimeline customerId={currentCustomer.id} />
        </div>
        
        {/* Service Request Modal */}
        {showServiceRequestModal && (
          <OrganizationServiceRequest
            isOpen={showServiceRequestModal}
            onClose={() => setShowServiceRequestModal(false)}
            selectedSiteId={currentCustomer?.id}
            onSuccess={() => {
              fetchCustomerAndStats() // Refresh data
            }}
          />
        )}
      </div>
    </OrganisationLayout>
  )
}

export default PlatsansvarigDashboard