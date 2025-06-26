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
  Eye,
  Search,
  Plus,
  Flag
} from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import CaseDetailsModal from '../../components/customer/CaseDetailsModal'
import CreateCaseModal from '../../components/customer/CreateCaseModal'
import CustomerSettingsModal from '../../components/customer/CustomerSettingsModal'

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
  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Hämta kunddata
  useEffect(() => {
    if (profile?.customer_id) {
      fetchCustomerData()
      // fetchUpcomingVisits() flyttat till efter customer är satt
    }
  }, [profile])

  // Hämta ClickUp-uppgifter och kommande besök när kunddata är hämtad
  useEffect(() => {
    if (customer?.clickup_list_id) {
      fetchClickUpTasks()
      fetchUpcomingVisits() // Hämta besök efter att customer är satt
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

  const fetchUpcomingVisits = async () => {
    if (!customer?.clickup_list_id) return

    try {
      console.log('Fetching upcoming visits from ClickUp API...')
      
      // Använd samma API som för ärenden
      const response = await fetch(`/api/clickup-tasks?list_id=${customer.clickup_list_id}`)
      
      if (!response.ok) {
        throw new Error('Kunde inte hämta ärenden från ClickUp')
      }

      const data = await response.json()
      const allTasks = data.tasks || []
      
      // Filtrera tasks som har due_date och är framtida
      const now = new Date()
      const upcomingTasks = allTasks.filter((task: ClickUpTask) => {
        if (!task.due_date) return false
        
        const dueDate = new Date(parseInt(task.due_date))
        return dueDate >= now
      })
      
      // Konvertera till visit-format och sortera efter datum
      const upcomingVisits = upcomingTasks
        .map((task: ClickUpTask) => {
          // Hitta custom fields för mer detaljerad info
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
            // Extra info från ClickUp
            address: addressField?.value?.formatted_address || null,
            clickup_url: `https://app.clickup.com/t/${task.id}`
          }
        })
        .sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime())
        .slice(0, 5) // Begränsa till 5 st
      
      setVisits(upcomingVisits)
      console.log(`✅ Found ${upcomingVisits.length} upcoming visits`)
      
    } catch (error) {
      console.error('Error fetching upcoming visits:', error)
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

  // Filtrera tasks baserat på sökning, datum och status
  const filteredTasks = tasks.filter(task => {
    // Textfiltrera
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.assignees.length > 0 && task.assignees[0].username.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!matchesSearch) return false
    
    // Statusfilter
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
    
    // Datumfilter - använd deadline istället för created date
    if (dateFilter !== 'all') {
      // Om ärendet inte har deadline, skippa datumfiltrering för detta ärende
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
      
      // Avslutade ärenden: genomfört/genomförd, avslutad, klar, complete
      if (status === 'genomfört' || status === 'genomförd' || status === 'avslutad' || status === 'klar' || status === 'complete') {
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
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30' // Öppna/nya ärenden
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
            {/* Centrerad titel */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold text-white">
                BeGone Skadedjur Kundportal
              </h1>
            </div>
            
            {/* Kundinfo till höger */}
            <div className="flex items-center space-x-3">
              <div 
                className="bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-700 cursor-pointer hover:bg-slate-800/70 transition-colors"
                onClick={() => setShowSettingsModal(true)}
              >
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
              <div className="space-y-4">
                {/* Header */}
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

                {/* Filter-sektion */}
                <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  {/* Datumfilter */}
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
                  
                  {/* Statusfilter */}
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
                  
                  {/* Sökfunktion */}
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

                  {/* Rensa filter-knapp */}
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

          {/* Företagsinformation och besök */}
          <div>
            {/* Företagsinformation */}
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

            {/* Kommande besök */}
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

            {/* Skapa nytt ärende - Snygg box */}
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

      {/* Case Details Modal */}
      {selectedTaskId && (
        <CaseDetailsModal
          caseId=""
          clickupTaskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Customer Settings Modal */}
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

      {/* Create Case Modal */}
      {showCreateModal && customer && (
        <CreateCaseModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchClickUpTasks() // Refresh case list
            fetchUpcomingVisits() // Refresh visits
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