// src/components/technician/ny/layout/SkapaArk.tsx
// Skapa-arket i nya arbetsvyn: bottenark i telefonen, ruta på datorn.
// Varje val leder till en befintlig sida, utom Ticket till en kollega som
// öppnar dialogen direkt (NyFragaDialog i layouten). Tillbud ligger avskilt längst ner.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../../../icons/Icon'

interface Val {
  rubrik: string
  text: string
  ikon: IconName
  /** Sida att gå till, eller 'fraga' för dialogen Ny ticket */
  to: string
}

const VAL: Val[] = [
  { rubrik: 'Avtal eller offert', text: 'Skickas till kunden som signerar i mobilen.', ikon: 'dok.avtal', to: '/technician/oneflow' },
  { rubrik: 'Specialrapport', text: 'Inspektion, sanering eller annan rapport med bilder.', ikon: 'falt.specialrapport', to: '/technician/specialrapporter' },
  { rubrik: 'Ny station', text: 'Välj kunden på Stationer och placera stationen på kartan.', ikon: 'falt.nystation', to: '/technician/equipment' },
  { rubrik: 'Tips om ny kund', text: 'Någon som behöver hjälp? Skriv namn och vad det gäller.', ikon: 'lead.tips', to: '/technician/leads?ny=1' },
  { rubrik: 'Ticket till en kollega', text: 'Till en kollega, en roll eller alla, om ett ärende.', ikon: 'dok.konversation', to: 'fraga' },
  { rubrik: 'Fråga AI-assistenten', text: 'Om skadedjur, metoder eller hur portalen fungerar.', ikon: 'kalla.ai', to: '/technician/team-chat' },
]

interface Props {
  oppen: boolean
  onClose: () => void
  /** Öppnar dialogen Ny ticket */
  onNyFraga: () => void
}

export function SkapaArk({ oppen, onClose, onNyFraga }: Props) {
  const navigate = useNavigate()
  const stangRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!oppen) return
    stangRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [oppen, onClose])

  if (!oppen) return null

  const ga = (to: string) => {
    onClose()
    if (to === 'fraga') onNyFraga()
    else navigate(to)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="skapa-rubrik"
        className="relative w-full lg:max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border-t lg:border border-slate-700 rounded-t-3xl lg:rounded-2xl shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <span aria-hidden="true" className="lg:hidden block mx-auto mt-2 w-10 h-1 rounded-full bg-slate-600" />
        <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
          <div>
            <h2 id="skapa-rubrik" className="text-lg font-semibold text-white">Vad vill du göra?</h2>
            <p className="text-sm text-slate-400">Välj en ruta. Du kan alltid gå tillbaka.</p>
          </div>
          <button
            ref={stangRef}
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="w-11 h-11 -mr-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="allman.stang" size={20} />
          </button>
        </header>

        <ul className="px-3 space-y-1">
          {VAL.map(v => (
            <li key={v.rubrik}>
              <button
                type="button"
                onClick={() => ga(v.to)}
                className="w-full flex items-center gap-3 px-2 py-3 min-h-[64px] rounded-xl text-left hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
              >
                <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#20c58f]/10 text-[#20c58f] flex items-center justify-center">
                  <Icon name={v.ikon} size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-white">{v.rubrik}</span>
                  <span className="block text-sm text-slate-400">{v.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mx-3 mt-2 pt-2 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => ga('/technician/tillbud-avvikelser')}
            className="w-full flex items-center gap-3 px-2 py-3 min-h-[64px] rounded-xl text-left hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Icon name="rapport.avvikelse" size={24} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-white">Tillbud, avvikelse eller olycka</span>
              <span className="block text-sm text-slate-400">Något hände eller höll på att hända.</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  )
}

export default SkapaArk
