// src/pages/organisation/verksamhetschef/Schema.tsx - Schema för verksamhetschef
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { Calendar, MapPin, User, Clock } from 'lucide-react'

// Återanvänd befintlig schedule-komponent från customer
import CustomerSchedule from '../../../components/customer/CustomerSchedule'

const VerksamhetschefSchema: React.FC = () => {
  const { organization, sites, loading: contextLoading } = useMultisite()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [customerId, setCustomerId] = useState<string | null>(null)
  
  useEffect(() => {
    // Om en specifik site är vald, hämta dess customer_id
    if (selectedSiteId !== 'all') {
      const site = sites.find(s => s.id === selectedSiteId)
      setCustomerId(site?.customer_id || null)
    } else {
      setCustomerId(null)
    }
  }, [selectedSiteId, sites])

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar schema..." />
      </div>
    )
  }

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <h1 className="text-2xl font-bold text-white mb-2">
            Schema - {organization?.organization_name}
          </h1>
          <p className="text-purple-200">
            Översikt över alla schemalagda besök
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
              <option value="all">Alla enheter</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.site_name} - {site.region}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Schema content */}
        {selectedSiteId === 'all' ? (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Välj en specifik enhet för att se schemat</p>
              <p className="text-slate-500 text-sm mt-2">
                Schemat visas per enhet för bättre översikt
              </p>
            </div>
          </Card>
        ) : customerId ? (
          <CustomerSchedule customerId={customerId} />
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-amber-600 mx-auto mb-4" />
              <p className="text-amber-400">Enheten saknar koppling till kunddata</p>
              <p className="text-slate-500 text-sm mt-2">
                Kontakta administratören för att koppla enheten till en kund
              </p>
            </div>
          </Card>
        )}
      </div>
    </OrganisationLayout>
  )
}

export default VerksamhetschefSchema