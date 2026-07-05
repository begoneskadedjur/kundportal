// src/components/organisation/CustomerCaseDetailsModal.tsx
// Kundanpassad ärendevy för organisationsroller

import { useEffect, useState } from 'react'
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  DollarSign, 
  FileText, 
  AlertTriangle,
  Bug,
  Phone,
  Mail,
  Building2,
  CheckCircle,
  AlertCircle,
  Activity,
  HelpCircle
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import PDFExportButton from '../shared/PDFExportButton'
import { supabase, getAuthHeaders } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface CustomerCaseDetailsModalProps {
  caseData: any
  isOpen: boolean
  onClose: () => void
  userRole?: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
}

interface CustomerData {
  company_name: string
  site_name?: string
  region?: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
  contact_address?: string
}

export default function CustomerCaseDetailsModal({ 
  caseData, 
  isOpen, 
  onClose,
  userRole = 'platsansvarig'
}: CustomerCaseDetailsModalProps) {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [acknowledgingRecommendations, setAcknowledgingRecommendations] = useState(false)

  // PDF Export functionality for single case
  const handlePDFExport = async () => {
    try {
      const response = await fetch('/api/generate-case-report-pdf', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          reportType: 'single',
          caseData: caseData,
          customerData: customerData,
          userRole: userRole
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.pdf) {
        // Create blob and download
        const pdfBlob = new Blob([
          Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))
        ], { type: 'application/pdf' })
        
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || `BeGone_Arende_${caseData.case_number || 'N/A'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        throw new Error(data.error || 'PDF generation failed')
      }
    } catch (error) {
      console.error('PDF export failed:', error)
      throw error
    }
  }

  useEffect(() => {
    if (isOpen && caseData?.customer_id) {
      fetchCustomerData()
    }
  }, [isOpen, caseData])

  const fetchCustomerData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('company_name, site_name, region, contact_person, contact_phone, contact_email, contact_address')
        .eq('id', caseData.customer_id)
        .single()

      if (error) throw error
      setCustomerData(data)
    } catch (error) {
      console.error('Error fetching customer data:', error)
      toast.error('Kunde inte ladda kunduppgifter')
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledgeRecommendations = async () => {
    if (!caseData.recommendations || caseData.recommendations_acknowledged) return
    
    setAcknowledgingRecommendations(true)
    try {
      const { error } = await supabase
        .from('cases')
        .update({ 
          recommendations_acknowledged: true,
          recommendations_acknowledged_at: new Date().toISOString()
        })
        .eq('id', caseData.id)

      if (error) throw error
      
      toast.success('Rekommendationer bekräftade')
      // Uppdatera local state
      caseData.recommendations_acknowledged = true
      caseData.recommendations_acknowledged_at = new Date().toISOString()
    } catch (error) {
      console.error('Error acknowledging recommendations:', error)
      toast.error('Kunde inte bekräfta rekommendationer')
    } finally {
      setAcknowledgingRecommendations(false)
    }
  }

  const getPestLevelDescription = (level: number) => {
    switch(level) {
      case 0: return "Ingen förekomst registrerad"
      case 1: return "Låg nivå - Minimal aktivitet"
      case 2: return "Måttlig nivå - Synlig förekomst" 
      case 3: return "Hög nivå - Kräver omedelbar åtgärd"
      default: return "Bedömning pågår"
    }
  }

  const getProblemRatingDescription = (rating: number) => {
    switch(rating) {
      case 1: return "Utmärkt - Helt under kontroll"
      case 2: return "Bra - Stabil situation"  
      case 3: return "OK - Kräver uppmärksamhet"
      case 4: return "Allvarligt - Åtgärd krävs"
      case 5: return "Kritiskt - Omedelbar åtgärd"
      default: return "Bedömning pågår"
    }
  }

  const getTrafficLightStatus = () => {
    if (caseData.pest_level >= 3 || caseData.problem_rating >= 4) {
      return { color: 'red', emoji: '🔴', label: 'Kritisk - Åtgärd krävs', bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-400' }
    }
    if (caseData.pest_level === 2 || caseData.problem_rating === 3) {
      return { color: 'yellow', emoji: '🟡', label: 'Varning - Övervakning', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400' }
    }
    return { color: 'green', emoji: '🟢', label: 'OK - Under kontroll', bg: 'bg-green-500/10', border: 'border-green-500/50', text: 'text-green-400' }
  }

  const getStatusBadgeColor = (status: string) => {
    if (status === 'Slutförd' || status === 'Stängd') return 'bg-green-500/20 text-green-400'
    if (status === 'Bokad' || status === 'Bokat' || status.startsWith('Återbesök')) return 'bg-amber-500/20 text-amber-400'
    if (status === 'Öppen') return 'bg-blue-500/20 text-blue-400'
    return 'bg-slate-500/20 text-slate-400'
  }

  const formatAddress = (address: any) => {
    // Hantera JSONB-format från cases-tabellen
    if (typeof address === 'object' && address?.address) return address.address
    // Hantera string-format från customers contact_address
    if (typeof address === 'string' && address.trim()) return address
    return 'Ingen adress registrerad'
  }

  const formatWorkTime = (minutes: number) => {
    if (!minutes) return 'Ej registrerad'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins} min`
    if (mins === 0) return `${hours} h`
    return `${hours}h ${mins}min`
  }

  const renderCostInfo = () => {
    if (caseData.price && caseData.price > 0) {
      return `Totalkostnad: ${caseData.price} SEK`
    }
    if (caseData.price === 0) {
      return "Kostnadsfritt ärende"
    }
    return "Ingår i serviceavtal"
  }

  if (!isOpen) return null

  const trafficLight = (caseData.pest_level !== null || caseData.problem_rating !== null) 
    ? getTrafficLightStatus() 
    : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-slate-700 w-full max-w-6xl max-h-[95vh] overflow-hidden">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-purple-400" />
                  {caseData.case_number || 'Ärende'} - {caseData.title || 'Ingen titel'}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(caseData.status)}`}>
                    {caseData.status}
                  </span>
                  {caseData.priority && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-400">
                      {caseData.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <PDFExportButton
                onExport={handlePDFExport}
                variant="ghost"
                size="sm"
                iconOnly={true}
                tooltip="Exportera ärende som PDF"
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              />
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner text="Laddar ärendedetaljer..." />
              </div>
            ) : (
              <div className="space-y-8">
                
                {/* Företag & Kontakt */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-blue-400" />
                      Företag & Kontakt
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-slate-400 mt-1" />
                          <div>
                            <p className="text-sm text-slate-400">Företag</p>
                            <p className="text-white font-medium">
                              {customerData?.company_name || 'Okänt företag'}
                              {customerData?.site_name && ` - ${customerData.site_name}`}
                            </p>
                            {customerData?.region && (
                              <p className="text-slate-400 text-sm">Region: {customerData.region}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-slate-400 mt-1" />
                          <div>
                            <p className="text-sm text-slate-400">Adress</p>
                            <p className="text-white">{formatAddress(caseData.address || customerData?.contact_address)}</p>
                          </div>
                        </div>

                        {caseData.pest_type && (
                          <div className="flex items-start gap-3">
                            <Bug className="w-5 h-5 text-slate-400 mt-1" />
                            <div>
                              <p className="text-sm text-slate-400">Skadedjur</p>
                              <p className="text-white">{caseData.pest_type}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-slate-400 mt-1" />
                          <div>
                            <p className="text-sm text-slate-400">Kontaktperson</p>
                            <p className="text-white">{caseData.contact_person || customerData?.contact_person || 'Inte specificerat'}</p>
                          </div>
                        </div>

                        {(caseData.contact_phone || customerData?.contact_phone) && (
                          <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-slate-400 mt-1" />
                            <div>
                              <p className="text-sm text-slate-400">Telefon</p>
                              <p className="text-white">{caseData.contact_phone || customerData?.contact_phone}</p>
                            </div>
                          </div>
                        )}

                        {(caseData.contact_email || customerData?.contact_email) && (
                          <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-slate-400 mt-1" />
                            <div>
                              <p className="text-sm text-slate-400">E-post</p>
                              <p className="text-white">{caseData.contact_email || customerData?.contact_email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Ärendebeskrivning (om den finns) */}
                {caseData.description && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-slate-400" />
                        Ärendebeskrivning
                      </h3>
                      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {caseData.description}
                      </p>
                    </div>
                  </Card>
                )}


                {/* Service & Logistik */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-green-400" />
                      Service & Logistik
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {caseData.primary_technician_name && (
                          <div className="flex items-start gap-3">
                            <User className="w-5 h-5 text-slate-400 mt-1" />
                            <div className="flex-1">
                              <p className="text-sm text-slate-400">Tekniker</p>
                              <p className="text-white font-medium">{caseData.primary_technician_name}</p>
                              
                              {/* Extern kontakt knappar */}
                              <div className="flex gap-2 mt-2">
                                {caseData.technician_phone && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(`tel:${caseData.technician_phone}`, '_self')}
                                    className="p-2 text-slate-400 hover:text-green-400"
                                    title="Ring tekniker"
                                  >
                                    <Phone className="w-4 h-4" />
                                  </Button>
                                )}
                                {caseData.technician_email && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(`mailto:${caseData.technician_email}?subject=Ärende ${caseData.case_number}`, '_blank')}
                                    className="p-2 text-slate-400 hover:text-blue-400"
                                    title="Skicka e-post till tekniker"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {caseData.scheduled_start && (
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-slate-400 mt-1" />
                            <div>
                              <p className="text-sm text-slate-400">Schemalagd tid</p>
                              <p className="text-white">
                                {new Date(caseData.scheduled_start).toLocaleDateString('sv-SE', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Arbetstid - visa bara om det finns verklig tid registrerad */}
                        {!!(caseData.time_spent_minutes && caseData.time_spent_minutes > 0) && (
                          <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-slate-400 mt-1" />
                            <div>
                              <p className="text-sm text-slate-400">Arbetstid</p>
                              <p className="text-white font-medium">
                                {formatWorkTime(caseData.time_spent_minutes)} arbetat
                              </p>
                              <p className="text-slate-400 text-xs mt-1">
                                Tid spenderad på detta ärende
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Kostnadsinformation */}
                        <div className="flex items-start gap-3">
                          <DollarSign className="w-5 h-5 text-slate-400 mt-1" />
                          <div>
                            <p className="text-sm text-slate-400">Kostnad</p>
                            <p className="text-white font-medium text-lg">
                              {renderCostInfo()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Arbetsrapport */}
                {caseData.work_report && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-blue-400" />
                        Arbetsrapport
                      </h3>
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {caseData.work_report}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Teknisk Bedömning - flyttad hit precis före Rekommendationer */}
                {(caseData.pest_level !== null || caseData.problem_rating !== null) && trafficLight && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-purple-400" />
                        Teknisk bedömning
                      </h3>
                      
                      {/* Övergripande status */}
                      <div className={`p-4 rounded-lg border mb-4 ${trafficLight.bg} ${trafficLight.border}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-slate-300">Vår bedömning:</span>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${trafficLight.text}`}>
                            <span className="text-xl">{trafficLight.emoji}</span>
                            <span>{trafficLight.label}</span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-400 mb-3">
                          Baserat på inspektion och expertis har vår tekniker bedömt situationen:
                        </p>

                        {/* Detaljerade scores */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {caseData.pest_level !== null && (
                            <div className="bg-slate-800/40 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Bug className="w-4 h-4 text-orange-400" />
                                <p className="text-sm font-medium text-slate-300">Aktivitetsnivå</p>
                              </div>
                              <p className="text-lg font-bold text-white">
                                Nivå {caseData.pest_level} av 3
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {getPestLevelDescription(caseData.pest_level)}
                              </p>
                            </div>
                          )}

                          {caseData.problem_rating !== null && (
                            <div className="bg-slate-800/40 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-blue-400" />
                                <p className="text-sm font-medium text-slate-300">Situationsbedömning</p>
                              </div>
                              <p className="text-lg font-bold text-white">
                                {caseData.problem_rating} av 5
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {getProblemRatingDescription(caseData.problem_rating)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Rekommendationer */}
                {caseData.recommendations && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                        Rekommendationer
                      </h3>
                      
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-4">
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {caseData.recommendations}
                        </p>
                      </div>

                      {/* Bekräftelse */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {caseData.recommendations_acknowledged ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-400" />
                              <span className="text-green-400 text-sm">
                                Bekräftat av kund {new Date(caseData.recommendations_acknowledged_at).toLocaleDateString('sv-SE')}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-5 h-5 text-amber-400" />
                              <span className="text-amber-400 text-sm">
                                Väntar på bekräftelse
                              </span>
                            </>
                          )}
                        </div>

                        {!caseData.recommendations_acknowledged && (
                          <Button
                            onClick={handleAcknowledgeRecommendations}
                            disabled={acknowledgingRecommendations}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {acknowledgingRecommendations ? 'Bekräftar...' : 'Bekräfta rekommendationer'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )}


              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}