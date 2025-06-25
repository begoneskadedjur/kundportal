// src/components/customer/CaseDetailsModal.tsx
import { useEffect, useState } from 'react'
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  DollarSign, 
  FileText, 
  Paperclip,
  AlertCircle 
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'

interface CaseDetailsModalProps {
  caseId: string
  clickupTaskId: string
  isOpen: boolean
  onClose: () => void
}

interface TaskDetails {
  id: string
  name: string
  description: string
  status: string
  statusColor: string
  dateCreated: string
  dateUpdated: string
  dateClosed?: string
  dueDate?: string
  startDate?: string
  assignees: Array<{
    name: string
    email: string
    initials: string
    profilePicture?: string
  }>
  priority?: string
  priorityColor?: string
  customFields: {
    address?: string
    price?: string
    files?: string[]
    report?: string
    [key: string]: any
  }
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
      const response = await fetch(`/api/clickup/task/${clickupTaskId}`)
      
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

  const formatDate = (dateString: string) => {
    return new Date(parseInt(dateString)).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (color: string) => {
    // Konvertera ClickUp färger till Tailwind-klasser
    const colorMap: { [key: string]: string } = {
      '#f9d71c': 'bg-yellow-500',
      '#d3d3d3': 'bg-gray-500',
      '#6bc950': 'bg-green-500',
      '#ff6900': 'bg-orange-500',
      '#e60073': 'bg-pink-500',
      '#8b2635': 'bg-red-700',
    }
    return colorMap[color.toLowerCase()] || 'bg-blue-500'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <Card className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white">
              {taskDetails?.name || 'Laddar...'}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
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
                {/* Status och prioritet */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Status:</span>
                    <span 
                      className={`px-3 py-1 rounded-full text-sm font-medium text-white ${
                        getStatusColor(taskDetails.statusColor)
                      }`}
                    >
                      {taskDetails.status}
                    </span>
                  </div>
                  
                  {taskDetails.priority && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Prioritet:</span>
                      <span 
                        className={`px-3 py-1 rounded-full text-sm font-medium text-white ${
                          getStatusColor(taskDetails.priorityColor || '#6bc950')
                        }`}
                      >
                        {taskDetails.priority}
                      </span>
                    </div>
                  )}
                </div>

                {/* Datum information */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-slate-400">Skapad</p>
                      <p className="text-white font-medium">
                        {formatDate(taskDetails.dateCreated)}
                      </p>
                    </div>
                  </div>

                  {taskDetails.startDate && (
                    <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <Clock className="w-5 h-5 text-green-400" />
                      <div>
                        <p className="text-sm text-slate-400">Startdatum</p>
                        <p className="text-white font-medium">
                          {formatDate(taskDetails.startDate)}
                        </p>
                      </div>
                    </div>
                  )}

                  {taskDetails.dueDate && (
                    <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <Calendar className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-sm text-slate-400">Förfallodatum</p>
                        <p className="text-white font-medium">
                          {formatDate(taskDetails.dueDate)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tilldelade tekniker */}
                {taskDetails.assignees.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Ansvarig tekniker
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {taskDetails.assignees.map((assignee, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                        >
                          {assignee.profilePicture ? (
                            <img 
                              src={assignee.profilePicture}
                              alt={assignee.name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {assignee.initials}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium">{assignee.name}</p>
                            <p className="text-sm text-slate-400">{assignee.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom fields */}
                <div className="space-y-4">
                  {taskDetails.customFields.address && (
                    <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-400">Adress</p>
                        <p className="text-white">{taskDetails.customFields.address}</p>
                      </div>
                    </div>
                  )}

                  {taskDetails.customFields.price && (
                    <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-400">Pris</p>
                        <p className="text-white">{taskDetails.customFields.price}</p>
                      </div>
                    </div>
                  )}

                  {taskDetails.customFields.files && taskDetails.customFields.files.length > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <Paperclip className="w-5 h-5 text-purple-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-400">Filer</p>
                        <div className="space-y-1">
                          {taskDetails.customFields.files.map((file, index) => (
                            <p key={index} className="text-white">{file}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {taskDetails.customFields.report && (
                    <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-400">Rapport</p>
                        <p className="text-white">{taskDetails.customFields.report}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Beskrivning */}
                {taskDetails.description && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Beskrivning</h3>
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                      <p className="text-white whitespace-pre-wrap">
                        {taskDetails.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}