// src/pages/customer/Portal.tsx - Premium Customer Portal
import React, { useEffect, useState } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
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
import PartnershipValueSection from '../../components/customer/PartnershipValueSection'
import CustomerPortalNavigation from '../../components/customer/CustomerPortalNavigation'
import CustomerStatistics from '../../components/customer/CustomerStatistics'
import SanitationReports from './SanitationReports'
import PendingQuoteNotification from '../../components/customer/PendingQuoteNotification'

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
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)
  const [currentView, setCurrentView] = useState<'dashboard' | 'statistics' | 'reports'>('dashboard')
  const [pendingQuotes, setPendingQuotes] = useState<any[]>([])
  const [dismissedNotification, setDismissedNotification] = useState(false)

  // Fetch customer data
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCustomerData()
      fetchPendingQuotes()
    } else if (profile) {
      setError('Ingen kundkoppling hittades')
      setLoading(false)
    }
  }, [profile])

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
        .select('quote_id, customer_id, case_number, title, quote_sent_at, oneflow_contract_id, source_type, created_at')
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
        oneflow_contract_id: quote.oneflow_contract_id
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

  // Error state
  if (error || !customer) {
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

  // Statistics view component
  const renderStatisticsView = () => (
    <CustomerStatistics customer={customer} />
  )

  // Reports view component
  const renderReportsView = () => (
    <SanitationReports />
  )

  // Dashboard view component  
  const renderDashboardView = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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

            {/* Service Activity Timeline */}
            <ServiceActivityTimeline 
              customerId={customer.id}
            />
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

      {/* Floating Action Button for Service Requests */}
      <button
        onClick={() => setShowServiceRequest(true)}
        className="fixed bottom-8 right-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-4 shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 group"
        title="Begär service"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Begär service
        </span>
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <CustomerPortalNavigation
        currentView={currentView}
        onViewChange={setCurrentView}
        customerName={customer.company_name}
      />

      {/* Content based on current view */}
      {currentView === 'dashboard' && renderDashboardView()}
      {currentView === 'statistics' && renderStatisticsView()}
      {currentView === 'reports' && renderReportsView()}
    </div>
  )
}

export default CustomerPortal