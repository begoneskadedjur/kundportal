// src/pages/organisation/verksamhetschef/Statistik.tsx - Statistik för verksamhetschef
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { BarChart3, MapPin, TrendingUp, AlertTriangle } from 'lucide-react'

// Återanvänd befintliga customer-komponenter
import CustomerStatistics from '../../../components/customer/CustomerStatistics'
import ServiceExcellenceDashboard from '../../../components/customer/ServiceExcellenceDashboard'

const VerksamhetschefStatistik: React.FC = () => {
  const { organization, sites, loading: contextLoading } = useMultisite()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [customer, setCustomer] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (selectedSiteId !== 'all') {
      fetchCustomerForSite()
    } else {
      setCustomer(null)
    }
  }, [selectedSiteId, sites])
  
  const fetchCustomerForSite = async () => {
    const site = sites.find(s => s.id === selectedSiteId)
    if (!site || !site.customer_id) {
      setCustomer(null)
      return
    }
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', site.customer_id)
        .single()
      
      if (error) throw error
      setCustomer(data)
    } catch (error) {
      console.error('Error fetching customer:', error)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar statistik..." />
      </div>
    )
  }

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <h1 className="text-2xl font-bold text-white mb-2">
            Statistik - {organization?.organization_name}
          </h1>
          <p className="text-purple-200">
            Detaljerad statistik och analys för alla enheter
          </p>
        </div>

        {/* Site selector */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-4 flex items-center gap-4">
            <MapPin className="w-5 h-5 text-purple-400" />
            <label className="text-slate-300">Välj enhet:</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Välj en enhet för statistik</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.site_name} - {site.region}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Statistik content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar enhetsstatistik..." />
          </div>
        ) : selectedSiteId === 'all' ? (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Välj en enhet för att se detaljerad statistik</p>
              <p className="text-slate-500 text-sm mt-2">
                Statistiken visas per enhet för bättre analys
              </p>
            </div>
          </Card>
        ) : customer ? (
          <div className="space-y-6">
            {/* Visa customer-komponenterna */}
            <ServiceExcellenceDashboard customer={customer} />
            <CustomerStatistics customer={customer} />
          </div>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <p className="text-amber-400">Enheten saknar koppling till kunddata</p>
              <p className="text-slate-500 text-sm mt-2">
                Kör länkningsfunktionen för att koppla enheter till kunder
              </p>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/link-sites-to-customers', {
                      method: 'POST'
                    })
                    const data = await response.json()
                    console.log('Linking result:', data)
                    window.location.reload()
                  } catch (error) {
                    console.error('Error linking sites:', error)
                  }
                }}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Koppla enheter till kunder
              </button>
            </div>
          </Card>
        )}
      </div>
    </OrganisationLayout>
  )
}

export default VerksamhetschefStatistik