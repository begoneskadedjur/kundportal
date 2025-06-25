// src/components/customer/CaseDetailsModal.tsx - MED PDF-RAPPORT
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
  FileDown // NY IKON
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'
import { generatePDFReport } from '../../utils/pdfReportGenerator'

interface CaseDetailsModalProps {
  caseId: string
  clickupTaskId: string
  isOpen: boolean
  onClose: () => void
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
}

export default function CaseDetailsModal({ 
  caseId, 
  clickupTaskId, 
  isOpen, 
  onClose 
}: CaseDetailsModalProps) {
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && clickupTaskId) {
      fetchTaskDetails()
    }
  }, [isOpen, clickupTaskId])

  const fetchTaskDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Använd din befintliga test-endpoint för att hämta data
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

  // Fallback - returnera värdet som det är
  const getDropdownText = (field: any) => {
    if (!field || !field.has_value) return 'Ej specificerat'
    
    // Försök först med type_config.options från ClickUp
    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      const selectedOption = field.type_config.options.find((option: any) => 
        option.orderindex === field.value
      )
      if (selectedOption) {
        return selectedOption.name
      }
    }
    
    // Fallback - returnera värdet som det är
    return field.value?.toString() || 'Ej specificerat'
  }

  // Enkel PDF-generator som använder den separata modulen
  const handleGeneratePDF = async () => {
    if (!taskDetails) return

    try {
      await generatePDFReport(taskDetails)
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <Card className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {taskDetails?.task_info.name || 'Laddar ärende...'}
              </h2>
              {taskDetails && (
                <p className="text-slate-400 text-sm mt-1">
                  Ärende #{taskDetails.task_id}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* NY: PDF-rapport knapp */}
              {taskDetails && (
                <Button
                  variant="secondary" 
                  size="sm"
                  onClick={handleGeneratePDF}
                  className="flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Ladda ner rapport
                </Button>
              )}
              
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-12 text-red-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            )}

            {taskDetails && (
              <div className="space-y-6">
                {/* Status och datum */}
                <div className="flex items-center justify-between flex-wrap gap-4">
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

                    {/* Pris */}
                    {priceField && priceField.has_value && (
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

                    {/* Ansvarig tekniker - UPPDATERAD MED MAIL-IKON */}
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
                              {/* NY: Mail-ikon */}
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

          {/* Footer - UPPDATERAD MED KONTAKTINFO */}
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