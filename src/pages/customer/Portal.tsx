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
  overdue: number
}

export default function CustomerPortal() {
  const { profile } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tasks, setTasks] = useState<ClickUpTask[]>([])
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
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
    const now = Date.now()
    const stats: TaskStats = {
      total: taskList.length,
      open: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0
    }

    taskList.forEach(task => {
      const status = task.status.status.toLowerCase()
      
      // Svenska och engelska statusar
      if (status === 'to do' || status === 'open' || status === 'new' || 
          status === 'ny' || status === 'öppen') {
        stats.open++
      } else if (status === 'in progress' || status === 'doing' || 
                 status === 'bokat' || status === 'pågående' || status === 'schemalagd') {
        stats.inProgress++
      } else if (status === 'complete' || status === 'closed' || status === 'done' || 
                 status === 'klar' || status === 'avslutad') {
        stats.completed++
      }

      // Kontrollera om uppgiften är försenad
      if (task.due_date && parseInt(task.due_date) < now && 
          !status.includes('complete') && !status.includes('klar') && !status.includes('avslutad')) {
        stats.overdue++
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
      case 'complete':
      case 'closed':
      case 'done':
      case 'klar':
      case 'avslutad':
        return 'text-green-500'
      case 'in progress':
      case 'doing':
      case 'pågående':
      case 'bokat':
      case 'schemalagd':
        return 'text-blue-500'
      case 'to do':
      case 'open':
      case 'new':
      case 'ny':
      case 'öppen':
        return 'text-orange-500'
      default:
        return 'text-slate-400'
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Försenade</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {tasksLoading ? '-' : taskStats.overdue}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
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

                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(task.due_date)}
                          </div>
                          {task.assignees.length > 0 && (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {task.assignees[0].username}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTaskId(task.id)}
                            className="text-green-400 hover:text-green-300"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Visa detaljer
                          </Button>
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-300 text-xs"
                          >
                            ClickUp →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}

                  {tasks.length > 5 && (
                    <div className="text-center pt-4">
                      <Button variant="ghost">
                        Visa alla {tasks.length} ärenden
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Företagsinformation */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Företagsinformation</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Building className="w-4 h-4 text-slate-400 mr-3" />
                  <div>
                    <p className="text-white font-medium">{customer.company_name}</p>
                    <p className="text-slate-400">{customer.contract_types.name}</p>
                  </div>
                </div>
                
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 text-slate-400 mr-3" />
                  <span className="text-slate-300">{customer.contact_person}</span>
                </div>

                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 text-slate-400 mr-3" />
                  <span className="text-slate-300">{customer.email}</span>
                </div>

                {customer.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 text-slate-400 mr-3" />
                    <span className="text-slate-300">{customer.phone}</span>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 mr-3" />
                    <span className="text-slate-300">{customer.address}</span>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-white mb-4">Snabblänkar</h3>
              <div className="space-y-2">
                <a
                  href={`https://app.clickup.com/list/${customer.clickup_list_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-green-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-white">Öppna ClickUp</p>
                      <p className="text-xs text-slate-400">Se alla ärenden</p>
                    </div>
                  </div>
                </a>

                <button className="block w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-blue-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-white">Kommande besök</p>
                      <p className="text-xs text-slate-400">Schemalagda datum</p>
                    </div>
                  </div>
                </button>

                <button className="block w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-purple-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-white">Rapporter</p>
                      <p className="text-xs text-slate-400">Tidigare besök</p>
                    </div>
                  </div>
                </button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Modal för ärendedetaljer */}
      {selectedTaskId && (
        <CaseDetailsModal
          caseId="dummy-case-id" // Vi använder ClickUp task ID istället
          clickupTaskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}