// src/components/multisite/MultisiteDashboard.tsx - Main Dashboard for Multisite Portal
import React, { useState, useEffect } from 'react'
import { Building2, MapPin, AlertTriangle, CheckCircle, Users, Calendar, TrendingUp } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import LoadingSpinner from '../shared/LoadingSpinner'

interface DashboardMetrics {
  totalSites: number
  activeCases: number
  completedThisMonth: number
  pendingQuotes: number
  trafficLightStatus: {
    green: number
    yellow: number
    red: number
  }
}

const MultisiteDashboard: React.FC = () => {
  const { organization, accessibleSites, userRole, currentSite } = useMultisite()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardMetrics()
  }, [accessibleSites, currentSite])

  const fetchDashboardMetrics = async () => {
    if (!organization || accessibleSites.length === 0) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      const siteIds = accessibleSites.map(site => site.id)
      
      // Get active cases for accessible sites
      const { data: activeCases, error: casesError } = await supabase
        .from('private_cases')
        .select('id, status')
        .in('site_id', siteIds)
        .neq('status', 'completed')
        .neq('status', 'cancelled')

      if (casesError) throw casesError

      // Get completed cases this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: completedCases, error: completedError } = await supabase
        .from('private_cases')
        .select('id')
        .in('site_id', siteIds)
        .eq('status', 'completed')
        .gte('updated_at', startOfMonth.toISOString())

      if (completedError) throw completedError

      // Get pending quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('customer_pending_quotes')
        .select('quote_id')
        .in('site_id', siteIds)

      if (quotesError) throw quotesError

      // Calculate traffic light status (simplified - could be enhanced with real logic)
      const trafficLightStatus = {
        green: Math.floor(accessibleSites.length * 0.6),
        yellow: Math.floor(accessibleSites.length * 0.3),
        red: Math.floor(accessibleSites.length * 0.1)
      }

      setMetrics({
        totalSites: accessibleSites.length,
        activeCases: activeCases?.length || 0,
        completedThisMonth: completedCases?.length || 0,
        pendingQuotes: quotes?.length || 0,
        trafficLightStatus
      })
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl p-6 border border-slate-700/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Välkommen till {organization?.organization_name}
              </h1>
              <p className="text-slate-300">
                {userRole?.role_type === 'verksamhetsansvarig' && 'Du har full tillgång till hela organisationen'}
                {userRole?.role_type === 'regionansvarig' && `Du ansvarar för region ${userRole.region}`}
                {userRole?.role_type === 'enhetsansvarig' && `Du ansvarar för ${accessibleSites.length} enhet${accessibleSites.length === 1 ? '' : 'er'}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Tillgängliga enheter</p>
              <p className="text-3xl font-bold text-emerald-400">{accessibleSites.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-slate-200">Totala Enheter</h3>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.totalSites}</p>
            <p className="text-sm text-slate-400">Under din ansvar</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-semibold text-slate-200">Aktiva Ärenden</h3>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.activeCases}</p>
            <p className="text-sm text-slate-400">Pågående arbeten</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-semibold text-slate-200">Avklarade (Månaden)</h3>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.completedThisMonth}</p>
            <p className="text-sm text-slate-400">Denna månad</p>
          </Card>

          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="font-semibold text-slate-200">Väntande Offerter</h3>
            </div>
            <p className="text-2xl font-bold text-white">{metrics.pendingQuotes}</p>
            <p className="text-sm text-slate-400">Kräver åtgärd</p>
          </Card>
        </div>
      )}

      {/* Sites Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sites List */}
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Dina Enheter</h3>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {accessibleSites.map(site => (
              <div 
                key={site.id}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/50"
              >
                <div>
                  <h4 className="font-medium text-white">{site.site_name}</h4>
                  <p className="text-sm text-slate-400">{site.region}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-slate-400">Aktiv</span>
                </div>
              </div>
            ))}
          </div>
          
          {accessibleSites.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Inga enheter tillgängliga</p>
            </div>
          )}
        </Card>

        {/* Traffic Light Status */}
        {metrics && (
          <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-white">Trafikljusstatus</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-slate-200">Grönt ljus</span>
                </div>
                <span className="text-lg font-semibold text-white">{metrics.trafficLightStatus.green}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                  <span className="text-slate-200">Gult ljus</span>
                </div>
                <span className="text-lg font-semibold text-white">{metrics.trafficLightStatus.yellow}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-slate-200">Rött ljus</span>
                </div>
                <span className="text-lg font-semibold text-white">{metrics.trafficLightStatus.red}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-600">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total bedömning</span>
                <span className="font-medium text-emerald-400">
                  {Math.round((metrics.trafficLightStatus.green / accessibleSites.length) * 100)}% Grönt
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default MultisiteDashboard