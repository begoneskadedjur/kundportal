// src/components/organisation/MultisiteDashboardView.tsx
// Dashboard: en enhet → kundportal-stil, alla enheter → org-översikt

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useMultisite } from '../../contexts/MultisiteContext'
import LoadingSpinner from '../shared/LoadingSpinner'

// Customer portal components (för en enhet)
import PremiumWelcomeHero from '../customer/PremiumWelcomeHero'
import ServiceExcellenceDashboard from '../customer/ServiceExcellenceDashboard'
import ContractValueCard from '../customer/ContractValueCard'
import ServiceAssessmentSummary from '../customer/ServiceAssessmentSummary'
import RelationshipShowcase from '../customer/RelationshipShowcase'
import PartnershipValueSection from '../customer/PartnershipValueSection'
import PremiumServiceRequest from '../customer/PremiumServiceRequest'
import CaseDetailsModal from '../customer/CaseDetailsModal'

// Organisation components (för alla enheter)
import OrganizationServiceRequest from './OrganizationServiceRequest'
import { ChevronRight } from 'lucide-react'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteDashboardViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

export default function MultisiteDashboardView({
  selectedSiteId,
  sites,
  userRoleType
}: MultisiteDashboardViewProps) {
  if (selectedSiteId !== 'all') {
    return <SingleSiteDashboard siteId={selectedSiteId} sites={sites} />
  }
  return <AllSitesDashboard sites={sites} userRoleType={userRoleType} />
}

// =============================================
// EN ENHET VALD → Kundportal-stil dashboard
// =============================================
function SingleSiteDashboard({ siteId, sites }: { siteId: string; sites: SiteOption[] }) {
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false)

  const fetchCustomer = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', siteId)
        .single()

      if (error) throw error
      setCustomer(data)
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    setLoading(true)
    fetchCustomer()
  }, [fetchCustomer])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchCustomer()
    setRefreshing(false)
  }

  const handleOpenCaseDetails = useCallback(async (caseId: string) => {
    setSelectedCaseId(caseId)
    setIsCaseModalOpen(true)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  if (!customer) return null

  const siteName = sites.find(s => s.id === siteId)?.site_name || customer.company_name

  return (
    <div>
      <PremiumWelcomeHero
        customer={{ ...customer, company_name: siteName }}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="mt-8">
          <ServiceExcellenceDashboard customer={customer} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <ContractValueCard customer={customer} />
            <ServiceAssessmentSummary
              customerId={customer.id}
              onOpenCaseDetails={handleOpenCaseDetails}
            />
          </div>
          <div className="space-y-6">
            <RelationshipShowcase customer={customer} />
          </div>
        </div>

        <div className="mt-12">
          <PartnershipValueSection />
        </div>
      </div>

      {showServiceRequest && (
        <PremiumServiceRequest
          isOpen={showServiceRequest}
          onClose={() => setShowServiceRequest(false)}
          customer={customer}
          onSuccess={() => window.location.reload()}
        />
      )}

      {selectedCaseId && (
        <CaseDetailsModal
          caseId={selectedCaseId}
          clickupTaskId=""
          isOpen={isCaseModalOpen}
          onClose={() => { setIsCaseModalOpen(false); setSelectedCaseId(null) }}
        />
      )}

      <button
        onClick={() => setShowServiceRequest(true)}
        className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-4 shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 group z-30"
        title="Begär service"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}

// =============================================
// ALLA ENHETER → Tabbar per enhet + aggregerad översikt
// =============================================
function AllSitesDashboard({ sites, userRoleType }: { sites: SiteOption[]; userRoleType: string }) {
  const { organization } = useMultisite()
  const [customers, setCustomers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | string>('all')
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [sites])

  const fetchCustomers = async () => {
    if (sites.length === 0) { setLoading(false); return }
    const { data } = await supabase
      .from('customers')
      .select('*')
      .in('id', sites.map(s => s.id))
    if (data) {
      const map: Record<string, any> = {}
      data.forEach(c => { map[c.id] = c })
      setCustomers(map)
    }
    setLoading(false)
  }

  const handleOpenCaseDetails = useCallback((caseId: string) => {
    setSelectedCaseId(caseId)
    setIsCaseModalOpen(true)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  const activeSite = activeTab !== 'all' ? sites.find(s => s.id === activeTab) : null
  const activeSiteCustomer = activeSite ? customers[activeSite.id] : null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Org-header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5">
        <h1 className="text-2xl font-bold text-white">
          {organization?.organization_name || 'Organisation'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {userRoleType === 'verksamhetschef' ? 'Översikt över hela organisationen' : `Översikt över ${sites.length} enheter`}
        </p>
      </div>

      {/* Tabb-navigation */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
            activeTab === 'all'
              ? 'bg-[#20c58f] border-[#20c58f] text-white'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
          }`}
        >
          Alla enheter
        </button>
        {sites.map(site => (
          <button
            key={site.id}
            onClick={() => setActiveTab(site.id)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
              activeTab === site.id
                ? 'bg-slate-700 border-slate-600 text-white'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {site.site_name}
          </button>
        ))}
      </div>

      {/* Vy: Alla enheter — aggregerad */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Kompakt enhetslista */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/60">
              <h3 className="text-sm font-semibold text-white">Enheter</h3>
            </div>
            <div className="divide-y divide-slate-700/40">
              {sites.map(site => {
                const customer = customers[site.id]
                return (
                  <button
                    key={site.id}
                    onClick={() => setActiveTab(site.id)}
                    className="flex items-center gap-4 w-full px-5 py-3 hover:bg-slate-700/20 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{site.site_name}</p>
                      {site.region && <p className="text-xs text-slate-500">{site.region}</p>}
                    </div>
                    {customer && (
                      <span className="text-xs text-slate-500 shrink-0">
                        {customer.contract_type || ''}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>

          <PartnershipValueSection />
        </div>
      )}

      {/* Vy: En specifik enhet */}
      {activeTab !== 'all' && activeSite && activeSiteCustomer && (
        <div className="space-y-6">
          <ServiceExcellenceDashboard customer={activeSiteCustomer} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ContractValueCard customer={activeSiteCustomer} />
              <ServiceAssessmentSummary
                customerId={activeSite.id}
                onOpenCaseDetails={handleOpenCaseDetails}
              />
            </div>
            <div className="space-y-6">
              <RelationshipShowcase customer={activeSiteCustomer} />
            </div>
          </div>

          <PartnershipValueSection />
        </div>
      )}

      {/* Ärendemodal */}
      {selectedCaseId && (
        <CaseDetailsModal
          caseId={selectedCaseId}
          clickupTaskId=""
          isOpen={isCaseModalOpen}
          onClose={() => { setIsCaseModalOpen(false); setSelectedCaseId(null) }}
        />
      )}

      {/* FAB */}
      <button
        onClick={() => setShowServiceRequest(true)}
        className="fixed bottom-24 lg:bottom-8 right-4 lg:right-8 bg-[#20c58f] hover:bg-[#1aad7d] text-white rounded-full p-4 shadow-lg transition-all duration-300 z-30"
        title="Begär service"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {showServiceRequest && (
        <OrganizationServiceRequest
          isOpen={showServiceRequest}
          onClose={() => setShowServiceRequest(false)}
          onSuccess={() => setShowServiceRequest(false)}
        />
      )}
    </div>
  )
}
