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
  ExternalLink
} from 'lucide-react'

// Mock Button and Card components for demo
const Button = ({ children, variant = 'primary', size = 'md', className = '', onClick, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950'
  const variants = {
    primary: 'bg-green-500 text-slate-950 hover:bg-green-400 focus:ring-green-500',
    secondary: 'glass glass-hover text-white focus:ring-green-500',
    ghost: 'text-slate-300 hover:text-white hover:bg-white/10 focus:ring-slate-500'
  }
  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3'
  }
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

const Card = ({ children, className = '' }) => (
  <div className={`glass rounded-xl p-6 transition-all duration-200 ${className}`}>
    {children}
  </div>
)

const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-slate-700"></div>
      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
    </div>
  </div>
)

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

  // Mock data för demo - ersätt med din riktiga API-call
  const mockData: TaskDetails = {
    "success": true,
    "task_id": "8699j2x52",
    "task_info": {
      "name": "Testärende 1",
      "status": "bokat",
      "description": "Beskrivning av ärendet - raden högst upp.",
      "url": "https://app.clickup.com/t/8699j2x52",
      "created": "1750849048186",
      "updated": "1750850123144"
    },
    "assignees": [
      {
        "name": "Kristian Agnevik",
        "email": "kristian.agnevik@begone.se"
      }
    ],
    "custom_fields": [
      {
        "id": "0a889578-6c38-4fe2-bda4-6258f628bb68",
        "name": "Adress",
        "type": "location",
        "value": {
          "location": {
            "lat": 59.4854017,
            "lng": 17.7479808
          },
          "place_id": "ChIJb3pvJOyjX0YRu_zlQVw3N_M",
          "formatted_address": "Rankhusvägen 32, 196 31 Kungsängen, Sweden"
        },
        "has_value": true
      },
      {
        "id": "748228e8-fc47-4f41-b0f6-fd98e6da98a2",
        "name": "Skadedjur",
        "type": "drop_down",
        "value": 0,
        "has_value": true,
        "type_config": {
          "options": [
            { "id": "6ba02f78-49e5-4298-aad9-c2051551152b", "name": "Råttor", "color": "#AF7E2E", "orderindex": 0 },
            { "id": "1c590bf2-60dd-4494-8805-06ba90f4630f", "name": "Möss", "color": "#800000", "orderindex": 1 },
            { "id": "5f9f1088-d2d7-4111-93ab-a2a3e9bda045", "name": "Vägglöss", "color": "#ff7800", "orderindex": 2 }
          ]
        }
      },
      {
        "id": "cdeffd72-314b-4f6a-9e4b-e8a7610edf73",
        "name": "Pris",
        "type": "currency",
        "value": 2490,
        "has_value": true
      },
      {
        "id": "2817b24d-7b06-4c6b-97b9-6fb39c5b44d6",
        "name": "Rapport",
        "type": "text",
        "value": "Rapportering från tekniker\nUtfört servicebesök enligt avtal. Kontrollerat alla stationer, bytt gift i station 3 och 7. Inga tecken på aktivitet.",
        "has_value": true
      },
      {
        "id": "d6b8929b-3e0a-49be-9525-5fc6b19174c0",
        "name": "Filer",
        "type": "attachment",
        "value": [
          {
            "id": "365d911f-ae82-4ef3-b9e4-6113122e6408.png",
            "title": "Station 3 - Efter behandling.png",
            "extension": "png",
            "mimetype": "image/png",
            "size": 6238021,
            "url_w_query": "https://example.com/image1.png",
            "url_w_host": "https://example.com/image1.png"
          },
          {
            "id": "f1d2d235-e4d7-4b09-8956-867aca07454e.mov",
            "title": "Inspektion_video.mov",
            "extension": "mov",
            "mimetype": "video/quicktime",
            "size": 3353428,
            "url_w_query": "https://example.com/video1.mov",
            "url_w_host": "https://example.com/video1.mov"
          }
        ],
        "has_value": true
      },
      {
        "id": "db610de4-d6e5-467d-9d0c-2fdfacc76c34",
        "name": "Ärende",
        "type": "drop_down",
        "value": 0,
        "has_value": true,
        "type_config": {
          "options": [
            { "id": "0d17f05e-3884-43f6-b000-262acc67a560", "name": "Servicebesök", "color": "#04A9F4", "orderindex": 0 },
            { "id": "a0a6deaa-2cb0-4471-b082-d35d2838e2f5", "name": "Etablering", "color": "#0231E8", "orderindex": 1 }
          ]
        }
      }
    ]
  }

  useEffect(() => {
    if (isOpen && clickupTaskId) {
      fetchTaskDetails()
    }
  }, [isOpen, clickupTaskId])

  const fetchTaskDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // För demo använder vi mock data
      setTimeout(() => {
        setTaskDetails(mockData)
        setLoading(false)
      }, 1000)
      
      // I produktion, använd detta istället:
      // const response = await fetch(`/api/test-clickup?task_id=${clickupTaskId}`)
      // if (!response.ok) throw new Error('Kunde inte hämta ärendedetaljer')
      // const data = await response.json()
      // setTaskDetails(data)
    } catch (error) {
      console.error('Error fetching task details:', error)
      setError('Kunde inte ladda ärendedetaljer')
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

  // Förbättrad dropdown-hantering
  const getDropdownText = (field: any) => {
    if (!field || !field.has_value) return 'Ej specificerat'
    
    // Använd type_config.options för att hitta rätt text
    if (field.type_config?.options && Array.isArray(field.type_config.options)) {
      const selectedOption = field.type_config.options.find((option: any) => 
        option.orderindex === field.value
      )
      if (selectedOption) {
        return {
          text: selectedOption.name,
          color: selectedOption.color
        }
      }
    }
    
    return {
      text: `Okänt val (${field.value})`,
      color: '#64748b'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <Card className="relative h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-white truncate">
                {taskDetails?.task_info.name || 'Laddar ärende...'}
              </h2>
              {taskDetails && (
                <p className="text-slate-400 text-sm mt-2">
                  Ärende #{taskDetails.task_id}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content - scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
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
                    <div>Skapat: {formatDate(taskDetails.task_info.created)}</div>
                    {taskDetails.task_info.updated !== taskDetails.task_info.created && (
                      <div className="mt-1">
                        Uppdaterat: {formatDate(taskDetails.task_info.updated)}
                      </div>
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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Vänster kolumn */}
                  <div className="space-y-4">
                    {/* Adress */}
                    {addressField && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-slate-400 mb-1">Adress</p>
                            <p className="text-white font-medium mb-2">
                              {addressField.value.formatted_address}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const { lat, lng } = addressField.value.location
                                window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank')
                              }}
                              className="text-blue-400 hover:text-blue-300 p-0 h-auto"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Visa på karta
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Skadedjur och ärendetype i grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pestField && (
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Bug className="w-5 h-5 text-orange-400" />
                            <div>
                              <p className="text-sm text-slate-400">Skadedjur</p>
                              <p className="text-white font-medium mt-1">
                                {getDropdownText(pestField).text}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {caseTypeField && (
                        <div className="p-4 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-sm text-slate-400">Typ av ärende</p>
                              <p className="text-white font-medium mt-1">
                                {getDropdownText(caseTypeField).text}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pris */}
                    {priceField && priceField.has_value && (
                      <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-5 h-5 text-green-400" />
                          <div>
                            <p className="text-sm text-slate-400">Kostnad</p>
                            <p className="text-white font-medium text-xl">
                              {priceField.value?.toLocaleString('sv-SE')} kr
                            </p>
                          </div>
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
                              <div>
                                <p className="text-white font-medium">{assignee.name}</p>
                                <p className="text-sm text-slate-400">{assignee.email}</p>
                              </div>
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
                        <div className="space-y-2 max-h-96 overflow-y-auto">
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
                                  {formatFileSize(file.size)} • {file.extension.toUpperCase()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(file.url_w_query, '_blank')}
                                  className="p-2"
                                  title="Förhandsgranska"
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
                                  title="Ladda ner"
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
          <div className="p-6 border-t border-white/10 flex-shrink-0">
            <div className="flex justify-end">
              <Button onClick={onClose}>
                Stäng
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}