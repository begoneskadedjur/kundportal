// src/components/customer/RecentActivity.tsx
import React, { useState, useEffect } from 'react'
import { Activity, Clock, CheckCircle, AlertCircle, FileText, User, MessageSquare, Calendar } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../shared/LoadingSpinner'

interface ActivityItem {
  id: string
  type: 'case_created' | 'case_updated' | 'case_completed' | 'visit_scheduled' | 'note_added' | 'status_changed'
  title: string
  description: string
  timestamp: string
  case_number?: string
  technician_name?: string
  status_from?: string
  status_to?: string
}

interface RecentActivityProps {
  customerId: string
  refreshTrigger?: boolean
}

const RecentActivity: React.FC<RecentActivityProps> = ({ customerId, refreshTrigger }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentActivity()
  }, [customerId, refreshTrigger])

  const fetchRecentActivity = async () => {
    try {
      setLoading(true)
      setError(null)

      // Hämta cases från ClickUp för att skapa aktivitetshistorik
      const response = await fetch(`/api/clickup-tasks?customer_id=${customerId}`)
      
      if (response.ok) {
        const data = await response.json()
        const tasks = data.tasks || []
        
        // Skapa aktiviteter från tasks (simulerad data baserad på task information)
        const generatedActivities: ActivityItem[] = []
        
        tasks.forEach((task: any) => {
          const baseActivity = {
            case_number: task.custom_id || `#${task.id.slice(-6)}`,
            technician_name: task.assignees?.[0]?.username
          }

          // Skapa ärende-aktivitet
          generatedActivities.push({
            id: `created-${task.id}`,
            type: 'case_created',
            title: 'Nytt ärende skapat',
            description: task.name,
            timestamp: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : new Date().toISOString(),
            ...baseActivity
          })

          // Status-ändringar baserat på aktuell status
          const status = task.status?.status
          if (status) {
            const statusTimestamp = task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : new Date().toISOString()
            
            if (status.toLowerCase().includes('complete') || status.toLowerCase().includes('genomför')) {
              generatedActivities.push({
                id: `completed-${task.id}`,
                type: 'case_completed',
                title: 'Ärende avslutat',
                description: `${task.name} har markerats som genomfört`,
                timestamp: statusTimestamp,
                status_to: status,
                ...baseActivity
              })
            } else if (status.toLowerCase().includes('progress') || status.toLowerCase().includes('bokat')) {
              generatedActivities.push({
                id: `progress-${task.id}`,
                type: 'status_changed',
                title: 'Status uppdaterad',
                description: `${task.name} - Status ändrad till ${status}`,
                timestamp: statusTimestamp,
                status_to: status,
                ...baseActivity
              })
            }
          }

          // Schemalagt besök om due_date finns
          if (task.due_date) {
            generatedActivities.push({
              id: `scheduled-${task.id}`,
              type: 'visit_scheduled',
              title: 'Besök schemalagt',
              description: `Besök för ${task.name} schemalagt`,
              timestamp: new Date(parseInt(task.due_date)).toISOString(),
              ...baseActivity
            })
          }

          // Anteckningar om description finns
          if (task.description && task.description.trim()) {
            generatedActivities.push({
              id: `note-${task.id}`,
              type: 'note_added',
              title: 'Anteckning tillagd',
              description: task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description,
              timestamp: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : new Date().toISOString(),
              ...baseActivity
            })
          }
        })

        // Sortera aktiviteter efter datum (senaste först) och ta de 10 senaste
        generatedActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setActivities(generatedActivities.slice(0, 10))
      } else {
        setActivities([])
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
      setError('Kunde inte hämta senaste aktivitet')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  // Få ikon för aktivitetstyp
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'case_created':
        return { Icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-500/20' }
      case 'case_updated':
        return { Icon: Activity, color: 'text-yellow-500', bgColor: 'bg-yellow-500/20' }
      case 'case_completed':
        return { Icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-500/20' }
      case 'visit_scheduled':
        return { Icon: Calendar, color: 'text-purple-500', bgColor: 'bg-purple-500/20' }
      case 'note_added':
        return { Icon: MessageSquare, color: 'text-orange-500', bgColor: 'bg-orange-500/20' }
      case 'status_changed':
        return { Icon: Activity, color: 'text-cyan-500', bgColor: 'bg-cyan-500/20' }
      default:
        return { Icon: Activity, color: 'text-slate-500', bgColor: 'bg-slate-500/20' }
    }
  }

  // Formatera relativ tid
  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Nyss'
    if (diffMins < 60) return `${diffMins} min sedan`
    if (diffHours < 24) return `${diffHours} h sedan`
    if (diffDays < 7) return `${diffDays} dag${diffDays === 1 ? '' : 'ar'} sedan`
    
    return date.toLocaleDateString('sv-SE', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Senaste Aktivitet</h3>
            <p className="text-slate-400 text-sm">
              {activities.length > 0 
                ? `${activities.length} senaste ${activities.length === 1 ? 'aktivitet' : 'aktiviteter'}`
                : 'Ingen aktivitet att visa'
              }
            </p>
          </div>
        </div>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchRecentActivity}
          className="flex items-center gap-2"
          disabled={loading}
        >
          <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Uppdatera
        </Button>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-1">
        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-400">{error}</p>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={fetchRecentActivity}
              className="mt-3"
            >
              Försök igen
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-cyan-500" />
            </div>
            <h4 className="text-white font-medium mb-2">Ingen aktivitet än</h4>
            <p className="text-slate-400 text-sm mb-4">
              Aktiviteter kommer att visas här när du börjar använda tjänsten.
            </p>
            <p className="text-slate-500 text-xs">
              Skapa ditt första ärende för att komma igång!
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-700"></div>
            
            {activities.map((activity, index) => {
              const { Icon, color, bgColor } = getActivityIcon(activity.type)
              const isLast = index === activities.length - 1
              
              return (
                <div key={activity.id} className="relative flex gap-4 pb-4">
                  {/* Timeline Icon */}
                  <div className={`relative z-10 w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-white font-medium text-sm">
                        {activity.title}
                      </h4>
                      <span className="text-slate-400 text-xs ml-2 flex-shrink-0">
                        {getRelativeTime(activity.timestamp)}
                      </span>
                    </div>
                    
                    <p className="text-slate-400 text-sm mb-2 leading-relaxed">
                      {activity.description}
                    </p>
                    
                    {/* Activity Metadata */}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {activity.case_number && (
                        <span className="font-mono">{activity.case_number}</span>
                      )}
                      {activity.technician_name && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{activity.technician_name}</span>
                        </div>
                      )}
                      {activity.status_to && (
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          <span>{activity.status_to}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {activities.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-slate-400 text-xs mb-3">
            Visar de {activities.length} senaste aktiviteterna
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // TODO: Navigate to full activity log
              console.log('Show full activity log')
            }}
          >
            Visa fullständig historik
          </Button>
        </div>
      )}
    </Card>
  )
}

export default RecentActivity