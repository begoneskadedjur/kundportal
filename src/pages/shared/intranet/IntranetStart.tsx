// src/pages/shared/intranet/IntranetStart.tsx
// Intranätets startsida: hero med personlig status, statistikrad,
// anslagstavla, att göra-lista, onboarding, snabblänkar och KMA-hub.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Landmark,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Megaphone,
  Pin,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Sparkles,
  Calendar,
  MessageSquareText,
  Wallet,
  ShieldCheck,
  GraduationCap,
  History,
  Users,
} from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRoleBasePath } from '../../../hooks/useRoleBasePath'
import { IntranetService } from '../../../services/intranetService'
import {
  ONBOARDING_SLUGS,
  type IntranetDocumentWithStatus,
  type IntranetPost,
  type IntranetResponsibility,
  type KmaStats,
} from '../../../types/intranet'
import { canPostAnnouncements, relativeDate, SectionHeader, DocumentCard } from './intranetShared'
import PostModal from './PostModal'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 10) return 'God morgon'
  if (h < 17) return 'God eftermiddag'
  return 'God kväll'
}

// Snabblänkar per rollprefix (bara sådant som finns i respektive vy)
function quickLinksFor(basePath: string) {
  const links: { label: string; icon: React.ElementType; path: string }[] = []
  if (basePath === '/technician') {
    links.push(
      { label: 'Mitt schema', icon: Calendar, path: '/technician/schedule' },
      { label: 'Mina ärenden', icon: ClipboardCheck, path: '/technician/cases' },
      { label: 'Tickets', icon: MessageSquareText, path: '/technician/tickets' },
      { label: 'Provisioner', icon: Wallet, path: '/technician/commissions' },
      { label: 'AI Assistent', icon: Sparkles, path: '/technician/team-chat' },
    )
  } else if (basePath === '/koordinator') {
    links.push(
      { label: 'Schema & Planering', icon: Calendar, path: '/koordinator/schema' },
      { label: 'Ärenden', icon: ClipboardCheck, path: '/koordinator/arenden' },
      { label: 'Tickets', icon: MessageSquareText, path: '/koordinator/tickets' },
      { label: 'AI Assistent', icon: Sparkles, path: '/koordinator/team-chat' },
    )
  } else if (basePath === '/saljare') {
    links.push(
      { label: 'Leads', icon: ClipboardCheck, path: '/saljare/leads' },
      { label: 'Försäljningspipeline', icon: Wallet, path: '/saljare/forsaljningspipeline' },
      { label: 'AI Assistent', icon: Sparkles, path: '/saljare/ai-assistent' },
    )
  } else {
    links.push(
      { label: 'Schema & Planering', icon: Calendar, path: '/koordinator/schema' },
      { label: 'Tickets', icon: MessageSquareText, path: '/admin/tickets' },
      { label: 'Användarkonton (Personal)', icon: Users, path: '/admin/anvandarkonton-personal' },
      { label: 'AI Assistent', icon: Sparkles, path: '/admin/ai-assistent' },
    )
  }
  return links
}

