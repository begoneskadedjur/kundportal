// src/components/organisation/OrganisationServiceActivityTimeline.tsx
import React, { useState, useEffect } from 'react'
import { AlertCircle, Calendar, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMultisite } from '../../contexts/MultisiteContext'
import { Case, serviceTypeConfig } from '../../types/cases'
import { ClickUpStatus } from '../../types/database'
import LoadingSpinner from '../shared/LoadingSpinner'
import ProfessionalAssessment from '../customer/ProfessionalAssessment'

interface OrganisationServiceActivityTimelineProps {
  customerId?: string
  organizationId?: string
  siteIds?: string[]
}

const SERVICE_TYPE_FILTERS = [
  { value: 'all', label: 'Alla typer' },
  { value: 'inspection', label: 'Inspektion' },
  { value: 'establishment', label: 'Etablering' },
  { value: 'acute', label: 'Akut' },
  { value: 'service', label: 'Service' },
]

const STATUS_FILTERS = [
  { value: 'completed', label: 'Genomförda' },
  { value: 'all', label: 'Alla' },
  { value: 'Bokad', label: 'Bokade' },
  { value: 'Öppen', label: 'Öppna' },
]

const COMPLETED_STATUSES = ['Avslutat', 'Slutförd', 'Stängd', 'Borttaget']

const OrganisationServiceActivityTimeline: React.FC<OrganisationServiceActivityTimelineProps> = ({
  customerId,
  organizationId,
  siteIds
}) => {
  const { organization } = useMultisite()
  const [cases, setCases] = useState<Case[]>([])
  const [siteNames, setSiteNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('completed')
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all')
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  useEffect(() => {
    fetchCases()
  }, [customerId, organizationId, organization, siteIds])

  const fetchCases = async () => {
    try {
      let customerIds: string[] = []

      if (customerId) {
        customerIds = [customerId]
      } else if (siteIds && siteIds.length > 0) {
        customerIds = siteIds
      } else if (organizationId || organization?.organization_id) {
        const orgId = organizationId || organization?.organization_id
        const { data: orgSites } = await supabase
          .from('customers')
          .select('id')
          .eq('organization_id', orgId)
          .eq('is_multisite', true)
        customerIds = (orgSites || []).map(s => s.id)
      }

      if (customerIds.length === 0) {
        setCases([])
        setLoading(false)
        return
      }

      // Hämta enheternas namn
      const { data: sitesData } = await supabase
        .from('customers')
        .select('id, company_name')
        .in('id', customerIds)

      if (sitesData) {
        const nameMap: Record<string, string> = {}
        sitesData.forEach(s => { nameMap[s.id] = s.company_name })
        setSiteNames(nameMap)
      }

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCases(data || [])
    } catch (error: any) {
      console.error('Error fetching cases:', error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCases = cases.filter(c => {
    const statusOk =
      statusFilter === 'all' ? true :
      statusFilter === 'completed' ? COMPLETED_STATUSES.includes(c.status) :
      c.status === statusFilter
    const typeOk = serviceTypeFilter === 'all' ? true : c.service_type === serviceTypeFilter
    return statusOk && typeOk
  })

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const d = new Date(dateString)
    return {
      day: d.getDate().toString(),
      month: d.toLocaleDateString('sv-SE', { month: 'short' }),
      full: d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  const getStatusBadge = (status: ClickUpStatus) => {
    if (COMPLETED_STATUSES.includes(status)) {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">Genomförd</span>
    }
    if (status === 'Bokad' || status === 'Bokat') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">Bokad</span>
    }
    if (status === 'Öppen') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">Öppen</span>
    }
    if (status === 'Borttaget') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">Borttagen</span>
    }
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">{status}</span>
  }

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Servicehistorik</h3>
            <p className="text-xs text-slate-500 mt-0.5">Organisationens serviceärenden</p>
          </div>
          <span className="text-xs text-slate-500">{filteredCases.length} ärenden</span>
        </div>

        {/* Filter-rader */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#20c58f] border-[#20c58f] text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px bg-slate-700 mx-1" />
          {SERVICE_TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setServiceTypeFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                serviceTypeFilter === f.value
                  ? 'bg-slate-600 border-slate-500 text-white'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filteredCases.length === 0 ? (
        <div className="py-12 text-center">
          <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Inga ärenden matchar filtret</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/40">
          {filteredCases.map(caseItem => {
            const isExpanded = expandedCase === caseItem.id
            const date = formatDate(caseItem.completed_date || caseItem.scheduled_start || caseItem.created_at)
            const serviceType = caseItem.service_type ? serviceTypeConfig[caseItem.service_type] : null
            const siteName = siteNames[caseItem.customer_id] || ''

            return (
              <div key={caseItem.id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                >
                  {/* Datumfält */}
                  {date ? (
                    <div className="w-10 h-10 bg-slate-700/60 rounded-lg flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white leading-none">{date.day}</span>
                      <span className="text-[9px] text-slate-400 uppercase mt-0.5">{date.month}</span>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-slate-700/40 rounded-lg flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-slate-500" />
                    </div>
                  )}

                  {/* Innehåll */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white truncate">{caseItem.title}</p>
                      {serviceType && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          caseItem.service_type === 'inspection' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          caseItem.service_type === 'establishment' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          caseItem.service_type === 'acute' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-slate-700/50 text-slate-400 border-slate-700'
                        }`}>
                          {serviceType.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {siteName}{caseItem.primary_technician_name ? ` · ${caseItem.primary_technician_name}` : ''}
                    </p>
                  </div>

                  {/* Status */}
                  {getStatusBadge(caseItem.status as ClickUpStatus)}

                  {/* Visa-ikon */}
                  <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                </div>

                {/* Expanderat innehåll */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-2 bg-slate-800/30 border-t border-slate-700/30 space-y-3">
                    {caseItem.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{caseItem.description}</p>
                    )}
                    {caseItem.work_report && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Arbetsrapport</p>
                        <p className="text-xs text-slate-300 bg-slate-800/50 p-3 rounded-lg">{caseItem.work_report}</p>
                      </div>
                    )}
                    {caseItem.materials_used && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-amber-400 mb-1">Använda preparat</p>
                          <p className="text-xs text-slate-300 whitespace-pre-wrap">{caseItem.materials_used}</p>
                        </div>
                      </div>
                    )}
                    <ProfessionalAssessment
                      assessment={{
                        pest_level: caseItem.pest_level,
                        problem_rating: caseItem.problem_rating,
                        recommendations: caseItem.recommendations,
                        assessment_date: caseItem.assessment_date,
                        assessed_by: caseItem.assessed_by
                      }}
                    />
                    {caseItem.primary_technician_name && (
                      <p className="text-xs text-slate-500">
                        Tekniker: <span className="text-slate-400">{caseItem.primary_technician_name}</span>
                        {caseItem.completed_date && (
                          <> · Slutfört: <span className="text-slate-400">{formatDate(caseItem.completed_date)?.full}</span></>
                        )}
                      </p>
                    )}
                    {caseItem.price && caseItem.price > 0 && COMPLETED_STATUSES.includes(caseItem.status) && (
                      <div className="flex justify-between pt-2 border-t border-slate-700/50">
                        <span className="text-xs text-slate-400">Kostnad</span>
                        <span className="text-xs font-medium text-white">{caseItem.price.toLocaleString('sv-SE')} kr</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OrganisationServiceActivityTimeline
