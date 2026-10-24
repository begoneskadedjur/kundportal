// src/pages/shared/intranet/interactive/nyvy/AppenPaHemskarmen.tsx
// Interaktiv del i guiden Ställ in Mitt konto (tekniker): så lägger du portalen
// på hemskärmen i iPhone eller Android. Texterna följer PwaInstallSection.tsx (gruppen Appen på hemskärmen
// under Mitt konto. Knappen finns i telefonen, på datorn visas bara stegen):
//   Android med installationsdialog  knappen Lägg till på hemskärmen, notisen
//                                    "Klart. Ikonen ligger nu på hemskärmen."
//   iPhone och övriga                knappen Så lägger du till appen med tre steg
//   redan installerad                "Installerad. Portalen körs som app på den här enheten."

import { useState } from 'react'

type Telefon = 'iphone' | 'android'

const STEG: Record<Telefon, string[]> = {
  iphone: [
    'Tryck på Dela-knappen längst ned i Safari. I Chrome sitter den uppe vid adressfältet.',
    'Bläddra i listan och välj Lägg till på hemskärmen.',
    'Tryck på Lägg till uppe till höger.',
  ],
  android: [
    'Öppna webbläsarens meny uppe till höger.',
    'Välj Lägg till på startskärmen eller Installera app.',
    'Bekräfta med Installera.',
  ],
}

export default function AppenPaHemskarmen() {
  const [telefon, setTelefon] = useState<Telefon>('iphone')
  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Lägg portalen på hemskärmen</p>
        <p className="text-sm text-slate-400">Under Mitt konto finns gruppen Appen på hemskärmen. Gör det i telefonen. Välj din telefon.</p>
      </div>
      <div role="radiogroup" aria-label="Telefon" className="flex gap-2">
        {([['iphone', 'iPhone'], ['android', 'Android']] as const).map(([t, text]) => (
          <button key={t} type="button" role="radio" aria-checked={telefon === t} onClick={() => setTelefon(t)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${telefon === t ? 'bg-[#20c58f] text-[#fff]' : 'border border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
            {text}
          </button>
        ))}
      </div>
      <div className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm" aria-live="polite">
        {telefon === 'android' && (
          <p className="text-slate-300">
            Visar rutan knappen <span className="font-semibold text-white">Lägg till på hemskärmen</span>: tryck på den och bekräfta. Då står det Klart. Ikonen ligger nu på hemskärmen. Annars trycker du <span className="font-semibold text-white">Så lägger du till appen</span> och gör så här:
          </p>
        )}
        {telefon === 'iphone' && (
          <p className="text-slate-300">Tryck <span className="font-semibold text-white">Så lägger du till appen</span>. Då visas stegen:</p>
        )}
        <ol className="grid gap-2">
          {STEG[telefon].map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">{i + 1}</span>
              <span className="leading-6 text-slate-300">{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500">Appen har egen inloggning, så du får logga in en gång till första gången du öppnar den.</p>
      </div>
      <p className="text-xs text-slate-500">När portalen redan ligger på hemskärmen står det Installerad. Portalen körs som app på den här enheten.</p>
    </div>
  )
}
