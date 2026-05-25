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
// ALLA ENHETER → En sektion per enhet, samma design som singel-vy
// =============================================
function AllSitesDashboard({ sites, userRoleType }: { sites: SiteOption[]; userRoleType: string }) {
  const { organization } = useMultisite()
  const [customers, setCustomers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

      {/* Org-header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5">
        <h1 className="text-2xl font-bold text-white">
          {organization?.organization_name || 'Organisation'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {userRoleType === 'verksamhetschef' ? 'Översikt över hela organisationen' : `Översikt över ${sites.length} enheter`}
        </p>
      </div>

      {/* En sektion per enhet */}
      {sites.map(site => {
        const customer = customers[site.id]
        if (!customer) return null
        return (
          <div key={site.id} className="space-y-6">
            {/* Enhetsrubrik */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-800" />
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {site.site_name}{site.region ? ` · ${site.region}` : ''}
              </h2>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            {/* KPI-grid */}
            <ServiceExcellenceDashboard customer={customer} />

            {/* Avtal + Ärendebedömning + Kontakt */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ContractValueCard customer={customer} />
                <ServiceAssessmentSummary
                  customerId={site.id}
                  onOpenCaseDetails={handleOpenCaseDetails}
                />
              </div>
              <div className="space-y-6">
                <RelationshipShowcase customer={customer} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Om BeGone */}
      <PartnershipValueSection />

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
