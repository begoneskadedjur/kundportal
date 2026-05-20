import React, { useState, useEffect } from 'react'
import { RefreshCw, Calendar } from 'lucide-react'

interface PremiumWelcomeHeroProps {
  customer: {
    company_name: string
    contact_person: string
    contract_start_date: string | null
    contract_status: string | null
  }
  onRefresh: () => void
  refreshing: boolean
}

const PremiumWelcomeHeroComponent: React.FC<PremiumWelcomeHeroProps> = ({
  customer,
  onRefresh,
  refreshing
}) => {
  const [greeting, setGreeting] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(now)
      const hour = now.getHours()
      if (hour < 10) setGreeting('God morgon')
      else if (hour < 17) setGreeting('God dag')
      else setGreeting('God kväll')
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (date: Date) =>
    date.toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

  const isActive =
    customer.contract_status === 'signed' ||
    customer.contract_status === 'active'

  const firstName = customer.contact_person?.split(' ')[0] || 'Kund'

  return (
    <div className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-white">
              {greeting}, {firstName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">{customer.company_name}</span>
              {isActive ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Aktivt avtal
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/50 text-slate-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                  {customer.contract_status
                    ? customer.contract_status.charAt(0).toUpperCase() +
                      customer.contract_status.slice(1)
                    : 'Inaktivt'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span className="capitalize">{formatDate(currentTime)}</span>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Uppdatera
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PremiumWelcomeHeroComponent
