// src/pages/shared/intranet/interactive/ArendetyperDemo.tsx
// Interaktiv övning: välj rätt ärendetyp för sex verkliga scenarier.
// Alternativen speglar Skapa ärende-väljaren i koordinatorschemat.

import { useState } from 'react'
import { MousePointerClick, CheckCircle2, XCircle, Sparkles, RotateCcw } from 'lucide-react'

const CASE_TYPES = [
  { id: 'private', label: 'Engångsjobb Privatperson' },
  { id: 'business', label: 'Engångsjobb Företag' },
  { id: 'contract', label: 'Extrabesök Avtalskund' },
  { id: 'inspection', label: 'Stationskontroll Avtalskund' },
  { id: 'establishment', label: 'Etablering Avtalskund' },
]

interface Quiz {
  scenario: string
  correct: string
  explain: string
}

const QUESTIONS: Quiz[] = [
  {
    scenario: 'En privatperson ringer om ett getingbo på villan. Ingen avtalskund.',
    correct: 'private',
    explain: 'Engångsjobb åt privatperson = Engångsjobb Privatperson. Ärendet faktureras separat när det avslutas, med ROT/RUT om det är aktuellt.',
  },
  {
    scenario: 'En restaurang utan avtal vill ha en engångssanering av kackerlackor.',
    correct: 'business',
    explain: 'Företag utan avtal = Engångsjobb Företag. Väljer du Etablering hamnar jobbet i avtalsflödet och faktureras aldrig som det ska.',
  },
  {
    scenario: 'En NY avtalskund har precis skrivit avtal - stationerna ska placeras ut för första gången.',
    correct: 'establishment',
    explain: 'Detta är det ENDA Etablering är till för: utplacering av stationer hos en avtalskund vid avtalsstart. Tjänsten Etableringskostnad förväljs automatiskt.',
  },
  {
    scenario: 'En avtalskunds stationer ska kontrolleras - ett enstaka kontrollbesök behöver in i schemat.',
    correct: 'inspection',
    explain: 'Stationskontroller = Stationskontroll Avtalskund. Obs: de ÅTERKOMMANDE kontrollerna schemaläggs normalt automatiskt via Rondering & Schema - manuellt skapar du bara enstaka extra kontroller.',
  },
  {
    scenario: 'En avtalskund vill ha en EXTRA sanering utöver det som ingår i avtalet - ingen stationskontroll.',
    correct: 'contract',
    explain: 'Enstaka tjänster hos avtalskund som inte är stationskontroll = Extrabesök Avtalskund. Lägg fakturarader i ärendet så hamnar det som merförsäljning med kundens prislista. INTE Företag (då tappas avtalskopplingen) och INTE Etablering.',
  },
  {
    scenario: 'En tekniker ska utföra ett engångsjobb hos en kund utan avtal - vilken typ är FEL att välja?',
    correct: 'establishment',
    explain: 'Precis - Etablering är fel! Det är det vanligaste misstaget: Etablering är enbart för utplacering av stationer hos avtalskunder, aldrig för engångsjobb. Rätt val hade varit Privatperson eller Företag.',
  },
]

export default function ArendetyperDemo() {
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const question = QUESTIONS[index]
  const isCorrect = answered === question.correct

  const answer = (id: string) => {
    if (answered) return
    setAnswered(id)
    if (id === question.correct) setCorrectCount(c => c + 1)
  }

  const next = () => {
    if (index === QUESTIONS.length - 1) {
      setFinished(true)
    } else {
      setIndex(i => i + 1)
      setAnswered(null)
    }
  }

  const restart = () => {
    setIndex(0)
    setAnswered(null)
    setCorrectCount(0)
    setFinished(false)
  }

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-[#20c58f]" />
          <p className="text-sm font-semibold text-white">Prova själv - vilken ärendetyp väljer du?</p>
        </div>
        {!finished && (
          <span className="text-xs text-slate-400 tabular-nums">{index + 1} / {QUESTIONS.length}</span>
        )}
      </div>

      <div className="p-4 space-y-4 bg-slate-900/40">
        {finished ? (
          <div className="flex items-start gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#20c58f] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                {correctCount} av {QUESTIONS.length} rätt{correctCount === QUESTIONS.length ? ' - perfekt!' : ''}
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Huvudreglerna: Engångsjobb = Privatperson eller Företag. Stationskontroller =
                Stationskontroll (återkommande via Rondering & Schema). Enstaka tjänster hos
                avtalskund = Extrabesök. Etablering = enbart utplacering av stationer vid avtalsstart.
              </p>
              <button
                onClick={restart}
                className="flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Kör igen
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Scenario */}
            <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Scenario</p>
              <p className="text-sm leading-relaxed text-white">{question.scenario}</p>
            </div>

            {/* Alternativ */}
            <div className="grid gap-2 sm:grid-cols-2">
              {CASE_TYPES.map(type => {
                const chosen = answered === type.id
                const showCorrect = answered && type.id === question.correct
                return (
                  <button
                    key={type.id}
                    onClick={() => answer(type.id)}
                    disabled={!!answered}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-colors ${
                      showCorrect
                        ? 'bg-[#20c58f]/15 border-[#20c58f]/50 text-[#20c58f]'
                        : chosen
                          ? 'bg-red-500/15 border-red-500/50 text-red-400'
                          : answered
                            ? 'bg-slate-800/40 border-slate-700/50 text-slate-500'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {showCorrect ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : chosen ? (
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-current opacity-40 flex-shrink-0" />
                    )}
                    {type.label}
                  </button>
                )
              })}
            </div>

            {/* Feedback */}
            {answered && (
              <div className={`p-3 rounded-xl border ${isCorrect ? 'bg-[#20c58f]/10 border-[#20c58f]/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <p className={`text-sm font-semibold ${isCorrect ? 'text-[#20c58f]' : 'text-amber-400'}`}>
                  {isCorrect ? 'Rätt!' : 'Inte riktigt.'}
                </p>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{question.explain}</p>
                <button
                  onClick={next}
                  className="mt-2.5 px-4 py-1.5 bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] rounded-lg text-xs font-semibold transition-colors"
                >
                  {index === QUESTIONS.length - 1 ? 'Visa resultat' : 'Nästa scenario'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
