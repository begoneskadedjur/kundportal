// src/pages/shared/SpecialReportsPage.tsx
// Specialrapporter (/technician|/koordinator/specialrapporter): lista med sök,
// filter (Alla, Pågående, Skickade), status per rapport och snabbhandlingar.
// Tabell på desktop, kort på mobil. Ligger under pages/shared eftersom samma
// sida används av tekniker, koordinator och admin.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { Icon } from '../../components/icons/Icon'
import { SpecialReportService } from '../../services/specialReportService'
import type { SpecialReportListItem } from '../../types/specialReport'
import NewSpecialReportModal from '../../components/shared/specialReports/NewSpecialReportModal'
import {
  IKON_KNAPP,
  PRIMAR_KNAPP,
  STATUS_FARG,
  datumAv,
  laddaNed,
  rapportStatus,
  senastAndrad,
  useSpecialReportBase,
  type RapportStatus,
} from '../../components/shared/specialReports/specialReportUtils'

type Filter = 'alla' | 'pagaende' | 'skickade'

const FILTER: { id: Filter; namn: string }[] = [
  { id: 'alla', namn: 'Alla' },
  { id: 'pagaende', namn: 'Pågående' },
  { id: 'skickade', namn: 'Skickade' },
]

function statusRader(r: SpecialReportListItem, s: RapportStatus): { huvud: string; under: string } {
  if (s === 'utkast') return { huvud: 'Utkast', under: 'Aldrig skickad' }
  if (s === 'pagar') {
    return {
      huvud: `Version ${r.current_version} pågår`,
      under: `Version ${r.last_sent_version} skickad ${datumAv(r.last_sent_at)}`,
    }
  }
  return { huvud: `Skickad, version ${r.last_sent_version}`, under: datumAv(r.last_sent_at) }
}

