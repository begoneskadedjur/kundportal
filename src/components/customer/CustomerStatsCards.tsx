// src/components/customer/CustomerStatsCards.tsx
import React, { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle, Calendar, AlertCircle } from 'lucide-react'
import Card from '../ui/Card'

type TaskStats = {
  total: number
  open: number
  inProgress: number
  completed: number
  upcoming: number
}

interface CustomerStatsCardsProps {
  customerId: string
  clickupListId: string
}

const CustomerStatsCards: React.FC<CustomerStatsCardsProps> = ({ customerId, clickupListId }) => {
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    completed: 0,
    upcoming: 0
  })
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
  }, [customerId, clickupListId])
  
  const fetchStats = async () => {
    try {
      setLoading(true)
      
      // Här skulle vi hämta från ClickUp API via vår backend
      const response = await fetch(`/api/clickup-tasks?list_id=${clickupListId}`)
      
      if (response.ok) {
        const data = await response.json()
        const tasks = data.tasks || []
        
        // Beräkna statistik från tasks
        const calculatedStats = {
          total: tasks.length,
          open: tasks.filter((t: any) => t.status?.status?.toLowerCase() === 'open').length,
          inProgress: tasks.filter((t: any) => 
            ['bokat', 'under hantering', 'in progress'].includes(t.status?.status?.toLowerCase())
          ).length,
          completed: tasks.filter((t: any) => 
            ['genomfört', 'genomförd', 'avslutad', 'klar', 'complete'].includes(t.status?.status?.toLowerCase())
          ).length,
          upcoming: tasks.filter((t: any) => {
            if (!t.due_date) return false
            const dueDate = new Date(parseInt(t.due_date))
            const now = new Date()
            return dueDate >= now
          }).length
        }
        
        setStats(calculatedStats)
      } else {
        // Fallback till dummy data om API misslyckas
        setStats({
          total: 0,
          open: 0,
          inProgress: 0,
          completed: 0,
          upcoming: 0
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Visa 0 vid fel
      setStats({
        total: 0,
        open: 0,
        inProgress: 0,
        completed: 0,
        upcoming: 0
      })
    } finally {
      setLoading(false)
    }
  }
  
  const statCards = [
    {
      title: 'Totalt antal ärenden',
      value: loading ? '-' : stats.total,
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20'
    },
    {
      title: 'Pågående ärenden',
      value: loading ? '-' : stats.inProgress,
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20'
    },
    {
      title: 'Avslutade ärenden',
      value: loading ? '-' : stats.completed,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20'
    },
    {
      title: 'Kommande besök',
      value: loading ? '-' : stats.upcoming,
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20'
    }
  ]
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{stat.title}</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export default CustomerStatsCards