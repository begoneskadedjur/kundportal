// src/pages/shared/intranet/IntranetPolicys.tsx
// Obligatoriska arbetssätt & policys, grupperade per kategori

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw, BookOpen, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRoleBasePath } from '../../../hooks/useRoleBasePath'
import { IntranetService } from '../../../services/intranetService'
import type { IntranetCategory, IntranetDocumentWithStatus } from '../../../types/intranet'
import { SectionHeader, DocumentCard } from './intranetShared'

const GROUPS: { category: IntranetCategory; title: string; icon: React.ElementType; color: string }[] = [
  { category: 'introduktion', title: 'Introduktion', icon: BookOpen, color: 'text-cyan-400' },
  { category: 'policy', title: 'Policys', icon: ShieldCheck, color: 'text-[#20c58f]' },
  { category: 'rutin', title: 'Rutiner', icon: FileText, color: 'text-amber-400' },
]

export default function IntranetPolicys() {
  const { user } = useAuth()
  const basePath = useRoleBasePath()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<IntranetDocumentWithStatus[]>([])

  useEffect(() => {
    if (user?.id) fetchDocs(user.id)
  }, [user?.id])

  const fetchDocs = async (userId: string) => {
    try {
      setLoading(true)
      setError(null)
      const docs = await IntranetService.getDocumentsWithStatus(userId)
      setDocuments(docs.filter(d => d.section === 'obligatoriskt'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda dokumenten')
    } finally {
      setLoading(false)
    }
  }

  const ackRequired = documents.filter(d => d.requires_acknowledgement)
  const ackDone = ackRequired.filter(d => d.currentAck)
  const grouped = useMemo(
    () => GROUPS
      .map(g => ({ ...g, docs: documents.filter(d => d.category === g.category) }))
      .filter(g => g.docs.length > 0),
    [documents]
  )

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-36 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-10 bg-slate-800/30 border border-slate-700 rounded-xl">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-slate-400 mb-3">{error}</p>
        <button
          onClick={() => user?.id && fetchDocs(user.id)}
          className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Kvittensstatus */}
      {ackRequired.length > 0 && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            ackDone.length === ackRequired.length
              ? 'bg-[#20c58f]/10 border-[#20c58f]/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${ackDone.length === ackRequired.length ? 'text-[#20c58f]' : 'text-amber-400'}`} />
          <p className="text-sm font-medium text-white flex-1">
            {ackDone.length} av {ackRequired.length} obligatoriska dokument kvitterade
          </p>
          <div className="hidden sm:block w-32 h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#20c58f] transition-all"
              style={{ width: `${ackRequired.length ? (ackDone.length / ackRequired.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {grouped.map(group => (
        <section key={group.category} className="space-y-3">
          <SectionHeader icon={group.icon} iconColor={group.color} title={group.title} count={group.docs.length} />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.docs.map((doc, i) => (
              <DocumentCard key={doc.id} doc={doc} basePath={basePath} index={i} />
            ))}
          </div>
        </section>
      ))}

      {documents.length === 0 && (
        <div className="py-10 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Inga dokument publicerade ännu.</p>
        </div>
      )}
    </div>
  )
}
