// src/pages/customer/Portal.tsx - Premium Customer Portal
import React, { useEffect, useState } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'

// Import premium components
import PremiumWelcomeHero from '../../components/customer/PremiumWelcomeHero'
import ServiceExcellenceDashboard from '../../components/customer/ServiceExcellenceDashboard'
import RelationshipShowcase from '../../components/customer/RelationshipShowcase'
import ContractValueCard from '../../components/customer/ContractValueCard'
import PremiumServiceRequest from '../../components/customer/PremiumServiceRequest'
import ServiceActivityTimeline from '../../components/customer/ServiceActivityTimeline'
import ServiceAssessmentSummary from '../../components/customer/ServiceAssessmentSummary'
import PartnershipValueSection from '../../components/customer/PartnershipValueSection'
import CustomerPortalLayout, { CustomerPortalView } from '../../components/customer/CustomerPortalLayout'
import CompletedCasesView from '../../components/customer/CompletedCasesView'
import SanitationReports from './SanitationReports'
import PendingQuoteNotification from '../../components/customer/PendingQuoteNotification'
import QuoteListView from '../../components/customer/QuoteListView'
import CustomerEquipmentView from '../../components/customer/CustomerEquipmentView'
import InspectionSessionsView from '../../components/customer/InspectionSessionsView'

// Customer type matching new database structure
type Customer = {
  id: string
  company_name: string
  organization_number: string | null
  contact_person: string
  contact_email: string
  contact_phone: string | null
  contact_address: string | null
  oneflow_contract_id: string | null
  contract_type: string | null
  contract_status: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  annual_value: number | null
  agreement_text: string | null
  products: any | null
  product_summary: string | null
  service_details: string | null
  assigned_account_manager: string | null
  account_manager_email: string | null
  sales_person: string | null
  sales_person_email: string | null
  billing_email: string | null
  billing_address: string | null
  created_at: string
}

