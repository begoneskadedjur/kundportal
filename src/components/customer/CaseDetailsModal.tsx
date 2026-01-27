// src/components/customer/CaseDetailsModal.tsx - Med kunduppgifter för PDF
import { useEffect, useState } from 'react'
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  DollarSign,
  FileText,
  Images,
  AlertCircle,
  Bug,
  Download,
  Eye,
  Play,
  Mail,
  Phone,
  FileDown,
  Flag,
  Lightbulb,
  Package,
  Wrench
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import CasePreparationsSection from '../shared/CasePreparationsSection'
import { generatePDFReport } from '../../utils/pdfReportGenerator'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface CaseDetailsModalProps {
  caseId: string
  clickupTaskId: string
  isOpen: boolean
  onClose: () => void
  // Fallback-data när clickupTaskId saknas
  fallbackData?: {
    case_number?: string
    title?: string
    pest_type?: string
    status?: string
    pest_level?: number | null
    problem_rating?: number | null
    price?: number | null
    completed_date?: string
    primary_technician_name?: string
    address?: { formatted_address?: string }
    description?: string
    recommendations?: string | null
    case_type?: 'private' | 'business' | 'contract'
    // Nya fält från cases-tabellen
    work_report?: string
    materials_used?: string
    time_spent_minutes?: number
    service_type?: string
    priority?: string
    work_started_at?: string
    // Filer/foton
    files?: Array<{
      name: string
      url: string
      type: string
      size: number
      uploaded_at: string
    }> | null
  }
}

interface TaskDetails {
  success: boolean
  task_id: string
  task_info: {
    name: string
    status: string
    description: string
    url: string
    created: string
    updated: string
  }
  assignees: Array<{
    name: string
    email: string
  }>
  custom_fields: Array<{
    id: string
    name: string
    type: string
    value: any
    has_value: boolean
    type_config?: {
      options?: Array<{
        id: string
        name: string
        color: string
        orderindex: number
      }>
    }
  }>
  priority?: {
    priority: string
    color: string
  }
}

interface CustomerInfo {
  company_name: string
  org_number: string
  contact_person: string
}

