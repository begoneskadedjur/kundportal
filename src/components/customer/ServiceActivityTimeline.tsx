// src/components/customer/ServiceActivityTimeline.tsx - Service Activity Timeline
import React, { useState } from 'react'
import { Clock, CheckCircle, AlertCircle, Calendar, Filter, ChevronDown } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'

interface ServiceActivityTimelineProps {
  customerId: string
}

// Placeholder data for demonstration
const placeholderActivities = [
  {
    id: '1',
    date: '2024-01-15',
    type: 'completed',
    title: 'Rutinkontroll genomförd',
    description: 'Månadsvis inspektion av samtliga betesstationer. Ingen aktivitet noterad.',
    technician: 'Johan Andersson',
    icon: CheckCircle,
    color: 'text-green-500 bg-green-500/10 border-green-500/20'
  },
  {
    id: '2',
    date: '2024-01-08',
    type: 'scheduled',
    title: 'Kommande besök',
    description: 'Planerat underhållsbesök för kontroll av betesstationer.',
    technician: 'Maria Svensson',
    icon: Calendar,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
  },
  {
    id: '3',
    date: '2023-12-20',
    type: 'urgent',
    title: 'Akut åtgärd utförd',
    description: 'Tecken på gnagaraktivitet upptäckt. Förstärkta åtgärder vidtagna.',
    technician: 'Erik Karlsson',
    icon: AlertCircle,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
  }
]

const ServiceActivityTimeline: React.FC<ServiceActivityTimelineProps> = ({ customerId }) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'scheduled' | 'urgent'>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  const filteredActivities = filter === 'all' 
    ? placeholderActivities 
    : placeholderActivities.filter(a => a.type === filter)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const filterOptions = [
    { value: 'all', label: 'Alla aktiviteter', count: placeholderActivities.length },
    { value: 'completed', label: 'Genomförda', count: 1 },
    { value: 'scheduled', label: 'Planerade', count: 1 },
    { value: 'urgent', label: 'Akuta', count: 1 }
  ]

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Servicehistorik</h3>
              <p className="text-sm text-slate-400">Era senaste och kommande besök</p>
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              <ChevronDown className="w-3 h-3" />
            </Button>

            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                {filterOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value as any)
                      setShowFilterDropdown(false)
                    }}
                    className={`
                      w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors
                      ${filter === option.value ? 'bg-slate-700/50 text-white' : 'text-slate-300'}
                      ${option.value === 'all' ? '' : 'border-t border-slate-700/50'}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option.label}</span>
                      <span className="text-xs text-slate-500">{option.count}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-slate-700 to-transparent"></div>

          {/* Activities */}
          <div className="space-y-6">
            {filteredActivities.map((activity, index) => {
              const Icon = activity.icon
              
              return (
                <div key={activity.id} className="relative flex gap-4 group">
                  {/* Timeline dot */}
                  <div className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center
                    ${activity.color} border transition-all duration-300
                    group-hover:scale-110
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-all">
                      {/* Date and Status */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-white font-medium">{activity.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(activity.date)}</p>
                        </div>
                        {activity.type === 'completed' && (
                          <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full">
                            Genomfört
                          </span>
                        )}
                        {activity.type === 'scheduled' && (
                          <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-full">
                            Planerat
                          </span>
                        )}
                        {activity.type === 'urgent' && (
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full">
                            Akut
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-slate-300 mb-3">
                        {activity.description}
                      </p>

                      {/* Technician */}
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center">
                          <span className="text-[10px] text-slate-300 font-medium">
                            {activity.technician.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <span>Tekniker: {activity.technician}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {filteredActivities.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400">Inga aktiviteter att visa</p>
              <p className="text-sm text-slate-500 mt-1">Ändra filter för att se mer</p>
            </div>
          )}

          {/* Load More Placeholder */}
          {filteredActivities.length > 0 && (
            <div className="text-center pt-6">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                Visa fler aktiviteter
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default ServiceActivityTimeline