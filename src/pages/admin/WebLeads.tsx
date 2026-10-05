// src/pages/admin/WebLeads.tsx
// Leads (Webb): förfrågningar från formulären på begone.se, i en egen pipeline skild från
// Leads (B2B). Flikar Inkorg (status ny, äldst först), Alla och Statistik. Realtid på web_inquiries.
// Används av /admin, /koordinator och /saljare (leads-webb). ?id=<uuid> öppnar en förfrågan direkt.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Inbox, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { WebInquiryService } from '../../services/webInquiryService'
import { refreshWebLeadsBadge } from '../../hooks/useWebLeadsBadge'
import WebLeadDetailModal from '../../components/admin/webLeads/WebLeadDetailModal'
import WebLeadsStats from '../../components/admin/webLeads/WebLeadsStats'
import { formatSvTid, svDatum } from '../../components/admin/webLeads/format'
import { adressDelar, formatPostnummer } from '../../shared/webLeadUppgifter'
import {
  KUNDGRUPP_LABEL,
  STATUS_CONFIG,
  STATUS_ORDNING,
  kallaLabel,
  tjanstLabel,
  type StaffProfile,
  type WebInquiry,
  type WebInquiryKundgrupp,
  type WebInquiryStatus,
} from '../../types/webInquiry'

type Flik = 'inkorg' | 'alla' | 'statistik'

interface Filter {
  status: WebInquiryStatus | ''
  tjanst: string
  kalla: string
  kundgrupp: WebInquiryKundgrupp | ''
  fran: string
  till: string
}

const TOMT_FILTER: Filter = { status: '', tjanst: '', kalla: '', kundgrupp: '', fran: '', till: '' }
const FILTER_NYCKEL = 'begone_leads_webb_filter'

function lasFilter(): Filter {
  try {
    const raw = localStorage.getItem(FILTER_NYCKEL)
    return raw ? { ...TOMT_FILTER, ...(JSON.parse(raw) as Partial<Filter>) } : TOMT_FILTER
  } catch {
    return TOMT_FILTER
  }
}

function sparaFilter(f: Filter) {
  try {
    localStorage.setItem(FILTER_NYCKEL, JSON.stringify(f))
  } catch {
    // localStorage kan saknas (privat fönster)
  }
}

const FALT = 'px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]'