const CustomerPortal: React.FC = () => {
  const { profile, signOut } = useAuth()
  const { userRole, organization, loading: multisiteLoading } = useMultisite()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)
  const [currentView, setCurrentView] = useState<CustomerPortalView>('dashboard')
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [dismissedNotification, setDismissedNotification] = useState(false)

  // Navigering från Genomförda kontroller till Fällor & stationer med pulsering
  const [highlightedStationId, setHighlightedStationId] = useState<string | null>(null)
  const [highlightedStationType, setHighlightedStationType] = useState<'outdoor' | 'indoor' | null>(null)
  const [highlightedFloorPlanId, setHighlightedFloorPlanId] = useState<string | null>(null)

  // Check multisite access and redirect if needed - KRITISK: Måste köras först
  useEffect(() => {
    // Vänta tills multisite-context har laddats
    if (!multisiteLoading && profile) {
      // Förbättrad multisite-detection: kolla både userRole OCH organization_id
      const isMultisiteUser = (userRole && organization) || profile.organization_id
      const hasTraditionalCustomerAccess = profile.customer_id
      
      // Om användaren ENDAST har multisite-åtkomst och ingen traditionell kundåtkomst
      if (isMultisiteUser && !hasTraditionalCustomerAccess) {
        console.log('Multisite user detected, redirecting to organisation portal:', {
          userRole: userRole?.role_type,
          organizationId: profile.organization_id,
          hasCustomerId: !!profile.customer_id
        })
        navigate('/organisation', { replace: true })
        return
      }
      
      // Om användaren har både multisite och vanlig kundtillgång, stanna här
      // men visa tydlig navigation till multisite
    }
  }, [multisiteLoading, userRole, organization, profile, navigate])

  // Early return för multisite-användare som inte ska vara här
  if (!multisiteLoading && profile) {
    const isMultisiteUser = (userRole && organization) || profile.organization_id
    const hasTraditionalCustomerAccess = profile.customer_id
    
    if (isMultisiteUser && !hasTraditionalCustomerAccess) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-white mt-4">Omdirigerar till organisationsportal...</p>
          </div>
        </div>
      )
    }
  }

  // Fetch customer data
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCustomerData()
      fetchPendingQuotes()
    } else if (profile && !multisiteLoading && !userRole && !profile.organization_id) {
      // Endast visa fel om användaren inte har multisite heller OCH inte har organization_id
      setError('Ingen kundkoppling hittades')
      setLoading(false)
    } else if (profile && !multisiteLoading && !profile.customer_id && profile.organization_id) {
      // Användare har organization_id men inte customer_id - denna är multisite-kund utan traditionell kundtillgång
      setLoading(false)
    }
  }, [profile, multisiteLoading, userRole])

  const fetchCustomerData = async () => {
    try {
      setError(null)
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', profile!.customer_id)
        .single()

      if (error) throw error
      
      setCustomer(data)
    } catch (error: any) {
      console.error('Error fetching customer:', error)
      setError(`Kunde inte hämta kunddata: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingQuotes = async () => {
    try {
      // Hämta alla väntande offerter från den nya unified vyn
      // Detta inkluderar både legacy cases och nya contracts
      const { data, error } = await supabase
        .from('customer_pending_quotes')
        .select('quote_id, customer_id, case_number, title, quote_sent_at, oneflow_contract_id, source_type, created_at, company_name, products')
        .eq('customer_id', profile!.customer_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending quotes:', error)
        return
      }

      // Mappa data till rätt format för PendingQuoteNotification komponenten
      const mappedQuotes = (data || []).map(quote => ({
        id: quote.quote_id,
        case_number: quote.case_number,
        title: quote.title,
        quote_sent_at: quote.quote_sent_at,
        oneflow_contract_id: quote.oneflow_contract_id,
        source_type: quote.source_type,
        company_name: quote.company_name,
        products: quote.products
      }))

      setPendingQuotes(mappedQuotes)
    } catch (error) {
      console.error('Error in fetchPendingQuotes:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCustomerData()
    await fetchPendingQuotes()
    setRefreshing(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar er premium portal...</p>
        </div>
      </div>
    )
  }

  // Error state - endast visa för användare som verkligen har fel, inte multisite-användare
  if (error && !profile?.organization_id && !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Ett fel uppstod</h2>
          <p className="text-slate-400 mb-4">{error || 'Kunde inte hämta kunddata'}</p>
          <Button onClick={() => window.location.reload()} className="bg-emerald-500 hover:bg-emerald-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  // För multisite-användare utan customer_id - visa meddelande om att de ska använda organisationsportalen
  if (!customer && profile?.organization_id && userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
          <div className="text-emerald-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h6m-6 4h6m-6 4h6m-6 4h6" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Organisationsportal</h2>
          <p className="text-slate-400 mb-4">Du är inloggad som {userRole} för din organisation. Använd organisationsportalen för att hantera dina ärenden.</p>
          <Button onClick={() => navigate('/organisation')} className="bg-emerald-500 hover:bg-emerald-600">
            Gå till Organisationsportal
          </Button>
        </Card>
      </div>
    )
  }

  // Om ingen customer data och inte multisite - visa loading
  if (!customer && !profile?.organization_id && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar kunddata...</p>
        </div>
      </div>
    )
  }

  // Navigera till station på karta/planritning från Genomförda kontroller
  const handleNavigateToStation = (stationId: string, type: 'outdoor' | 'indoor', floorPlanId?: string) => {
    // Sätt highlighted state innan vi byter vy
    setHighlightedStationId(stationId)
    setHighlightedStationType(type)
    setHighlightedFloorPlanId(floorPlanId || null)
    // Byt till stations-vyn
    setCurrentView('stations')
    // Rensa highlighted efter 5 sekunder
    setTimeout(() => {
      setHighlightedStationId(null)
      setHighlightedStationType(null)
      setHighlightedFloorPlanId(null)
    }, 5000)
  }

  // Stations view component (Fällor & stationer)
  const renderStationsView = () => (
    customer ? (
      <CustomerEquipmentView
        customerId={customer.id}
        companyName={customer.company_name}
        highlightedStationId={highlightedStationId}
        highlightedStationType={highlightedStationType}
        highlightedFloorPlanId={highlightedFloorPlanId}
      />
    ) : null
  )

  // Inspections view component (Genomförda kontroller)
  const renderInspectionsView = () => (
    customer ? (
      <InspectionSessionsView
        customerId={customer.id}
        companyName={customer.company_name}
        onNavigateToStation={handleNavigateToStation}
      />
    ) : null
  )

  // Cases view component (Genomförda ärenden)
  const renderCasesView = () => (
    customer ? (
      <CompletedCasesView
        customerId={customer.id}
        companyName={customer.company_name}
      />
    ) : null
  )

  // Reports view component
  const renderReportsView = () => (
    <SanitationReports />
  )

  // Quotes view component
  const renderQuotesView = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {customer ? (
          <QuoteListView customerId={customer.id} />
        ) : (
          <div className="text-center text-slate-400">
            <p>Ingen kunddata tillgänglig för att visa offerter.</p>
          </div>
        )}
      </div>
    </div>
  )

  // Dashboard view component
  const renderDashboardView = () => (
    <div>
      {/* Premium Welcome Hero */}
      <PremiumWelcomeHero 
        customer={customer}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Pending Quote Notification - Only show if there are pending quotes and not dismissed */}
      {pendingQuotes.length > 0 && !dismissedNotification && (
        <PendingQuoteNotification 
          quotes={pendingQuotes}
          onDismiss={() => setDismissedNotification(true)}
        />
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Service Excellence Dashboard */}
        <div className="mt-8">
          <ServiceExcellenceDashboard 
            customer={customer}
          />
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Left Column - Service Hub (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contract Value Card */}
            <ContractValueCard 
              customer={customer}
            />

            {/* Service Assessment Summary */}
            {customer && (
              <ServiceAssessmentSummary 
                customerId={customer.id}
              />
            )}

            {/* Service Activity Timeline */}
            {customer && (
              <ServiceActivityTimeline 
                customerId={customer.id}
              />
            )}
          </div>

          {/* Right Column - Relationships (1/3 width) */}
          <div className="space-y-6">
            {/* Relationship Showcase */}
            <RelationshipShowcase 
              customer={customer}
            />
          </div>
        </div>

        {/* Partnership Value Section */}
        <div className="mt-12">
          <PartnershipValueSection />
        </div>
      </div>

      {/* Premium Service Request Modal */}
      {showServiceRequest && (
        <PremiumServiceRequest
          isOpen={showServiceRequest}
          onClose={() => setShowServiceRequest(false)}
          customer={customer}
          onSuccess={() => {
            // Trigger refresh of timeline when new case is created
            window.location.reload()
          }}
        />
      )}

      {/* Floating Action Button for Service Requests - positioned above mobile bottom nav */}
      <button
        onClick={() => setShowServiceRequest(true)}
        className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-4 shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 group z-30"
        title="Begär service"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block">
          Begär service
        </span>
      </button>
    </div>
  )

  return (
    <CustomerPortalLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      customerName={customer?.company_name || 'Okänd kund'}
    >
      {/* Content based on current view */}
      {currentView === 'dashboard' && renderDashboardView()}
      {currentView === 'stations' && renderStationsView()}
      {currentView === 'inspections' && renderInspectionsView()}
      {currentView === 'cases' && renderCasesView()}
      {currentView === 'reports' && renderReportsView()}
      {currentView === 'quotes' && renderQuotesView()}
    </CustomerPortalLayout>
  )
}

export default CustomerPortal