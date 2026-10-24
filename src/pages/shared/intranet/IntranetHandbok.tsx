// src/pages/shared/intranet/IntranetHandbok.tsx
// Handboken: guiderna för den vy man står i, i ämnen och läsordning
// (handbokSektioner.ts). Överst roll och hur mycket som är läst, sedan nästa guide
// att läsa, sedan ämnena. Sökrutan filtrerar inom ämnena.
//
// Varje roll ser bara sina egna guider (audience_roles). Filtret går på den vy man
// står i (activeView), så den som har flera roller inte ser tekniker- och
// kontorsversionen av samma guide bredvid varandra. Admin kan välja Visa alla
// rollers guider för att granska.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRoleBasePath } from '../../../hooks/useRoleBasePath'
import { IntranetService } from '../../../services/intranetService'
import { Icon } from '../../../components/icons/Icon'
import {
  forRollerna,
  type IntranetBlock,
  type IntranetDocumentWithStatus,
} from '../../../types/intranet'
import { HANDBOK_SEKTIONER, ROLL_NAMN, type HandbokSektion } from './handbokSektioner'
import { GUIDE_MODULER } from './guider/registry'

type Intro = Extract<IntranetBlock, { type: 'intro' }>

const introAv = (g: IntranetDocumentWithStatus): Intro | undefined =>
  g.content.find((b): b is Intro => b.type === 'intro')

/** Vem guiden är för, för admin som visar alla rollers guider */
function forVem(g: IntranetDocumentWithStatus): string {
  const r = g.audience_roles || []
  if (r.length === 0) return 'Alla'
  if (r.includes('technician')) return 'Tekniker'
  if (r.length === 1 && r[0] === 'säljare') return 'Säljare'
  return 'Kontor'
}

