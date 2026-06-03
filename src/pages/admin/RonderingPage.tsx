// src/pages/admin/RonderingPage.tsx
// Admin-sida för Rondering Trafikkontoret — visar regionalkunder och deras rondering-historik

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Map, Building2 } from 'lucide-react'
import RonderingRapportView from '../../components/admin/RonderingRapportView'

interface RegionalOrg {
  organization_id: string
  name: string
}

export default function RonderingPage() {
  const [orgs, setOrgs] = useState<RegionalOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<RegionalOrg | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('customers')
          .select('organization_id, company_name')
          .eq('is_multisite', true)
          .eq('site_type', 'enhet')
          .not('organization_id', 'is', null)

        if (!data) return

        // Deduplica på organization_id, ta första company_name per org
        const seen = new Set<string>()
        const unique: RegionalOrg[] = []
        for (const row of data) {
          if (row.organization_id && !seen.has(row.organization_id)) {
            seen.add(row.organization_id)
            unique.push({ organization_id: row.organization_id, name: row.company_name || row.organization_id })
          }
        }
        setOrgs(unique)
        if (unique.length > 0) setSelectedOrg(unique[0])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex h-full min-h-0">
      {/* Vänster kolumn — kundlista */}
      <div className="w-64 flex-shrink-0 border-r border-slate-700 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Regionalkunder</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-4 py-6 text-xs text-slate-500 text-center">Laddar...</div>
          ) : orgs.length === 0 ? (
            <div className="px-4 py-6 text-xs text-slate-500 text-center">Inga regionalkunder hittades</div>
          ) : (
            orgs.map(org => (
              <button
                key={org.organization_id}
                type="button"
                onClick={() => setSelectedOrg(org)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors ${
                  selectedOrg?.organization_id === org.organization_id
                    ? 'bg-sky-500/10 border-r-2 border-sky-400 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" />
                <span className="text-sm truncate">{org.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Höger kolumn — rondering-rapport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedOrg ? (
          <>
            <div className="px-6 py-4 border-b border-slate-700 flex items-center gap-2">
              <Map className="w-5 h-5 text-sky-400" />
              <h1 className="text-lg font-semibold text-white">Rondering Trafikkontoret</h1>
              <span className="text-sm text-slate-400">— {selectedOrg.name}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <RonderingRapportView
                key={selectedOrg.organization_id}
                isOpen={true}
                onClose={() => {}}
                organizationId={selectedOrg.organization_id}
                organizationName={selectedOrg.name}
                mode="page"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Map className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Välj en kund i listan till vänster</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
