// src/pages/shared/IntranetPage.tsx
// Intranät - gemensam sida för alla interna roller (admin, koordinator,
// tekniker, säljare) med obligatoriska arbetssätt & policys (med läskvittens)
// samt Handbok med guider.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Clock,
  BookOpen,
  ClipboardCheck,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { IntranetService } from '../../services/intranetService'
import {
  INTRANET_CATEGORY_CONFIG,
  INTRANET_SLUG_ICONS,
  estimateReadingMinutes,
  type IntranetDocumentWithStatus,
} from '../../types/intranet'
import { guides } from '../../components/larosate/guideData'
import GuideCard from '../../components/larosate/GuideCard'
import IntranetAckMatrix from '../../components/admin/intranet/IntranetAckMatrix'
import { useRoleBasePath, guidePathForRole } from '../../hooks/useRoleBasePath'

export default function IntranetPage() {
  const { user, profile, isAdmin } = useAuth()
  const basePath = useRoleBasePath()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<IntranetDocumentWithStatus[]>([])
  const [activeTab, setActiveTab] = useState<'dokument' | 'kvittenser'>('dokument')

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id)
  }, [user?.id])

  const fetchDocuments = async (userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const docs = await IntranetService.getDocumentsWithStatus(userId)
      setDocuments(docs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda dokumenten')
    } finally {
      setLoading(false)
    }
  }

  const mandatoryDocs = useMemo(
    () => documents.filter(d => d.section === 'obligatoriskt'),
    [documents]
  )
  const ackRequired = mandatoryDocs.filter(d => d.requires_acknowledgement)
  const ackDone = ackRequired.filter(d => d.currentAck)
  const allDone = ackRequired.length > 0 && ackDone.length === ackRequired.length

  const userName = profile?.display_name || user?.email || ''

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ─── Header ─── */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#20c58f] to-teal-600 shadow-lg shadow-[#20c58f]/20">
          <Landmark className="w-8 h-8 text-[#fff]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Intranät</h1>
          <p className="text-slate-400 text-sm">
            Obligatoriska arbetssätt, policys och handbok för alla på Begone
          </p>
        </div>
      </div>

      {/* ─── Admin-tabbar ─── */}
      {isAdmin && (
        <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('dokument')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'dokument' ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dokument
          </button>
          <button
            onClick={() => setActiveTab('kvittenser')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'kvittenser' ? 'bg-[#20c58f] text-[#fff]' : 'text-slate-400 hover:text-white'
            }`}
          >
            Läskvittenser
          </button>
        </div>
      )}

      {activeTab === 'kvittenser' && isAdmin ? (
        <IntranetAckMatrix />
      ) : (
        <>
          {/* ─── Kvittensstatus ─── */}
          {!loading && !error && ackRequired.length > 0 && (
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                allDone
                  ? 'bg-[#20c58f]/10 border-[#20c58f]/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              {allDone ? (
                <CheckCircle2 className="w-5 h-5 text-[#20c58f] flex-shrink-0" />
              ) : (
                <ClipboardCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {allDone
                    ? 'Du har kvitterat alla obligatoriska dokument'
                    : `${ackDone.length} av ${ackRequired.length} obligatoriska dokument kvitterade`}
                </p>
                {!allDone && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Läs igenom och kvittera de dokument som är markerade nedan.
                  </p>
                )}
              </div>
              {/* Progressbar */}
              <div className="hidden sm:block w-32 h-2 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full bg-[#20c58f] transition-all"
                  style={{ width: `${ackRequired.length ? (ackDone.length / ackRequired.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ─── Sektion: Obligatoriska arbetssätt & policys ─── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#20c58f]" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Obligatoriska arbetssätt & policys
              </h2>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-10 px-4 bg-slate-800/30 border border-slate-700 rounded-xl">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-sm text-slate-400 mb-3 text-center">{error}</p>
                <button
                  onClick={() => user?.id && fetchDocuments(user.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Försök igen
                </button>
              </div>
            ) : mandatoryDocs.length === 0 ? (
              <div className="py-10 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
                <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Inga dokument publicerade ännu.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {mandatoryDocs.map(doc => {
                  const config = INTRANET_CATEGORY_CONFIG[doc.category]
                  const Icon = INTRANET_SLUG_ICONS[doc.slug] || config.icon
                  const needsAck = doc.requires_acknowledgement && !doc.currentAck
                  const isUpdated = needsAck && !!doc.latestAck
                  return (
                    <Link
                      key={doc.id}
                      to={`${basePath}/intranat/${doc.slug}`}
                      className={`group flex flex-col gap-3 p-4 rounded-xl border transition-all ${
                        needsAck
                          ? 'bg-amber-500/[0.06] border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/10'
                          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white group-hover:text-[#20c58f] transition-colors leading-snug">
                            {doc.title}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{doc.summary}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-auto">
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {estimateReadingMinutes(doc.content)} min läsning
                        </span>
                        <span className="ml-auto">
                          {doc.currentAck ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-[#20c58f]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Kvitterad
                            </span>
                          ) : doc.requires_acknowledgement ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {isUpdated ? 'Uppdaterad - kvittera igen' : 'Ej kvitterad'}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ─── Sektion: Handbok ─── */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Handbok</h2>
            </div>
            <p className="text-sm text-slate-400 -mt-1">
              Guider som visar hur du arbetar i systemet. Fler guider läggs till löpande.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {guides.map((guide, index) => (
                <GuideCard
                  key={guide.id}
                  guide={{ ...guide, path: guidePathForRole(guide.id, basePath) }}
                  index={index}
                />
              ))}
            </div>
          </section>

          {/* ─── Footer ─── */}
          <div className="pt-4 border-t border-slate-700/50 text-center">
            <p className="text-sm text-slate-500">
              {userName && <>Inloggad som {userName}. </>}
              Saknar du ett dokument eller hittar fel? Kontakta ledningen.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
