// src/pages/customer/Portal.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  FileText, 
  Calendar, 
  Clock, 
  MapPin, 
  Bug, 
  CheckCircle, 
  AlertCircle, 
  User,
  Building,
  Phone,
  Mail,
  RotateCcw,
  Eye
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import CaseDetailsModal from '../../components/customer/CaseDetailsModal'

// Types
type Customer = {
  id: string
  company_name: string
  contact_person: string
  email: string
  phone: string
  address: string
  clickup_list_id: string
  clickup_list_name: string
  contract_types: {
    name: string
  }
}

type ClickUpTask = {
  id: string
  name: string
  description: string
  status: {
    status: string
    color: string
  }
  priority: {
    priority: string
    color: string
  } | null
  due_date: string | null
  date_created: string
  assignees: Array<{
    id: string
    username: string
    email: string
  }>
  custom_fields: Array<{
    id: string
    name: string
    value: any
  }>
  url: string
}

type TaskStats = {
  total: number
  open: number
  inProgress: number
  completed: number
}

export default function CustomerPortal() {
  const { profile } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tasks, setTasks] = useState<ClickUpTask[]>([])
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0
  })
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Hämta kunddata
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCustomerData()
    }
  }, [profile])

  // Hämta ClickUp-uppgifter när kunddata är hämtad
  useEffect(() => {
    if (customer?.clickup_list_id) {
      fetchClickUpTasks()
    }
  }, [customer])

  const fetchCustomerData = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          contract_types (
            name
          )
        `)
        .eq('id', profile!.customer_id)
        .single()

      if (error) throw error
      setCustomer(data)
    } catch (error: any) {
      console.error('Error fetching customer:', error)
      setError('Kunde inte hämta kunddata')
    } finally {
      setLoading(false)
    }
  }

  const fetchClickUpTasks = async () => {
    if (!customer?.clickup_list_id) return

    setTasksLoading(true)
    setError(null) // Rensa tidigare fel
    
    try {
      console.log('Fetching tasks for list:', customer.clickup_list_id)
      
      // Använd vår backend API för att hämta ClickUp-uppgifter
      const response = await fetch(`/api/clickup-tasks?list_id=${customer.clickup_list_id}`)
      
      console.log('ClickUp API response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('ClickUp API error:', errorData)
        throw new Error(errorData.error || 'Kunde inte hämta ärenden från ClickUp')
      }

      const data = await response.json()
      console.log('ClickUp API data:', data)
      
      setTasks(data.tasks || [])
      calculateTaskStats(data.tasks || [])
      
      // Visa debug-info om det finns
      if (data.debug) {
        console.log('ClickUp Debug info:', data.debug)
      }
      
    } catch (error: any) {
      console.error('Error fetching ClickUp tasks:', error)
      setError(`ClickUp integration fel: ${error.message}`)
    } finally {
      setTasksLoading(false)
    }
  }

  const calculateTaskStats = (taskList: ClickUpTask[]) => {
    const stats: TaskStats = {
      total: taskList.length,
      open: 0,
      inProgress: 0,
      completed: 0
    }

    taskList.forEach(task => {
      const status = task.status.status.toLowerCase()
      
      // Avslutade ärenden: endast "genomförd"
      if (status === 'genomförd') {
        stats.completed++
      }
      // Pågående ärenden: "bokat" eller "under hantering"
      else if (status === 'bokat' || status === 'under hantering') {
        stats.inProgress++
      }
      // Öppna ärenden: allt annat
      else {
        stats.open++
      }
    })

    setTaskStats(stats)
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'Inget datum satt'
    return new Date(parseInt(timestamp)).toLocaleDateString('sv-SE')
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'text-red-500'
      case 'high': return 'text-orange-500'
      case 'normal': return 'text-yellow-500'
      case 'low': return 'text-green-500'
      default: return 'text-slate-400'
    }
  }

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'genomförd':
        return 'text-green-500'
      case 'bokat':
      case 'under hantering':
        return 'text-blue-500'
      default:
        return 'text-orange-500' // Öppna/nya ärenden
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Ett fel uppstod</h2>
          <p className="text-slate-400 mb-4">{error || 'Kunde inte hämta kunddata'}</p>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center relative">
                <Bug className="w-6 h-6 text-slate-950" />
                <div className="absolute inset-0 rounded-full border-2 border-red-500 transform rotate-45"></div>
                <div className="absolute w-full h-0.5 bg-red-500 top-1/2 transform -translate-y-1/2 rotate-45"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  <span className="text-gradient">BeGone</span> Kundportal
                </h1>
                <p className="text-sm text-slate-400">{customer.company_name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{customer.contact_person}</p>
                <p className="text-xs text-slate-400">{customer.contract_types.name}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Välkommen, {customer.contact_person}!
          </h2>
          <p className="text-slate-400">
            Här kan du följa alla era ärenden och se status på pågående uppdrag.
          </p>
        </div>

        {/* Stats Grid - Uppdaterad med 3 kort */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt antal ärenden</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {tasksLoading ? '-' : taskStats.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Pågående</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {tasksLoading ? '-' : taskStats.inProgress}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avslutade</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {tasksLoading ? '-' : taskStats.completed}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Ärenden */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Aktuella ärenden</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchClickUpTasks}
                  loading={tasksLoading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Uppdatera
                </Button>
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-400 font-medium mb-2">ClickUp Integration Problem</p>
                  <p className="text-slate-400 text-sm mb-4">{error}</p>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Debug info:</p>
                    <p className="text-xs text-slate-500">List ID: {customer.clickup_list_id}</p>
                    <p className="text-xs text-slate-500">List Name: {customer.clickup_list_name}</p>
                  </div>
                  <Button 
                    onClick={fetchClickUpTasks} 
                    variant="secondary" 
                    size="sm"
                    className="mt-4"
                  >
                    Försök igen
                  </Button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Inga ärenden finns ännu</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Nya ärenden kommer att visas här när de skapas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-1">{task.name}</h4>
                          {task.description && (
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {task.description.replace(/<[^>]*>/g, '')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status.status)}`}>
                            {task.status.status}
                          </span>
                          {task.priority && (
                            <span className={`text-xs ${getPriorityColor(task.priority.priority)}`}>
                              {task.priority.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            <span>Skapad: {formatDate(task.date_created)}</span>
                          </div>
                          {task.due_date && (
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              <span>Deadline: {formatDate(task.due_date)}</span>
                            </div>
                          )}
                          {task.assignees.length > 0 && (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              <span>{task.assignees[0].username}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visa detaljer
                        </Button>
                      </div>
                    </div>
                  ))}

                  {tasks.length > 5 && (
                    <div className="text-center pt-4">
                      <Button variant="secondary" size="sm">
                        Visa alla {tasks.length} ärenden
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Företagsinformation */}
          <div>
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Företagsinformation</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-slate-300">{customer.company_name}</span>
                </div>
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-slate-300">{customer.contact_person}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-slate-300">{customer.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-slate-300">{customer.phone}</span>
                </div>
                <div className="flex items-start text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">{customer.address}</span>
                </div>
              </div>
            </Card>

            {/* Snabblänkar */}
            <Card className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Snabblänkar</h3>
              <div className="space-y-2">
                <Button 
                  variant="ghost" 
                  fullWidth 
                  className="justify-start"
                  onClick={() => window.open('https://app.clickup.com', '_blank')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Öppna ClickUp
                  <span className="text-xs text-slate-500 ml-auto">Se alla ärenden</span>
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth 
                  className="justify-start opacity-50"
                  disabled
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Kommande besök
                  <span className="text-xs text-slate-500 ml-auto">Schemalagda datum</span>
                </Button>
                <Button 
                  variant="ghost" 
                  fullWidth 
                  className="justify-start opacity-50"
                  disabled
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Rapporter
                  <span className="text-xs text-slate-500 ml-auto">Tidigare besök</span>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Case Details Modal */}
      {selectedTaskId && (
        <CaseDetailsModal
          caseId=""
          clickupTaskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}