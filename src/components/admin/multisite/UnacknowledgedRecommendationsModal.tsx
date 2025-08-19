import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Calendar, User, MapPin, FileText, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import TrafficLightBadge from '../../organisation/TrafficLightBadge'
import LoadingSpinner from '../../shared/LoadingSpinner'
import Button from '../../ui/Button'

interface UnacknowledgedCase {
  id: string
  case_number: string
  title: string
  status: string
  pest_level?: number | null
  problem_rating?: number | null
  recommendations?: string | null
  assessment_date?: string | null
  primary_technician_name?: string | null
  pest_type?: string | null
  address?: string | any
  customer_name?: string
  site_name?: string
}

interface UnacknowledgedRecommendationsModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId?: string
  organizationName: string
}

const UnacknowledgedRecommendationsModal: React.FC<UnacknowledgedRecommendationsModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  organizationName
}) => {
  const [cases, setCases] = useState<UnacknowledgedCase[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState<UnacknowledgedCase | null>(null)

  useEffect(() => {
    if (isOpen && organizationId) {
      fetchUnacknowledgedCases()
    }
  }, [isOpen, organizationId])

  const fetchUnacknowledgedCases = async () => {
    if (!organizationId) return
    
    setLoading(true)
    try {
      // Först hämta alla enheter för organisationen
      const { data: sites } = await supabase
        .from('customers')
        .select('id, company_name, site_name')
        .eq('organization_id', organizationId)
        .eq('is_multisite', true)

      if (!sites || sites.length === 0) {
        setCases([])
        return
      }

      const siteIds = sites.map(s => s.id)
      const siteMap = new Map(sites.map(s => [s.id, { name: s.site_name || s.company_name }]))

      // Hämta alla cases med obekräftade rekommendationer
      const { data: casesData, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          title,
          status,
          pest_level,
          problem_rating,
          recommendations,
          assessment_date,
          primary_technician_name,
          pest_type,
          address,
          customer_id
        `)
        .in('customer_id', siteIds)
        .not('recommendations', 'is', null)
        .eq('recommendations_acknowledged', false)
        .order('problem_rating', { ascending: false, nullsFirst: false })
        .order('pest_level', { ascending: false, nullsFirst: false })

      if (error) throw error

      // Lägg till site-namn till varje case
      const casesWithSiteNames = (casesData || []).map(c => ({
        ...c,
        site_name: siteMap.get(c.customer_id)?.name || 'Okänd enhet'
      }))

      setCases(casesWithSiteNames)
    } catch (error) {
      console.error('Error fetching unacknowledged cases:', error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Ej angivet'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (pestLevel?: number | null, problemRating?: number | null) => {
    const pest = pestLevel ?? -1
    const problem = problemRating ?? -1
    
    if (pest >= 3 || problem >= 4) return 'text-red-400'
    if (pest === 2 || problem === 3) return 'text-yellow-400'
    if (pest >= 0 || problem >= 0) return 'text-green-400'
    return 'text-slate-400'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">
                Obekräftade rekommendationer
              </h2>
              <p className="text-sm text-slate-400">
                {organizationName} • {cases.length} ärenden behöver bekräftas
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner text="Hämtar ärenden..." />
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-slate-400">Alla rekommendationer är bekräftade!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sammanfattning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-1">
                      {cases.length} obekräftade rekommendationer
                    </p>
                    <p className="text-xs text-slate-400">
                      Kunden behöver bekräfta att de tagit del av teknikernas bedömningar och rekommendationer.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista med ärenden */}
              {cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <TrafficLightBadge
                        pestLevel={caseItem.pest_level}
                        problemRating={caseItem.problem_rating}
                        size="medium"
                      />
                      <div>
                        <h4 className="font-medium text-white">
                          {caseItem.case_number} - {caseItem.title}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {caseItem.site_name} • Status: {caseItem.status}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedCase(selectedCase?.id === caseItem.id ? null : caseItem)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {selectedCase?.id === caseItem.id ? 'Dölj detaljer' : 'Visa detaljer'}
                    </button>
                  </div>

                  {/* Grundläggande info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                    {caseItem.pest_type && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{caseItem.pest_type}</span>
                      </div>
                    )}
                    {caseItem.primary_technician_name && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <User className="w-3 h-3" />
                        <span>{caseItem.primary_technician_name}</span>
                      </div>
                    )}
                    {caseItem.assessment_date && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(caseItem.assessment_date)}</span>
                      </div>
                    )}
                    {caseItem.address && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{caseItem.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Rekommendationer */}
                  {caseItem.recommendations && (
                    <div className={`bg-slate-900/50 border border-slate-700 rounded-lg p-3 ${
                      selectedCase?.id === caseItem.id ? '' : 'line-clamp-2'
                    }`}>
                      <p className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Teknikerns rekommendation:
                      </p>
                      <p className="text-xs text-slate-400 whitespace-pre-line">
                        {caseItem.recommendations}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Kunden kan bekräfta rekommendationerna genom att logga in i kundportalen
            </p>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Stäng
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnacknowledgedRecommendationsModal