// src/pages/admin/BugReportsPage.tsx

import { useState, useEffect } from 'react'
import { Bug, ChevronDown, ChevronUp, ExternalLink, Loader2, ShieldOff } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { BugReportService } from '../../services/bugReportService'
import { BUG_STATUS_CONFIG } from '../../types/bugReport'
import type { BugReport, BugReportStatus } from '../../types/bugReport'

const ADMIN_EMAIL = 'christian.k@begone.se'

export default function BugReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const isAuthorized = user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (!isAuthorized) { setLoading(false); return }
    BugReportService.getAll().then(data => {
      setReports(data)
      setLoading(false)
    })
  }, [isAuthorized])

  const handleExpand = async (report: BugReport) => {
    if (expandedId === report.id) { setExpandedId(null); return }
    setExpandedId(report.id)

    if (report.image_path && !imageUrls[report.id]) {
      const url = await BugReportService.getImageUrl(report.image_path)
      if (url) setImageUrls(prev => ({ ...prev, [report.id]: url }))
    }
  }

  const handleStatusChange = async (id: string, status: BugReportStatus) => {
    setUpdatingId(id)
    await BugReportService.updateStatus(id, status)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    setUpdatingId(null)
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ShieldOff className="w-12 h-12 text-slate-600" />
        <p className="text-slate-400 text-sm">Du har inte behörighet att se buggrapporter.</p>
      </div>
    )
  }

  const counts = {
    unhandled: reports.filter(r => r.status === 'unhandled').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
          <Bug className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-bold">Buggrapporter</h1>
          <p className="text-slate-400 text-sm">{reports.length} rapporter totalt</p>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(Object.keys(BUG_STATUS_CONFIG) as BugReportStatus[]).map(status => {
          const cfg = BUG_STATUS_CONFIG[status]
          return (
            <div key={status} className={`p-3 rounded-xl border border-slate-700 ${cfg.bgClass}/30`}>
              <p className={`text-2xl font-bold ${cfg.textClass}`}>{counts[status]}</p>
              <p className="text-slate-400 text-xs mt-0.5">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <Bug className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Inga buggrapporter ännu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(report => {
            const cfg = BUG_STATUS_CONFIG[report.status]
            const isExpanded = expandedId === report.id
            return (
              <div key={report.id} className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                {/* Row */}
                <button
                  onClick={() => handleExpand(report)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{report.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-500 text-xs">{report.reported_by_name}</span>
                      {report.reported_by_role && (
                        <span className="text-slate-600 text-xs">· {report.reported_by_role}</span>
                      )}
                      <span className="text-slate-600 text-xs">· {new Date(report.created_at).toLocaleDateString('sv-SE')}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bgClass} ${cfg.textClass}`}>
                    {cfg.label}
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {/* Expanderat innehåll */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-700/50 space-y-3">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{report.description}</p>

                    {report.url && (
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#20c58f] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {report.url}
                      </a>
                    )}

                    {report.image_path && (
                      imageUrls[report.id] ? (
                        <img
                          src={imageUrls[report.id]}
                          alt="Skärmdump"
                          className="max-h-64 rounded-lg border border-slate-700 object-contain"
                        />
                      ) : (
                        <div className="text-slate-500 text-xs flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Laddar bild...
                        </div>
                      )
                    )}

                    {/* Email */}
                    {report.reported_by_email && (
                      <p className="text-slate-500 text-xs">Rapporterad av: {report.reported_by_email}</p>
                    )}

                    {/* Statusändring */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-400">Ändra status:</span>
                      <div className="flex gap-1.5">
                        {(Object.keys(BUG_STATUS_CONFIG) as BugReportStatus[]).map(s => {
                          const c = BUG_STATUS_CONFIG[s]
                          const isActive = report.status === s
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(report.id, s)}
                              disabled={isActive || updatingId === report.id}
                              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                                isActive
                                  ? `${c.bgClass} ${c.textClass} cursor-default`
                                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                              } disabled:opacity-60`}
                            >
                              {updatingId === report.id && !isActive ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : c.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
