// src/components/admin/intranet/IntranetAckMatrix.tsx
// Läsmatris för admin: vem har kvitterat vilket intranätdokument
// (och vilken version). CSV-export för ISO-revision.

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  History,
} from 'lucide-react'
import { IntranetService, type AckMatrixData } from '../../../services/intranetService'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
  'säljare': 'Säljare',
}

export default function IntranetAckMatrix() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<AckMatrixData | null>(null)

  useEffect(() => {
    fetchMatrix()
  }, [])

  const fetchMatrix = async () => {
    try {
      setLoading(true)
      setError(null)
      setMatrix(await IntranetService.getAckMatrix())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda läskvittenserna')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (!matrix) return { total: 0, done: 0 }
    const total = matrix.users.length * matrix.documents.length
    let done = 0
    for (const user of matrix.users) {
      for (const doc of matrix.documents) {
        const ack = matrix.acks.get(`${doc.id}:${user.user_id}`)
        if (ack && ack.version === doc.version) done++
      }
    }
    return { total, done }
  }, [matrix])

  const exportCsv = () => {
    if (!matrix) return
    const sep = ';'
    const header = ['Namn', 'E-post', 'Roll', ...matrix.documents.map(d => d.title)]
    const rows = matrix.users.map(user => {
      const cells = matrix.documents.map(doc => {
        const ack = matrix.acks.get(`${doc.id}:${user.user_id}`)
        if (!ack) return 'Ej kvitterad'
        const date = new Date(ack.acknowledged_at).toLocaleDateString('sv-SE')
        return ack.version === doc.version
          ? `Kvitterad ${date} (v${ack.version})`
          : `Äldre version kvitterad ${date} (v${ack.version}, aktuell v${doc.version})`
      })
      return [user.name, user.email, ROLE_LABELS[user.role] || user.role, ...cells]
    })
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n')
    // BOM för korrekt teckenkodning i Excel
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `laskvittenser_intranat_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="h-64 bg-slate-800/30 border border-slate-700 rounded-xl animate-pulse" />
  }

  if (error || !matrix) {
    return (
      <div className="flex flex-col items-center py-10 bg-slate-800/30 border border-slate-700 rounded-xl">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm text-slate-400 mb-3">{error || 'Kunde inte ladda läskvittenserna'}</p>
        <button
          onClick={fetchMatrix}
          className="flex items-center gap-2 px-4 py-2 bg-[#20c58f] text-[#fff] rounded-lg text-sm font-medium hover:bg-[#1ab37e] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Försök igen
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sammanfattning + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-400">
          <span className="text-white font-semibold">{stats.done}</span> av{' '}
          <span className="text-white font-semibold">{stats.total}</span> kvittenser klara
          (aktuell version, {matrix.users.length} personer × {matrix.documents.length} dokument)
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMatrix}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Uppdatera
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportera CSV
          </button>
        </div>
      </div>

      {/* Matris */}
      <div className="overflow-x-auto bg-slate-800/30 border border-slate-700 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-900/90 backdrop-blur-sm">
                Medarbetare
              </th>
              {matrix.documents.map(doc => (
                <th key={doc.id} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 min-w-[150px]">
                  <span className="block leading-snug">{doc.title}</span>
                  <span className="font-normal text-slate-500">v{doc.version}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.users.map(user => (
              <tr key={user.user_id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30">
                <td className="px-4 py-3 sticky left-0 bg-slate-900/90 backdrop-blur-sm">
                  <p className="text-white font-medium whitespace-nowrap">{user.name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role}</p>
                </td>
                {matrix.documents.map(doc => {
                  const ack = matrix.acks.get(`${doc.id}:${user.user_id}`)
                  const isCurrent = ack && ack.version === doc.version
                  return (
                    <td key={doc.id} className="px-4 py-3">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 text-[#20c58f]">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs whitespace-nowrap">
                            {new Date(ack.acknowledged_at).toLocaleDateString('sv-SE')}
                          </span>
                        </span>
                      ) : ack ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-amber-400"
                          title={`Kvitterade v${ack.version} ${new Date(ack.acknowledged_at).toLocaleDateString('sv-SE')} - aktuell version är v${doc.version}`}
                        >
                          <History className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs whitespace-nowrap">Äldre version</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span className="text-xs whitespace-nowrap">Ej kvitterad</span>
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {matrix.users.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Inga interna användare hittades.</p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Kvittenserna loggas per dokumentversion. När ett dokument uppdateras väsentligt höjs versionen,
        och alla behöver kvittera på nytt. Exporten kan användas som underlag vid ISO-revision.
      </p>
    </div>
  )
}
