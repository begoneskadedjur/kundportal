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
import { ChevronRight, Phone, Mail, User, FileText } from 'lucide-react'

interface SiteOption {
  id: string
  site_name: string
  region?: string | null
}

interface MultisiteDashboardViewProps {
  selectedSiteId: string | 'all'
  sites: SiteOption[]
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  isRegional?: boolean
}

export default function MultisiteDashboardView({
  selectedSiteId,
  sites,
  userRoleType,
  isRegional = false,
}: MultisiteDashboardViewProps) {
  if (selectedSiteId !== 'all') {
    return <SingleSiteDashboard siteId={selectedSiteId} sites={sites} />
  }
  return <AllSitesDashboard sites={sites} userRoleType={userRoleType} isRegional={isRegional} />
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

const SCHEDULED_TYPES = ['inspection', 'routine', 'establishment']

interface AggregatedKPIs {
  completedInspections: number
  totalInspections: number
  nextInspection: { start: Date; end: Date | null } | null
  activeCases: number
  nextVisit: { start: Date; end: Date | null } | null
}

function AllSitesDashboard({ sites, userRoleType, isRegional }: { sites: SiteOption[]; userRoleType: string; isRegional: boolean }) {
  const { organization } = useMultisite()
  const [customers, setCustomers] = useState<Record<string, any>>({})
  const [hoofdCustomer, setHoofdCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | string>('all')
  const [aggregated, setAggregated] = useState<AggregatedKPIs | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false)
  const [showServiceRequest, setShowServiceRequest] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [sites])

  const fetchAll = async () => {
    if (sites.length === 0) { setLoading(false); return }
    const siteIds = sites.map(s => s.id)

    const [{ data: customersData }, { data: casesData }, { data: sessionsData }, { data: hoofdData }] = await Promise.all([
      supabase.from('customers').select('*').in('id', siteIds),
      supabase.from('cases').select('id, status, scheduled_start, scheduled_end, service_type, customer_id').in('customer_id', siteIds),
      supabase.from('station_inspection_sessions').select('id, status, case:cases!inner(customer_id)').eq('status', 'completed').in('cases.customer_id', siteIds),
      isRegional && organization?.id
        ? supabase.from('customers').select('company_name, contact_name, contact_email, contact_phone, contract_type, contract_status, annual_premium, address').eq('id', organization.id).single()
        : Promise.resolve({ data: null }),
    ])

    if (hoofdData) setHoofdCustomer(hoofdData)

    if (customersData) {
      const map: Record<string, any> = {}
      customersData.forEach(c => { map[c.id] = c })
      setCustomers(map)
    }

    if (casesData) {
      const now = new Date()
      const { isCompletedStatus } = await import('../../types/database')

      const totalInspections = casesData.filter(c => c.service_type === 'inspection').length
      const activeCases = casesData.filter(c => !isCompletedStatus(c.status) && !SCHEDULED_TYPES.includes(c.service_type ?? '')).length

      const upcomingInspections = casesData
        .filter(c => c.service_type === 'inspection' && c.scheduled_start && new Date(c.scheduled_start) > now)
        .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())

      const upcomingVisits = casesData
        .filter(c => c.service_type !== 'inspection' && c.scheduled_start && new Date(c.scheduled_start) > now)
        .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime())

      setAggregated({
        completedInspections: sessionsData?.length ?? 0,
        totalInspections,
        activeCases,
        nextInspection: upcomingInspections[0]
          ? { start: new Date(upcomingInspections[0].scheduled_start!), end: upcomingInspections[0].scheduled_end ? new Date(upcomingInspections[0].scheduled_end) : null }
          : null,
        nextVisit: upcomingVisits[0]
          ? { start: new Date(upcomingVisits[0].scheduled_start!), end: upcomingVisits[0].scheduled_end ? new Date(upcomingVisits[0].scheduled_end) : null }
          : null,
      })
    }

    setLoading(false)
  }

  const handleOpenCaseDetails = useCallback((caseId: string) => {
    setSelectedCaseId(caseId)
    setIsCaseModalOpen(true)
  }, [])

  const formatNextDate = (d: { start: Date; end: Date | null } | null): { value: string; sub: string } => {
    if (!d) return { value: 'Ej schemalagt', sub: '' }
    const now = new Date()
    const diffDays = Math.ceil((d.start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const startTime = d.start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    const endTime = d.end?.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    const timeRange = endTime ? `${startTime}–${endTime}` : startTime
    const dateStr = d.start.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
    if (diffDays === 0) return { value: 'Idag', sub: timeRange }
    if (diffDays === 1) return { value: 'Imorgon', sub: timeRange }
    return { value: dateStr, sub: timeRange }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    )
  }

  const activeSite = activeTab !== 'all' ? sites.find(s => s.id === activeTab) : null
  const activeSiteCustomer = activeSite ? customers[activeSite.id] : null

  const nextInspDisplay = aggregated ? formatNextDate(aggregated.nextInspection) : { value: 'Ej schemalagt', sub: '' }
  const nextVisitDisplay = aggregated ? formatNextDate(aggregated.nextVisit) : { value: 'Ej schemalagt', sub: '' }

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
      <div className="flex border-b border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`relative text-sm px-4 py-2.5 font-medium whitespace-nowrap transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors ${
            activeTab === 'all'
              ? 'text-[#20c58f] after:bg-[#20c58f]'
              : 'text-slate-400 hover:text-white after:bg-transparent'
          }`}
        >
          Alla enheter
        </button>
        {sites.map(site => (
          <button
            key={site.id}
            onClick={() => setActiveTab(site.id)}
            className={`relative text-sm px-4 py-2.5 font-medium whitespace-nowrap transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:transition-colors ${
              activeTab === site.id
                ? 'text-[#20c58f] after:bg-[#20c58f]'
                : 'text-slate-400 hover:text-white after:bg-transparent'
            }`}
          >
            {site.site_name}
          </button>
        ))}
      </div>

      {/* Vy: Alla enheter — aggregerad */}
      {activeTab === 'all' && aggregated && (
        <div className="space-y-6">
          {/* Aggregerat KPI-grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-slate-800/50 border border-slate-700 rounded-xl divide-y divide-slate-700 lg:divide-y-0 lg:divide-x divide-slate-700">
            {[
              {
                label: 'Genomförda servicebesök',
                value: aggregated.completedInspections,
                sub: `${aggregated.completedInspections}/${aggregated.totalInspections} schemalagda`
              },
              {
                label: 'Nästa servicebesök',
                value: nextInspDisplay.value,
                sub: nextInspDisplay.sub
              },
              {
                label: 'Aktiva ärenden',
                value: aggregated.activeCases,
                sub: aggregated.activeCases === 1 ? 'aktivt ärende' : 'aktiva ärenden'
              },
              {
                label: 'Nästa besök',
                value: nextVisitDisplay.value,
                sub: nextVisitDisplay.sub
              }
            ].map((cell, i) => (
              <div key={i} className="px-5 py-4">
                <p className="text-xs text-slate-500 mb-1">{cell.label}</p>
                <p className="text-2xl font-semibold text-white font-mono leading-tight">{cell.value}</p>
                {cell.sub && <p className="text-xs text-slate-500 mt-0.5">{cell.sub}</p>}
              </div>
            ))}
          </div>

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
                    {customer?.contract_type && (
                      <span className="text-xs text-slate-500 shrink-0">{customer.contract_type}</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Avtal & kontakt — bara för regionalkunder */}
          {isRegional && hoofdCustomer && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700/60">
                <h3 className="text-sm font-semibold text-white">Avtal & kontakt</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/40">
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kontaktperson</p>
                  {hoofdCustomer.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-white">
                      <User className="w-4 h-4 text-slate-500 shrink-0" />
                      {hoofdCustomer.contact_name}
                    </div>
                  )}
                  {hoofdCustomer.contact_email && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                      <a href={`mailto:${hoofdCustomer.contact_email}`} className="hover:text-[#20c58f] transition-colors truncate">
                        {hoofdCustomer.contact_email}
                      </a>
                    </div>
                  )}
                  {hoofdCustomer.contact_phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                      <a href={`tel:${hoofdCustomer.contact_phone}`} className="hover:text-[#20c58f] transition-colors">
                        {hoofdCustomer.contact_phone}
                      </a>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Avtalsinformation</p>
                  {hoofdCustomer.contract_type && (
                    <div className="flex items-center gap-2 text-sm text-white">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      {hoofdCustomer.contract_type}
                    </div>
                  )}
                  {hoofdCustomer.contract_status && (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        hoofdCustomer.contract_status === 'active'
                          ? 'bg-[#20c58f]/15 text-[#20c58f]'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {hoofdCustomer.contract_status === 'active' ? 'Aktivt avtal' : hoofdCustomer.contract_status}
                      </span>
                    </div>
                  )}
                  {hoofdCustomer.annual_premium != null && (
                    <div className="text-sm text-slate-300">
                      <span className="text-slate-500">Årspremie: </span>
                      {Number(hoofdCustomer.annual_premium).toLocaleString('sv-SE')} kr
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
