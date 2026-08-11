// src/pages/shared/intranet/interactive/FaktureringDemo.tsx
// Interaktiv övning för faktureringsguiden (kontoret):
// 1) Scenarioväljare - se vilken väg fakturan tar för varje
//    ärende-/kundtyp, med samma etiketter som Fakturering-sidan.
// 2) Statusresan - ta ett underlag hela vägen till Betald.

import { useState } from 'react'
import {
  MousePointerClick,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Receipt,
  User,
  Building2,
  FileText,
  Plus,
  Network,
} from 'lucide-react'

interface Scenario {
  id: string
  label: string
  icon: React.ElementType
  tag: string
  tagClass: string
  steps: string[]
  note: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'privat',
    label: 'Privatperson - engångsärende',
    icon: User,
    tag: 'Privat',
    tagClass: 'bg-blue-500/20 text-blue-400',
    steps: [
      'Teknikern fyller i Tjänster & fakturarader (med ROT/RUT-markering) och avslutar ärendet.',
      'Underlaget dyker upp under Fakturering › Privat & Företag.',
      'Du granskar raderna och godkänner underlaget.',
      'Fakturan skapas i Fortnox - ROT/RUT-underlaget följer med automatiskt.',
      'Fakturan bokförs och skickas till kundens mail eller adress.',
      'Betalningen registreras - klart.',
    ],
    note: 'ROT/RUT-avdraget dras på fakturan och Fortnox sköter ansökan mot Skatteverket - men bara om teknikern markerat raderna rätt.',
  },
  {
    id: 'foretag',
    label: 'Företag - engångsärende',
    icon: Building2,
    tag: 'Företag',
    tagClass: 'bg-purple-500/20 text-purple-400',
    steps: [
      'Teknikern fyller i Tjänster & fakturarader och avslutar ärendet.',
      'Underlaget dyker upp under Fakturering › Privat & Företag.',
      'Du granskar och godkänner - kontrollera fakturamail/referens på kundkortet.',
      'Fakturan skapas, bokförs och skickas via Fortnox.',
      'Betalningen registreras - förfallna fakturor flaggas i egen kolumn.',
    ],
    note: 'Samma flöde som privat men utan ROT/RUT. Företagets fakturauppgifter hämtas från kundens faktureringsinställningar.',
  },
  {
    id: 'avtal',
    label: 'Avtalskund - årspremie',
    icon: FileText,
    tag: 'Avtal',
    tagClass: 'bg-emerald-500/20 text-emerald-400',
    steps: [
      'Avtalets årspremie och faktureringsfrekvens (t.ex. kvartalsvis) styr allt - inga fakturarader behövs.',
      'Perioder genereras under Fakturering › Avtalskunder.',
      'Du godkänner periodens underlag.',
      'Fakturan skapas i Fortnox och skickas.',
      'Betalningen registreras.',
    ],
    note: 'Viktigt: besök som INGÅR i avtalet (avtalsärenden, rondering, egenkontroller) faktureras aldrig separat - de täcks av premien.',
  },
  {
    id: 'merforsaljning',
    label: 'Avtalskund - merförsäljning',
    icon: Plus,
    tag: 'Merförsäljning',
    tagClass: 'bg-amber-500/20 text-amber-400',
    steps: [
      'Teknikern utför något UTÖVER avtalet och lägger tjänsterader i ärendet - kundens prislista styr priset.',
      'Raderna hamnar under Fakturering › Merförsäljning Avtal.',
      'Du granskar och godkänner - merförsäljningen faktureras separat från årspremien.',
      'Fakturan skapas i Fortnox och skickas.',
      'Betalningen registreras.',
    ],
    note: 'Håll koll på fliken regelbundet - sidan varnar med en banner om det ligger ofakturerade merförsäljningsrader och väntar.',
  },
  {
    id: 'multisite',
    label: 'Kedjekund - flera enheter',
    icon: Network,
    tag: 'Multisite',
    tagClass: 'bg-cyan-500/20 text-cyan-400',
    steps: [
      'Ärendet eller merförsäljningen hör till en specifik enhet i kedjan.',
      'Underlaget hamnar i samma flikar som vanligt - men per enhet.',
      'Vid fakturering väljer systemet automatiskt rätt Fortnox-kund för enheten, även när flera enheter delar organisationsnummer.',
      'Fakturan går till enhetens fakturamottagare.',
    ],
    note: 'Avtalsdatum och organisationsnummer kan ärvas från huvudkontoret - du behöver inte hålla reda på det manuellt.',
  },
]