export default function SpecialReportsPage() {
  const navigate = useNavigate()
  const base = useSpecialReportBase()
  const [rapporter, setRapporter] = useState<SpecialReportListItem[] | null>(null)
  const [sok, setSok] = useState('')
  const [filter, setFilter] = useState<Filter>('alla')
  const [visaNy, setVisaNy] = useState(false)
  const [laddarNed, setLaddarNed] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Specialrapporter - BeGone'
    // Teknikervyn visar bara egna och delaktiga rapporter, även för admin
    SpecialReportService.list({ endastMina: base.startsWith('/technician') })
      .then(setRapporter)
      .catch(e => {
        toast.error(e instanceof Error ? e.message : 'Kunde inte hämta rapporterna')
        setRapporter([])
      })
  }, [base])

  const synliga = useMemo(() => {
    const q = sok.trim().toLowerCase()
    return (rapporter ?? [])
      .map(r => ({ r, status: rapportStatus(r) }))
      .filter(({ status }) => filter === 'alla' || (filter === 'skickade' ? status === 'skickad' : status !== 'skickad'))
      .filter(({ r }) => !q || [r.title, r.customer_name, r.case_number, r.customer_number]
        .some(v => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => b.r.updated_at.localeCompare(a.r.updated_at))
  }, [rapporter, sok, filter])

  const laddaNedPdf = async (r: SpecialReportListItem) => {
    setLaddarNed(r.id)
    try {
      const { url, filename } = await SpecialReportService.downloadPdf(r.id)
      await laddaNed(url, filename)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta fram PDF:en')
    } finally {
      setLaddarNed(null)
    }
  }

  const handlingar = (r: SpecialReportListItem) => (
    <span className="flex justify-end gap-1.5">
      <Link to={`${base}/${r.id}`} aria-label="Fortsätt redigera" title="Fortsätt redigera" className={IKON_KNAPP}>
        <Icon name="allman.anteckning" size={20} />
      </Link>
      <button type="button" aria-label="Ladda ned PDF" title="Ladda ned PDF" onClick={() => laddaNedPdf(r)} disabled={laddarNed === r.id} className={IKON_KNAPP}>
        {laddarNed === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
      </button>
      <Link to={`${base}/${r.id}?skicka=1`} aria-label="Skicka till kund" title="Skicka till kund" className={IKON_KNAPP}>
        <Icon name="rapport.skicka" size={20} />
      </Link>
    </span>
  )

  const statusCell = (r: SpecialReportListItem, s: RapportStatus) => {
    const t = statusRader(r, s)
    return (
      <span className="flex flex-col gap-0.5">
        <span className={`flex items-center gap-2 text-sm ${STATUS_FARG[s].text}`}>
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_FARG[s].punkt}`} />
          {t.huvud}
        </span>
        <span className="text-xs text-slate-500">{t.under}</span>
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-white">Specialrapporter</h1>
          <p className="max-w-[620px] text-sm text-slate-400">
            En fri rapport kopplad till ett ärende. Dela in den som det passar uppdraget: per område, per besök eller per underleverantör. Spara, fortsätt senare och skicka en ny version när något har hänt.
          </p>
        </div>
        <button type="button" onClick={() => setVisaNy(true)} className={PRIMAR_KNAPP}>
          <Icon name="allman.plus" size={20} />
          Ny rapport
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-[#20c58f]/50 sm:max-w-[420px]">
          <Icon name="allman.sok" size={16} />
          <input
            aria-label="Sök rapport, kund eller ärendenummer"
            placeholder="Sök rapport, kund eller BE-nummer"
            value={sok}
            onChange={e => setSok(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </label>
        <div role="tablist" aria-label="Filter" className="flex gap-1 rounded-xl border border-slate-700/60 bg-slate-900/60 p-1">
          {FILTER.map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-lg px-3.5 text-sm transition-colors ${filter === f.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {f.namn}
            </button>
          ))}
        </div>
      </div>

      {rapporter === null ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : synliga.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 py-10 text-center">
          <Icon name="rapport.rapport" size={32} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm text-slate-400">
            {rapporter.length === 0 ? 'Inga specialrapporter än. Skapa den första med Ny rapport.' : 'Inga rapporter matchar sökningen.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabell */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 lg:block">
            <div className="grid grid-cols-[2.2fr_1.6fr_1fr_1.2fr_1.3fr_150px] gap-4 border-b border-slate-700/60 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">
              <span>Rapport</span><span>Kund och ärende</span><span>Innehåll</span><span>Senast ändrad</span><span>Status</span><span />
            </div>
            {synliga.map(({ r, status }) => (
              <div key={r.id} className="grid grid-cols-[2.2fr_1.6fr_1fr_1.2fr_1.3fr_150px] items-center gap-4 border-b border-slate-700/60 px-5 py-4 last:border-b-0 hover:bg-slate-800/30">
                <button type="button" onClick={() => navigate(`${base}/${r.id}`)} className="flex min-w-0 items-center gap-3 text-left">
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${status === 'pagar' ? 'bg-[#20c58f]/15 text-[#20c58f]' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon name="rapport.rapport" size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{r.title}</span>
                    <span className="block text-xs text-slate-400">{r.doc_type}</span>
                  </span>
                </button>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-200">{r.customer_name || 'Okänd kund'}</span>
                  <span className="block truncate font-mono text-xs text-slate-500">
                    {[r.case_number, r.customer_number ? `kundnr ${r.customer_number}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-sm text-slate-300">
                  {r.section_count} {r.section_count === 1 ? 'del' : 'delar'}
                  <span className="block text-slate-500">{r.event_count} {r.event_count === 1 ? 'händelse' : 'händelser'}</span>
                </span>
                <span className="text-sm text-slate-300">
                  {senastAndrad(r.updated_at)}
                  {r.updated_by_name && <span className="block text-slate-500">{r.updated_by_name}</span>}
                </span>
                {statusCell(r, status)}
                {handlingar(r)}
              </div>
            ))}
          </div>

          {/* Mobil: kort */}
          <ul className="space-y-2.5 lg:hidden">
            {synliga.map(({ r, status }) => (
              <li key={r.id} className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
                <button type="button" onClick={() => navigate(`${base}/${r.id}`)} className="flex w-full items-start gap-3 text-left">
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${status === 'pagar' ? 'bg-[#20c58f]/15 text-[#20c58f]' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon name="rapport.rapport" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">{r.title}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {r.customer_name || 'Okänd kund'}{r.case_number ? ` · ${r.case_number}` : ''}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {r.section_count} {r.section_count === 1 ? 'del' : 'delar'}, {r.event_count} {r.event_count === 1 ? 'händelse' : 'händelser'} · {senastAndrad(r.updated_at)}
                    </span>
                  </span>
                </button>
                <div className="flex items-center justify-between gap-3">
                  {statusCell(r, status)}
                  {handlingar(r)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <NewSpecialReportModal isOpen={visaNy} onClose={() => setVisaNy(false)} />
    </div>
  )
}