export default function WebLeads() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [inquiries, setInquiries] = useState<WebInquiry[]>([])
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [flik, setFlik] = useState<Flik>('inkorg')
  const [filter, setFilter] = useState<Filter>(lasFilter)

  const base = location.pathname.startsWith('/koordinator') ? '/koordinator' : location.pathname.startsWith('/saljare') ? '/saljare' : '/admin'
  const valtId = searchParams.get('id')

  const ladda = useCallback(async () => {
    try {
      const rader = await WebInquiryService.list()
      setInquiries(rader)
    } catch {
      toast.error('Förfrågningarna kunde inte hämtas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void ladda()
    WebInquiryService.listStaff().then(setStaff).catch(() => setStaff([]))
    const kanal = supabase
      .channel('web-inquiries-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'web_inquiries' }, () => void ladda())
      .subscribe()
    return () => {
      supabase.removeChannel(kanal)
    }
  }, [ladda])

  // En förfrågan som öppnas via länk men inte finns i listan (t.ex. äldre) hämtas för sig
  useEffect(() => {
    if (!valtId || loading || inquiries.some((i) => i.id === valtId)) return
    WebInquiryService.get(valtId)
      .then((rad) => {
        if (rad) setInquiries((prev) => (prev.some((i) => i.id === rad.id) ? prev : [rad, ...prev]))
      })
      .catch(() => undefined)
  }, [valtId, loading, inquiries])

  const andraFilter = (patch: Partial<Filter>) => {
    setFilter((prev) => {
      const nytt = { ...prev, ...patch }
      sparaFilter(nytt)
      return nytt
    })
  }

  const tjanster = useMemo(() => [...new Set(inquiries.map((i) => tjanstLabel(i.pest_type)))].sort((a, b) => a.localeCompare(b, 'sv')), [inquiries])
  const kallor = useMemo(() => [...new Set(inquiries.map((i) => kallaLabel(i)))].sort((a, b) => a.localeCompare(b, 'sv')), [inquiries])

  const nyaAntal = useMemo(() => inquiries.filter((i) => i.status === 'ny').length, [inquiries])

  const synliga = useMemo(() => {
    if (flik === 'inkorg') {
      return inquiries
        .filter((i) => i.status === 'ny')
        .sort((a, b) => Number(b.akut) - Number(a.akut) || a.created_at.localeCompare(b.created_at))
    }
    return inquiries.filter((i) => {
      if (filter.status && i.status !== filter.status) return false
      if (filter.tjanst && tjanstLabel(i.pest_type) !== filter.tjanst) return false
      if (filter.kalla && kallaLabel(i) !== filter.kalla) return false
      if (filter.kundgrupp && i.kundgrupp !== filter.kundgrupp) return false
      const dag = svDatum(i.created_at)
      if (filter.fran && dag < filter.fran) return false
      if (filter.till && dag > filter.till) return false
      return true
    })
  }, [inquiries, flik, filter])

  const vald = useMemo(() => inquiries.find((i) => i.id === valtId) ?? null, [inquiries, valtId])

  const oppna = (id: string) => setSearchParams((p) => { p.set('id', id); return p })
  const stang = () => setSearchParams((p) => { p.delete('id'); return p })

  const namnFor = (id: string | null) => {
    if (!id) return ''
    const p = staff.find((s) => s.id === id)
    return p ? p.display_name || p.email : ''
  }

  const flikar: { id: Flik; label: string }[] = [
    { id: 'inkorg', label: nyaAntal ? `Inkorg (${nyaAntal})` : 'Inkorg' },
    { id: 'alla', label: 'Alla' },
    { id: 'statistik', label: 'Statistik' },
  ]

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads (Webb)</h1>
          <p className="text-sm text-slate-400 mt-1">Förfrågningar från formulären på begone.se. B2B-leads finns under Leads (B2B).</p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); void ladda(); refreshWebLeadsBadge() }}
          className="p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          aria-label="Uppdatera"
          title="Uppdatera"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex border-b border-slate-700/50">
        {flikar.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFlik(f.id)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              flik === f.id ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {flik === 'statistik' ? (
        <WebLeadsStats inquiries={inquiries} />
      ) : (
        <>
          {flik === 'alla' && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-status">Status</label>
                <select id="wl-status" className={FALT} value={filter.status} onChange={(e) => andraFilter({ status: e.target.value as WebInquiryStatus | '' })}>
                  <option value="">Alla</option>
                  {STATUS_ORDNING.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-tjanst">Tjänst</label>
                <select id="wl-tjanst" className={FALT} value={filter.tjanst} onChange={(e) => andraFilter({ tjanst: e.target.value })}>
                  <option value="">Alla</option>
                  {tjanster.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-kalla">Källa</label>
                <select id="wl-kalla" className={FALT} value={filter.kalla} onChange={(e) => andraFilter({ kalla: e.target.value })}>
                  <option value="">Alla</option>
                  {kallor.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-kundgrupp">Kundgrupp</label>
                <select id="wl-kundgrupp" className={FALT} value={filter.kundgrupp} onChange={(e) => andraFilter({ kundgrupp: e.target.value as WebInquiryKundgrupp | '' })}>
                  <option value="">Alla</option>
                  {(Object.keys(KUNDGRUPP_LABEL) as WebInquiryKundgrupp[]).map((k) => <option key={k} value={k}>{KUNDGRUPP_LABEL[k]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-fran">Från</label>
                <input id="wl-fran" type="date" className={FALT} value={filter.fran} onChange={(e) => andraFilter({ fran: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wl-till">Till</label>
                <input id="wl-till" type="date" className={FALT} value={filter.till} onChange={(e) => andraFilter({ till: e.target.value })} />
              </div>
              {JSON.stringify(filter) !== JSON.stringify(TOMT_FILTER) && (
                <button type="button" onClick={() => andraFilter(TOMT_FILTER)} className="px-2 py-1.5 text-sm text-slate-400 hover:text-white">
                  Rensa filter
                </button>
              )}
            </div>
          )}

          <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-x-auto">
            {loading && inquiries.length === 0 ? (
              <p className="p-6 text-sm text-slate-400">Hämtar förfrågningar...</p>
            ) : synliga.length === 0 ? (
              <div className="py-10 text-center">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {flik === 'inkorg' ? 'Inga nya förfrågningar. Allt är hanterat.' : 'Inga förfrågningar matchar filtret.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Inkom</th>
                    <th className="px-3 py-2 font-medium">Nummer</th>
                    <th className="px-3 py-2 font-medium">Namn</th>
                    <th className="px-3 py-2 font-medium">Tjänst</th>
                    <th className="px-3 py-2 font-medium">Ort</th>
                    <th className="px-3 py-2 font-medium">Kundgrupp</th>
                    <th className="px-3 py-2 font-medium">Källa</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Ärende</th>
                    <th className="px-3 py-2 font-medium">Tilldelad</th>
                  </tr>
                </thead>
                <tbody>
                  {synliga.map((i) => {
                    const s = STATUS_CONFIG[i.status]
                    return (
                      <tr
                        key={i.id}
                        onClick={() => oppna(i.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') oppna(i.id) }}
                        tabIndex={0}
                        className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/50 cursor-pointer focus:outline-none focus-visible:bg-slate-800/60"
                      >
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap font-mono text-xs">{formatSvTid(i.created_at)}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{i.referens}</td>
                        <td className="px-3 py-2 text-white">
                          {i.company_name ? (
                            <>
                              <span className="block">{i.company_name}</span>
                              <span className="block text-xs text-slate-400">{i.name}</span>
                            </>
                          ) : i.name}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {tjanstLabel(i.pest_type)}
                          {i.bilder.some((b) => b.uppladdad) && <span className="text-xs text-slate-500"> · bild</span>}
                          {i.bokad_tjanst && i.bokad_tjanst !== tjanstLabel(i.pest_type) && (
                            <span className="block text-xs text-slate-400">Bokad: {i.bokad_tjanst}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{adressDelar(i).ort || formatPostnummer(i.postal_code)}</td>
                        <td className="px-3 py-2 text-slate-300">{KUNDGRUPP_LABEL[i.kundgrupp]}</td>
                        <td className="px-3 py-2 text-slate-400">{kallaLabel(i)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`flex items-center gap-1.5 ${s.text}`}>
                            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          {i.akut && (
                            <span className="flex items-center gap-1.5 text-red-400 text-xs mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              Akut
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-mono text-xs whitespace-nowrap">{i.arende_nummer ?? ''}</td>
                        <td className="px-3 py-2 text-slate-400">{namnFor(i.tilldelad_till)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <WebLeadDetailModal
        inquiry={vald}
        staff={staff}
        basePath={base}
        leadsBasePath={`${base}/leads`}
        arendeSokPath={base === '/saljare' ? null : '/koordinator/sok-arenden'}
        onClose={stang}
        onChanged={(upd) => setInquiries((prev) => prev.map((i) => (i.id === upd.id ? { ...i, ...upd } : i)))}
      />
    </div>
  )
}
