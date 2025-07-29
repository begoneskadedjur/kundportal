// src/pages/customer/Portal.tsx - UPDATED with proper props and error handling
import React, { useEffect, useState } from 'react'
import { LogOut, RefreshCw, Settings, Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import { PageHeader } from '../../components/shared'

// Import customer portal components
import CustomerStatsCards from '../../components/customer/CustomerStatsCards'
import ActiveCasesList from '../../components/customer/ActiveCasesList'
import UpcomingVisits from '../../components/customer/UpcomingVisits'
import CompanyInformation from '../../components/customer/CompanyInformation'
import QuickActions from '../../components/customer/QuickActions'
import RecentActivity from '../../components/customer/RecentActivity'

// Import modals
import CreateCaseModal from '../../components/customer/CreateCaseModal'
import CustomerSettingsModal from '../../components/customer/CustomerSettingsModal'

// Types
type Customer = {
  id: string
  company_name: string
  org_number: string | null
  contact_person: string
  email: string
  phone: string
  address: string
  clickup_list_id: string
  clickup_list_name: string
  contract_types: {
    name: string
  }
  business_type?: string
  contract_start_date?: string
  contract_end_date?: string
  annual_premium?: number
  assigned_account_manager?: string
}

const CustomerPortal: React.FC = () => {
  const { profile, signOut } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Fetch customer data
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCustomerData()
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
        .select(`
          *,
          contract_types (
            name
          )
        `)
        .eq('id', profile!.customer_id)
        .single()

      if (error) throw error
      
      // Clean the data to prevent serialization issues
      const cleanedData = {
        ...data,
        contract_types: data.contract_types ? { name: data.contract_types.name } : { name: 'Okänd' }
      }
      
      setCustomer(cleanedData)
    } catch (error: any) {
      console.error('Error fetching customer:', error)
      setError(`Kunde inte hämta kunddata: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCustomerData()
    setRefreshing(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar kundportal...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !customer) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Ett fel uppstod</h2>
          <p className="text-slate-400 mb-4">{error || 'Kunde inte hämta kunddata'}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="BeGone Kundportal"
          showBackButton={false}
        />
        <div className="space-y-8">
          
          {/* Welcome Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white mb-2">
                Välkommen, {customer.contact_person}!
              </h2>
              <p className="text-slate-400">
                Här kan du följa alla era ärenden och hantera ert konto hos BeGone Skadedjur.
              </p>
            </div>
          </section>

          {/* 1. Stats Cards */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4">Översikt</h3>
            <CustomerStatsCards 
              customerId={customer.id}
              clickupListId={customer.clickup_list_id}
            />
          </section>

          {/* Grid för Quick Actions + Company Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 2. Quick Actions */}
            <section className="lg:col-span-2">
              <QuickActions 
                onCreateCase={() => setShowCreateModal(true)}
                customer={customer}
              />
            </section>

            {/* 3. Company Information */}
            <section>
              <CompanyInformation 
                customer={customer}
                onEdit={() => setShowSettingsModal(true)}
              />
            </section>
          </div>

          {/* Grid för Cases + Visits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 4. Active Cases */}
            <section>
              <ActiveCasesList 
                customer={customer}
                refreshTrigger={refreshing}
              />
            </section>

            {/* 5. Upcoming Visits */}
            <section>
              <UpcomingVisits 
                customer={customer}
                refreshTrigger={refreshing}
              />
            </section>
          </div>

          {/* 6. Recent Activity */}
          <section>
            <RecentActivity 
              customerId={customer.id}
              clickupListId={customer.clickup_list_id}
              refreshTrigger={refreshing}
            />
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center gap-4">
              <span>Avtalstyp: {customer.contract_types?.name || 'Okänd'}</span>
              <div className="h-1 w-1 bg-slate-600 rounded-full"></div>
              <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Ansluten till BeGone</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showCreateModal && (
        <CreateCaseModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleRefresh}
          customerId={customer.id}
          customerInfo={{
            company_name: customer.company_name,
            contact_person: customer.contact_person,
            email: customer.email
          }}
        />
      )}

      {showSettingsModal && (
        <CustomerSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          customer={{
            id: customer.id,
            company_name: customer.company_name,
            org_number: customer.org_number || '',
            contact_person: customer.contact_person,
            email: customer.email,
            phone: customer.phone
          }}
          onUpdate={(updatedCustomer) => {
            setCustomer(prev => prev ? { ...prev, ...updatedCustomer } : null)
            handleRefresh()
          }}
        />
      )}
      </div>
    </div>
  )
}

export default CustomerPortal