// src/pages/admin/WebLeads.tsx
// Leads (Webb): förfrågningar från formulären på begone.se, i en egen pipeline skild från
// Leads (B2B). Flikar Inkorg (status ny, akuta först och sedan äldst först), Alla och Statistik.
// Realtid på web_inquiries. Används av /admin, /koordinator och /saljare (leads-webb).
// Flik och filter står i adressen (flik, q, status, tjanst, kundgrupp, kalla, tilldelad, fran, till,
// arkiv) så att en länk visar samma urval; ?id=<uuid> öppnar en förfrågan direkt.
// Arkiverade förfrågningar (archived_at) döljs i Inkorg och Alla tills Visa arkiverade är ikryssat.
// Överst finns ingången till Marknad (annonser, kostnader och utfall), låst utan behörigheten
// Marknadsansvarig (profiles.can_view_marketing).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronRight, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { WebInquiryService } from '../../services/webInquiryService'
import { refreshWebLeadsBadge } from '../../hooks/useWebLeadsBadge'
import Button from '../../components/ui/Button'
import WebLeadDetailModal from '../../components/admin/webLeads/WebLeadDetailModal'
import WebLeadsStats from '../../components/admin/webLeads/WebLeadsStats'
import WebLeadsTabell from '../../components/admin/webLeads/WebLeadsTabell'
import WebLeadsFilterRad from '../../components/admin/webLeads/WebLeadsFilterRad'
import { LeadIcon, type TjanstIkon } from '../../components/admin/webLeads/WebLeadIcons'
import { AI_KALLA_ORDNING, kanalFor, tjanstNyckel } from '../../components/admin/webLeads/leadKlassning'
import {
  FILTER_NYCKLAR,
  aktivaFilter,
  filtrera,
  lasFilter,
  lasFlik,
  sortera,
  type AktivtFilter,
  type Flik,
} from '../../components/admin/webLeads/leadFilter'
import type { StaffProfile, WebInquiry } from '../../types/webInquiry'