export default function IntranetStart() {
  const { user, profile } = useAuth()
  const basePath = useRoleBasePath()
  const canPost = canPostAnnouncements(profile)

  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<IntranetDocumentWithStatus[]>([])
  const [posts, setPosts] = useState<IntranetPost[]>([])
  const [kma, setKma] = useState<KmaStats | null>(null)
  const [responsibilities, setResponsibilities] = useState<IntranetResponsibility[]>([])
  const [postModal, setPostModal] = useState<{ open: boolean; post: IntranetPost | null }>({ open: false, post: null })

  useEffect(() => {
    if (user?.id) fetchAll(user.id)
  }, [user?.id])

  const fetchAll = async (userId: string) => {
    setLoading(true)
    const [docsRes, postsRes, kmaRes, respRes] = await Promise.allSettled([
      IntranetService.getDocumentsWithStatus(userId),
      IntranetService.getPosts(),
      IntranetService.getKmaStats(),
      IntranetService.getResponsibilities(),
    ])
    if (docsRes.status === 'fulfilled') setDocuments(docsRes.value)
    if (postsRes.status === 'fulfilled') setPosts(postsRes.value)
    if (kmaRes.status === 'fulfilled') setKma(kmaRes.value)
    if (respRes.status === 'fulfilled') setResponsibilities(respRes.value)
    setLoading(false)
  }

  const mandatory = useMemo(() => documents.filter(d => d.section === 'obligatoriskt'), [documents])
  const guides = useMemo(() => documents.filter(d => d.section === 'handbok'), [documents])
  const ackRequired = mandatory.filter(d => d.requires_acknowledgement)
  const unacked = ackRequired.filter(d => !d.currentAck)
  const allDone = ackRequired.length > 0 && unacked.length === 0

  const onboarding = useMemo(() => {
    const bySlug = new Map(documents.map(d => [d.slug, d]))
    return ONBOARDING_SLUGS
      .map(step => ({ ...step, doc: bySlug.get(step.slug) }))
      .filter(step => step.doc)
      .map(step => ({ ...step, done: !!step.doc!.currentAck }))
  }, [documents])
  const onboardingDone = onboarding.filter(s => s.done).length

  const recentlyUpdated = useMemo(
    () => [...documents].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4),
    [documents]
  )

  const firstName = (profile?.display_name || '').split(' ')[0] || 'du'
  const today = new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

  const handleDeletePost = async (post: IntranetPost) => {
    if (!window.confirm(`Ta bort anslaget "${post.title}"?`)) return
    try {
      await IntranetService.deletePost(post.id)
      setPosts(prev => prev.filter(p => p.id !== post.id))
      toast.success('Anslaget borttaget')
    } catch {
      toast.error('Kunde inte ta bort anslaget')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-slate-800/30 border border-slate-700 rounded-2xl animate-pulse" />
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <div className="h-32 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
            <div className="h-48 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-5 sm:p-6 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800/60 to-slate-900/40"
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#20c58f]/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#20c58f] to-teal-600 shadow-lg shadow-[#20c58f]/20 flex-shrink-0">
              <Landmark className="w-7 h-7 text-[#fff]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {greeting()}, {firstName}
              </h1>
              <p className="text-slate-400 text-sm capitalize">{today} · Begone intranät</p>
            </div>
          </div>
          {unacked.length > 0 ? (
            <Link
              to={`${basePath}/intranat/dokument/${unacked[0].slug}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl transition-colors"
            >
              <ClipboardCheck className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-white">
                {unacked.length} dokument att kvittera
              </span>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </Link>
          ) : allDone ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-[#20c58f]" />
              <span className="text-sm font-medium text-white">Alla dokument kvitterade</span>
            </div>
          ) : null}
        </div>

        {/* Statistikrad */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Kvitterade dokument', value: `${ackRequired.length - unacked.length}/${ackRequired.length}`, icon: ClipboardCheck, color: unacked.length === 0 ? 'text-[#20c58f]' : 'text-amber-400' },
            { label: 'Öppna avvikelser', value: String(kma?.open_count ?? 0), icon: AlertTriangle, color: (kma?.open_count || 0) > 0 ? 'text-amber-400' : 'text-[#20c58f]' },
            { label: 'Åtgärdade i år', value: String(kma?.handled_this_year ?? 0), icon: ShieldCheck, color: 'text-cyan-400' },
            { label: 'Guider i handboken', value: String(guides.length), icon: BookOpen, color: 'text-purple-400' },
          ].map(stat => (
            <div key={stat.label} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-2xl font-bold text-white tabular-nums">{stat.value}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

        {/* ─── Huvudkolumn ─── */}
        <div className="space-y-6 min-w-0">

          {/* Anslagstavla */}
          <section className="space-y-3">
            <SectionHeader
              icon={Megaphone}
              iconColor="text-[#20c58f]"
              title="Anslagstavla"
              count={posts.length}
              action={canPost && (
                <button
                  onClick={() => setPostModal({ open: true, post: null })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nytt anslag
                </button>
              )}
            />
            {posts.length === 0 ? (
              <div className="py-8 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
                <Megaphone className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Inga anslag ännu.</p>
                {canPost && (
                  <p className="text-xs text-slate-500 mt-1">
                    Publicera det första - t.ex. en nyhet, ett välkomnande eller en påminnelse.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post, i) => {
                  const canEdit = canPost && (post.author_user_id === user?.id || profile?.is_admin || profile?.role === 'admin')
                  return (
                    <motion.article
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`p-4 rounded-xl border ${
                        post.pinned
                          ? 'bg-[#20c58f]/[0.07] border-[#20c58f]/30'
                          : 'bg-slate-800/30 border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {post.pinned && <Pin className="w-3.5 h-3.5 text-[#20c58f] flex-shrink-0" />}
                          <h3 className="font-semibold text-white leading-snug">{post.title}</h3>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setPostModal({ open: true, post })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/50 transition-colors"
                              title="Redigera"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Ta bort"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 space-y-2">
                        {post.body.split(/\n{2,}/).map((para, j) => (
                          <p key={j} className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{para}</p>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                        <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                          {(post.author_name || '?').charAt(0).toUpperCase()}
                        </span>
                        <span>{post.author_name || 'Okänd'}</span>
                        <span>·</span>
                        <span>{relativeDate(post.published_at)}</span>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Att kvittera */}
          {unacked.length > 0 && (
            <section className="space-y-3">
              <SectionHeader
                icon={ClipboardCheck}
                iconColor="text-amber-400"
                title="Att läsa och kvittera"
                count={unacked.length}
                action={
                  <Link to={`${basePath}/intranat/policys`} className="text-sm text-[#20c58f] hover:underline">
                    Visa alla
                  </Link>
                }
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {unacked.map((doc, i) => (
                  <DocumentCard key={doc.id} doc={doc} basePath={basePath} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Onboarding */}
          {onboarding.length > 0 && onboardingDone < onboarding.length && (
            <section className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">Ny på Begone? Börja här</h2>
                </div>
                <span className="text-xs text-slate-400 tabular-nums">
                  {onboardingDone} av {onboarding.length} klara
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${(onboardingDone / onboarding.length) * 100}%` }}
                />
              </div>
              <div className="space-y-1">
                {onboarding.map(step => (
                  <Link
                    key={step.slug}
                    to={`${basePath}/intranat/dokument/${step.slug}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${step.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Senast uppdaterat */}
          <section className="space-y-3">
            <SectionHeader icon={History} iconColor="text-slate-400" title="Senast uppdaterat" />
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl divide-y divide-slate-700/50">
              {recentlyUpdated.map(doc => (
                <Link
                  key={doc.id}
                  to={`${basePath}/intranat/dokument/${doc.slug}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-sm text-white truncate flex-1">{doc.title}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0">v{doc.version}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0 w-24 text-right">{relativeDate(doc.updated_at)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ─── Högerkolumn ─── */}
        <div className="space-y-4">

          {/* Snabblänkar */}
          <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Snabblänkar</h3>
            <div className="space-y-0.5">
              <Link
                to={`${basePath}/tillbud-avvikelser`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors mb-1.5"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-medium text-white flex-1">Rapportera tillbud eller avvikelse</span>
                <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
              </Link>
              {quickLinksFor(basePath).map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                >
                  <link.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm flex-1">{link.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* KMA-hub */}
          <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-[#20c58f]" />
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">KMA - Kvalitet, Miljö, Arbetsmiljö</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Vårt ledningssystem enligt ISO 9001 och ISO 14001. Tillbud och avvikelser rapporteras direkt i portalen.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-center">
                <p className="text-lg font-bold text-white tabular-nums">{kma?.reported_this_year ?? 0}</p>
                <p className="text-[11px] text-slate-500">Rapporterade i år</p>
              </div>
              <div className="p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg text-center">
                <p className="text-lg font-bold text-[#20c58f] tabular-nums">{kma?.handled_this_year ?? 0}</p>
                <p className="text-[11px] text-slate-500">Åtgärdade i år</p>
              </div>
            </div>
            <div className="space-y-0.5">
              {mandatory.filter(d => d.category === 'policy').map(doc => (
                <Link
                  key={doc.id}
                  to={`${basePath}/intranat/dokument/${doc.slug}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f] flex-shrink-0" />
                  {doc.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Ansvarsroller (mini) */}
          <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vem gör vad?</h3>
            <div className="space-y-2">
              {responsibilities.slice(0, 3).map(r => (
                <div key={r.id} className="px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <p className="text-xs font-medium text-white">{r.area}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{r.person_name}</p>
                </div>
              ))}
            </div>
            <Link
              to={`${basePath}/intranat/kontakter`}
              className="flex items-center gap-1 mt-2.5 text-sm text-[#20c58f] hover:underline"
            >
              Alla kontakter och ansvar
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Anslagsmodal */}
      {postModal.open && (
        <PostModal
          post={postModal.post}
          onClose={() => setPostModal({ open: false, post: null })}
          onSaved={() => {
            setPostModal({ open: false, post: null })
            if (user?.id) fetchAll(user.id)
          }}
        />
      )}
    </div>
  )
}
