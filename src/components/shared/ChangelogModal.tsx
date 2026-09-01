// src/components/shared/ChangelogModal.tsx
// "Uppdateringar" - visar vad som hänt i systemet den senaste tiden.
// Innehållet kommer från src/constants/changelog.ts.
//
// Följer den kompakta modalstandarden: bg-slate-900, p-4, ingen Card-komponent
// (glass-klassen ger grå overlay), inga piller.
//
// Renderas via Portal med EGET container-id. Sidofältet har backdrop-blur-xl,
// vilket gör det till containing block för fixed-positionering - utan portal
// blir modalen instängd i sidofältets bredd. Eget id i stället för delade
// 'modal-root' eftersom den containern har pointerEvents: none och en egen
// flex-layout som krockar med den här.

import { useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'
import Portal from '../ui/Portal'
import { CHANGELOG, LATEST_VERSION } from '../../constants/changelog'

interface ChangelogModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <Portal containerId="changelog-modal-root">
      <div
        className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Uppdateringar"
      >
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full max-w-xl my-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-700/50 flex-shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-widest text-[#20c58f] uppercase">
                BeGone Kundportal
              </p>
              <h2 className="text-lg font-semibold text-white mt-0.5">Uppdateringar</h2>
              <p className="text-xs text-slate-500 mt-0.5">Det senaste som byggts i systemet</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-[#20c58f] outline-none"
              aria-label="Stäng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto px-4 py-4 space-y-3">
            {CHANGELOG.map(entry => {
              const isLatest = entry.version === LATEST_VERSION
              return (
                <article
                  key={entry.version}
                  className={`p-3 rounded-xl border border-slate-700 border-l-2 ${
                    isLatest
                      ? 'border-l-[#20c58f] bg-[#20c58f]/5'
                      : 'border-l-slate-600 bg-slate-800/30'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-mono text-xs text-[#20c58f] flex-shrink-0">
                        {entry.version}
                      </span>
                      <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
                    </div>
                    <time
                      dateTime={entry.date}
                      className="font-mono text-[11px] text-slate-500 flex-shrink-0"
                    >
                      {entry.date}
                    </time>
                  </div>

                  <ul className="space-y-1">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-slate-300 leading-snug">
                        <span className="text-slate-600 flex-shrink-0 select-none">–</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-700/50 flex items-center gap-2 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
            <p className="text-xs text-slate-500">Saknar du något? Hör av dig till Christian.</p>
          </div>
        </div>
      </div>
    </Portal>
  )
}
