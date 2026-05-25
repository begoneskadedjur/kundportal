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
import TrafficLightAggregatedView from './TrafficLightAggregatedView'
import SiteCardWithTrafficLight from './SiteCardWithTrafficLight'
import OrganisationServiceActivityTimeline from './OrganisationServiceActivityTimeline'
import SiteOverviewModal from './SiteOverviewModal'
import MultisitePendingQuoteNotification from './MultisitePendingQuoteNotification'
import OrganizationServiceRequest from './OrganizationServiceRequest'

import { Building2 } from 'lucide-react'

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
// ALLA ENHETER → Organisationsöversikt
// =============================================
function AllSitesDashboard({ sites, userRoleType }: { sites: SiteOption[]; userRoleType: string }) {
  const { organization } = useMultisite()
  const [stats, setStats] = useState({ activeCases: 0, completedThisMonth: 0, scheduledVisits: 0, totalSites: 0 })
  const [hasCaseAssessments, setHasCaseAssessments] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<any>(null)
  const [showSiteModal, setShowSiteModal] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [sites])

  const fetchStats = async () => {
    if (sites.length === 0) {
      setStats({ activeCases: 0, completedThisMonth: 0, scheduledVisits: 0, totalSites: 0 })
      setLoading(false)
      return
    }

    try {
      const siteIds = sites.map(s => s.id)
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: cases } = await supabase
        .from('cases')
        .select('id, status, updated_at, scheduled_start, pest_level, problem_rating')
        .in('customer_id', siteIds)

      if (cases) {
        setStats({
          totalSites: sites.length,
          activeCases: cases.filter(c =>
            ['Öppen', 'Bokad', 'Återbesök'].includes(c.status)
          ).length,
          completedThisMonth: cases.filter(c =>
            ['Avslutat', 'Borttaget', 'Slutförd', 'Stängd'].includes(c.status) &&
            new Date(c.updated_at) >= startOfMonth
          ).length,
          scheduledVisits: cases.filter(c =>
            (c.status === 'Bokad' || c.status === 'Bokat') &&
            c.scheduled_start &&
            new Date(c.scheduled_start) >= new Date()
          ).length
        })
        setHasCaseAssessments(cases.some(c => c.pest_level != null || c.problem_rating != null))
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const siteIds = sites.map(s => s.id)

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 mb-8">
          <h1 className="text-2xl font-bold text-white">
            {organization?.organization_name || 'Organisation'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {userRoleType === 'verksamhetschef' && 'Översikt över hela organisationen'}
            {userRoleType === 'regionchef' && `Översikt över ${sites.length} enheter i din region`}
            {userRoleType === 'platsansvarig' && 'Översikt'}
          </p>
        </div>

        {/* KPI-grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-slate-800/50 border border-slate-700 rounded-xl divide-y divide-slate-700 lg:divide-y-0 lg:divide-x divide-slate-700 mb-8">
            {[
              { label: 'Enheter', value: stats.totalSites, sub: 'aktiva platser' },
              { label: 'Aktiva ärenden', value: stats.activeCases, sub: null },
              { label: 'Avklarade denna månad', value: stats.completedThisMonth, sub: null },
              { label: 'Kommande besök', value: stats.scheduledVisits, sub: null },
            ].map(({ label, value, sub }) => (
              <div key={label} className="px-5 py-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-2xl font-semibold text-white font-mono leading-tight">{value}</p>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Enheter */}
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Enheter</h2>
          {sites.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Inga enheter tillgängliga</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map(site => (
                <SiteCardWithTrafficLight
                  key={site.id}
                  site={site}
                  onClick={() => {
                    setSelectedSite(site)
                    setShowSiteModal(true)
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trafikljusöversikt — visas bara om det finns bedömningar */}
        {siteIds.length > 0 && hasCaseAssessments && (
          <div className="mb-8">
            <TrafficLightAggregatedView
              organizationId={organization?.organization_id}
              siteIds={siteIds}
              userRole={userRoleType as any}
            />
          </div>
        )}

        {/* Servicehistorik */}
        {siteIds.length > 0 && (
          <OrganisationServiceActivityTimeline
            siteIds={siteIds}
          />
        )}

        {/* Site Overview Modal */}
        {showSiteModal && selectedSite && (
          <SiteOverviewModal
            site={selectedSite}
            isOpen={showSiteModal}
            onClose={() => { setShowSiteModal(false); setSelectedSite(null) }}
          />
        )}
      </div>

      {/* FAB-knapp */}
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
          onSuccess={() => { setShowServiceRequest(false); fetchStats() }}
        />
      )}
    </div>
  )
}
