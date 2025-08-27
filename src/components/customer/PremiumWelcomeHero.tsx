// src/components/customer/PremiumWelcomeHero.tsx - Premium Welcome Section
import React, { useState, useEffect } from 'react'
import { RefreshCw, Shield, Calendar, Award } from 'lucide-react'
import Button from '../ui/Button'

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

const PremiumWelcomeHero: React.FC<PremiumWelcomeHeroProps> = ({ 
  customer, 
  onRefresh, 
  refreshing 
}) => {
  const [greeting, setGreeting] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time and greeting
  useEffect(() => {
    const updateTimeAndGreeting = () => {
      const now = new Date()
      setCurrentTime(now)
      
      const hour = now.getHours()
      if (hour < 10) {
        setGreeting('God morgon')
      } else if (hour < 17) {
        setGreeting('God dag')
      } else {
        setGreeting('God kväll')
      }
    }

    updateTimeAndGreeting()
    const interval = setInterval(updateTimeAndGreeting, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Calculate years as partner
  const getPartnershipYears = () => {
    if (!customer.contract_start_date) return null
    const start = new Date(customer.contract_start_date)
    const now = new Date()
    const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    return years
  }

  const partnerYears = getPartnershipYears()

  // Format date nicely
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('sv-SE', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className="relative overflow-hidden">
      {/* Gradient Background with animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-900/10">
        <div className="absolute inset-0 opacity-50" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(255,255,255,0.02)' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`
        }}></div>
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Left side - Welcome message */}
          <div className="flex-1">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              {greeting}, {customer.contact_person?.split(' ')[0] || 'Kund'}!
            </h1>
            <p className="text-xl text-slate-300 mb-6">
              Välkommen till er premium kundportal
            </p>
            
            {/* Company and Status */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-slate-800/50 backdrop-blur px-4 py-2 rounded-lg border border-slate-700/50">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-300 font-medium">{customer.company_name}</span>
              </div>
              
              {partnerYears !== null && partnerYears > 0 && (
                <div className="flex items-center gap-2 bg-emerald-500/10 backdrop-blur px-4 py-2 rounded-lg border border-emerald-500/20">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-400 font-medium">
                    Partner sedan {partnerYears} {partnerYears === 1 ? 'år' : 'år'}
                  </span>
                </div>
              )}

              {customer.contract_status === 'signed' && (
                <div className="flex items-center gap-2 bg-green-500/10 backdrop-blur px-4 py-2 rounded-lg border border-green-500/20">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium">Aktivt avtal</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Service Quality Indicator */}
          <div className="flex flex-col items-center gap-4">
            {/* Animated Service Quality Ring */}
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="url(#gradient)"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - 0.92)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center group cursor-help"
                title="Service Quality Score baserat på genomsnittlig kundnöjdhet, responstid och ärendehantering"
              >
                <span className="text-3xl font-bold text-white">92%</span>
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Service Quality</span>
                
                {/* Tooltip */}
                <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 whitespace-nowrap border border-slate-600">
                  Baserat på kundnöjdhet, responstid & ärendehantering
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-t border-slate-600"></div>
                </div>
              </div>
            </div>

            {/* Date and Refresh */}
            <div className="text-center">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(currentTime)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PremiumWelcomeHero