const STATUS_JOURNEY = [
  { status: 'Godkännas', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', action: 'Godkänn underlaget', info: 'Underlaget väntar på granskning. Kontrollera rader, priser och ROT/RUT innan du godkänner.' },
  { status: 'Redo för Fortnox', color: 'text-sky-400 bg-sky-500/15 border-sky-500/30', action: 'Skapa i Fortnox', info: 'Godkänt - nästa steg skapar fakturan i Fortnox med kundkort och alla rader.' },
  { status: 'Utkast i Fortnox', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30', action: 'Bokför fakturan', info: 'Fakturan ligger som utkast i Fortnox. Bokförningen låser den.' },
  { status: 'Bokförd', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30', action: 'Skicka till kund', info: 'Bokförd i Fortnox - skicka den till kundens fakturamail eller adress.' },
  { status: 'Skickad', color: 'text-purple-400 bg-purple-500/15 border-purple-500/30', action: 'Registrera betalning', info: 'Skickad till kund. Blir den liggande efter förfallodatum flaggas den som Förfallen.' },
  { status: 'Betald', color: 'text-[#20c58f] bg-[#20c58f]/15 border-[#20c58f]/30', action: '', info: 'Betalningen är registrerad - hela kedjan är sluten.' },
]

export default function FaktureringDemo() {
  const [activeScenario, setActiveScenario] = useState<string>(SCENARIOS[0].id)
  const [viewed, setViewed] = useState<Set<string>>(new Set([SCENARIOS[0].id]))
  const [journeyStep, setJourneyStep] = useState(0)

  const scenario = SCENARIOS.find(s => s.id === activeScenario)!
  const current = STATUS_JOURNEY[journeyStep]
  const journeyDone = journeyStep === STATUS_JOURNEY.length - 1

  const selectScenario = (id: string) => {
    setActiveScenario(id)
    setViewed(prev => new Set(prev).add(id))
  }

  const tasks = [
    { label: `Utforska alla fem scenarier (${viewed.size}/5)`, done: viewed.size === SCENARIOS.length },
    { label: 'Ta ett underlag hela vägen till Betald', done: journeyDone },
  ]
  const allDone = tasks.every(t => t.done)

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex items-center gap-2">
        <MousePointerClick className="w-4 h-4 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova själv - vart tar fakturan vägen?</p>
      </div>

      <div className="p-4 space-y-4 bg-slate-900/40">
        {/* Uppdrag */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-1.5">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {task.done ? (
                <CheckCircle2 className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
              <span className={`text-sm ${task.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                {i + 1}. {task.label}
              </span>
            </div>
          ))}
        </div>

        {/* Scenarioväljare */}
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map(item => (
            <button
              key={item.id}
              onClick={() => selectScenario(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeScenario === item.id
                  ? 'bg-[#20c58f] border-[#20c58f] text-[#fff]'
                  : viewed.has(item.id)
                    ? 'bg-slate-800 border-[#20c58f]/40 text-slate-300 hover:text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label.split(' - ')[0]}
            </button>
          ))}
        </div>

        {/* Scenariokedjan */}
        <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <scenario.icon className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-white">{scenario.label}</h4>
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${scenario.tagClass}`}>{scenario.tag}</span>
          </div>
          <ol>
            {scenario.steps.map((step, i) => (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="w-6 h-6 rounded-full bg-[#20c58f]/15 border border-[#20c58f]/40 text-[#20c58f] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {i < scenario.steps.length - 1 && <span className="w-px flex-1 bg-slate-700 mt-1" />}
                </div>
                <p className="text-sm leading-relaxed text-slate-300 pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-cyan-400">{scenario.note}</p>
        </div>

        {/* Statusresan */}
        <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-[#20c58f]" />
            <h4 className="text-sm font-semibold text-white">Statusresan - ta underlaget till Betald</h4>
          </div>

          {/* Statuskedja */}
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {STATUS_JOURNEY.map((step, i) => (
              <div key={step.status} className="flex items-center gap-1">
                <span
                  className={`px-2 py-1 rounded-full text-[11px] font-medium border ${
                    i < journeyStep
                      ? 'bg-slate-800 border-slate-700 text-slate-500 line-through'
                      : i === journeyStep
                        ? step.color
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-600'
                  }`}
                >
                  {step.status}
                </span>
                {i < STATUS_JOURNEY.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600" />}
              </div>
            ))}
          </div>

          {/* Underlagskort */}
          <div className="px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-white">Råttsanering - Villa Ekbacken</p>
                <p className="text-xs text-slate-500">Privat · ROT · 4 800 kr exkl. moms</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${current.color}`}>{current.status}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-3">{current.info}</p>

          <div className="flex items-center gap-2">
            {!journeyDone ? (
              <button
                onClick={() => setJourneyStep(s => Math.min(s + 1, STATUS_JOURNEY.length - 1))}
                className="px-4 py-2 bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] rounded-lg text-sm font-semibold transition-colors"
              >
                {current.action}
              </button>
            ) : (
              <button
                onClick={() => setJourneyStep(0)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                Börja om
              </button>
            )}
          </div>
        </div>

        {allDone && (
          <div className="flex items-start gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#20c58f] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Snyggt - du kan hela kedjan!</p>
              <p className="text-xs text-slate-300 mt-1">
                Fem vägar in, en väg ut: granska → godkänn → Fortnox → betald. Kom ihåg att
                avtalens ingående besök aldrig faktureras separat, och håll ögonen på
                Merförsäljning Avtal-fliken.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
