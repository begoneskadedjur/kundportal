// src/components/shared/OneflowPdfFrame.tsx
// Visar Oneflows egen PDF för ett dokument (även utkast) direkt i portalen.
// PDF:en hämtas via api/oneflow/draft som Blob och visas i en iframe med en
// objekt-URL, så att webbläsarens inbyggda PDF-läsare används.
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { OneflowDraftService } from '../../services/oneflowDraftService'

interface OneflowPdfFrameProps {
  oneflowContractId: string | number
  /** Filnamnet som visas i ramens list */
  title: string
  className?: string
}

export default function OneflowPdfFrame({ oneflowContractId, title, className = '' }: OneflowPdfFrameProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setUrl(null)
    setError(null)
    OneflowDraftService.fetchPdf(oneflowContractId)
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setUrl(objectUrl)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Kunde inte hämta PDF:en') })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [oneflowContractId, attempt])

  const retry = useCallback(() => setAttempt(a => a + 1), [])

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700 text-sm text-slate-400">
        <span className="truncate">{title}.pdf</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-[#20c58f] hover:underline">
            Öppna i ny flik
          </a>
        )}
      </div>
      <div className="flex-1 bg-slate-800 min-h-[70vh] flex">
        {url ? (
          <iframe src={url} title={title} className="w-full min-h-[70vh] flex-1 border-0" />
        ) : error ? (
          <div className="m-auto max-w-sm text-center p-6 space-y-3">
            <p className="text-sm text-slate-300">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[44px] px-4 rounded-lg border border-slate-600 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              Försök igen
            </button>
          </div>
        ) : (
          <div className="m-auto flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" />
            Hämtar PDF:en från Oneflow…
          </div>
        )}
      </div>
    </div>
  )
}
