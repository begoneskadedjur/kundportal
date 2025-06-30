// src/pages/customer/Portal.tsx - DEBUG VERSION
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
  Settings,
  LogOut,
  Hash
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
  org_number: string | null
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

// 🐛 DEBUG COMPONENT - Visar all viktig state
const DebugInfo = ({ profile, customer, error, loading }: { 
  profile: any, 
  customer: any, 
  error: any, 
  loading: boolean 
}) => {
  const [showDebug, setShowDebug] = useState(true)

  if (!showDebug) {
    return (
      <button
        onClick={() => setShowDebug(true)}
        className="fixed top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded text-xs z-50"
      >
        Show Debug
      </button>
    )
  }

  return (
    <div className="fixed top-4 right-4 bg-slate-800 border border-yellow-500 rounded-lg p-4 max-w-sm z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-yellow-400 font-semibold">🐛 Debug Portal</h4>
        <button
          onClick={() => setShowDebug(false)}
          className="text-slate-400 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="text-xs space-y-2 text-white">
        <div className="bg-slate-700 p-2 rounded">
          <p><strong>Loading:</strong> {loading ? '🔄 True' : '✅ False'}</p>
          <p><strong>Error:</strong> {error ? `❌ ${error}` : '✅ None'}</p>
        </div>
        
        <div className="bg-slate-700 p-2 rounded">
          <p><strong>Profile exists:</strong> {profile ? '✅ Yes' : '❌ No'}</p>
          {profile && (
            <>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Customer ID:</strong> {profile.customer_id || '❌ Missing'}</p>
              <p><strong>Is Admin:</strong> {profile.is_admin ? 'Yes' : 'No'}</p>
              <p><strong>Is Active:</strong> {profile.is_active ? 'Yes' : 'No'}</p>
              <p><strong>User ID:</strong> {profile.user_id}</p>
            </>
          )}
        </div>
        
        <div className="bg-slate-700 p-2 rounded">
          <p><strong>Customer exists:</strong> {customer ? '✅ Yes' : '❌ No'}</p>
          {customer && (
            <>
              <p><strong>Company:</strong> {customer.company_name}</p>
              <p><strong>ClickUp List:</strong> {customer.clickup_list_id}</p>
              <p><strong>Contact:</strong> {customer.contact_person}</p>
            </>
          )}
        </div>

        <div className="bg-slate-700 p-2 rounded">
          <p><strong>Current URL:</strong> {window.location.pathname}</p>
          <p><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</p>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => {
              console.log('🐛 Manual Debug - Current State:', {
                profile,
                customer,
                error,
                loading,
                location: window.location.pathname
              })
            }}
            className="w-full bg-blue-600 text-white px-2 py-1 rounded text-xs"
          >
            Log State to Console
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-green-600 text-white px-2 py-1 rounded text-xs"
          >
            Reload Page
          </button>
          
          {profile?.customer_id && (
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/accept-invitation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      customerId: profile.customer_id,
                      email: profile.email,
                      userId: profile.user_id
                    })
                  })
                  const result = await response.json()
                  console.log('Manual accept result:', result)
                  alert(`Accept result: ${result.message}`)
                } catch (error) {
                  console.error('Manual accept error:', error)
                  alert(`Accept error: ${error}`)
                }
              }}
              className="w-full bg-purple-600 text-white px-2 py-1 rounded text-xs"
            >
              Manual Accept Invitation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CustomerPortal() {
  const { profile, signOut } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tasks, setTasks] = useState<ClickUpTask[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
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

  // 🐛 DEBUG: Log alla viktiga state changes
  useEffect(() => {
    console.log('🐛 Portal State Change:', {
      profile: profile ? {
        email: profile.email,
        customer_id: profile.customer_id,
        is_admin: profile.is_admin,
        is_active: profile.is_active
      } : null,
      customer: customer ? {
        company_name: customer.company_name,
        clickup_list_id: customer.clickup_list_id
      } : null,
      loading,
      error,
      hasCustomerId: !!profile?.customer_id,
      timestamp: new Date().toISOString()
    })
  }, [profile, customer, loading, error])

  // Hämta kunddata
  useEffect(() => {
    console.log('🔄 Profile effect triggered:', profile)
    if (profile?.customer_id) {
      console.log('✅ Profile has customer_id, fetching customer data...')
      fetchCustomerData()
    } else if (profile) {
      console.log('❌ Profile exists but no customer_id:', profile)
      setError('Ingen kundkoppling hittades i profilen')
      setLoading(false)
    }
  }, [profile])

  // Hämta ClickUp-uppgifter och kommande besök när kunddata är hämtad
  useEffect(() => {
    if (customer?.clickup_list_id) {
      console.log('🎯 Customer loaded, fetching ClickUp tasks...')
      fetchClickUpTasks()
      fetchUpcomingVisits()
    }
  }, [customer])

  const fetchCustomerData = async () => {
    try {
      console.log('📊 Fetching customer data for customer_id:', profile!.customer_id)
      
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

      if (error) {
        console.error('❌ Customer fetch error:', error)
        throw error
      }
      
      console.log('✅ Customer data fetched successfully:', {
        id: data.id,
        company_name: data.company_name,
        clickup_list_id: data.clickup_list_id,
        contact_person: data.contact_person
      })
      
      setCustomer(data)
    } catch (error: any) {
      console.error('💥 Error fetching customer:', error)
      setError(`Kunde inte hämta kunddata: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchUpcomingVisits = async () => {
    if (!customer?.clickup_list_id) return

    try {
      console.log('📅 Fetching upcoming visits from ClickUp API...')
      
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
      console.error('❌ Error fetching upcoming visits:', error)
    }
  }

  const fetchClickUpTasks = async () => {
    if (!customer?.clickup_list_id) return

    setTasksLoading(true)
    setError(null)
    
    try {
      console.log('📋 Fetching tasks for list:', customer.clickup_list_id)
      
      const response = await fetch(`/api/clickup-tasks?list_id=${customer.clickup_list_id}`)
      
      console.log('📊 ClickUp API response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ ClickUp API error:', errorData)
        throw new Error(errorData.error || 'Kunde inte hämta ärenden från ClickUp')
      }

      const data = await response.json()
      console.log('✅ ClickUp API data received:', {
        tasksCount: data.tasks?.length || 0,
        hasDebug: !!data.debug
      })
      
      setTasks(data.tasks || [])
      calculateTaskStats(data.tasks || [])
      
      if (data.debug) {
        console.log('🔍 ClickUp Debug info:', data.debug)
      }
      
    } catch (error: any) {
      console.error('💥 Error fetching ClickUp tasks:', error)
      setError(`ClickUp integration fel: ${error.message}`)
    } finally {
      setTasksLoading(false)
    }
  }

  // Filtrera tasks baserat på sökning, datum och status
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
      } else if (status === 'bokat' || status === 'under hantering') {
        stats.inProgress++
      } else {
        stats.open++
      }
    })

    setTaskStats(stats)
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'Inget datum satt'
    return new Date(parseInt(timestamp)).toLocaleDateString('sv-SE')
  }

  const getPriorityDisplay = (priority: string | null) => {
    if (!priority) return null
    
    const priorityLower = priority.toLowerCase()
    
    const config = {
      'urgent': { 
        text: 'Akut', 
        flagColor: 'text-red-500',
        borderColor: 'border-red-500/50',
        textColor: 'text-red-400'
      },
      'high': { 
        text: 'Hög', 
        flagColor: 'text-orange-500',
        borderColor: 'border-orange-500/50',
        textColor: 'text-orange-400'
      },
      'normal': { 
        text: 'Normal', 
        flagColor: 'text-blue-500',
        borderColor: 'border-blue-500/50',
        textColor: 'text-blue-400'
      },
      'low': { 
        text: 'Låg', 
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

  // 🐛 ALLTID VISA DEBUG-INFO
  return (
    <div className="min-h-screen bg-slate-950">
      <DebugInfo profile={profile} customer={customer} error={error} loading={loading} />
      
      {loading && (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-white mt-4">Laddar kundportal...</p>
            <p className="text-slate-400 text-sm mt-2">
              Hämtar profil: {profile ? '✅' : '⏳'} | 
              Hämtar kund: {customer ? '✅' : '⏳'}
            </p>
          </div>
        </div>
      )}

      {!loading && (error || !customer) && (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Card className="text-center p-8 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Ett fel uppstod</h2>
            <p className="text-slate-400 mb-4">{error || 'Kunde inte hämta kunddata'}</p>
            
            {/* 🐛 DEBUG INFORMATION */}
            <div className="text-left bg-slate-800 p-4 rounded-lg mb-4 text-xs">
              <h3 className="text-yellow-400 mb-2">🐛 Debug Information:</h3>
              <div className="text-slate-300 space-y-1">
                <p><strong>Profile exists:</strong> {profile ? 'Yes' : 'No'}</p>
                {profile && (
                  <>
                    <p><strong>Customer ID:</strong> {profile.customer_id || 'Missing'}</p>
                    <p><strong>Email:</strong> {profile.email}</p>
                    <p><strong>Is Active:</strong> {profile.is_active ? 'Yes' : 'No'}</p>
                  </>
                )}
                <p><strong>Customer loaded:</strong> {customer ? 'Yes' : 'No'}</p>
                <p><strong>Error:</strong> {error || 'No specific error'}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Button onClick={() => window.location.reload()}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Försök igen
              </Button>
              
              {profile?.customer_id && (
                <Button 
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/accept-invitation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          customerId: profile.customer_id,
                          email: profile.email,
                          userId: profile.user_id
                        })
                      })
                      const result = await response.json()
                      console.log('Manual accept result:', result)
                      window.location.reload()
                    } catch (error) {
                      console.error('Manual accept error:', error)
                    }
                  }}
                >
                  🔄 Acceptera inbjudan manuellt
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {!loading && customer && (
        <>
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
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut()}
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Logga ut"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
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

            {/* Stats Grid */}
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

            {/* Success Message */}
            <Card className="mb-8 bg-green-500/10 border-green-500/50">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <h3 className="text-green-400 font-medium">Portal laddad framgångsrikt!</h3>
                  <p className="text-green-300 text-sm mt-1">
                    Kund: {customer.company_name} | Kontakt: {customer.contact_person}
                  </p>
                </div>
              </div>
            </Card>

            {/* Simple tasks display */}
            <Card>
              <h3 className="text-xl font-semibold text-white mb-4">Ärenden</h3>
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                  <span className="ml-3 text-slate-400">Laddar ärenden...</span>
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
                  {tasks.slice(0, 3).map((task) => (
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status.status)}`}>
                            {capitalizeFirst(task.status.status)}
                          </span>
                          {task.priority && getPriorityDisplay(task.priority.priority)}
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
                  
                  {tasks.length > 3 && (
                    <div className="text-center pt-4">
                      <Button variant="secondary" size="sm">
                        Visa alla {tasks.length} ärenden
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </main>
        </>
      )}

      {/* Modals */}
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