export default function WebLeads() {
  const location = useLocation()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [inquiries, setInquiries] = useState<WebInquiry[]>([])
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [valda, setValda] = useState<Set<string>>(new Set())
  const [arbetar, setArbetar] = useState(false)

  const base = location.pathname.startsWith('/koordinator') ? '/koordinator' : location.pathname.startsWith('/saljare') ? '/saljare' : '/admin'
  const valtId = searchParams.get('id')
  const flik = lasFlik(searchParams)
  const filter = useMemo(() => lasFilter(searchParams), [searchParams])
  const minProfilId = profile?.id ?? null
  const kanMarknad = !!(profile as { can_view_marketing?: boolean } | null)?.can_view_marketing

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

  // Markeringen gäller det man ser: byte av flik eller filter tömmer den
  const urvalsNyckel = useMemo(() => {
    const p = new URLSearchParams(searchParams)
    p.delete('id')
    return p.toString()
  }, [searchParams])
  useEffect(() => {
    setValda(new Set())
  }, [urvalsNyckel])

  const andraParam = (nyckel: AktivtFilter['nyckel'] | 'flik', varde: string) => {
    setSearchParams(
      (p) => {
        if (varde) p.set(nyckel, varde)
        else p.delete(nyckel)
        return p
      },
      // Fritext skrivs tecken för tecken: ersätt i historiken i stället för att lägga till
      { replace: nyckel === 'q' },
    )
  }

  const rensaFilter = () => {
    setSearchParams((p) => {
      for (const k of FILTER_NYCKLAR) p.delete(k)
      return p
    })
  }

  const bytFlik = (f: Flik) => andraParam('flik', f === 'inkorg' ? '' : f)

  const ejArkiverade = useMemo(() => inquiries.filter((i) => !i.archived_at), [inquiries])
  const nyaAntal = useMemo(() => ejArkiverade.filter((i) => i.status === 'ny').length, [ejArkiverade])
  const tjanster = useMemo(() => new Set<TjanstIkon>(inquiries.map((i) => tjanstNyckel(i.pest_type))), [inquiries])
  // Källorna inom AI-assistent och Hänvisning som finns i datan: AI i listans ordning, hänvisningar
  // efter antal och sedan namn
  const underkallor = useMemo(() => {
    const ai = new Map<string, { nyckel: string; namn: string; n: number }>()
    const hanv = new Map<string, { nyckel: string; namn: string; n: number }>()
    for (const i of inquiries) {
      const k = kanalFor(i)
      if (!k.under || (k.kanal !== 'ai' && k.kanal !== 'hanvisning')) continue
      const m = k.kanal === 'ai' ? ai : hanv
      const fore = m.get(k.under.nyckel)
      m.set(k.under.nyckel, { ...k.under, n: (fore?.n ?? 0) + 1 })
    }
    return {
      ai: AI_KALLA_ORDNING.filter((a) => ai.has(a)).map((a) => ai.get(a)!),
      hanvisning: [...hanv.values()].sort((a, b) => b.n - a.n || a.namn.localeCompare(b.namn, 'sv')),
    }
  }, [inquiries])

  const synliga = useMemo(() => sortera(filtrera(inquiries, filter, flik, minProfilId), flik), [inquiries, filter, flik, minProfilId])
  const doldaArkiverade = useMemo(
    () => (filter.arkiv ? 0 : filtrera(inquiries, { ...filter, arkiv: true }, flik, minProfilId).length - synliga.length),
    [inquiries, filter, flik, minProfilId, synliga.length],
  )
  const aktiva = aktivaFilter(filter, flik, staff)

  const vald = useMemo(() => inquiries.find((i) => i.id === valtId) ?? null, [inquiries, valtId])

  const oppna = (id: string) => setSearchParams((p) => { p.set('id', id); return p })
  const stang = () => setSearchParams((p) => { p.delete('id'); return p })

  const uppdateraRader = (rader: Partial<WebInquiry>[]) => {
    const perId = new Map(rader.filter((r) => r.id).map((r) => [r.id as string, r]))
    setInquiries((prev) => prev.map((i) => (perId.has(i.id) ? { ...i, ...perId.get(i.id) } : i)))
  }

  const arkivera = async (ids: string[], ark: boolean, tyst = false): Promise<void> => {
    if (!ids.length) return
    setArbetar(true)
    try {
      const rader = await WebInquiryService.setArchived(ids, ark)
      uppdateraRader(rader)
      setValda((prev) => {
        const nya = new Set(prev)
        ids.forEach((id) => nya.delete(id))
        return nya
      })
      refreshWebLeadsBadge()
      if (tyst) return
      const text = ark
        ? ids.length === 1 ? 'Förfrågan arkiverad' : `${ids.length} förfrågningar arkiverade`
        : ids.length === 1 ? 'Förfrågan återställd' : `${ids.length} förfrågningar återställda`
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            {text}
            <button
              type="button"
              className="text-[#20c58f] font-medium hover:underline"
              onClick={() => {
                toast.dismiss(t.id)
                void arkivera(ids, !ark, true)
              }}
            >
              Ångra
            </button>
          </span>
        ),
        { duration: 6000 },
      )
    } catch {
      toast.error(ark ? 'Arkiveringen kunde inte sparas' : 'Återställningen kunde inte sparas')
    } finally {
      setArbetar(false)
    }
  }

  const ta = async (id: string) => {
    if (!minProfilId) return
    try {
      await WebInquiryService.assign(id, minProfilId)
      uppdateraRader([{ id, tilldelad_till: minProfilId }])
      toast.success('Förfrågan tilldelad dig')
    } catch {
      toast.error('Tilldelningen kunde inte sparas')
    }
  }

  const valdaRader = synliga.filter((i) => valda.has(i.id))
  const attArkivera = valdaRader.filter((i) => !i.archived_at).map((i) => i.id)
  const attAterstalla = valdaRader.filter((i) => i.archived_at).map((i) => i.id)

  const tomText =
    aktiva.length > 0
      ? 'Inga förfrågningar matchar filtret.'
      : flik === 'inkorg'
        ? 'Inga nya förfrågningar. Allt är hanterat.'
        : 'Inga förfrågningar än.'

  const flikar: { id: Flik; label: string; antal?: number }[] = [
    { id: 'inkorg', label: 'Inkorg', antal: nyaAntal },
    { id: 'alla', label: 'Alla' },
    { id: 'statistik', label: 'Statistik' },
  ]

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Leads (Webb)</h1>
            <button
              type="button"
              onClick={() => { setLoading(true); void ladda(); refreshWebLeadsBadge() }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              aria-label="Uppdatera"
              title="Uppdatera"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">Förfrågningar från formulären på begone.se. B2B-leads finns under Leads (B2B).</p>
        </div>

        {/* Ingången till Marknad */}
        {kanMarknad ? (
          <Link
            to={`${base}/leads-webb/marknad`}
            className="group flex items-center gap-3 pl-3 pr-2 py-2 w-full sm:w-auto bg-slate-800/30 border border-slate-700 rounded-xl hover:border-[#20c58f]/60 hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <span className="w-9 h-9 rounded-lg grid place-items-center flex-none bg-[#20c58f]/15 text-[#20c58f]">
              <LeadIcon name="marknad" className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">Marknad: annonser, kostnader och utfall</span>
              <span className="block text-xs text-slate-400">Vad annonserna kostar och vad förfrågningarna blir</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] flex-none" />
          </Link>
        ) : (
          <div
            aria-disabled="true"
            title="Kräver behörigheten Marknadsansvarig"
            className="flex items-center gap-3 pl-3 pr-4 py-2 w-full sm:w-auto bg-slate-800/20 border border-slate-700/60 rounded-xl opacity-60 cursor-not-allowed select-none"
          >
            <span className="w-9 h-9 rounded-lg grid place-items-center flex-none bg-slate-700/40 text-slate-400">
              <LeadIcon name="las" className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-300">Marknad: annonser, kostnader och utfall</span>
              <span className="block text-xs text-slate-500">Kräver behörigheten Marknadsansvarig</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-700/50" role="tablist">
        {flikar.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={flik === f.id}
            onClick={() => bytFlik(f.id)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              flik === f.id ? 'border-[#20c58f] text-white font-medium' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
            {f.antal ? <span className={`ml-1.5 font-mono text-xs ${flik === f.id ? 'text-[#20c58f]' : 'text-amber-400'}`}>{f.antal}</span> : null}
          </button>
        ))}
      </div>

      {flik === 'statistik' ? (
        <WebLeadsStats inquiries={inquiries} />
      ) : (
        <>
          <WebLeadsFilterRad
            filter={filter}
            flik={flik}
            staff={staff}
            tjanster={tjanster}
            underkallor={underkallor}
            aktiva={aktiva}
            onAndra={andraParam}
            onRensa={rensaFilter}
          />

          {valdaRader.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#20c58f]/10 border border-[#20c58f]/40 rounded-xl text-sm">
              <span className="text-white font-medium mr-1">{valdaRader.length} markerade</span>
              {attArkivera.length > 0 && (
                <Button variant="secondary" size="sm" disabled={arbetar} onClick={() => void arkivera(attArkivera, true)}>
                  <LeadIcon name="arkiv" className="w-4 h-4 mr-1.5" />
                  Arkivera {attArkivera.length}
                </Button>
              )}
              {attAterstalla.length > 0 && (
                <Button variant="secondary" size="sm" disabled={arbetar} onClick={() => void arkivera(attAterstalla, false)}>
                  <LeadIcon name="aterstall" className="w-4 h-4 mr-1.5" />
                  Återställ {attAterstalla.length}
                </Button>
              )}
              <button
                type="button"
                onClick={() => setValda(new Set())}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                <X className="w-4 h-4" />
                Avmarkera
              </button>
            </div>
          )}

          <WebLeadsTabell
            rader={synliga}
            laddar={loading}
            staff={staff}
            minProfilId={minProfilId}
            valda={valda}
            onVal={(id) =>
              setValda((prev) => {
                const nya = new Set(prev)
                if (nya.has(id)) nya.delete(id)
                else nya.add(id)
                return nya
              })
            }
            onValAlla={(markera) => setValda(markera ? new Set(synliga.map((i) => i.id)) : new Set())}
            onOppna={oppna}
            onArkivera={(ids, ark) => void arkivera(ids, ark)}
            onTa={(id) => void ta(id)}
            tomText={tomText}
            harFilter={aktiva.length > 0}
            onRensaFilter={rensaFilter}
          />

          {!(loading && inquiries.length === 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {synliga.length === 1 ? '1 förfrågan' : `${synliga.length} förfrågningar`}
                {doldaArkiverade > 0 && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => andraParam('arkiv', '1')}
                      className="text-slate-400 hover:text-white underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                    >
                      {doldaArkiverade} arkiverade dolda
                    </button>
                  </>
                )}
              </span>
              <span className="hidden md:inline">Pil upp och ned flyttar, Enter öppnar, X markerar</span>
            </div>
          )}
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
