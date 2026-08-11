// src/pages/shared/IntranetDocumentPage.tsx
// Dokumentläsare för Intranät med läs- och förståelsekvittens.
// Innehållet renderas från strukturerade block (jsonb i databasen).

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { IntranetService } from '../../services/intranetService'
import { refreshIntranetBadge } from '../../hooks/useIntranetBadge'
import {
  INTRANET_CATEGORY_CONFIG,
  INTRANET_SLUG_ICONS,
  estimateReadingMinutes,
  type IntranetBlock,
  type IntranetDocumentWithStatus,
} from '../../types/intranet'
import { useRoleBasePath } from '../../hooks/useRoleBasePath'
import PrissattningDemo from './intranet/interactive/PrissattningDemo'
import AudienceModal from './intranet/AudienceModal'
import { describeAudience } from '../../types/intranet'
import { Eye } from 'lucide-react'

// Interaktiva demos - innehållsblock av typen interactive slår upp
// sin komponent här via nyckeln i blockets component-fält
const INTERACTIVE_COMPONENTS: Record<string, ComponentType> = {
  'prissattning-demo': PrissattningDemo,
}

// ─── Blockrendering ────────────────────────────────

function BlockRenderer({ block, anchorId }: { block: IntranetBlock; anchorId?: string }) {
  switch (block.type) {
    case 'h2':
      return <h2 id={anchorId} className="text-lg font-semibold text-white mt-8 mb-3 first:mt-0 scroll-mt-24">{block.text}</h2>
    case 'h3':
      return <h3 className="text-base font-semibold text-slate-200 mt-6 mb-2">{block.text}</h3>
    case 'p':
      return <p className="text-[15px] leading-relaxed text-slate-300 mb-3">{block.text}</p>
    case 'list':
      return (
        <ul className="space-y-2 mb-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] mt-2.5 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'steps':
      return (
        <ol className="mb-5 mt-1">
          {block.items.map((item, i) => (
            <li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
              {/* Stegmarkering med förbindelselinje */}
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="w-7 h-7 rounded-full bg-[#20c58f]/15 border border-[#20c58f]/40 text-[#20c58f] text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {i < block.items.length - 1 && <span className="w-px flex-1 bg-slate-700 mt-1" />}
              </div>
              <p className="text-[15px] leading-relaxed text-slate-300 pt-0.5">{item}</p>
            </li>
          ))}
        </ol>
      )
    case 'motto':
      return (
        <blockquote className="my-6 px-5 py-4 bg-[#20c58f]/10 border-l-4 border-[#20c58f] rounded-r-xl">
          <p className="text-lg font-semibold text-white leading-snug">{block.text}</p>
        </blockquote>
      )
    case 'callout': {
      const styles = {
        info: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', icon: Info, iconColor: 'text-cyan-400' },
        warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', icon: AlertTriangle, iconColor: 'text-amber-400' },
        success: { border: 'border-[#20c58f]/30', bg: 'bg-[#20c58f]/10', icon: CheckCircle2, iconColor: 'text-[#20c58f]' },
      }[block.variant]
      const CalloutIcon = styles.icon
      return (
        <div className={`my-5 p-4 rounded-xl border ${styles.border} ${styles.bg}`}>
          <div className="flex items-start gap-3">
            <CalloutIcon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              {block.title && <p className="text-sm font-semibold text-white mb-1">{block.title}</p>}
              <p className="text-sm leading-relaxed text-slate-300">{block.text}</p>
            </div>
          </div>
        </div>
      )
    }
    case 'link':
      return <DocLinkBlock slug={block.slug} label={block.label} description={block.description} />
    case 'interactive': {
      const InteractiveComponent = INTERACTIVE_COMPONENTS[block.component]
      return InteractiveComponent ? <InteractiveComponent /> : null
    }
    case 'chain':
      return (
        <div className="my-5 p-4 bg-slate-800/30 border border-slate-700 rounded-xl overflow-x-auto">
          {block.title && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{block.title}</p>
          )}
          <div className="flex items-center gap-1 min-w-max">
            {block.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg">
                  <span className="text-xs font-medium text-white whitespace-nowrap">{step}</span>
                  {block.labels?.[i] && (
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {block.labels[i]}
                    </span>
                  )}
                </div>
                {i < block.steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )
    default:
      return null
  }
}

/** Länk-kort till ett annat intranätdokument */
function DocLinkBlock({ slug, label, description }: { slug: string; label: string; description?: string }) {
  const basePath = useRoleBasePath()
  return (
    <Link
      to={`${basePath}/intranat/dokument/${slug}`}
      className="group flex items-center gap-3 my-5 p-4 rounded-xl bg-slate-800/40 border border-slate-700 hover:border-[#20c58f]/50 hover:bg-slate-800/60 transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-[#20c58f]/15 flex items-center justify-center flex-shrink-0">
        <ArrowLeft className="w-5 h-5 text-[#20c58f] rotate-180" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Läs också</p>
        <p className="text-sm font-semibold text-white group-hover:text-[#20c58f] transition-colors">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  )
}

// ─── Sida ──────────────────────────────────────────

export default function IntranetDocumentPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, profile, isAdmin } = useAuth()
  const basePath = useRoleBasePath()
  const [showAudienceModal, setShowAudienceModal] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<IntranetDocumentWithStatus | null>(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [readProgress, setReadProgress] = useState(0)

  // Läsprogress: hur långt ner på sidan användaren scrollat
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setReadProgress(total > 0 ? Math.min(100, (el.scrollTop / total) * 100) : 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [doc?.id])

  // Innehållsförteckning från h2-block
  const toc = useMemo(
    () =>
      (doc?.content || [])
        .map((block, i) => ({ block, i }))
        .filter(({ block }) => block.type === 'h2')
        .map(({ block, i }) => ({ id: `avsnitt-${i}`, text: (block as { text: string }).text })),
    [doc?.content]
  )

  useEffect(() => {
    if (slug && user?.id) fetchDocument(slug, user.id)
    window.scrollTo(0, 0)
  }, [slug, user?.id])

  const fetchDocument = async (documentSlug: string, userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const result = await IntranetService.getDocumentBySlug(documentSlug, userId)
      if (!result) {
        setError('Dokumentet hittades inte')
      } else {
        setDoc(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda dokumentet')
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async () => {
    if (!doc || !user?.id || acknowledging) return
    try {
      setAcknowledging(true)
      const ack = await IntranetService.acknowledge(doc, {
        id: user.id,
        name: profile?.display_name || null,
        email: profile?.email || user.email || null,
      })
      setDoc({ ...doc, currentAck: ack, latestAck: ack })
      refreshIntranetBadge()
      toast.success('Tack! Din kvittens är registrerad.')
    } catch {
      toast.error('Kvittensen kunde inte sparas. Försök igen.')
    } finally {
      setAcknowledging(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-slate-800 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-slate-800/50 rounded animate-pulse" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-slate-400 mb-4">{error || 'Dokumentet hittades inte'}</p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to={`${basePath}/intranat`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            Till Intranät
          </Link>
          {slug && user?.id && (
            <button
              onClick={() => fetchDocument(slug, user.id)}
              className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Försök igen
            </button>
          )}
        </div>
      </div>
    )
  }

  const config = INTRANET_CATEGORY_CONFIG[doc.category]
  const Icon = INTRANET_SLUG_ICONS[doc.slug] || config.icon
  const needsAck = doc.requires_acknowledgement && !doc.currentAck
  const isUpdatedSinceLastAck = needsAck && !!doc.latestAck
  const isGuide = doc.section === 'handbok'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28">

      {/* Läsprogress */}
      <div className="fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none">
        <div className="h-full bg-[#20c58f] transition-[width] duration-150" style={{ width: `${readProgress}%` }} />
      </div>

      {/* Tillbaka-länk + synlighet (admin) */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link
          to={`${basePath}/intranat${isGuide ? '/handbok' : '/policys'}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isGuide ? 'Handbok' : 'Policys & rutiner'}
        </Link>
        {isAdmin && (
          <button
            onClick={() => setShowAudienceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            title="Styr vilka roller/användare som ser dokumentet"
          >
            <Eye className="w-4 h-4" />
            Synlighet: {describeAudience(doc)}
          </button>
        )}
      </div>

      <div className="xl:grid xl:grid-cols-[1fr_220px] xl:gap-8">
      <div className="max-w-3xl min-w-0">

      {/* Banner: uppdaterat dokument */}
      {isUpdatedSinceLastAck && (
        <div className="flex items-start gap-3 p-4 mb-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Dokumentet har uppdaterats</p>
            <p className="text-sm text-slate-300 mt-0.5">
              Innehållet har ändrats sedan din senaste kvittens (version {doc.latestAck?.version}).
              Läs igenom det uppdaterade dokumentet och kvittera igen.
            </p>
          </div>
        </div>
      )}

      {/* Dokumenthuvud */}
      <header className="mb-6 pb-5 border-b border-slate-700/50">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{doc.title}</h1>
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${config.bgColor} ${config.color}`}>
                {config.label}
              </span>
              <span className="text-xs text-slate-500">Version {doc.version}</span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {estimateReadingMinutes(doc.content)} min läsning
              </span>
              {doc.source_updated_at && (
                <span className="text-xs text-slate-500">
                  Senast uppdaterad {new Date(doc.source_updated_at).toLocaleDateString('sv-SE')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Innehåll */}
      <article>
        {doc.content.map((block, i) => (
          <BlockRenderer key={i} block={block} anchorId={block.type === 'h2' ? `avsnitt-${i}` : undefined} />
        ))}
      </article>

      {/* Markera som läst (guider utan kvittenskrav) */}
      {!doc.requires_acknowledgement && (
        <div className="mt-10">
          {doc.currentAck ? (
            <div className="flex items-center gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-[#20c58f] flex-shrink-0" />
              <p className="text-sm text-white">
                Läst {new Date(doc.currentAck.acknowledged_at).toLocaleDateString('sv-SE')}
              </p>
            </div>
          ) : (
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
            >
              {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Markera som läst
            </button>
          )}
        </div>
      )}

      {/* Kvittens */}
      {doc.requires_acknowledgement && (
        <div className="mt-10">
          {doc.currentAck ? (
            <div className="flex items-center gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-[#20c58f] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Du har kvitterat detta dokument</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(doc.currentAck.acknowledged_at).toLocaleString('sv-SE', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}{' '}
                  · Version {doc.currentAck.version}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 bg-slate-800/40 border border-slate-700 rounded-xl">
              <p className="text-sm font-semibold text-white mb-1">Läs- och förståelsekvittens</p>
              <p className="text-sm text-slate-400 mb-4">
                Genom att kvittera intygar du att du har läst och förstått innehållet i detta dokument.
                Kvittensen loggas med ditt namn, datum och dokumentversion.
              </p>
              <button
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#20c58f] hover:bg-[#1ab37e] disabled:opacity-60 text-[#fff] rounded-xl text-sm font-semibold transition-colors"
              >
                {acknowledging ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Jag har läst och förstått innehållet
              </button>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Synlighetsmodal (admin) */}
      {showAudienceModal && (
        <AudienceModal
          doc={doc}
          onClose={() => setShowAudienceModal(false)}
          onSaved={(nextRoles, nextUserIds) => {
            setDoc({ ...doc, audience_roles: nextRoles, audience_user_ids: nextUserIds })
            setShowAudienceModal(false)
          }}
        />
      )}

      {/* Innehållsförteckning (bred skärm) */}
      {toc.length > 1 && (
        <aside className="hidden xl:block">
          <nav className="sticky top-24 p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Innehåll</p>
            <ul className="space-y-1">
              {toc.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block px-2 py-1 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors leading-snug"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}
      </div>
    </div>
  )
}
