// src/components/shared/PwaInstallSection.tsx
// "Använd som app" under Mitt konto. Visas bara på mobil.
//
// Android: knappen öppnar webbläsarens installationsdialog direkt.
// iOS: ingen webbläsare låter sidan starta installationen, så knappen visar
// en guide till Dela-menyn i stället.
// Redan installerad: en grön punkt och ingen knapp.

import { useState } from 'react'
import { Smartphone, Share, SquarePlus, ChevronDown, MoreVertical, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../ui/Card'
import { usePwaInstall } from '../../hooks/usePwaInstall'

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center tabular-nums">
        {n}
      </span>
      <span className="text-sm text-slate-300 leading-6">{children}</span>
    </li>
  )
}

export function PwaInstallSection() {
  const { platform, isStandalone, canPrompt, installed, installing, install } = usePwaInstall()
  const [showGuide, setShowGuide] = useState(false)

  if (platform === 'desktop') return null

  const done = isStandalone || installed

  const handleInstall = async () => {
    const outcome = await install()
    if (outcome === 'accepted') {
      toast.success('Klart. Ikonen ligger nu på hemskärmen.')
    } else if (outcome === 'unavailable') {
      setShowGuide(true)
    }
  }

  return (
    <Card className="mt-6">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-[#20c58f]" />
          Använd som app
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Lägg portalen på hemskärmen så öppnas den som en app, utan adressfält och med egen ikon.
        </p>

        {done ? (
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#20c58f]" />
            Installerad. Portalen körs som app på den här enheten.
          </p>
        ) : platform === 'android' && canPrompt ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full sm:w-auto px-4 py-3 bg-[#20c58f] hover:bg-[#1ab07f] disabled:opacity-60 text-[#fff] font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {installing ? <Loader2 className="w-5 h-5 animate-spin" /> : <SquarePlus className="w-5 h-5" />}
            Lägg till på hemskärmen
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowGuide(v => !v)}
              className="w-full sm:w-auto px-4 py-3 bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <SquarePlus className="w-5 h-5" />
              Så lägger du till appen
              <ChevronDown className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
            </button>

            {showGuide && (
              <div className="mt-4 bg-slate-800/50 rounded-lg p-4">
                {platform === 'ios' ? (
                  <ol className="space-y-3">
                    <Step n={1}>
                      Tryck på Dela-knappen
                      <Share className="inline w-4 h-4 mx-1 -mt-0.5 text-slate-400" />
                      längst ned i Safari. I Chrome sitter den uppe vid adressfältet.
                    </Step>
                    <Step n={2}>
                      Bläddra i listan och välj <span className="text-white">Lägg till på hemskärmen</span>.
                    </Step>
                    <Step n={3}>
                      Tryck på <span className="text-white">Lägg till</span> uppe till höger.
                    </Step>
                  </ol>
                ) : (
                  <ol className="space-y-3">
                    <Step n={1}>
                      Öppna webbläsarens meny
                      <MoreVertical className="inline w-4 h-4 mx-1 -mt-0.5 text-slate-400" />
                      uppe till höger.
                    </Step>
                    <Step n={2}>
                      Välj <span className="text-white">Lägg till på startskärmen</span> eller <span className="text-white">Installera app</span>.
                    </Step>
                    <Step n={3}>
                      Bekräfta med <span className="text-white">Installera</span>.
                    </Step>
                  </ol>
                )}
                <p className="mt-4 text-xs text-slate-500">
                  Appen har egen inloggning, så du får logga in en gång till första gången du öppnar den.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

export default PwaInstallSection
