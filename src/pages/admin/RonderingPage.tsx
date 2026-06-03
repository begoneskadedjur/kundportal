// src/pages/admin/RonderingPage.tsx
// Admin-sida för Egenkontroller — regionalkunder, rondering-historik och PDF-export

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Map, Building2, FileDown } from 'lucide-react'
import RonderingRapportView, { StatusFilter } from '../../components/admin/RonderingRapportView'
import { generateRonderingPdf } from '../../utils/ronderingPdfGenerator'
import toast from 'react-hot-toast'

interface RegionalOrg {
  organization_id: string
  name: string
}

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Alla',
  active: 'Pågående',
  closed: 'Avslutade',
}

export default function RonderingPage() {
  const [orgs, setOrgs] = useState<RegionalOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrg, setSelectedOrg] = useState<RegionalOrg | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [exportingPdf, setExportingPdf] = useState(false)

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

  const handleExportPdf = async () => {
    if (!selectedOrg) return
    setExportingPdf(true)
    try {
      // Hämta data direkt från Supabase klient-side
      const { data: sites } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('organization_id', selectedOrg.organization_id)
        .eq('site_type', 'enhet')
        .eq('is_multisite', true)

      const siteIds = (sites || []).map(s => s.id)
      const siteNameMap = Object.fromEntries((sites || []).map(s => [s.id, s.company_name]))
      if (siteIds.length === 0) { toast.error('Inga regioner hittades'); return }

      let query = supabase
        .from('cases')
        .select('id, case_number, title, customer_id, scheduled_start, status, primary_technician_name')
        .eq('service_type', 'rondering_trafikkontoret')
        .in('customer_id', siteIds)
        .order('scheduled_start', { ascending: false })

      if (statusFilter === 'closed') query = query.ilike('status', '%avslutat%')
      else if (statusFilter === 'active') query = query.not('status', 'ilike', '%avslutat%')

      const { data: rawCases } = await query
      if (!rawCases || rawCases.length === 0) { toast('Inga ärenden att exportera'); return }

      const { data: placements } = await supabase
        .from('equipment_placements')
        .select('id, customer_id, serial_number')
        .in('customer_id', siteIds)
        .eq('status', 'active')

      const stationCountMap: Record<string, number> = {}
      const serialMap: Record<string, string> = {}
      for (const p of placements || []) {
        stationCountMap[p.customer_id] = (stationCountMap[p.customer_id] || 0) + 1
        if (p.serial_number) serialMap[p.id] = p.serial_number
      }

      const { RonderingService } = await import('../../services/ronderingService')
      const pdfCases = await Promise.all(rawCases.map(async (c) => {
        const [logs, annotations] = await Promise.all([
          RonderingService.getLogsForCase(c.id),
          RonderingService.getAnnotationsForCase(c.id),
        ])
        return {
          case_number: c.case_number,
          title: c.title,
          customer_name: siteNameMap[c.customer_id] || null,
          scheduled_start: c.scheduled_start,
          status: c.status,
          primary_technician_name: c.primary_technician_name,
          inspected: logs.length,
          total: stationCountMap[c.customer_id] || 0,
          actionRequired: logs.filter(l => l.status === 'action_required').length,
          missing: logs.filter(l => l.status === 'missing').length,
          baitSummary: {
            all: logs.filter(l => l.bait_consumed === 'all').length,
            partial: logs.filter(l => l.bait_consumed === 'partial').length,
            none: logs.filter(l => l.bait_consumed === 'none').length,
          },
          annotations: annotations.map(a => ({
            category: a.category,
            note: a.note,
            technician_name: a.technician_name,
            created_at: a.created_at,
          })),
        }
      }))

      // Högriskstationer
      const allCaseIds = rawCases.map(c => c.id)
      const { data: allLogs } = await supabase
        .from('rondering_station_logs')
        .select('station_id, bait_consumed, inspected_at')
        .in('case_id', allCaseIds)
        .eq('bait_consumed', 'all')

      const stationAllCount: Record<string, { count: number; lastInspected: string | null }> = {}
      for (const log of allLogs || []) {
        const e = stationAllCount[log.station_id]
        if (!e) stationAllCount[log.station_id] = { count: 1, lastInspected: log.inspected_at }
        else { e.count++; if (log.inspected_at > (e.lastInspected || '')) e.lastInspected = log.inspected_at }
      }

      const highRisk = Object.entries(stationAllCount)
        .filter(([, v]) => v.count >= 2)
        .map(([station_id, v]) => ({ station_id, serial_number: serialMap[station_id] || null, allCount: v.count, lastInspected: v.lastInspected }))
        .sort((a, b) => b.allCount - a.allCount)

      generateRonderingPdf(selectedOrg.name, pdfCases, highRisk, FILTER_LABELS[statusFilter])
    } catch (e: any) {
      toast.error(e.message || 'Kunde inte generera PDF')
    } finally {
      setExportingPdf(false)
    }
  }

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

      {/* Höger kolumn */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedOrg ? (
          <>
            {/* Header med filter + PDF-knapp */}
            <div className="px-6 py-3 border-b border-slate-700 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Map className="w-5 h-5 text-sky-400 flex-shrink-0" />
                <h1 className="text-base font-semibold text-white truncate">Egenkontroller</h1>
                <span className="text-sm text-slate-400 truncate">— {selectedOrg.name}</span>
              </div>

              {/* Statusfilter */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                {(['all', 'active', 'closed'] as StatusFilter[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      statusFilter === f
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>

              {/* PDF-export */}
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20c58f]/10 border border-[#20c58f]/30 text-[#20c58f] text-xs font-medium hover:bg-[#20c58f]/20 transition-colors disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingPdf ? 'Genererar...' : 'Exportera PDF'}
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <RonderingRapportView
                key={`${selectedOrg.organization_id}-${statusFilter}`}
                isOpen={true}
                onClose={() => {}}
                organizationId={selectedOrg.organization_id}
                organizationName={selectedOrg.name}
                mode="page"
                statusFilter={statusFilter}
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
