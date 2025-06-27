// src/pages/customer/Portal.tsx - SIMPLIFIED AND STABILIZED VERSION
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
  Eye,
  Search,
  Plus,
  Flag,
  Settings
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import CaseDetailsModal from '../../components/customer/CaseDetailsModal'
import CreateCaseModal from '../../components/customer/CreateCaseModal'
import CustomerSettingsModal from '../../components/customer/CustomerSettingsModal'

// Types - UPPDATERAD med org_number
type Customer = {
  id: string
  company_name: string
  org_number: string | null  // TILLAGD
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

type Visit = {
  id: string
  case_id: string
  visit_date: string
  technician_name: string | null
  work_performed: string | null
  status: string | null
  created_at: string
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
  const [visits, setVisits] = useState<Visit[]>([])
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all') // all, last30, last90, thisYear, lastYear
  const [statusFilter, setStatusFilter] = useState('all') // all, genomfört, bokat, under_hantering
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0
  })
  // const [loading, setLoading] = useState(true) // <-- BORTTAGEN. ProtectedRoute hanterar detta.
  const [tasksLoading, setTasksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Hämta kunddata
  useEffect(() => {
    // Endast kör om vi har ett giltigt profil-objekt med ett customer_id
    if (profile && profile.customer_id) {
      fetchCustomerData();
    } else if (profile && !profile.customer_id) {
      // Om profilen laddats men saknar customer_id, sätt ett fel.
      setError("Användarprofilen är inte kopplad till en kund.");
    }
  }, [profile]); // Lyssna på när profil-objektet blir tillgängligt.

  // Hämta ClickUp-uppgifter och kommande besök när kunddata är hämtad
  useEffect(() => {
    if (customer?.clickup_list_id) {
      fetchClickUpTasks()
      fetchUpcomingVisits()
    }
  }, [customer])

  const fetchCustomerData = async () => {
    // Inget setLoading(true) behövs här
    try {
      if (!profile?.customer_id) return; // Dubbelkolla för säkerhets skull

      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          contract_types (
            name
          )
        `)
        .eq('id', profile.customer_id)
        .single()

      if (error) throw error
      
      console.log('Customer data fetched:', data) // Debug log för att se alla fält
      setCustomer(data)
    } catch (error: any) {
      console.error('Error fetching customer:', error)
      setError('Kunde inte hämta kunddata')
    } 
    // INGET finally { setLoading(false) } behövs här.
  }

  const fetchUpcomingVisits = async () => {
    if (!customer?.clickup_list_id) return

    try {
      console.log('Fetching upcoming visits from ClickUp API...')
      
      const response = await fetch(`/api/clickup-tasks?list_id=${customer.clickup_list_id}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta ärenden från ClickUp')
      }

      const data = await response.json()
      const allTasks = data.tasks || []
      
      const now = new Date()
      const upcomingTasks = allTasks.filter((task: ClickUpTask) => {
        if (!task.due_date) return false
        
        const dueDate = new Date(parseInt(task.due_date))
        return dueDate >= now
      })
      
      const upcomingVisits = upcomingTasks
        .map((task: ClickUpTask) => {
          const getCustomField = (name: string) => {
            return task.custom_fields?.find((field: any) => 
              field.name.toLowerCase() === name.toLowerCase()
            )
          }
          
          const addressField = getCustomField('adress')
          const caseTypeField = getCustomField('ärende')
          const pestField = getCustomField('skadedjur')
          
          const getDropdownText = (field: any) => {
            if (!field?.has_value) return null
            if (field.type_config?.options) {
              const option = field.type_config.options.find((opt: any) => 
                opt.orderindex === field.value
              )
              return option?.name || field.value?.toString()
            }
            return field.value?.toString()
          }
          
          return {
            id: task.id,
            case_id: task.id,
            visit_date: new Date(parseInt(task.due_date!)).toISOString(),
            technician_name: task.assignees.length > 0 ? task.assignees[0].username : null,
            work_performed: [
              getDropdownText(caseTypeField),
              getDropdownText(pestField),
              task.name
            ].filter(Boolean).join(' - '),
            status: task.status.status,
            created_at: task.date_created,
            address: addressField?.value?.formatted_address || null,
            clickup_url: `https://app.clickup.com/t/${task.id}`
          }
        })
        .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
        .slice(0, 5)
      
      setVisits(upcomingVisits)
      console.log(`✅ Found ${upcomingVisits.length} upcoming visits`)
      
    } catch (error) {
      console.error('Error fetching upcoming visits:', error)
    }
  }

  const fetchClickUpTasks = async () => {
    if (!customer?.clickup_list_id) return

    setTasksLoading(true)
    setError(null)
    
    try {
      console.log('Fetching tasks for list:', customer.clickup_list_id)
      
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.assignees.length > 0 && task.assignees[0].username.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!matchesSearch) return false
    
    if (statusFilter !== 'all') {
      const taskStatus = task.status.status.toLowerCase()
      switch (statusFilter) {
        case 'genomfört':
          if (!(taskStatus === 'genomfört' || taskStatus === 'genomförd' || taskStatus === 'avslutad' || taskStatus === 'klar' || taskStatus === 'complete')) {
            return false
          }
          break
        case 'bokat':
          if (taskStatus !== 'bokat') return false
          break
        case 'under_hantering':
          if (taskStatus !== 'under hantering') return false
          break
      }
    }
    
    if (dateFilter !== 'all') {
      if (!task.due_date) return true
      
      const taskDate = new Date(parseInt(task.due_date))
      const now = new Date()
      
      switch (dateFilter) {
        case 'last30':
          const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (taskDate < last30Days) return false
          break
        case 'last90':
          const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          if (taskDate < last90Days) return false
          break
        case 'thisYear':
          if (taskDate.getFullYear() !== now.getFullYear()) return false
          break
        case 'lastYear':
          if (taskDate.getFullYear() !== now.getFullYear() - 1) return false
          break
      }
    }
    
    return true
  })

  const calculateTaskStats = (taskList: ClickUpTask[]) => {
    const stats: TaskStats = {
      total: taskList.length,
      open: 0,
      inProgress: 0,
      completed: 0
    }

    taskList.forEach(task => {
      const status = task.status.status.toLowerCase()
      
      if (status === 'genomfört' || status === 'genomförd' || status === 'avslutad' || status === 'klar' || status === 'complete') {
        stats.completed++
      }
      else if (status === 'bokat' || status === 'under hantering') {
        stats.inProgress++
      }
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

  const getPriorityDisplay = (priority: string | null) => {
    if (!priority) return null
    
    const priorityLower = priority.toLowerCase()
    
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

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'genomfört':
      case 'genomförd':
      case 'avslutad':
      case 'klar':
      case 'complete':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'bokat':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'under hantering':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default:
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    }
  }

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  const getDateFilterText = (filter: string) => {
    switch (filter) {
      case 'last30': return 'Senaste 30 dagarna'
      case 'last90': return 'Senaste 3 månaderna'
      case 'thisYear': return `I år (${new Date().getFullYear()})`
      case 'lastYear': return `Förra året (${new Date().getFullYear() - 1})`
      default: return 'Alla datum'
    }
  }

  const getStatusFilterText = (filter: string) => {
    switch (filter) {
      case 'genomfört': return 'Avslutade'
      case 'bokat': return 'Bokade'
      case 'under_hantering': return 'Pågående'
      default: return 'Alla statusar'
    }
  }

  // Denna kontroll hanterar nu fallet där data ännu inte har laddats.
  // Om antingen ett fel har inträffat ELLER kunddata inte finns, visa felmeddelande.
  // Detta fångar upp både nätverksfel och fallet där `profile` inte leder till en kund.
  if (error || !customer) {
    // Om inget fel har satts men customer saknas, visa ett standardmeddelande.
    const errorMessage = error || "Hämtar kundinformation...";
    
    // Undvik att visa felmeddelandet om det bara är den initiala laddningen.
    // Vi vet att laddningen är klar om `profile` finns (men customer inte gör det).
    if (profile && !customer) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Card className="text-center p-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Ett fel uppstod</h2>
            <p className="text-slate-400 mb-4">{error || 'Kunde inte hämta kunddata.'}</p>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Försök igen
            </Button>
          </Card>
        </div>
      )
    }
    // Om `profile` inte finns än, betyder det att ProtectedRoute fortfarande kör,
    // så vi visar ingenting (eftersom ProtectedRoute visar sin spinner).
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">
                BeGone Skadedjur Kundportal
              </h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-700">
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span className="text-white font-medium">{customer.company_name}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600"></div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">{customer.contact_person}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600"></div>
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">{customer.contract_types.name}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Välkommen, {customer.contact_person}!
          </h2>
          <p className="text-slate-400">
            Här kan du följa alla era ärenden och se status på pågående uppdrag.
          </p>
        </div>

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
          <div className="lg:col-span-2">
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
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

                <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-slate-300">Period (deadline):</label>
                    <select 
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500 min-w-[160px]"
                    >
                      <option value="all">Alla datum</option>
                      <option value="last30">Senaste 30 dagarna</option>
                      <option value="last90">Senaste 3 månaderna</option>
                      <option value="thisYear">I år ({new Date().getFullYear()})</option>
                      <option value="lastYear">Förra året ({new Date().getFullYear() - 1})</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-slate-300">Status:</label>
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500 min-w-[140px]"
                    >
                      <option value="all">Alla statusar</option>
                      <option value="genomfört">Avslutade</option>
                      <option value="bokat">Bokade</option>
                      <option value="under_hantering">Pågående</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2 flex-1">
                    <label className="text-sm text-slate-300">Sök:</label>
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Sök ärenden..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-green-500 w-full"
                      />
                    </div>
                  </div>

                  {(searchQuery || dateFilter !== 'all' || statusFilter !== 'all') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSearchQuery('')
                        setDateFilter('all')
                        setStatusFilter('all')
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      Rensa filter
                    </Button>
                  )}
                </div>
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
              ) : filteredTasks.length === 0 && (searchQuery || dateFilter !== 'all' || statusFilter !== 'all') ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">Inga ärenden matchar dina filter</p>
                  <div className="text-sm text-slate-500 space-y-1">
                    {searchQuery && <p>Sökning: "{searchQuery}"</p>}
                    {dateFilter !== 'all' && <p>Period: {getDateFilterText(dateFilter)}</p>}
                    {statusFilter !== 'all' && <p>Status: {getStatusFilterText(statusFilter)}</p>}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSearchQuery('')
                      setDateFilter('all')
                      setStatusFilter('all')
                    }}
                    className="mt-3"
                  >
                    Rensa filter
                  </Button>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Inga ärenden finns ännu</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Nya ärenden kommer att visas här när de skapas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(showAllTasks ? filteredTasks : filteredTasks.slice(0, 5)).map((task) => (
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
                        <div className="flex items-center space-x-4 ml-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">Status:</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status.status)}`}>
                              {capitalizeFirst(task.status.status)}
                            </span>
                          </div>
                          {task.priority && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400">Prioritet:</span>
                              {getPriorityDisplay(task.priority.priority)}
                            </div>
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

                  {filteredTasks.length > 5 && (
                    <div className="text-center pt-4">
                      <Button 
                        variant="secondary" 
                        size="sm"
                        onClick={() => setShowAllTasks(!showAllTasks)}
                      >
                        {showAllTasks ? 'Visa färre ärenden' : `Visa alla ${filteredTasks.length} ärenden`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Företagsinformation</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettingsModal(true)}
                  className="text-slate-400 hover:text-white"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Redigera
                </Button>
              </div>
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

            <Card className="mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Kommande besök</h3>
              {visits.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Inga kommande besök planerade</p>
                  <p className="text-slate-500 text-xs mt-1">Nya besök kommer att visas här</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visits.map((visit) => (
                    <div 
                      key={visit.id}
                      className="border border-slate-700 rounded-lg p-3 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center text-sm text-white font-medium mb-1">
                            <Calendar className="w-4 h-4 mr-2 text-green-400" />
                            {new Date(visit.visit_date).toLocaleDateString('sv-SE', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          {visit.technician_name && (
                            <div className="flex items-center text-xs text-slate-400">
                              <User className="w-3 h-3 mr-1" />
                              {visit.technician_name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          {visit.status && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">Status:</span>
                              <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(visit.status)}`}>
                                {capitalizeFirst(visit.status)}
                              </span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTaskId(visit.id)}
                            className="text-xs"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Detaljer
                          </Button>
                        </div>
                      </div>
                      {visit.work_performed && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                          {visit.work_performed}
                        </p>
                      )}
                    </div>
                  ))}
                  {visits.length >= 5 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      fullWidth 
                      className="mt-3"
                      disabled
                    >
                      Visa alla besök
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <Card 
              className="mt-6 cursor-pointer hover:border-green-500/50 transition-all group"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="flex items-center justify-center p-6 text-center">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <Plus className="w-6 h-6 text-green-400 group-hover:text-green-300" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-white group-hover:text-green-100 transition-colors">
                      Skapa nytt ärende
                    </h4>
                    <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                      Rapportera ett problem eller boka service
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {selectedTaskId && (
        <CaseDetailsModal
          caseId=""
          clickupTaskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {showSettingsModal && customer && (
        <CustomerSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          customer={{
            id: customer.id,
            company_name: customer.company_name,
            org_number: customer.org_number || '',
            contact_person: customer.contact_person,
            email: customer.email,
            phone: customer.phone
          }}
          onUpdate={(updatedCustomer) => {
            setCustomer(prev => prev ? { ...prev, ...updatedCustomer } : null)
          }}
        />
      )}

      {showCreateModal && customer && (
        <CreateCaseModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchClickUpTasks()
            fetchUpcomingVisits()
          }}
          customerId={customer.id}
          customerInfo={{
            company_name: customer.company_name,
            contact_person: customer.contact_person,
            email: customer.email
          }}
        />
      )}
    </div>
  )
}