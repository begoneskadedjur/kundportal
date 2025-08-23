// src/components/organisation/SiteOverviewModal.tsx - Modal för enhetsöversikt med ärenden
import React, { useState, useEffect } from 'react'
import { X, MapPin, User, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../shared/LoadingSpinner'
import TrafficLightStatusCard from './TrafficLightStatusCard'
import { OrganizationSite } from '../../types/multisite'

interface SiteOverviewModalProps {
  site: OrganizationSite
  isOpen: boolean
  onClose: () => void
}

interface CaseWithTrafficLight {
  id: string
  case_number: string
  title: string
  status: string
  pest_level?: number | null
  problem_rating?: number | null
  recommendations?: string | null
  recommendations_acknowledged?: boolean
  recommendations_acknowledged_at?: string | null
  recommendations_acknowledged_by?: string | null
  work_report?: string | null
  pest_type?: string | null
  address?: string | null
  assessment_date?: string | null
  assessed_by?: string | null
  primary_technician_name?: string | null
}

const SiteOverviewModal: React.FC<SiteOverviewModalProps> = ({
  site,
  isOpen,
  onClose
}) => {
  const [cases, setCases] = useState<CaseWithTrafficLight[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseWithTrafficLight | null>(null)
  const [showCaseDetail, setShowCaseDetail] = useState(false)

  useEffect(() => {
    if (isOpen && site) {
      fetchSiteCases()
    }
  }, [isOpen, site])

  const fetchSiteCases = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          pest_level,
          problem_rating,
          recommendations,
          recommendations_acknowledged,
          recommendations_acknowledged_at,
          recommendations_acknowledged_by,
          work_report,
          pest_type,
          address,
          assessment_date,
          assessed_by,
          primary_technician_name
        `)
        .eq('customer_id', site.id)
        .not('pest_level', 'is', null)
        .not('problem_rating', 'is', null)
        .order('assessment_date', { ascending: false })

      if (error) throw error

      setCases(data || [])
    } catch (error) {
      console.error('Error fetching site cases:', error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  // Beräkna trafikljusstatus för sammanfattning
  const getStatusSummary = () => {
    let critical = 0
    let warning = 0
    let ok = 0

    cases.forEach(caseItem => {
      const pest = caseItem.pest_level ?? -1
      const problem = caseItem.problem_rating ?? -1
      
      if (pest >= 3 || problem >= 4) {
        critical++
      } else if (pest === 2 || problem === 3) {
        warning++
      } else if (pest >= 0 || problem >= 0) {
        ok++
      }
    })

    return { critical, warning, ok }
  }

  const statusSummary = getStatusSummary()

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-purple-400" />
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Enhetsöversikt - {site.site_name}
                </h2>
                <p className="text-sm text-slate-400">
                  {site.region && `Region: ${site.region}`}
                  {site.address && ` • ${site.address}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            
            {/* Enhetsinfo och trafikljusstatus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Enhetsinfo */}
              <div className="bg-slate-800/30 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  Enhetsinfo
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-300">
                    <span className="text-slate-400">Status:</span> {site.is_active ? 'Aktiv' : 'Inaktiv'}
                  </p>
                  {site.contact_person && (
                    <p className="text-slate-300">
                      <span className="text-slate-400">Kontakt:</span> {site.contact_person}
                    </p>
                  )}
                  {site.contact_phone && (
                    <p className="text-slate-300">
                      <span className="text-slate-400">Telefon:</span> {site.contact_phone}
                    </p>
                  )}
                  {site.contact_email && (
                    <p className="text-slate-300">
                      <span className="text-slate-400">Email:</span> {site.contact_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Trafikljusstatus sammanfattning */}
              <div className="bg-slate-800/30 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  Trafikljusstatus
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Totala ärenden:</span>
                    <span className="text-white font-medium">{cases.length}</span>
                  </div>
                  
                  {cases.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Bedömningar:</span>
                      <div className="flex items-center gap-2">
                        {statusSummary.critical > 0 && (
                          <span className="text-red-400 text-sm">🔴 {statusSummary.critical}</span>
                        )}
                        {statusSummary.warning > 0 && (
                          <span className="text-yellow-400 text-sm">🟡 {statusSummary.warning}</span>
                        )}
                        {statusSummary.ok > 0 && (
                          <span className="text-green-400 text-sm">🟢 {statusSummary.ok}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ärenden lista */}
            <div>
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Alla ärenden med bedömningar
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner text="Laddar ärenden..." />
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Inga ärenden med bedömningar hittades</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cases.map(caseItem => (
                    <div
                      key={caseItem.id}
                      onClick={() => {
                        setSelectedCase(caseItem)
                        setShowCaseDetail(true)
                      }}
                      className="cursor-pointer"
                    >
                      <TrafficLightStatusCard
                        caseData={caseItem}
                        isCustomerView={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ärendedetalj-modal */}
      {showCaseDetail && selectedCase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-700">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Ärendedetaljer</h2>
                <button
                  onClick={() => setShowCaseDetail(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <TrafficLightStatusCard
                  caseData={selectedCase}
                  isCustomerView={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SiteOverviewModal