export default function CaseDetailsModal({
  caseId,
  clickupTaskId,
  isOpen,
  onClose,
  fallbackData
}: CaseDetailsModalProps) {
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const { profile } = useAuth()

  useEffect(() => {
    if (isOpen) {
      // Om vi har clickupTaskId, försök hämta från ClickUp
      if (clickupTaskId) {
        setUseFallback(false)
        fetchTaskDetails()
        fetchCustomerInfo()
      } else if (fallbackData) {
        // Använd fallback-data från cases-tabellen
        setUseFallback(true)
        setLoading(false)
        fetchCustomerInfo()
      } else {
        // Varken ClickUp-ID eller fallback - visa felmeddelande
        setUseFallback(true)
        setError('Ärendedetaljer saknas')
        setLoading(false)
      }
    }
  }, [isOpen, clickupTaskId, fallbackData])

  const fetchTaskDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/test-clickup?task_id=${clickupTaskId}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta ärendedetaljer')
      }
      
      const data = await response.json()
      setTaskDetails(data)
    } catch (error) {
      console.error('Error fetching task details:', error)
      setError('Kunde inte ladda ärendedetaljer')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerInfo = async () => {
    if (!profile?.customer_id) return

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('company_name, org_number, contact_person')
        .eq('id', profile.customer_id)
        .single()

      if (error) {
        console.error('Error fetching customer info:', error)
        return
      }

      setCustomerInfo(data)
    } catch (error) {
      console.error('Error fetching customer info:', error)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'bokat': 'bg-blue-500',
      'pågående': 'bg-yellow-500',
      'avslutad': 'bg-green-500',
      'försenad': 'bg-red-500',
      'pausad': 'bg-gray-500',
    }
    return statusColors[status.toLowerCase()] || 'bg-blue-500'
  }

  const getPriorityDisplay = (priority: string | null) => {
    if (!priority) return null
    
    const priorityLower = priority.toLowerCase()
    
    // Prioritetskonfiguration med ClickUps färger
    const config = {
      'urgent': { 
        text: 'Akut', 
        color: '#f87171',
        flagColor: 'text-red-500',
        borderColor: 'border-red-500/50',
        textColor: 'text-red-400'
      },
      'high': { 
        text: 'Hög', 
        color: '#fb923c',
        flagColor: 'text-orange-500',
        borderColor: 'border-orange-500/50',
        textColor: 'text-orange-400'
      },
      'normal': { 
        text: 'Normal', 
        color: '#60a5fa',
        flagColor: 'text-blue-500',
        borderColor: 'border-blue-500/50',
        textColor: 'text-blue-400'
      },
      'low': { 
        text: 'Låg', 
        color: '#9ca3af',
        flagColor: 'text-gray-500',
        borderColor: 'border-gray-500/50',
        textColor: 'text-gray-400'
      }
    }
    
    const priorityConfig = config[priorityLower] || config['normal']
    
    return (
      <span 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${priorityConfig.borderColor} ${priorityConfig.textColor} bg-transparent`}
      >
        <Flag className={`w-3 h-3 ${priorityConfig.flagColor}`} fill="currentColor" />
        <span>{priorityConfig.text}</span>
      </span>
    )
  }

  const getFieldValue = (fieldName: string) => {
    return taskDetails?.custom_fields.find(field => 
      field.name.toLowerCase() === fieldName.toLowerCase() && field.has_value
    )
  }

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Images className="w-4 h-4" />
    if (mimetype.startsWith('video/')) return <Play className="w-4 h-4" />
    return <FileText className="w-4 h-4" />
  }

  const getDropdownText = (field: any) => {
    if (!field || !field.has_value) return 'Ej specificerat'
    
    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      const selectedOption = field.type_config.options.find((option: any) => 
        option.orderindex === field.value
      )
      if (selectedOption) {
        return selectedOption.name
      }
    }
    
    return field.value?.toString() || 'Ej specificerat'
  }

  // Uppdaterad PDF-generator som inkluderar kunduppgifter
  const handleGeneratePDF = async () => {
    if (!taskDetails) return

    try {
      await generatePDFReport(taskDetails, customerInfo || undefined)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Kunde inte generera PDF-rapport')
    }
  }

  if (!isOpen) return null

  // Hämta alla custom fields
  const addressField = getFieldValue('adress')
  const pestField = getFieldValue('skadedjur')
  const priceField = getFieldValue('pris')
  const reportField = getFieldValue('rapport')
  const filesField = getFieldValue('filer')
  const caseTypeField = getFieldValue('ärende')

  // Avgör vad som ska visas i header
  const displayTitle = useFallback
    ? (fallbackData?.title || 'Ärendedetaljer')
    : (taskDetails?.task_info.name || 'Laddar ärende...')

  const displayCaseNumber = useFallback
    ? fallbackData?.case_number
    : taskDetails?.task_id

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <Card className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {displayTitle}
              </h2>
              {displayCaseNumber && (
                <p className="text-slate-400 text-sm mt-1">
                  Ärende #{displayCaseNumber}
                </p>
              )}
              {/* Visa kundinfo i header om tillgänglig */}
              {customerInfo && (
                <p className="text-slate-300 text-sm mt-1">
                  {customerInfo.company_name} • {customerInfo.org_number}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* PDF-rapport knapp med förbättrad loading state */}
              {taskDetails && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGeneratePDF}
                  className="flex items-center gap-2"
                  disabled={loading}
                >
                  <FileDown className="w-4 h-4" />
                  {loading ? 'Genererar...' : 'Ladda ner rapport'}
                </Button>
              )}

              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content - resten av koden förblir densamma */}
          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {error && !useFallback && (
              <div className="flex items-center justify-center py-12 text-red-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {/* Fallback-vy när ClickUp-data saknas */}
            {useFallback && fallbackData && !error && (
              <div className="space-y-6">
                {/* Status och datum */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    {fallbackData.status && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Status:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(fallbackData.status)}`}>
                          {fallbackData.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Tjänstetyp */}
                    {fallbackData.service_type && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        fallbackData.service_type === 'inspection'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {fallbackData.service_type === 'inspection' ? 'Inspektion' : 'Rutinbesök'}
                      </span>
                    )}
                  </div>

                  {fallbackData.completed_date && (
                    <div className="text-sm text-slate-400">
                      Slutfört: {new Date(fallbackData.completed_date).toLocaleDateString('sv-SE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                </div>

                {/* Beskrivning */}
                {fallbackData.description && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Beskrivning</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <p className="text-white whitespace-pre-wrap">{fallbackData.description}</p>
                    </div>
                  </div>
                )}

                {/* Grid med information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vänster kolumn */}
                  <div className="space-y-4">
                    {/* Adress */}
                    {fallbackData.address?.formatted_address && (
                      <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-400 mb-1">Adress</p>
                          <p className="text-white font-medium">{fallbackData.address.formatted_address}</p>
                        </div>
                      </div>
                    )}

                    {/* Skadedjur */}
                    {fallbackData.pest_type && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <Bug className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-sm text-slate-400">Skadedjur</p>
                          <p className="text-white font-medium">{fallbackData.pest_type}</p>
                        </div>
                      </div>
                    )}

                    {/* Aktivitetsnivå */}
                    {fallbackData.pest_level !== null && fallbackData.pest_level !== undefined && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <AlertCircle className={`w-5 h-5 ${
                          fallbackData.pest_level >= 3 ? 'text-red-400' :
                          fallbackData.pest_level >= 2 ? 'text-amber-400' : 'text-emerald-400'
                        }`} />
                        <div>
                          <p className="text-sm text-slate-400">Aktivitetsnivå</p>
                          <p className={`font-medium ${
                            fallbackData.pest_level >= 3 ? 'text-red-400' :
                            fallbackData.pest_level >= 2 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {fallbackData.pest_level === 0 ? 'Ingen' :
                             fallbackData.pest_level === 1 ? 'Låg' :
                             fallbackData.pest_level === 2 ? 'Medium' : 'Hög'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Situationsbedömning */}
                    {fallbackData.problem_rating !== null && fallbackData.problem_rating !== undefined && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <Flag className={`w-5 h-5 ${
                          fallbackData.problem_rating >= 4 ? 'text-red-400' :
                          fallbackData.problem_rating >= 3 ? 'text-amber-400' : 'text-emerald-400'
                        }`} />
                        <div>
                          <p className="text-sm text-slate-400">Situationsbedömning</p>
                          <p className={`font-medium ${
                            fallbackData.problem_rating >= 4 ? 'text-red-400' :
                            fallbackData.problem_rating >= 3 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {fallbackData.problem_rating === 1 ? 'Utmärkt' :
                             fallbackData.problem_rating === 2 ? 'Bra' :
                             fallbackData.problem_rating === 3 ? 'Acceptabel' :
                             fallbackData.problem_rating === 4 ? 'Problem' : 'Kritisk'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pris */}
                    {fallbackData.price && fallbackData.price > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-sm text-slate-400">Kostnad</p>
                          <p className="text-white font-medium text-xl">{fallbackData.price} kr</p>
                        </div>
                      </div>
                    )}

                    {/* Tekniker */}
                    {fallbackData.primary_technician_name && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <User className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-sm text-slate-400">Ansvarig tekniker</p>
                          <p className="text-white font-medium">{fallbackData.primary_technician_name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Höger kolumn */}
                  <div className="space-y-4">
                    {/* Arbetsrapport */}
                    {fallbackData.work_report && fallbackData.work_report.trim() !== '' && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-blue-400" />
                          Arbetsrapport
                        </h4>
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <p className="text-white whitespace-pre-wrap">{fallbackData.work_report}</p>
                        </div>
                      </div>
                    )}

                    {/* Material använt */}
                    {fallbackData.materials_used && fallbackData.materials_used.trim() !== '' && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <Package className="w-5 h-5 text-purple-400" />
                        <div>
                          <p className="text-sm text-slate-400">Material använt</p>
                          <p className="text-white font-medium">{fallbackData.materials_used}</p>
                        </div>
                      </div>
                    )}

                    {/* Tid spenderad */}
                    {fallbackData.time_spent_minutes !== undefined && fallbackData.time_spent_minutes > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <Clock className="w-5 h-5 text-cyan-400" />
                        <div>
                          <p className="text-sm text-slate-400">Tid spenderad</p>
                          <p className="text-white font-medium">
                            {Math.floor(fallbackData.time_spent_minutes / 60) > 0
                              ? `${Math.floor(fallbackData.time_spent_minutes / 60)}h ${fallbackData.time_spent_minutes % 60}min`
                              : `${fallbackData.time_spent_minutes} min`
                            }
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Rekommendationer */}
                    {fallbackData.recommendations && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          Rekommenderade åtgärder
                        </h4>
                        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg">
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {fallbackData.recommendations}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Filer och bilder */}
                    {fallbackData.files && fallbackData.files.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Images className="w-4 h-4 text-indigo-400" />
                          Bilder & Filer ({fallbackData.files.length})
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {fallbackData.files.map((file, index) => {
                            const isImage = file.type.startsWith('image/')
                            return (
                              <div
                                key={index}
                                className="relative group rounded-lg overflow-hidden bg-slate-800/50 border border-slate-700"
                              >
                                {isImage ? (
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="w-full h-24 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-24 flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-slate-400" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-white/20 rounded-full hover:bg-white/30"
                                  >
                                    <Eye className="w-4 h-4 text-white" />
                                  </a>
                                  <a
                                    href={file.url}
                                    download={file.name}
                                    className="p-2 bg-white/20 rounded-full hover:bg-white/30"
                                  >
                                    <Download className="w-4 h-4 text-white" />
                                  </a>
                                </div>
                                <p className="text-xs text-slate-400 p-2 truncate">{file.name}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {taskDetails && (
              <div className="space-y-6">
                {/* Status, prioritet och datum */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Status:</span>
                      <span 
                        className={`px-3 py-1 rounded-full text-sm font-medium text-white ${
                          getStatusColor(taskDetails.task_info.status)
                        }`}
                      >
                        {taskDetails.task_info.status.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* PRIORITET TILL HÖGER OM STATUS */}
                    {taskDetails.priority && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Prioritet:</span>
                        {getPriorityDisplay(taskDetails.priority.priority)}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-slate-400">
                    Skapat: {formatDate(taskDetails.task_info.created)}
                    {taskDetails.task_info.updated !== taskDetails.task_info.created && (
                      <span className="ml-4">
                        Uppdaterat: {formatDate(taskDetails.task_info.updated)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Beskrivning */}
                {taskDetails.task_info.description && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Beskrivning</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <p className="text-white whitespace-pre-wrap">
                        {taskDetails.task_info.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid med information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vänster kolumn */}
                  <div className="space-y-4">
                    {/* Adress */}
                    {addressField && (
                      <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-400 mb-1">Adress</p>
                          <p className="text-white font-medium">
                            {addressField.value.formatted_address}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2 text-blue-400 hover:text-blue-300 p-0"
                            onClick={() => {
                              const { lat, lng } = addressField.value.location
                              window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank')
                            }}
                          >
                            Visa på karta
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Skadedjur och ärendetype */}
                    <div className="grid grid-cols-1 gap-4">
                      {pestField && (
                        <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                          <Bug className="w-5 h-5 text-orange-400" />
                          <div>
                            <p className="text-sm text-slate-400">Skadedjur</p>
                            <p className="text-white font-medium">
                              {getDropdownText(pestField)}
                            </p>
                          </div>
                        </div>
                      )}

                      {caseTypeField && (
                        <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="text-sm text-slate-400">Typ av ärende</p>
                            <p className="text-white font-medium">
                              {getDropdownText(caseTypeField)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pris - Only show if price > 0 */}
                    {priceField && priceField.has_value && priceField.value > 0 && (
                      <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-sm text-slate-400">Kostnad</p>
                          <p className="text-white font-medium text-xl">
                            {priceField.value} kr
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Ansvarig tekniker */}
                    {taskDetails.assignees.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Ansvarig tekniker
                        </h4>
                        <div className="space-y-2">
                          {taskDetails.assignees.map((assignee, index) => (
                            <div 
                              key={index}
                              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                            >
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                {assignee.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div className="flex-1">
                                <p className="text-white font-medium">{assignee.name}</p>
                                <p className="text-sm text-slate-400">{assignee.email}</p>
                              </div>
                              <button
                                onClick={() => window.open(`mailto:${assignee.email}?subject=Fråga om ärende ${taskDetails.task_info.name}`, '_blank')}
                                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                title={`Skicka e-post till ${assignee.name}`}
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Höger kolumn */}
                  <div className="space-y-4">
                    {/* Teknikerrapport */}
                    {reportField && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Teknikerrapport
                        </h4>
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <p className="text-white whitespace-pre-wrap">
                            {reportField.value}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Rekommendationer från tekniker - endast för avtalsärenden */}
                    {fallbackData?.recommendations && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          Rekommenderade åtgärder
                        </h4>
                        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
                              <AlertCircle className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex-1">
                              <h5 className="text-white font-medium mb-2">Våra rekommendationer för dig</h5>
                              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {fallbackData.recommendations}
                              </p>

                              {/* Call-to-action */}
                              <div className="mt-4 pt-3 border-t border-amber-500/20">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-amber-300">
                                    Har du frågor om dessa rekommendationer?
                                  </p>
                                  <button
                                    onClick={() => window.open('tel:010-280-44-10', '_self')}
                                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-300 hover:text-amber-200 transition-colors text-sm font-medium"
                                  >
                                    Ring oss
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Använda preparat - endast läsläge för kunder */}
                    {caseId && fallbackData?.pest_type !== 'Inspektion' && (
                      <CasePreparationsSection
                        caseId={caseId}
                        caseType="contract"
                        pestType={fallbackData?.pest_type || null}
                        isReadOnly={true}
                      />
                    )}

                    {/* Filer och bilder */}
                    {filesField && filesField.value && Array.isArray(filesField.value) && (
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-white flex items-center gap-2">
                          <Images className="w-4 h-4" />
                          Filer ({filesField.value.length})
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {filesField.value.map((file: any, index: number) => (
                            <div 
                              key={file.id} 
                              className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors"
                            >
                              <div className="text-slate-400">
                                {getFileIcon(file.mimetype)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">
                                  {file.title}
                                </p>
                                <p className="text-slate-400 text-sm">
                                  {(file.size / 1024 / 1024).toFixed(1)} MB • {file.extension.toUpperCase()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(file.url_w_query, '_blank')}
                                  className="p-2"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = file.url_w_host
                                    link.download = file.title
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                  }}
                                  className="p-2"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Phone className="w-4 h-4" />
                <span>Har du frågor? Ring oss på <a href="tel:010-280-44-10" className="text-blue-400 hover:text-blue-300">010 280 44 10</a></span>
              </div>
              
              <Button
                variant="secondary"
                onClick={onClose}
                className="px-6"
              >
                Stäng
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}