function GuideRad({ g, nr, basePath, visaRoll }: { g: IntranetDocumentWithStatus; nr: number; basePath: string; visaRoll: boolean }) {
  const intro = introAv(g)
  const last = !!g.currentAck
  return (
    <li>
      <Link
        to={`${basePath}/intranat/dokument/${g.slug}`}
        state={visaRoll ? { allaRoller: true } : undefined}
        className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-800/50 focus:outline-none focus-visible:bg-slate-800/50"
      >
        <span
          className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border text-xs font-bold ${last ? 'border-[#20c58f] bg-[#20c58f]/15 text-[#20c58f]' : 'border-slate-600 text-slate-400'}`}
          aria-label={last ? 'Läst' : `Guide ${nr}`}
        >
          {last ? <Icon name="allman.bock" size={16} /> : nr}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-white group-hover:text-[#20c58f]">{g.title}</span>
          {g.summary && <span className="mt-0.5 block text-sm leading-snug text-slate-400 line-clamp-2">{g.summary}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {intro && (
              <span className="inline-flex items-center gap-1">
                <Icon name={intro.enhet === 'dator' ? 'guide.dator' : 'guide.mobil'} size={16} className="h-3.5 w-3.5" />
                {intro.tar}, {(GUIDE_MODULER[g.slug]?.enheter?.length ?? 0) > 1 ? 'i telefonen eller på datorn' : intro.enhet === 'dator' ? 'på datorn' : 'i telefonen'}
              </span>
            )}
            {visaRoll && <span>För: {forVem(g)}</span>}
            {last && <span className="text-[#20c58f]">Läst</span>}
          </span>
        </span>
        <Icon name="allman.chevron" size={16} className="mt-1.5 flex-none text-slate-500 group-hover:text-[#20c58f]" />
      </Link>
    </li>
  )
}

function Sektion({ s, guider, basePath, visaRoll }: { s: HandbokSektion | { id: string; titel: string; text: string; ikon: HandbokSektion['ikon'] }; guider: IntranetDocumentWithStatus[]; basePath: string; visaRoll: boolean }) {
  const lasta = guider.filter(g => g.currentAck).length
  return (
    <section id={`amne-${s.id}`} className="scroll-mt-24">
      <div className="mb-2 flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#20c58f]/10 text-[#20c58f]">
          <Icon name={s.ikon} size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-lg font-semibold text-white">{s.titel}</h2>
            <span className="text-xs text-slate-500">{lasta} av {guider.length} lästa</span>
          </div>
          <p className="text-sm text-slate-400">{s.text}</p>
        </div>
      </div>
      <ol className="divide-y divide-slate-700/60 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/30">
        {guider.map((g, i) => <GuideRad key={g.id} g={g} nr={i + 1} basePath={basePath} visaRoll={visaRoll} />)}
      </ol>
    </section>
  )
}

export default function IntranetHandbok() {
  const { user, isAdmin, activeView } = useAuth()
  const basePath = useRoleBasePath()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guides, setGuides] = useState<IntranetDocumentWithStatus[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [allaRoller, setAllaRoller] = useState(false)

  useEffect(() => {
    if (user?.id) fetchGuides(user.id)
  }, [user?.id])

  const fetchGuides = async (userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const docs = await IntranetService.getDocumentsWithStatus(userId)
      setGuides(docs.filter(d => d.section === 'handbok'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda handboken')
    } finally {
      setLoading(false)
    }
  }

  const synliga = useMemo(
    () => (isAdmin && allaRoller) ? guides : guides.filter(g => forRollerna(g, new Set([activeView]))),
    [guides, isAdmin, allaRoller, activeView]
  )

  // Ämnena med sina guider i läsordning, plus Fler guider för det som inte är placerat
  const amnen = useMemo(() => {
    const bySlug = new Map(synliga.map(g => [g.slug, g]))
    const placerade = new Set<string>()
    const lista = HANDBOK_SEKTIONER.map(s => {
      const gs = s.slugs.map(sl => bySlug.get(sl)).filter((g): g is IntranetDocumentWithStatus => !!g)
      gs.forEach(g => placerade.add(g.slug))
      return { s, guider: gs }
    })
    const ovriga = synliga.filter(g => !placerade.has(g.slug)).sort((a, b) => a.sort_order - b.sort_order)
    if (ovriga.length) lista.push({ s: { id: 'ovrigt', titel: 'Fler guider', text: 'Guider som inte hör till något av ämnena ovan.', ikon: 'guide.las-ocksa', slugs: [] }, guider: ovriga })
    return lista.filter(a => a.guider.length > 0)
  }, [synliga])

  const ordning = useMemo(() => amnen.flatMap(a => a.guider), [amnen])
  const lasta = ordning.filter(g => g.currentAck).length
  const nasta = ordning.find(g => !g.currentAck)

  const term = searchTerm.toLowerCase().trim()
  const filtrerade = useMemo(() => {
    if (!term) return amnen
    return amnen
      .map(a => ({ ...a, guider: a.guider.filter(g => g.title.toLowerCase().includes(term) || (g.summary || '').toLowerCase().includes(term)) }))
      .filter(a => a.guider.length > 0)
  }, [amnen, term])
  const traffar = filtrerade.reduce((n, a) => n + a.guider.length, 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-700 bg-slate-800/30" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800/30 py-10">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
        <p className="mb-3 text-sm text-slate-400">{error}</p>
        <button
          onClick={() => user?.id && fetchGuides(user.id)}
          className="flex items-center gap-2 rounded-lg bg-[#20c58f] px-4 py-2 text-sm font-medium text-[#fff] hover:bg-[#1ab37e]"
        >
          <RefreshCw className="h-4 w-4" />
          Försök igen
        </button>
      </div>
    )
  }

  const visaRoll = isAdmin && allaRoller
  const procent = ordning.length ? Math.round((lasta / ordning.length) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Roll och läsläge */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-300">
            {visaRoll ? 'Alla rollers guider' : <>Guiderna för dig som <span className="font-semibold text-white">{ROLL_NAMN[activeView] ?? activeView}</span></>}
          </p>
          <p className="text-sm text-slate-400"><span className="font-semibold text-white">{lasta}</span> av {ordning.length} lästa</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700" aria-hidden>
          <div className="h-full rounded-full bg-[#20c58f] transition-[width]" style={{ width: `${procent}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Varje guide visar skärmen som du ser den, steg för steg, och slutar med en övning. Tryck Markera som läst längst ner när du är klar.</p>
        <p className="mt-1 text-xs text-slate-500">Portalen sparar vilka guider du har öppnat, hur länge, hur långt du kom och hur det gick på frågorna, så att vi ser vilka guider som behöver bli bättre. Bara admin ser det.</p>
        {isAdmin && (
          <label className="mt-3 flex w-max cursor-pointer select-none items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={allaRoller} onChange={e => setAllaRoller(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]" />
            Visa alla rollers guider (bara admin)
          </label>
        )}
      </div>

      {/* Nästa guide */}
      {!term && nasta && (
        <Link
          to={`${basePath}/intranat/dokument/${nasta.slug}`}
          className="group flex items-center gap-4 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/10 p-4 transition-colors hover:border-[#20c58f]"
        >
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#20c58f] text-[#fff]">
            <Icon name="guide.prova" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#20c58f]">{lasta === 0 ? 'Börja här' : 'Nästa guide att läsa'}</span>
            <span className="block text-base font-semibold text-white">{nasta.title}</span>
            {nasta.summary && <span className="block text-sm text-slate-300 line-clamp-2">{nasta.summary}</span>}
          </span>
          <Icon name="allman.chevron" size={20} className="flex-none text-[#20c58f] transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {!term && !nasta && ordning.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[#20c58f]/40 bg-[#20c58f]/10 p-4">
          <Icon name="allman.bock" size={24} className="flex-none text-[#20c58f]" />
          <p className="text-sm text-slate-200">Du har läst alla guider för din roll. Guiderna uppdateras när portalen ändras, så titta tillbaka ibland.</p>
        </div>
      )}

      {/* Sök och hopp till ämne */}
      <div className="space-y-2">
        <div className="relative">
          <Icon name="allman.sok" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Sök bland guiderna, till exempel återbesök eller faktura"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/50 py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          />
        </div>
        {!term && amnen.length > 1 && (
          <nav aria-label="Ämnen" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {amnen.map(a => (
              <a key={a.s.id} href={`${window.location.pathname}#amne-${a.s.id}`}
                onClick={e => { e.preventDefault(); document.getElementById(`amne-${a.s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                className="text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-white hover:decoration-[#20c58f]">
                {a.s.titel}
              </a>
            ))}
          </nav>
        )}
        {term && <p className="text-sm text-slate-500">{traffar} {traffar === 1 ? 'guide' : 'guider'} matchar</p>}
      </div>

      {/* Ämnena */}
      {filtrerade.length > 0 ? (
        <div className="space-y-8">
          {filtrerade.map(a => <Sektion key={a.s.id} s={a.s} guider={a.guider} basePath={basePath} visaRoll={visaRoll} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 py-12 text-center">
          <Icon name="guide.las-ocksa" size={32} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm text-slate-400">{synliga.length === 0 ? 'Inga guider för din roll ännu.' : 'Inga guider matchar din sökning.'}</p>
          {term && (
            <button onClick={() => setSearchTerm('')}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
              Rensa sökningen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
