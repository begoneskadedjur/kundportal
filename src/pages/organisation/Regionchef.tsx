// src/pages/organisation/Regionchef.tsx - Dashboard för regionchefer
import React, { useState, useEffect } from 'react'
import { Building2, MapPin, AlertTriangle, CheckCircle, TrendingUp, Users } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

interface SiteMetrics {
  siteId: string
  siteName: string
  city: string
  activeCases: number
  completedThisMonth: number
  scheduledVisits: number
  trafficLight: 'green' | 'yellow' | 'red'
}

const RegionchefDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (accessibleSites.length > 0) {
      fetchMetrics()
    } else {
      setLoading(false)
    }
  }, [accessibleSites])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const metrics: SiteMetrics[] = []
      
      for (const site of accessibleSites) {
        // Hämta aktiva ärenden
        const { data: activeCases } = await supabase
          .from('private_cases')
          .select('id')
          .eq('site_id', site.id)
          .in('status', ['pending', 'in_progress', 'scheduled'])

        // Hämta avklarade denna månad
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const { data: completedCases } = await supabase
          .from('private_cases')
          .select('id')
          .eq('site_id', site.id)
          .eq('status', 'completed')
          .gte('updated_at', startOfMonth.toISOString())

        // Hämta schemalagda besök
        const { data: scheduledVisits } = await supabase
          .from('private_cases')
          .select('id')
          .eq('site_id', site.id)
          .eq('status', 'scheduled')

        // Beräkna trafikljus
        let trafficLight: 'green' | 'yellow' | 'red' = 'green'
        if ((activeCases?.length || 0) > 5) trafficLight = 'yellow'
        if ((activeCases?.length || 0) > 10) trafficLight = 'red'

        metrics.push({
          siteId: site.id,
          siteName: site.site_name,
          city: site.city || 'Okänd stad',
          activeCases: activeCases?.length || 0,
          completedThisMonth: completedCases?.length || 0,
          scheduledVisits: scheduledVisits?.length || 0,
          trafficLight
        })
      }
      
      setSiteMetrics(metrics)
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Beräkna totaler
  const totals = {
    sites: siteMetrics.length,
    activeCases: siteMetrics.reduce((sum, m) => sum + m.activeCases, 0),
    completedThisMonth: siteMetrics.reduce((sum, m) => sum + m.completedThisMonth, 0),
    scheduledVisits: siteMetrics.reduce((sum, m) => sum + m.scheduledVisits, 0)
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar regiondata..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-2xl p-6 border border-blue-700/50">
          <h1 className="text-3xl font-bold text-white mb-2">
            {organization?.organization_name}
          </h1>
          <p className="text-blue-200">
            Regionchef - {userRole?.region || 'Okänd region'}
          </p>
        </div>
      </div>

      {/* Översikt */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Enheter i region</p>
              <p className="text-2xl font-bold text-white">{totals.sites}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Aktiva ärenden</p>
              <p className="text-2xl font-bold text-white">{totals.activeCases}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Avklarade (månaden)</p>
              <p className="text-2xl font-bold text-white">{totals.completedThisMonth}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Schemalagda besök</p>
              <p className="text-2xl font-bold text-white">{totals.scheduledVisits}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Enheter i regionen */}
      <div className="max-w-7xl mx-auto">
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              Enheter i {userRole?.region || 'din region'}
            </h2>
          </div>
          
          <div className="p-6">
            {siteMetrics.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Inga enheter i din region</p>
                <p className="text-slate-500 text-sm mt-2">
                  Kontakta verksamhetschefen för att få tillgång till enheter
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {siteMetrics.map((metric) => (
                  <div
                    key={metric.siteId}
                    className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white text-lg">{metric.siteName}</h3>
                          <div className={`w-3 h-3 rounded-full ${
                            metric.trafficLight === 'green' ? 'bg-green-500' :
                            metric.trafficLight === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                        </div>
                        <p className="text-slate-400 text-sm mb-3">{metric.city}</p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Aktiva ärenden</p>
                            <p className="font-semibold text-amber-400">{metric.activeCases}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Avklarade</p>
                            <p className="font-semibold text-green-400">{metric.completedThisMonth}</p>
                          </div>
                          <div className="bg-slate-800/50 rounded p-3">
                            <p className="text-slate-500 text-xs mb-1">Schemalagda</p>
                            <p className="font-semibold text-purple-400">{metric.scheduledVisits}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-6">
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                          Visa detaljer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </OrganisationLayout>
  )
}

export default RegionchefDashboard