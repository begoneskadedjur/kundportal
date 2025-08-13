// src/pages/organisation/Verksamhetschef.tsx - Dashboard för verksamhetschefer
import React, { useState, useEffect } from 'react'
import { Building2, Users, TrendingUp, MapPin, AlertTriangle, CheckCircle } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

interface SiteMetrics {
  siteId: string
  siteName: string
  region: string
  activeCases: number
  completedThisMonth: number
  pendingQuotes: number
  trafficLight: 'green' | 'yellow' | 'red'
}

const VerksamhetschefDashboard: React.FC = () => {
  const { profile } = useAuth()
  const { organization, sites, userRole, loading: contextLoading } = useMultisite()
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('all')

  useEffect(() => {
    if (sites.length > 0) {
      fetchMetrics()
    } else {
      setLoading(false)
    }
  }, [sites])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const metrics: SiteMetrics[] = []
      
      for (const site of sites) {
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

        // Hämta väntande offerter
        const { data: quotes } = await supabase
          .from('customer_pending_quotes')
          .select('quote_id')
          .eq('site_id', site.id)

        // Beräkna trafikljus (förenklad logik)
        let trafficLight: 'green' | 'yellow' | 'red' = 'green'
        if ((activeCases?.length || 0) > 10) trafficLight = 'yellow'
        if ((activeCases?.length || 0) > 20) trafficLight = 'red'

        metrics.push({
          siteId: site.id,
          siteName: site.site_name,
          region: site.region || 'Okänd',
          activeCases: activeCases?.length || 0,
          completedThisMonth: completedCases?.length || 0,
          pendingQuotes: quotes?.length || 0,
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

  // Hämta unika regioner
  const regions = Array.from(new Set(sites.map(s => s.region || 'Okänd')))
  
  // Filtrera metrics baserat på vald region
  const filteredMetrics = selectedRegion === 'all' 
    ? siteMetrics 
    : siteMetrics.filter(m => m.region === selectedRegion)

  // Beräkna totaler
  const totals = {
    sites: filteredMetrics.length,
    activeCases: filteredMetrics.reduce((sum, m) => sum + m.activeCases, 0),
    completedThisMonth: filteredMetrics.reduce((sum, m) => sum + m.completedThisMonth, 0),
    pendingQuotes: filteredMetrics.reduce((sum, m) => sum + m.pendingQuotes, 0),
    trafficLight: {
      green: filteredMetrics.filter(m => m.trafficLight === 'green').length,
      yellow: filteredMetrics.filter(m => m.trafficLight === 'yellow').length,
      red: filteredMetrics.filter(m => m.trafficLight === 'red').length
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar organisationsdata..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <h1 className="text-3xl font-bold text-white mb-2">
            {organization?.organization_name}
          </h1>
          <p className="text-purple-200">
            Verksamhetschef - Full översikt över alla enheter
          </p>
        </div>
      </div>

      {/* Region Filter */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-lg">
          <label className="text-slate-300">Filtrera per region:</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Alla regioner</option>
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Översikt */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <span className="text-slate-400 text-sm">Enheter</span>
          </div>
          <p className="text-2xl font-bold text-white">{totals.sites}</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-slate-400 text-sm">Aktiva ärenden</span>
          </div>
          <p className="text-2xl font-bold text-white">{totals.activeCases}</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-slate-400 text-sm">Avklarade</span>
          </div>
          <p className="text-2xl font-bold text-white">{totals.completedThisMonth}</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span className="text-slate-400 text-sm">Offerter</span>
          </div>
          <p className="text-2xl font-bold text-white">{totals.pendingQuotes}</p>
        </Card>

        <Card className="p-6 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1">
              <div className={`w-2 h-2 rounded-full bg-green-500`}></div>
              <div className={`w-2 h-2 rounded-full bg-yellow-500`}></div>
              <div className={`w-2 h-2 rounded-full bg-red-500`}></div>
            </div>
            <span className="text-slate-400 text-sm">Trafikljus</span>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="text-green-400">{totals.trafficLight.green}</span>
            <span className="text-yellow-400">{totals.trafficLight.yellow}</span>
            <span className="text-red-400">{totals.trafficLight.red}</span>
          </div>
        </Card>
      </div>

      {/* Enhetslista */}
      <div className="max-w-7xl mx-auto">
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Enhetsöversikt
            </h2>
          </div>
          
          <div className="p-6">
            {filteredMetrics.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Inga enheter hittades</p>
                <p className="text-slate-500 text-sm mt-2">
                  Kontakta administratören för att lägga till enheter
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMetrics.map((metric) => (
                  <div
                    key={metric.siteId}
                    className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{metric.siteName}</h3>
                        <p className="text-sm text-slate-400">{metric.region}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${
                        metric.trafficLight === 'green' ? 'bg-green-500' :
                        metric.trafficLight === 'yellow' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Aktiva</p>
                        <p className="font-semibold text-amber-400">{metric.activeCases}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Avklarade</p>
                        <p className="font-semibold text-green-400">{metric.completedThisMonth}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Offerter</p>
                        <p className="font-semibold text-purple-400">{metric.pendingQuotes}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default VerksamhetschefDashboard