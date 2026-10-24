// src/components/shared/PwaInstallSection.tsx
// Gruppen Appen på hemskärmen på Mitt konto (UserProfile). Ritar bara kortets innehåll,
// rubriken över kortet sätter sidan.
//
// Android med installationserbjudande: knappen öppnar webbläsarens installationsdialog,
// men bara när man trycker. ALDRIG en automatisk prompt.
// iPhone och Android utan erbjudande: knappen visar stegen för telefonen.
// Datorn: stegen för iPhone och Android, så att man kan göra det i telefonen sedan.
// Redan installerad: en grön punkt och ingen knapp.

import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../icons/Icon'
import { usePwaInstall } from '../../hooks/usePwaInstall'

type Telefon = 'ios' | 'android'

const KNAPP_PRIMAR = 'min-h-[48px] w-full sm:w-auto px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[15px] font-semibold text-[#04281c] hover:bg-[#1bb07f] disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]'
const KNAPP_SEKUNDAR = 'min-h-[48px] w-full sm:w-auto px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 text-[15px] font-medium text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

function Steg({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full border border-slate-600 text-slate-200 text-sm font-semibold flex items-center justify-center tabular-nums">
        {n}
      </span>
      <span className="text-[15px] text-slate-300 leading-7">{children}</span>
    </li>
  )
}

function Ikon({ name }: { name: 'konto.dela' | 'konto.webbmeny' }) {
  return <Icon name={name} size={20} className="inline-block align-[-4px] mx-1 text-slate-400" />
}

function StegFor({ telefon }: { telefon: Telefon }) {
  return telefon === 'ios' ? (
    <ol className="space-y-3">
      <Steg n={1}>Tryck på Dela-knappen<Ikon name="konto.dela" />längst ned i Safari. I Chrome sitter den uppe vid adressfältet.</Steg>
      <Steg n={2}>Bläddra i listan och välj <span className="text-white font-medium">Lägg till på hemskärmen</span>.</Steg>
      <Steg n={3}>Tryck på <span className="text-white font-medium">Lägg till</span> uppe till höger.</Steg>
    </ol>
  ) : (
    <ol className="space-y-3">
      <Steg n={1}>Öppna webbläsarens meny<Ikon name="konto.webbmeny" />uppe till höger.</Steg>
      <Steg n={2}>Välj <span className="text-white font-medium">Lägg till på startskärmen</span> eller <span className="text-white font-medium">Installera app</span>.</Steg>
      <Steg n={3}>Bekräfta med <span className="text-white font-medium">Installera</span>.</Steg>
    </ol>
  )
}

export function PwaInstallSection() {
  const { platform, isStandalone, canPrompt, installed, installing, install } = usePwaInstall()
  const [visaSteg, setVisaSteg] = useState(false)
  const [telefon, setTelefon] = useState<Telefon>(platform === 'android' ? 'android' : 'ios')

  const klar = isStandalone || installed
  const dator = platform === 'desktop'

  const installera = async () => {
    const utfall = await install()
    if (utfall === 'accepted') {
      toast.success('Klart. Ikonen ligger nu på hemskärmen.')
    } else if (utfall === 'unavailable') {
      setVisaSteg(true)
    }
  }

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-start gap-3">
        <Icon name="konto.app" size={24} className="text-slate-400 flex-shrink-0" />
        <p className="text-[15px] text-slate-300">
          {dator
            ? 'I telefonen kan du lägga portalen på hemskärmen. Då öppnas den som en app, utan adressfält och med egen ikon. Öppna Mitt konto i telefonen och följ stegen.'
            : 'Lägg portalen på hemskärmen så öppnas den som en app, utan adressfält och med egen ikon.'}
        </p>
      </div>

      {klar ? (
        <p className="flex items-center gap-2 text-[15px] text-slate-300">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#20c58f]" />
          Installerad. Portalen körs som app på den här enheten.
        </p>
      ) : platform === 'android' && canPrompt ? (
        <button type="button" onClick={installera} disabled={installing} className={KNAPP_PRIMAR}>
          <Icon name={installing ? 'allman.laddar' : 'konto.hemskarm'} size={20} className={installing ? 'animate-spin' : ''} />
          Lägg till på hemskärmen
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setVisaSteg(v => !v)}
            aria-expanded={visaSteg}
            className={dator ? KNAPP_SEKUNDAR : KNAPP_PRIMAR}
          >
            <Icon name="konto.hemskarm" size={20} />
            Så lägger du till appen
            <Icon name="allman.chevron" size={16} className={`transition-transform ${visaSteg ? '-rotate-90' : 'rotate-90'}`} />
          </button>

          {visaSteg && (
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-4 space-y-4">
              {dator && (
                <div role="radiogroup" aria-label="Telefon" className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700 p-1 sm:w-72">
                  {([['ios', 'iPhone'], ['android', 'Android']] as const).map(([t, text]) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={telefon === t}
                      onClick={() => setTelefon(t)}
                      className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${telefon === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
              <StegFor telefon={dator ? telefon : platform === 'android' ? 'android' : 'ios'} />
              <p className="text-sm text-slate-400">
                Appen har egen inloggning, så du får logga in en gång till första gången du öppnar den.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PwaInstallSection
